import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

import {
  TABLE_NAME_ESTUDIANTES,
  TABLE_NAME_PRACTICAS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_FINALIZACION,
  TABLE_NAME_INSTITUCIONES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTUDIANTE_FINALIZACION,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ORIENTACIONES_INSTITUCIONES,
  TABLE_NAME_PPS,
  FIELD_SOLICITUD_NOMBRE_ALUMNO,
  FIELD_SOLICITUD_LEGAJO_ALUMNO,
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_ESTADO_PPS,
  FIELD_LEGAJO_PPS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTADO_ESTUDIANTES,
} from "../constants";
import {
  AnyReportData,
  ExecutiveReportData,
  GestionReportData,
  GestionYearStat,
  NewAgreementDetail,
  PPSRequestSummary,
  ReportSelection,
  TimelineMonthData,
} from "../types";
import {
  safeGetId,
  parseToUTCDate,
  formatDate,
  getGroupName,
  normalizeStringForComparison,
} from "../utils/formatters";
import { isUnlimitedCupoInstitution } from "../utils/unlimitedCupos";
import type { DashboardData, MetricRow } from "../utils/metricsCalculations";

// Cupos "estadísticos" de un lanzamiento: las PPS de cupo ilimitado
// (Fundación Tiempo, Ulloa) aportan 0 para no romper los totales.
const launchCupos = (l: MetricRow): number => {
  if (isUnlimitedCupoInstitution(l[FIELD_NOMBRE_PPS_LANZAMIENTOS])) return 0;
  return Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]) || 0;
};

const cleanRawValue = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  return str.replace(/[\[\]"]/g, "").trim();
};

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const processRequestsForYear = (
  targetYear: number,
  requests: MetricRow[],
  students: MetricRow[]
): PPSRequestSummary[] => {
  const studentMap = new Map(students.map((s) => [s.id, s]));

  return requests
    .filter((r) => {
      const dateStr = r.created_at;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date.getFullYear() === targetYear;
    })
    .map((r) => {
      const sId = safeGetId(r[FIELD_LEGAJO_PPS]);
      const student = sId ? studentMap.get(sId) : null;

      const studentName =
        student?.[FIELD_NOMBRE_ESTUDIANTES] ||
        cleanRawValue(r[FIELD_SOLICITUD_NOMBRE_ALUMNO]) ||
        "Desconocido";
      const studentLegajo =
        student?.[FIELD_LEGAJO_ESTUDIANTES] ||
        cleanRawValue(r[FIELD_SOLICITUD_LEGAJO_ALUMNO]) ||
        "---";
      const institutionName =
        cleanRawValue(r[FIELD_EMPRESA_PPS_SOLICITUD]) || "Institución desconocida";
      const status = r[FIELD_ESTADO_PPS] || "Pendiente";

      return {
        id: String(r.id),
        studentName: String(studentName),
        studentLegajo: String(studentLegajo),
        institutionName: String(institutionName),
        requestDate: formatDate(r.created_at),
        status: String(status),
      };
    });
};

// Estudiantes que ocuparon cupo (SELECCIONADOS) por lanzamiento. Contamos solo
// los que efectivamente hicieron la PPS, no todos los inscriptos, para no
// inflar el número de estudiantes.
const buildStudentsByLaunchId = (allData: DashboardData) => {
  const studentsByLaunchId = new Map<string, Set<string>>();
  allData.convocatorias.forEach((c) => {
    const estado = normalizeStringForComparison(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]);
    if (estado !== "seleccionado") return;
    const rawLanzId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
    const lanzId = Array.isArray(rawLanzId) ? rawLanzId[0] : rawLanzId;
    const sId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
    if (lanzId && sId) {
      if (!studentsByLaunchId.has(lanzId)) studentsByLaunchId.set(lanzId, new Set());
      studentsByLaunchId.get(lanzId)!.add(sId);
    }
  });
  return studentsByLaunchId;
};

