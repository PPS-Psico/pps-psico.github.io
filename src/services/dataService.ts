
import { db } from '../lib/db';
import { supabase } from '../lib/supabaseClient';
import {
  Practica, SolicitudPPS, LanzamientoPPS, Convocatoria,
  GroupedSeleccionados,
  FinalizacionPPS,
  Estudiante,
  InformeCorreccionPPS
} from '../types';
import * as C from '../constants';
import { normalizeStringForComparison, safeGetId, cleanInstitutionName, cleanDbValue } from '../utils/formatters';

export const fetchStudentData = async (legajo: string): Promise<{ studentDetails: Estudiante | null; studentAirtableId: string | null; }> => {
  const { data, error } = await supabase
      .from(C.TABLE_NAME_ESTUDIANTES)
      .select('*')
      .eq(C.FIELD_LEGAJO_ESTUDIANTES, legajo)
      .maybeSingle();
  
  if (error || !data) {
      console.warn("Estudiante no encontrado por legajo:", legajo);
      return { studentDetails: null, studentAirtableId: null };
  }

  return { studentDetails: data, studentAirtableId: data.id };
};

export const fetchPracticas = async (legajo: string): Promise<Practica[]> => {
  const { studentAirtableId } = await fetchStudentData(legajo);
  if (!studentAirtableId) return [];

  const { data, error } = await supabase
      .from(C.TABLE_NAME_PRACTICAS)
      .select(`
          *,
          lanzamiento:lanzamientos_pps!fk_practica_lanzamiento (
              nombre_pps,
              orientacion,
              fecha_inicio,
              fecha_finalizacion
          )
      `)
      .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentAirtableId);

  if (error || !data) {
      console.error("Error fetching practicas:", error);
      return [];
  }

  return data.map((row: any) => {
      const lanzamiento = Array.isArray(row.lanzamiento) ? row.lanzamiento[0] : row.lanzamiento;
      
      const rawName = row[C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] || lanzamiento?.nombre_pps || 'Institución desconocida';
      const finalName = cleanDbValue(rawName);
      
      if (!row[C.FIELD_FECHA_INICIO_PRACTICAS] && lanzamiento?.fecha_inicio) {
          row[C.FIELD_FECHA_INICIO_PRACTICAS] = lanzamiento.fecha_inicio;
      }
      if (!row[C.FIELD_FECHA_FIN_PRACTICAS] && lanzamiento?.fecha_finalizacion) {
          row[C.FIELD_FECHA_FIN_PRACTICAS] = lanzamiento.fecha_finalizacion;
      }
      if (!row[C.FIELD_ESPECIALIDAD_PRACTICAS] && lanzamiento?.orientacion) {
          row[C.FIELD_ESPECIALIDAD_PRACTICAS] = lanzamiento.orientacion;
      }

      return {
          ...row,
          [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: finalName,
      } as Practica;
  });
};

export const fetchSolicitudes = async (legajo: string, studentAirtableId: string | null): Promise<SolicitudPPS[]> => {
  let targetId = studentAirtableId;
  if (!targetId) {
       const { studentAirtableId: fetchedId } = await fetchStudentData(legajo);
       targetId = fetchedId;
  }
  if (!targetId) return [];

  const { data, error } = await supabase
      .from(C.TABLE_NAME_PPS)
      .select(`
          *,
          estudiante:estudiantes!fk_solicitud_estudiante (
            nombre, legajo, correo
          )
      `)
      .eq(C.FIELD_LEGAJO_PPS, targetId)
      .order('created_at', { ascending: false });

  if (error || !data) {
      console.error("Error fetching solicitudes:", error);
      return [];
  }
  
  const mappedRecords = data.map((r: any) => {
      const student = Array.isArray(r.estudiante) ? r.estudiante[0] : r.estudiante;
      return {
          ...r,
          [C.FIELD_SOLICITUD_NOMBRE_ALUMNO]: student?.nombre || r[C.FIELD_SOLICITUD_NOMBRE_ALUMNO] || 'Estudiante',
          [C.FIELD_SOLICITUD_LEGAJO_ALUMNO]: student?.legajo || r[C.FIELD_SOLICITUD_LEGAJO_ALUMNO],
          [C.FIELD_SOLICITUD_EMAIL_ALUMNO]: student?.correo || r[C.FIELD_SOLICITUD_EMAIL_ALUMNO]
      };
  });

  return mappedRecords.filter(r => r[C.FIELD_ESTADO_PPS] !== 'Archivado') as SolicitudPPS[];
};

