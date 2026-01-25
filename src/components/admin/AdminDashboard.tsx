
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// TODO: Uncomment if needed:
// import { useAuth } from '../../contexts/AuthContext';
// import { useAdminPreferences } from '../../contexts/AdminPreferencesContext'; // Import context
import { useOperationalData } from '../../hooks/useOperationalData';
import Toast from '../ui/Toast';
import { AdminDashboardSkeleton } from '../Skeletons';
import EmptyState from '../EmptyState';
import ActivityFeed from './ActivityFeed';
import { differenceInDays } from 'date-fns';
import { FIELD_NOMBRE_PPS_LANZAMIENTOS } from '../../constants';
// Added formatDate for alerts
import { formatDate } from '../../utils/formatters';

interface AdminDashboardProps {
    isTestingMode?: boolean;
}

const ManagementCard: React.FC<{
    title: string;
    count: number;
    icon: string;
    color: 'red' | 'amber' | 'emerald' | 'blue';
    onClick: () => void;
    label: string;
    subCount?: number;
    subLabel?: string;
}> = ({ title, count, icon, color, onClick, label, subCount, subLabel }) => {

    const styles = {
        red: {
            hoverBorder: 'group-hover:border-rose-300 dark:group-hover:border-rose-700',
            iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
            countText: 'text-rose-700 dark:text-rose-400',
            hoverBg: 'hover:bg-rose-50/50 dark:hover:bg-rose-900/10',
            gradient: 'from-white to-rose-50/30 dark:from-slate-800 dark:to-rose-900/10',
            glow: 'group-hover:shadow-rose-500/10'
        },
        amber: {
            hoverBorder: 'group-hover:border-amber-300 dark:group-hover:border-amber-700',
            iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
            countText: 'text-amber-700 dark:text-amber-400',
            hoverBg: 'hover:bg-amber-50/50 dark:hover:bg-amber-900/10',
            gradient: 'from-white to-amber-50/30 dark:from-slate-800 dark:to-amber-900/10',
            glow: 'group-hover:shadow-amber-500/10'
        },
        emerald: {
            hoverBorder: 'group-hover:border-emerald-300 dark:group-hover:border-emerald-700',
            iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
            countText: 'text-emerald-700 dark:text-emerald-400',
            hoverBg: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
            gradient: 'from-white to-emerald-50/30 dark:from-slate-800 dark:to-emerald-900/10',
            glow: 'group-hover:shadow-emerald-500/10'
        },
        blue: {
            hoverBorder: 'group-hover:border-blue-300 dark:group-hover:border-blue-700',
            iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
            countText: 'text-blue-700 dark:text-blue-400',
            hoverBg: 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
            gradient: 'from-white to-blue-50/30 dark:from-slate-800 dark:to-blue-900/10',
            glow: 'group-hover:shadow-blue-500/10'
        },
    };

    const style = styles[color];

    return (
        <button
            onClick={onClick}
            className={`flex flex-col p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-gradient-to-br ${style.gradient} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${style.glow} text-left group ${style.hoverBorder}`}
        >
            <div className="flex justify-between items-start w-full mb-4">
                <div className={`p-3 rounded-xl shadow-sm transition-colors ${style.iconBg}`}>
                    <span className="material-icons !text-2xl">{icon}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 text-slate-400 dark:text-slate-500">
                    <span className="material-icons !text-xl">arrow_forward</span>
                </div>
            </div>

            <div className="mt-auto w-full">
                <div className="flex justify-between items-end mb-1">
                    <span className={`text-4xl font-black tracking-tight ${style.countText}`}>
                        {count}
                    </span>
                    {subCount !== undefined && subCount > 0 && (
                        <span className="text-[10px] font-bold bg-white/50 dark:bg-black/20 backdrop-blur-sm text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full mb-1 border border-slate-200/50 dark:border-slate-700/50">
                            {subCount} {subLabel}
                        </span>
                    )}
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">{title}</h4>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
            </div>
        </button>
    );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isTestingMode = false }) => {
    // TODO: These are currently unused. Uncomment if needed:
    // const { authenticatedUser } = useAuth();
    // const { preferences } = useAdminPreferences(); // Access prefs
    const navigate = useNavigate();
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const { data: opData, isLoading: isOpLoading, error: opError } = useOperationalData(isTestingMode);



    if (isOpLoading) return <AdminDashboardSkeleton />;

    if (opError) {
        return <EmptyState icon="error" title="Error" message={(opError as any)?.message} />;
    }

    const now = new Date();

    // --- LÓGICA DE AGRUPACIÓN ---
    const overdueLaunches = (opData?.endingLaunches || []).filter((l: any) => l.daysLeft < 0);

    const uniqueOverdueInstitutions = new Set(overdueLaunches.map((l: any) => {
        const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '';
        return name.split(' - ')[0].trim();
    }));

    const overdueCount = uniqueOverdueInstitutions.size;

    let stagnantCount = 0;
    (opData?.pendingRequests || []).forEach((r: any) => {
        if (!r.updated) return;
        const lastUpdate = new Date(r.updated);
        if (differenceInDays(now, lastUpdate) > 5) stagnantCount++;
    });
    const accreditationCount = (opData?.pendingFinalizations || []).length;
    const upcomingCount = (opData?.endingLaunches || []).filter((l: any) => l.daysLeft >= 0 && l.daysLeft <= 30).length;

    return (
        <div className="space-y-12 animate-fade-in-up pb-10">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}



            {/* --- ALERTAS DE ACCIÓN REQUERIDA (Cierre de Convocatorias) --- */}
            {opData?.closingAlerts && opData.closingAlerts.length > 0 && (
                <div className="mx-4 md:mx-0 p-4 bg-orange-50 dark:bg-orange-900/10 border-l-4 border-orange-500 rounded-r-xl shadow-sm animate-fade-in-up">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                            <span className="material-icons">warning_amber</span>
                        </div>
                        <div className="flex-1 w-full">
                            <h4 className="font-black text-orange-800 dark:text-orange-200 text-sm uppercase tracking-wide mb-1">Acción Requerida: Cierre de Inscripciones</h4>
                            <p className="text-xs text-orange-700/80 dark:text-orange-300/70 mb-3">
                                Las siguientes convocatorias inician pronto y deben cerrarse para seleccionar estudiantes.
                            </p>
                            <div className="space-y-2">
                                {opData.closingAlerts.map((alert: any) => (
                                    <div key={alert.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30 shadow-sm gap-3">
                                        <div>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{alert.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${alert.daysRemaining <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {alert.isClosingToday ? 'CIERRA HOY' : (alert.daysRemaining < 0 ? 'INSCRIPCIÓN FINALIZADA' : `${alert.daysRemaining} días restantes`)}
                                                </span>
                                                <span className="text-[10px] text-slate-400">Cierre: {formatDate(alert.closingDate)}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/admin/seleccionador')}
                                            className="w-full sm:w-auto text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-blue-500/20 shadow-lg"
                                        >
                                            IR A SELECCIONAR
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SECCIÓN GESTIÓN: GRID DE TARJETAS --- */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 px-4">
                    <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">
                        Estado Operativo
                    </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ManagementCard
                        title="Instituciones Vencidas"
                        count={overdueCount}
                        label="Gestión requerida"
                        icon="event_busy"
                        color="red"
                        onClick={() => navigate('/admin/gestion?filter=vencidas')}
                    />
                    <ManagementCard
                        title="Demoradas"
                        count={stagnantCount}
                        label="Sin cambio +5 días"
                        icon="hourglass_empty"
                        color="amber"
                        onClick={() => navigate('/admin/solicitudes?tab=ingreso')}
                    />
                    <ManagementCard
                        title="Acreditaciones"
                        count={accreditationCount}
                        label="Pendientes de carga"
                        icon="verified"
                        color="emerald"
                        onClick={() => navigate('/admin/solicitudes?tab=egreso')}
                    />
                    <ManagementCard
                        title="Próximas a Vencer"
                        count={upcomingCount}
                        label="Vencen este mes"
                        icon="update"
                        color="blue"
                        onClick={() => navigate('/admin/gestion?filter=proximas')}
                    />
                </div>
            </section>

            {/* --- SECCIÓN FEED: ACTIVIDAD RECIENTE --- */}
            <section className="pt-4">
                <ActivityFeed isTestingMode={isTestingMode} />
            </section>
        </div>
    );
};

export default AdminDashboard;
