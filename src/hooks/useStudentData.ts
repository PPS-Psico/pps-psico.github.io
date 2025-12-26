
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStudentData } from '../services/dataService';
import { db } from '../lib/db';
import { mockDb } from '../services/mockDb';
import type { Orientacion } from '../types';
import { useModal } from '../contexts/ModalContext';
import { 
    FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES, 
    FIELD_NOTAS_INTERNAS_ESTUDIANTES,
    FIELD_ESTADO_ESTUDIANTES,
    FIELD_DNI_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_TELEFONO_ESTUDIANTES
} from '../constants';

const hasData = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const str = String(val).replace(/[\[\]"']/g, '').trim();
    return str.length > 2;
};

export const useStudentData = (legajo: string) => {
    const queryClient = useQueryClient();
    const { showModal } = useModal();

    const { 
        data, 
        isLoading: isStudentLoading, 
        error: studentError, 
        refetch: refetchStudent 
    } = useQuery({
        queryKey: ['student', legajo],
        queryFn: async () => {
            if (legajo === '99999') {
                await new Promise(resolve => setTimeout(resolve, 500));
                const mockStudent = (await mockDb.getAll('estudiantes', { legajo: '99999' }))[0];
                return { studentDetails: mockStudent, studentAirtableId: mockStudent.id };
            }
            return fetchStudentData(legajo);
        },
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    const studentDetails = data?.studentDetails ?? null;
    const studentAirtableId = data?.studentAirtableId ?? null;

    // --- LÓGICA DE AUTO-REPARACIÓN DE ESTADO ---
    useEffect(() => {
        if (studentDetails && studentAirtableId && legajo !== '99999') {
            const currentStatusInDb = studentDetails[FIELD_ESTADO_ESTUDIANTES];
            const hasContactInfo = hasData(studentDetails[FIELD_DNI_ESTUDIANTES]) || 
                                   hasData(studentDetails[FIELD_CORREO_ESTUDIANTES]) || 
                                   hasData(studentDetails[FIELD_TELEFONO_ESTUDIANTES]);

            // Si la DB dice que es nuevo pero tiene mail/dni, lo "sacamos" de nuevo en Supabase
            if (currentStatusInDb === 'Nuevo (Sin cuenta)' && hasContactInfo) {
                console.log(`🔧 Sanando estado para legajo ${legajo}...`);
                db.estudiantes.update(studentAirtableId, { [FIELD_ESTADO_ESTUDIANTES]: 'Inactivo' })
                    .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['metricsData'] });
                    });
            }
        }
    }, [studentDetails, studentAirtableId, legajo, queryClient]);

    const updateOrientation = useMutation({
        mutationFn: async (orientacion: Orientacion | "") => {
            if (!studentAirtableId) throw new Error("ID no disponible.");
            return db.estudiantes.update(studentAirtableId, { [FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]: orientacion || null });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student', legajo] }),
        onError: (error) => showModal('Error', `No se pudo guardar: ${error.message}`),
    });

    const updateInternalNotes = useMutation({
        mutationFn: async (notes: string) => {
            if (!studentAirtableId) throw new Error("ID no disponible.");
            return db.estudiantes.update(studentAirtableId, { [FIELD_NOTAS_INTERNAS_ESTUDIANTES]: notes || null });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student', legajo] });
            showModal('Éxito', 'Notas guardadas correctamente.');
        },
        onError: (error) => showModal('Error', `Error: ${error.message}`),
    });

    return {
        studentDetails,
        studentAirtableId,
        isStudentLoading,
        studentError,
        updateOrientation,
        updateInternalNotes,
        refetchStudent
    };
};
