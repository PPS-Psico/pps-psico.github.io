
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchPaginatedData } from '../services/supabaseService';
import { db } from '../lib/db';
import { mockDb } from '../services/mockDb';
import type { LanzamientoPPS } from '../types';
import {
  TABLE_LANZAMIENTOS,
  TABLE_INSTITUCIONES,
  COL_NOMBRE_PPS,
  COL_FECHA_INICIO,
  COL_FECHA_FIN,
  COL_ORIENTACION,
  COL_ESTADO_GESTION,
  COL_ESTADO_CONVOCATORIA,
  COL_CUPOS,
  COL_NOTAS_GESTION,
  COL_FECHA_RELANZAMIENTO,
  COL_REQ_CERTIFICADO,
  COL_REQ_CV,
  COL_DIRECCION,
  COL_CODIGO_CAMPUS_LANZAMIENTOS
} from '../constants';
import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import { mapLanzamiento } from '../utils/mappers';

type LoadingState = 'initial' | 'loading' | 'loaded' | 'error';
export type FilterType = 'all' | 'vencidas' | 'proximas';

const getGroupName = (name: unknown): string => {
    const strName = String(name || '');
    if (!strName) return 'Sin Nombre';
    return strName.split(' - ')[0].trim();
};

interface UseGestionConvocatoriasProps {
    forcedOrientations?: string[];
    isTestingMode?: boolean;
    initialFilter?: FilterType;
}

