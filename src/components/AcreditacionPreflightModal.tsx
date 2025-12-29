
import React from 'react';
import type { CriteriosCalculados, InformeTask } from '../types';
import { HORAS_OBJETIVO_TOTAL, HORAS_OBJETIVO_ORIENTACION, ROTACION_OBJETIVO_ORIENTACIONES } from '../constants';

interface AcreditacionPreflightModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    criterios: CriteriosCalculados;
    informeTasks: InformeTask[];
}

const AcreditacionPreflightModal: React.FC<AcreditacionPreflightModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    criterios,
    informeTasks 
}) => {
    if (!isOpen) return null;

    const items = [
        { 
            label: `Completar ${HORAS_OBJETIVO_TOTAL} horas totales`,
            ok: criterios.cumpleHorasTotales, 
            icon: 'schedule',
            subtext: criterios.cumpleHorasTotales ? null : `${Math.round(criterios.horasTotales)}/${HORAS_OBJETIVO_TOTAL} hs`
        },
        { 
            label: `Alcanzar ${HORAS_OBJETIVO_ORIENTACION} horas de especialidad`,
            ok: criterios.cumpleHorasOrientacion, 
            icon: 'psychology',
            subtext: criterios.cumpleHorasOrientacion ? null : `${Math.round(criterios.horasOrientacionElegida)}/${HORAS_OBJETIVO_ORIENTACION} hs`
        },
        { 
            label: `Rotar por al menos ${ROTACION_OBJETIVO_ORIENTACIONES} áreas`,
            ok: criterios.cumpleRotacion, 
            icon: 'cached',
            subtext: criterios.cumpleRotacion ? null : `${criterios.orientacionesCursadasCount}/${ROTACION_OBJETIVO_ORIENTACIONES} áreas`
        },
        { 
            label: "Cerrar prácticas activas",
            ok: !criterios.tienePracticasPendientes, 
            icon: 'library_books',
            subtext: !criterios.tienePracticasPendientes ? null : "Pendientes de cierre"
        }
    ];

    const allOk = items.every(i => i.ok);

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={onClose}>
            <div className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
                
                <div className="p-8 pb-0">
                    <div className="flex items-center gap-4 mb-6">
                        <div className={`p-3 rounded-2xl ${allOk ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            <span className="material-icons !text-3xl">{allOk ? 'verified' : 'warning_amber'}</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                                {allOk ? 'Todo listo para acreditar' : 'Revisión de Requisitos'}
                            </h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                {allOk ? 'Cumples con todos los criterios académicos.' : 'Verificación de cumplimiento antes de iniciar.'}
                            </p>
                        </div>
                    </div>

                    {!allOk && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                            El sistema indica que hay requisitos pendientes. Si tienes documentación que avale lo contrario o ya conversaste con coordinación, puedes continuar.
                        </p>
                    )}

                    <div className="space-y-3 mb-6">
                        {items.map((item, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${item.ok ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`material-icons !text-lg ${item.ok ? 'text-emerald-500' : 'text-rose-400'}`}>
                                        {item.icon}
                                    </span>
                                    <div>
                                        <p className={`text-sm font-bold ${item.ok ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {item.label}
                                        </p>
                                        {item.subtext && (
                                            <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 text-rose-500`}>
                                                {item.subtext}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {item.ok ? (
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                        <span className="material-icons !text-sm font-bold">check</span>
                                    </div>
                                ) : (
                                    <div className={`flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-500 dark:bg-opacity-20`}>
                                        <span className="material-icons !text-sm font-bold">priority_high</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Recordatorio Adicional */}
                    <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 flex gap-3">
                         <span className="material-icons text-amber-600 dark:text-amber-400 !text-xl mt-0.5">assignment_turned_in</span>
                         <p className="text-xs text-amber-800 dark:text-amber-200 font-medium leading-snug">
                             <strong>Importante:</strong> Verifica que todos tus informes de práctica hayan sido subidos y corregidos por los docentes antes de solicitar el cierre.
                         </p>
                    </div>
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Volver
                    </button>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }} 
                        className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <span>{allOk ? 'Iniciar Trámite' : 'Iniciar igual'}</span>
                        <span className="material-icons !text-lg">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AcreditacionPreflightModal;
