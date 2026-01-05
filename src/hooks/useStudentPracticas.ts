
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPracticas } from '../services/dataService';
import { db } from '../lib/db';
import { mockDb } from '../services/mockDb';
import { useModal } from '../contexts/ModalContext';
import { FIELD_NOTA_PRACTICAS, FIELD_INFORME_SUBIDO_CONVOCATORIAS, FIELD_ESTADO_PRACTICA, FIELD_FECHA_FIN_PRACTICAS, FIELD_ESTUDIANTE_LINK_PRACTICAS } from '../constants';
import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import type { Practica } from '../types';

export const useStudentPracticas = (legajo: string) => {
    const queryClient = useQueryClient();
    const { showModal } = useModal();

    const {
        data: practicas = [],
        isLoading: isPracticasLoading,
        error: practicasError,
        refetch: refetchPracticas
    } = useQuery({
        queryKey: ['practicas', legajo],
        queryFn: async () => {
            let data: Practica[] = [];

            if (legajo === '99999') {
                // Testing Mode
                await new Promise(resolve => setTimeout(resolve, 600));
                data = await mockDb.getAll('practicas', { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: 'st_999' });
            } else {
                data = await fetchPracticas(legajo);
            }

            // --- AUTO-FIX LOGIC (Same for Mock and Prod) ---
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const updates = [];

            for (const p of data) {
                const status = normalizeStringForComparison(p[FIELD_ESTADO_PRACTICA]);
                if (status === 'en curso' && p[FIELD_FECHA_FIN_PRACTICAS]) {
                    const endDate = parseToUTCDate(p[FIELD_FECHA_FIN_PRACTICAS]);
                    if (endDate && endDate < now) {
                        if (legajo === '99999') {
                            await mockDb.update('practicas', p.id, { [FIELD_ESTADO_PRACTICA]: 'Finalizada' });
                        } else {
                            updates.push(
                                db.practicas.update(p.id, { [FIELD_ESTADO_PRACTICA]: 'Finalizada' })
                            );
                        }
                        // Optimistically update local
                        p[FIELD_ESTADO_PRACTICA] = 'Finalizada';
                    }
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
            }

            return data;
        },
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true, // Enable for testing reactivity
    });

    const updateNota = useMutation({
        mutationFn: async ({ practicaId, nota, convocatoriaId }: { practicaId: string; nota: string; convocatoriaId?: string }) => {
            if (legajo === '99999') {
                await mockDb.update('practicas', practicaId, { [FIELD_NOTA_PRACTICAS]: nota });
                if (nota === 'No Entregado' && convocatoriaId) {
                    await mockDb.update('convocatorias', convocatoriaId, { [FIELD_INFORME_SUBIDO_CONVOCATORIAS]: false });
                }
                return;
            }

            const valueToSend = nota === 'Sin calificar' ? null : nota;
            const promises: Promise<any>[] = [db.practicas.update(practicaId, { [FIELD_NOTA_PRACTICAS]: valueToSend })];

            if (nota === 'No Entregado' && convocatoriaId) {
                promises.push(db.convocatorias.update(convocatoriaId, { [FIELD_INFORME_SUBIDO_CONVOCATORIAS]: false }));
            }
            return Promise.all(promises);
        },
        onSuccess: (_, variables) => {
            if (variables.nota === 'No Entregado') {
                showModal('Actualización Exitosa', 'El estado del informe se ha cambiado a "No Entregado".');
            }
            queryClient.invalidateQueries({ queryKey: ['practicas', legajo] });
            queryClient.invalidateQueries({ queryKey: ['convocatorias', legajo] });
        },
        onError: () => showModal('Error', 'No se pudo actualizar la nota.'),
    });

    const updateFechaFin = useMutation({
        mutationFn: async ({ practicaId, fecha }: { practicaId: string; fecha: string }) => {
            if (legajo === '99999') {
                return mockDb.update('practicas', practicaId, { [FIELD_FECHA_FIN_PRACTICAS]: fecha });
            }
            return db.practicas.update(practicaId, { [FIELD_FECHA_FIN_PRACTICAS]: fecha });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['practicas', legajo] });
            showModal('Fecha Actualizada', 'La fecha de finalización se ha modificado correctamente.');
        },
        onError: (err) => showModal('Error', `No se pudo actualizar la fecha: ${err.message}`),
    });

    return {
        practicas,
        isPracticasLoading,
        practicasError,
        updateNota,
        updateFechaFin,
        refetchPracticas
    };
};
