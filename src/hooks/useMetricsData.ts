
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { 
    TABLE_NAME_ESTUDIANTES, 
    TABLE_NAME_PRACTICAS, 
    TABLE_NAME_CONVOCATORIAS, 
    TABLE_NAME_LANZAMIENTOS_PPS,
    TABLE_NAME_FINALIZACION, 
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_ESTUDIANTE_LINK_PRACTICAS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
    FIELD_ESTUDIANTE_FINALIZACION,
    FIELD_FECHA_SOLICITUD_FINALIZACION,
    FIELD_ESTADO_FINALIZACION,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_FECHA_INICIO_PRACTICAS,
    FIELD_FECHA_FINALIZACION_ESTUDIANTES,
    FIELD_FINALIZARON_ESTUDIANTES,
    FIELD_FECHA_INICIO_CONVOCATORIAS,
    FIELD_NOMBRE_PPS_CONVOCATORIAS
} from '../constants';
import { safeGetId, parseToUTCDate, normalizeStringForComparison, formatDate } from '../utils/formatters';

const getGroupName = (name: string | undefined): string => {
    if (!name) return 'Sin Nombre';
    return name.split(/ [-–] /)[0].trim();
};

const processAllData = (allData: any, targetYear: number) => {
     // --- 1. MAPAS DE REFERENCIA (ID y NOMBRE) ---
     const launchDateMap = new Map<string, Date>();
     const launchNameMap = new Map<string, Date>(); // Mapa auxiliar: Nombre -> Fecha
     const launchInfoMap = new Map<string, any>(); 

     allData.lanzamientos.forEach((l: any) => {
         const date = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
         const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];

         if (date) {
             // 1. Guardar por ID
             launchDateMap.set(l.id, date);
             
             // 2. Guardar por Nombre Normalizado (Para recuperar huérfanos)
             if (name) {
                 const normName = normalizeStringForComparison(name);
                 // Si hay duplicados de nombre, nos quedamos con el primero (o podríamos priorizar el del año actual)
                 if (!launchNameMap.has(normName) || date.getUTCFullYear() === targetYear) {
                     launchNameMap.set(normName, date);
                 }
             }

             // Solo agregamos a la oferta si es del año objetivo
             if (date.getUTCFullYear() === targetYear) {
                launchInfoMap.set(l.id, {
                    name: name,
                    cupos: Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0),
                    orientacion: l[FIELD_ORIENTACION_LANZAMIENTOS],
                    month: date.getUTCMonth()
                });
             }
         }
     });

     // --- 2. PROCESAR BAJAS (Finalizaciones) ---
     const finishedStudentMap = new Map<string, number>();
     
     // A. Desde la tabla finalizaciones (Prioridad)
     allData.finalizaciones.forEach((f: any) => {
         const status = normalizeStringForComparison(f[FIELD_ESTADO_FINALIZACION]);
         if (status === 'cargado' || status === 'finalizada' || status === 'aprobada') {
             const sId = safeGetId(f[FIELD_ESTUDIANTE_FINALIZACION]);
             const dateStr = f[FIELD_FECHA_SOLICITUD_FINALIZACION] || f.created_at;
             
             if (dateStr && sId) {
                 const date = parseToUTCDate(dateStr);
                 // Solo contamos bajas que ocurrieron ESTE año
                 if (date && date.getUTCFullYear() === targetYear) {
                     finishedStudentMap.set(sId, date.getUTCMonth());
                 }
             }
         }
     });

     // B. Desde la tabla estudiantes (Complementario)
     allData.estudiantes.forEach((s: any) => {
         if (s[FIELD_FINALIZARON_ESTUDIANTES] && s[FIELD_FECHA_FINALIZACION_ESTUDIANTES]) {
             const date = parseToUTCDate(s[FIELD_FECHA_FINALIZACION_ESTUDIANTES]);
             if (date && date.getUTCFullYear() === targetYear) {
                 // Si ya existe por la tabla finalizaciones, no lo sobreescribimos
                 if (!finishedStudentMap.has(s.id)) {
                    finishedStudentMap.set(s.id, date.getUTCMonth());
                 }
             }
         }
     });

     // --- 3. PROCESAR ALTAS (Convocatorias) ---
     const activeStudentStartMap = new Map<string, number>();
     const activeStudentSet = new Set<string>();
     
     allData.convocatorias.forEach((c: any) => {
         const estado = normalizeStringForComparison(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]);
         
         // Filtrar estados negativos
         if (['baja', 'rechazado', 'cancelado', 'no seleccionado', 'no se pudo concretar', 'archivado'].includes(estado)) return;

         const sId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
         if (!sId) return;

         // ESTRATEGIA DE RECUPERACIÓN DE FECHA
         let recordDate: Date | null = null;
         
         // 1. Fecha explícita en la convocatoria (si existe)
         if (c[FIELD_FECHA_INICIO_CONVOCATORIAS]) { 
             recordDate = parseToUTCDate(c[FIELD_FECHA_INICIO_CONVOCATORIAS]);
         } 
         
         // 2. Si no, buscamos por ID de Lanzamiento (Vínculo fuerte)
         if (!recordDate) {
             const rawLanzId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
             const lanzId = Array.isArray(rawLanzId) ? rawLanzId[0] : rawLanzId;
             if (lanzId && typeof lanzId === 'string') {
                 recordDate = launchDateMap.get(lanzId) || null;
             }
         }

         // 3. RECUPERACIÓN INTELIGENTE: Si no hay ID, buscamos por Nombre (Vínculo débil)
         // Esto arregla los registros huérfanos que tienen nombre pero perdieron el ID
         if (!recordDate) {
             const ppsName = c[FIELD_NOMBRE_PPS_CONVOCATORIAS];
             if (ppsName) {
                 const normName = normalizeStringForComparison(ppsName);
                 recordDate = launchNameMap.get(normName) || null;
             }
         }

         // 4. Fallback final: Fecha de creación (solo si es razonable, ej: no hoy para datos viejos)
         // Omitimos fallback a created_at para métricas históricas si no tenemos certeza, 
         // para no ensuciar el mes actual con datos viejos.

         // Solo procesar si logramos obtener una fecha válida y es del año objetivo
         if (recordDate && recordDate.getUTCFullYear() === targetYear) {
             const month = recordDate.getUTCMonth();
             activeStudentSet.add(sId);
             
             // Si el estudiante tiene múltiples altas, nos quedamos con la primera del año
             if (!activeStudentStartMap.has(sId) || month < activeStudentStartMap.get(sId)!) {
                 activeStudentStartMap.set(sId, month);
             }
         }
     });

     // --- 4. LISTAS ---
     const activeStudentsList = allData.estudiantes.filter((s: any) => activeStudentStartMap.has(s.id));

     const finalizedList = allData.estudiantes.filter((s: any) => finishedStudentMap.has(s.id)).map((s:any) => ({
         ...s,
         fechaFin: formatDate(new Date(targetYear, finishedStudentMap.get(s.id)!, 1).toISOString())
     }));

     // --- 5. ALUMNOS EN PPS vs SIN PPS ---
     const studentsWithPracticeRecord = new Set<string>();
     
     // Chequear Prácticas activas
     allData.practicas.forEach((p: any) => {
         const sId = safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
         if (!sId) return;

         const status = normalizeStringForComparison(p['estado']);
         const isOngoing = status === 'en curso' || status === 'en proceso';
         
         let pDate = parseToUTCDate(p[FIELD_FECHA_INICIO_PRACTICAS]);
         if (!pDate) {
             // Fallback ID
             const rawLId = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
             const lId = Array.isArray(rawLId) ? rawLId[0] : rawLId;
             pDate = typeof lId === 'string' ? launchDateMap.get(lId) || null : null;
         }
         // Fallback Nombre para Prácticas Huérfanas
         if (!pDate) {
             const pName = p['nombre_institucion']; // Usar nombre lookup si existe
             if (pName) {
                 pDate = launchNameMap.get(normalizeStringForComparison(pName)) || null;
             }
         }

         if (isOngoing || (pDate && pDate.getUTCFullYear() === targetYear)) {
             studentsWithPracticeRecord.add(sId);
         }
     });

     // Chequear Convocatorias activas (Seleccionados sin práctica formal aún)
     allData.convocatorias.forEach((c: any) => {
         const estado = normalizeStringForComparison(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]);
         const sId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
         
         if (sId && activeStudentSet.has(sId) && (estado === 'seleccionado' || estado === 'asignado')) {
             studentsWithPracticeRecord.add(sId);
         }
     });

     const enPpsList = activeStudentsList.filter((s: any) => studentsWithPracticeRecord.has(s.id));
     const sinPpsList = activeStudentsList.filter((s: any) => !studentsWithPracticeRecord.has(s.id));

     // --- 6. OFERTA ---
     const ppsLaunchedSet = new Set<string>();
     const ppsListForModal: any[] = [];
     let totalCupos = 0;

     launchInfoMap.forEach((info) => {
         const groupName = getGroupName(info.name);
         // Clave compuesta para no duplicar si hay varias comisiones del mismo lugar en el mismo mes
         const key = `${normalizeStringForComparison(groupName)}_${info.month}`;
         
         totalCupos += info.cupos;
         
         // Agregamos a la lista visual solo si no está repetido el nombre+mes
         if (!ppsLaunchedSet.has(key)) {
             ppsLaunchedSet.add(key);
             ppsListForModal.push({
                 nombre: groupName,
                 legajo: info.orientacion || 'General',
                 cupos: info.cupos
             });
         }
     });

     const rawStudentsForChart = activeStudentsList.map((s: any) => ({
         ...s,
         startMonth: activeStudentStartMap.get(s.id) ?? 0,
         endMonth: finishedStudentMap.get(s.id) 
     }));

     return {
        alumnosActivos: { value: activeStudentsList.length, list: activeStudentsList },
        alumnosFinalizados: { value: finalizedList.length, list: finalizedList },
        alumnosEnPPS: { value: enPpsList.length, list: enPpsList }, 
        alumnosActivosSinPpsEsteAno: { value: sinPpsList.length, list: sinPpsList },
        
        ppsLanzadas: { value: ppsLaunchedSet.size, list: ppsListForModal },
        cuposOfrecidos: { value: totalCupos, list: [] },
        activeInstitutions: { value: ppsLaunchedSet.size, list: [] },
        
        lanzamientosMesActual: [], 
        rawStudents: rawStudentsForChart
    };
};

export const useMetricsData = ({ targetYear, isTestingMode = false }: { targetYear: number; isTestingMode?: boolean; }) => {
    return useQuery({
        queryKey: ['metricsData', targetYear, isTestingMode],
        queryFn: async () => {
            const [est, prac, lanz, conv, fin] = await Promise.all([
                supabase.from(TABLE_NAME_ESTUDIANTES).select('*'),
                supabase.from(TABLE_NAME_PRACTICAS).select('*'),
                supabase.from(TABLE_NAME_LANZAMIENTOS_PPS).select('*'),
                supabase.from(TABLE_NAME_CONVOCATORIAS).select('*'),
                supabase.from(TABLE_NAME_FINALIZACION).select('*')
            ]);
            
            const rawData = { 
                estudiantes: est.data || [], 
                practicas: prac.data || [], 
                lanzamientos: lanz.data || [], 
                convocatorias: conv.data || [], 
                finalizaciones: fin.data || []
            };
            
            return processAllData(rawData, targetYear);
        },
        staleTime: 1000 * 60 * 5,
    });
};
