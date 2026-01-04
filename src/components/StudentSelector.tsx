
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { toggleStudentSelection } from '../services/dataService';
import {
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
    FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_TERMINO_CURSAR_CONVOCATORIAS,
    FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS,
    FIELD_FINALES_ADEUDA_CONVOCATORIAS,
    FIELD_OTRA_SITUACION_CONVOCATORIAS,
    FIELD_HORARIO_FORMULA_CONVOCATORIAS,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_ESTUDIANTE_LINK_PRACTICAS,
    FIELD_HORAS_PRACTICAS,
    FIELD_PENALIZACION_ESTUDIANTE_LINK,
    FIELD_PENALIZACION_PUNTAJE,
} from '../constants';
import { normalizeStringForComparison, getEspecialidadClasses, formatDate } from '../utils/formatters';
import type { LanzamientoPPS, ConvocatoriaFields, EstudianteFields, PracticaFields, PenalizacionFields, AirtableRecord } from '../types';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Toast from './ui/Toast';
import Card from './ui/Card';
import { sendSmartEmail } from '../utils/emailService';

// --- Tipos y Constantes Auxiliares ---

interface EnrichedStudent {
    enrollmentId: string;
    studentId: string;
    nombre: string;
    legajo: string;
    correo: string;
    status: string;

    // Datos Académicos
    terminoCursar: boolean;
    cursandoElectivas: boolean;
    finalesAdeuda: string;
    notasEstudiante: string;

    // Datos Calculados
    totalHoras: number;
    penalizacionAcumulada: number;
    puntajeTotal: number;

    // Gestión
    horarioSeleccionado: string;
}

const SCORE_WEIGHTS = {
    TERMINO_CURSAR: 100,
    CURSANDO_ELECTIVAS: 50,
    BASE_FINALES: 30, // Puntaje base si debe finales
    PER_HOUR: 0.5,    // 0.5 puntos por hora realizada
};

const calculateScore = (
    enrollment: AirtableRecord<ConvocatoriaFields>,
    hours: number,
    penalties: number
): number => {
    let academicScore = 0;
    const termino = enrollment[FIELD_TERMINO_CURSAR_CONVOCATORIAS] === 'Sí';
    const electivas = enrollment[FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS] === 'Sí';

    if (termino) {
        academicScore = SCORE_WEIGHTS.TERMINO_CURSAR;
    } else if (electivas) {
        academicScore = SCORE_WEIGHTS.CURSANDO_ELECTIVAS;
    } else {
        academicScore = SCORE_WEIGHTS.BASE_FINALES;
    }

    const hoursScore = hours * SCORE_WEIGHTS.PER_HOUR;

    // Penalties are usually stored as positive numbers representing demerits, so we subtract.
    const penaltyScore = penalties;

    return Math.round(academicScore + hoursScore - penaltyScore);
};

