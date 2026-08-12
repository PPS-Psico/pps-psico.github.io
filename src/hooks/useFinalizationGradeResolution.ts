import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/supabase";

export type FinalizationGradeResolution =
  Database["public"]["Functions"]["get_finalization_grade_resolution"]["Returns"][number];

export function useFinalizationGradeResolution(
  finalizationId: string | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ["finalization-grade-resolution", finalizationId],
    enabled: Boolean(finalizationId && enabled),
    queryFn: async (): Promise<FinalizationGradeResolution[]> => {
      if (!finalizationId) return [];
      const { data, error } = await supabase.rpc("get_finalization_grade_resolution", {
        p_finalizacion_id: finalizationId,
      });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function indexFinalizationGrades(
  rows: FinalizationGradeResolution[] | undefined
): Map<string, FinalizationGradeResolution> {
  return new Map((rows ?? []).map((row) => [row.practica_id, row]));
}

export function describeFinalizationGradeSource(
  row: FinalizationGradeResolution | null | undefined
): string | null {
  if (!row?.fuente) return null;
  const source =
    row.fuente === "moodle_api_verified"
      ? "Moodle API"
      : row.fuente === "moodle_export_verified"
        ? "Exportación Moodle"
        : row.fuente === "moodle_session_observed"
          ? "Campus observado"
          : row.fuente === "admin"
            ? "Corrección de coordinación"
            : "Fuente académica registrada";
  if (!row.observed_at) return source;
  const date = new Date(row.observed_at);
  return Number.isNaN(date.getTime()) ? source : `${source} · ${date.toLocaleDateString("es-AR")}`;
}
