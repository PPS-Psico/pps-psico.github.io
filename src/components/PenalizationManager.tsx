
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminSearch from './AdminSearch';
import { fetchAllData, createRecord, deleteRecord, updateRecord } from '../services/supabaseService';
import { mockDb } from '../services/mockDb';
import type { EstudianteFields, Penalizacion, PenalizacionFields, ConvocatoriaFields, PracticaFields, LanzamientoPPSFields, AirtableRecord } from '../types';
import {
  TABLE_NAME_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  TABLE_NAME_PENALIZACIONES,
  FIELD_PENALIZACION_ESTUDIANTE_LINK,
  FIELD_PENALIZACION_TIPO,
  FIELD_PENALIZACION_FECHA,
  FIELD_PENALIZACION_NOTAS,
  FIELD_PENALIZACION_PUNTAJE,
  TABLE_NAME_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  TABLE_NAME_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_PENALIZACION_CONVOCATORIA_LINK,
  FIELD_LEGAJO_CONVOCATORIAS,
  FIELD_NOMBRE_BUSQUEDA_PRACTICAS,
} from '../constants';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Toast from './Toast';
import Card from './Card';
import ConfirmModal from './ConfirmModal';
import { formatDate } from '../utils/formatters';
import { mapConvocatoria, mapLanzamiento, mapPenalizacion, mapPractica, mapEstudiante } from '../utils/mappers';

const PENALTY_TYPES = [
    'Baja Anticipada',
    'Baja sobre la Fecha / Ausencia en Inicio',
    'Abandono durante la PPS',
    'Falta sin Aviso',
];

interface SelectedStudent {
  id: string;
  legajo: string;
  nombre: string;
}

interface PenalizedStudent {
  id: string;
  legajo: string;
  nombre: string;
  totalScore: number;
  penalties: (Penalizacion & { id: string; ppsName?: string; })[];
}

const AddPenaltyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    student: SelectedStudent;
    onSuccess: () => void;
    isTestingMode?: boolean;
}> = ({ isOpen, onClose, student, onSuccess, isTestingMode = false }) => {
    const [penaltyType, setPenaltyType] = useState(PENALTY_TYPES[0]);
    const [notes, setNotes] = useState('');
    const [selectedPpsId, setSelectedPpsId] = useState<string>('');
    const queryClient = useQueryClient();

    const { data: relevantPPS, isLoading: isLoadingPPS } = useQuery({
        queryKey: ['relevantPPSForModal', student.id, isTestingMode],
        queryFn: async () => {
            if (isTestingMode) {
                // Return dummy data or fetch from mock
                const mockRecs = await mockDb.getAll('lanzamientos_pps');
                return mockRecs.map((r: any) => ({
                    id: r.id,
                    name: `${r[FIELD_NOMBRE_PPS_LANZAMIENTOS]} (${formatDate(r[FIELD_FECHA_INICIO_LANZAMIENTOS])})`
                }));
            }
            
            // 1. Fetch Convocatorias for this student (Native Filter)
            const convocatoriasRes = await fetchAllData(
                TABLE_NAME_CONVOCATORIAS, 
                [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS],
                { 
                    [FIELD_LEGAJO_CONVOCATORIAS]: student.legajo,
                    [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: ['Seleccionado', 'Inscripto']
                }
            );

            // 2. Fetch Practicas for this student (Native Filter)
            const practicasRes = await fetchAllData(
                TABLE_NAME_PRACTICAS,
                [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, FIELD_ESTADO_PRACTICA],
                {
                    [FIELD_NOMBRE_BUSQUEDA_PRACTICAS]: student.legajo, 
                    [FIELD_ESTADO_PRACTICA]: 'En curso'
                }
            );

            const convocatorias = convocatoriasRes.records.map(mapConvocatoria);
            const practicas = practicasRes.records.map(mapPractica);

            const lanzamientoIds = new Set<string>();
            
            convocatorias.forEach(c => {
                const ids = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                (Array.isArray(ids) ? ids : [ids]).filter(Boolean).forEach(id => lanzamientoIds.add(id as string));
            });
            
            practicas.forEach(p => {
                const ids = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
                (Array.isArray(ids) ? ids : [ids]).filter(Boolean).forEach(id => lanzamientoIds.add(id as string));
            });
            
            if (lanzamientoIds.size === 0) return [];
            
            // 3. Fetch Launches details (Native Filter)
            const lanzamientosRes = await fetchAllData(
                TABLE_NAME_LANZAMIENTOS_PPS,
                [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS],
                { id: Array.from(lanzamientoIds) }
            );
            
            return lanzamientosRes.records.map(mapLanzamiento).map(r => ({ 
                id: r.id, 
                name: `${r[FIELD_NOMBRE_PPS_LANZAMIENTOS]} (${formatDate(r[FIELD_FECHA_INICIO_LANZAMIENTOS])})` 
            }));
        },
        enabled: isOpen,
    });

    const applyPenaltyMutation = useMutation({
        mutationFn: async (penaltyData: any) => {
            if (isTestingMode) {
                console.log("TEST MODE: Applying penalty:", penaltyData);
                await mockDb.create('penalizaciones', penaltyData);
                return;
            }
            const penaltyResult = await createRecord(TABLE_NAME_PENALIZACIONES, penaltyData);
            if (penaltyResult.error) {
                const errorMsg = typeof penaltyResult.error.error === 'string' ? penaltyResult.error.error : penaltyResult.error.error.message;
                throw new Error(`Error al crear la penalización: ${errorMsg}`);
            }

            const triggerTypes = ['Baja Anticipada', 'Baja sobre la Fecha / Ausencia en Inicio', 'Abandono durante la PPS'];
            if (selectedPpsId && triggerTypes.includes(penaltyType)) {
                // Auto-unsubscribe logic
                const ppsId = selectedPpsId;
                
                const [convocatoriasRes, practicasRes] = await Promise.all([
                    fetchAllData(TABLE_NAME_CONVOCATORIAS, undefined, { [FIELD_LEGAJO_CONVOCATORIAS]: student.legajo }),
                    fetchAllData(TABLE_NAME_PRACTICAS, undefined, { [FIELD_NOMBRE_BUSQUEDA_PRACTICAS]: student.legajo }),
                ]);

                const targetConv = convocatoriasRes.records.map(mapConvocatoria).find(c => {
                    const ids = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                    const linked = (Array.isArray(ids) ? ids : [ids]).includes(ppsId);
                    return linked;
                });
                
                const targetPractica = practicasRes.records.map(mapPractica).find(p => {
                    const ids = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
                    const linked = (Array.isArray(ids) ? ids : [ids]).includes(ppsId);
                    return linked;
                });
                
                const sideEffectPromises = [];
                if (targetConv) {
                    sideEffectPromises.push(
                        updateRecord(TABLE_NAME_CONVOCATORIAS, targetConv.id, { [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: 'No Seleccionado' })
                    );
                }
    
                if (targetPractica) {
                    sideEffectPromises.push(deleteRecord(TABLE_NAME_PRACTICAS, targetPractica.id));
                }
                
                if (sideEffectPromises.length > 0) {
                    await Promise.all(sideEffectPromises);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allPenalizedStudents'] });
            onSuccess();
            onClose();
        },
        onError: (error: Error) => {
            alert(`Error: ${error.message}`);
        }
    });

    const handleSave = () => {
        const penaltyData: any = {
            [FIELD_PENALIZACION_ESTUDIANTE_LINK]: student.id,
            [FIELD_PENALIZACION_TIPO]: penaltyType,
            [FIELD_PENALIZACION_FECHA]: new Date().toISOString().split('T')[0],
            [FIELD_PENALIZACION_NOTAS]: notes,
            [FIELD_PENALIZACION_PUNTAJE]: 10, // Default penalty points, adjust logic as needed
        };
        if (selectedPpsId) penaltyData[FIELD_PENALIZACION_CONVOCATORIA_LINK] = selectedPpsId;
        applyPenaltyMutation.mutate(penaltyData);
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold">Aplicar Penalización a <span className="text-blue-600">{student.nombre}</span></h3>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="pps-select-modal" className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">PPS Afectada (Opcional)</label>
                        {isLoadingPPS ? <p>Cargando PPS...</p> : (
                            <select id="pps-select-modal" value={selectedPpsId} onChange={e => setSelectedPpsId(e.target.value)} className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700">
                                <option value="">Seleccionar una PPS...</option>
                                {relevantPPS?.map(pps => <option key={pps.id} value={pps.id}>{pps.name}</option>)}
                            </select>
                        )}
                    </div>
                    <div>
                        <label htmlFor="penalty-type-modal" className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">Tipo de Incumplimiento</label>
                        <select id="penalty-type-modal" value={penaltyType} onChange={e => setPenaltyType(e.target.value)} className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700">
                            {PENALTY_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="penalty-notes-modal" className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">Notas (Opcional)</label>
                        <textarea id="penalty-notes-modal" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 p-2 bg-white dark:bg-slate-700" />
                    </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                    <button onClick={handleSave} disabled={applyPenaltyMutation.isPending} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400">{applyPenaltyMutation.isPending ? 'Guardando...' : 'Guardar'}</button>
                </div>
            </div>
        </div>
    );
};


const PenalizedStudentCard: React.FC<{
  student: PenalizedStudent;
  onDeleteRequest: (penaltyId: string) => void;
  deletingId: string | null;
}> = ({ student, onDeleteRequest, deletingId }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const scoreVisuals = useMemo(() => {
    if (student.totalScore >= 21) {
      return {
        bgColor: 'bg-red-50 dark:bg-red-900/30',
        borderColor: 'border-red-200 dark:border-red-600',
        textColor: 'text-red-600 dark:text-red-400',
        icon: 'local_fire_department',
        ringColor: 'ring-red-500/20'
      };
    }
    if (student.totalScore >= 11) {
      return {
        bgColor: 'bg-amber-50 dark:bg-amber-900/30',
        borderColor: 'border-amber-200 dark:border-amber-600',
        textColor: 'text-amber-600 dark:text-amber-400',
        icon: 'warning_amber',
        ringColor: 'ring-amber-500/20'
      };
    }
    return {
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
      borderColor: 'border-yellow-200 dark:border-yellow-600',
      textColor: 'text-yellow-700 dark:text-yellow-500',
      icon: 'priority_high',
      ringColor: 'ring-yellow-500/20'
    };
  }, [student.totalScore]);
  
  const getPenaltyIcon = (type: string | undefined) => {
    if (!type) return 'gavel';
    const normType = type.toLowerCase();
    if (normType.includes('baja anticipada')) return 'event_busy';
    if (normType.includes('baja sobre la fecha') || normType.includes('ausencia')) return 'no_accounts';
    if (normType.includes('abandono')) return 'directions_run';
    if (normType.includes('falta sin aviso')) return 'person_off';
    return 'gavel';
  };

  return (
    <div className={`rounded-xl border transition-all duration-300 ${isExpanded ? `shadow-lg ring-4 ${scoreVisuals.ringColor}` : 'shadow-sm'} ${scoreVisuals.borderColor}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 flex justify-between items-center cursor-pointer"
        aria-expanded={isExpanded}
        aria-controls={`penalties-for-${student.legajo}`}
      >
        <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${scoreVisuals.bgColor}`}>
                <span className={`material-icons ${scoreVisuals.textColor}`}>{scoreVisuals.icon}</span>
            </div>
            <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">{student.nombre}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">Legajo: {student.legajo}</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className={`text-3xl font-black ${scoreVisuals.textColor}`}>{student.totalScore}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">puntos</p>
            </div>
            <span className={`material-icons text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              expand_more
            </span>
        </div>
      </button>

      {isExpanded && (
        <div id={`penalties-for-${student.legajo}`} className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
          <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">Historial de Incumplimientos</h4>
          <div className="space-y-3">
            {student.penalties.map(p => (
              <div key={p.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-start gap-4">
                <span className="material-icons text-slate-400 dark:text-slate-500 mt-1">{getPenaltyIcon(p[FIELD_PENALIZACION_TIPO])}</span>
                <div className="flex-grow">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{p[FIELD_PENALIZACION_TIPO]}</p>
                      {p.ppsName && <p className="text-xs text-slate-500 dark:text-slate-400">PPS: {p.ppsName}</p>}
                    </div>
                     <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(p[FIELD_PENALIZACION_FECHA])}</p>
                  </div>
                   {p[FIELD_PENALIZACION_NOTAS] && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 border-l-2 border-slate-200 dark:border-slate-600 pl-2 italic">{p[FIELD_PENALIZACION_NOTAS]}</p>}
                </div>
                <button 
                  onClick={() => onDeleteRequest(p.id)} 
                  disabled={deletingId === p.id}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/50 dark:hover:text-rose-400 disabled:opacity-50"
                  aria-label="Eliminar penalización"
                >
                  {deletingId === p.id
                    ? <div className="w-4 h-4 border-2 border-rose-400/50 border-t-rose-500 rounded-full animate-spin"/>
                    : <span className="material-icons !text-base">delete_outline</span>
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface PenalizationManagerProps {
  isTestingMode?: boolean;
}

const PenalizationManager: React.FC<PenalizationManagerProps> = ({ isTestingMode = false }) => {
    const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [penaltyToDelete, setPenaltyToDelete] = useState<string | null>(null); // State for modal
    const queryClient = useQueryClient();

    const { data: penalizedStudents, isLoading } = useQuery<PenalizedStudent[]>({
        queryKey: ['allPenalizedStudents', isTestingMode],
        queryFn: async () => {
            let penaltiesRes: any[] = [], studentsRes: any[] = [], lanzamientosRes: any[] = [];

            if (isTestingMode) {
                 [penaltiesRes, studentsRes, lanzamientosRes] = await Promise.all([
                    mockDb.getAll('penalizaciones'),
                    mockDb.getAll('estudiantes'),
                    mockDb.getAll('lanzamientos_pps')
                ]);
            } else {
                 const [p, s, l] = await Promise.all([
                    fetchAllData(TABLE_NAME_PENALIZACIONES),
                    fetchAllData(TABLE_NAME_ESTUDIANTES, [FIELD_LEGAJO_ESTUDIANTES, FIELD_NOMBRE_ESTUDIANTES]),
                    fetchAllData(TABLE_NAME_LANZAMIENTOS_PPS, [FIELD_NOMBRE_PPS_LANZAMIENTOS])
                ]);
                penaltiesRes = p.records.map(mapPenalizacion);
                studentsRes = s.records.map(mapEstudiante);
                lanzamientosRes = l.records.map(mapLanzamiento);
            }

            const studentsMap = new Map<string, { legajo: string, nombre: string }>();
            studentsRes.forEach((r: any) => {
                if(r[FIELD_LEGAJO_ESTUDIANTES] && r[FIELD_NOMBRE_ESTUDIANTES]) {
                    studentsMap.set(r.id, { legajo: String(r[FIELD_LEGAJO_ESTUDIANTES]), nombre: String(r[FIELD_NOMBRE_ESTUDIANTES]) });
                }
            });
            
            const lanzamientosMap = new Map<string, string>();
            lanzamientosRes.forEach((r: any) => {
                if(r[FIELD_NOMBRE_PPS_LANZAMIENTOS]) {
                    lanzamientosMap.set(r.id, String(r[FIELD_NOMBRE_PPS_LANZAMIENTOS]));
                }
            });
            
            const penaltiesByStudent = new Map<string, PenalizedStudent>();
            penaltiesRes.forEach((p: any) => {
                const rawStudentLink = p[FIELD_PENALIZACION_ESTUDIANTE_LINK];
                const studentId = (Array.isArray(rawStudentLink) ? rawStudentLink[0] : rawStudentLink);
                const studentInfo = studentId ? studentsMap.get(studentId) : null;
                if (!studentInfo) return;

                if (!penaltiesByStudent.has(studentId)) {
                    penaltiesByStudent.set(studentId, {
                        id: studentId,
                        legajo: studentInfo.legajo,
                        nombre: studentInfo.nombre,
                        totalScore: 0,
                        penalties: [],
                    });
                }
                const studentData = penaltiesByStudent.get(studentId)!;
                const rawPpsLink = p[FIELD_PENALIZACION_CONVOCATORIA_LINK];
                const ppsId = (Array.isArray(rawPpsLink) ? rawPpsLink[0] : rawPpsLink);
                
                const penaltyToAdd = {
                    ...p,
                    ppsName: ppsId ? lanzamientosMap.get(ppsId) : undefined 
                };
                studentData.penalties.push(penaltyToAdd);
                studentData.totalScore += p[FIELD_PENALIZACION_PUNTAJE] || 0;
            });
            return Array.from(penaltiesByStudent.values()).sort((a,b) => b.totalScore - a.totalScore);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (penaltyId: string) => {
            if (isTestingMode) {
                return mockDb.delete('penalizaciones', penaltyId);
            }
            return deleteRecord(TABLE_NAME_PENALIZACIONES, penaltyId)
        },
        onSuccess: () => {
            setToastInfo({ message: 'Penalización eliminada.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['allPenalizedStudents'] });
        },
        onError: () => {
            setToastInfo({ message: 'Error al eliminar la penalización.', type: 'error' });
        },
        onSettled: () => {
            setDeletingId(null);
            setPenaltyToDelete(null);
        }
    });

    const handleDeleteRequest = (penaltyId: string) => {
        setPenaltyToDelete(penaltyId);
    };

    const confirmDelete = () => {
        if (penaltyToDelete) {
            setDeletingId(penaltyToDelete);
            deleteMutation.mutate(penaltyToDelete);
        }
    };
    
    const handleStudentSelect = useCallback((student: AirtableRecord<EstudianteFields>) => {
        if (!student[FIELD_LEGAJO_ESTUDIANTES] || !student[FIELD_NOMBRE_ESTUDIANTES]) {
            setToastInfo({ message: 'El registro del estudiante está incompleto.', type: 'error' });
            return;
        }
        setSelectedStudent({
            id: student.id,
            legajo: String(student[FIELD_LEGAJO_ESTUDIANTES]),
            nombre: String(student[FIELD_NOMBRE_ESTUDIANTES])
        });
        setIsModalOpen(true);
    }, []);

    return (
        <div className="space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            {selectedStudent && <AddPenaltyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} student={selectedStudent} onSuccess={() => setToastInfo({message: 'Penalización aplicada con éxito.', type: 'success'})} isTestingMode={isTestingMode} />}
            
            <ConfirmModal 
                isOpen={!!penaltyToDelete}
                title="Eliminar Penalización"
                message="¿Estás seguro de que quieres eliminar este registro de penalización? Esta acción afectará el puntaje del alumno y no se puede deshacer."
                onConfirm={confirmDelete}
                onClose={() => setPenaltyToDelete(null)}
                confirmText="Eliminar"
                cancelText="Cancelar"
                type="danger"
            />

            <Card title="Panel de Penalizaciones" icon="gavel" description="Aplica y gestiona las penalizaciones por incumplimientos de los estudiantes.">
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                     <AdminSearch onStudentSelect={handleStudentSelect} isTestingMode={isTestingMode} />
                </div>
            </Card>

            <div>
                {isLoading ? <Loader /> : (
                    penalizedStudents && penalizedStudents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {penalizedStudents.map(student => (
                                <PenalizedStudentCard key={student.id} student={student} onDeleteRequest={handleDeleteRequest} deletingId={deletingId} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon="verified_user" title="Sin Penalizaciones" message="No hay estudiantes con penalizaciones registradas." />
                    )
                )}
            </div>
        </div>
    );
};

export default PenalizationManager;
