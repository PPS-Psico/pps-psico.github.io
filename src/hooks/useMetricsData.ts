
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { 
    TABLE_NAME_ESTUDIANTES, 
    TABLE_NAME_PPS, 
    TABLE_NAME_LANZAMIENTOS_PPS,
    TABLE_NAME_CONVOCATORIAS,
    TABLE_NAME_PRACTICAS,
    TABLE_NAME_FINALIZACION,
    TABLE_NAME_INSTITUCIONES,
} from '../constants';
import { calculateDashboardMetrics } from '../utils/metricsCalculations';

export const useMetricsData = ({ targetYear, isTestingMode = false }: { targetYear: number; isTestingMode?: boolean; }) => {
    return useQuery({
        queryKey: ['metricsData', targetYear, isTestingMode],
        queryFn: async () => {
            const [est, req, lanz, conv, prac, fin, inst] = await Promise.all([
                supabase.from(TABLE_NAME_ESTUDIANTES).select('*'),
                supabase.from(TABLE_NAME_PPS).select('*'),
                supabase.from(TABLE_NAME_LANZAMIENTOS_PPS).select('*'),
                supabase.from(TABLE_NAME_CONVOCATORIAS).select('*'),
                supabase.from(TABLE_NAME_PRACTICAS).select('*'),
                supabase.from(TABLE_NAME_FINALIZACION).select('*'),
                supabase.from(TABLE_NAME_INSTITUCIONES).select('*')
            ]);

            const allData = { 
                estudiantes: est.data || [], 
                solicitudes: req.data || [],
                lanzamientos: lanz.data || [],
                convocatorias: conv.data || [],
                practicas: prac.data || [],
                finalizaciones: fin.data || [],
                instituciones: inst.data || []
            };

            return calculateDashboardMetrics(allData, targetYear);
        },
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });
};
