
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { fetchAllData } from '../services/supabaseService';
import { sendSmartEmail } from '../utils/emailService';
import { deleteFinalizationRequest } from '../services/dataService';
import { mockDb } from '../services/mockDb';
import {
    TABLE_NAME_FINALIZACION,
    FIELD_FECHA_SOLICITUD_FINALIZACION,
    FIELD_ESTADO_FINALIZACION,
    FIELD_ESTUDIANTE_FINALIZACION,
    FIELD_INFORME_FINAL_FINALIZACION,
    FIELD_PLANILLA_HORAS_FINALIZACION,
    FIELD_PLANILLA_ASISTENCIA_FINALIZACION,
    FIELD_SUGERENCIAS_MEJORAS_FINALIZACION,
    TABLE_NAME_ESTUDIANTES,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_FECHA_FINALIZACION_ESTUDIANTES,
    FIELD_ESTADO_ESTUDIANTES
} from '../constants';
import { mapFinalizacion, mapEstudiante } from '../utils/mappers';
import { normalizeStringForComparison, safeGetId } from '../utils/formatters';

export const useFinalizacionLogic = (isTestingMode = false) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const queryClient = useQueryClient();

    const { data: requests = [], isLoading, error } = useQuery({
        queryKey: ['finalizacionRequests', isTestingMode],
        queryFn: async () => {
            if (isTestingMode) {
                 const mockRequests = await mockDb.getAll('finalizacion_pps');
                 const students = await mockDb.getAll('estudiantes');
                 const studentMap = new Map(students.map((s: any) => [s.id, s]));
                 
                 return mockRequests.map((req: any) => {
                     const sId = req[FIELD_ESTUDIANTE_FINALIZACION];
                     const student = studentMap.get(sId);
                     return {
                        ...req,
                        studentName: student?.[FIELD_NOMBRE_ESTUDIANTES] || 'Desconocido',
                        studentLegajo: student?.[FIELD_LEGAJO_ESTUDIANTES] || '---',
                        studentEmail: student?.[FIELD_CORREO_ESTUDIANTES] || '',
                        createdTime: req.created_at
                     }
                 }).sort((a: any, b: any) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
            }

            const { records: finalizationsRaw, error: finError } = await fetchAllData(
                TABLE_NAME_FINALIZACION, 
                [FIELD_FECHA_SOLICITUD_FINALIZACION, FIELD_ESTADO_FINALIZACION, FIELD_ESTUDIANTE_FINALIZACION, FIELD_INFORME_FINAL_FINALIZACION, FIELD_PLANILLA_HORAS_FINALIZACION, FIELD_PLANILLA_ASISTENCIA_FINALIZACION, FIELD_SUGERENCIAS_MEJORAS_FINALIZACION]
            );

            if (finError) throw new Error(typeof finError.error === 'string' ? finError.error : finError.error.message);
            
            const finalizations = finalizationsRaw.map(mapFinalizacion);
            const studentIds = [...new Set(finalizations.map((r) => safeGetId(r[FIELD_ESTUDIANTE_FINALIZACION])).filter(Boolean))];

            const { records: studentsRaw } = await fetchAllData(
                TABLE_NAME_ESTUDIANTES,
                [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES, FIELD_CORREO_ESTUDIANTES],
                { id: studentIds as string[] }
            );
            const students = studentsRaw.map(mapEstudiante);
            
            const studentMap = new Map(students.map((s) => [s.id, s]));
            
            return finalizations.map((req) => {
                const sId = safeGetId(req[FIELD_ESTUDIANTE_FINALIZACION]);
                const student = sId ? studentMap.get(sId) : null;
                return {
                    ...req,
                    studentName: student?.[FIELD_NOMBRE_ESTUDIANTES] || 'Desconocido',
                    studentLegajo: student?.[FIELD_LEGAJO_ESTUDIANTES] || '---',
                    studentEmail: student?.[FIELD_CORREO_ESTUDIANTES] || '',
                    createdTime: req.createdTime || req.created_at || new Date().toISOString()
                };
            }).sort((a: any, b: any) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
             const request = requests.find((r: any) => r.id === id);
             if (!request) throw new Error("Solicitud no encontrada");
             
             if (isTestingMode) {
                 await mockDb.update('finalizacion_pps', id, { [FIELD_ESTADO_FINALIZACION]: status });
                 return { emailSuccess: true };
             }
             
             await db.finalizacion.update(id, { [FIELD_ESTADO_FINALIZACION]: status });
             let emailResult: { success: boolean; message?: string } = { success: true, message: 'No se requiere email' };
             
             if (status === 'Cargado') {
                 const sId = safeGetId(request[FIELD_ESTUDIANTE_FINALIZACION]);
                 if (sId) {
                     await db.estudiantes.update(sId, { 
                         [FIELD_ESTADO_ESTUDIANTES]: 'Finalizado',
                         [FIELD_FECHA_FINALIZACION_ESTUDIANTES]: new Date().toISOString() 
                     });
                 }
                 
                 // El envío de email ahora consulta la DB internamente para activarse
                 if (request.studentEmail) {
                     emailResult = await sendSmartEmail('sac', {
                         studentName: request.studentName,
                         studentEmail: request.studentEmail,
                         ppsName: 'Práctica Profesional Supervisada'
                     });
                 }
             }
             return { emailSuccess: emailResult.success, emailMessage: emailResult.message };
        },
        onSuccess: (data, variables) => {
             queryClient.invalidateQueries({ queryKey: ['finalizacionRequests'] });
             if (variables.status === 'Cargado') {
                 if (data.emailSuccess) {
                     setToastInfo({ message: 'Acreditación confirmada y email enviado.', type: 'success' });
                 } else {
                     setToastInfo({ message: `Cargado con éxito, pero falló el email: ${data.emailMessage}`, type: 'warning' });
                 }
             } else {
                 setToastInfo({ message: 'Estado actualizado correctamente.', type: 'success' });
             }
        },
        onError: (err: any) => {
            setToastInfo({ message: `Error al actualizar: ${err.message}`, type: 'error' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (record: any) => {
             const sId = safeGetId(record[FIELD_ESTUDIANTE_FINALIZACION]);
             if (sId) {
                 const updateFields = { [FIELD_FECHA_FINALIZACION_ESTUDIANTES]: null, [FIELD_ESTADO_ESTUDIANTES]: 'Activo' };
                 if (isTestingMode) await mockDb.update('estudiantes', String(sId), updateFields);
                 else await db.estudiantes.update(String(sId), updateFields);
             }
             if (isTestingMode) await mockDb.delete('finalizacion_pps', record.id);
             else {
                 const { error } = await deleteFinalizationRequest(record.id, record);
                 if (error) throw new Error(error.message);
             }
        },
        onSuccess: () => {
            setToastInfo({ message: 'Solicitud eliminada y estado revertido.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['finalizacionRequests'] });
            queryClient.invalidateQueries({ queryKey: ['student'] });
        }
    });

    const { activeList, historyList } = useMemo(() => {
        const active: any[] = [], history: any[] = [];
        const searchLower = searchTerm.toLowerCase();
        requests.forEach((req: any) => {
             if (searchTerm && !req.studentName.toLowerCase().includes(searchLower) && !String(req.studentLegajo).includes(searchLower)) return;
             const status = normalizeStringForComparison(req[FIELD_ESTADO_FINALIZACION]);
             if (status === 'cargado') history.push(req);
             else active.push(req);
        });
        return { activeList: active, historyList: history };
    }, [requests, searchTerm]);

    return {
        isLoading, error,
        searchTerm, setSearchTerm,
        toastInfo, setToastInfo,
        updateStatusMutation,
        deleteMutation,
        activeList,
        historyList
    };
};
