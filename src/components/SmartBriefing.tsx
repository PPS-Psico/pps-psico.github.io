
import React, { useState, useEffect } from 'react';
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
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Buenos días');
        else if (hour < 20) setGreeting('Buenas tardes');
        else setGreeting('Buenas noches');
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
        <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-white/5 transition-all duration-500">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[120px]"
                    style={{ backgroundColor: config.color + '22' }}
                />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-20 mix-blend-overlay"></div>
            </div>

            <div className="relative z-10 p-8 sm:p-12 flex flex-col lg:flex-row gap-12">
                
                {/* Lado Izquierdo: Orbe de Estado y Señales Rápidas */}
                <div className="flex-none w-full lg:w-64 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${config.bg} border border-white/10 shadow-inner relative overflow-hidden`}>
                            <motion.div 
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 bg-white/10"
                            />
                            <span className="material-icons !text-3xl relative z-10" style={{ color: config.color }}>{config.icon}</span>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Diagnóstico</h4>
                            <p className="text-sm font-bold truncate" style={{ color: config.color }}>{config.label}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">Señales Detectadas</h4>
                        <div className="flex flex-wrap lg:flex-col gap-2">
                            {signals.length > 0 ? signals.map((sig, i) => (
                                <motion.span 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    key={i} 
                                    className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-300"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: config.color }}></span>
                                    {sig}
                                </motion.span>
                            )) : (
                                <span className="text-xs text-slate-400 italic font-medium">No hay alertas activas</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Centro/Derecha: Narrativa de IA y Acciones */}
                <div className="flex-1 space-y-8">
                    <div className="space-y-4">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                            {greeting}, <span className="text-blue-600 dark:text-blue-400">{userName.split(' ')[0]}</span>.
                        </h2>
                        
                        <div className="relative pt-2">
                            <span className="absolute -left-4 top-2 bottom-0 w-1 bg-blue-600/30 rounded-full"></span>
                            <p className="text-xl sm:text-2xl text-slate-700 dark:text-slate-200 font-bold leading-tight tracking-tight pr-4">
                                {summary}
                            </p>
                        </div>
                    </div>

                    {/* Acciones Prioritarias Sugeridas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnimatePresence>
                            {insights.map((insight, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 + (idx * 0.1) }}
                                >
                                    <Link 
                                        to={insight.actionLink || '#'}
                                        className="group/btn flex items-start gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 h-full shadow-sm hover:shadow-md"
                                    >
                                        <div className={`p-2.5 rounded-xl ${insight.type === 'critical' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'} group-hover/btn:scale-110 transition-transform`}>
                                            <span className="material-icons !text-xl">{insight.icon}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white leading-snug">{insight.message}</p>
                                            <span className="inline-flex items-center text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-tighter group-hover/btn:gap-2 gap-1 transition-all">
                                                Acceder a gestión <span className="material-icons !text-xs">arrow_forward</span>
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
