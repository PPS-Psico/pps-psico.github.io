
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../lib/db';
import { fetchCorrectionPanelData } from '../services/dataService';
import type { InformeCorreccionPPS, InformeCorreccionStudent, FlatCorreccionStudent } from '../types';
import {
  FIELD_NOTA_PRACTICAS,
  FIELD_INFORME_SUBIDO_CONVOCATORIAS,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS
} from '../constants';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Toast from './Toast';
import InformeCorreccionCard from './InformeCorreccionCard';
import CorreccionRapidaView from './CorreccionRapidaView';
import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import ErrorState from './ErrorState';

type LoadingState = 'initial' | 'loading' | 'loaded' | 'error';
type Manager = 'Selva Estrella' | 'Franco Pedraza' | 'Cynthia Rossi';
type ViewMode = 'byPps' | 'flatList';

const managerConfig: Record<Manager, { orientations: string[], label: string }> = {
  'Selva Estrella': { orientations: ['clinica'], label: 'Selva Estrella (Clínica)' },
  'Franco Pedraza': { orientations: ['educacional'], label: 'Franco Pedraza (Educacional)' },
  'Cynthia Rossi': { orientations: ['laboral', 'comunitaria'], label: 'Cynthia Rossi (Laboral & Comunitaria)' }
};

interface CorreccionPanelProps {
  isTestingMode?: boolean;
}

const CorreccionPanel: React.FC<CorreccionPanelProps> = ({ isTestingMode = false }) => {
  const { isJefeMode } = useAuth();
  const [loadingState, setLoadingState] = useState<LoadingState>('initial');
  const [error, setError] = useState<string | null>(null);
  const [allPpsGroups, setAllPpsGroups] = useState<Map<string, InformeCorreccionPPS>>(new Map());
  const [activeManager, setActiveManager] = useState<Manager>('Selva Estrella');
  const [updatingNotaId, setUpdatingNotaId] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('byPps');

  const [selectedStudents, setSelectedStudents] = useState<Map<string, Set<string>>>(new Map());
  const [batchUpdatingLanzamientoId, setBatchUpdatingLanzamientoId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoadingState('loading');
    setError(null);

    if (isTestingMode) {
      setAllPpsGroups(new Map());
      setLoadingState('loaded');
      return;
    }

    try {
      // Use the new service function to fetch all correction data
      const ppsGroups = await fetchCorrectionPanelData();
      
      setAllPpsGroups(ppsGroups);
      setLoadingState('loaded');

    } catch (e: any) {
        console.error("Error fetching correction data:", e);
        setError(e.message || 'Ocurrió un error inesperado al cargar los datos.');
        setLoadingState('error');
    }
  }, [isTestingMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNotaChange = useCallback(async (student: InformeCorreccionStudent, newNota: string) => {
    if (isTestingMode) {
      setToastInfo({ message: 'Modo de prueba: La nota no se guardará.', type: 'success' });
      return;
    }
    setUpdatingNotaId(student.practicaId || `creating-${student.studentId}`);
    try {
        let practicaId = student.practicaId;

        if (!practicaId) {
            const ppsGroup = allPpsGroups.get(student.lanzamientoId);
            if (!ppsGroup) {
                throw new Error("No se pudo encontrar el grupo de PPS para crear el registro de la práctica.");
            }
            const newPractica = await db.practicas.create({
                [FIELD_ESTUDIANTE_LINK_PRACTICAS]: [student.studentId],
                [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: [student.lanzamientoId],
                [FIELD_ESPECIALIDAD_PRACTICAS]: student.orientacion,
                [FIELD_FECHA_INICIO_PRACTICAS]: student.fechaInicio || ppsGroup.fechaFinalizacion, 
                [FIELD_FECHA_FIN_PRACTICAS]: student.fechaFinalizacionPPS,
                [FIELD_NOTA_PRACTICAS]: newNota
            } as any);
            if (newPractica) {
                practicaId = newPractica.id;
            } else {
                throw new Error("No se pudo crear el registro de la práctica.");
            }
        } else {
            await db.practicas.update(practicaId, { [FIELD_NOTA_PRACTICAS]: newNota });
        }
        
        if (newNota === 'No Entregado') {
            await db.convocatorias.update(student.convocatoriaId, { [FIELD_INFORME_SUBIDO_CONVOCATORIAS]: false });
        }
        
        // Optimistic update
        setAllPpsGroups((prev: Map<string, InformeCorreccionPPS>) => {
            const newGroups = new Map<string, InformeCorreccionPPS>(prev);
            const group = newGroups.get(student.lanzamientoId);
            if (group) {
                const studentToUpdate = group.students.find(s => s.studentId === student.studentId);
                if (studentToUpdate) {
                    studentToUpdate.nota = newNota;
                    if (!studentToUpdate.practicaId) studentToUpdate.practicaId = practicaId;
                    if (newNota === 'No Entregado') studentToUpdate.informeSubido = false;
                }
            }
            return newGroups;
        });

    } catch (e: any) {
        setToastInfo({ message: `Error al guardar: ${e.message}`, type: 'error' });
    } finally {
        setUpdatingNotaId(null);
    }
  }, [isTestingMode, allPpsGroups]);
  
  const handleSelectionChange = (practicaId: string) => {
    setSelectedStudents((prev: Map<string, Set<string>>) => {
        const newSelection = new Map<string, Set<string>>(prev);
        for (const [lanzamientoId, selectedSet] of newSelection.entries()) {
            if (selectedSet.has(practicaId)) {
                selectedSet.delete(practicaId);
                if (selectedSet.size === 0) {
                    newSelection.delete(lanzamientoId);
                }
                return newSelection;
            }
        }
        
        for (const [lanzamientoId, ppsGroup] of allPpsGroups) {
            if (ppsGroup.students.some(s => s.practicaId === practicaId)) {
                if (!newSelection.has(lanzamientoId)) {
                    newSelection.set(lanzamientoId, new Set());
                }
                newSelection.get(lanzamientoId)!.add(practicaId);
                break;
            }
        }
        return newSelection;
    });
  };

  const handleSelectAll = (practicaIds: string[], select: boolean) => {
    if (practicaIds.length === 0) return;
    const firstPracticaId = practicaIds[0];
    let lanzamientoIdForGroup: string | null = null;
    
    for (const ppsGroup of allPpsGroups.values()) {
        if (ppsGroup.students.some(s => s.practicaId === firstPracticaId)) {
            lanzamientoIdForGroup = ppsGroup.lanzamientoId;
            break;
        }
    }
    
    if (!lanzamientoIdForGroup) return;

    setSelectedStudents((prev: Map<string, Set<string>>) => {
        const newSelection = new Map<string, Set<string>>(prev);
        if (select) {
            newSelection.set(lanzamientoIdForGroup!, new Set(practicaIds));
        } else {
            newSelection.delete(lanzamientoIdForGroup!);
        }
        return newSelection;
    });
  };

  const handleBatchUpdate = async (newNota: string) => {
    const selectedEntries = Array.from(selectedStudents);
    if (selectedEntries.length === 0) return;
    
    const [lanzamientoId, practicaIdSet] = selectedEntries[0] as [string, Set<string>];
    const ppsGroup = allPpsGroups.get(lanzamientoId);
    if (!ppsGroup) return;

    setBatchUpdatingLanzamientoId(lanzamientoId);
    try {
        const updates = Array.from(practicaIdSet).map(practicaId => ({
            id: practicaId,
            fields: { [FIELD_NOTA_PRACTICAS]: newNota }
        }));
        
        if (isTestingMode) {
            console.log("TEST MODE: Batch updating:", updates);
            await new Promise(res => setTimeout(res, 1000));
        } else {
            await db.practicas.updateMany(updates as any);
        }

        setAllPpsGroups((prev: Map<string, InformeCorreccionPPS>) => {
            const newGroups = new Map<string, InformeCorreccionPPS>(prev);
            const group = newGroups.get(lanzamientoId);
            if (group) {
                group.students.forEach(s => {
                    if (s.practicaId && practicaIdSet.has(s.practicaId)) {
                        s.nota = newNota;
                    }
                });
            }
            return newGroups;
        });

        setSelectedStudents(new Map());
        setToastInfo({ message: `${practicaIdSet.size} notas actualizadas a "${newNota}".`, type: 'success' });
    } catch (e: any) {
        setToastInfo({ message: `Error en lote: ${e.message}`, type: 'error' });
    } finally {
        setBatchUpdatingLanzamientoId(null);
    }
  };


  const filteredAndSortedGroups = useMemo<InformeCorreccionPPS[]>(() => {
    let groups: InformeCorreccionPPS[] = Array.from(allPpsGroups.values());
    const managerOrientations = isJefeMode
      ? managerConfig[activeManager].orientations.map(normalizeStringForComparison)
      : [];

    if (isJefeMode) {
      groups = groups.filter((g: InformeCorreccionPPS) => g.orientacion && managerOrientations.includes(normalizeStringForComparison(g.orientacion)));
    }
    
    if (searchTerm) {
      const lowerSearch = normalizeStringForComparison(searchTerm);
      groups = groups.map((group: InformeCorreccionPPS) => {
        const filteredStudents = group.students.filter(student => 
          normalizeStringForComparison(student.studentName).includes(lowerSearch) ||
          normalizeStringForComparison(group.ppsName || '').includes(lowerSearch)
        );
        return { ...group, students: filteredStudents };
      }).filter(group => group.students.length > 0);
    }
    
    return groups.sort((a: InformeCorreccionPPS, b: InformeCorreccionPPS) => {
        const aDate = a.fechaFinalizacion ? new Date(a.fechaFinalizacion) : new Date(0);
        const bDate = b.fechaFinalizacion ? new Date(b.fechaFinalizacion) : new Date(0);
        return bDate.getTime() - aDate.getTime();
    });
  }, [allPpsGroups, isJefeMode, activeManager, searchTerm]);

  const flatStudentList = useMemo(() => {
    if (viewMode === 'byPps') return [];
    
    return filteredAndSortedGroups.flatMap((group: InformeCorreccionPPS) => {
      return (group.students || []).filter(s => s.informeSubido && (s.nota === 'Sin calificar' || s.nota === 'Entregado (sin corregir)'))
        .map((student): FlatCorreccionStudent => {
            let deadline: string | undefined;
            const baseDateString = student.fechaEntregaInforme || student.fechaFinalizacionPPS;
            const baseDate = parseToUTCDate(baseDateString);
            if(baseDate) {
                const d = new Date(baseDate);
                d.setDate(d.getDate() + 30);
                deadline = d.toISOString();
            }
            return {
                ...student,
                ppsName: group.ppsName,
                informeLink: group.informeLink,
                correctionDeadline: deadline
            }
        })
    });
  }, [filteredAndSortedGroups, viewMode]);


  if (loadingState === 'loading' || loadingState === 'initial') return <Loader />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="animate-fade-in-up space-y-6">
        {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50/70 dark:bg-gray-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <div className="relative w-full sm:w-72">
                <input type="search" placeholder="Buscar por alumno o PPS..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 dark:text-slate-500 !text-lg pointer-events-none">search</span>
            </div>
            <div className="flex items-center gap-2 p-1 bg-slate-200 dark:bg-slate-800 rounded-lg">
                <button onClick={() => setViewMode('byPps')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-2 ${viewMode === 'byPps' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-slate-50' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    <span className="material-icons !text-base">view_agenda</span> Agrupado
                </button>
                <button onClick={() => setViewMode('flatList')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-2 ${viewMode === 'flatList' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-slate-50' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    <span className="material-icons !text-base">view_list</span> Lista Rápida
                </button>
            </div>
            {isJefeMode && (
                <div className="relative w-full sm:w-64">
                    <select value={activeManager} onChange={e => setActiveManager(e.target.value as Manager)} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors appearance-none">
                        {Object.entries(managerConfig).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 dark:text-slate-500 !text-lg pointer-events-none">supervisor_account</span>
                </div>
            )}
        </div>

        {filteredAndSortedGroups.length === 0 ? (
            <EmptyState icon="task_alt" title="Todo Corregido" message="No hay informes pendientes de corrección que coincidan con los filtros actuales."/>
        ) : (
            viewMode === 'byPps' ? (
                <div className="space-y-6">
                    {filteredAndSortedGroups.map(group => (
                        <InformeCorreccionCard
                            key={group.lanzamientoId}
                            ppsGroup={group}
                            onNotaChange={handleNotaChange}
                            updatingNotaId={updatingNotaId}
                            selectedStudents={selectedStudents.get(group.lanzamientoId) || new Set()}
                            onSelectionChange={handleSelectionChange}
                            onSelectAll={(ids, select) => handleSelectAll(ids, select)}
                            onBatchUpdate={(nota) => handleBatchUpdate(nota)}
                            isBatchUpdating={batchUpdatingLanzamientoId === group.lanzamientoId}
                            searchTerm={searchTerm}
                        />
                    ))}
                </div>
            ) : (
                <CorreccionRapidaView
                    students={flatStudentList}
                    onNotaChange={handleNotaChange}
                    updatingNotaId={updatingNotaId}
                    searchTerm={searchTerm}
                />
            )
        )}
    </div>
  );
};

export default CorreccionPanel;
