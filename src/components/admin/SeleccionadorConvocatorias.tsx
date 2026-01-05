
import React, { useState } from 'react';
import { useSeleccionadorLogic } from '../../hooks/useSeleccionadorLogic';
import {
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
} from '../../constants';
import { normalizeStringForComparison, getEspecialidadClasses, formatDate } from '../../utils/formatters';
import type { EnrichedStudent } from '../../types';
import Loader from '../Loader';
import EmptyState from '../EmptyState';
import Toast from '../ui/Toast';
import ConfirmModal from '../ConfirmModal';

const StudentRow: React.FC<{
    student: EnrichedStudent;
    onToggleSelection: (student: EnrichedStudent) => void;
    onUpdateSchedule: (id: string, newSchedule: string) => void;
    isUpdating: boolean;
    isReviewMode?: boolean;
}> = ({ student, onToggleSelection, onUpdateSchedule, isUpdating, isReviewMode = false }) => {
    const [localSchedule, setLocalSchedule] = React.useState(student.horarioSeleccionado);
    const [isScheduleDirty, setIsScheduleDirty] = React.useState(false);
    const isSelected = normalizeStringForComparison(student.status) === 'seleccionado';

    const handleScheduleBlur = () => {
        if (isScheduleDirty && localSchedule !== student.horarioSeleccionado) {
            onUpdateSchedule(student.enrollmentId, localSchedule);
            setIsScheduleDirty(false);
        }
    };

    return (
        <div className={`rounded-xl border transition-all duration-200 ${isSelected ? 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800 shadow-sm' : 'bg-white dark:bg-[#0B1120] border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-800'}`}>
            <div className="p-3 sm:p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center">

                <div className="flex items-center gap-3 min-w-[200px]">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-base font-black border shadow-sm ${student.puntajeTotal >= 100 ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`} title="Puntaje Total">
                        {student.puntajeTotal}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate leading-tight" title={student.nombre}>
                            {student.nombre}
                        </h4>
                        <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                <span className="material-icons !text-[11px]">schedule</span> {student.totalHoras} hs acumuladas
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full lg:w-auto flex flex-wrap items-center gap-2 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-4 min-h-[32px]">

                    {/* ESTADO ACADÉMICO (Excluyente) */}
                    {student.terminoCursar ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 whitespace-nowrap">
                            Terminó Cursada
                        </span>
                    ) : student.cursandoElectivas ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800 whitespace-nowrap">
                            Cursando Electivas
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 whitespace-nowrap">
                            Cursando
                        </span>
                    )}

                    {/* ALERTA: SIN PRÁCTICAS PREVIAS (Para mezclar avanzados con nuevos) */}
                    {student.cantPracticas === 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:border-fuchsia-800 whitespace-nowrap shadow-sm">
                            <span className="material-icons !text-[10px] mr-1">new_releases</span>
                            Sin Prácticas
                        </span>
                    )}

                    {/* Solo mostrar "Adeuda finales" si terminó de cursar, para no ensuciar la vista de los que cursan */}
                    {student.terminoCursar && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border whitespace-nowrap ${student.finalesAdeuda ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700'}`}>
                            {student.finalesAdeuda ? `Adeuda: ${student.finalesAdeuda}` : 'Sin Finales'}
                        </span>
                    )}

                    {student.trabaja && (
                        <a
                            href={student.certificadoTrabajo || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap hover:bg-blue-100 transition-colors"
                            title="Ver certificado de trabajo"
                            onClick={(e) => !student.certificadoTrabajo && e.preventDefault()}
                        >
                            <span className="material-icons !text-[10px] mr-1">work</span>
                            Trabaja
                        </a>
                    )}

                    {student.cvUrl && (
                        <a
                            href={student.cvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800 whitespace-nowrap hover:bg-cyan-100 transition-colors"
                            title="Ver Curriculum Vitae"
                        >
                            <span className="material-icons !text-[10px] mr-1">description</span>
                            CV
                        </a>
                    )}

                    {student.penalizacionAcumulada > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800 whitespace-nowrap">
                            Penalización Activa
                        </span>
                    )}

                    {student.notasEstudiante && (
                        <div
                            className="inline-flex items-start gap-1.5 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/30 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300 w-full break-words mt-1"
                        >
                            <span className="font-bold text-[10px] uppercase text-yellow-700 dark:text-yellow-500 shrink-0 mt-[1px]">Nota:</span>
                            <span className="italic leading-tight whitespace-pre-wrap">
                                "{student.notasEstudiante}"
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="flex-grow lg:w-40">
                        <input
                            type="text"
                            value={localSchedule}
                            onChange={(e) => { setLocalSchedule(e.target.value); setIsScheduleDirty(true); }}
                            onBlur={handleScheduleBlur}
                            className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-black/30 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400 dark:text-white"
                            placeholder="Asignar horario..."
                        />
                    </div>

                    <button
                        onClick={() => onToggleSelection(student)}
                        disabled={isUpdating}
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-sm ${isSelected
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-900'
                            : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500 dark:hover:text-blue-400'
                            }`}
                        title={isSelected ? "Deseleccionar" : "Seleccionar Alumno"}
                    >
                        {isUpdating ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <span className="material-icons !text-xl">{isSelected ? 'check' : 'add'}</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface SeleccionadorProps {
    isTestingMode?: boolean;
    onNavigateToInsurance?: (lanzamientoId: string) => void;
    preSelectedLaunchId?: string | null;
}

const SeleccionadorConvocatorias: React.FC<SeleccionadorProps> = ({ isTestingMode = false, onNavigateToInsurance, preSelectedLaunchId }) => {
    const {
        selectedLanzamiento, setSelectedLanzamiento,
        viewMode, setViewMode,
        toastInfo, setToastInfo,
        updatingId, isClosingTable,
        openLaunches, isLoadingLaunches,
        candidates, isLoadingCandidates,
        selectedCandidates,
        handleToggle, handleUpdateSchedule, handleConfirmAndCloseTable, closeLaunchMutation
    } = useSeleccionadorLogic(isTestingMode, onNavigateToInsurance, preSelectedLaunchId);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    if (isLoadingLaunches) return <Loader />;

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
                                    className="text-left p-5 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0F172A] shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-600 dark:hover:shadow-blue-900/10 transition-all group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50 dark:to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={visuals.tag}>{lanz[FIELD_ORIENTACION_LANZAMIENTOS]}</span>
                                            <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                                                {lanz[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} Cupos
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 min-h-[3.5rem]">
                                            {lanz[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                                        </h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <span className="material-icons !text-base opacity-70">calendar_today</span>
                                            Inicio: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(lanz[FIELD_FECHA_INICIO_LANZAMIENTOS])}</span>
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            <ConfirmModal
                isOpen={isConfirmOpen}
                title="¿Cerrar Mesa de Inscripción?"
                message={`Se enviarán correos automáticos de confirmación a los ${selectedCandidates.length} alumnos seleccionados. ¿Deseas proceder con el cierre definitivo de esta convocatoria?`}
                onConfirm={() => {
                    handleConfirmAndCloseTable();
                    setIsConfirmOpen(false);
                }}
                onClose={() => setIsConfirmOpen(false)}
                confirmText="Confirmar Cierre"
                type="info"
            />

            <div className="bg-white dark:bg-[#0F172A] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedLanzamiento(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                            <span className="material-icons">arrow_back</span>
                        </button>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Cupos: {selectedLanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} | Postulantes: {candidates.length} | Seleccionados: {selectedCandidates.length}
                            </p>
                        </div>
                    </div>
                    {viewMode === 'selection' ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('review')}
                                className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
                            >
                                Revisar y Cerrar
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setViewMode('selection')} className="text-slate-600 dark:text-slate-300 font-bold px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                Volver
                            </button>
                            <button
                                onClick={() => setIsConfirmOpen(true)}
                                disabled={isClosingTable}
                                className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-70 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                            >
                                {isClosingTable ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <span className="material-icons !text-base">lock</span>}
                                {isClosingTable ? 'Cerrando...' : 'Confirmar Cierre'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-2 group relative cursor-help">
                        <span className="font-bold">Criterio:</span> Puntaje descendente
                        <span className="material-icons !text-sm opacity-70">help</span>

                        <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            <p className="font-bold mb-1 border-b border-slate-600 pb-1">Fórmula de Puntaje:</p>
                            <ul className="space-y-1 list-disc pl-3">
                                <li>Terminó de cursar: <strong>+100 pts</strong></li>
                                <li>Cursando electivas: <strong>+50 pts</strong></li>
                                <li>Trabaja (c/certificado): <strong>+20 pts</strong></li>
                                <li>Adeuda finales: <strong>+30 pts</strong></li>
                                <li>Horas acumuladas: <strong>+0.5 pts/hora</strong></li>
                                <li>Penalizaciones: <strong>- Puntos</strong></li>
                            </ul>
                            <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-800 rotate-45"></div>
                        </div>
                    </div>
                </div>
            </div>

            {isLoadingCandidates ? <Loader /> : (
                <div className="space-y-3">
                    {(viewMode === 'selection' ? candidates : selectedCandidates).map(student => (
                        <StudentRow
                            key={student.enrollmentId}
                            student={student}
                            onToggleSelection={handleToggle}
                            onUpdateSchedule={handleUpdateSchedule}
                            isUpdating={updatingId === student.enrollmentId}
                            isReviewMode={viewMode === 'review'}
                        />
                    ))}
                    {viewMode === 'review' && selectedCandidates.length === 0 && (
                        <EmptyState icon="group_off" title="Sin Seleccionados" message="No has seleccionado ningún estudiante para esta mesa." />
                    )}
                </div>
            )}
        </div>
    );
};

export default SeleccionadorConvocatorias;
