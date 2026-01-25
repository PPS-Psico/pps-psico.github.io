
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ActionItemProps {
    title: string;
    count: number;
    description: string;
    icon: string;
    colorClass: string;
    bgClass: string;
    onClick: () => void;
}

const ActionItem: React.FC<ActionItemProps> = ({ title, count, description, icon, colorClass, bgClass, onClick }) => {
    return (
        <button 
            onClick={onClick}
            className="w-full text-left group flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-transparent hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-800 relative overflow-hidden"
        >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${bgClass} pointer-events-none`}></div>
            
            <div className={`relative z-10 p-3 rounded-xl ${colorClass} bg-opacity-10 dark:bg-opacity-20`}>
                <span className="material-icons !text-2xl">{icon}</span>
            </div>
            
            <div className="relative z-10 flex-grow">
                <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{title}</h4>
                    {count > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colorClass} bg-opacity-10`}>
                            {count}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed group-hover:text-slate-600 dark:group-hover:text-slate-300">
                    {description}
                </p>
            </div>
            
            <div className="relative z-10 self-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                <span className="material-icons text-slate-400">arrow_forward_ios</span>
            </div>
        </button>
    );
};

interface ActionCenterProps {
    stagnantCount: number;
    upcomingClosuresCount: number;
    // TODO: pendingReviewsCount is currently unused. Uncomment if needed:
    // pendingReviewsCount: number;
    pendingAccreditationsCount: number;
}

const ActionCenter: React.FC<ActionCenterProps> = ({ stagnantCount, upcomingClosuresCount, pendingAccreditationsCount }) => {
    const navigate = useNavigate();

    return (
        <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2 px-1">
                <span className="material-icons text-amber-500">warning_amber</span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Focos de Atención</h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {stagnantCount > 0 ? (
                    <ActionItem
                        title="Solicitudes Estancadas"
                        count={stagnantCount}
                        description="Alumnos esperando respuesta hace más de 5 días."
                        icon="hourglass_empty"
                        colorClass="text-amber-600 dark:text-amber-400"
                        bgClass="from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800"
                        onClick={() => navigate('/admin/solicitudes?tab=ingreso')}
                    />
                ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Sin solicitudes demoradas</span>
                    </div>
                )}

                {upcomingClosuresCount > 0 ? (
                    <ActionItem
                        title="Cierres Próximos"
                        count={upcomingClosuresCount}
                        description="Convocatorias que finalizan esta semana."
                        icon="timer"
                        colorClass="text-rose-600 dark:text-rose-400"
                        bgClass="from-rose-50 to-white dark:from-rose-900/20 dark:to-slate-800"
                        onClick={() => navigate('/admin/gestion?filter=proximas')}
                    />
                ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Sin vencimientos próximos</span>
                    </div>
                )}

                {pendingAccreditationsCount > 0 && (
                     <ActionItem
                        title="Acreditaciones"
                        count={pendingAccreditationsCount}
                        description="Documentación final lista para revisión."
                        icon="school"
                        colorClass="text-emerald-600 dark:text-emerald-400"
                        bgClass="from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800"
                        onClick={() => navigate('/admin/solicitudes?tab=egreso')}
                    />
                )}
                
                 {/* Item siempre visible para "Ver Todo" o gestión general */}
                 <ActionItem
                    title="Panel de Gestión"
                    count={0}
                    description="Administrar todos los lanzamientos activos."
                    icon="tune"
                    colorClass="text-blue-600 dark:text-blue-400"
                    bgClass="from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-800"
                    onClick={() => navigate('/admin/gestion')}
                />
            </div>
        </div>
    );
};

export default ActionCenter;
