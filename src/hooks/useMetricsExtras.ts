// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · datos "extra" del rediseño Paper & Ink
//
// El RPC `get_admin_metrics_kpis` ya cubre las KPIs duras (matrícula,
// seguimiento, instituciones, distribución por orientación, evolución y
// tendencia). El rediseño suma cuatro lecturas nuevas que NO están en ese RPC
// y que acá resolvemos leyendo Supabase directamente (mismo patrón que
// `metricsLists.ts`), para que la vista sea de datos reales y no un cableado:
//
//   · Embudo del ciclo        → pipeline real de `convocatorias` + KPIs
//   · Top instituciones       → `lanzamientos_pps` (ofrecidos) + `convocatorias` (ocupados)
//   · Serie de finalizados    → `finalizacion_pps` + `estudiantes.fecha_finalizacion`
//   · Actividad de Hermes     → conteo de `whatsapp_mensajes` + `gmail_hilos`
//   · Línea de tiempo         → hitos derivados de lanzamientos / finalizaciones / convenios
//
// Todo degrada con elegancia: si una tabla no existe o RLS la bloquea, el hook
// devuelve vacío/0 en vez de romper la página. Hermes permanece en shadow mode:
// acá solo se LEE actividad agregada, nunca se la interpreta.
// ──────────────────────────────────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import {
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_INSTITUCIONES,
  TABLE_NAME_ESTUDIANTES,
  TABLE_NAME_PRACTICAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_NOMBRE_PPS_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_ORIENTACIONES_INSTITUCIONES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_FECHA_FINALIZACION_ESTUDIANTES,
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_SELECTED_AT_CONVOCATORIAS,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  FIELD_MODALIDAD_CUPO_LANZAMIENTOS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
} from "../constants";
import { getGroupName, normalizeStringForComparison, parseToUTCDate } from "../utils/formatters";
import type { StudentInfo } from "../types";
import { fetchHistoricalLaunchOffers } from "../services/historicalLaunchAnalytics";
import { reportCutoff } from "../features/executive-report/executiveReport.service";
import { fetchDirectorReportSnapshot } from "../features/executive-report/directorReport.service";
import { isPracticeStatusComputable } from "../logic/studentRules";

// ── Tipos ──────────────────────────────────────────────────────────────────
export type Tone = "accent" | "warn" | "ok" | "ai" | "ink";
export type OrientKey = "clinica" | "educacional" | "laboral" | "comunitaria" | "sindefinir";

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  note: string;
  tone: Tone;
  /**
   * Cómo nombrar a los que no llegaron a esta etapa desde la anterior.
   * Por defecto "quedaron en el camino" (implica que el proceso no avanzó). Para
   * etapas donde los que faltan en realidad SIGUEN en curso (ej. Finalizados en
   * un año abierto), se usa "siguen en curso" para no implicar abandono.
   */
  dropLabel?: string;
}

export interface TopInstitucion {
  nombre: string;
  orient: OrientKey;
  ofrecidos: number;
  ocupados: number;
  list: StudentInfo[];
}

export interface HeroSeries {
  matriculaGenerada: { year: number; value: number }[];
  finalizados: { year: number; value: number }[];
  matriculaActiva: { year: number; value: number }[];
  years: number[];
}

