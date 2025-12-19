
import { db } from '../lib/db';
import { supabase } from '../lib/supabaseClient';
import {
  Practica, SolicitudPPS, LanzamientoPPS, Convocatoria, InformeTask,
  EstudianteFields,
  GroupedSeleccionados,
  FinalizacionPPS,
  Estudiante
} from '../types';
import * as C from '../constants';
import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';

export const fetchStudentData = async (legajo: string): Promise<{ studentDetails: Estudiante | null; studentAirtableId: string | null; }> => {
  // Intentamos buscar por legajo exacto
  const { data, error } = await supabase
      .from(C.TABLE_NAME_ESTUDIANTES)
      .select('*')
      .eq(C.FIELD_LEGAJO_ESTUDIANTES, legajo)
      .maybeSingle();
  
  if (error || !data) {
      console.warn("Estudiante no encontrado por legajo:", legajo);
      return { studentDetails: null, studentAirtableId: null };
  }

  return { studentDetails: data as unknown as Estudiante, studentAirtableId: data.id };
};

export const fetchPracticas = async (legajo: string): Promise<Practica[]> => {
  const { studentAirtableId } = await fetchStudentData(legajo);
  if (!studentAirtableId) return [];

  // Usamos una consulta directa con JOIN para traer el nombre de la institución
  // desde la tabla de lanzamientos, si el vínculo existe.
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
      // Lógica de recuperación de nombre de institución:
      // 1. Nombre guardado físicamente en la tabla practicas (si existe)
      // 2. Nombre traído del lanzamiento vinculado (JOIN)
      // 3. Fallback a "Institución desconocida"
      
      const lanzamiento = Array.isArray(row.lanzamiento) ? row.lanzamiento[0] : row.lanzamiento;
      
      // Limpiar el nombre si viene con corchetes/comillas de la migración
      let rawName = row[C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
      if (rawName && typeof rawName === 'string') {
          rawName = rawName.replace(/[\[\]"]/g, '');
      }

      const finalName = rawName || lanzamiento?.nombre_pps || 'Institución desconocida';
      
      // Si faltan fechas en la práctica, usamos las del lanzamiento
      if (!row[C.FIELD_FECHA_INICIO_PRACTICAS] && lanzamiento?.fecha_inicio) {
          row[C.FIELD_FECHA_INICIO_PRACTICAS] = lanzamiento.fecha_inicio;
      }
      if (!row[C.FIELD_FECHA_FIN_PRACTICAS] && lanzamiento?.fecha_finalizacion) {
          row[C.FIELD_FECHA_FIN_PRACTICAS] = lanzamiento.fecha_finalizacion;
      }
      
      // Si falta especialidad, usamos la del lanzamiento
      if (!row[C.FIELD_ESPECIALIDAD_PRACTICAS] && lanzamiento?.orientacion) {
          row[C.FIELD_ESPECIALIDAD_PRACTICAS] = lanzamiento.orientacion;
      }

      return {
          ...row,
          [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: finalName,
      } as unknown as Practica;
  });
};

export const fetchSolicitudes = async (legajo: string, studentAirtableId: string | null): Promise<SolicitudPPS[]> => {
  let targetId = studentAirtableId;
  if (!targetId) {
       const { studentAirtableId: fetchedId } = await fetchStudentData(legajo);
       targetId = fetchedId;
  }
  if (!targetId) return [];

  // Usamos supabase directo para hacer el JOIN y obtener el nombre si falta
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
  
  // Mapear para rellenar datos faltantes desde la relación
  const mappedRecords = data.map((r: any) => {
      const student = Array.isArray(r.estudiante) ? r.estudiante[0] : r.estudiante;
      return {
          ...r,
          [C.FIELD_SOLICITUD_NOMBRE_ALUMNO]: r[C.FIELD_SOLICITUD_NOMBRE_ALUMNO] || student?.nombre || 'Estudiante',
          [C.FIELD_SOLICITUD_LEGAJO_ALUMNO]: r[C.FIELD_SOLICITUD_LEGAJO_ALUMNO] || student?.legajo,
          [C.FIELD_SOLICITUD_EMAIL_ALUMNO]: r[C.FIELD_SOLICITUD_EMAIL_ALUMNO] || student?.correo
      };
  });

  return mappedRecords.filter(r => r[C.FIELD_ESTADO_PPS] !== 'Archivado') as unknown as SolicitudPPS[];
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
      return records[0] as unknown as FinalizacionPPS;
  } catch (error) {
      console.warn("Suppressing error in fetchFinalizacionRequest to prevent UI crash:", error);
      return null;
  }
}

export const fetchConvocatoriasData = async (legajo: string, studentAirtableId: string | null, isSuperUserMode: boolean): Promise<{
    lanzamientos: LanzamientoPPS[],
    myEnrollments: Convocatoria[],
    allLanzamientos: LanzamientoPPS[],
    institutionAddressMap: Map<string, string>,
}> => {
    
  // 1. Obtener Inscripciones del Estudiante
  let myEnrollments: Convocatoria[] = [];
  const enrolledLaunchIds = new Set<string>();

  if (studentAirtableId) {
      const enrollments = await db.convocatorias.getAll({
          filters: { [C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentAirtableId }
      });
      myEnrollments = enrollments as unknown as Convocatoria[];

      myEnrollments.forEach(e => {
          const lid = e[C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
          if (lid) {
             if (Array.isArray(lid)) lid.forEach((id: string) => enrolledLaunchIds.add(id));
             else enrolledLaunchIds.add(lid as string);
          }
      });
  }

  // 2. Obtener Lanzamientos "Abiertos" Y "Cerrados"
  const openLaunches = await db.lanzamientos.getAll({
      filters: { 
        [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: ['Abierta', 'Abierto', 'Cerrado'] 
      },
      sort: [{ field: C.FIELD_FECHA_INICIO_LANZAMIENTOS, direction: 'desc' }]
  });

  // 3. Obtener Lanzamientos Históricos (SOLO los que el alumno cursó y NO están en la lista principal)
  const openLaunchIds = new Set(openLaunches.map(l => l.id));
  const missingLaunchIds = Array.from(enrolledLaunchIds).filter(id => !openLaunchIds.has(id));

  let historicalLaunches: any[] = [];
  if (missingLaunchIds.length > 0) {
      historicalLaunches = await db.lanzamientos.getAll({
          filters: { id: missingLaunchIds }
      });
  }

  const allRawLanzamientos = [...openLaunches, ...historicalLaunches] as unknown as LanzamientoPPS[];
  const launchesMap = new Map(allRawLanzamientos.map(l => [l.id, l]));

  // Hidratar inscripciones
  const hydratedEnrollments = myEnrollments.map(row => {
      const rawLaunchId = row[C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
      const launchId = Array.isArray(rawLaunchId) ? rawLaunchId[0] : rawLaunchId;
      const launch = launchId ? launchesMap.get(launchId as string) : null;
      
      return {
          ...row,
          [C.FIELD_NOMBRE_PPS_CONVOCATORIAS]: row[C.FIELD_NOMBRE_PPS_CONVOCATORIAS] || launch?.[C.FIELD_NOMBRE_PPS_LANZAMIENTOS],
          [C.FIELD_FECHA_INICIO_CONVOCATORIAS]: row[C.FIELD_FECHA_INICIO_CONVOCATORIAS] || launch?.[C.FIELD_FECHA_INICIO_LANZAMIENTOS],
          [C.FIELD_FECHA_FIN_CONVOCATORIAS]: row[C.FIELD_FECHA_FIN_CONVOCATORIAS] || launch?.[C.FIELD_FECHA_FIN_LANZAMIENTOS],
          [C.FIELD_DIRECCION_CONVOCATORIAS]: row[C.FIELD_DIRECCION_CONVOCATORIAS] || launch?.[C.FIELD_DIRECCION_LANZAMIENTOS],
          [C.FIELD_ORIENTACION_CONVOCATORIAS]: row[C.FIELD_ORIENTACION_CONVOCATORIAS] || launch?.[C.FIELD_ORIENTACION_LANZAMIENTOS],
          [C.FIELD_HORAS_ACREDITADAS_CONVOCATORIAS]: row[C.FIELD_HORAS_ACREDITADAS_CONVOCATORIAS] || launch?.[C.FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]
      } as Convocatoria;
  });

  const lanzamientos = (openLaunches as unknown as LanzamientoPPS[]).filter(l => {
      const estadoConv = normalizeStringForComparison(l[C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
      const estadoGestion = l[C.FIELD_ESTADO_GESTION_LANZAMIENTOS];
      
      return estadoConv !== 'oculto' && 
             estadoGestion !== 'Archivado' &&
             estadoGestion !== 'No se Relanza';
  });

  const institutionAddressMap = new Map<string, string>();
  // Use allRawLanzamientos to ensure we cover historical/closed launches for address resolution
  allRawLanzamientos.forEach(l => {
      const name = l[C.FIELD_NOMBRE_PPS_LANZAMIENTOS];
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
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_postulantes_seleccionados', { 
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
        } else if (rpcError) {
             console.warn("Error RPC get_postulantes_seleccionados:", rpcError);
        }
    } catch (e) {
        console.warn("RPC no disponible o falló", e);
    }

    const enrollments = await db.convocatorias.getAll({
        filters: { 
            [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzamientoId
        }
    });

    const selectedEnrollments = enrollments.filter(e => {
        const status = String(e[C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || '').toLowerCase();
        return status.includes('seleccionado') || status.includes('asignado') || status.includes('confirmado');
    });

    if (selectedEnrollments.length === 0) return null;

    const studentIds = selectedEnrollments.map(e => e[C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]).filter(Boolean) as string[];
    
    const students = await db.estudiantes.getAll({ filters: { id: studentIds } });
    const studentMap = new Map(students.map(s => [s.id, s]));

    const grouped: GroupedSeleccionados = {};
    
    selectedEnrollments.forEach((row) => {
        const horario = (row[C.FIELD_HORARIO_FORMULA_CONVOCATORIAS] as string) || 'No especificado';
        const studentId = row[C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string;
        
        const student = studentMap.get(studentId);
        
        const nombre = student ? (student[C.FIELD_NOMBRE_ESTUDIANTES] as string) : 'Estudiante Seleccionado';
        const legajo = student ? String(student[C.FIELD_LEGAJO_ESTUDIANTES]) : (String(row[C.FIELD_LEGAJO_CONVOCATORIAS] || '---'));

        if (!grouped[horario]) grouped[horario] = [];
        grouped[horario].push({ nombre, legajo });
    });
    
    if (Object.keys(grouped).length === 0) return null;

    for (const horario in grouped) {
        grouped[horario].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

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
        await db.convocatorias.update(convocatoriaId, { [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: newStatus });
        return { success: true };
    } catch (e: any) {
        const message = e?.error?.message || e.message || 'Unknown error updating selection status';
        return { success: false, error: message };
    }
};

export const deleteFinalizationRequest = async (id: string, record: any): Promise<{ success: boolean, error: any }> => {
    try {
        const filesToDelete: string[] = [];
        const fileFields = [
            C.FIELD_INFORME_FINAL_FINALIZACION, 
            C.FIELD_PLANILLA_HORAS_FINALIZACION, 
            C.FIELD_PLANILLA_ASISTENCIA_FINALIZACION
        ];

        fileFields.forEach(field => {
            const raw = record[field];
            if (raw) {
                let attachments = [];
                try {
                    attachments = typeof raw === 'string' ? JSON.parse(raw) : raw;
                } catch (e) {
                     console.warn("Error parsing attachment JSON for deletion:", e);
                }

                if (Array.isArray(attachments)) {
                    attachments.forEach((att: any) => {
                        if (att.url) {
                            const urlParts = att.url.split('/documentos_finalizacion/');
                            if (urlParts.length > 1) {
                                filesToDelete.push(urlParts[1]);
                            }
                        }
                    });
                }
            }
        });

        if (filesToDelete.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('documentos_finalizacion')
                .remove(filesToDelete);
            
            if (storageError) {
                console.error("Error removing files from storage:", storageError);
            }
        }

        await db.finalizacion.delete(id);
        return { success: true, error: null };

    } catch (error) {
        console.error("Error deleting finalization request:", error);
        return { success: false, error };
    }
};
