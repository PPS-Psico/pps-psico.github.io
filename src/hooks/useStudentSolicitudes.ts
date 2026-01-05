
import { useQuery } from '@tanstack/react-query';
import { fetchSolicitudes } from '../services/dataService';
import { mockDb } from '../services/mockDb';
import { FIELD_LEGAJO_PPS, FIELD_ESTADO_PPS } from '../constants';
import type { SolicitudPPS } from '../types';

export const useStudentSolicitudes = (legajo: string, studentAirtableId: string | null) => {
    const {
        data: solicitudes = [],
        isLoading: isSolicitudesLoading,
        error: solicitudesError,
        refetch: refetchSolicitudes
    } = useQuery({
        queryKey: ['solicitudes', legajo],
        queryFn: async () => {
            if (legajo === '99999') {
                const recs: SolicitudPPS[] = await mockDb.getAll('solicitudes_pps', { [FIELD_LEGAJO_PPS]: 'st_999' });
                return recs.filter((r) => r[FIELD_ESTADO_PPS] !== 'Archivado');
            }
            return fetchSolicitudes(legajo, studentAirtableId);
        },
        enabled: !!legajo,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
    });

    return {
        solicitudes,
        isSolicitudesLoading,
        solicitudesError,
        refetchSolicitudes
    };
};
