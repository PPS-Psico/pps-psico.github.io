import { supabase } from "../lib/supabaseClient";

type HermesProxyResponse<T> =
  { ok: true; data: T } | { ok: false; error?: string; detalle?: string };

/** Invoca una tarea permitida de Hermes sin exponer su credencial en el browser. */
export async function invokeHermesTask<T>(
  task: string,
  payload: unknown = {},
  timeoutMs?: number
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("hermes-proxy", {
    body: { task, payload, timeoutMs },
  });

  if (error) {
    throw new Error(`No se pudo invocar Hermes: ${error.message}`);
  }

  const response = data as HermesProxyResponse<T> | null;
  if (!response?.ok) {
    throw new Error(response?.error || "Hermes devolvió una respuesta inválida.");
  }

  return response.data;
}
