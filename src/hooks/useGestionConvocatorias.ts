
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAllData, updateRecord, createRecord, updateRecords } from '../services/supabaseService';
import { mockDb } from '../services/mockDb';
import type { LanzamientoPPS, InstitucionFields, LanzamientoPPSFields, PracticaFields } from '../types';
import {
  TABLE_NAME_LANZAMIENTOS_PPS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  TABLE_NAME_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  TABLE_NAME_INSTITUCIONES,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_TELEFONO_INSTITUCIONES,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
} from '../constants';
import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import { lanzamientoPPSArraySchema, institucionArraySchema, practicaArraySchema } from '../schemas';

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
    const [orientationFilter, setOrientationFilter] = useState('all');
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
            let records: any[] = [];
            let instRecords: any[] = [];

            if (isTestingMode) {
                records = await mockDb.getAll('lanzamientos_pps');
                instRecords = await mockDb.getAll('instituciones');
            } else {
                const [lanzamientosRes, institucionesRes] = await Promise.all([
                    fetchAllData<LanzamientoPPSFields>(
                        TABLE_NAME_LANZAMIENTOS_PPS,
                        lanzamientoPPSArraySchema,
                        [
                            FIELD_NOMBRE_PPS_LANZAMIENTOS,
                            FIELD_FECHA_INICIO_LANZAMIENTOS,
                            FIELD_FECHA_FIN_LANZAMIENTOS,
                            FIELD_ORIENTACION_LANZAMIENTOS,
                            FIELD_ESTADO_GESTION_LANZAMIENTOS,
                            FIELD_NOTAS_GESTION_LANZAMIENTOS,
                            FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
                            FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
                            FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
                        ],
                        undefined,
                        [{ field: FIELD_FECHA_FIN_LANZAMIENTOS, direction: 'desc' }]
                    ),
                    fetchAllData<InstitucionFields>(
                        TABLE_NAME_INSTITUCIONES,
                        institucionArraySchema,
                        [FIELD_NOMBRE_INSTITUCIONES, FIELD_TELEFONO_INSTITUCIONES]
                    )
                ]);
                
                if (lanzamientosRes.error || institucionesRes.error) throw new Error((lanzamientosRes.error || institucionesRes.error)?.error as string);
                records = lanzamientosRes.records;
                instRecords = institucionesRes.records;
            }

            const newInstitutionsMap = new Map<string, { id: string; phone?: string }>();
            instRecords.forEach(record => {
                const name = record[FIELD_NOMBRE_INSTITUCIONES];
                if (name) {
                    newInstitutionsMap.set(normalizeStringForComparison(name as string), {
                        id: record.id,
                        phone: record[FIELD_TELEFONO_INSTITUCIONES]
                    });
                }
            });
            setInstitutionsMap(newInstitutionsMap);

            const mappedRecords = records.map(r => r as LanzamientoPPS);
            
            const currentYear = new Date().getFullYear(); 
            const filterYear = 2024; // Mostrar desde 2024 para tener contexto en la demo

            const filteredRecords = mappedRecords.filter(pps => {
                const name = String(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '');
                if (name.toLowerCase().includes('uflo')) return false;

                const startDate = parseToUTCDate(pps[FIELD_FECHA_INICIO_LANZAMIENTOS]);
                if (!startDate) return false;

                const isRelevantDate = startDate.getUTCFullYear() >= filterYear;
                const isManaged = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] && 
                                  pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] !== 'Pendiente de Gestión' && 
                                  pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] !== 'Archivado';

                return isRelevantDate || isManaged;
            });

            setLanzamientos(filteredRecords);
            setLoadingState('loaded');

        } catch (err: any) {
             setError(err.message || 'Error al cargar datos');
             setLoadingState('error');
        }
    }, [isTestingMode]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = useCallback(async (id: string, updates: Partial<LanzamientoPPS>): Promise<boolean> => {
        setUpdatingIds(prev => new Set(prev).add(id));

        if (isTestingMode) {
            await mockDb.update('lanzamientos_pps', id, updates);
            setLanzamientos(prev => prev.map(pps => pps.id === id ? { ...pps, ...updates } : pps));
            setToastInfo({ message: 'Cambios (test) guardados.', type: 'success' });
            setUpdatingIds(prev => { const newSet = new Set(prev); newSet.delete(id); return newSet; });
            return true;
        }

        const { error: updateError } = await updateRecord(TABLE_NAME_LANZAMIENTOS_PPS, id, updates);
        
        let success = false;
        if (updateError) {
            setToastInfo({ message: 'Error al actualizar la práctica.', type: 'error' });
        } else {
            setToastInfo({ message: 'Práctica actualizada exitosamente.', type: 'success' });
            fetchData();
            success = true;
        }

        setUpdatingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });

        return success;
    }, [fetchData, isTestingMode]);

    const handleUpdateInstitutionPhone = useCallback(async (institutionId: string, phone: string): Promise<boolean> => {
      if (isTestingMode) {
          await mockDb.update('instituciones', institutionId, { [FIELD_TELEFONO_INSTITUCIONES]: phone });
          setInstitutionsMap(prev => {
              const newMap = new Map(prev);
              for (const [key, val] of newMap.entries()) {
                  if (val.id === institutionId) {
                      newMap.set(key, { ...val, phone });
                      break;
                  }
              }
              return newMap;
          });
          setToastInfo({ message: 'Teléfono (test) guardado.', type: 'success' });
          return true;
      }

      const { error: updateError } = await updateRecord(TABLE_NAME_INSTITUCIONES, institutionId, {
          [FIELD_TELEFONO_INSTITUCIONES]: phone
      });

      if (updateError) {
          setToastInfo({ message: 'Error al guardar el teléfono.', type: 'error' });
          return false;
      } else {
          setToastInfo({ message: 'Teléfono guardado exitosamente.', type: 'success' });
          setInstitutionsMap(prevMap => {
              const newMap = new Map(prevMap);
              for (const [key, value] of newMap.entries()) {
                  if (value.id === institutionId) {
                      newMap.set(key, { ...value, phone });
                      break;
                  }
              }
              return newMap;
          });
          return true;
      }
    }, [isTestingMode]);

    const handleSync = async () => {
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 1000);
    };

    const handleLinkOrphans = async () => {
        setIsLinking(true);
        setTimeout(() => setIsLinking(false), 1000);
    };
    
    const filteredData = useMemo(() => {
        // Explicitly type processableItems as LanzamientoPPS[] to ensure property recognition
        let processableItems: LanzamientoPPS[] = [...lanzamientos];

        if (forcedOrientations && forcedOrientations.length > 0) {
            const normalizedForced = forcedOrientations.map(normalizeStringForComparison);
            processableItems = processableItems.filter(pps => {
                const ppsOrientations = (pps[FIELD_ORIENTACION_LANZAMIENTOS] || '').split(',').map((o: string) => normalizeStringForComparison(o.trim()));
                return ppsOrientations.some((o: string) => normalizedForced.includes(o));
            });
        } else if (orientationFilter !== 'all') {
             processableItems = processableItems.filter(pps => normalizeStringForComparison(pps[FIELD_ORIENTACION_LANZAMIENTOS]) === normalizeStringForComparison(orientationFilter));
        }

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            processableItems = processableItems.filter(pps => (pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '').toLowerCase().includes(lowercasedTerm));
        }
        
        // Use typed array to prevent 'unknown' issues during filtering and mapping
        const relanzamientosConfirmados: LanzamientoPPS[] = processableItems.filter((pps) => {
            const status = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS];
            const startDate = parseToUTCDate(pps[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            if (status === 'Relanzamiento Confirmado') return true;
            if (startDate && startDate.getUTCFullYear() >= 2026) return true;
            return false;
        });

        const confirmedNames = new Set(relanzamientosConfirmados.map(r => 
            normalizeStringForComparison(getGroupName(r[FIELD_NOMBRE_PPS_LANZAMIENTOS]))
        ));

        const pendingMap = new Map<string, LanzamientoPPS & { daysLeft?: number }>();
        const now = new Date();

        // Fix: Cast pps to 'any' to avoid strict type checks on unknown during iteration
        processableItems.forEach((ppsItem) => {
            const pps = ppsItem as any;

            if (relanzamientosConfirmados.some((c: any) => c.id === pps.id)) return;

            const status = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] || '';
            if (status === 'Archivado' || status === 'No se Relanza') return;

            const name = pps[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (!name) return;
            
            const groupName = getGroupName(name);
            const normalizedKey = normalizeStringForComparison(groupName);

            if (confirmedNames.has(normalizedKey)) return;

            const endDateStr = pps[FIELD_FECHA_FIN_LANZAMIENTOS];
            const endDate = parseToUTCDate(endDateStr);
            const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 999;

            if (!pendingMap.has(normalizedKey)) {
                // Fix: Cast pps back to LanzamientoPPS and spread
                pendingMap.set(normalizedKey, { ...pps, daysLeft } as (LanzamientoPPS & { daysLeft: number }));
            } else {
                const existing = pendingMap.get(normalizedKey)!;
                if (daysLeft < (existing.daysLeft || 999)) {
                    // Fix: Cast pps back to LanzamientoPPS and spread
                    pendingMap.set(normalizedKey, { ...pps, daysLeft } as (LanzamientoPPS & { daysLeft: number }));
                }
            }
        });
        
        let pendientesDeGestion = Array.from(pendingMap.values());
        
        if (filterType === 'vencidas') {
            pendientesDeGestion = pendientesDeGestion.filter(p => (p.daysLeft !== undefined && p.daysLeft < 0));
        } else if (filterType === 'proximas') {
            pendientesDeGestion = pendientesDeGestion.filter(p => (p.daysLeft !== undefined && p.daysLeft >= 0 && p.daysLeft <= 30));
        }

        pendientesDeGestion.sort((a, b) => {
             const dlA = a.daysLeft !== undefined ? a.daysLeft : 999;
             const dlB = b.daysLeft !== undefined ? b.daysLeft : 999;
             if (Math.abs(dlA) !== Math.abs(dlB)) return dlA - dlB;

             const nameA = a[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '';
             const nameB = b[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '';
             return nameA.localeCompare(nameB);
        });

        return { 
            relanzamientosConfirmados, 
            pendientesDeGestion,
            activasYPorFinalizar: [], 
            finalizadasParaReactivar: [], 
            activasIndefinidas: [] 
        };
    }, [lanzamientos, searchTerm, orientationFilter, forcedOrientations, filterType]);

    return {
        institutionsMap,
        loadingState,
        error,
        toastInfo,
        setToastInfo,
        updatingIds,
        searchTerm,
        setSearchTerm,
        orientationFilter,
        setOrientationFilter,
        filterType,
        setFilterType,
        isSyncing,
        isLinking,
        handleSave,
        handleUpdateInstitutionPhone,
        handleSync,
        handleLinkOrphans,
        filteredData,
    };
};