export const useGestionConvocatorias = ({ forcedOrientations, isTestingMode = false, initialFilter = 'all' }: UseGestionConvocatoriasProps) => {
    const [lanzamientos, setLanzamientos] = useState<LanzamientoPPS[]>([]);
    const [institutionsMap, setInstitutionsMap] = useState<Map<string, { id: string; phone?: string }>>(new Map());
    const [loadingState, setLoadingState] = useState<LoadingState>('initial');
    const [error, setError] = useState<string | null>(null);
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<FilterType>(initialFilter);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isLinking, setIsLinking] = useState(false);

    useEffect(() => {
        if (initialFilter) setFilterType(initialFilter);
    }, [initialFilter]);

    const fetchData = useCallback(async () => {
        setLoadingState('loading');
        setError(null);

        try {
            if (isTestingMode) {
                const records = await mockDb.getAll(TABLE_LANZAMIENTOS);
                setLanzamientos(records as unknown as LanzamientoPPS[]);
                setLoadingState('loaded');
                return;
            }

            // SERVER-SIDE FILTERING STRATEGY
            // We construct specific filters for Supabase based on the selected tab
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(now.getDate() + 30);
            const futureDate = thirtyDaysFromNow.toISOString().split('T')[0];

            let filters: Record<string, unknown> = {};

            // Basic filters to ignore archived stuff
            // Note: Supabase doesn't support 'neq' in simple object filters easily in this generic,
            // so we might filter 'Archivado' client side if the generic service doesn't support it.
            // But we can optimize date ranges.

            if (filterType === 'vencidas') {
                // End date < today
                filters['endDate'] = today; 
            } else if (filterType === 'proximas') {
                // End date >= today AND End date <= 30 days
                // We don't have direct range support in the simple `filters` object of fetchAllData, 
                // but we can fetch active ones and filter client side, reducing payload.
            }

            // Fetch Data
            const { records: lanzRecords, error: lanzError } = await fetchPaginatedData(
                TABLE_LANZAMIENTOS,
                1, 
                1000, // Fetch up to 1000 active items
                [],
                searchTerm,
                [COL_NOMBRE_PPS],
                { field: COL_FECHA_FIN, direction: 'asc' },
                filters
            );
            
            const { records: instRecords } = await fetchPaginatedData(
                TABLE_INSTITUCIONES,
                1,
                1000,
                ['nombre', 'telefono']
            );

            if (lanzError) throw new Error(lanzError.error as string);

            // Process Institutions Map
            const newInstitutionsMap = new Map<string, { id: string; phone?: string }>();
            instRecords.forEach(r => {
                if (r.nombre) {
                    newInstitutionsMap.set(normalizeStringForComparison(r.nombre), {
                        id: String(r.id),
                        phone: r.telefono || undefined
                    });
                }
            });
            setInstitutionsMap(newInstitutionsMap);

            // Client-side refinement (complex logic like 'Archivado' exclusion if not supported by simple filter)
            const mappedRecords = lanzRecords.map(mapLanzamiento);
            
            const filteredRecords = mappedRecords.filter(pps => {
                const status = pps[COL_ESTADO_GESTION];
                if (status === 'Archivado' || status === 'No se Relanza') return false;
                
                // Extra filtering for specific logic not easily done in simple SQL wrapper
                if (filterType === 'vencidas') {
                    const endDate = parseToUTCDate(pps[COL_FECHA_FIN]);
                    return endDate && endDate < now;
                }
                if (filterType === 'proximas') {
                    const endDate = parseToUTCDate(pps[COL_FECHA_FIN]);
                    return endDate && endDate >= now && endDate <= thirtyDaysFromNow;
                }
                
                return true;
            });

            setLanzamientos(filteredRecords);
            setLoadingState('loaded');

        } catch (err: any) {
             console.error(err);
             setError(err.message || 'Error al cargar datos');
             setLoadingState('error');
        }
    }, [isTestingMode, filterType, searchTerm]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = useCallback(async (id: string, updates: Partial<LanzamientoPPS>): Promise<boolean> => {
        setUpdatingIds(prev => new Set(prev).add(id));
        try {
            if (isTestingMode) {
                await mockDb.update(TABLE_LANZAMIENTOS, id, updates);
                setLanzamientos(prev => prev.map(pps => pps.id === id ? { ...pps, ...updates } : pps));
            } else {
                await db.lanzamientos.update(id, updates);
                fetchData(); // Refresh to ensure sync
            }
            setToastInfo({ message: 'Guardado correctamente.', type: 'success' });
            return true;
        } catch (e) {
            setToastInfo({ message: 'Error al guardar.', type: 'error' });
            return false;
        } finally {
            setUpdatingIds(prev => { const newSet = new Set(prev); newSet.delete(id); return newSet; });
        }
    }, [fetchData, isTestingMode]);

    const handleUpdateInstitutionPhone = useCallback(async (institutionId: string, phone: string): Promise<boolean> => {
         // Re-use existing logic, simple wrapper
         if (isTestingMode) return true;
         try {
             await db.instituciones.update(institutionId, { telefono: phone });
             setToastInfo({ message: 'Teléfono actualizado.', type: 'success' });
             return true;
         } catch (e) {
             setToastInfo({ message: 'Error al actualizar teléfono.', type: 'error' });
             return false;
         }
    }, [isTestingMode]);

    const filteredData = useMemo(() => {
        // Group logic remains similar but operates on already filtered dataset
        const relanzamientosConfirmados: LanzamientoPPS[] = [];
        const pendientesDeGestion: (LanzamientoPPS & { daysLeft?: number })[] = [];
        const now = new Date();

        lanzamientos.forEach(pps => {
            const status = pps[COL_ESTADO_GESTION];
            if (status === 'Relanzamiento Confirmado') {
                relanzamientosConfirmados.push(pps);
            } else {
                // Calculate days left for sorting/display
                const endDate = parseToUTCDate(pps[COL_FECHA_FIN]);
                const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 999;
                pendientesDeGestion.push({ ...pps, daysLeft });
            }
        });

        // Group by name deduplication logic for pending items
        const uniquePending = new Map<string, typeof pendientesDeGestion[0]>();
        pendientesDeGestion.forEach(item => {
            const groupName = getGroupName(item[COL_NOMBRE_PPS]);
            const existing = uniquePending.get(groupName);
            
            // Keep the one expiring soonest
            if (!existing || (item.daysLeft || 999) < (existing.daysLeft || 999)) {
                uniquePending.set(groupName, item);
            }
        });

        const finalPending = Array.from(uniquePending.values()).sort((a, b) => (a.daysLeft || 999) - (b.daysLeft || 999));

        return { 
            relanzamientosConfirmados, 
            pendientesDeGestion: finalPending,
            activasYPorFinalizar: [], 
            finalizadasParaReactivar: [], 
            activasIndefinidas: [] 
        };
    }, [lanzamientos]);

    return {
        institutionsMap,
        loadingState,
        error,
        toastInfo,
        setToastInfo,
        updatingIds,
        searchTerm,
        setSearchTerm,
        orientationFilter: 'all', // Deprecated in UI but kept for interface
        setOrientationFilter: () => {},
        filterType,
        setFilterType,
        isSyncing,
        isLinking,
        handleSave,
        handleUpdateInstitutionPhone,
        handleSync: async () => {},
        handleLinkOrphans: async () => {},
        filteredData,
    };
};
