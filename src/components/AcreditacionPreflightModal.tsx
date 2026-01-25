import React from 'react';
import { createPortal } from 'react-dom';
import type { CriteriosCalculados, InformeTask } from '../types';

interface AcreditacionPreflightModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    criterios: CriteriosCalculados;
    informeTask: InformeTask;
}

const AcreditacionPreflightModal: React.FC<AcreditacionPreflightModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    criterios,
    informeTask
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-icons text-emerald-600 dark:text-emerald-400">check_circle</span>
                        Confirmar Criterios de Acreditación
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Verifica los criterios antes de continuar
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {/* Horas Objetivo */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Horas Objetivo</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Obtenidas: <span className="font-medium text-slate-900 dark:text-white">{criterios.horasTotales}</span>
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    Total: <span className="font-medium text-slate-900 dark:text-white">{criterios.horasTotales}</span>
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                    Criterio Cumplido
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Informe de Práctica */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Informe de Práctica</h4>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                                <strong>Práctica:</strong> {informeTask.ppsName}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                <strong>Institución:</strong> {informeTask.institution || 'N/A'}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                <strong>Horas totales:</strong> {informeTask.horasTotales || 'N/A'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                                Este informe se generará automáticamente y será enviado al estudiante.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 flex justify-between border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AcreditacionPreflightModal;