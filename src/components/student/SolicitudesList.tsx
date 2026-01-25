import React, { useState, useMemo } from 'react';
import EmptyState from '../EmptyState';
import type { SolicitudPPS, CriteriosCalculados, FinalizacionPPS, InformeTask } from '../../types';
import FinalizationStatusCard from './FinalizationStatusCard';
import { FIELD_ESTADO_FINALIZACION, FIELD_FECHA_SOLICITUD_FINALIZACION, FIELD_ESTADO_PPS, FIELD_EMPRESA_PPS_SOLICITUD, FIELD_ULTIMA_ACTUALIZACION_PPS, FIELD_NOTAS_PPS } from '../../constants';
import { normalizeStringForComparison, getStatusVisuals, formatDate } from '../../utils/formatters';
import AcreditacionPreflightModal from '../AcreditacionPreflightModal';

interface SolicitudesListProps {
    solicitudes: SolicitudPPS[];
    onCreateSolicitud?: () => void;
    onRequestFinalization?: () => void;
    criterios?: CriteriosCalculados;
    finalizacionRequest?: FinalizacionPPS | null;
    informeTasks?: InformeTask[]; // Nuevo prop
}

const SolicitudItem: React.FC<{ solicitud: SolicitudPPS }> = ({ solicitud }) => {
    const institucion = solicitud[FIELD_EMPRESA_PPS_SOLICITUD] || '';
    const status = solicitud[FIELD_ESTADO_PPS] || 'Pendiente';
    const actualizacion = solicitud[FIELD_ULTIMA_ACTUALIZACION_PPS];
    const visuals = getStatusVisuals(status);

    return (
        <div className="relative group bg-white dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300">
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">

                <div className="flex items-start gap-4">
                    {/* Icon Box */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${visuals.iconContainerClass.replace('border', '')} bg-opacity-20 dark:bg-opacity-10`}>
                        <span className={`material-icons !text-2xl ${visuals.accentBg.replace('bg-', 'text-')}`}>{visuals.icon}</span>
                    </div>

                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">
                            {institucion || 'Institución sin nombre'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${visuals.labelClass}`}>
                                {status}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <span className="material-icons !text-[10px]">update</span>
                                {formatDate(actualizacion)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ActionButton: React.FC<{
    icon: string;
    title: string;
    description: string;
    onClick?: () => void;
    colorScheme: 'blue' | 'teal' | 'slate';
    className?: string;
}> = ({ icon, title, description, onClick, colorScheme, className = '' }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
        teal: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800',
        slate: 'bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    };

    return (
        <button
            type="button"
            onClick={onClick}
            // Removed disabled attribute to allow click and show warning
            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 text-left group ${colors[colorScheme]} ${className}`}
        >
            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                <span className="material-icons !text-2xl">{icon}</span>
            </div>
            <div>
                <h4 className="font-bold text-sm">{title}</h4>
                <p className="text-xs opacity-80 mt-0.5">{description}</p>
            </div>
            {colorScheme !== 'slate' && (
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                    <span className="material-icons">arrow_forward</span>
                </div>
            )}
        </button>
    );
};

const SolicitudesList: React.FC<SolicitudesListProps> = ({
    solicitudes,
    onCreateSolicitud,
    onRequestFinalization,
    criterios,
    finalizacionRequest,
    informeTasks = []
}) => {
    const [showPreflightModal, setShowPreflightModal] = useState(false);

    const hasPendingCorrections = useMemo(() =>
        informeTasks.some(t => t.informeSubido && (t.nota === 'Sin calificar' || t.nota === 'Entregado (sin corregir)')),
        [informeTasks]
    );

    const isAccreditationReady = criterios
        ? criterios.cumpleHorasTotales && criterios.cumpleRotacion && criterios.cumpleHorasOrientacion && !criterios.tienePracticasPendientes && !hasPendingCorrections
        : false;

    const { activeRequests, historyRequests } = useMemo(() => {
        const active: SolicitudPPS[] = [];
        const history: SolicitudPPS[] = [];
        const finishedStatuses = ['finalizada', 'cancelada', 'rechazada', 'no se pudo concretar', 'pps realizada', 'solicitud invalida', 'realizada'];
        const hiddenStatuses = ['archivado'];

        solicitudes.forEach(sol => {
            const status = normalizeStringForComparison(sol[FIELD_ESTADO_PPS]);
            if (hiddenStatuses.includes(status)) return;
            if (finishedStatuses.some(s => status.includes(s))) {
                history.push(sol);
            } else {
                active.push(sol);
            }
        });
        return { activeRequests: active, historyRequests: history };
    }, [solicitudes]);

    const handleAccreditationClick = () => {
        if (!onRequestFinalization) return;
        // Siempre mostrar el preflight para que el usuario vea el checklist completo
        setShowPreflightModal(true);
    };

    return (
        <div className="space-y-6">
            {/* Status Card (If pending accreditation) */}
            {finalizacionRequest && (
                <FinalizationStatusCard
                    status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || 'Pendiente'}
                    // FIX: Property 'createdTime' does not exist on type 'FinalizacionPPS'. Using 'created_at'.
                    requestDate={finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] || finalizacionRequest.created_at || ''}
                />
            )}

            {/* Action Buttons */}
            {!finalizacionRequest && (onCreateSolicitud || onRequestFinalization) && (
                <div className="grid grid-cols-1 gap-4 mb-2">
                    {onCreateSolicitud && (
                        <ActionButton
                            icon="add_business"
                            title="Nueva Solicitud de PPS"
                            description="Inicia un trámite de autogestión."
                            onClick={onCreateSolicitud}
                            colorScheme="blue"
                        />
                    )}

                    {/* Accreditation Button: Hidden on Desktop (md:hidden) because it's already in the main dashboard */}
                    {onRequestFinalization && (
                        <div className="md:hidden">
                            <ActionButton
                                icon={isAccreditationReady ? "verified" : "lock_clock"}
                                title="Trámite de Acreditación"
                                description={isAccreditationReady ? "Requisitos cumplidos. Iniciar cierre." : "Faltan requisitos. Toca para ver detalles."}
                                onClick={handleAccreditationClick}
                                colorScheme={isAccreditationReady ? "teal" : "slate"}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Improved Modal Logic */}
            {criterios && (
                <AcreditacionPreflightModal
                    isOpen={showPreflightModal}
                    onClose={() => setShowPreflightModal(false)}
                    onConfirm={() => {
                        if (onRequestFinalization) onRequestFinalization();
                        setShowPreflightModal(false);
                    }}
                    criterios={criterios}
                    informeTasks={informeTasks}
                />
            )}

            {/* Active List */}
            {activeRequests.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                        Gestiones en Curso ({activeRequests.length})
                    </h3>
                    <div className="flex flex-col gap-3">
                        {activeRequests.map(sol => <SolicitudItem key={sol.id} solicitud={sol} />)}
                    </div>
                </div>
            )}

            {/* History List */}
            {historyRequests.length > 0 && (
                <details className="group pt-4 border-t border-slate-200 dark:border-slate-800">
                    <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-2">
                        <span className="material-icons transition-transform group-open:rotate-90 text-slate-400 !text-lg">history</span>
                        Ver Historial ({historyRequests.length})
                    </summary>
                    <div className="mt-3 flex flex-col gap-3 pl-2 border-l-2 border-slate-100 dark:border-slate-800">
                        {historyRequests.map(sol => <SolicitudItem key={sol.id} solicitud={sol} />)}
                    </div>
                </details>
            )}

            {/* Empty State */}
            {activeRequests.length === 0 && historyRequests.length === 0 && !finalizacionRequest && (
                <EmptyState
                    icon="list_alt"
                    title="Sin Solicitudes"
                    message="No tienes trámites de PPS registrados actualmente."
                    className="bg-transparent border-none shadow-none p-0 mt-8"
                />
            )}
        </div>
    );
};

export default React.memo(SolicitudesList);
