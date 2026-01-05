
import React from 'react';
import { useActivityFeed, ActivityItem } from '../../hooks/useActivityFeed';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const ActivityItemCard: React.FC<{ item: ActivityItem }> = ({ item }) => {
    const navigate = useNavigate();
    const timeAgo = formatDistanceToNow(item.timestamp, { addSuffix: true, locale: es });

    const isPending = item.rawStatus === 'Pendiente';

    // Configuración Visual Mejorada según Tipo
    let config = {
        icon: 'notifications',
        bgIcon: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        actionText: 'Ver',
        path: '#',
        highlightRing: 'group-hover:ring-slate-100 dark:group-hover:ring-slate-800'
    };

    if (item.type === 'finalization') {
        config = {
            icon: 'school',
            bgIcon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
            actionText: 'Revisar',
            path: '/admin/solicitudes?tab=egreso',
            highlightRing: 'group-hover:ring-emerald-100 dark:group-hover:ring-emerald-900/30'
        };
    } else if (item.type === 'request') {
        config = {
            icon: 'person_add',
            bgIcon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
            actionText: 'Gestionar',
            path: '/admin/solicitudes?tab=ingreso',
            highlightRing: 'group-hover:ring-blue-100 dark:group-hover:ring-blue-900/30'
        };
    } else if (item.type === 'launch') {
        // Extract raw ID (remove 'lanz-' prefix added in the hook)
        const launchId = item.id.replace('lanz-', '');
        config = {
            icon: 'rocket_launch',
            bgIcon: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
            actionText: 'Ver Inscriptos',
            // Add the launchId to the URL parameters
            path: `/admin/lanzador?tab=seleccionador&launchId=${launchId}`,
            highlightRing: 'group-hover:ring-indigo-100 dark:group-hover:ring-indigo-900/30'
        };
    }

    const handleAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (config.path !== '#') navigate(config.path);
    };

    return (
        <div
            onClick={handleAction}
            className={`group relative flex items-start gap-4 p-4 rounded-xl transition-all duration-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50`}
        >
            {/* Avatar Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.bgIcon} shadow-sm ring-4 ring-transparent ${config.highlightRing} transition-all duration-300`}>
                <span className="material-icons !text-lg">{config.icon}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate pr-2">
                        {item.user}
                    </h4>
                    <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                        {timeAgo}
                    </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="truncate max-w-[200px]">
                        {item.type === 'finalization' ? 'Solicita Acreditación' : item.type === 'launch' ? 'Convocatoria Abierta' : 'Solicita Ingreso'}
                    </span>

                    {/* Tags especiales */}
                    {item.isNew && isPending && item.type !== 'launch' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 tracking-wide">
                            Nuevo
                        </span>
                    )}

                    {item.type === 'launch' && item.metadata?.count !== undefined && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 animate-pulse">
                            <span className="material-icons !text-[10px]">group</span>
                            {item.metadata.count} inscriptos
                        </span>
                    )}
                </div>

                {item.institution && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/50 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm max-w-full">
                        <span className="material-icons !text-[12px] text-slate-400">business</span>
                        <span className="truncate">{item.institution}</span>
                    </div>
                )}
            </div>

            {/* Action Icon (Visible on Hover) */}
            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                    {config.actionText} <span className="material-icons !text-xs">arrow_forward</span>
                </div>
            </div>
        </div>
    );
};

const ActivityFeed: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
    const { data: items, isLoading } = useActivityFeed(isTestingMode);

    // LIMITAR A 5 ELEMENTOS
    const displayItems = React.useMemo(() => {
        if (!items) return [];
        return items.slice(0, 5); // Solo los últimos 5
    }, [items]);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/60 dark:border-slate-800 p-6 h-full min-h-[300px]">
                <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-6"></div>
                <div className="space-y-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                                <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col">
            {/* Header Limpio */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-icons text-indigo-500 !text-xl">history</span>
                    Actividad Reciente
                </h3>
            </div>

            {/* List */}
            <div className="p-2 flex-grow">
                {displayItems.length > 0 ? (
                    <div className="space-y-1">
                        {displayItems.map((item) => (
                            <ActivityItemCard key={item.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-full mb-3">
                            <span className="material-icons text-slate-300 dark:text-slate-600 !text-3xl">notifications_off</span>
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay actividad reciente</p>
                    </div>
                )}
            </div>

            {/* Footer opcional si hay muchos items */}
            {items && items.length > 5 && (
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                    <span className="text-xs text-slate-400 font-medium">Mostrando 5 de {items.length} movimientos</span>
                </div>
            )}
        </div>
    );
};

export default ActivityFeed;