export const fetchFinalizacionRequest = async (legajo: string, studentAirtableId: string | null): Promise<FinalizacionPPS | null> => {
  try {
      let targetId = studentAirtableId;
      if (!targetId) {
           const { studentAirtableId: fetchedId } = await fetchStudentData(legajo);
           targetId = fetchedId;
      }
      if (!targetId) return null;

      const records = await db.finalizacion.get({
          filters: { [C.FIELD_ESTUDIANTE_FINALIZACION]: targetId },
          sort: [{ field: 'created_at', direction: 'desc' }],
          maxRecords: 1
      });
          
      if (!records || records.length === 0) return null;
      return records[0];
  } catch (error) {
      console.warn("Suppressing error in fetchFinalizacionRequest:", error);
      return null;
  }
}

export const fetchConvocatoriasData = async (legajo: string, studentAirtableId: string | null, isSuperUserMode: boolean): Promise<{
    lanzamientos: LanzamientoPPS[],
    myEnrollments: Convocatoria[],
    allLanzamientos: LanzamientoPPS[],
    institutionAddressMap: Map<string, string>,
}> => {
    
  let myEnrollments: Convocatoria[] = [];
  const enrolledLaunchIds = new Set<string>();

  if (studentAirtableId) {
      const enrollments = await db.convocatorias.getAll({
          filters: { [C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentAirtableId }
      });
      myEnrollments = enrollments;

      myEnrollments.forEach(e => {
          const lid = e[C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
          if (lid) {
             if (Array.isArray(lid)) lid.forEach((id: string) => enrolledLaunchIds.add(id));
             else enrolledLaunchIds.add(lid as string);
          }
      });
  }

  const openLaunches = await db.lanzamientos.getAll({
      filters: { 
        [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: ['Abierta', 'Abierto', 'Cerrado'] 
      },
      sort: [{ field: C.FIELD_FECHA_INICIO_LANZAMIENTOS, direction: 'desc' }]
  });

  const openLaunchIds = new Set(openLaunches.map(l => l.id));
  const missingLaunchIds = Array.from(enrolledLaunchIds).filter(id => !openLaunchIds.has(id));

  let historicalLaunches: LanzamientoPPS[] = [];
  if (missingLaunchIds.length > 0) {
      historicalLaunches = await db.lanzamientos.getAll({
          filters: { id: missingLaunchIds }
      });
  }

  const allRawLanzamientos = [...openLaunches, ...historicalLaunches];
  const launchesMap = new Map(allRawLanzamientos.map(l => [l.id, l]));

  const hydratedEnrollments = myEnrollments.map(row => {
      const launchId = row[C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
      const launch = launchId ? (Array.isArray(launchId) ? launchesMap.get(launchId[0]) : launchesMap.get(launchId)) : null;
      
      return {
          ...row,
          [C.FIELD_NOMBRE_PPS_CONVOCATORIAS]: cleanInstitutionName(row[C.FIELD_NOMBRE_PPS_CONVOCATORIAS] || launch?.[C.FIELD_NOMBRE_PPS_LANZAMIENTOS]),
          [C.FIELD_FECHA_INICIO_CONVOCATORIAS]: row[C.FIELD_FECHA_INICIO_CONVOCATORIAS] || launch?.[C.FIELD_FECHA_INICIO_LANZAMIENTOS],
          [C.FIELD_FECHA_FIN_CONVOCATORIAS]: row[C.FIELD_FECHA_FIN_CONVOCATORIAS] || launch?.[C.FIELD_FECHA_FIN_LANZAMIENTOS],
          [C.FIELD_DIRECCION_CONVOCATORIAS]: row[C.FIELD_DIRECCION_CONVOCATORIAS] || launch?.[C.FIELD_DIRECCION_LANZAMIENTOS],
          [C.FIELD_ORIENTACION_CONVOCATORIAS]: row[C.FIELD_ORIENTACION_CONVOCATORIAS] || launch?.[C.FIELD_ORIENTACION_LANZAMIENTOS],
          [C.FIELD_HORAS_ACREDITADAS_CONVOCATORIAS]: row[C.FIELD_HORAS_ACREDITADAS_CONVOCATORIAS] || launch?.[C.FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]
      } as Convocatoria;
  });

  // CLEAN LAUNCHES FOR UI: Clean the name right here so components get clean data
  const cleanedOpenLaunches = openLaunches.map(l => ({
      ...l,
      [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: cleanInstitutionName(l[C.FIELD_NOMBRE_PPS_LANZAMIENTOS])
  }));

  const lanzamientos = cleanedOpenLaunches.filter(l => {
      const estadoConv = normalizeStringForComparison(l[C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
      const estadoGestion = l[C.FIELD_ESTADO_GESTION_LANZAMIENTOS];
      
      return estadoConv !== 'oculto' && 
             estadoGestion !== 'Archivado' &&
             estadoGestion !== 'No se Relanza';
  });

  const institutionAddressMap = new Map<string, string>();
  allRawLanzamientos.forEach(l => {
      const name = cleanInstitutionName(l[C.FIELD_NOMBRE_PPS_LANZAMIENTOS]);
      const address = l[C.FIELD_DIRECCION_LANZAMIENTOS];
      if (name && address) {
          institutionAddressMap.set(normalizeStringForComparison(name), address);
      }
  });

  return { 
      lanzamientos, 
      myEnrollments: hydratedEnrollments, 
      allLanzamientos: allRawLanzamientos, 
      institutionAddressMap 
  };
};

export const fetchSeleccionados = async (lanzamiento: LanzamientoPPS): Promise<GroupedSeleccionados | null> => {
    const lanzamientoId = lanzamiento.id;
    if (!lanzamientoId) return null;

    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_postulantes_seleccionados', { 
            lanzamiento_uuid: lanzamientoId 
        });

        if (!rpcError && rpcData) {
            const grouped: GroupedSeleccionados = {};
            (rpcData as any[]).forEach((row: any) => {
                const horario = row.horario || 'No especificado';
                if (!grouped[horario]) grouped[horario] = [];
                
                grouped[horario].push({
                    nombre: row.nombre || 'Estudiante',
                    legajo: row.legajo || '---'
                });
            });
            
            if (Object.keys(grouped).length === 0) return null;

            for (const horario in grouped) {
                grouped[horario].sort((a, b) => a.nombre.localeCompare(b.nombre));
            }
            return grouped;
        }
    } catch (e) {
        // Fallback or ignore RPC error
    }

    const enrollments = await db.convocatorias.getAll({
        filters: { [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzamientoId }
    });

    const selectedEnrollments = enrollments.filter(e => {
        const status = String(e[C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || '').toLowerCase();
        return status.includes('seleccionado') || status.includes('asignado');
    });

    if (selectedEnrollments.length === 0) return null;

    const studentIds = selectedEnrollments.map(e => safeGetId(e[C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS])).filter(Boolean) as string[];
    const students = await db.estudiantes.getAll({ filters: { id: studentIds } });
    const studentMap = new Map(students.map(s => [s.id, s]));

    const grouped: GroupedSeleccionados = {};
    selectedEnrollments.forEach((row) => {
        const horario = (row[C.FIELD_HORARIO_FORMULA_CONVOCATORIAS] as string) || 'No especificado';
        const sId = safeGetId(row[C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
        const student = sId ? studentMap.get(sId) : null;
        const nombre = student ? (student[C.FIELD_NOMBRE_ESTUDIANTES] as string) : 'Estudiante';
        const legajo = student ? String(student[C.FIELD_LEGAJO_ESTUDIANTES]) : '---';
        if (!grouped[horario]) grouped[horario] = [];
        grouped[horario].push({ nombre, legajo });
    });
    
    for (const h in grouped) grouped[h].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return grouped;
};

export const toggleStudentSelection = async (
    convocatoriaId: string,
    isSelecting: boolean,
    studentId: string,
    lanzamiento: LanzamientoPPS
): Promise<{ success: boolean, error?: string }> => {
    
    const newStatus = isSelecting ? 'Seleccionado' : 'Inscripto';
    try {
        // 1. Actualizar estado en convocatoria
        await db.convocatorias.update(convocatoriaId, { [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: newStatus });
        
        // 2. Sincronizar registro de Práctica automáticamente
        if (isSelecting) {
            
            // CLEAN NAME FOR DB
            let rawName = lanzamiento[C.FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (Array.isArray(rawName)) rawName = rawName[0];
            const cleanName = cleanDbValue(rawName);
            const cleanOrientacion = cleanDbValue(lanzamiento[C.FIELD_ORIENTACION_LANZAMIENTOS]);

            // ROOT CAUSE FIX: Check if the source Lanzamiento is dirty in the DB (contains { "Name" })
            // If so, attempt to clean the source record to prevent future issues
            if (rawName && rawName !== cleanName && cleanName.length > 2) {
                console.log(`[DATA SERVICE] 🚨 DETECTED DIRTY ROOT: Lanzamiento ${lanzamiento.id} has dirty name. Cleaning source...`);
                // Fire and forget update to clean the source table
                db.lanzamientos.update(lanzamiento.id, { [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: cleanName }).catch(err => console.warn("Failed to clean source launch", err));
            }

            // Verificar si ya existe para no duplicar
            const { data: existing } = await supabase
                .from(C.TABLE_NAME_PRACTICAS)
                .select(`id, ${C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS}`)
                .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentId)
                .eq(C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, lanzamiento.id)
                .maybeSingle();

            if (!existing) {
                console.log(`[DATA SERVICE] Creating Practica. Name="${cleanName}"`);

                const payload = {
                    [C.FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentId,
                    [C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: lanzamiento.id,
                    [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: cleanName, 
                    [C.FIELD_ESPECIALIDAD_PRACTICAS]: cleanOrientacion,
                    [C.FIELD_FECHA_INICIO_PRACTICAS]: lanzamiento[C.FIELD_FECHA_INICIO_LANZAMIENTOS],
                    [C.FIELD_FECHA_FIN_PRACTICAS]: lanzamiento[C.FIELD_FECHA_FIN_LANZAMIENTOS],
                    [C.FIELD_HORAS_PRACTICAS]: 0,
                    [C.FIELD_ESTADO_PRACTICA]: 'En curso',
                    [C.FIELD_NOTA_PRACTICAS]: 'Sin calificar'
                };
                
                await db.practicas.create(payload);
            } else {
                console.log(`[DATA SERVICE] Practica already exists. Checking data integrity...`);
                // SELF-HEALING: If exists but has dirty name, fix it now.
                const currentName = existing[C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
                if (currentName !== cleanName) {
                    console.log(`[DATA SERVICE] Fixing dirty name: ${currentName} -> ${cleanName}`);
                    await db.practicas.update(existing.id, {
                        [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: cleanName,
                        [C.FIELD_ESPECIALIDAD_PRACTICAS]: cleanOrientacion
                    });
                }
            }
        } else {
            // Si deselecciona, borrar la práctica asociada
            const { data: existing } = await supabase
                .from(C.TABLE_NAME_PRACTICAS)
                .select('id')
                .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentId)
                .eq(C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, lanzamiento.id);
            
            if (existing && existing.length > 0) {
                for (const rec of existing) {
                     await db.practicas.delete(rec.id);
                }
            }
        }

        return { success: true };
    } catch (e: any) {
        console.error(`[DATA SERVICE] ERROR:`, e);
        return { success: false, error: e.message };
    }
};

export const fetchCorrectionPanelData = async (): Promise<Map<string, InformeCorreccionPPS>> => {
    const { data: convocatoriasData, error: convError } = await supabase
        .from(C.TABLE_NAME_CONVOCATORIAS)
        .select(`
            *,
            estudiante:estudiantes!fk_convocatoria_estudiante (id, nombre, legajo),
            lanzamiento:lanzamientos_pps!fk_convocatoria_lanzamiento (id, nombre_pps, orientacion, informe, fecha_finalizacion, fecha_inicio)
        `)
        .ilike(C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS, '%seleccionado%');

    if (convError) throw convError;
    if (!convocatoriasData) return new Map();

    const studentIds = new Set<string>();
    const lanzamientoIds = new Set<string>();
    convocatoriasData.forEach((c: any) => {
        const sId = safeGetId(c.estudiante_id);
        const lId = safeGetId(c.lanzamiento_id);
        if (sId) studentIds.add(sId);
        if (lId) lanzamientoIds.add(lId);
    });

    let practicasData: any[] = [];
    if (studentIds.size > 0 && lanzamientoIds.size > 0) {
        const { data: pData } = await supabase
            .from(C.TABLE_NAME_PRACTICAS)
            .select('*')
            .in(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, Array.from(studentIds))
            .in(C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, Array.from(lanzamientoIds));
        if (pData) practicasData = pData;
    }

    const practicasMap = new Map<string, any>();
    practicasData.forEach((p: any) => {
        const sId = safeGetId(p[C.FIELD_ESTUDIANTE_LINK_PRACTICAS]);
        const lId = safeGetId(p[C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]);
        if (sId && lId) practicasMap.set(`${sId}-${lId}`, p);
    });

    const ppsGroups = new Map<string, InformeCorreccionPPS>();
    convocatoriasData.forEach((conv: any) => {
        const lanzamiento = conv.lanzamiento;
        const student = conv.estudiante;
        if (!lanzamiento || !student) return;

        const lId = lanzamiento.id;
        if (!ppsGroups.has(lId)) {
            ppsGroups.set(lId, {
                lanzamientoId: lId,
                // Ensure clean name display for groups
                ppsName: cleanInstitutionName(lanzamiento.nombre_pps),
                orientacion: lanzamiento.orientacion,
                informeLink: lanzamiento.informe,
                fechaFinalizacion: lanzamiento.fecha_finalizacion,
                students: [],
            });
        }

        const practicaRecord = practicasMap.get(`${student.id}-${lId}`);
        ppsGroups.get(lId)!.students.push({
            studentId: student.id,
            studentName: student.nombre || 'Desconocido',
            convocatoriaId: conv.id,
            practicaId: practicaRecord?.id || null,
            informeSubido: conv[C.FIELD_INFORME_SUBIDO_CONVOCATORIAS] || false,
            nota: practicaRecord?.[C.FIELD_NOTA_PRACTICAS] || 'Sin calificar',
            lanzamientoId: lId,
            orientacion: lanzamiento.orientacion,
            fechaFinalizacionPPS: lanzamiento.fecha_finalizacion,
            fechaEntregaInforme: conv[C.FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS],
        });
    });

    return ppsGroups;
};

export const uploadFinalizationFile = async (file: File, studentId: string, type: 'informe' | 'horas' | 'asistencia'): Promise<string> => {
    if (!studentId) throw new Error("No student ID");
    const fileExt = file.name.split('.').pop();
    const fileName = `${studentId}/${type}_${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('documentos_finalizacion').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('documentos_finalizacion').getPublicUrl(fileName);
    return data.publicUrl;
};

export const submitFinalizationRequest = async (studentId: string, data: any) => {
    const record = {
        [C.FIELD_ESTUDIANTE_FINALIZACION]: studentId, 
        [C.FIELD_FECHA_SOLICITUD_FINALIZACION]: new Date().toISOString(),
        [C.FIELD_ESTADO_FINALIZACION]: 'Pendiente',
        [C.FIELD_INFORME_FINAL_FINALIZACION]: JSON.stringify(data.informes),
        [C.FIELD_PLANILLA_HORAS_FINALIZACION]: JSON.stringify(data.horas),
        [C.FIELD_PLANILLA_ASISTENCIA_FINALIZACION]: JSON.stringify(data.asistencias),
        [C.FIELD_SUGERENCIAS_MEJORAS_FINALIZACION]: data.sugerencias
    };
    await db.finalizacion.create(record as any);
};

export const deleteFinalizationRequest = async (id: string, record: any): Promise<{ success: boolean, error: any }> => {
    try {
        await db.finalizacion.delete(id);
        return { success: true, error: null };
    } catch (e) { return { success: false, error: e }; }
};
