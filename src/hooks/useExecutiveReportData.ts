
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

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
    TABLE_NAME_PPS,
    FIELD_SOLICITUD_NOMBRE_ALUMNO,
    FIELD_SOLICITUD_LEGAJO_ALUMNO,
    FIELD_EMPRESA_PPS_SOLICITUD,
    FIELD_ESTADO_PPS,
    FIELD_LEGAJO_PPS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_ESTADO_ESTUDIANTES
} from '../constants';
import {
    AnyReportData,
    ExecutiveReportData,
    PPSRequestSummary,
    ReportType,
    TimelineMonthData
} from '../types';
import { safeGetId, parseToUTCDate, formatDate } from '../utils/formatters';

const getGroupName = (name: string | undefined): string => {
    if (!name) return 'Sin Nombre';
    return name.split(/ [-–] /)[0].trim();
};

const cleanRawValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.replace(/[\[\]"]/g, '').trim();
};

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const processRequestsForYear = (targetYear: number, requests: any[], students: any[]): PPSRequestSummary[] => {
    const studentMap = new Map(students.map((s: any) => [s.id, s]));

    return requests
        .filter((r: any) => {
            const dateStr = r.created_at;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            return date.getFullYear() === targetYear;
        })
        .map((r: any) => {
            const sId = safeGetId(r[FIELD_LEGAJO_PPS]);
            const student = sId ? studentMap.get(sId) : null;

            const studentName = student?.[FIELD_NOMBRE_ESTUDIANTES] || cleanRawValue(r[FIELD_SOLICITUD_NOMBRE_ALUMNO]) || 'Desconocido';
            const studentLegajo = student?.[FIELD_LEGAJO_ESTUDIANTES] || cleanRawValue(r[FIELD_SOLICITUD_LEGAJO_ALUMNO]) || '---';
            const institutionName = cleanRawValue(r[FIELD_EMPRESA_PPS_SOLICITUD]) || 'Institución desconocida';
            const status = r[FIELD_ESTADO_PPS] || 'Pendiente';

            return {
                id: String(r.id),
                studentName: String(studentName),
                studentLegajo: String(studentLegajo),
                institutionName: String(institutionName),
                requestDate: formatDate(r.created_at),
                status: String(status)
            };
        });
};

const processAllData = (allData: any, targetYear: number) => {
    // 1. IDENTIFICAR LANZAMIENTOS DEL AÑO OBJETIVO
    const launchesInTargetYear = allData.lanzamientos.filter((l: any) => {
        const date = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
        return date && date.getUTCFullYear() === targetYear;
    });

    const launchIdsInYear = new Set<string>(launchesInTargetYear.map((l: any) => l.id));

    // 2. IDENTIFICAR ESTUDIANTES ACTIVOS
    const activeStudentIds = new Set<string>();

    allData.convocatorias.forEach((c: any) => {
        const rawLanzId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
        const lanzId = Array.isArray(rawLanzId) ? rawLanzId[0] : rawLanzId;

        if (lanzId && launchIdsInYear.has(lanzId)) {
            const sId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
            if (sId) activeStudentIds.add(sId);
        }
    });

    const activeList = allData.estudiantes.filter((s: any) => {
        // Excluir finalizados usando la nueva lógica de 'estado'
        if (s[FIELD_ESTADO_ESTUDIANTES] === 'Finalizado') return false;
        return activeStudentIds.has(s.id);
    });

    // 3. ALUMNOS FINALIZADOS
    const finishedList = allData.finalizaciones.filter((f: any) => {
        const dateStr = f[FIELD_FECHA_SOLICITUD_FINALIZACION] || f.created_at;
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return !isNaN(date.getTime()) && date.getFullYear() === targetYear;
    }).map((f: any) => {
        const sId = safeGetId(f[FIELD_ESTUDIANTE_FINALIZACION]);
        const student = allData.estudiantes.find((s: any) => s.id === sId);
        return student || { nombre: 'Estudiante Finalizado', legajo: '---' };
    });

    // 4. ESTUDIANTES ACTIVOS SIN PPS
    const studentsWithPracticeIds = new Set<string>();
    allData.practicas.forEach((p: any) => {
        const link = safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
        if (link) studentsWithPracticeIds.add(link);
    });

    const activeWithoutPpsList = activeList.filter((s: any) => !studentsWithPracticeIds.has(s.id));

    // 5. METRICAS DE LANZAMIENTOS
    const totalCupos = launchesInTargetYear.reduce((sum: number, l: any) => sum + (Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]) || 0), 0);

    const uniqueLaunchesSet = new Set<string>();
    const ppsLaunchedList: any[] = [];
    const monthlyData: { [key: number]: { cuposTotal: number; institutions: Map<string, { cupos: number; variants: string[] }>; } } = {};

    launchesInTargetYear.forEach((launch: any) => {
        const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
        if (ppsName) {
            const groupName = getGroupName(ppsName);
            const date = parseToUTCDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            const monthIndex = date ? date.getUTCMonth() : -1;
            const cupos = Number(launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);

            if (monthIndex >= 0) {
                uniqueLaunchesSet.add(`${groupName}::${monthIndex}`);

                if (!monthlyData[monthIndex]) {
                    monthlyData[monthIndex] = { cuposTotal: 0, institutions: new Map() };
                }
                monthlyData[monthIndex].cuposTotal += cupos;

                const institutionData = monthlyData[monthIndex].institutions.get(groupName) || { cupos: 0, variants: [] };
                institutionData.cupos += cupos;
                institutionData.variants.push(ppsName);
                monthlyData[monthIndex].institutions.set(groupName, institutionData);
            }

            if (!ppsLaunchedList.find((i: any) => i.nombre === groupName)) {
                ppsLaunchedList.push({
                    nombre: groupName,
                    legajo: 'Varias Comisiones',
                    cupos: 0
                });
            }
        }
    });

    const ppsLanzadasValue = uniqueLaunchesSet.size;

    const launchesByMonth: TimelineMonthData[] = MONTH_NAMES.map((monthName, index) => {
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
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name)),
            };
        }
        return null;
    }).filter((item): item is TimelineMonthData => item !== null);

    const uniqueInstitutionsNames = new Set<string>();
    launchesInTargetYear.forEach((l: any) => {
        const name = getGroupName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
        uniqueInstitutionsNames.add(name);
    });
    const activeInstitutionsCount = uniqueInstitutionsNames.size;
    const activeInstitutionsList = Array.from(uniqueInstitutionsNames).map(name => ({ nombre: name, legajo: 'Activa', cupos: 'N/A' }));

    // UPDATE: Filter new agreements strictly by Institution Table and Year
    const newAgreementsList = allData.instituciones
        .filter((i: any) => String(i[FIELD_CONVENIO_NUEVO_INSTITUCIONES]) === String(targetYear))
        .map((i: any) => ({ nombre: i[FIELD_NOMBRE_INSTITUCIONES] }));

    const ppsRequests = processRequestsForYear(targetYear, allData.solicitudes, allData.estudiantes);

    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentMonthLaunches: any[] = [];
    if (monthlyData[currentMonth]) {
        monthlyData[currentMonth].institutions.forEach((val, key) => {
            currentMonthLaunches.push({ groupName: key, totalCupos: val.cupos, variants: val.variants.map(v => ({ name: v, cupos: 'N/A' })) });
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
        newAgreementsList: newAgreementsList.map((i: any) => i.nombre),
        ppsRequests
    };
};

const fetchAllDataForReport = async () => {
    const [est, prac, lanz, conv, fin, inst, req] = await Promise.all([
        supabase.from(TABLE_NAME_ESTUDIANTES).select('*'),
        supabase.from(TABLE_NAME_PRACTICAS).select('*'),
        supabase.from(TABLE_NAME_LANZAMIENTOS_PPS).select('*'),
        supabase.from(TABLE_NAME_CONVOCATORIAS).select('*'),
        supabase.from(TABLE_NAME_FINALIZACION).select('*'),
        supabase.from(TABLE_NAME_INSTITUCIONES).select('*'),
        supabase.from(TABLE_NAME_PPS).select('*')
    ]);

    return {
        estudiantes: est.data || [],
        practicas: prac.data || [],
        lanzamientos: lanz.data || [],
        convocatorias: conv.data || [],
        finalizaciones: fin.data || [],
        instituciones: inst.data || [],
        solicitudes: req.data || []
    };
};

export const useExecutiveReportData = ({ reportType, enabled = false, isTestingMode = false }: { reportType: ReportType | null; enabled?: boolean; isTestingMode?: boolean; }) => {
    return useQuery<AnyReportData, Error>({
        queryKey: ['executiveReportData', reportType, isTestingMode],
        queryFn: async () => {
            if (isTestingMode) return {} as any;
            if (!reportType) throw new Error("A report type must be selected.");

            const allData = await fetchAllDataForReport();

            const generateSingleYearReport = (year: number): ExecutiveReportData => {
                const currentMetrics = processAllData(allData, year);
                const prevMetrics = processAllData(allData, year - 1);

                const yearStartDate = new Date(Date.UTC(year, 0, 1));
                const yearEndDate = new Date(Date.UTC(year + 1, 0, 1));
                yearEndDate.setUTCDate(yearEndDate.getUTCDate() - 1);
                const previousYearEndDate = new Date(Date.UTC(year, 0, 1));
                previousYearEndDate.setUTCDate(previousYearEndDate.getUTCDate() - 1);

                const newStudentsCount = allData.estudiantes.filter((s: any) => {
                    const d = new Date(s.created_at);
                    return d.getFullYear() === year;
                }).length;

                return {
                    reportType: 'singleYear',
                    year: year,
                    period: {
                        current: { start: formatDate(yearStartDate.toISOString())!, end: formatDate(yearEndDate.toISOString())! },
                        previous: { start: '', end: formatDate(previousYearEndDate.toISOString())! },
                    },
                    summary: `Balance del ciclo ${year}.`,
                    kpis: {
                        activeStudents: { current: currentMetrics.alumnosActivos.value, previous: prevMetrics.alumnosActivos.value },
                        studentsWithoutAnyPps: { current: currentMetrics.alumnosSinNingunaPPS.value, previous: prevMetrics.alumnosSinNingunaPPS.value },
                        newStudents: { current: newStudentsCount, previous: 0 },
                        finishedStudents: { current: currentMetrics.alumnosFinalizados.value, previous: prevMetrics.alumnosFinalizados.value },
                        newPpsLaunches: { current: currentMetrics.ppsLanzadas.value, previous: prevMetrics.ppsLanzadas.value },
                        totalOfferedSpots: { current: currentMetrics.cuposOfrecidos.value, previous: prevMetrics.cuposOfrecidos.value },
                        newAgreements: { current: currentMetrics.nuevosConvenios.value, previous: prevMetrics.nuevosConvenios.value },
                    },
                    launchesByMonth: currentMetrics.launchesByMonth,
                    newAgreementsList: currentMetrics.newAgreementsList,
                    ppsRequests: currentMetrics.ppsRequests,
                };
            };

            if (reportType === '2024' || reportType === '2025') {
                return generateSingleYearReport(parseInt(reportType, 10));
            }

            if (reportType === 'comparative') {
                const data2024 = generateSingleYearReport(2024);
                const data2025 = generateSingleYearReport(2025);
                return {
                    reportType: 'comparative',
                    summary: `Comparación de métricas clave entre los ciclos 2024 y 2025.`,
                    kpis: {
                        activeStudents: { year2024: data2024.kpis.activeStudents.current, year2025: data2025.kpis.activeStudents.current },
                        studentsWithoutAnyPps: { year2024: data2024.kpis.studentsWithoutAnyPps.current, year2025: data2025.kpis.studentsWithoutAnyPps.current },
                        finishedStudents: { year2024: data2024.kpis.finishedStudents.current, year2025: data2025.kpis.finishedStudents.current },
                        newStudents: { year2024: data2024.kpis.newStudents.current, year2025: data2025.kpis.newStudents.current },
                        newPpsLaunches: { year2024: data2024.kpis.newPpsLaunches.current, year2025: data2025.kpis.newPpsLaunches.current },
                        totalOfferedSpots: { year2024: data2024.kpis.totalOfferedSpots.current, year2025: data2025.kpis.totalOfferedSpots.current },
                        newAgreements: { year2024: data2024.kpis.newAgreements.current, year2025: data2025.kpis.newAgreements.current },
                    },
                    launchesByMonth: {
                        year2024: data2024.launchesByMonth,
                        year2025: data2025.launchesByMonth,
                    },
                    newAgreements: {
                        year2024: data2024.newAgreementsList,
                        year2025: data2025.newAgreementsList,
                    },
                    ppsRequests: {
                        year2024: data2024.ppsRequests,
                        year2025: data2025.ppsRequests
                    }
                };
            }
            throw new Error(`Invalid report type: ${reportType}`);
        },
        enabled: enabled,
    });
};

export default useExecutiveReportData;