export interface TimelineEvent {
  fecha: string;
  orden: number;
  tipo: "lanzamiento" | "inscripcion" | "seleccion" | "inicio" | "cierre" | "convenio";
  titulo: string;
  detalle: string;
  tone: Tone;
  /** Listado completo de ítems del hito (p. ej. todas las PPS lanzadas en el mes). */
  items?: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const range = (year: number) => {
  const currentYear = new Date().getFullYear();
  const cutoff = reportCutoff(year, year < currentYear);
  const endDate = new Date(`${cutoff}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return {
    start: `${year}-01-01T00:00:00Z`,
    end: `${endDate.toISOString().slice(0, 10)}T00:00:00Z`,
  };
};

const ORIENT_FROM_STRING = (raw: string | null | undefined): OrientKey => {
  const n = normalizeStringForComparison(raw || "");
  if (n.includes("clinica")) return "clinica";
  if (n.includes("educacional") || n.includes("educacion")) return "educacional";
  if (n.includes("laboral") || n.includes("trabajo")) return "laboral";
  if (n.includes("comunitaria") || n.includes("comunidad")) return "comunitaria";
  return "sindefinir";
};

// Estados de inscripción que cuentan como "ocupando" un cupo.
// estado_inscripcion canónico (CHECK constraint normalize_states):
// Inscripto · Seleccionado · No Seleccionado.
const ESTADOS_SELECCIONADO = ["seleccionado"];

// ════════════════════════════════════════════════════════════════════════════
// ESTUDIANTES HEREDADOS — con cuántos alumnos se arrancó el ciclo
// Alumnos de cohortes anteriores (2024+) que no habían finalizado al iniciar el
// año. Solo cohortes >= 2024 (los datos previos de Airtable no son confiables).
// ════════════════════════════════════════════════════════════════════════════
export const useMetricsHeredados = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsHeredados", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<number> => {
      try {
        const { data, error } = await supabase.rpc("get_heredados_count", { p_year: year });
        if (error) throw error;
        return Number(data) || 0;
      } catch {
        return 0;
      }
    },
  });
};

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
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsDinamica", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
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

// ════════════════════════════════════════════════════════════════════════════
// EMBUDO DEL CICLO (legacy — reemplazado por useMetricsDinamica)
// Se conserva el tipo FunnelStage por compatibilidad, pero la vista ya no lo usa.
// ════════════════════════════════════════════════════════════════════════════
export const useMetricsFunnel = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsFunnel", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<FunnelStage[]> => {
      const { start, end } = range(year);
      // Embudo en PERSONAS (alumnos distintos), acotado al año y ACUMULATIVO:
      // cada etapa cuenta "cuántos llegaron al menos hasta acá".
      //   se postularon → seleccionados → hicieron PPS → finalizados
      // Contar postulaciones mezclaba unidades (un alumno se postula a varias);
      // en personas el embudo cuenta una historia real y decrece de forma sana.
      const postulados = new Set<string>();
      const seleccionadosConv = new Set<string>();
      try {
        const { data } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(`estudiante_id, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`)
          .gte("created_at", start)
          .lt("created_at", end);
        const rows = (data || []) as Array<Record<string, unknown>>;
        rows.forEach((r) => {
          const sid = r.estudiante_id ? String(r.estudiante_id) : "";
          if (!sid) return;
          postulados.add(sid);
          const e = normalizeStringForComparison(
            String(r[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          if (ESTADOS_SELECCIONADO.includes(e)) seleccionadosConv.add(sid);
        });
      } catch {
        /* tabla/permiso ausente → embudo parcial */
      }

      // Prácticas del año: quién llegó a hacerla (en curso o finalizada) y quién
      // finalizó. El estado es un snapshot, por eso "hicieron" = tiene práctica.
      const hicieron = new Set<string>();
      const finalizados = new Set<string>();
      try {
        const { data } = await supabase
          .from("practicas")
          .select("estudiante_id, estado, fecha_inicio")
          .gte("fecha_inicio", start.slice(0, 10))
          .lt("fecha_inicio", end.slice(0, 10));
        const rows = (data || []) as Array<Record<string, unknown>>;
        rows.forEach((r) => {
          const sid = r.estudiante_id ? String(r.estudiante_id) : "";
          if (!sid) return;
          hicieron.add(sid);
          const estado = normalizeStringForComparison(String(r.estado || ""));
          if (estado === "finalizada") finalizados.add(sid);
        });
      } catch {
        /* sin prácticas accesibles → etapas finales en 0 */
      }

      // "Seleccionados" = quedó seleccionado en convocatoria O ya tiene práctica
      // del año (no todos pasan por el estado 'Seleccionado'). La unión mantiene
      // el embudo monótono decreciente.
      const seleccionados = new Set<string>([...seleccionadosConv, ...hicieron]);

      const stages: FunnelStage[] = [
        {
          key: "postulados",
          label: "Se postularon",
          value: postulados.size,
          note: "Alumnos que se inscribieron a alguna PPS",
          tone: "accent",
        },
        {
          key: "seleccionados",
          label: "Seleccionados",
          value: seleccionados.size,
          note: "Quedaron asignados a un cupo",
          tone: "ai",
        },
        {
          key: "activas",
          label: "Hicieron PPS",
          value: hicieron.size,
          note: "Iniciaron la práctica este año",
          tone: "ok",
        },
        {
          key: "finalizadas",
          label: "Finalizados",
          value: finalizados.size,
          note: "Ya acreditaron en el ciclo",
          tone: "ok",
        },
      ];
      return stages;
    },
  });
};

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
    placeholderData: (prev) => prev,
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

      const dominantOrient = (o: Record<OrientKey, number>): OrientKey => {
        let best: OrientKey = "sindefinir";
        let max = -1;
        (Object.keys(o) as OrientKey[]).forEach((k) => {
          if (k !== "sindefinir" && o[k] > max) {
            max = o[k];
            best = k;
          }
        });
        return max <= 0 ? "sindefinir" : best;
      };

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

// ════════════════════════════════════════════════════════════════════════════
// ACTIVIDAD DE HERMES (fuente, no voz): conversaciones analizadas en el año.
// WhatsApp (mensajes) + Gmail (hilos). Solo lectura agregada.
// ════════════════════════════════════════════════════════════════════════════
export const useHermesActivity = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["hermesActivity", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ total: number; whatsapp: number; gmail: number }> => {
      const { start, end } = range(year);
      let whatsapp = 0;
      let gmail = 0;
      try {
        const { count } = await supabase
          .from("whatsapp_mensajes")
          .select("id", { count: "exact", head: true })
          .gte("timestamp", start)
          .lt("timestamp", end);
        whatsapp = count || 0;
      } catch {
        /* tabla ausente */
      }
      try {
        const { count } = await supabase
          .from("gmail_hilos")
          .select("thread_id", { count: "exact", head: true })
          .gte("ultimo_mensaje_at", start)
          .lt("ultimo_mensaje_at", end);
        gmail = count || 0;
      } catch {
        /* tabla ausente */
      }
      return { total: whatsapp + gmail, whatsapp, gmail };
    },
  });
};

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
    placeholderData: (prev) => prev,
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

// ════════════════════════════════════════════════════════════════════════════
// FLUJOS ACUMULADOS AL MISMO DÍA DEL AÑO (comparativo YTD)
// Cuenta actividad del año acotada al mismo día del calendario que hoy, para
// comparar dos ciclos "hasta el mismo momento" y no un año completo contra otro
// en curso. Sólo métricas de flujo (se acumulan): postulaciones, alumnos
// postulados y finalizados. Las de stock (matrícula activa, etc.) no se pueden
// recortar sin snapshots históricos, así que quedan fuera del modo YTD.
// ════════════════════════════════════════════════════════════════════════════
export interface YtdFlows {
  year: number;
  cutoffISO: string;
  metricVersion: string;
  postulaciones: number;
  postulados: number;
  /** false cuando la migración histórica no conserva demanda completa. */
  demandaDisponible: boolean;
  finalizados: number;
  /** Estudiantes distintos con práctica iniciada hasta el corte. */
  enPps: number;
  capacity: {
    fixedOffered: number;
    realized: number;
    operational: number;
    launches: number;
    fixedOverCapacityLaunches: number;
    fixedOverCapacityAvailable: boolean;
    source: string;
    dateBasis: string;
    capacityComplete: boolean;
    comparable: boolean;
    finiteOfferCoveragePct: number | null;
    documentedFiniteOffers: number | null;
    unknownOrRealizedOffers: number;
  };
  quality: {
    selectedAtN: number;
    selectedTotalN: number;
    selectedAtCoveragePct: number | null;
    practiceLaunchLinkCoveragePct: number | null;
    launchInstitutionLinkCoveragePct: number | null;
  };
}

// Límite superior exclusivo: inicio del día siguiente al mismo día/mes de hoy,
// en el año pedido, acotado al fin de ese año. Se calcula en UTC para alinear
// con las fechas de la base (parseToUTCDate devuelve medianoche UTC).
export const ytdCutoff = (year: number, now = new Date()): Date => {
  const cut = new Date(Date.UTC(year, now.getMonth(), now.getDate() + 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  return cut < yearEnd ? cut : yearEnd;
};

export const useYtdFlows = ({
  year,
  isTestingMode = false,
  fullYear = false,
}: {
  year: number;
  isTestingMode?: boolean;
  /** Usa el cierre anual; por defecto corta al mismo día/mes para comparar YTD. */
  fullYear?: boolean;
}) => {
  return useQuery({
    queryKey: ["ytdFlows", year, fullYear, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<YtdFlows> => {
      const exclusiveCutoff = fullYear ? new Date(Date.UTC(year + 1, 0, 1)) : ytdCutoff(year);
      const cutoffDate = new Date(exclusiveCutoff.getTime() - 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("get_analytics_v2", {
        p_year: year,
        p_cutoff: cutoffDate,
      });
      if (error) throw error;
      const payload = (data || {}) as Record<string, unknown>;
      const flows = (payload.flows || {}) as Record<string, unknown>;
      const capacity = (payload.capacity || {}) as Record<string, unknown>;
      const quality = (payload.quality || {}) as Record<string, unknown>;
      const nullableNumber = (value: unknown): number | null => {
        if (value == null) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      return {
        year,
        cutoffISO: cutoffDate,
        metricVersion: String(payload.metric_version || "analytics-v2"),
        postulaciones: Number(flows.applications) || 0,
        postulados: Number(flows.applicants) || 0,
        demandaDisponible: flows.demand_available === true,
        finalizados: Number(flows.finalized) || 0,
        enPps: Number(flows.pps_started) || 0,
        capacity: {
          fixedOffered: Number(capacity.fixed_offered) || 0,
          realized: Number(capacity.realized) || 0,
          operational: Number(capacity.operational) || 0,
          launches: Number(capacity.launches) || 0,
          fixedOverCapacityLaunches: Number(capacity.fixed_over_capacity_launches) || 0,
          fixedOverCapacityAvailable: capacity.fixed_over_capacity_available !== false,
          source: String(capacity.source || "operational_launches"),
          dateBasis: String(capacity.date_basis || "launch_start_date"),
          capacityComplete: capacity.capacity_complete !== false,
          comparable: capacity.comparable !== false,
          finiteOfferCoveragePct: nullableNumber(capacity.finite_offer_coverage_pct),
          documentedFiniteOffers: nullableNumber(capacity.documented_finite_offers),
          unknownOrRealizedOffers: Number(capacity.unknown_or_realized_offers) || 0,
        },
        quality: {
          selectedAtN: Number(quality.selected_at_n) || 0,
          selectedTotalN: Number(quality.selected_total_n) || 0,
          selectedAtCoveragePct: nullableNumber(quality.selected_at_coverage_pct),
          practiceLaunchLinkCoveragePct: nullableNumber(quality.practice_launch_link_coverage_pct),
          launchInstitutionLinkCoveragePct: nullableNumber(
            quality.launch_institution_link_coverage_pct
          ),
        },
      };
    },
  });
};

// ════════════════════════════════════════════════════════════════════════════
// TRAYECTORIA DE FINALIZACIÓN (Reporte ejecutivo)
// Para los estudiantes que finalizaron efectivamente en el año: cuánto tardaron
// desde el inicio de su primera práctica hasta la fecha de finalización, cuántos
// registros de práctica tienen y cuántas horas se cargaron. La cifra principal es la
// MEDIANA (robusta frente a casos extremos, el estándar en métricas de tiempo
// a egreso), acompañada del promedio y el rango intercuartílico.
// ════════════════════════════════════════════════════════════════════════════
export interface TrayectoriaFinalizados {
  /** Total de estudiantes con finalización efectiva registrada en el año. */
  totalFinalizados: number;
  /** Finalizados del año con trayectoria calculable (práctica + fechas sanas). */
  n: number;
  /** Registros excluidos del tiempo por fecha negativa o mayor a seis años. */
  duracionesInvalidas: number;
  medianaMeses: number | null;
  promedioMeses: number | null;
  p25Meses: number | null;
  p75Meses: number | null;
  promedioRegistrosPractica: number | null;
  /** Promedio de horas cargadas, sobre finalizados con horas positivas. */
  promedioHorasCargadas: number | null;
  dist: { label: string; n: number }[];
}

const MESES_POR_DIA = 1 / 30.44; // mes promedio del calendario

const percentil = (sorted: number[], p: number): number | null => {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const v = sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  return Math.round(v * 10) / 10;
};

export const useTrayectoriaFinalizados = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["trayectoriaFinalizados", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<TrayectoriaFinalizados> => {
      const empty: TrayectoriaFinalizados = {
        totalFinalizados: 0,
        n: 0,
        duracionesInvalidas: 0,
        medianaMeses: null,
        promedioMeses: null,
        p25Meses: null,
        p75Meses: null,
        promedioRegistrosPractica: null,
        promedioHorasCargadas: null,
        dist: [],
      };
      const { start, end } = range(year);
      const startD = new Date(start);
      const endD = new Date(end);

      // 1. Fecha de finalización efectiva por estudiante en el año.
      const finBy = new Map<string, Date>();
      const addFin = (sid: string, d: Date | null) => {
        if (!sid || !d || d < startD || d >= endD) return;
        const prevD = finBy.get(sid);
        if (!prevD || d < prevD) finBy.set(sid, d);
      };
      const { data: finalizadosData, error: finalizadosError } = await supabase
        .from(TABLE_NAME_ESTUDIANTES)
        .select(`id, ${FIELD_FECHA_FINALIZACION_ESTUDIANTES}, ${FIELD_ESTADO_ESTUDIANTES}`)
        .eq(FIELD_ESTADO_ESTUDIANTES, "Finalizado")
        .not(FIELD_FECHA_FINALIZACION_ESTUDIANTES, "is", null);
      if (finalizadosError) throw finalizadosError;
      (finalizadosData || []).forEach((s: Record<string, unknown>) => {
        addFin(
          String(s.id || ""),
          parseToUTCDate(s[FIELD_FECHA_FINALIZACION_ESTUDIANTES] as string)
        );
      });
      const ids = Array.from(finBy.keys());
      if (!ids.length) return empty;

      // 2. Prácticas de esos estudiantes: primera fecha de inicio, cantidad de
      //    registros y horas cargadas. Un registro no implica una rotación.
      interface Tray {
        first: Date | null;
        registros: number;
        horas: number;
      }
      const traj = new Map<string, Tray>();
      const { data: practicaData, error: practicaError } = await supabase
        .from(TABLE_NAME_PRACTICAS)
        .select(
          `estudiante_id, ${FIELD_FECHA_INICIO_PRACTICAS}, ${FIELD_HORAS_PRACTICAS}, ${FIELD_ESTADO_PRACTICA}`
        )
        .eq(FIELD_TIPO_ACTIVIDAD_PRACTICAS, "pps")
        .in("estudiante_id", ids);
      if (practicaError) throw practicaError;
      (practicaData || []).forEach((p: Record<string, unknown>) => {
        const sid = String(p.estudiante_id || "");
        if (!sid) return;
        const t = traj.get(sid) || { first: null, registros: 0, horas: 0 };
        t.registros += 1;
        const h = Number(p[FIELD_HORAS_PRACTICAS]);
        if (
          isPracticeStatusComputable(p[FIELD_ESTADO_PRACTICA] as string | null) &&
          Number.isFinite(h) &&
          h > 0
        ) {
          t.horas += h;
        }
        const d = parseToUTCDate(p[FIELD_FECHA_INICIO_PRACTICAS] as string);
        if (d && (!t.first || d < t.first)) t.first = d;
        traj.set(sid, t);
      });

      // 3. Duración en meses por estudiante. Se descartan trayectorias sin
      //    práctica registrada o con fechas incoherentes (datos pre-migración).
      const meses: number[] = [];
      let registrosSum = 0;
      let registrosN = 0;
      let horasSum = 0;
      let horasN = 0;
      let duracionesInvalidas = 0;
      finBy.forEach((fin, sid) => {
        const t = traj.get(sid);
        if (!t) return;
        if (t.registros > 0) {
          registrosSum += t.registros;
          registrosN += 1;
        }
        if (t.horas > 0) {
          horasSum += t.horas;
          horasN += 1;
        }
        if (!t.first) return;
        const m = ((fin.getTime() - t.first.getTime()) / 86400000) * MESES_POR_DIA;
        if (m >= 0 && m <= 72) {
          meses.push(Math.round(m * 10) / 10);
        } else {
          duracionesInvalidas += 1;
        }
      });
      if (!meses.length && !registrosN) {
        return { ...empty, totalFinalizados: finBy.size, duracionesInvalidas };
      }
      meses.sort((a, b) => a - b);

      return {
        totalFinalizados: finBy.size,
        n: meses.length,
        duracionesInvalidas,
        medianaMeses: percentil(meses, 0.5),
        promedioMeses: meses.length
          ? Math.round((meses.reduce((a, b) => a + b, 0) / meses.length) * 10) / 10
          : null,
        p25Meses: percentil(meses, 0.25),
        p75Meses: percentil(meses, 0.75),
        promedioRegistrosPractica: registrosN
          ? Math.round((registrosSum / registrosN) * 10) / 10
          : null,
        promedioHorasCargadas: horasN ? Math.round(horasSum / horasN) : null,
        dist: [
          { label: "Menos de 1 año", n: meses.filter((m) => m < 12).length },
          { label: "1 a 1½ años", n: meses.filter((m) => m >= 12 && m < 18).length },
          { label: "1½ a 2 años", n: meses.filter((m) => m >= 18 && m < 24).length },
          { label: "Más de 2 años", n: meses.filter((m) => m >= 24).length },
        ],
      };
    },
  });
};

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

// ════════════════════════════════════════════════════════════════════════════
// CONVENIOS NUEVOS · ficha por institución (Reporte ejecutivo/comparativo)
// Instituciones con convenio firmado en el año (`convenio_nuevo` = año), con la
// oferta que trajeron: orientación, PPS lanzadas y cupos ofrecidos. Dato clave
// para las gestiones: qué instituciones nuevas suman y con cuánta capacidad.
// ════════════════════════════════════════════════════════════════════════════
export interface NewAgreement {
  institucion: string;
  orientaciones: OrientKey[];
  pps: number;
  cupos: number;
}

export const useNewAgreements = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["newAgreements", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<NewAgreement[]> => {
      // 1. Instituciones con convenio nuevo del año. Agrupamos por nombre de
      //    grupo (getGroupName) para coincidir con la identidad usada en las
      //    métricas de lanzamientos.
      const { data: instRaw } = await supabase
        .from(TABLE_NAME_INSTITUCIONES)
        .select(`${FIELD_NOMBRE_INSTITUCIONES}, ${FIELD_ORIENTACIONES_INSTITUCIONES}`)
        // convenio_nuevo es smallint (año): comparamos con el número.
        .eq(FIELD_CONVENIO_NUEVO_INSTITUCIONES, year);
      const insts = (instRaw || []) as Array<Record<string, unknown>>;
      if (!insts.length) return [];

      interface Acc {
        orientDeclared: Set<OrientKey>;
        orientLaunch: Set<OrientKey>;
        pps: number;
        cupos: number;
      }
      const byInst = new Map<string, Acc>();
      insts.forEach((i) => {
        const nombre = getGroupName(String(i[FIELD_NOMBRE_INSTITUCIONES] || ""));
        if (!nombre) return;
        const acc = byInst.get(nombre) || {
          orientDeclared: new Set<OrientKey>(),
          orientLaunch: new Set<OrientKey>(),
          pps: 0,
          cupos: 0,
        };
        // orientaciones declaradas en la institución (texto libre, puede traer varias).
        String(i[FIELD_ORIENTACIONES_INSTITUCIONES] || "")
          .split(/[,;/]/)
          .forEach((o) => {
            const t = o.trim();
            if (t) acc.orientDeclared.add(ORIENT_FROM_STRING(t));
          });
        byInst.set(nombre, acc);
      });
      if (byInst.size === 0) return [];

      // 2. Lanzamientos del año → cupos + orientación real por institución.
      const { start, end } = range(year);
      const { data: launchRaw, error: launchError } = await supabase
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .select(
          `id, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ORIENTACION_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}, ${FIELD_MODALIDAD_CUPO_LANZAMIENTOS}`
        )
        .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
        .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10));
      if (launchError) throw launchError;
      const launches = (launchRaw || []) as Array<Record<string, unknown>>;
      const realizedLaunchToInstitution = new Map<string, string>();
      launches.forEach((l) => {
        const nombre = getGroupName(String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || ""));
        const acc = byInst.get(nombre);
        if (!acc) return;
        acc.pps += 1;
        if (l[FIELD_MODALIDAD_CUPO_LANZAMIENTOS] === "realizado") {
          realizedLaunchToInstitution.set(String(l.id), nombre);
        } else {
          acc.cupos += Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
        }
        acc.orientLaunch.add(ORIENT_FROM_STRING(l[FIELD_ORIENTACION_LANZAMIENTOS] as string));
      });

      if (realizedLaunchToInstitution.size) {
        const realizedIds = Array.from(realizedLaunchToInstitution.keys());
        const selectedByLaunch = new Map<string, Set<string>>();
        const addSelected = (launchId: string, studentId: string) => {
          if (!launchId || !studentId) return;
          const selected = selectedByLaunch.get(launchId) || new Set<string>();
          selected.add(studentId);
          selectedByLaunch.set(launchId, selected);
        };
        const { data: convData, error: convError } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(
            `estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`
          )
          .in(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, realizedIds);
        if (convError) throw convError;
        ((convData || []) as Array<Record<string, unknown>>).forEach((c) => {
          const estado = normalizeStringForComparison(
            String(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          if (!ESTADOS_SELECCIONADO.includes(estado)) return;
          addSelected(
            String(c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] || ""),
            String(c.estudiante_id || "")
          );
        });
        const { data: practicaData, error: practicaError } = await supabase
          .from(TABLE_NAME_PRACTICAS)
          .select(`estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_PRACTICAS}`)
          .eq(FIELD_TIPO_ACTIVIDAD_PRACTICAS, "pps")
          .in(FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, realizedIds);
        if (practicaError) throw practicaError;
        ((practicaData || []) as Array<Record<string, unknown>>).forEach((p) => {
          addSelected(
            String(p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] || ""),
            String(p.estudiante_id || "")
          );
        });
        realizedLaunchToInstitution.forEach((institucion, launchId) => {
          const acc = byInst.get(institucion);
          if (acc) acc.cupos += selectedByLaunch.get(launchId)?.size || 0;
        });
      }

      return Array.from(byInst.entries())
        .map(([institucion, acc]) => {
          // Preferimos la orientación real de los lanzamientos; si la institución
          // aún no lanzó nada, usamos la declarada en su ficha.
          const set = acc.orientLaunch.size ? acc.orientLaunch : acc.orientDeclared;
          let orientaciones: OrientKey[] = Array.from(set).filter((o) => o !== "sindefinir");
          if (orientaciones.length === 0 && set.has("sindefinir")) orientaciones = ["sindefinir"];
          return {
            institucion,
            orientaciones,
            pps: acc.pps,
            cupos: acc.cupos,
          };
        })
        .sort((a, b) => b.cupos - a.cupos || a.institucion.localeCompare(b.institucion, "es"));
    },
  });
};

// ════════════════════════════════════════════════════════════════════════════
// LÍNEA DE TIEMPO · hitos del ciclo derivados de datos reales
// ════════════════════════════════════════════════════════════════════════════
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")} ${MESES[d.getUTCMonth()]}`;

export const useMetricsTimeline = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsTimeline", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<TimelineEvent[]> => {
      const { start, end } = range(year);
      const events: TimelineEvent[] = [];