const splitOrient = (raw: unknown, sink: Set<string>) => {
  if (!raw) return;
  String(raw)
    .split(/[,;/]/)
    .forEach((o) => {
      const t = o.trim();
      if (t) sink.add(t);
    });
};

// FICHA POR INSTITUCIÓN de convenios nuevos: orientación, rotaciones
// (lanzamientos) y cupos por año, totales y estudiantes que ocuparon cupo.
// Para gestión: muestra qué tan productivo fue cada convenio.
const buildAgreementsDetail = (
  allData: DashboardData,
  instRecords: MetricRow[]
): NewAgreementDetail[] => {
  const studentsByLaunchId = buildStudentsByLaunchId(allData);
  return instRecords
    .map((instRecord) => {
      const instName = String(instRecord[FIELD_NOMBRE_INSTITUCIONES] || "");
      const normName = normalizeStringForComparison(instName);
      const convenioYear = Number(instRecord[FIELD_CONVENIO_NUEVO_INSTITUCIONES]);
      const cupoIlimitado = isUnlimitedCupoInstitution(instName);

      const matchingLaunches = allData.lanzamientos.filter(
        (l) =>
          normalizeStringForComparison(getGroupName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS])) === normName
      );

      const perYear = new Map<number, { rotaciones: number; cupos: number }>();
      const orientSet = new Set<string>();
      const studentSet = new Set<string>();
      let totalCupos = 0;

      matchingLaunches.forEach((l) => {
        const date = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
        const yr = date ? date.getUTCFullYear() : null;
        const cupos = launchCupos(l);
        totalCupos += cupos;
        if (yr) {
          const entry = perYear.get(yr) || { rotaciones: 0, cupos: 0 };
          entry.rotaciones += 1;
          entry.cupos += cupos;
          perYear.set(yr, entry);
        }
        splitOrient(l[FIELD_ORIENTACION_LANZAMIENTOS], orientSet);
        studentsByLaunchId.get(l.id)?.forEach((s) => studentSet.add(s));
      });

      if (orientSet.size === 0) {
        splitOrient(instRecord[FIELD_ORIENTACIONES_INSTITUCIONES], orientSet);
      }

      const porAnio = Array.from(perYear.entries())
        .map(([year, v]) => ({ year, rotaciones: v.rotaciones, cupos: v.cupos }))
        .sort((a, b) => a.year - b.year);

      return {
        institucion: instName,
        anioConvenio: Number.isNaN(convenioYear) ? null : convenioYear,
        orientaciones: Array.from(orientSet),
        totalRotaciones: matchingLaunches.length,
        totalCupos,
        totalEstudiantes: studentSet.size,
        porAnio,
        cupoIlimitado,
      } as NewAgreementDetail;
    })
    .sort((a, b) => a.institucion.localeCompare(b.institucion));
};

const processAllData = (allData: DashboardData, targetYear: number) => {
  // 1. IDENTIFICAR LANZAMIENTOS DEL AÑO OBJETIVO
  const launchesInTargetYear = allData.lanzamientos.filter((l) => {
    const date = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
    return date && date.getUTCFullYear() === targetYear;
  });

  const launchIdsInYear = new Set<string>(launchesInTargetYear.map((l) => l.id));

  // 2. IDENTIFICAR ESTUDIANTES ACTIVOS
  const activeStudentIds = new Set<string>();

  allData.convocatorias.forEach((c) => {
    const rawLanzId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
    const lanzId = Array.isArray(rawLanzId) ? rawLanzId[0] : rawLanzId;

    if (lanzId && launchIdsInYear.has(lanzId)) {
      const sId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
      if (sId) activeStudentIds.add(sId);
    }
  });

  const activeList = allData.estudiantes.filter((s) => {
    // Excluir finalizados usando la nueva lógica de 'estado'
    if (s[FIELD_ESTADO_ESTUDIANTES] === "Finalizado") return false;
    return activeStudentIds.has(s.id);
  });

  // 3. ALUMNOS FINALIZADOS
  const finishedList = allData.finalizaciones
    .filter((f) => {
      const dateStr = f[FIELD_FECHA_SOLICITUD_FINALIZACION] || f.created_at;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date.getFullYear() === targetYear;
    })
    .map((f) => {
      const sId = safeGetId(f[FIELD_ESTUDIANTE_FINALIZACION]);
      const student = allData.estudiantes.find((s) => s.id === sId);
      return student || { nombre: "Estudiante Finalizado", legajo: "---" };
    });

  // 4. ESTUDIANTES ACTIVOS SIN PPS
  const studentsWithPracticeIds = new Set<string>();
  allData.practicas.forEach((p) => {
    const link = safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
    if (link) studentsWithPracticeIds.add(link);
  });

  const activeWithoutPpsList = activeList.filter((s) => !studentsWithPracticeIds.has(s.id));

  // 5. METRICAS DE LANZAMIENTOS
  const totalCupos = launchesInTargetYear.reduce((sum: number, l) => sum + launchCupos(l), 0);

  const uniqueLaunchesSet = new Set<string>();
  const ppsLaunchedList: { nombre: string; legajo: string; cupos: number }[] = [];
  const monthlyData: {
    [key: number]: {
      cuposTotal: number;
      institutions: Map<string, { cupos: number; variants: string[]; unlimited?: boolean }>;
    };
  } = {};

  launchesInTargetYear.forEach((launch) => {
    const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
    if (ppsName) {
      const groupName = getGroupName(ppsName);
      const date = parseToUTCDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS]);
      const monthIndex = date ? date.getUTCMonth() : -1;
      const cupos = launchCupos(launch);

      if (monthIndex >= 0) {
        uniqueLaunchesSet.add(`${groupName}::${monthIndex}`);

        if (!monthlyData[monthIndex]) {
          monthlyData[monthIndex] = { cuposTotal: 0, institutions: new Map() };
        }
        monthlyData[monthIndex].cuposTotal += cupos;

        const institutionData = monthlyData[monthIndex].institutions.get(groupName) || {
          cupos: 0,
          variants: [],
        };
        institutionData.cupos += cupos;
        institutionData.variants.push(ppsName);
        if (isUnlimitedCupoInstitution(ppsName)) institutionData.unlimited = true;
        monthlyData[monthIndex].institutions.set(groupName, institutionData);
      }

      if (!ppsLaunchedList.find((i) => i.nombre === groupName)) {
        ppsLaunchedList.push({
          nombre: groupName,
          legajo: "Varias Comisiones",
          cupos: 0,
        });
      }
    }
  });

  const ppsLanzadasValue = uniqueLaunchesSet.size;

  const launchesByMonth: TimelineMonthData[] = MONTH_NAMES.map(
    (monthName, index): TimelineMonthData | null => {
      const data = monthlyData[index];
      if (data) {
        return {
          monthName,
          ppsCount: data.institutions.size,
          cuposTotal: data.cuposTotal,
          institutions: Array.from(data.institutions.entries())
            .map(([name, details]) => ({
              name,
              cupos: details.cupos,
              variants: details.variants.sort(),
              unlimited: details.unlimited === true,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      }
      return null;
    }
  ).filter((item): item is TimelineMonthData => item !== null);

  const uniqueInstitutionsNames = new Set<string>();
  launchesInTargetYear.forEach((l) => {
    const name = getGroupName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
    uniqueInstitutionsNames.add(name);
  });
  const activeInstitutionsCount = uniqueInstitutionsNames.size;
  const activeInstitutionsList = Array.from(uniqueInstitutionsNames).map((name) => ({
    nombre: name,
    legajo: "Activa",
    cupos: "N/A",
  }));

  // UPDATE: Filter new agreements strictly by Institution Table and Year
  const newAgreementRecords = allData.instituciones.filter(
    (i) => String(i[FIELD_CONVENIO_NUEVO_INSTITUCIONES]) === String(targetYear)
  );
  const newAgreementsList = newAgreementRecords.map((i) => ({
    nombre: i[FIELD_NOMBRE_INSTITUCIONES],
  }));

  const newAgreementsDetail = buildAgreementsDetail(allData, newAgreementRecords);

  const ppsRequests = processRequestsForYear(targetYear, allData.solicitudes, allData.estudiantes);

  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const currentMonthLaunches: {
    groupName: string;
    totalCupos: number;
    variants: { name: string; cupos: string }[];
  }[] = [];
  if (monthlyData[currentMonth]) {
    monthlyData[currentMonth].institutions.forEach((val, key) => {
      currentMonthLaunches.push({
        groupName: key,
        totalCupos: val.cupos,
        variants: val.variants.map((v) => ({ name: v, cupos: "N/A" })),
      });
    });
  }

  return {
    alumnosActivos: { value: activeList.length, list: activeList },
    alumnosFinalizados: { value: finishedList.length, list: finishedList },
    alumnosSinNingunaPPS: { value: activeWithoutPpsList.length, list: activeWithoutPpsList },
    ppsLanzadas: { value: ppsLanzadasValue, list: ppsLaunchedList },
    cuposOfrecidos: { value: totalCupos, list: [] },
    alumnosEnPPS: { value: activeList.length - activeWithoutPpsList.length, list: [] },
    alumnosConPpsEsteAno: { value: activeList.length - activeWithoutPpsList.length, list: [] },
    alumnosActivosSinPpsEsteAno: { value: activeWithoutPpsList.length, list: activeWithoutPpsList },
    alumnosProximosAFinalizar: { value: 0, list: [] },
    alumnosParaAcreditar: { value: 0, list: [] },
    nuevosConvenios: { value: newAgreementsList.length, list: newAgreementsList },
    activeInstitutions: { value: activeInstitutionsCount, list: activeInstitutionsList },
    cuposTotalesConRelevamiento: { value: 0, list: [] },
    lanzamientosMesActual: currentMonthLaunches,
    rawStudents: activeList,
    launchesByMonth,
    newAgreementsList: newAgreementsList.map((i) => i.nombre),
    newAgreementsDetail,
    ppsRequests,
  };
};

// Inicio de la coordinación actual: septiembre de 2024.
const GESTION_START_UTC = Date.UTC(2024, 8, 1);
const GESTION_START_YEAR = 2024;

const REALIZADA_STATES = new Set(["realizada", "finalizada", "aprobada"]);

const buildGestionReport = (allData: DashboardData): GestionReportData => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const launchDate = (l: MetricRow) => parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);

  const gestionLaunches = allData.lanzamientos.filter((l) => {
    const d = launchDate(l);
    return d && d.getTime() >= GESTION_START_UTC;
  });

  const studentsByLaunchId = buildStudentsByLaunchId(allData);

  // Corte anual (año calendario). 2024 arranca en septiembre y el año actual
  // está en curso: se marcan como parciales para leerlos con ese contexto.
  const yearlyStats: GestionYearStat[] = [];
  for (let year = GESTION_START_YEAR; year <= currentYear; year++) {
    const launches = gestionLaunches.filter((l) => launchDate(l)?.getUTCFullYear() === year);
    const cupos = launches.reduce((sum, l) => sum + launchCupos(l), 0);
    const conveniosNuevos = allData.instituciones.filter(
      (i) => String(i[FIELD_CONVENIO_NUEVO_INSTITUCIONES]) === String(year)
    ).length;
    // Ingresantes por cohorte (año de la primera PPS real), no por created_at.
    const ingresantes = allData.estudiantes.filter((s) => Number(s.cohorte) === year).length;
    const finalizados = allData.finalizaciones.filter((f) => {
      const dateStr = f[FIELD_FECHA_SOLICITUD_FINALIZACION] || f.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.getFullYear() === year && d.getTime() >= GESTION_START_UTC;
    }).length;
    const solicitudesYear = allData.solicitudes.filter((r) => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      return !isNaN(d.getTime()) && d.getFullYear() === year && d.getTime() >= GESTION_START_UTC;
    });
    const solicitudesConcretadas = solicitudesYear.filter((r) =>
      REALIZADA_STATES.has(normalizeStringForComparison(r[FIELD_ESTADO_PPS]))
    ).length;

    const isPartial = year === GESTION_START_YEAR || year === currentYear;
    const label =
      year === GESTION_START_YEAR
        ? `${year} (sept–dic)`
        : year === currentYear
          ? `${year} (en curso)`
          : String(year);

    yearlyStats.push({
      year,
      label,
      isPartial,
      lanzamientos: launches.length,
      cupos,
      conveniosNuevos,
      ingresantes,
      finalizados,
      solicitudes: solicitudesYear.length,
      solicitudesConcretadas,
    });
  }

  const sum = (fn: (y: GestionYearStat) => number) =>
    yearlyStats.reduce((acc, y) => acc + fn(y), 0);

  const institucionesActivas = new Set(
    gestionLaunches.map((l) => getGroupName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS]))
  ).size;

  const colocados = new Set<string>();
  gestionLaunches.forEach((l) => studentsByLaunchId.get(l.id)?.forEach((s) => colocados.add(s)));

  // Oferta comparada como ventanas móviles de 12 meses alrededor del inicio de
  // la gestión, para aislar el efecto del cambio de coordinación.
  const sumWindow = (fromUTC: number, toUTC: number) => {
    let lanzamientos = 0;
    let cupos = 0;
    allData.lanzamientos.forEach((l) => {
      const d = launchDate(l);
      if (d && d.getTime() >= fromUTC && d.getTime() < toUTC) {
        lanzamientos += 1;
        cupos += launchCupos(l);
      }
    });
    return { lanzamientos, cupos };
  };
  const first12End = Date.UTC(2025, 8, 1);
  const antes = sumWindow(Date.UTC(2023, 8, 1), GESTION_START_UTC);
  const despues = sumWindow(GESTION_START_UTC, first12End);
  const pctCupos =
    now.getTime() >= first12End && antes.cupos > 0
      ? ((despues.cupos - antes.cupos) / antes.cupos) * 100
      : null;

  const newAgreementRecords = allData.instituciones.filter((i) => {
    const y = Number(i[FIELD_CONVENIO_NUEVO_INSTITUCIONES]);
    return !Number.isNaN(y) && y >= GESTION_START_YEAR && y <= currentYear;
  });
  const newAgreementsDetail = buildAgreementsDetail(allData, newAgreementRecords);

  const totals = {
    lanzamientos: gestionLaunches.length,
    cupos: sum((y) => y.cupos),
    conveniosNuevos: newAgreementsDetail.length,
    ingresantes: sum((y) => y.ingresantes),
    finalizados: sum((y) => y.finalizados),
    solicitudes: sum((y) => y.solicitudes),
    solicitudesConcretadas: sum((y) => y.solicitudesConcretadas),
    institucionesActivas,
    estudiantesColocados: colocados.size,
  };

  // Lectura cualitativa autogenerada a partir de los números.
  const highlights: string[] = [];
  highlights.push(
    `Desde septiembre de 2024 se lanzaron ${totals.lanzamientos} rotaciones de PPS que ofrecieron ${totals.cupos} cupos en ${totals.institucionesActivas} instituciones, con ${totals.estudiantesColocados} estudiantes que ocuparon un cupo.`
  );
  if (pctCupos !== null) {
    const dir = pctCupos >= 0 ? "creció" : "se redujo";
    highlights.push(
      `En los primeros 12 meses de gestión (sept. 2024 – ago. 2025) la oferta de cupos ${dir} un ${Math.abs(pctCupos).toFixed(0)}% respecto de los 12 meses previos: de ${antes.cupos} a ${despues.cupos} cupos.`
    );
  }
  if (newAgreementsDetail.length > 0) {
    const nombres = newAgreementsDetail.slice(0, 3).map((d) => d.institucion);
    highlights.push(
      `Se firmaron ${totals.conveniosNuevos} convenios nuevos con instituciones como ${nombres.join(", ")}, ampliando la red de prácticas disponible.`
    );
  }
  const fullYears = yearlyStats.filter((y) => !y.isPartial);
  const lastFull = fullYears[fullYears.length - 1];
  if (lastFull && lastFull.finalizados > 0 && lastFull.ingresantes > 0) {
    const ratio = lastFull.ingresantes / lastFull.finalizados;
    highlights.push(
      `En ${lastFull.year}, por cada estudiante que finalizó su recorrido de PPS ingresaron ${ratio.toFixed(1)} estudiantes nuevos (${lastFull.ingresantes} ingresos frente a ${lastFull.finalizados} egresos).`
    );
  }
  if (totals.solicitudes > 0) {
    const pctConcretadas = (totals.solicitudesConcretadas / totals.solicitudes) * 100;
    highlights.push(
      `Se gestionaron ${totals.solicitudes} solicitudes de PPS presentadas por estudiantes, de las cuales ${totals.solicitudesConcretadas} se concretaron (${pctConcretadas.toFixed(0)}%).`
    );
  }

  return {
    reportType: "gestion",
    periodLabel: `Septiembre 2024 – ${MONTH_NAMES[now.getUTCMonth()]} ${currentYear}`,
    generatedAt: now.toLocaleDateString("es-ES"),
    totals,
    yearlyStats,
    comparativa12m: { antes, despues, pctCupos },
    highlights,
    newAgreementsDetail,
  };
};

