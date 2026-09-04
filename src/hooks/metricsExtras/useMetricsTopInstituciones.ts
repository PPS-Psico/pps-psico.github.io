import { useQuery } from "@tanstack/react-query";
import {
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_MODALIDAD_CUPO_LANZAMIENTOS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { fetchHistoricalLaunchOffers } from "../../services/historicalLaunchAnalytics";
import { getGroupName, normalizeStringForComparison } from "../../utils/formatters";
import type { StudentInfo } from "../../types";
import { range, ORIENT_FROM_STRING, dominantOrient, ESTADOS_SELECCIONADO } from "./shared";
import type { OrientKey, TopInstitucion } from "./types";

// ════════════════════════════════════════════════════════════════════════════
// TOP INSTITUCIONES POR CUPOS (ocupación real)
// ════════════════════════════════════════════════════════════════════════════
export const useMetricsTopInstituciones = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsTopInst", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<TopInstitucion[]> => {
      const { start, end } = range(year);

      const historical = await fetchHistoricalLaunchOffers(year);
      if (historical.available) {
        const institutions = new Map<
          string,
          { nombre: string; orient: Record<OrientKey, number>; ofrecidos: number }
        >();
        historical.rows.forEach((offer) => {
          const nombre = getGroupName(offer.canonicalName);
          const entry = institutions.get(nombre) || {
            nombre,
            orient: { clinica: 0, educacional: 0, laboral: 0, comunitaria: 0, sindefinir: 0 },
            ofrecidos: 0,
          };
          entry.orient[ORIENT_FROM_STRING(offer.orientation)] += 1;
          entry.ofrecidos += offer.offeredCapacity || 0;
          institutions.set(nombre, entry);
        });
        return Array.from(institutions.values())
          .map((entry) => ({
            nombre: entry.nombre,
            orient: dominantOrient(entry.orient),
            ofrecidos: entry.ofrecidos,
            ocupados: 0,
            list: [],
          }))
          .sort((a, b) => b.ofrecidos - a.ofrecidos || a.nombre.localeCompare(b.nombre));
      }

      // 1. Lanzamientos del año → cupos ofrecidos + orientación por institución.
      const { data: launchesRaw, error: launchesError } = await supabase
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .select(
          `id, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ORIENTACION_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}, ${FIELD_MODALIDAD_CUPO_LANZAMIENTOS}`
        )
        .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
        .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10));
      if (launchesError) throw launchesError;
      const launches = (launchesRaw || []) as Array<Record<string, unknown>>;
      if (!launches.length) return [];

      const launchById = new Map<string, Record<string, unknown>>();
      const inst = new Map<
        string,
        {
          nombre: string;
          orient: Record<OrientKey, number>;
          ofrecidosFijos: number;
          realizados: number;
          ocupados: number;
          list: StudentInfo[];
        }
      >();

      launches.forEach((l) => {
        launchById.set(String(l.id), l);
        const nombre = getGroupName(String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre"));
        const entry = inst.get(nombre) || {
          nombre,
          orient: { clinica: 0, educacional: 0, laboral: 0, comunitaria: 0, sindefinir: 0 },
          ofrecidosFijos: 0,
          realizados: 0,
          ocupados: 0,
          list: [],
        };
        if (l[FIELD_MODALIDAD_CUPO_LANZAMIENTOS] !== "realizado") {
          entry.ofrecidosFijos += Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
        }
        const ok = ORIENT_FROM_STRING(l[FIELD_ORIENTACION_LANZAMIENTOS] as string);
        entry.orient[ok] += 1;
        inst.set(nombre, entry);
      });

      // 2. Convocatorias del año → ocupados + alumnos para el drill-down.
      // Filtramos por lanzamiento_id (no por created_at) porque los alumnos pueden
      // inscribirse en un año distinto al que arranca la PPS.
      const launchIds = Array.from(launchById.keys());
      const selectedByLaunch = new Map<string, Set<string>>();
      const convs: Array<Record<string, unknown>> = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: convsRaw, error: convsError } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(
            `id, estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}, estudiantes!convocatorias_estudiante_id_fkey(${FIELD_NOMBRE_ESTUDIANTES}, ${FIELD_LEGAJO_ESTUDIANTES})`
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
        const estado = normalizeStringForComparison(
          String(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
        );
        if (!ESTADOS_SELECCIONADO.includes(estado)) return;
        const rawLanz = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
        const lanzId = Array.isArray(rawLanz) ? rawLanz[0] : rawLanz;
        const launch = launchById.get(String(lanzId));
        if (!launch) return;
        const nombre = getGroupName(String(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre"));
        const entry = inst.get(nombre);
        if (!entry) return;
        entry.ocupados += 1;
        const sid = String(c.estudiante_id || "");
        if (sid) {
          const selected = selectedByLaunch.get(String(lanzId)) || new Set<string>();
          selected.add(sid);
          selectedByLaunch.set(String(lanzId), selected);
        }
        const est = Array.isArray(c.estudiantes) ? c.estudiantes[0] : c.estudiantes;
        if (est) {
          entry.list.push({
            nombre: (est as Record<string, string>)[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante",
            legajo: (est as Record<string, string>)[FIELD_LEGAJO_ESTUDIANTES] || "—",
            institucion: nombre,
          });
        }
      });

      launchById.forEach((launch, launchId) => {
        if (launch[FIELD_MODALIDAD_CUPO_LANZAMIENTOS] !== "realizado") return;
        const nombre = getGroupName(String(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre"));
        const entry = inst.get(nombre);
        if (entry) entry.realizados += selectedByLaunch.get(launchId)?.size || 0;
      });

      return Array.from(inst.values())
        .map((e) => ({
          nombre: e.nombre,
          orient: dominantOrient(e.orient),
          ofrecidos: e.ofrecidosFijos + e.realizados,
          ocupados: e.ocupados,
          list: e.list,
        }))
        .sort((a, b) => b.ocupados - a.ocupados || b.ofrecidos - a.ofrecidos);
    },
  });
};
