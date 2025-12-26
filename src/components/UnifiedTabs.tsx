
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
  layoutIdPrefix?: string; // To prevent animation conflicts between main and sub tabs
  className?: string;
  variant?: 'primary' | 'secondary'; // primary for navbar, secondary for inner pages
  onTabClose?: (id: string, e: React.MouseEvent) => void; // Optional close handler
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
    
    // Design tokens based on variant
    const containerClasses = variant === 'primary' 
        ? 'bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md p-1.5'
        : 'bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700';

    const activeTextClass = variant === 'primary'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-slate-900 dark:text-white';

    const inactiveTextClass = 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200';

    return (
        <div className={`inline-flex rounded-2xl overflow-x-auto custom-scrollbar no-scrollbar max-w-full ${containerClasses} ${className}`}>
            {tabs.map((tab) => {
                const isActive = activeTabId === tab.id;
                
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id, tab.path)}
                        className={`
                            relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 outline-none whitespace-nowrap z-10 flex-shrink-0
                            ${isActive ? activeTextClass : inactiveTextClass}
                        `}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                        {isActive && (
                            <motion.div
                                layoutId={`${layoutIdPrefix}-pill`}
                                className="absolute inset-0 bg-white dark:bg-slate-700 rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                            />
                        )}
                        
                        {tab.icon && (
                            <span className={`material-icons relative z-20 !text-lg transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'opacity-70'}`}>
                                {tab.icon}
                            </span>
                        )}
                        
                        <span className="relative z-20">{tab.label}</span>
                        
                        {tab.badge && (
                             <span className={`relative z-20 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300`}>
                                 {tab.badge}
                             </span>
                        )}

                        {onTabClose && isActive && (
                             <div
                                role="button"
                                onClick={(e) => onTabClose(tab.id, e)}
                                className="relative z-20 ml-1 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-rose-500 transition-colors"
                             >
                                 <span className="material-icons !text-xs block">close</span>
                             </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default UnifiedTabs;
