
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
    FIELD_ESTADO_PRACTICA
} from '../constants';
import { parseToUTCDate, safeGetId, normalizeStringForComparison } from './formatters';
import { differenceInDays, isSameMonth } from 'date-fns';

const getGroupName = (name: string | undefined): string => {
    if (!name) return 'Sin Nombre';
    return name.split(/ [-–] /)[0].trim();
};

export const calculateDashboardMetrics = (allData: any, targetYear: number) => {
    const isCurrentYear = targetYear === new Date().getFullYear();
    const now = new Date();

    // --- 0. MAPEO DE FECHAS CLAVE POR ESTUDIANTE ---
    // studentId -> { firstActivityDate: Date, graduationDate: Date | null }
    const studentTimelineMap = new Map<string, { firstActivity: Date, graduation: Date | null }>();

    // Helper para actualizar la fecha mínima de actividad (Ingreso real al sistema)
    const updateFirstActivity = (studentId: string, dateStr: string) => {
        if (!studentId || !dateStr) return;
        const date = parseToUTCDate(dateStr);
        if (!date) return;

        const current = studentTimelineMap.get(studentId) || { firstActivity: new Date(9999, 11, 31), graduation: null };
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
        if (s[FIELD_ESTADO_ESTUDIANTES] === 'Finalizado' && s[FIELD_FECHA_FINALIZACION_ESTUDIANTES]) {
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

    // --- 2. CÁLCULO DE EVOLUCIÓN MENSUAL (Active Enrollment Trend) ---
    const trendData: { month: string; value: number }[] = [];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonthIndex = isCurrentYear ? now.getMonth() : 11;

    // Calcular BASELINE: Estudiantes activos al 31 de Diciembre del año anterior
    const startOfTargetYear = new Date(targetYear, 0, 1); // 1 Enero

    let activeCounter = 0;

    // Contamos iniciales: Aquellos que entraron ANTES de este año y (no se graduaron O se graduaron DESPUÉS del inicio de este año)
    studentTimelineMap.forEach((timeline, _) => {
        if (timeline.firstActivity < startOfTargetYear) {
            if (!timeline.graduation || timeline.graduation >= startOfTargetYear) {
                activeCounter++;
            }
        }
    });

    // Generar puntos mes a mes acumulativos
    months.forEach((monthName, index) => {
        if (index > currentMonthIndex) return;

        const monthStart = new Date(targetYear, index, 1);

        // Sumar NUEVOS de este mes
        let newInMonth = 0;
        // Restar GRADUADOS de este mes
        let graduatedInMonth = 0;

        studentTimelineMap.forEach((timeline, _) => {
            // Es nuevo si su primera actividad fue este mes
            if (isSameMonth(timeline.firstActivity, monthStart) && timeline.firstActivity.getUTCFullYear() === targetYear) {
                newInMonth++;
            }
            // Se fue si se graduó este mes
            if (timeline.graduation && isSameMonth(timeline.graduation, monthStart) && timeline.graduation.getUTCFullYear() === targetYear) {
                graduatedInMonth++;
            }
        });

        activeCounter = activeCounter + newInMonth - graduatedInMonth;
        trendData.push({ month: monthName, value: activeCounter });
    });


    // --- 3. LISTAS AUXILIARES ---

    // Alumnos Acreditados (Finalizados en el año objetivo)
    const acreditadosList = allData.estudiantes.filter((s: any) => {
        const timeline = studentTimelineMap.get(s.id);
        return timeline?.graduation && timeline.graduation.getUTCFullYear() === targetYear;
    });

    // Alumnos Activos HOY (Snapshot) o al final del año objetivo
    const activosList = allData.estudiantes.filter((s: any) => {
        const timeline = studentTimelineMap.get(s.id);
        if (!timeline) return false; // Sin actividad no cuenta

        const startedBeforeOrDuring = timeline.firstActivity.getUTCFullYear() <= targetYear;
        const notGraduatedOrGraduatedAfter = !timeline.graduation || timeline.graduation.getUTCFullYear() > targetYear;

        return startedBeforeOrDuring && notGraduatedOrGraduatedAfter;
    });

    const totalMatriculaGenerada = activosList.length + acreditadosList.length;

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
            if (status === 'en curso' || status === 'pendiente' || status === 'en proceso') {
                studentActivePracticesMap.set(sId, true);
            }
        }
    });

    const sinNingunaPpsList = activosList.filter((s: any) => !studentTimelineMap.has(s.id)); // Estricto: sin actividad registrada

    const proximosAFinalizarList = activosList.filter((s: any) => {
        const totalHours = studentHoursMap.get(s.id) || 0;
        const hasActive = studentActivePracticesMap.get(s.id);
        if (totalHours >= 230 && totalHours < 250) return true;
        if (totalHours >= 250 && hasActive) return true;
        return false;
    });

    const enPpsEnCursoList = activosList.filter((s: any) => studentActivePracticesMap.get(s.id));

    // --- 4. DISTRIBUCIÓN POR ÁREA ---
    interface OccupancyEntry { nombre: string; legajo: string; institucion: string; raw_value: string; }
    const occupancyByOrientation: Record<string, OccupancyEntry[]> = {
        'Clinica': [], 'Educacional': [], 'Laboral': [], 'Comunitaria': [], 'Sin definir': []
    };

    const launchesMap = new Map(allData.lanzamientos.map((l: any) => [l.id, l]));

    allData.convocatorias.forEach((c: any) => {
        const date = parseToUTCDate(c.created_at || c.fecha_inicio);
        if (!date || date.getUTCFullYear() !== targetYear) return;
        if (normalizeStringForComparison(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) !== 'seleccionado') return;

        const rawLanzId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
        const lanzId = Array.isArray(rawLanzId) ? rawLanzId[0] : rawLanzId;
        const launch = launchesMap.get(lanzId);
        const studentId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
        const student = allData.estudiantes.find((s: any) => s.id === studentId);

        const studentEntry: OccupancyEntry = {
            nombre: student?.nombre || 'Estudiante',
            legajo: student?.legajo || '---',
            institucion: (launch as any)?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] || 'N/A',
            raw_value: (launch as any)?.[FIELD_ORIENTACION_LANZAMIENTOS] || '(Vacio)'
        };

        const normalized = normalizeStringForComparison((launch as any)?.[FIELD_ORIENTACION_LANZAMIENTOS]);
        if (normalized.includes('clinica')) occupancyByOrientation['Clinica'].push(studentEntry);
        else if (normalized.includes('educacional') || normalized.includes('educacion')) occupancyByOrientation['Educacional'].push(studentEntry);
        else if (normalized.includes('laboral') || normalized.includes('trabajo')) occupancyByOrientation['Laboral'].push(studentEntry);
        else if (normalized.includes('comunitaria') || normalized.includes('comunidad')) occupancyByOrientation['Comunitaria'].push(studentEntry);
        else occupancyByOrientation['Sin definir'].push(studentEntry);
    });

    // --- 5. DATOS DE INSTITUCIONES ---
    const yearLaunches = allData.lanzamientos.filter((l: any) => parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS])?.getUTCFullYear() === targetYear);
    const totalCupos = yearLaunches.reduce((sum: number, l: any) => sum + (l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0), 0);

    const uniqueActiveNames = new Set<string>();
    yearLaunches.forEach((l: any) => {
        if (l[FIELD_NOMBRE_PPS_LANZAMIENTOS]) {
            uniqueActiveNames.add(getGroupName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS]));
        }
    });
    const activeInstitutionsList = Array.from(uniqueActiveNames).map(name => ({ nombre: name, legajo: 'Activa' }));

    const uniqueNewAgreementNames = new Set<string>();
    allData.instituciones.forEach((i: any) => {
        const convenioVal = i[FIELD_CONVENIO_NUEVO_INSTITUCIONES];
        if (String(convenioVal) === String(targetYear) && i[FIELD_NOMBRE_INSTITUCIONES]) {
            uniqueNewAgreementNames.add(getGroupName(i[FIELD_NOMBRE_INSTITUCIONES]));
        }
    });
    const nuevosConveniosList = Array.from(uniqueNewAgreementNames).map(name => ({ nombre: name, legajo: 'Confirmado' }));

    // --- 6. GESTIÓN Y SEGUIMIENTO ---
    const terminalStatuses = ['finalizada', 'cancelada', 'rechazada', 'archivado', 'realizada', 'no se pudo concretar'];

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

    const acreditacionesPendientesList = allData.finalizaciones.filter((f: any) => f[FIELD_ESTADO_FINALIZACION] === 'Pendiente');

    // --- 7. GRÁFICOS HISTÓRICOS (INGRESANTES) ---
    const getIngresantesCount = (year: number) => {
        let count = 0;
        studentTimelineMap.forEach(timeline => {
            if (timeline.firstActivity.getUTCFullYear() === year) count++;
        });
        return count;
    };

    // Nota: 2024 y 2025 se calculan dinámicamente según la lógica de "Primera Actividad"
    const enrollmentEvolution = [
        { year: '2022', value: 19, label: 'Nuevos Inscriptos' },
        { year: '2023', value: 87, label: 'Nuevos Inscriptos' },
        { year: '2024', value: getIngresantesCount(2024), label: 'Nuevos Inscriptos' },
        { year: '2025', value: getIngresantesCount(2025), label: 'Nuevos Inscriptos' },
        { year: '2026', value: 116, label: 'Proyeccion Ingresantes', isProjection: true }
    ];

    return {
        // Resumen General
        matriculaGenerada: { value: totalMatriculaGenerada, list: [...activosList, ...acreditadosList] },
        alumnosFinalizados: { value: acreditadosList.length, list: acreditadosList },
        matriculaActiva: { value: activosList.length, list: activosList },
        solicitudesGestion: { value: solicitudesEnCursoList.length, list: solicitudesEnCursoList },

        // Pestaña Estudiantes
        nuevosIngresantes: { value: ingresantesList.length, list: ingresantesList },
        alumnosSinPPS: { value: sinNingunaPpsList.length, list: sinNingunaPpsList },
        proximosAFinalizar: { value: proximosAFinalizarList.length, list: proximosAFinalizarList },
        haciendoPPS: { value: enPpsEnCursoList.length, list: enPpsEnCursoList },

        // Pestaña Instituciones
        ppsLanzadas: { value: yearLaunches.length, list: yearLaunches },
        cuposOfrecidos: { value: totalCupos, list: [] },
        conveniosNuevos: { value: uniqueNewAgreementNames.size, list: nuevosConveniosList },
        institucionesActivas: { value: uniqueActiveNames.size, list: activeInstitutionsList },

        // Tablas y Gráficos
        alumnosDemorados: { value: demoradosList.length, list: demoradosList },
        acreditacionesPendientes: { value: acreditacionesPendientesList.length, list: acreditacionesPendientesList },
        occupancyDistribution: occupancyByOrientation,
        enrollmentEvolution,
        trendData
    };
};
