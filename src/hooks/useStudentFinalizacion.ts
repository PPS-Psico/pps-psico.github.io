
import { useQuery } from '@tanstack/react-query';
import { fetchFinalizacionRequest } from '../services/dataService';
import { FinalizacionPPS } from '../types';

export const useStudentFinalizacion = (legajo: string, studentAirtableId: string | null) => {
    const {
        data: finalizacionRequest = null,
        isLoading: isFinalizationLoading,
        error: finalizationError,
        refetch: refetchFinalizacion
    } = useQuery({
        queryKey: ['finalizacionRequest', legajo],
        queryFn: () => fetchFinalizacionRequest(legajo, studentAirtableId),
        enabled: !!studentAirtableId,
        staleTime: 1000 * 60 * 5 // 5 minutes
    });

    return {
        finalizacionRequest,
        isFinalizationLoading,
        finalizationError,
        refetchFinalizacion
    };
};
