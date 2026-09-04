import { useQuery } from "@tanstack/react-query";
import {
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { normalizeStringForComparison, parseToUTCDate } from "../../utils/formatters";
import { range, ESTADOS_SELECCIONADO, percentil } from "./shared";

// ════════════════════════════════════════════════════════════════════════════
// ESFUERZO HASTA LA PRIMERA SELECCIÓN (Informe profesional)
// Ordena todas las postulaciones de cada estudiante y observa en qué número de
// intento aparece su primera selección. A diferencia de `useTiempoSeleccion`,
// no mide demora administrativa: describe el recorrido real de acceso a PPS.
// La cohorte anual se asigna por la fecha de inicio del lanzamiento para
// mantener la misma base temporal que el resto del informe.
// ════════════════════════════════════════════════════════════════════════════
export interface EsfuerzoPrimeraSeleccion {
  disponible: boolean;
  cohorteN: number;
  primerIntentoN: number;
  primerIntentoPct: number | null;
  medianaPostulaciones: number | null;
  p25Postulaciones: number | null;
  p75Postulaciones: number | null;
}

export const useEsfuerzoPrimeraSeleccion = ({
  year,
  cutoffISO,
  isTestingMode = false,
}: {
  year: number;
  cutoffISO: string;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["esfuerzoPrimeraSeleccion", year, cutoffISO, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<EsfuerzoPrimeraSeleccion> => {
      const empty: EsfuerzoPrimeraSeleccion = {
        disponible: year >= 2025,
        cohorteN: 0,
        primerIntentoN: 0,
        primerIntentoPct: null,
        medianaPostulaciones: null,
        p25Postulaciones: null,
        p75Postulaciones: null,
      };

      // La demanda migrada de 2024 no conserva la secuencia completa de
      // postulaciones. Publicar este indicador allí produciría una falsa serie.
      if (year < 2025) return empty;

      const fetchAllApplications = async (): Promise<Array<Record<string, unknown>>> => {
        const pageSize = 1000;
        const rows: Array<Record<string, unknown>> = [];
        let from = 0;

        // PostgREST limita la cantidad de filas de cada respuesta. La secuencia
        // completa es indispensable: cortar en la primera página sesga el número
        // de intento y puede dejar fuera a toda la cohorte más reciente.
        while (true) {
          const { data, error } = await supabase
            .from(TABLE_NAME_CONVOCATORIAS)
            .select(
              `id, created_at, estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`
            )
            .not("estudiante_id", "is", null)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);
          if (error) throw error;

          const page = (data || []) as Array<Record<string, unknown>>;
          rows.push(...page);
          if (page.length < pageSize) break;
          from += pageSize;
        }

        return rows;
      };

      const [{ data: launchRows, error: launchError }, applicationRows] = await Promise.all([
        supabase
          .from(TABLE_NAME_LANZAMIENTOS_PPS)
          .select(`id, ${FIELD_FECHA_INICIO_LANZAMIENTOS}`)
          .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps"),
        fetchAllApplications(),
      ]);
      if (launchError) throw launchError;

      const launchDates = new Map<string, Date>();
      ((launchRows || []) as Array<Record<string, unknown>>).forEach((row) => {
        const date = parseToUTCDate(String(row[FIELD_FECHA_INICIO_LANZAMIENTOS] || ""));
        if (date) launchDates.set(String(row.id), date);
      });

      const byStudent = new Map<string, Array<Record<string, unknown>>>();
      applicationRows.forEach((row) => {
        const studentId = String(row.estudiante_id || "");
        if (!studentId) return;
        const applications = byStudent.get(studentId) || [];
        applications.push(row);
        byStudent.set(studentId, applications);
      });

      const cutoff = new Date(`${cutoffISO}T23:59:59.999Z`);
      const attempts: number[] = [];
      byStudent.forEach((applications) => {
        applications.sort((a, b) => {
          const timeA = new Date(String(a.created_at || "")).getTime();
          const timeB = new Date(String(b.created_at || "")).getTime();
          return timeA - timeB || String(a.id).localeCompare(String(b.id));
        });

        const firstSelectedIndex = applications.findIndex((application) => {
          const state = normalizeStringForComparison(
            String(application[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          const launchId = String(application[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] || "");
          return ESTADOS_SELECCIONADO.includes(state) && launchDates.has(launchId);
        });
        if (firstSelectedIndex < 0) return;

        const firstSelected = applications[firstSelectedIndex];
        const launchDate = launchDates.get(
          String(firstSelected[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] || "")
        );
        if (
          !launchDate ||
          launchDate.getUTCFullYear() !== year ||
          launchDate.getTime() > cutoff.getTime()
        ) {
          return;
        }
        attempts.push(firstSelectedIndex + 1);
      });

      attempts.sort((a, b) => a - b);
      const firstAttemptN = attempts.filter((attempt) => attempt === 1).length;
      return {
        disponible: true,
        cohorteN: attempts.length,
        primerIntentoN: firstAttemptN,
        primerIntentoPct: attempts.length
          ? Math.round((firstAttemptN / attempts.length) * 1000) / 10
          : null,
        medianaPostulaciones: percentil(attempts, 0.5),
        p25Postulaciones: percentil(attempts, 0.25),
        p75Postulaciones: percentil(attempts, 0.75),
      };
    },
  });
};
