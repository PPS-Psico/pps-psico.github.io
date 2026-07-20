import { supabase } from "../lib/supabaseClient";
import type { StudentInfo } from "../types";
import {
  TABLE_NAME_PRACTICAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_INSTITUCIONES,
  TABLE_NAME_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_MODALIDAD_CUPO_LANZAMIENTOS,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
} from "../constants";
import { getGroupName } from "../utils/formatters";
import {
  fetchHistoricalLaunchOffers,
  type HistoricalLaunchOffer,
} from "./historicalLaunchAnalytics";
import { fetchInterviewCompletionCandidates } from "./interviewCompletionCandidates";

export interface ListResult {
  students: StudentInfo[];
  headers?: { key: string; label: string }[];
  description?: string;
}

/** Fila genérica devuelta por las RPC `get_*_list` del dashboard. */
interface RpcListRow {
  nombre: string;
  legajo: string;
  correo?: string;
  horas_total?: number;
}

const metricCycleRange = (year: number) => {
  const start = `${year}-01-01`;
  if (year !== new Date().getFullYear()) return { start, end: `${year + 1}-01-01` };

  const today = new Date();
  const end = new Date(Date.UTC(year, today.getMonth(), today.getDate() + 1))
    .toISOString()
    .slice(0, 10);
  return { start, end };
};

type CapacityRow = {
  id: string;
  nombre: string;
  modalidad: "fijo" | "realizado";
  capacidad: number;
};

