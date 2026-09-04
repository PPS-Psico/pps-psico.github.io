import { useQuery } from "@tanstack/react-query";
import {
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_MODALIDAD_CUPO_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PRACTICAS,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { fetchHistoricalLaunchOffers } from "../../services/historicalLaunchAnalytics";
import { normalizeStringForComparison, parseToUTCDate } from "../../utils/formatters";
import { range, ORIENT_FROM_STRING, ESTADOS_SELECCIONADO } from "./shared";
import type { OrientKey } from "./types";

// ════════════════════════════════════════════════════════════════════════════
// DETALLE DE PPS LANZADAS (anexo del Reporte ejecutivo)
// Todas las convocatorias del año, una fila por lanzamiento: orientación,
// cupos ofrecidos, fecha de inicio, horas acreditadas y demanda (postulaciones
// totales y seleccionados por convocatoria, leídos de `convocatorias`).
// ════════════════════════════════════════════════════════════════════════════
export interface ReportLaunch {
  id: string;
  nombre: string;
  orient: OrientKey;
  cupos: number;
  modalidadCupo: "fijo" | "realizado" | "desconocido";
  capacidadOperativa: number;
  postulaciones: number;
  seleccionados: number;
  fechaInicio: Date | null;
  horas: number | null;
  source: "operational_launch" | "historical_documented_offer";
  dateBasis: "launch_start_date" | "announcement_at";
  demandAvailable: boolean;
}

export const useReportLaunches = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsReportLaunches", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<ReportLaunch[]> => {
      const historical = await fetchHistoricalLaunchOffers(year);
      if (historical.available) {
        return historical.rows.map((row) => {
          const announcement = new Date(row.announcementAt);
          const numericHours = Number.parseFloat(row.creditedHoursText.replace(",", "."));
          return {
            id: row.offerId,
            nombre: row.canonicalName,
            orient: ORIENT_FROM_STRING(row.orientation),
            cupos: row.offeredCapacity || 0,
            modalidadCupo: row.capacityMode,
            capacidadOperativa: row.offeredCapacity || 0,
            postulaciones: 0,
            seleccionados: 0,
            fechaInicio: Number.isNaN(announcement.getTime()) ? null : announcement,
            horas: Number.isFinite(numericHours) && numericHours > 0 ? numericHours : null,
            source: "historical_documented_offer",
            dateBasis: "announcement_at",
            demandAvailable: false,
          };
        });
      }

      const { start, end } = range(year);
      const { data: launchesRaw, error: launchesError } = await supabase
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .select(
          `id, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ORIENTACION_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}, ${FIELD_MODALIDAD_CUPO_LANZAMIENTOS}, ${FIELD_FECHA_INICIO_LANZAMIENTOS}, ${FIELD_HORAS_ACREDITADAS_LANZAMIENTOS}`
        )
        .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
        .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10))
        .order(FIELD_FECHA_INICIO_LANZAMIENTOS, { ascending: true });
      if (launchesError) throw launchesError;
      const launches = (launchesRaw || []) as Array<Record<string, unknown>>;
      if (!launches.length) return [];

      // Demanda por lanzamiento. Filtramos por lanzamiento_id (no created_at):
      // los alumnos pueden inscribirse en un año distinto al de inicio de la PPS.
      const launchIds = launches.map((l) => String(l.id));
      const postByLaunch = new Map<string, number>();
      const studentsByLaunch = new Map<string, Set<string>>();
      const convs: Array<Record<string, unknown>> = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: convsRaw, error: convsError } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(
            `id, estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`
          )
          .in(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, launchIds)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (convsError) throw convsError;
        const page = (convsRaw || []) as Array<Record<string, unknown>>;
        convs.push(...page);
        if (page.length < pageSize) break;
      }
      convs.forEach((c) => {
        const rawLanz = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
        const lanzId = String(Array.isArray(rawLanz) ? rawLanz[0] : rawLanz);
        if (!lanzId) return;
        postByLaunch.set(lanzId, (postByLaunch.get(lanzId) || 0) + 1);
        const e = normalizeStringForComparison(
          String(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
        );
        const sid = String(c.estudiante_id || "");
        if (ESTADOS_SELECCIONADO.includes(e) && sid) {
          const selected = studentsByLaunch.get(lanzId) || new Set<string>();
          selected.add(sid);
          studentsByLaunch.set(lanzId, selected);
        }
      });

      // Muchas selecciones no quedan asentadas en convocatorias: la fuente real
      // es la práctica creada. Contamos prácticas vinculadas al lanzamiento y
      // usamos el mayor de los dos conteos.
      const { data: pracRaw, error: pracError } = await supabase
        .from(TABLE_NAME_PRACTICAS)
        .select(`estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_PRACTICAS}`)
        .eq(FIELD_TIPO_ACTIVIDAD_PRACTICAS, "pps")
        .in(FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, launchIds);
      if (pracError) throw pracError;
      ((pracRaw || []) as Array<Record<string, unknown>>).forEach((p) => {
        const raw = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
        const lanzId = String(Array.isArray(raw) ? raw[0] : raw);
        const sid = String(p.estudiante_id || "");
        if (!lanzId || !sid) return;
        const selected = studentsByLaunch.get(lanzId) || new Set<string>();
        selected.add(sid);
        studentsByLaunch.set(lanzId, selected);
      });

      return launches.map((l) => {
        const id = String(l.id);
        const horas = Number(l[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]);
        const cupos = Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
        const modalidadCupo =
          l[FIELD_MODALIDAD_CUPO_LANZAMIENTOS] === "realizado" ? "realizado" : "fijo";
        const postulaciones = postByLaunch.get(id) || 0;
        const fechaInicio = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string);
        const seleccionados = studentsByLaunch.get(id)?.size || 0;
        return {
          id,
          nombre: String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre").trim(),
          orient: ORIENT_FROM_STRING(l[FIELD_ORIENTACION_LANZAMIENTOS] as string),
          cupos,
          modalidadCupo,
          capacidadOperativa: modalidadCupo === "realizado" ? seleccionados : cupos,
          postulaciones,
          seleccionados,
          fechaInicio,
          horas: Number.isFinite(horas) && horas > 0 ? horas : null,
          source: "operational_launch",
          dateBasis: "launch_start_date",
          demandAvailable: true,
        };
      });
    },
  });
};
