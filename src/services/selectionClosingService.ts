import { supabase } from "../lib/supabaseClient";
import type { LanzamientoPPS } from "../types";
import {
  fetchSelectedCandidatesForLaunch,
  notifySelectedStudents,
  type SelectionCandidate,
} from "./selectionNotificationService";

export interface CloseSelectionRpcResult {
  data: unknown;
  error: { message: string } | null;
}

export interface SelectionClosingDependencies {
  closeSelection: (launchId: string) => Promise<CloseSelectionRpcResult>;
  fetchCandidates: (launchId: string) => Promise<SelectionCandidate[]>;
  notifyCandidates: (launch: LanzamientoPPS, candidates: SelectionCandidate[]) => Promise<unknown>;
}

export interface QueuedSelectionClose {
  closeResult: unknown;
  /**
   * La UI no espera esta promesa para avanzar el pipeline, pero debe adjuntar
   * un catch para registrar cualquier fallo de notificación.
   */
  notificationTask: Promise<void>;
}

const defaultDependencies: SelectionClosingDependencies = {
  closeSelection: async (launchId) => {
    const { data, error } = await supabase.rpc("close_selection", {
      p_lanzamiento_id: launchId,
    });
    return { data, error };
  },
  fetchCandidates: fetchSelectedCandidatesForLaunch,
  notifyCandidates: notifySelectedStudents,
};

/**
 * Cierra la mesa de forma atómica y encola la notificación de seleccionados.
 *
 * El cierre de base se espera y propaga errores. Las notificaciones quedan en
 * una tarea separada para no bloquear la transición visual del Lanzador. La
 * separación también permite validar todo el flujo con dobles de prueba, sin
 * enviar emails ni push reales.
 */
export async function closeSelectionAndQueueNotifications(
  launch: LanzamientoPPS,
  dependencies: SelectionClosingDependencies = defaultDependencies
): Promise<QueuedSelectionClose> {
  const closeResponse = await dependencies.closeSelection(launch.id);

  if (closeResponse.error) {
    throw new Error(closeResponse.error.message);
  }

  const notificationTask = dependencies.fetchCandidates(launch.id).then(async (candidates) => {
    if (candidates.length === 0) return;
    await dependencies.notifyCandidates(launch, candidates);
  });

  return {
    closeResult: closeResponse.data,
    notificationTask,
  };
}
