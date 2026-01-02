
import React from 'react';
import { motion } from 'framer-motion';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: number | string;
  path?: string;
}

interface UnifiedTabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange: (id: string, path?: string) => void;
  layoutIdPrefix?: string;
  className?: string;
  variant?: 'primary' | 'secondary';
  onTabClose?: (id: string, e: React.MouseEvent) => void;
}

const UnifiedTabs: React.FC<UnifiedTabsProps> = ({ 
    tabs, 
    activeTabId, 
    onTabChange, 
    layoutIdPrefix = 'tabs',
    className = '',
    variant = 'primary',
    onTabClose
}) => {
    
    // --- ESTILOS "PREMIUM" ---
    
    // Contenedor Principal (La cápsula)
    // Dark mode updated: bg-slate-900/60 -> bg-[#1e293b]/90 (Slate-800 high opacity) to contrast with bg-[#020617] (Slate-950)
    // Dark border updated: border-white/10 -> border-slate-700
    const containerClasses = variant === 'primary' 
        ? `
            bg-white/80 dark:bg-[#1E293B]/90 
            backdrop-blur-xl 
            border border-slate-200/50 dark:border-slate-700
            shadow-lg shadow-slate-200/20 dark:shadow-xl dark:shadow-black/50
            p-1.5 rounded-full 
            ring-1 ring-slate-900/5 dark:ring-white/5
          `
        : `
            bg-slate-100/50 dark:bg-slate-800/50 
            border border-slate-200/50 dark:border-white/5 
            p-1 rounded-2xl
          `;

    // Texto Activo
    const activeTextClass = variant === 'primary'
        ? 'text-slate-900 dark:text-white'
        : 'text-slate-800 dark:text-slate-100';

    // Texto Inactivo
    const inactiveTextClass = 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200';

    return (
        <div className={`inline-flex items-center justify-center max-w-full overflow-x-auto no-scrollbar ${containerClasses} ${className}`}>
            {tabs.map((tab) => {
                const isActive = activeTabId === tab.id;
                
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id, tab.path)}
                        className={`
                            relative flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all duration-300 outline-none whitespace-nowrap z-10 flex-shrink-0
                            ${variant === 'primary' ? 'rounded-full' : 'rounded-xl'}
                            ${isActive ? activeTextClass : inactiveTextClass}
                        `}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                        {isActive && (
                            <motion.div
                                layoutId={`${layoutIdPrefix}-pill`}
                                className={`
                                    absolute inset-0 
                                    bg-white dark:bg-slate-600/80 
                                    ${variant === 'primary' ? 'shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/10 rounded-full' : 'rounded-xl shadow-sm'}
                                `}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                        
                        {tab.icon && (
                            <span className={`material-icons relative z-20 !text-[18px] transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'opacity-70'}`}>
                                {tab.icon}
                            </span>
                        )}
                        
                        <span className="relative z-20">{tab.label}</span>
                        
                        {tab.badge && (
                             <span className={`
                                relative z-20 ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] leading-none
                                ${isActive 
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200' 
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}
                             `}>
                                 {tab.badge}
                             </span>
                        )}

                        {onTabClose && isActive && (
                             <div
                                role="button"
                                onClick={(e) => onTabClose(tab.id, e)}
                                className="relative z-20 ml-1.5 p-0.5 rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-600 text-slate-400 hover:text-rose-500 transition-colors"
                             >
                                 <span className="material-icons !text-[14px] block">close</span>
                             </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default UnifiedTabs;
