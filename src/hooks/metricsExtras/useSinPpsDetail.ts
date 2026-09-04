import { useQuery } from "@tanstack/react-query";
import {
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_CONVOCATORIAS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_ESTUDIANTES,
} from "../../constants";
import { fetchDirectorReportSnapshot } from "../../features/executive-report/directorReport.service";
import { reportCutoff } from "../../features/executive-report/executiveReport.service";
import { supabase } from "../../lib/supabaseClient";
import { normalizeStringForComparison, parseToUTCDate } from "../../utils/formatters";
import { ESTADOS_SELECCIONADO } from "./shared";

// ════════════════════════════════════════════════════════════════════════════
// FOCO · ESTUDIANTES SIN NINGUNA PPS (análisis del Reporte ejecutivo)
// Para cada alumno del snapshot sin_pps (mismo RPC que usa el dashboard):
// a cuántas convocatorias se anotó (en el año y en total) y a cuáles, más si
// ya quedó seleccionado en alguna (práctica por iniciar).
// ════════════════════════════════════════════════════════════════════════════
export interface SinPpsDetail {
  nombre: string;
  legajo: string;
  postulacionesYear: number;
  postulacionesTotal: number;
  seleccionado: boolean;
  convocatorias: string[];
}

export const useSinPpsDetail = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["sinPpsDetail", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<SinPpsDetail[]> => {
      try {
        const currentYear = new Date().getFullYear();
        const snapshot = await fetchDirectorReportSnapshot(year, reportCutoff(currentYear, false));
        const list = snapshot.withoutPpsStudents;
        if (!list.length) return [];

        const legajos = list.map((student) => String(student.legajo || "")).filter(Boolean);
        const { data: estRaw } = await supabase
          .from(TABLE_NAME_ESTUDIANTES)
          .select(`id, ${FIELD_LEGAJO_ESTUDIANTES}, ${FIELD_NOMBRE_ESTUDIANTES}`)
          .in(FIELD_LEGAJO_ESTUDIANTES, legajos);
        const ests = (estRaw || []) as Array<Record<string, unknown>>;
        if (!ests.length) return [];

        interface Agg {
          year: number;
          total: number;
          seleccionado: boolean;
          names: Map<string, string>; // nombre PPS → fecha más reciente (para ordenar)
        }
        const aggById = new Map<string, Agg>();
        ests.forEach((e) =>
          aggById.set(String(e.id), {
            year: 0,
            total: 0,
            seleccionado: false,
            names: new Map(),
          })
        );

        const { data: convsRaw } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(
            `estudiante_id, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}, ${FIELD_NOMBRE_PPS_CONVOCATORIAS}, created_at`
          )
          .in(
            "estudiante_id",
            ests.map((e) => String(e.id))
          );
        ((convsRaw || []) as Array<Record<string, unknown>>).forEach((c) => {
          const agg = aggById.get(String(c.estudiante_id || ""));
          if (!agg) return;
          agg.total += 1;
          const d = parseToUTCDate(c.created_at as string);
          if (d && d.getUTCFullYear() === year) agg.year += 1;
          const estado = normalizeStringForComparison(
            String(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          if (ESTADOS_SELECCIONADO.includes(estado)) agg.seleccionado = true;
          const nombre = String(c[FIELD_NOMBRE_PPS_CONVOCATORIAS] || "").trim();
          if (nombre) {
            const prev = agg.names.get(nombre);
            const iso = d ? d.toISOString() : "";
            if (!prev || iso > prev) agg.names.set(nombre, iso);
          }
        });

        const annualApplications = new Map(list.map((student) => [student.studentId, student]));

        return ests
          .map((e) => {
            const agg = aggById.get(String(e.id))!;
            const canonical = annualApplications.get(String(e.id));
            return {
              nombre: String(e[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante"),
              legajo: String(e[FIELD_LEGAJO_ESTUDIANTES] || "—"),
              postulacionesYear: canonical?.applicationCount ?? agg.year,
              postulacionesTotal: agg.total,
              seleccionado: agg.seleccionado,
              convocatorias: Array.from(agg.names.entries())
                .sort((a, b) => b[1].localeCompare(a[1]))
                .map(([n]) => n),
            };
          })
          .sort(
            (a, b) =>
              a.postulacionesYear - b.postulacionesYear ||
              a.postulacionesTotal - b.postulacionesTotal ||
              a.nombre.localeCompare(b.nombre, "es")
          );
      } catch {
        return [];
      }
    },
  });
};