      // — Lanzamientos agrupados por mes → "N PPS lanzadas" —
      try {
        const { data } = await supabase
          .from(TABLE_NAME_LANZAMIENTOS_PPS)
          .select(`${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_FECHA_INICIO_LANZAMIENTOS}`)
          .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
          .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
          .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10));
        const byMonth = new Map<number, { nombres: Set<string>; first: Date }>();
        (data || []).forEach((l: Record<string, unknown>) => {
          const d = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string);
          if (!d) return;
          const m = d.getUTCMonth();
          const nombre = getGroupName(String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || ""));
          const e = byMonth.get(m) || { nombres: new Set<string>(), first: d };
          if (nombre) e.nombres.add(nombre);
          if (d < e.first) e.first = d;
          byMonth.set(m, e);
        });
        byMonth.forEach((e, m) => {
          const items = Array.from(e.nombres).sort((a, b) => a.localeCompare(b, "es"));
          events.push({
            fecha: fechaCorta(e.first),
            orden: m * 100 + 1,
            tipo: "lanzamiento",
            titulo: `${items.length} ${items.length === 1 ? "PPS lanzada" : "PPS lanzadas"}`,
            detalle: items.length
              ? "Convocatorias publicadas en el mes."
              : "Convocatorias publicadas.",
            tone: "accent",
            items,
          });
        });
      } catch {
        /* ignore */
      }

      // — Finalizaciones efectivas agrupadas por mes → "N acreditaciones" —
      try {
        const { data } = await supabase
          .from(TABLE_NAME_ESTUDIANTES)
          .select(`id, ${FIELD_FECHA_FINALIZACION_ESTUDIANTES}`)
          .eq(FIELD_ESTADO_ESTUDIANTES, "Finalizado")
          .gte(FIELD_FECHA_FINALIZACION_ESTUDIANTES, start.slice(0, 10))
          .lt(FIELD_FECHA_FINALIZACION_ESTUDIANTES, end.slice(0, 10));
        const byMonth = new Map<number, { n: number; first: Date }>();
        (data || []).forEach((student: Record<string, unknown>) => {
          const d = parseToUTCDate(student[FIELD_FECHA_FINALIZACION_ESTUDIANTES] as string);
          if (!d || d.getUTCFullYear() !== year) return;
          const m = d.getUTCMonth();
          const e = byMonth.get(m) || { n: 0, first: d };
          e.n += 1;
          if (d < e.first) e.first = d;
          byMonth.set(m, e);
        });
        byMonth.forEach((e, m) => {
          events.push({
            fecha: fechaCorta(e.first),
            orden: m * 100 + 5,
            tipo: "cierre",
            titulo: `${e.n} ${e.n === 1 ? "acreditación" : "acreditaciones"}`,
            detalle: "Finalizaciones efectivas registradas en el mes.",
            tone: "ok",
          });
        });
      } catch {
        /* ignore */
      }

      // — Convenios nuevos del año —
      try {
        const { data } = await supabase
          .from(TABLE_NAME_INSTITUCIONES)
          .select(FIELD_NOMBRE_INSTITUCIONES)
          // convenio_nuevo es smallint (año): comparamos con el número.
          .eq(FIELD_CONVENIO_NUEVO_INSTITUCIONES, year);
        const nombres = Array.from(
          new Set(
            (data || []).map((i: Record<string, unknown>) =>
              getGroupName(String(i[FIELD_NOMBRE_INSTITUCIONES] || ""))
            )
          )
        ).filter(Boolean);
        if (nombres.length) {
          events.push({
            fecha: `${year}`,
            orden: 9999,
            tipo: "convenio",
            titulo: `${nombres.length} ${nombres.length === 1 ? "convenio nuevo" : "convenios nuevos"}`,
            detalle: nombres.slice(0, 4).join(", "),
            tone: "ok",
          });
        }
      } catch {
        /* ignore */
      }

      return events.sort((a, b) => a.orden - b.orden);
    },
  });
};