const fetchOperationalCapacityRows = async (year: number): Promise<CapacityRow[]> => {
  const { start, end } = metricCycleRange(year);
  const { data: launches, error: launchesError } = await supabase
    .from(TABLE_NAME_LANZAMIENTOS_PPS)
    .select(
      `id, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}, ${FIELD_MODALIDAD_CUPO_LANZAMIENTOS}`
    )
    .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
    .gte("fecha_inicio", start)
    .lt("fecha_inicio", end);
  if (launchesError) throw launchesError;

  const rows = (launches || []) as Array<Record<string, unknown>>;
  const launchIds = rows.map((row) => String(row.id));
  const selected = new Map<string, Set<string>>();
  if (launchIds.length) {
    const [convResult, practicesResult] = await Promise.all([
      supabase
        .from(TABLE_NAME_CONVOCATORIAS)
        .select(
          `${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, ${FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS}`
        )
        .in(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, launchIds)
        .eq(FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS, "Seleccionado"),
      supabase
        .from(TABLE_NAME_PRACTICAS)
        .select(`${FIELD_LANZAMIENTO_VINCULADO_PRACTICAS}, ${FIELD_ESTUDIANTE_LINK_PRACTICAS}`)
        .in(FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, launchIds)
        .eq(FIELD_TIPO_ACTIVIDAD_PRACTICAS, "pps"),
    ]);
    if (convResult.error) throw convResult.error;
    if (practicesResult.error) throw practicesResult.error;

    [...(convResult.data || []), ...(practicesResult.data || [])].forEach(
      (entry: Record<string, unknown>) => {
        const launchId = String(
          entry[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] ||
            entry[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] ||
            ""
        );
        const studentId = String(
          entry[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] ||
            entry[FIELD_ESTUDIANTE_LINK_PRACTICAS] ||
            ""
        );
        if (!launchId || !studentId) return;
        const ids = selected.get(launchId) || new Set<string>();
        ids.add(studentId);
        selected.set(launchId, ids);
      }
    );
  }

  return rows.map((row) => {
    const modalidad = row[FIELD_MODALIDAD_CUPO_LANZAMIENTOS] === "realizado" ? "realizado" : "fijo";
    return {
      id: String(row.id),
      nombre: String(row[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre"),
      modalidad,
      capacidad:
        modalidad === "realizado"
          ? selected.get(String(row.id))?.size || 0
          : Number(row[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]) || 0,
    };
  });
};

/**
 * Clasifica una orientación de texto libre en las categorías canónicas usadas
 * por el dashboard. Réplica del CASE/regex de get_admin_metrics_kpis
 * (orientation_distribution) para que las listas de los modales coincidan
 * exactamente con los conteos de los gráficos.
 */
function classifyOrientation(value: string | null | undefined): string {
  const v = (value || "").toLowerCase();
  if (/cl[ií]nica/.test(v)) return "Clínica";
  if (/educacional|educaci[oó]n/.test(v)) return "Educacional";
  if (/laboral|trabajo/.test(v)) return "Laboral";
  if (/comunitaria|comunidad/.test(v)) return "Comunitaria";
  return "Sin definir";
}

const fetchStartedStudentsByOrientation = async (year: number) => {
  const { start, end } = metricCycleRange(year);
  const { data: practices, error: practicesError } = await supabase
    .from(TABLE_NAME_PRACTICAS)
    .select(
      `${FIELD_ESTUDIANTE_LINK_PRACTICAS}, ${FIELD_LANZAMIENTO_VINCULADO_PRACTICAS}, ${FIELD_ESPECIALIDAD_PRACTICAS}, estudiantes!practicas_estudiante_id_fkey(${FIELD_NOMBRE_ESTUDIANTES}, ${FIELD_LEGAJO_ESTUDIANTES})`
    )
    .eq(FIELD_TIPO_ACTIVIDAD_PRACTICAS, "pps")
    .gte(FIELD_FECHA_INICIO_PRACTICAS, start)
    .lt(FIELD_FECHA_INICIO_PRACTICAS, end);
  if (practicesError) throw practicesError;

  const practiceRows = (practices || []) as Array<Record<string, unknown>>;
  const launchIds = Array.from(
    new Set(
      practiceRows
        .map((row) => String(row[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] || ""))
        .filter(Boolean)
    )
  );
  const orientationByLaunch = new Map<string, string>();
  if (launchIds.length) {
    const { data: launches, error: launchesError } = await supabase
      .from(TABLE_NAME_LANZAMIENTOS_PPS)
      .select(`id, ${FIELD_ORIENTACION_LANZAMIENTOS}`)
      .in("id", launchIds);
    if (launchesError) throw launchesError;
    (launches || []).forEach((launch: Record<string, unknown>) => {
      orientationByLaunch.set(
        String(launch.id),
        String(launch[FIELD_ORIENTACION_LANZAMIENTOS] || "")
      );
    });
  }

  const byOrientation = new Map<string, Map<string, StudentInfo>>();
  practiceRows.forEach((practice) => {
    const studentId = String(practice[FIELD_ESTUDIANTE_LINK_PRACTICAS] || "");
    if (!studentId) return;
    const launchId = String(practice[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] || "");
    const orientation = classifyOrientation(
      orientationByLaunch.get(launchId) || String(practice[FIELD_ESPECIALIDAD_PRACTICAS] || "")
    );
    const student = Array.isArray(practice.estudiantes)
      ? practice.estudiantes[0]
      : practice.estudiantes;
    const rawStudent = (student || {}) as Record<string, unknown>;
    const students = byOrientation.get(orientation) || new Map<string, StudentInfo>();
    students.set(studentId, {
      nombre: String(rawStudent[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante"),
      legajo: String(rawStudent[FIELD_LEGAJO_ESTUDIANTES] || "—"),
    });
    byOrientation.set(orientation, students);
  });

  return byOrientation;
};

export const fetchStartedOrientationDistribution = async (
  year: number
): Promise<Record<string, number>> => {
  const rows = await fetchStartedStudentsByOrientation(year);
  return Object.fromEntries(
    Array.from(rows, ([orientation, students]) => [orientation, students.size])
  );
};

export async function fetchMetricList(key: string, year: number): Promise<ListResult> {
  switch (key) {
    case "matricula_generada":
    case "nuevosIngresantes":
      return fetchIngresantesList(year);
    case "estudiantes_en_pps":
      return fetchEstudiantesEnPpsList(year);
    case "heredados":
      return fetchHeredadosList(year);
    case "alumnos_finalizados":
      return fetchFinalizadosList(year);
    case "matricula_activa":
      return fetchActivosList(year);
    case "sin_pps":
      return fetchSinPpsList(year);
    case "proximos_finalizar":
      return fetchProximosFinalizarList(year);
    case "interview_completion_candidates":
      return fetchInterviewCompletionCandidatesList();
    case "haciendo_pps":
      return fetchHaciendoPpsList(year);
    case "pps_lanzadas":
      return fetchPpsLanzadasList(year);
    case "instituciones_activas":
      return fetchInstitucionesActivasList(year);
    case "cupos_ofrecidos":
      return fetchCuposList(year);
    case "nuevos_convenios":
      return fetchConveniosList(year);
    case "renovaciones":
      return fetchRenovacionesList(year);
    case "convenios_por_vencer":
      return fetchConveniosPorVencerList();
    case "orientation":
      return { students: [], description: "" };
    default:
      return { students: [] };
  }
}

async function fetchIngresantesList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_ingresantes_list", { p_year: year });
  const list = (data || []) as unknown as RpcListRow[];

  return {
    students: list.map((s) => ({
      nombre: s.nombre,
      legajo: s.legajo,
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
    ],
    description: `Estudiantes cuya cohorte (año de ingreso al sistema de PPS) es ${year}.`,
  };
}

async function fetchEstudiantesEnPpsList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_estudiantes_en_pps_list", { p_year: year });
  const list = (data || []) as unknown as RpcListRow[];

  return {
    students: list.map((s) => ({
      nombre: s.nombre,
      legajo: s.legajo,
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
    ],
    description: `Estudiantes con al menos una práctica PPS iniciada en ${year}.`,
  };
}

async function fetchHeredadosList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_heredados_list", { p_year: year });
  const list = (data || []) as unknown as RpcListRow[];

  return {
    students: list.map((s) => ({
      nombre: s.nombre,
      legajo: s.legajo,
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
    ],
    description: `Venían de 2024-2025 sin finalizar al iniciar ${year}.`,
  };
}

async function fetchFinalizadosList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_finalizados_list", { p_year: year });
  const list = (data || []) as unknown as RpcListRow[];

  return {
    students: list.map((s) => ({
      nombre: s.nombre,
      legajo: s.legajo,
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
    ],
    description: `Completaron PPS en ${year}.`,
  };
}

async function fetchActivosList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_activos_list", { p_year: year });
  const list = (data || []) as unknown as RpcListRow[];
  return {
    students: list.map((s) => ({
      nombre: s.nombre,
      legajo: s.legajo,
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
    ],
    description: `Matricula activa en ${year}.`,
  };
}

async function fetchSinPpsList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_sin_pps_list", { p_year: year });
  const list = (data || []) as unknown as RpcListRow[];

  return {
    students: list.map((s) => ({
      nombre: s.nombre,
      legajo: s.legajo,
      correo: s.correo,
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
      { key: "correo", label: "Email" },
    ],
    description: `Inscriptos a PPS al ${year} sin practicas registradas.`,
  };
}

async function fetchProximosFinalizarList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_proximos_finalizar_list", { p_year: year });
  const list = (data || []) as unknown as RpcListRow[];

  return {
    students: list.map((s) => ({
      nombre: s.nombre,
      legajo: s.legajo,
      correo: s.horas_total ? `${s.horas_total}hs` : "",
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
      { key: "correo", label: "Horas" },
    ],
    description: "Alumnos con 230+ horas sin solicitud de acreditacion en tramite.",
  };
}

async function fetchInterviewCompletionCandidatesList(): Promise<ListResult> {
  const candidates = await fetchInterviewCompletionCandidates();

  return {
    students: candidates.map((candidate) => ({
      nombre: candidate.fullName,
      legajo: candidate.legajo,
      horas: `${candidate.totalHours} h`,
      detalle: [
        candidate.reasonLabel,
        `${candidate.specialtyHours} h de especialidad`,
        `${candidate.rotations} ${candidate.rotations === 1 ? "orientación" : "orientaciones"}`,
        candidate.selectedOrientation
          ? `especialidad elegida: ${candidate.selectedOrientation}`
          : "especialidad sin definir",
        candidate.activePractices > 0
          ? `${candidate.activePractices} ${candidate.activePractices === 1 ? "práctica activa" : "prácticas activas"}`
          : "sin práctica activa",
      ].join(" · "),
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
      { key: "horas", label: "Horas" },
      { key: "detalle", label: "Motivo" },
    ],
    description:
      "Cohorte actual elegible para una PPS de Entrevista a Profesionales. Excluye estudiantes que ya tienen Relevamiento del Ejercicio Profesional o Entrevista a Profesionales.",
  };
}

async function fetchHaciendoPpsList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_haciendo_pps_list", { p_year: year });
  const list = (data || []) as unknown as RpcListRow[];

  return {
    students: list.map((s) => ({
      nombre: s.nombre,
      legajo: s.legajo,
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
    ],
    description: "Alumnos con practicas en curso.",
  };
}

async function fetchPpsLanzadasList(year: number): Promise<ListResult> {
  const historical = await fetchHistoricalLaunchOffers(year);
  if (historical.available) {
    return {
      students: historical.rows.map(toHistoricalOfferStudent),
      headers: [
        { key: "nombre", label: "Oferta PPS" },
        { key: "legajo", label: "Orientacion" },
        { key: "cupos", label: "Vacantes documentadas" },
      ],
      description:
        "Una fila por oferta publicada reconstruida desde la fuente documental; los relanzamientos no se cuentan dos veces.",
    };
  }

  const rows = await fetchOperationalCapacityRows(year);

  return {
    students: rows.map((row) => ({
      nombre: row.nombre,
      legajo: String(row.capacidad),
      institucion: row.nombre,
    })),
    headers: [
      { key: "nombre", label: "PPS" },
      { key: "legajo", label: "Cupos" },
    ],
  };
}

async function fetchInstitucionesActivasList(year: number): Promise<ListResult> {
  const historical = await fetchHistoricalLaunchOffers(year);
  if (historical.available) {
    const names = new Set(historical.rows.map((offer) => getGroupName(offer.canonicalName)));
    return {
      students: Array.from(names)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ nombre: name, legajo: "Documentada" })),
      description: "Instituciones reconstruidas desde las ofertas documentadas del ciclo.",
    };
  }

  const { start, end } = metricCycleRange(year);
  const { data, error } = await supabase
    .from(TABLE_NAME_LANZAMIENTOS_PPS)
    .select(FIELD_NOMBRE_PPS_LANZAMIENTOS)
    .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
    .gte("fecha_inicio", start)
    .lt("fecha_inicio", end);
  if (error) throw error;

  const names = new Set<string>();
  (data || []).forEach((l: Record<string, unknown>) => {
    const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | undefined;
    if (name) names.add(getGroupName(name));
  });

  return {
    students: Array.from(names).map((n) => ({ nombre: n, legajo: "Activa" })),
  };
}

async function fetchCuposList(year: number): Promise<ListResult> {
  const historical = await fetchHistoricalLaunchOffers(year);
  if (historical.available) {
    return {
      students: historical.rows.map(toHistoricalOfferStudent),
      headers: [
        { key: "nombre", label: "Oferta PPS" },
        { key: "legajo", label: "Orientacion" },
        { key: "cupos", label: "Vacantes documentadas" },
      ],
      description:
        "Capacidad documentada minima: suma solo vacantes finitas. Las ofertas abiertas, por participacion o sin cupo informado quedan identificadas sin estimarlas.",
    };
  }

  const rows = await fetchOperationalCapacityRows(year);

  return {
    students: rows.map((row) => ({
      nombre: row.nombre,
      legajo: String(row.capacidad),
    })),
    headers: [
      { key: "nombre", label: "PPS" },
      { key: "legajo", label: "Capacidad operativa" },
    ],
    description: "Cupos fijos más participación efectivamente realizada.",
  };
}

const toHistoricalOfferStudent = (row: HistoricalLaunchOffer): StudentInfo => ({
  nombre: row.canonicalName,
  legajo: row.orientation,
  cupos:
    row.offeredCapacity ??
    (row.capacityMode === "realizado" ? "Segun participacion" : "Sin cupo finito"),
  detalle: [
    row.reviewStatus === "verified" ? "conciliada" : "requiere revision",
    row.relaunches > 0 ? `${row.relaunches} relanzamiento` : "",
  ]
    .filter(Boolean)
    .join(" · "),
});

async function fetchConveniosList(year: number): Promise<ListResult> {
  const { data } = await supabase
    .from(TABLE_NAME_INSTITUCIONES)
    .select(FIELD_NOMBRE_INSTITUCIONES)
    // convenio_nuevo es smallint (año). Comparamos con el número.
    .eq(FIELD_CONVENIO_NUEVO_INSTITUCIONES, year);

  const names = new Set<string>();
  (data || []).forEach((i: Record<string, unknown>) => {
    const name = i[FIELD_NOMBRE_INSTITUCIONES] as string | undefined;
    if (name) names.add(getGroupName(name));
  });

  return {
    students: Array.from(names).map((n) => ({ nombre: n, legajo: "Confirmado" })),
  };
}

async function fetchRenovacionesList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_convenios_list", {
    p_year: year,
    p_kind: "renovaciones",
  });

  return {
    students: (data || []).map((c: { nombre?: string; fecha_vencimiento?: string }) => ({
      nombre: c.nombre || "Sin nombre",
      legajo: c.fecha_vencimiento ? `vence ${c.fecha_vencimiento}` : "Renovación",
    })),
    headers: [
      { key: "nombre", label: "Institución" },
      { key: "legajo", label: "Vencimiento" },
    ],
  };
}

async function fetchConveniosPorVencerList(): Promise<ListResult> {
  const { data } = await supabase.rpc("get_convenios_por_vencer", { p_days: 90 });

  return {
    students: (data || []).map((c: { institucion?: string; dias_restantes?: number }) => ({
      nombre: c.institucion || "Sin nombre",
      legajo: `${c.dias_restantes} días`,
    })),
    headers: [
      { key: "nombre", label: "Institución" },
      { key: "legajo", label: "Restan" },
    ],
    description: "Convenios cuyo vencimiento cae dentro de los próximos 90 días sin renovar.",
  };
}

export async function fetchOrientationList(year: number, orientation: string): Promise<ListResult> {
  const rows = await fetchStartedStudentsByOrientation(year);
  const students = Array.from(rows.get(classifyOrientation(orientation))?.values() || []);

  return {
    students,
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
    ],
    description: `Estudiantes con inicio efectivo de PPS en ${orientation} durante ${year}.`,
  };
}
