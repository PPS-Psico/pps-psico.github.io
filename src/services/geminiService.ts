import { SUPABASE_URL } from "../constants";
import { supabase } from "../lib/supabaseClient";

const getAuthToken = async (): Promise<string> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
};

interface GenerateContentRequest {
  prompt: string;
}

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

export const testGeminiModel = async (model: string): Promise<ModelDiagnostic> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
  // CONFIGURACIÓN DE PRIORIDAD - Fallback automático entre modelos
  // Si un modelo falla (alta demanda, cuota, no encontrado), se prueba el siguiente
  const models = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  let lastError = new Error("No se pudo conectar con los servicios de IA de Google");

  for (const model of models) {
    try {
      console.log(`DEBUG - Probando modelo: ${model}`);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ prompt, model }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Error ${response.status}`;

        // Si el modelo no existe, no está soportado, no tiene cuota, o tiene alta demanda, saltar al siguiente
        const isSkippable =
          errorMessage.toLowerCase().includes("not found") ||
          errorMessage.toLowerCase().includes("not supported") ||
          errorMessage.toLowerCase().includes("quota") ||
          errorMessage.toLowerCase().includes("high demand") ||
          errorMessage.toLowerCase().includes("temporal") ||
          response.status === 429 ||
          response.status === 404;

        if (isSkippable) {
          console.warn(`DEBUG - Saltando ${model}: ${errorMessage}`);
          lastError = new Error(errorMessage);
          continue;
        }

        throw new Error(errorMessage);
      }

      const data: GenerateContentResponse = await response.json();

      if (data.error) {
        const msg = data.error.message;
        const isDataSkippable =
          msg.toLowerCase().includes("quota") ||
          msg.toLowerCase().includes("not found") ||
          msg.toLowerCase().includes("not supported") ||
          msg.toLowerCase().includes("high demand") ||
          msg.toLowerCase().includes("temporal");

        if (isDataSkippable) {
          console.warn(`DEBUG - Saltando (data.error) ${model}: ${msg}`);
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No content returned from Gemini");
      }

      console.log(`DEBUG - Modelo ${model} exitoso`);
      return text;
    } catch (error: any) {
      console.error(`Error con modelo ${model}:`, error);
      lastError = error;
      // Continuar con el siguiente modelo si el error es de cuota, alta demanda o temporal
      const errorMsg = error.message?.toLowerCase() || "";
      if (
        errorMsg.includes("quota") ||
        errorMsg.includes("high demand") ||
        errorMsg.includes("temporal") ||
        errorMsg.includes("not found") ||
        errorMsg.includes("not supported")
      ) {
        console.warn(`DEBUG - Saltando al siguiente modelo por error: ${error.message}`);
        continue;
      }
      // Otros errores (como red) los lanzamos inmediatamente
      throw error;
    }
  }

  throw lastError;
};