const StudentRow: React.FC<{
    student: EnrichedStudent;
    onToggleSelection: (student: EnrichedStudent) => void;
    onUpdateSchedule: (id: string, newSchedule: string) => void;
    isUpdating: boolean;
}> = ({ student, onToggleSelection, onUpdateSchedule, isUpdating }) => {
    const [localSchedule, setLocalSchedule] = useState(student.horarioSeleccionado);
    const [isScheduleDirty, setIsScheduleDirty] = useState(false);
    const isSelected = normalizeStringForComparison(student.status) === 'seleccionado';

    const handleScheduleBlur = () => {
        if (isScheduleDirty && localSchedule !== student.horarioSeleccionado) {
            onUpdateSchedule(student.enrollmentId, localSchedule);
            setIsScheduleDirty(false);
        }
    };

    // Lógica para mostrar "Adeuda: X Finales" de forma limpia
    const finalesText = student.finalesAdeuda
        ? `Adeuda: ${student.finalesAdeuda}`
        : 'Adeuda finales';

    return (
        <div className={`p-4 rounded-xl border transition-all duration-300 ${isSelected ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'}`}>
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center">

                {/* Columna 1: Datos Personales y Puntaje */}
                <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex flex-col items-center gap-0.5">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border ${student.puntajeTotal >= 100 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`} title={`Puntaje Calculado: ${student.puntajeTotal}`}>
                                {student.puntajeTotal}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ptos.</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{student.nombre}</h4>
                            <p className="text-xs text-slate-500 font-mono">{student.legajo}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">Hs: {student.totalHoras}</span>
                        {student.penalizacionAcumulada > 0 && (
                            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-semibold">Penaliz: -{student.penalizacionAcumulada}</span>
                        )}
                    </div>
                </div>

                {/* Columna 2: Situación Académica */}
                <div className="flex-1 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs uppercase font-semibold">Estado:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                            {student.terminoCursar ? 'Terminó de Cursar' :
                                student.cursandoElectivas ? 'Cursando Electivas' :
                                    finalesText}
                        </span>
                    </div>
                    {student.notasEstudiante && (
                        <div className="text-xs italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                            "{student.notasEstudiante}"
                        </div>
                    )}
                </div>

                {/* Columna 3: Horario */}
                <div className="flex-1 min-w-[250px]">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Horario Preferido</label>
                    <input
                        type="text"
                        value={localSchedule}
                        onChange={(e) => { setLocalSchedule(e.target.value); setIsScheduleDirty(true); }}
                        onBlur={handleScheduleBlur}
                        className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Editar horario..."
                    />
                </div>

                {/* Columna 4: Acción */}
                <div className="flex-shrink-0 flex justify-end lg:w-40">
                    <button
                        onClick={() => onToggleSelection(student)}
                        disabled={isUpdating}
                        className={`w-full py-2 px-4 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${isSelected
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        {isUpdating ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <span className="material-icons !text-lg">{isSelected ? 'check' : 'add'}</span>
                                {isSelected ? 'Seleccionado' : 'Seleccionar'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SeleccionadorConvocatorias: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
    const [selectedLanzamiento, setSelectedLanzamiento] = useState<LanzamientoPPS | null>(null);
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // 1. Fetch Open Launches
    const { data: openLaunches = [], isLoading: isLoadingLaunches } = useQuery({
        queryKey: ['openLaunchesForSelector', isTestingMode],
        queryFn: async () => {
            if (isTestingMode) return [];

            const records = await db.lanzamientos.getAll({
                filters: { [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: ['Abierta', 'Abierto'] }
            });

            return records.map(r => ({ ...r, id: r.id } as LanzamientoPPS));
        }
    });

    // 2. Fetch Candidates for Selected Launch
    const { data: candidates = [], isLoading: isLoadingCandidates, refetch: refetchCandidates } = useQuery({
        queryKey: ['candidatesForLaunch', selectedLanzamiento?.id],
        queryFn: async () => {
            if (!selectedLanzamiento) return [];

            const launchId = selectedLanzamiento.id;

            // Fetch Enrollments
            const enrollments = await db.convocatorias.getAll({
                filters: { [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: launchId }
            });

            if (enrollments.length === 0) return [];

            const studentIds = enrollments.map(e => {
                const raw = e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
                return Array.isArray(raw) ? raw[0] : raw;
            }).filter(Boolean) as string[];

            // Parallel fetch for details
            const [studentsRes, practicasRes, penaltiesRes] = await Promise.all([
                db.estudiantes.getAll({
                    filters: { id: studentIds }
                }),
                db.practicas.getAll({
                    filters: { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds }
                }),
                db.penalizaciones.getAll({
                    filters: { [FIELD_PENALIZACION_ESTUDIANTE_LINK]: studentIds }
                })
            ]);

            const studentMap = new Map(studentsRes.map(s => [s.id, s]));

            // Aggregate Data
            const enrichedList: EnrichedStudent[] = enrollments.map(enrollment => {
                const sIdRaw = enrollment[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
                const sId = Array.isArray(sIdRaw) ? sIdRaw[0] : sIdRaw;
                const studentDetails = sId ? studentMap.get(String(sId)) : null;

                if (!studentDetails) return null;

                // Calc total hours
                const studentPractices = practicasRes.filter(p => {
                    const links = p[FIELD_ESTUDIANTE_LINK_PRACTICAS];
                    return Array.isArray(links) ? links.includes(String(sId)) : links === String(sId);
                });
                const totalHoras = studentPractices.reduce((sum, p) => sum + (p[FIELD_HORAS_PRACTICAS] || 0), 0);

                // Calc penalties
                const studentPenalties = penaltiesRes.filter(p => {
                    const links = p[FIELD_PENALIZACION_ESTUDIANTE_LINK];
                    return Array.isArray(links) ? links.includes(String(sId)) : links === String(sId);
                });
                const penalizacionAcumulada = studentPenalties.reduce((sum, p) => sum + (p[FIELD_PENALIZACION_PUNTAJE] || 0), 0);

                // Score
                const puntajeTotal = calculateScore(enrollment, totalHoras, penalizacionAcumulada);

                return {
                    enrollmentId: enrollment.id,
                    studentId: String(sId),
                    nombre: studentDetails[FIELD_NOMBRE_ESTUDIANTES] || 'Desconocido',
                    legajo: String(studentDetails[FIELD_LEGAJO_ESTUDIANTES] || ''),
                    correo: studentDetails[FIELD_CORREO_ESTUDIANTES] || '',
                    status: enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || 'Inscripto',
                    terminoCursar: enrollment[FIELD_TERMINO_CURSAR_CONVOCATORIAS] === 'Sí',
                    cursandoElectivas: enrollment[FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS] === 'Sí',
                    finalesAdeuda: enrollment[FIELD_FINALES_ADEUDA_CONVOCATORIAS] || '',
                    notasEstudiante: enrollment[FIELD_OTRA_SITUACION_CONVOCATORIAS] || '',
                    horarioSeleccionado: enrollment[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || '',
                    totalHoras,
                    penalizacionAcumulada,
                    puntajeTotal
                };
            }).filter((item): item is EnrichedStudent => item !== null);

            return enrichedList.sort((a, b) => b.puntajeTotal - a.puntajeTotal);
        },
        enabled: !!selectedLanzamiento
    });

    const selectedCandidates = useMemo(() =>
        candidates.filter(c => normalizeStringForComparison(c.status) === 'seleccionado'),
        [candidates]);

    const toggleMutation = useMutation({
        mutationFn: async (student: EnrichedStudent) => {
            if (!selectedLanzamiento) return;
            const isCurrentlySelected = normalizeStringForComparison(student.status) === 'seleccionado';
            const result = await toggleStudentSelection(
                student.enrollmentId,
                !isCurrentlySelected,
                student.studentId,
                selectedLanzamiento
            );
            return { ...result, student };
        },
        onSuccess: (data) => {
            if (!data?.success) {
                setToastInfo({ message: `Error: ${data?.error}`, type: 'error' });
                refetchCandidates();
            }
        },
        onError: (err) => setToastInfo({ message: `Error: ${err.message}`, type: 'error' }),
        onSettled: () => setUpdatingId(null)
    });

    const scheduleMutation = useMutation({
        mutationFn: async ({ id, schedule }: { id: string, schedule: string }) => {
            return db.convocatorias.update(id, { [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: schedule });
        },
        onSuccess: () => {
            setToastInfo({ message: 'Horario actualizado.', type: 'success' });
            refetchCandidates();
        }
    });

    // Mutation to Close Call
    const closeLaunchMutation = useMutation({
        mutationFn: async () => {
            if (!selectedLanzamiento) return;
            // Uses DB column constant
            return db.lanzamientos.update(selectedLanzamiento.id, {
                [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Cerrado'
            });
        },
        onSuccess: () => {
            setToastInfo({ message: 'Convocatoria cerrada exitosamente.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['openLaunchesForSelector'] });
            setSelectedLanzamiento(null);
        },
        onError: (err: Error) => {
            setToastInfo({ message: `Error al cerrar: ${err.message}`, type: 'error' });
        }
    });

    const handleToggle = (student: EnrichedStudent) => {
        setUpdatingId(student.enrollmentId);
        toggleMutation.mutate(student);
    };

    const handleUpdateSchedule = (id: string, newSchedule: string) => {
        scheduleMutation.mutate({ id, schedule: newSchedule });
    };

    const handleCloseLaunch = () => {
        if (window.confirm('¿Estás seguro de cerrar esta convocatoria? Esto hará visibles los resultados a los alumnos.')) {
            closeLaunchMutation.mutate();
        }
    };

    if (isLoadingLaunches) return <div className="flex justify-center p-10"><Loader /></div>;

    // View 1: Launch Selector
    if (!selectedLanzamiento) {
        return (
            <div className="animate-fade-in-up">
                {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
                <h3 className="text-xl font-bold mb-2 text-slate-800 dark:text-slate-100">Seleccionar Convocatoria Abierta</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">Elige una convocatoria para gestionar sus postulantes.</p>

                {openLaunches.length === 0 ? (
                    <EmptyState icon="event_busy" title="Sin Convocatorias Abiertas" message="No hay lanzamientos activos en este momento." />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {openLaunches.map(lanz => {
                            const visuals = getEspecialidadClasses(lanz[FIELD_ORIENTACION_LANZAMIENTOS]);
                            return (
                                <button
                                    key={lanz.id}
                                    onClick={() => setSelectedLanzamiento(lanz)}
                                    className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={visuals.tag}>{lanz[FIELD_ORIENTACION_LANZAMIENTOS]}</span>
                                        <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                            {lanz[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} Cupos
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {lanz[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                                    </h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                                        <span className="material-icons !text-base">calendar_today</span>
                                        Inicio: {formatDate(lanz[FIELD_FECHA_INICIO_LANZAMIENTOS])}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // View 2: Candidates List
    return (
        <div className="animate-fade-in-up space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            {/* Header with Back Button, Info and Actions */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedLanzamiento(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                            <span className="material-icons">arrow_back</span>
                        </button>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Cupos: {selectedLanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} | Postulantes: {candidates.length}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCloseLaunch}
                        disabled={closeLaunchMutation.isPending}
                        className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                        {closeLaunchMutation.isPending ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <span className="material-icons !text-base">lock</span>
                        )}
                        Cerrar Convocatoria
                    </button>
                </div>
                <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                    <div className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-2 group relative cursor-help">
                        <span className="font-bold">Criterio:</span> Puntaje descendente
                        <span className="material-icons !text-sm opacity-70">help</span>

                        {/* Tooltip con la fórmula */}
                        <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            <p className="font-bold mb-1 border-b border-slate-600 pb-1">Fórmula de Puntaje:</p>
                            <ul className="space-y-1 list-disc pl-3">
                                <li>Terminó de cursar: <strong>+100 pts</strong></li>
                                <li>Cursando electivas: <strong>+50 pts</strong></li>
                                <li>Adeuda finales: <strong>+30 pts</strong></li>
                                <li>Horas acumuladas: <strong>+0.5 pts/hora</strong></li>
                                <li>Penalizaciones: <strong>- Puntos</strong></li>
                            </ul>
                            <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-800 rotate-45"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Candidates List */}
            {isLoadingCandidates ? (
                <Loader />
            ) : candidates.length === 0 ? (
                <EmptyState icon="group_off" title="Sin Postulantes" message="Aún no hay estudiantes inscriptos en esta convocatoria." />
            ) : (
                <div className="space-y-3">
                    {candidates.map(student => (
                        <StudentRow
                            key={student.enrollmentId}
                            student={student}
                            onToggleSelection={handleToggle}
                            onUpdateSchedule={handleUpdateSchedule}
                            isUpdating={updatingId === student.enrollmentId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SeleccionadorConvocatorias;
