import {
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_FECHA_FINALIZACION_ESTUDIANTES,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_ESTADO_PPS,
  FIELD_ULTIMA_ACTUALIZACION_PPS,
  FIELD_ESTADO_FINALIZACION,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_HORAS_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_ESTUDIANTE_FINALIZACION,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
} from "../constants";
import { parseToUTCDate, safeGetId, normalizeStringForComparison } from "./formatters";
import { differenceInDays } from "date-fns";

const getGroupName = (name: string | undefined): string => {
  if (!name) return "Sin Nombre";
  return name.split(/ [-–] /)[0].trim();
};

// Proyección de usuarios habilitados sin cuenta para el año actual
// Este valor se suma a los nuevos inscriptos reales para la proyección
const PROYECCION_USUARIOS_HABILITADOS_2026 = 150;

export const calculateDashboardMetrics = (allData: any, targetYear: number) => {
  const isCurrentYear = targetYear === new Date().getFullYear();
  const now = new Date();

  // --- 0. MAPEO DE FECHAS CLAVE POR ESTUDIANTE ---
  // studentId -> { firstActivityDate: Date, graduationDate: Date | null }
  const studentTimelineMap = new Map<string, { firstActivity: Date; graduation: Date | null }>();

  // Helper para actualizar la fecha mínima de actividad (Ingreso real al sistema)
  const updateFirstActivity = (studentId: string, dateStr: string) => {
    if (!studentId || !dateStr) return;
    const date = parseToUTCDate(dateStr);
    if (!date) return;

    const current = studentTimelineMap.get(studentId) || {
      firstActivity: new Date(9999, 11, 31),
      graduation: null,
    };
    if (date < current.firstActivity) {
      current.firstActivity = date;
      studentTimelineMap.set(studentId, current);
    }
  };

  // 1. Barrer Convocatorias (Inscripciones)
  allData.convocatorias.forEach((c: any) => {
    const sId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
    // Preferimos created_at para la inscripción, o fecha_inicio como fallback
    const dateStr: string | null = c.created_at || c.fecha_inicio || null;
    if (sId && dateStr) updateFirstActivity(sId, dateStr);
  });

  // 2. Barrer Prácticas (Por si hay históricas sin convocatoria)
  allData.practicas.forEach((p: any) => {
    const sId = safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
    const dateStr: string | null = p[FIELD_FECHA_INICIO_PRACTICAS] || p.created_at || null;
    if (sId && dateStr) updateFirstActivity(sId, dateStr);
  });

  // 3. Cargar Fechas de Graduación y limpiar mapa
  allData.estudiantes.forEach((s: any) => {
    if (!studentTimelineMap.has(s.id)) return; // Si no tiene actividad, no cuenta para métricas de flujo

    const current = studentTimelineMap.get(s.id)!;

    // Si está finalizado, registramos la fecha
    if (s[FIELD_ESTADO_ESTUDIANTES] === "Finalizado" && s[FIELD_FECHA_FINALIZACION_ESTUDIANTES]) {
      current.graduation = parseToUTCDate(s[FIELD_FECHA_FINALIZACION_ESTUDIANTES]);
    }
    studentTimelineMap.set(s.id, current);
  });

  // --- 1. CÁLCULO DE INGRESANTES (Año Objetivo) ---
  // Son aquellos cuya `firstActivity` cae dentro de `targetYear`
  const ingresantesList = allData.estudiantes.filter((s: any) => {
    const timeline = studentTimelineMap.get(s.id);
    return timeline && timeline.firstActivity.getUTCFullYear() === targetYear;
  });

  // --- 2. EVOLUCIÓN ANUAL DE MATRÍCULA (No mensual) ---
  const trendData: { year: string; value: number; label: string }[] = [];

  // Calcular matrícula activa a fin de cada año
  for (let year = 2022; year <= targetYear; year++) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    let activeAtYearEnd = 0;
    studentTimelineMap.forEach((timeline) => {
      // Empezó antes o durante el año
      if (timeline.firstActivity <= endOfYear) {
        // No se fue, o se fue después del fin de año
        if (!timeline.graduation || timeline.graduation > endOfYear) {
          activeAtYearEnd++;
        }
      }
    });

    trendData.push({
      year: year.toString(),
      value: activeAtYearEnd,
      label: `Matrícula activa a fin de ${year}`,
    });
  }

  // --- 3. LISTAS AUXILIARES ---

  // Alumnos Finalizados:
  // 1. Los que tienen fecha_finalizacion en tabla estudiantes
  // 2. Los que tienen solicitud en tabla finalizaciones (por fecha_solicitud)
  const finalizacionMap = new Map<string, any>();
  allData.finalizaciones.forEach((f: any) => {
    const sId = safeGetId(f[FIELD_ESTUDIANTE_FINALIZACION]);
    if (sId) {
      finalizacionMap.set(sId, f);
    }
  });

  const acreditadosFinalizados = allData.estudiantes.filter((s: any) => {
    // Opción 1: tiene registro en tabla finalizaciones
    const finalizacion = finalizacionMap.get(s.id);
    if (finalizacion) {
      const fechaSolicitud = parseToUTCDate(finalizacion[FIELD_FECHA_SOLICITUD_FINALIZACION]);
      if (fechaSolicitud && fechaSolicitud.getUTCFullYear() === targetYear) {
        return true;
      }
    }

    // Opción 2: tiene fecha_finalizacion en tabla estudiantes
    const fechaEstudiante = parseToUTCDate(s[FIELD_FECHA_FINALIZACION_ESTUDIANTES]);
    if (fechaEstudiante && fechaEstudiante.getUTCFullYear() === targetYear) {
      return true;
    }

    return false;
  });

  const acreditadosList = acreditadosFinalizados;

  // Alumnos Activos HOY (Snapshot) o al final del año objetivo
  // Incluye a quienes se fueron durante el año (para matrícula generada del año)
  const activosList = allData.estudiantes.filter((s: any) => {
    const timeline = studentTimelineMap.get(s.id);
    if (!timeline) return false;

    const startedBeforeOrDuring = timeline.firstActivity.getUTCFullYear() <= targetYear;
    const notGraduatedBeforeYear =
      !timeline.graduation || timeline.graduation.getUTCFullYear() >= targetYear;

    return startedBeforeOrDuring && notGraduatedBeforeYear;
  });

  // Matrícula Generada: Solo los nuevos del año (no la suma de activos + acreditados)
  const totalMatriculaGenerada = ingresantesList.length;

  // Métricas Específicas de Estudiantes (Recuperadas de lógica anterior)
  const studentHoursMap = new Map<string, number>();
  const studentActivePracticesMap = new Map<string, boolean>();

  allData.practicas.forEach((p: any) => {
    const sId = safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
    if (sId) {
      const horas = p[FIELD_HORAS_PRACTICAS] || 0;
      const currentTotal = studentHoursMap.get(sId) || 0;
      studentHoursMap.set(sId, currentTotal + horas);

      const status = normalizeStringForComparison(p[FIELD_ESTADO_PRACTICA]);
      if (status === "en curso" || status === "pendiente" || status === "en proceso") {
        studentActivePracticesMap.set(sId, true);
      }
    }
  });

  // Mapa de estudiantes que tienen AL MENOS una práctica (sin importar horas)
  const studentHasAnyPractice = new Set<string>();
  allData.practicas.forEach((p: any) => {
    const sId = safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
    if (sId) {
      studentHasAnyPractice.add(sId);
    }
  });

  const sinNingunaPpsList = allData.estudiantes.filter((s: any) => {
    // Solo estudiantes activos que NO tienen ninguna práctica
    const estado = normalizeStringForComparison(s[FIELD_ESTADO_ESTUDIANTES]);
    if (estado !== "activo") return false;
    return !studentHasAnyPractice.has(s.id);
  });

  const proximosAFinalizarList = activosList.filter((s: any) => {
    const totalHours = studentHoursMap.get(s.id) || 0;
    if (totalHours >= 230) return true;
    return false;
  });

  const enPpsEnCursoList = activosList.filter((s: any) => studentActivePracticesMap.get(s.id));

  // --- 4. DISTRIBUCIÓN POR ÁREA ---
  interface OccupancyEntry {
    nombre: string;
    legajo: string;
    institucion: string;
    raw_value: string;
  }
  const occupancyByOrientation: Record<string, OccupancyEntry[]> = {
    Clinica: [],
    Educacional: [],
    Laboral: [],
    Comunitaria: [],
    "Sin definir": [],
  };

  const launchesMap = new Map(allData.lanzamientos.map((l: any) => [l.id, l]));

  allData.convocatorias.forEach((c: any) => {
    const date = parseToUTCDate(c.created_at || c.fecha_inicio);
    if (!date || date.getUTCFullYear() !== targetYear) return;

    const estadoInscripcion = normalizeStringForComparison(
      c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]
    );
    const estadosValidos = ["seleccionado", "en proceso", "espera", "inscripto"];
    if (!estadosValidos.includes(estadoInscripcion)) return;

    const rawLanzId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
    const lanzId = Array.isArray(rawLanzId) ? rawLanzId[0] : rawLanzId;
    const launch = launchesMap.get(lanzId);
    const studentId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
    const student = allData.estudiantes.find((s: any) => s.id === studentId);

    const studentEntry: OccupancyEntry = {
      nombre: student?.nombre || "Estudiante",
      legajo: student?.legajo || "---",
      institucion: (launch as any)?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "N/A",
      raw_value: (launch as any)?.[FIELD_ORIENTACION_LANZAMIENTOS] || "(Vacio)",
    };

    const normalized = normalizeStringForComparison(
      (launch as any)?.[FIELD_ORIENTACION_LANZAMIENTOS]
    );
    if (normalized.includes("clinica")) occupancyByOrientation["Clinica"].push(studentEntry);
    else if (normalized.includes("educacional") || normalized.includes("educacion"))
      occupancyByOrientation["Educacional"].push(studentEntry);
    else if (normalized.includes("laboral") || normalized.includes("trabajo"))
      occupancyByOrientation["Laboral"].push(studentEntry);
    else if (normalized.includes("comunitaria") || normalized.includes("comunidad"))
      occupancyByOrientation["Comunitaria"].push(studentEntry);
    else occupancyByOrientation["Sin definir"].push(studentEntry);
  });

  // --- 5. DATOS DE INSTITUCIONES ---
  const yearLaunches = allData.lanzamientos.filter(
    (l: any) => parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS])?.getUTCFullYear() === targetYear
  );
  const totalCupos = yearLaunches.reduce(
    (sum: number, l: any) => sum + (l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0),
    0
  );

  const uniqueActiveNames = new Set<string>();
  yearLaunches.forEach((l: any) => {
    if (l[FIELD_NOMBRE_PPS_LANZAMIENTOS]) {
      uniqueActiveNames.add(getGroupName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS]));
    }
  });
  const activeInstitutionsList = Array.from(uniqueActiveNames).map((name) => ({
    nombre: name,
    legajo: "Activa",
  }));

  const uniqueNewAgreementNames = new Set<string>();
  allData.instituciones.forEach((i: any) => {
    const convenioVal = i[FIELD_CONVENIO_NUEVO_INSTITUCIONES];
    if (String(convenioVal) === String(targetYear) && i[FIELD_NOMBRE_INSTITUCIONES]) {
      uniqueNewAgreementNames.add(getGroupName(i[FIELD_NOMBRE_INSTITUCIONES]));
    }
  });
  const nuevosConveniosList = Array.from(uniqueNewAgreementNames).map((name) => ({
    nombre: name,
    legajo: "Confirmado",
  }));

  // --- 6. GESTIÓN Y SEGUIMIENTO ---
  const terminalStatuses = [
    "finalizada",
    "cancelada",
    "rechazada",
    "archivado",
    "realizada",
    "no se pudo concretar",
  ];

  const solicitudesEnCursoList = allData.solicitudes.filter((r: any) => {
    const status = normalizeStringForComparison(r[FIELD_ESTADO_PPS]);
    return !terminalStatuses.includes(status);
  });

  const demoradosList = allData.solicitudes.filter((r: any) => {
    const status = normalizeStringForComparison(r[FIELD_ESTADO_PPS]);
    if (terminalStatuses.includes(status)) return false;
    const updateDate = new Date(r[FIELD_ULTIMA_ACTUALIZACION_PPS] || r.created_at);
    return differenceInDays(now, updateDate) > 5;
  });

  const acreditacionesPendientesList = allData.finalizaciones.filter(
    (f: any) => f[FIELD_ESTADO_FINALIZACION] === "Pendiente"
  );

  // --- 7. GRÁFICOS HISTÓRICOS (INGRESANTES) ---
  const getIngresantesCount = (year: number) => {
    let count = 0;
    studentTimelineMap.forEach((timeline) => {
      if (timeline.firstActivity.getUTCFullYear() === year) count++;
    });
    return count;
  };

  // Calcular dinámicamente para años con datos
  // Para 2026: reales + proyección de usuarios habilitados sin cuenta
  const ingresantesReales2026 = getIngresantesCount(2026);
  const proyectados2026 = isCurrentYear ? PROYECCION_USUARIOS_HABILITADOS_2026 : 0;

  const enrollmentEvolution = [
    { year: "2022", value: getIngresantesCount(2022) || 19, label: "Nuevos Inscriptos" },
    { year: "2023", value: getIngresantesCount(2023) || 87, label: "Nuevos Inscriptos" },
    { year: "2024", value: getIngresantesCount(2024), label: "Nuevos Inscriptos" },
    { year: "2025", value: getIngresantesCount(2025), label: "Nuevos Inscriptos" },
    {
      year: "2026",
      value: proyectados2026 > 0 ? proyectados2026 : ingresantesReales2026,
      label:
        proyectados2026 > 0
          ? `Proyección: ${ingresantesReales2026} reales + ${proyectados2026} proyectados`
          : "Nuevos Inscriptos",
      isProjection: targetYear >= 2026 && proyectados2026 > 0,
    },
  ];

  return {
    // Resumen General
    matriculaGenerada: {
      value: totalMatriculaGenerada,
      list: [...activosList, ...acreditadosList],
    },
    alumnosFinalizados: { value: acreditadosList.length, list: acreditadosList },
    matriculaActiva: { value: activosList.length, list: activosList },
    solicitudesGestion: { value: solicitudesEnCursoList.length, list: solicitudesEnCursoList },

    // Pestaña Instituciones
    nuevosIngresantes: { value: ingresantesList.length, list: ingresantesList },
    alumnosSinPPS: { value: sinNingunaPpsList.length, list: sinNingunaPpsList },
    proximosAFinalizar: { value: proximosAFinalizarList.length, list: proximosAFinalizarList },
    haciendoPPS: { value: enPpsEnCursoList.length, list: enPpsEnCursoList },

    // Pestaña Instituciones
    // Crear lista con nombre y cupos para mostrar en modal
    ppsLanzadasList: yearLaunches.map((l: any) => ({
      nombre: l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre",
      legajo: l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0,
      institucion: l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "",
    })),
    ppsLanzadas: { value: yearLaunches.length, list: yearLaunches },
    cuposOfrecidos: { value: totalCupos, list: yearLaunches },
    conveniosNuevos: { value: uniqueNewAgreementNames.size, list: nuevosConveniosList },
    institucionesActivas: { value: uniqueActiveNames.size, list: activeInstitutionsList },

    // Tablas y Gráficos
    alumnosDemorados: { value: demoradosList.length, list: demoradosList },
    acreditacionesPendientes: {
      value: acreditacionesPendientesList.length,
      list: acreditacionesPendientesList,
    },
    occupancyDistribution: occupancyByOrientation,
    enrollmentEvolution,
    trendData,

    // Tendencias vs año anterior
    trends: {
      matriculaGenerada:
        getIngresantesCount(targetYear - 1) > 0
          ? Math.round(
              ((totalMatriculaGenerada - getIngresantesCount(targetYear - 1)) /
                getIngresantesCount(targetYear - 1)) *
                100
            )
          : 0,
      acreditados:
        getIngresantesCount(targetYear - 1) > 0
          ? Math.round(
              ((acreditadosList.length - getIngresantesCount(targetYear - 1)) /
                getIngresantesCount(targetYear - 1)) *
                100
            )
          : 0,
      activos:
        getIngresantesCount(targetYear - 1) > 0
          ? Math.round(
              ((activosList.length - getIngresantesCount(targetYear - 1)) /
                getIngresantesCount(targetYear - 1)) *
                100
            )
          : 0,
    },
  };
};
