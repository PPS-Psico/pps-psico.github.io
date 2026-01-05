
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
    FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
    FIELD_ESTADO_GESTION_LANZAMIENTOS,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
    FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
    FIELD_NOTAS_GESTION_LANZAMIENTOS,
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

export const useGestionConvocatorias = ({ isTestingMode = false, initialFilter = 'all' }: UseGestionConvocatoriasProps) => {
    const [lanzamientos, setLanzamientos] = useState<LanzamientoPPS[]>([]);
    const [institutionsMap, setInstitutionsMap] = useState<Map<string, { id: string; phone?: string }>>(new Map());
    const [loadingState, setLoadingState] = useState<LoadingState>('initial');
    const [error, setError] = useState<string | null>(null);
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<FilterType>(initialFilter);

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
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);

        // Groups
        const relanzamientosConfirmados: LanzamientoPPS[] = [];
        const activasYPorFinalizar: (LanzamientoPPS & { daysLeft?: number, urgency?: 'high' | 'normal' })[] = [];
        const finalizadasParaReactivar: (LanzamientoPPS & { daysSinceEnd?: number })[] = [];
        const activasIndefinidas: LanzamientoPPS[] = []; // For Manual/Indefinite dates

        // 1. Group by Institution Base Name to process lifecycle
        const groups = new Map<string, LanzamientoPPS[]>();
        lanzamientos.forEach(pps => {
            const name = getGroupName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
            if (!groups.has(name)) groups.set(name, []);
            groups.get(name)!.push(pps);
        });

        // 2. Analyze each Group
        groups.forEach((history, _) => {
            // Sort by Date Descending (Newest first)
            history.sort((a, b) => {
                const dateA = new Date(a[FIELD_FECHA_INICIO_LANZAMIENTOS] || '1900-01-01').getTime();
                const dateB = new Date(b[FIELD_FECHA_INICIO_LANZAMIENTOS] || '1900-01-01').getTime();
                return dateB - dateA;
            });

            // Check if there is ALREADY a confirmed future relaunch
            const futureLaunch = history.find(pps => {
                const status = normalizeStringForComparison(pps[FIELD_ESTADO_GESTION_LANZAMIENTOS]);
                return status === 'relanzamiento confirmado' || (
                    pps[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS] &&
                    new Date(pps[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS]).getFullYear() >= 2026
                );
            });

            if (futureLaunch) {
                relanzamientosConfirmados.push(futureLaunch);
                return; // Cycle handled
            }

            // If no future launch, look at the CURRENT active/latest one
            // We ignore "Archived" or "No se Relanza" unless they are the *only* thing
            const relevantPPS = history.find(pps => {
                const status = normalizeStringForComparison(pps[FIELD_ESTADO_GESTION_LANZAMIENTOS]);
                return status !== 'archivado' && status !== 'no se relanza';
            }) || history[0];

            if (!relevantPPS) return;

            const status = normalizeStringForComparison(relevantPPS[FIELD_ESTADO_GESTION_LANZAMIENTOS]);
            if (status === 'archivado' || status === 'no se relanza') return; // Explicitly dead

            const startDate = parseToUTCDate(relevantPPS[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            const endDate = parseToUTCDate(relevantPPS[FIELD_FECHA_FIN_LANZAMIENTOS]);

            // Case A: No dates (Indefinite)
            if (!startDate || !endDate) {
                activasIndefinidas.push(relevantPPS);
                return;
            }

            // Case B: Active or Finished?
            const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

            if (daysLeft < 0) {
                // FINISHED - Needs Action
                // But only if it finished recently (< 6 months) or we want to reactivate
                // Let's include everything finished as "Reactivar" logic
                finalizadasParaReactivar.push({
                    ...relevantPPS,
                    daysSinceEnd: Math.abs(daysLeft)
                });
            } else {
                // ACTIVE
                const urgency = daysLeft <= 7 ? 'high' : 'normal';
                activasYPorFinalizar.push({
                    ...relevantPPS,
                    daysLeft,
                    urgency
                });
            }
        });

        // 3. Fallback for "Pendientes de Gestion" explicit status that might be old
        // (If user manually tagged something as "Esperando Respuesta" but dates are old)
        // The logic above covers lifecycle. "Pendientes" is implicitly "FinalizadasParaReactivar" or "Activas".
        // We map the return to match component expectations.

        return {
            relanzamientosConfirmados,
            pendientesDeGestion: [], // Deprecated in favor of clearer categories
            activasYPorFinalizar: activasYPorFinalizar.sort((a, b) => (a.daysLeft || 999) - (b.daysLeft || 999)),
            finalizadasParaReactivar: finalizadasParaReactivar.sort((a, b) => (a.daysSinceEnd || 0) - (b.daysSinceEnd || 0)),
            activasIndefinidas
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
        setOrientationFilter: () => { },
        filterType,
        setFilterType,
        handleSave,
        handleUpdateInstitutionPhone,
        handleSync: async () => { },
        handleLinkOrphans: async () => { },
        filteredData,
    };
};
