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
  TABLE_NAME_FINALIZACION,
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
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_FECHA_FINALIZACION_ESTUDIANTES,
} from "../constants";
import { getGroupName, normalizeStringForComparison, parseToUTCDate } from "../utils/formatters";
import { isUnlimitedCupoInstitution } from "../utils/unlimitedCupos";
import type { StudentInfo } from "../types";

// IDs de lanzamientos de PPS de cupo ilimitado (Fundación Tiempo, Ulloa). Sus
// convocatorias se excluyen de las métricas de presión (Dinámica del ciclo,
// flujos YTD): al aceptar a casi todos los postulantes, no son representativas
// de la competencia por lugar del resto de las convocatorias.
const fetchUnlimitedLaunchIds = async (): Promise<Set<string>> => {
  const ids = new Set<string>();
  try {
    const { data } = await supabase
      .from(TABLE_NAME_LANZAMIENTOS_PPS)
      .select(`id, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}`);
    (data || []).forEach((l: Record<string, unknown>) => {
      if (isUnlimitedCupoInstitution(l[FIELD_NOMBRE_PPS_LANZAMIENTOS])) ids.add(String(l.id));
    });
  } catch {
    /* sin acceso a lanzamientos → no se excluye nada */
  }
  return ids;
};

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
const range = (year: number) => ({
  start: `${year}-01-01T00:00:00Z`,
  end: `${year + 1}-01-01T00:00:00Z`,
});

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
const ESTADOS_OCUPA = ["seleccionado", "inscripto"];
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
// Todo en PERSONAS, acotado al año. NO usa "cupos ofrecidos" (dato sucio por
// cargas erróneas tipo Fundación Tiempo 4×250).
// Las convocatorias de cupo ilimitado (Fundación Tiempo, Ulloa) se excluyen de
// la demanda: no hay competencia por lugar, así la métrica refleja la presión
// real sobre el resto de las convocatorias. La SELECCIÓN en ellas sí cuenta
// como "con lugar" (el alumno efectivamente consiguió práctica).
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
      const empty: DinamicaCiclo = {
        postulados: 0,
        postulaciones: 0,
        postulacionesPorAlumno: 0,
        conLugar: 0,
        sinLugar: 0,
        concrecionPct: null,
      };

      const postulados = new Set<string>();
      const seleccionados = new Set<string>();
      let postulaciones = 0;
      try {
        const unlimitedIds = await fetchUnlimitedLaunchIds();
        const { data } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(
            `estudiante_id, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}, ${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}`
          )
          .gte("created_at", start)
          .lt("created_at", end);
        const rows = (data || []) as Array<Record<string, unknown>>;
        rows.forEach((r) => {
          const sid = r.estudiante_id ? String(r.estudiante_id) : "";
          if (!sid) return;
          const e = normalizeStringForComparison(
            String(r[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          // La selección cuenta siempre (el alumno ya tiene lugar), incluso en
          // PPS de cupo ilimitado.
          if (ESTADOS_SELECCIONADO.includes(e)) seleccionados.add(sid);
          // Pero esas convocatorias no cuentan como demanda: no compiten por
          // lugar y diluirían la presión real del ciclo.
          const lanzId = String(r[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] || "");
          if (lanzId && unlimitedIds.has(lanzId)) return;
          postulaciones += 1;
          postulados.add(sid);
        });
      } catch {
        return empty;
      }

      // Alumnos con práctica del año (también cuentan como "con lugar").
      const conPractica = new Set<string>();
      try {
        const { data } = await supabase
          .from("practicas")
          .select("estudiante_id, fecha_inicio")
          .gte("fecha_inicio", start.slice(0, 10))
          .lt("fecha_inicio", end.slice(0, 10));
        (data || []).forEach((r: Record<string, unknown>) => {
          if (r.estudiante_id) conPractica.add(String(r.estudiante_id));
        });
      } catch {
        /* sin prácticas → conLugar solo por selección */
      }

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

      // 1. Lanzamientos del año → cupos ofrecidos + orientación por institución.
      const { data: launchesRaw } = await supabase
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .select(
          `id, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ORIENTACION_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}`
        )
        .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10));
      const launches = (launchesRaw || []) as Array<Record<string, unknown>>;
      if (!launches.length) return [];

      const launchById = new Map<string, Record<string, unknown>>();
      const inst = new Map<
        string,
        {
          nombre: string;
          orient: Record<OrientKey, number>;
          ofrecidos: number;
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
          ofrecidos: 0,
          ocupados: 0,
          list: [],
        };
        entry.ofrecidos += Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
        const ok = ORIENT_FROM_STRING(l[FIELD_ORIENTACION_LANZAMIENTOS] as string);
        entry.orient[ok] += 1;
        inst.set(nombre, entry);
      });

      // 2. Convocatorias del año → ocupados + alumnos para el drill-down.
      // Filtramos por lanzamiento_id (no por created_at) porque los alumnos pueden
      // inscribirse en un año distinto al que arranca la PPS.
      try {
        const launchIds = Array.from(launchById.keys());
        const { data: convsRaw } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(
            `${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}, estudiantes!convocatorias_estudiante_id_fkey(${FIELD_NOMBRE_ESTUDIANTES}, ${FIELD_LEGAJO_ESTUDIANTES})`
          )
          .in(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, launchIds);
        const convs = (convsRaw || []) as Array<Record<string, unknown>>;
        convs.forEach((c) => {
          const estado = normalizeStringForComparison(
            String(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          if (!ESTADOS_OCUPA.includes(estado)) return;
          const rawLanz = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
          const lanzId = Array.isArray(rawLanz) ? rawLanz[0] : rawLanz;
          const launch = launchById.get(String(lanzId));
          if (!launch) return;
          const nombre = getGroupName(
            String(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre")
          );
          const entry = inst.get(nombre);
          if (!entry) return;
          entry.ocupados += 1;
          const est = Array.isArray(c.estudiantes) ? c.estudiantes[0] : c.estudiantes;
          if (est) {
            entry.list.push({
              nombre: (est as Record<string, string>)[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante",
              legajo: (est as Record<string, string>)[FIELD_LEGAJO_ESTUDIANTES] || "—",
              institucion: nombre,
            });
          }
        });
      } catch {
        /* sin convocatorias accesibles → ocupados = 0 */
      }

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
        .filter((e) => e.ofrecidos > 0)
        .map((e) => ({
          nombre: e.nombre,
          orient: dominantOrient(e.orient),
          ofrecidos: Math.max(e.ofrecidos, e.ocupados),
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
      try {
        const { data: fin } = await supabase
          .from(TABLE_NAME_FINALIZACION)
          .select(`estudiante_id, ${FIELD_FECHA_SOLICITUD_FINALIZACION}, created_at`);
        (fin || []).forEach((f: Record<string, unknown>) => {
          const d = parseToUTCDate(
            (f[FIELD_FECHA_SOLICITUD_FINALIZACION] as string) || (f.created_at as string)
          );
          const sid = String(f.estudiante_id || "");
          if (d && sid) bump(d.getUTCFullYear(), sid);
        });
      } catch {
        /* ignore */
      }
      try {
        const { data: est } = await supabase
          .from(TABLE_NAME_ESTUDIANTES)
          .select(`id, ${FIELD_FECHA_FINALIZACION_ESTUDIANTES}`)
          .not(FIELD_FECHA_FINALIZACION_ESTUDIANTES, "is", null);
        (est || []).forEach((s: Record<string, unknown>) => {
          const d = parseToUTCDate(s[FIELD_FECHA_FINALIZACION_ESTUDIANTES] as string);
          const sid = String(s.id || "");
          if (d && sid) bump(d.getUTCFullYear(), sid);
        });
      } catch {
        /* ignore */
      }
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
  postulaciones: number;
  seleccionados: number;
  /**
   * true cuando la convocatoria no tiene estado de selección ni prácticas
   * cargadas pero sí postulaciones y ya inició: `seleccionados` se estima
   * como min(cupos, postulaciones). El anexo lo marca con asterisco.
   */
  selEstimado: boolean;
  fechaInicio: Date | null;
  horas: number | null;
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
      const { start, end } = range(year);
      const { data: launchesRaw } = await supabase
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .select(
          `id, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ORIENTACION_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}, ${FIELD_FECHA_INICIO_LANZAMIENTOS}, ${FIELD_HORAS_ACREDITADAS_LANZAMIENTOS}`
        )
        .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10))
        .order(FIELD_FECHA_INICIO_LANZAMIENTOS, { ascending: true });
      const launches = (launchesRaw || []) as Array<Record<string, unknown>>;
      if (!launches.length) return [];

      // Demanda por lanzamiento. Filtramos por lanzamiento_id (no created_at):
      // los alumnos pueden inscribirse en un año distinto al de inicio de la PPS.
      const launchIds = launches.map((l) => String(l.id));
      const postByLaunch = new Map<string, number>();
      const selByLaunch = new Map<string, number>();
      try {
        const { data: convsRaw } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(
            `${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`
          )
          .in(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, launchIds);
        ((convsRaw || []) as Array<Record<string, unknown>>).forEach((c) => {
          const rawLanz = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
          const lanzId = String(Array.isArray(rawLanz) ? rawLanz[0] : rawLanz);
          if (!lanzId) return;
          postByLaunch.set(lanzId, (postByLaunch.get(lanzId) || 0) + 1);
          const e = normalizeStringForComparison(
            String(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          if (ESTADOS_SELECCIONADO.includes(e))
            selByLaunch.set(lanzId, (selByLaunch.get(lanzId) || 0) + 1);
        });
      } catch {
        /* sin convocatorias accesibles → demanda en 0 */
      }

      // Muchas selecciones no quedan asentadas en convocatorias: la fuente real
      // es la práctica creada. Contamos prácticas vinculadas al lanzamiento y
      // usamos el mayor de los dos conteos.
      const pracByLaunch = new Map<string, number>();
      try {
        const { data: pracRaw } = await supabase
          .from(TABLE_NAME_PRACTICAS)
          .select(FIELD_LANZAMIENTO_VINCULADO_PRACTICAS)
          .in(FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, launchIds);
        ((pracRaw || []) as Array<Record<string, unknown>>).forEach((p) => {
          const raw = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
          const lanzId = String(Array.isArray(raw) ? raw[0] : raw);
          if (!lanzId) return;
          pracByLaunch.set(lanzId, (pracByLaunch.get(lanzId) || 0) + 1);
        });
      } catch {
        /* sin prácticas accesibles → solo cuenta convocatorias */
      }

      const hoy = new Date();
      return launches.map((l) => {
        const id = String(l.id);
        const horas = Number(l[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]);
        const cupos = Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
        const postulaciones = postByLaunch.get(id) || 0;
        const fechaInicio = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string);
        const selReal = Math.max(selByLaunch.get(id) || 0, pracByLaunch.get(id) || 0);
        // Convocatoria ya iniciada, con postulantes, pero sin selección asentada
        // en el sistema → estimamos por cupos (nunca más que los postulantes).
        const selEstimado =
          selReal === 0 && postulaciones > 0 && fechaInicio !== null && fechaInicio < hoy;
        return {
          id,
          nombre: String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre").trim(),
          orient: ORIENT_FROM_STRING(l[FIELD_ORIENTACION_LANZAMIENTOS] as string),
          cupos,
          postulaciones,
          seleccionados: selEstimado ? Math.min(cupos, postulaciones) : selReal,
          selEstimado,
          fechaInicio,
          horas: Number.isFinite(horas) && horas > 0 ? horas : null,
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
  postulaciones: number;
  postulados: number;
  finalizados: number;
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
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["ytdFlows", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<YtdFlows> => {
      const startISO = `${year}-01-01T00:00:00Z`;
      const cutoff = ytdCutoff(year);
      const endISO = cutoff.toISOString();
      const start = new Date(startISO);

      // Postulaciones y alumnos distintos que se postularon (convocatorias del
      // año creadas hasta el corte). Mismo criterio que useMetricsDinamica:
      // las convocatorias de cupo ilimitado no cuentan como demanda.
      let postulaciones = 0;
      const postulados = new Set<string>();
      try {
        const unlimitedIds = await fetchUnlimitedLaunchIds();
        const { data } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(`estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}`)
          .gte("created_at", startISO)
          .lt("created_at", endISO);
        const rows = (data || []) as Array<Record<string, unknown>>;
        rows.forEach((r) => {
          const lanzId = String(r[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] || "");
          if (lanzId && unlimitedIds.has(lanzId)) return;
          postulaciones += 1;
          if (r.estudiante_id) postulados.add(String(r.estudiante_id));
        });
      } catch {
        /* tabla/permiso ausente → 0 */
      }

      // Finalizados hasta el corte (solicitud de finalización + fecha_finalizacion
      // del estudiante). Mismo criterio que useFinalizadosSeries, acotado al día.
      const finalizados = new Set<string>();
      try {
        const { data } = await supabase
          .from(TABLE_NAME_FINALIZACION)
          .select(`estudiante_id, ${FIELD_FECHA_SOLICITUD_FINALIZACION}, created_at`);
        (data || []).forEach((f: Record<string, unknown>) => {
          const d = parseToUTCDate(
            (f[FIELD_FECHA_SOLICITUD_FINALIZACION] as string) || (f.created_at as string)
          );
          const sid = String(f.estudiante_id || "");
          if (d && sid && d >= start && d < cutoff) finalizados.add(sid);
        });
      } catch {
        /* ignore */
      }
      try {
        const { data } = await supabase
          .from(TABLE_NAME_ESTUDIANTES)
          .select(`id, ${FIELD_FECHA_FINALIZACION_ESTUDIANTES}`)
          .not(FIELD_FECHA_FINALIZACION_ESTUDIANTES, "is", null);
        (data || []).forEach((s: Record<string, unknown>) => {
          const d = parseToUTCDate(s[FIELD_FECHA_FINALIZACION_ESTUDIANTES] as string);
          const sid = String(s.id || "");
          if (d && sid && d >= start && d < cutoff) finalizados.add(sid);
        });
      } catch {
        /* ignore */
      }

      return {
        year,
        cutoffISO: endISO,
        postulaciones,
        postulados: postulados.size,
        finalizados: finalizados.size,
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
        // Misma fuente que el KPI/modal del dashboard, para que el conteo cierre.
        const { data: listRaw } = await supabase.rpc("get_sin_pps_list", { p_year: year });
        const list = (listRaw || []) as Array<{ nombre?: string; legajo?: string }>;
        if (!list.length) return [];

        const legajos = list.map((s) => String(s.legajo || "")).filter(Boolean);
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

        return ests
          .map((e) => {
            const agg = aggById.get(String(e.id))!;
            return {
              nombre: String(e[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante"),
              legajo: String(e[FIELD_LEGAJO_ESTUDIANTES] || "—"),
              postulacionesYear: agg.year,
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
  /** PPS excepcional de cupo (casi) ilimitado: mostrar "Ilimitado", no sumar. */
  cupoIlimitado?: boolean;
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
      const { data: launchRaw } = await supabase
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .select(
          `${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ORIENTACION_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}`
        )
        .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10));
      ((launchRaw || []) as Array<Record<string, unknown>>).forEach((l) => {
        const nombre = getGroupName(String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || ""));
        const acc = byInst.get(nombre);
        if (!acc) return;
        acc.pps += 1;
        // Las PPS de cupo ilimitado no suman cupos: se muestran "Ilimitado".
        if (!isUnlimitedCupoInstitution(nombre)) {
          acc.cupos += Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
        }
        acc.orientLaunch.add(ORIENT_FROM_STRING(l[FIELD_ORIENTACION_LANZAMIENTOS] as string));
      });

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
            cupoIlimitado: isUnlimitedCupoInstitution(institucion),
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

      // — Finalizaciones agrupadas por mes → "N acreditaciones" —
      try {
        const { data } = await supabase
          .from(TABLE_NAME_FINALIZACION)
          .select(`${FIELD_FECHA_SOLICITUD_FINALIZACION}, created_at`)
          .gte("created_at", start)
          .lt("created_at", end);
        const byMonth = new Map<number, { n: number; first: Date }>();
        (data || []).forEach((f: Record<string, unknown>) => {
          const d = parseToUTCDate(
            (f[FIELD_FECHA_SOLICITUD_FINALIZACION] as string) || (f.created_at as string)
          );
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
            detalle: "Solicitudes de finalización del mes.",
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
