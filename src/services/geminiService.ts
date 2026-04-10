import { SUPABASE_URL } from "../constants";
import { supabase } from "../lib/supabaseClient";

const getAuthToken = async (): Promise<string> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
};

interface GenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

export interface ModelDiagnostic {
  model: string;
  status: "success" | "quota_exceeded" | "not_found" | "error";
  message: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  quota: "Se agotó la cuota del modelo",
  "high demand": "El modelo está saturado, intentando con otro...",
  temporal: "Error temporal del servicio",
  "not found": "Modelo no disponible",
  "not supported": "Modelo no soportado",
};

const isSkippableError = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("not supported") ||
    lower.includes("quota") ||
    lower.includes("high demand") ||
    lower.includes("temporal")
  );
};

const getUserFriendlyError = (technicalMsg: string): string => {
  const lower = technicalMsg.toLowerCase();
  for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
    if (lower.includes(key)) return friendly;
  }
  return "Error al conectar con el servicio de IA. Intenta nuevamente.";
};

export const testGeminiModel = async (model: string): Promise<ModelDiagnostic> => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt: "Responder solo 'OK'", model }),
    });

    const data = await response.json().catch(() => ({}));
    const errorMessage = data.error?.message || "";

    if (response.ok && !data.error) {
      return { model, status: "success", message: "Disponible y con cupo" };
    }

    if (errorMessage.toLowerCase().includes("quota") || response.status === 429) {
      return { model, status: "quota_exceeded", message: "Existe, pero sin cupo (429)" };
    }

    if (
      errorMessage.toLowerCase().includes("not found") ||
      errorMessage.toLowerCase().includes("not supported") ||
      response.status === 404
    ) {
      return { model, status: "not_found", message: "ID Incorrecto / No encontrado" };
    }

    return { model, status: "error", message: errorMessage || `Error ${response.status}` };
  } catch (error: any) {
    return { model, status: "error", message: error.message };
  }
};

export const generateWithGemini = async (prompt: string): Promise<string> => {
  const models = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  let lastError = new Error("No se pudo generar contenido. Intenta nuevamente en unos minutos.");
  const token = await getAuthToken();

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, model }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Error ${response.status}`;

        const isSkippable =
          isSkippableError(errorMessage) || response.status === 429 || response.status === 404;

        if (isSkippable) {
          lastError = new Error(
            i < models.length - 1
              ? getUserFriendlyError(errorMessage)
              : "Todos los modelos de IA están saturados. Intenta nuevamente en unos minutos."
          );
          continue;
        }

        throw new Error(getUserFriendlyError(errorMessage));
      }

      const data: GenerateContentResponse = await response.json();

      if (data.error) {
        const msg = data.error.message;
        if (isSkippableError(msg)) {
          lastError = new Error(getUserFriendlyError(msg));
          continue;
        }
        throw new Error(getUserFriendlyError(msg));
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("El servicio de IA no devolvió contenido.");
      }

      return text;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message?.toLowerCase() || "";
      if (isSkippableError(errorMsg)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
};
