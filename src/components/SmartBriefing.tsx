
import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartInsight, PriorityLevel } from '../hooks/useSmartAnalysis';

interface SmartBriefingProps {
    status: PriorityLevel;
    summary: string;
    insights: SmartInsight[];
    signals: string[];
    userName: string;
}

const SmartBriefing: React.FC<SmartBriefingProps> = ({ status, summary, insights, signals, userName }) => {
    
    // Greeting Logic
    const [greeting, setGreeting] = React.useState('');
    const [currentDate, setCurrentDate] = React.useState('');

    React.useEffect(() => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) setGreeting('Buenos días');
        else if (hour >= 12 && hour < 20) setGreeting('Buenas tardes');
        else setGreeting('Buenas noches');

        const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        setCurrentDate(new Date().toLocaleDateString('es-ES', options));
    }, []);

    const getStatusConfig = (s: PriorityLevel) => {
        switch (s) {
            case 'critical': 
                return { 
                    color: '#f43f5e',
                    icon: 'gavel',
                    label: 'Acción Requerida',
                    bg: 'bg-rose-500/10'
                };
            case 'warning': 
                return { 
                    color: '#f59e0b',
                    icon: 'auto_fix_high',
                    label: 'Alertas de Flujo',
                    bg: 'bg-amber-500/10'
                };
            default: 
                return { 
                    color: '#10b981',
                    icon: 'insights',
                    label: 'Operación Estable',
                    bg: 'bg-emerald-500/10'
                };
        }
    };

    const config = getStatusConfig(status);

    return (
        <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white border border-slate-200 dark:border-white/5 transition-all duration-500 shadow-sm">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[120px]"
                    style={{ backgroundColor: config.color + '15' }} // Lower opacity
                />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] dark:opacity-10 mix-blend-overlay"></div>
            </div>

            {/* Header / Greeting */}
            <div className="relative z-10 px-8 pt-8 pb-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
                 <div>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                        Panel de Control
                    </p>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                        {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{userName.split(' ')[0]}</span>.
                    </h1>
                </div>
                 <div className="text-left md:text-right">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                        <span className="material-icons text-slate-400 !text-lg">calendar_today</span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 capitalize">{currentDate}</span>
                    </div>
                </div>
            </div>

            <div className="relative z-10 p-6 sm:px-8 sm:pb-8 sm:pt-6 flex flex-col lg:flex-row gap-8 lg:items-start mt-2">
                {/* Status Column */}
                <div className="flex-none lg:w-48 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.bg} border border-white/10 shadow-inner relative overflow-hidden`}>
                            <span className="material-icons !text-2xl relative z-10" style={{ color: config.color }}>{config.icon}</span>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Diagnóstico</h4>
                            <p className="text-xs font-bold truncate" style={{ color: config.color }}>{config.label}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {signals.length > 0 ? signals.map((sig, i) => (
                            <span 
                                key={i} 
                                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-600 dark:text-slate-400"
                            >
                                <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: config.color }}></span>
                                {sig}
                            </span>
                        )) : (
                            <span className="text-xs text-slate-400 italic">Sin alertas</span>
                        )}
                    </div>
                </div>

                {/* Content Column */}
                <div className="flex-1 space-y-6">
                    <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800">
                        <p className="text-lg sm:text-xl text-slate-700 dark:text-slate-200 font-bold leading-tight tracking-tight">
                            {summary}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <AnimatePresence>
                            {insights.map((insight, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 * idx }}
                                >
                                    <Link 
                                        to={insight.actionLink || '#'}
                                        className="group flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
                                    >
                                        <div className={`p-2 rounded-lg ${insight.type === 'critical' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                            <span className="material-icons !text-lg">{insight.icon}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{insight.message}</p>
                                            <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                                                Ver detalle <span className="material-icons !text-[10px]">arrow_forward</span>
                                            </span>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SmartBriefing;
