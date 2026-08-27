import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

/**
 * Estado de cierre de cada tarea del curso 3615.
 *
 * La RPC devuelve un agregado por tarea -- fechas, nunca alumnos -- así que
 * puede leerla cualquier sesión autenticada, incluida la del estudiante. El
 * panel la necesita para distinguir dos cosas que se ven igual pero no lo son:
 * un plazo calculado sobre la fecha de finalización estimada, que no puede
 * vencer porque nadie lo hace cumplir, y una Fecha límite ya cargada en Campus,
 * que sí bloquea la entrega.
 */
export interface MoodleTaskCloseState {
  cmid: string;
  /** Primera entrega observada en la tarea. Ancla real del cierre. */
  firstSubmittedAt: string | null;
  /** primera entrega + 30 días. Sólo para tareas del modelo nuevo. */
  suggestedCutoffAt: string | null;
  /** Cuándo coordinación registró el cierre. */
  closedAt: string | null;
  /** Fecha límite efectivamente cargada en Moodle. */
  closeCutoffAt: string | null;
  /** La tarea es del modelo nuevo: una tarea, una cohorte. */
  isEligible: boolean;
  /** Ya cumplió los 30 días y todavía no fue cerrada. */
  isClosable: boolean;
}

interface CloseStateRow {
  cmid: number | string;
  first_submitted_at: string | null;
  suggested_cutoff_at: string | null;
  closed_at: string | null;
  close_cutoff_at: string | null;
  is_eligible: boolean;
  is_closable: boolean;
}

export function useMoodleTaskCloseState(enabled = true): {
  closeStateByCmid: Map<string, MoodleTaskCloseState>;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
} {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["moodle-task-close-state"],
    enabled,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("moodle_task_close_state_v1");
      if (error) throw error;
      const map = new Map<string, MoodleTaskCloseState>();
      ((rows ?? []) as unknown as CloseStateRow[]).forEach((row) => {
        const cmid = String(row.cmid);
        map.set(cmid, {
          cmid,
          firstSubmittedAt: row.first_submitted_at,
          suggestedCutoffAt: row.suggested_cutoff_at,
          closedAt: row.closed_at,
          closeCutoffAt: row.close_cutoff_at,
          isEligible: Boolean(row.is_eligible),
          isClosable: Boolean(row.is_closable),
        });
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    closeStateByCmid: data ?? new Map<string, MoodleTaskCloseState>(),
    isLoading,
    refetch,
  };
}
