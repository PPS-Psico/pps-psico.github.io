import { SUPABASE_URL } from "../constants";

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
  // CONFIGURACIÓN DE PRIORIDAD BASADA EN DIAGNÓSTICO EXITOSO
  // 1. gemini-3-flash-preview (Tu 3.0 con 20 usos)
  // 2. gemini-2.0-flash (Existe pero suele estar saturado)
  // 3. gemini-2.5-flash (Tu modelo principal estable)
  // 4. gemini-2.5-flash-lite (Tu reserva de 20 usos)
  const models = [
    "gemini-3-flash-preview",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
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

        // Si el modelo no existe, no está soportado o no tiene cuota, saltar al siguiente
        const isSkippable =
          errorMessage.toLowerCase().includes("not found") ||
          errorMessage.toLowerCase().includes("not supported") ||
          errorMessage.toLowerCase().includes("quota") ||
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
          msg.toLowerCase().includes("not supported");

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

      return text;
    } catch (error: any) {
      console.error(`Error con modelo ${model}:`, error);
      lastError = error;
      // Si el error no es de cuota, quizás sea mejor no seguir?
      // Pero por seguridad, intentamos el siguiente si el error contiene "quota"
      if (!error.message.toLowerCase().includes("quota")) {
        throw error;
      }
    }
  }

  throw lastError;
};
