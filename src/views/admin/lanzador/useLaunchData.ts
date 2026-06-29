/**
 * useLaunchData — Hooks de datos compartidos del Lanzador.
 *
 * Una sola query por dato, con claves centralizadas en `launchQueryKeys`. Las
 * vistas por estado (Selección, Seguro, Confirmación, Activa, Archivada)
 * consumen estos hooks en lugar de armar cada una su propia query, de modo que
 * todas leen exactamente el mismo roster/prácticas y se invalidan juntas.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabaseClient";
import { launchKeys } from "../../../lib/launchQueryKeys";

/** Fila del roster de inscripciones (`convocatorias`) de un lanzamiento. */
export interface RosterRow {
  id: string;
  estado_inscripcion: string | null;
  estudiante_id: string | null;
  horario_asignado: string | null;
  horario_seleccionado: string | null;
  selected_at: string | null;
  baja_automatica_at: string | null;
  reminder_sent_at: string | null;
  created_at: string | null;
}

/** Práctica vinculada a un lanzamiento. */
export interface LaunchPracticaRow {
  id: string;
  estado: string | null;
  horas_realizadas: number | null;
}

/**
 * Roster completo de inscripciones de un lanzamiento (todas las columnas que
 * necesitan las vistas). Cada vista filtra/deriva del mismo set en cliente.
 */
export function useLaunchRoster(launchId: string) {
  return useQuery<RosterRow[]>({
    queryKey: launchKeys.roster(launchId),
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select(
          "id, estado_inscripcion, estudiante_id, horario_asignado, horario_seleccionado, selected_at, baja_automatica_at, reminder_sent_at, created_at"
        )
        .eq("lanzamiento_id", launchId)
        .order("created_at", { ascending: false });
      return (data || []) as RosterRow[];
    },
  });
}

/** Prácticas vinculadas a un lanzamiento (estado + horas). */
export function useLaunchPracticas(launchId: string) {
  return useQuery<LaunchPracticaRow[]>({
    queryKey: launchKeys.practicas(launchId),
    queryFn: async () => {
      const { data } = await supabase
        .from("practicas")
        .select("id, estado, horas_realizadas")
        .eq("lanzamiento_id", launchId);
      return (data || []) as LaunchPracticaRow[];
    },
  });
}
