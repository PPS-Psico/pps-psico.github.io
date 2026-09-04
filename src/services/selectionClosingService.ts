import { supabase } from "../lib/supabaseClient";
import type { LanzamientoPPS } from "../types";

export interface CloseSelectionRpcResult {
  data: unknown;
  error: { message: string } | null;
}

export interface NotifySelectionResult {
  success: boolean;
  requested: number;
  sent: number;
  failed: number;
  message?: string;
  failures?: Array<{ convocatoriaId: string; name: string; reason: string }>;
}

export interface SelectionClosingDependencies {
  closeSelection: (launchId: string) => Promise<CloseSelectionRpcResult>;
  /** Dispara el aviso a los seleccionados. Devuelve el resumen del envío. */
  notifySelected: (launchId: string) => Promise<NotifySelectionResult>;
}

export interface QueuedSelectionClose {
  closeResult: unknown;
  /**
   * La UI no espera esta promesa para avanzar el pipeline, pero debe adjuntar
   * un catch. A diferencia del flujo viejo, que perdía el envío si el navegador
   * se cerraba, acá la tarea solo dispara la Edge Function: el envío en sí
   * sobrevive a la pestaña y queda registrado por estudiante.
   */
  notificationTask: Promise<NotifySelectionResult | void>;
}

const closeRequiresConsent = (closeResult: unknown): boolean => {
  if (!closeResult || typeof closeResult !== "object") return true;
  return (closeResult as { consentimiento_requerido?: unknown }).consentimiento_requerido !== false;
};

/**
 * Pide el envío de los avisos de selección a la Edge Function.
 *
 * Es idempotente por diseño: la función toma bajo lock solo las convocatorias
 * con `seleccion_notificada_at` en NULL, así que llamarla dos veces no duplica
 * correos y sirve igual como "reintentar los pendientes".
 */
export async function notifySelectedStudentsForLaunch(
  launchId: string
): Promise<NotifySelectionResult> {
  const { data, error } = await supabase.functions.invoke("notify-selection-closed", {
    body: { launchId },
  });
  if (error) throw error;

  const result = data as NotifySelectionResult | null;
  if (!result) throw new Error("El servidor no devolvió el resultado del envío.");
  if (!result.success && result.failed === 0 && result.requested === 0) {
    throw new Error(result.message || "No se pudo avisar a los seleccionados.");
  }
  return result;
}

const defaultDependencies: SelectionClosingDependencies = {
  closeSelection: async (launchId) => {
    const { data, error } = await supabase.rpc("close_selection", {
      p_lanzamiento_id: launchId,
    });
    return { data, error };
  },
  notifySelected: notifySelectedStudentsForLaunch,
};

/**
 * Cierra la mesa de forma atómica y, cuando la base determina que corresponde
 * consentimiento, dispara la notificación de seleccionados. Un cierre el mismo
 * día del inicio queda sin correo ni push de consentimiento.
 *
 * El cierre de base se espera y propaga errores. El aviso queda en una tarea
 * separada para no bloquear la transición visual del Lanzador; si esa llamada
 * falla, los estudiantes quedan en la cola de pendientes y la sala de firmas
 * ofrece reintentar. Antes, un fallo acá dejaba gente sin avisar y sin rastro.
 */
export async function closeSelectionAndQueueNotifications(
  launch: LanzamientoPPS,
  dependencies: SelectionClosingDependencies = defaultDependencies
): Promise<QueuedSelectionClose> {
  const closeResponse = await dependencies.closeSelection(launch.id);

  if (closeResponse.error) {
    throw new Error(closeResponse.error.message);
  }

  const notificationTask = closeRequiresConsent(closeResponse.data)
    ? dependencies.notifySelected(launch.id)
    : Promise.resolve();

  return {
    closeResult: closeResponse.data,
    notificationTask,
  };
}
