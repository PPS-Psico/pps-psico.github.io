import { supabase } from "../lib/supabaseClient";
import type { StudentInfo } from "../types";
import {
  TABLE_NAME_ESTUDIANTES,
  TABLE_NAME_PRACTICAS,
  TABLE_NAME_FINALIZACION,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_INSTITUCIONES,
  TABLE_NAME_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_ESTUDIANTE_FINALIZACION,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
} from "../constants";
import { getGroupName } from "../utils/formatters";

export interface ListResult {
  students: StudentInfo[];
  headers?: { key: string; label: string }[];
  description?: string;
}

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
    case "orientation":
      return { students: [], description: "" };
    default:
      return { students: [] };
  }
}

async function fetchIngresantesList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_ingresantes_list", { p_year: year });
  const list = (data || []) as unknown as any[];

  return {
    students: list.map((s: any) => ({
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
  const list = (data || []) as unknown as any[];

  return {
    students: list.map((s: any) => ({
      nombre: s.nombre,
      legajo: s.legajo,
    })),
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
    ],
    description: `Estudiantes con al menos una actividad de PPS en ${year}.`,
  };
}

async function fetchHeredadosList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_heredados_list", { p_year: year });
  const list = (data || []) as unknown as any[];

  return {
    students: list.map((s: any) => ({
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
  const list = (data || []) as unknown as any[];

  return {
    students: list.map((s: any) => ({
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
  const list = (data || []) as unknown as any[];
  return {
    students: list.map((s: any) => ({
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
  const list = (data || []) as unknown as any[];

  return {
    students: list.map((s: any) => ({
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
  const list = (data || []) as unknown as any[];

  return {
    students: list.map((s: any) => ({
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

async function fetchHaciendoPpsList(year: number): Promise<ListResult> {
  const { data } = await supabase.rpc("get_haciendo_pps_list", { p_year: year });
  const list = (data || []) as unknown as any[];

  return {
    students: list.map((s: any) => ({
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
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const { data } = await supabase
    .from(TABLE_NAME_LANZAMIENTOS_PPS)
    .select(`${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}`)
    .gte("fecha_inicio", start)
    .lt("fecha_inicio", end);

  return {
    students: (data || []).map((l: any) => ({
      nombre: l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre",
      legajo: l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0,
      institucion: l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "",
    })),
    headers: [
      { key: "nombre", label: "PPS" },
      { key: "legajo", label: "Cupos" },
    ],
  };
}

async function fetchInstitucionesActivasList(year: number): Promise<ListResult> {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const { data } = await supabase
    .from(TABLE_NAME_LANZAMIENTOS_PPS)
    .select(FIELD_NOMBRE_PPS_LANZAMIENTOS)
    .gte("fecha_inicio", start)
    .lt("fecha_inicio", end);

  const names = new Set<string>();
  (data || []).forEach((l: any) => {
    const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];
    if (name) names.add(getGroupName(name));
  });

  return {
    students: Array.from(names).map((n) => ({ nombre: n, legajo: "Activa" })),
  };
}

async function fetchCuposList(year: number): Promise<ListResult> {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const { data } = await supabase
    .from(TABLE_NAME_LANZAMIENTOS_PPS)
    .select(`${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}`)
    .gte("fecha_inicio", start)
    .lt("fecha_inicio", end);

  return {
    students: (data || []).map((l: any) => ({
      nombre: l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre",
      legajo: l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0,
    })),
    headers: [
      { key: "nombre", label: "PPS" },
      { key: "legajo", label: "Cupos" },
    ],
  };
}

async function fetchConveniosList(year: number): Promise<ListResult> {
  const { data } = await supabase
    .from(TABLE_NAME_INSTITUCIONES)
    .select(FIELD_NOMBRE_INSTITUCIONES)
    // convenio_nuevo migra a smallint (año). Comparamos con el número.
    // El cast cubre el desajuste temporal hasta regenerar src/types/supabase.ts.
    .eq(FIELD_CONVENIO_NUEVO_INSTITUCIONES, year as unknown as string);

  const names = new Set<string>();
  (data || []).forEach((i: any) => {
    const name = i[FIELD_NOMBRE_INSTITUCIONES];
    if (name) names.add(getGroupName(name));
  });

  return {
    students: Array.from(names).map((n) => ({ nombre: n, legajo: "Confirmado" })),
  };
}

export async function fetchOrientationList(year: number, orientation: string): Promise<ListResult> {
  const start = `${year}-01-01T00:00:00`;
  const end = `${year + 1}-01-01T00:00:00`;

  const { data: convocatorias } = await supabase
    .from(TABLE_NAME_CONVOCATORIAS)
    .select(
      `${FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS}, ${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, estudiantes!inner(${FIELD_NOMBRE_ESTUDIANTES}, ${FIELD_LEGAJO_ESTUDIANTES})`
    )
    // Estados canónicos (ver migración normalize_states). Debe coincidir con el
    // filtro del KPI orientation_distribution en get_admin_metrics_kpis.
    .in("estado_inscripcion", ["Seleccionado", "Inscripto"])
    .gte("created_at", start)
    .lt("created_at", end);

  if (!convocatorias) return { students: [] };

  const launchIds = Array.from(
    new Set(
      convocatorias
        .map((c: any) => {
          const raw = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
          return Array.isArray(raw) ? raw[0] : raw;
        })
        .filter(Boolean)
    )
  );

  const { data: launches } = await supabase
    .from(TABLE_NAME_LANZAMIENTOS_PPS)
    .select(`id, orientacion, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}`)
    .in("id", launchIds);

  const launchMap = new Map((launches || []).map((l: any) => [l.id, l]));

  const students: StudentInfo[] = [];
  convocatorias.forEach((c: any) => {
    const rawLanzId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
    const lanzId = Array.isArray(rawLanzId) ? rawLanzId[0] : rawLanzId;
    const launch = launchMap.get(lanzId);
    if (!launch) return;

    // Clasifica la orientación con el MISMO criterio que el RPC
    // get_admin_metrics_kpis (orientation_distribution), para que la lista del
    // modal coincida exactamente con el conteo del gráfico.
    if (classifyOrientation(launch.orientacion) !== orientation) return;

    const s = Array.isArray(c.estudiantes) ? c.estudiantes[0] : c.estudiantes;
    if (s) {
      students.push({
        nombre: s[FIELD_NOMBRE_ESTUDIANTES],
        legajo: s[FIELD_LEGAJO_ESTUDIANTES],
        institucion: launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "N/A",
        raw_value: launch.orientacion || "(Vacio)",
      });
    }
  });

  return {
    students,
    headers: [
      { key: "nombre", label: "Nombre" },
      { key: "legajo", label: "Legajo" },
      { key: "institucion", label: "Institucion" },
      ...(orientation === "Sin definir" ? [{ key: "raw_value", label: "Valor en DB" }] : []),
    ],
    description:
      orientation === "Sin definir"
        ? "Registros con orientaciones no reconocidas."
        : `Estudiantes en vacantes de ${orientation} durante ${year}.`,
  };
}
