import { useQuery } from "@tanstack/react-query";
import {
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_SELECTED_AT_CONVOCATORIAS,
  TABLE_NAME_CONVOCATORIAS,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { normalizeStringForComparison } from "../../utils/formatters";
import { range, ESTADOS_SELECCIONADO, percentil } from "./shared";

// ════════════════════════════════════════════════════════════════════════════
// TIEMPO HASTA LA SELECCIÓN (Reporte ejecutivo · Dinámica del ciclo)
// Cuántos días pasan entre que un alumno se postula y queda seleccionado
// (selected_at, asentado por convocatoriasService al seleccionar). Mide la
// experiencia de espera del estudiante — el "time to placement" del programa.
// selected_at tiene cobertura parcial desde 2026. Por eso siempre se publica la
// cobertura y la métrica se considera experimental; no se compara interanualmente.
// ════════════════════════════════════════════════════════════════════════════
export interface TiempoSeleccion {
  seleccionados: number;
  n: number;
  coberturaPct: number | null;
  medianaDias: number | null;
  p25Dias: number | null;
  p75Dias: number | null;
}

export const useTiempoSeleccion = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["tiempoSeleccion", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<TiempoSeleccion> => {
      const empty: TiempoSeleccion = {
        seleccionados: 0,
        n: 0,
        coberturaPct: null,
        medianaDias: null,
        p25Dias: null,
        p75Dias: null,
      };
      const { start, end } = range(year);
      const { data, error } = await supabase
        .from(TABLE_NAME_CONVOCATORIAS)
        .select(
          `created_at, ${FIELD_SELECTED_AT_CONVOCATORIAS}, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`
        )
        .gte("created_at", start)
        .lt("created_at", end);
      if (error) throw error;

      const seleccionados = ((data || []) as Array<Record<string, unknown>>).filter((r) => {
        const estado = normalizeStringForComparison(
          String(r[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
        );
        return ESTADOS_SELECCIONADO.includes(estado);
      });
      const dias: number[] = [];
      seleccionados.forEach((r) => {
        if (!r[FIELD_SELECTED_AT_CONVOCATORIAS]) return;
        const c = new Date(String(r.created_at || ""));
        const s = new Date(String(r[FIELD_SELECTED_AT_CONVOCATORIAS] || ""));
        if (Number.isNaN(c.getTime()) || Number.isNaN(s.getTime())) return;
        const d = (s.getTime() - c.getTime()) / 86400000;
        if (d >= 0 && d <= 365) dias.push(Math.round(d * 10) / 10);
      });
      dias.sort((a, b) => a - b);
      return {
        ...empty,
        seleccionados: seleccionados.length,
        n: dias.length,
        coberturaPct: seleccionados.length
          ? Math.round((dias.length / seleccionados.length) * 1000) / 10
          : null,
        medianaDias: percentil(dias, 0.5),
        p25Dias: percentil(dias, 0.25),
        p75Dias: percentil(dias, 0.75),
      };
    },
  });
};
