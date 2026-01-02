
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchPaginatedData } from '../services/supabaseService';
import { db } from '../lib/db';
import { mockDb } from '../services/mockDb';
import type { LanzamientoPPS } from '../types';
import {
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS,
  FIELD_REQ_CV_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_CODIGO_CAMPUS_LANZAMIENTOS
} from '../constants';
import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import { mapLanzamiento } from '../utils/mappers';

type LoadingState = 'initial' | 'loading' | 'loaded' | 'error';
export type FilterType = 'all' | 'vencidas' | 'proximas';

const getGroupName = (name: unknown): string => {
    const strName = String(name || '');
    if (!strName) return 'Sin Nombre';
    return strName.split(/ [-–] /)[0].trim();
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
                const records = await mockDb.getAll(TABLE_NAME_LANZAMIENTOS_PPS);
                setLanzamientos(records as unknown as LanzamientoPPS[]);
                setLoadingState('loaded');
                return;
            }

            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            let filters: Record<string, unknown> = {};

            // FILTROS BASADOS EN FECHA DE INICIO (fecha_inicio)
            if (filterType === 'vencidas') {
                // Vencidas = Ya iniciaron (Fecha Inicio <= Hoy)
                filters['endDate'] = today; 
            } else if (filterType === 'proximas') {
                // Próximas = Van a iniciar (Fecha Inicio >= Hoy)
                filters['startDate'] = today;
            }

            // Fetch Data
            const { records: lanzRecords, error: lanzError } = await fetchPaginatedData(
                TABLE_NAME_LANZAMIENTOS_PPS,
                1, 
                1000, 
                [],
                searchTerm,
                [FIELD_NOMBRE_PPS_LANZAMIENTOS],
                { field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: 'asc' }, // Ordenar por fecha inicio
                filters
            );
            
            const { records: instRecords } = await fetchPaginatedData(
                TABLE_NAME_INSTITUCIONES,
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

            // Client-side refinement (Double check)
            const mappedRecords = lanzRecords.map(mapLanzamiento);
            
            const filteredRecords = mappedRecords.filter(pps => {
                const status = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS];
                if (status === 'Archivado' || status === 'No se Relanza') return false;
                
                // Client-side date check using FECHA_INICIO as requested
                if (filterType === 'vencidas') {
                    const start = parseToUTCDate(pps[FIELD_FECHA_INICIO_LANZAMIENTOS]);
                    return start && start < now;
                }
                if (filterType === 'proximas') {
                    const start = parseToUTCDate(pps[FIELD_FECHA_INICIO_LANZAMIENTOS]);
                    return start && start >= now;
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
                await mockDb.update(TABLE_NAME_LANZAMIENTOS_PPS, id, updates);
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
        const now = new Date();
        
        const uniqueConfirmed = new Map<string, LanzamientoPPS>();
        const uniquePending = new Map<string, (LanzamientoPPS & { daysLeft?: number })>();

        // 1. Process Confirmed
        lanzamientos.forEach(pps => {
            const status = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS];
            if (status === 'Relanzamiento Confirmado') {
                const groupName = getGroupName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
                if (!uniqueConfirmed.has(groupName)) {
                    uniqueConfirmed.set(groupName, pps);
                }
            }
        });

        // 2. Process Pending/Others
        lanzamientos.forEach(pps => {
            const status = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS];
            
            if (status === 'Relanzamiento Confirmado' || status === 'Archivado' || status === 'No se Relanza') {
                return;
            }

            const groupName = getGroupName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
            if (uniqueConfirmed.has(groupName)) {
                return;
            }

            // Urgency calculation based on FECHA_INICIO (start date) as requested context implies
            const startDate = parseToUTCDate(pps[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            const daysLeft = startDate ? Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 999;
            
            const item = { ...pps, daysLeft };

            const existing = uniquePending.get(groupName);
            // Keep the one starting soonest
            if (!existing || (item.daysLeft || 999) < (existing.daysLeft || 999)) {
                uniquePending.set(groupName, item);
            }
        });

        const relanzamientosConfirmados = Array.from(uniqueConfirmed.values());
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
        orientationFilter: 'all', 
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
