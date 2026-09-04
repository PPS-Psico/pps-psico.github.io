import { useQuery } from "@tanstack/react-query";
import {
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_FECHA_FINALIZACION_ESTUDIANTES,
  TABLE_NAME_ESTUDIANTES,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { parseToUTCDate } from "../../utils/formatters";

// ════════════════════════════════════════════════════════════════════════════
// SERIE PLURIANUAL DE FINALIZADOS (para el sparkline de la hero-métrica)
// Las otras dos series (generada/activa) salen de enrollment_evolution y
// trend_data del RPC; finalizados no, así que la calculamos acá.
// ════════════════════════════════════════════════════════════════════════════
export const useFinalizadosSeries = (isTestingMode = false) => {
  return useQuery({
    queryKey: ["metricsFinalizadosSeries", isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<{ year: number; value: number }[]> => {
      const counts = new Map<number, Set<string>>();
      const bump = (year: number, id: string) => {
        if (!counts.has(year)) counts.set(year, new Set());
        counts.get(year)!.add(id);
      };
      const { data: estudiantes, error } = await supabase
        .from(TABLE_NAME_ESTUDIANTES)
        .select(`id, ${FIELD_FECHA_FINALIZACION_ESTUDIANTES}, ${FIELD_ESTADO_ESTUDIANTES}`)
        .eq(FIELD_ESTADO_ESTUDIANTES, "Finalizado")
        .not(FIELD_FECHA_FINALIZACION_ESTUDIANTES, "is", null);
      if (error) throw error;
      (estudiantes || []).forEach((s: Record<string, unknown>) => {
        const d = parseToUTCDate(s[FIELD_FECHA_FINALIZACION_ESTUDIANTES] as string);
        const sid = String(s.id || "");
        if (d && sid) bump(d.getUTCFullYear(), sid);
      });
      return Array.from(counts.entries())
        .map(([year, set]) => ({ year, value: set.size }))
        .sort((a, b) => a.year - b.year);
    },
  });
};