const fetchAllDataForReport = async () => {
  const [est, prac, lanz, conv, fin, inst, req] = await Promise.all([
    supabase.from(TABLE_NAME_ESTUDIANTES).select("*"),
    supabase.from(TABLE_NAME_PRACTICAS).select("*"),
    supabase.from(TABLE_NAME_LANZAMIENTOS_PPS).select("*"),
    supabase.from(TABLE_NAME_CONVOCATORIAS).select("*"),
    supabase.from(TABLE_NAME_FINALIZACION).select("*"),
    supabase.from(TABLE_NAME_INSTITUCIONES).select("*"),
    supabase.from(TABLE_NAME_PPS).select("*"),
  ]);

  return {
    estudiantes: est.data || [],
    practicas: prac.data || [],
    lanzamientos: lanz.data || [],
    convocatorias: conv.data || [],
    finalizaciones: fin.data || [],
    instituciones: inst.data || [],
    solicitudes: req.data || [],
  };
};

export const useExecutiveReportData = ({
  selection,
  enabled = false,
  isTestingMode = false,
}: {
  selection: ReportSelection | null;
  enabled?: boolean;
  isTestingMode?: boolean;
}) => {
  return useQuery<AnyReportData, Error>({
    queryKey: ["executiveReportData", selection, isTestingMode],
    queryFn: async () => {
      if (isTestingMode) return {} as AnyReportData;
      if (!selection) throw new Error("A report selection must be provided.");

      const allData = await fetchAllDataForReport();

      if (selection.mode === "gestion") {
        return buildGestionReport(allData);
      }

      const generateSingleYearReport = (year: number): ExecutiveReportData => {
        const currentMetrics = processAllData(allData, year);
        const prevMetrics = processAllData(allData, year - 1);

        const yearStartDate = new Date(Date.UTC(year, 0, 1));
        const yearEndDate = new Date(Date.UTC(year + 1, 0, 1));
        yearEndDate.setUTCDate(yearEndDate.getUTCDate() - 1);
        const previousYearEndDate = new Date(Date.UTC(year, 0, 1));
        previousYearEndDate.setUTCDate(previousYearEndDate.getUTCDate() - 1);

        // Ingresantes reales = estudiantes cuya cohorte (año de su primera PPS
        // real) cae en el año. NO usamos created_at: la migración de Airtable lo
        // dejó casi todo en 2025, inflando ese año. Ver migración add_cohorte.
        const newStudentsCount = allData.estudiantes.filter(
          (s) => Number(s.cohorte) === year
        ).length;
        const prevNewStudentsCount = allData.estudiantes.filter(
          (s) => Number(s.cohorte) === year - 1
        ).length;

        return {
          reportType: "singleYear",
          year: year,
          period: {
            current: {
              start: formatDate(yearStartDate.toISOString())!,
              end: formatDate(yearEndDate.toISOString())!,
            },
            previous: { start: "", end: formatDate(previousYearEndDate.toISOString())! },
          },
          summary: `Balance del ciclo ${year}.`,
          kpis: {
            activeStudents: {
              current: currentMetrics.alumnosActivos.value,
              previous: prevMetrics.alumnosActivos.value,
            },
            studentsWithoutAnyPps: {
              current: currentMetrics.alumnosSinNingunaPPS.value,
              previous: prevMetrics.alumnosSinNingunaPPS.value,
            },
            newStudents: { current: newStudentsCount, previous: prevNewStudentsCount },
            finishedStudents: {
              current: currentMetrics.alumnosFinalizados.value,
              previous: prevMetrics.alumnosFinalizados.value,
            },
            newPpsLaunches: {
              current: currentMetrics.ppsLanzadas.value,
              previous: prevMetrics.ppsLanzadas.value,
            },
            totalOfferedSpots: {
              current: currentMetrics.cuposOfrecidos.value,
              previous: prevMetrics.cuposOfrecidos.value,
            },
            newAgreements: {
              current: currentMetrics.nuevosConvenios.value,
              previous: prevMetrics.nuevosConvenios.value,
            },
          },
          launchesByMonth: currentMetrics.launchesByMonth,
          newAgreementsList: currentMetrics.newAgreementsList,
          newAgreementsDetail: currentMetrics.newAgreementsDetail,
          ppsRequests: currentMetrics.ppsRequests,
        };
      };

      if (selection.mode === "single") {
        return generateSingleYearReport(selection.year);
      }

      // Comparativo entre dos años arbitrarios. Normalizamos para que yearA sea
      // siempre el más antiguo y yearB el más reciente (lectura cronológica).
      const compareYear = selection.compareYear ?? selection.year - 1;
      const yearA = Math.min(selection.year, compareYear);
      const yearB = Math.max(selection.year, compareYear);
      const dataA = generateSingleYearReport(yearA);
      const dataB = generateSingleYearReport(yearB);
      return {
        reportType: "comparative",
        yearA,
        yearB,
        summary: `Comparación de métricas clave entre los ciclos ${yearA} y ${yearB}.`,
        kpis: {
          activeStudents: {
            yearA: dataA.kpis.activeStudents.current,
            yearB: dataB.kpis.activeStudents.current,
          },
          studentsWithoutAnyPps: {
            yearA: dataA.kpis.studentsWithoutAnyPps.current,
            yearB: dataB.kpis.studentsWithoutAnyPps.current,
          },
          finishedStudents: {
            yearA: dataA.kpis.finishedStudents.current,
            yearB: dataB.kpis.finishedStudents.current,
          },
          newStudents: {
            yearA: dataA.kpis.newStudents.current,
            yearB: dataB.kpis.newStudents.current,
          },
          newPpsLaunches: {
            yearA: dataA.kpis.newPpsLaunches.current,
            yearB: dataB.kpis.newPpsLaunches.current,
          },
          totalOfferedSpots: {
            yearA: dataA.kpis.totalOfferedSpots.current,
            yearB: dataB.kpis.totalOfferedSpots.current,
          },
          newAgreements: {
            yearA: dataA.kpis.newAgreements.current,
            yearB: dataB.kpis.newAgreements.current,
          },
        },
        launchesByMonth: {
          yearA: dataA.launchesByMonth,
          yearB: dataB.launchesByMonth,
        },
        newAgreements: {
          yearA: dataA.newAgreementsList,
          yearB: dataB.newAgreementsList,
        },
        newAgreementsDetail: {
          yearA: dataA.newAgreementsDetail,
          yearB: dataB.newAgreementsDetail,
        },
        ppsRequests: {
          yearA: dataA.ppsRequests,
          yearB: dataB.ppsRequests,
        },
      };
    },
    enabled: enabled,
  });
};

export default useExecutiveReportData;
