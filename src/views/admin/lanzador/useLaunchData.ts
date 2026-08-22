/**
 * useLaunchData — Hooks de datos compartidos del Lanzador.
 *
 * Una sola query por dato, con claves centralizadas en `launchQueryKeys`. Las
 * vistas por estado (Selección, Seguro, Confirmación, Activa, Archivada)
 * consumen estos hooks en lugar de armar cada una su propia query, de modo que
 * todas leen exactamente el mismo roster/prácticas y se invalidan juntas.
 */
import { useQuery } from "@tanstack/react-query";
import {
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_HORARIO_ASIGNADO_CONVOCATORIAS,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
} from "../../../constants";
import { launchKeys } from "../../../lib/launchQueryKeys";
import { supabase } from "../../../lib/supabaseClient";
import { runQuery } from "../../../lib/dbQuery";
import { mockDb } from "../../../services/mockDb";

/** Fila del roster de inscripciones (`convocatorias`) de un lanzamiento. */
export interface RosterRow {
  id: string;
  estado_inscripcion: string | null;
  estudiante_id: string | null;
  horario_asignado: string | null;
  horario_seleccionado: string | null;
  opcion_horario_asignado_id: string | null;
  convocatoria_preferencias: Array<{ opcion_horario_id: string | null }>;
  selected_at: string | null;
  baja_automatica_at: string | null;
  reminder_sent_at: string | null;
  final_reminder_sent_at: string | null;
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
export function useLaunchRoster(launchId: string, isTestingMode = false) {
  return useQuery<RosterRow[]>({
    queryKey: [...launchKeys.roster(launchId), isTestingMode ? "testing" : "live"],
    queryFn: async () => {
      if (isTestingMode) {
        const rows = (await mockDb.getAll("convocatorias")) as Record<string, unknown>[];
        return rows
          .filter((row) => String(row[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]) === launchId)
          .map((row) => ({
            id: String(row.id),
            estado_inscripcion:
              (row[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] as string | null) ?? null,
            estudiante_id: (row[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string | null) ?? null,
            horario_asignado: (row[FIELD_HORARIO_ASIGNADO_CONVOCATORIAS] as string | null) ?? null,
            horario_seleccionado:
              (row[FIELD_HORARIO_FORMULA_CONVOCATORIAS] as string | null) ?? null,
            opcion_horario_asignado_id: (row.opcion_horario_asignado_id as string | null) ?? null,
            convocatoria_preferencias: [],
            selected_at: null,
            baja_automatica_at: null,
            reminder_sent_at: null,
            final_reminder_sent_at: null,
            created_at: (row.created_at as string | null) ?? null,
          }));
      }

      const data = await runQuery(
        supabase
          .from("convocatorias")
          .select(
            "id, estado_inscripcion, estudiante_id, horario_asignado, horario_seleccionado, opcion_horario_asignado_id, convocatoria_preferencias(opcion_horario_id), selected_at, baja_automatica_at, reminder_sent_at, final_reminder_sent_at, created_at"
          )
          .eq("lanzamiento_id", launchId)
          .order("created_at", { ascending: false }),
        { table: "convocatorias", operation: "useLaunchRoster" }
      );
      return (data || []) as RosterRow[];
    },
  });
}

/** Prácticas vinculadas a un lanzamiento (estado + horas). */
export function useLaunchPracticas(launchId: string) {
  return useQuery<LaunchPracticaRow[]>({
    queryKey: launchKeys.practicas(launchId),
    queryFn: async () => {
      const data = await runQuery(
        supabase
          .from("practicas")
          .select("id, estado, horas_realizadas")
          .eq("lanzamiento_id", launchId),
        { table: "practicas", operation: "useLaunchPracticas" }
      );
      return (data || []) as LaunchPracticaRow[];
    },
  });
}

export interface MoodleTaskUnitSummary {
  intent_id: string;
  lanzamiento_id: string;
  nombre_pps: string | null;
  orientacion_key: string;
  mode: "legacy_shared" | "dedicated";
  stable_key: string;
  provisioning_status:
    | "pending"
    | "claimed"
    | "reconciling"
    | "verified"
    | "needs_attention"
    | "error"
    | "disabled"
    | "cancelled";
  monitoring_status: "not_started" | "hot" | "cold" | "settled" | "needs_attention";
  cmid: number | null;
  course_id: number | null;
  desired_open_at: string | null;
  desired_due_at: string | null;
  last_verified_at: string | null;
  last_error_message: string | null;
  total_expected: number;
  total_submitted: number;
  total_missing: number;
  total_under_review: number;
  total_revision_required: number;
  total_passed: number;
  total_failed: number;
  total_waived: number;
  total_settled: number;
}

/** Resumen canónico por unidad (lanzamiento + orientación), nunca una fila arbitraria. */
export function useLaunchMoodleTaskUnits(launchId: string) {
  return useQuery<MoodleTaskUnitSummary[]>({
    queryKey: ["launch-moodle-units", launchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moodle_task_unit_summaries_v1", {
        p_launch_id: launchId,
      });
      if (error) throw error;
      return (data ?? []) as MoodleTaskUnitSummary[];
    },
    enabled: Boolean(launchId),
  });
}
