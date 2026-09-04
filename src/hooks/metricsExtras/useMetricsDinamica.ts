import { useQuery } from "@tanstack/react-query";
import {
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PRACTICAS,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { normalizeStringForComparison } from "../../utils/formatters";
import { range, ESTADOS_SELECCIONADO } from "./shared";

// ════════════════════════════════════════════════════════════════════════════
// DINÁMICA DEL CICLO (reemplaza al embudo)
// Tres métricas accionables sobre el proceso de inscripción/selección del año,
// coherentes con los KPIs de arriba:
//   · Demanda     → postulaciones por alumno (cuánto se mueven buscando lugar)
//   · Sin lugar   → postulados que aún no tienen PPS asignada (accionable)
//   · Concreción  → % de postulados que ya consiguió lugar
// Todo en PERSONAS, acotado al año. Incluye todas las PPS: una institución no se
// excluye por nombre ni por tener una modalidad de admisión particular.
// ════════════════════════════════════════════════════════════════════════════
export interface DinamicaCiclo {
  postulados: number; // alumnos distintos que se postularon este año
  postulaciones: number; // total de inscripciones (un alumno se postula a varias)
  postulacionesPorAlumno: number;
  conLugar: number; // postulados que ya tienen selección o práctica
  sinLugar: number; // postulados que todavía no tienen lugar
  concrecionPct: number | null; // conLugar / postulados
}

export const useMetricsDinamica = ({
  year,
  isTestingMode = false,
  enabled = true,
}: {
  year: number;
  isTestingMode?: boolean;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsDinamica", year, isTestingMode],
    enabled: enabled && !isTestingMode,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<DinamicaCiclo> => {
      const { start, end } = range(year);
      const postulados = new Set<string>();
      const seleccionados = new Set<string>();
      let postulaciones = 0;
      const { data: lanzamientosData, error: lanzamientosError } = await supabase
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .select("id")
        .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
        .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10));
      if (lanzamientosError) throw lanzamientosError;
      const lanzamientoIds = (lanzamientosData || []).map((l) => String(l.id));
      if (!lanzamientoIds.length) {
        return {
          postulados: 0,
          postulaciones: 0,
          postulacionesPorAlumno: 0,
          conLugar: 0,
          sinLugar: 0,
          concrecionPct: null,
        };
      }
      const rows: Array<Record<string, unknown>> = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: convocatoriaData, error: convocatoriaError } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(`id, estudiante_id, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`)
          .in(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, lanzamientoIds)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (convocatoriaError) throw convocatoriaError;
        const page = (convocatoriaData || []) as Array<Record<string, unknown>>;
        rows.push(...page);
        if (page.length < pageSize) break;
      }
      rows.forEach((r) => {
        const sid = r.estudiante_id ? String(r.estudiante_id) : "";
        if (!sid) return;
        const e = normalizeStringForComparison(
          String(r[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
        );
        if (ESTADOS_SELECCIONADO.includes(e)) seleccionados.add(sid);
        postulaciones += 1;
        postulados.add(sid);
      });

      // Alumnos con práctica del año (también cuentan como "con lugar").
      const conPractica = new Set<string>();
      const { data: practicaData, error: practicaError } = await supabase
        .from(TABLE_NAME_PRACTICAS)
        .select(`estudiante_id, ${FIELD_FECHA_INICIO_PRACTICAS}`)
        .eq(FIELD_TIPO_ACTIVIDAD_PRACTICAS, "pps")
        .gte(FIELD_FECHA_INICIO_PRACTICAS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_PRACTICAS, end.slice(0, 10));
      if (practicaError) throw practicaError;
      (practicaData || []).forEach((r: Record<string, unknown>) => {
        if (r.estudiante_id) conPractica.add(String(r.estudiante_id));
      });

      // "Con lugar" entre los postulados = seleccionado o ya con práctica.
      let conLugar = 0;
      postulados.forEach((sid) => {
        if (seleccionados.has(sid) || conPractica.has(sid)) conLugar += 1;
      });
      const sinLugar = postulados.size - conLugar;

      return {
        postulados: postulados.size,
        postulaciones,
        postulacionesPorAlumno: postulados.size
          ? Math.round((postulaciones / postulados.size) * 10) / 10
          : 0,
        conLugar,
        sinLugar,
        concrecionPct: postulados.size ? Math.round((conLugar / postulados.size) * 100) : null,
      };
    },
  });
};
