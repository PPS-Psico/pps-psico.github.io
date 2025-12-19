
import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  description: string;
  isLoading: boolean;
  className?: string;
  onClick?: () => void;
}

const MetricCardSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm animate-pulse">
        <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
            <div className="w-10 h-6 rounded-md bg-slate-200 dark:bg-slate-800"></div>
        </div>
        <div className="mt-6 h-12 w-2/3 rounded-lg bg-slate-200 dark:bg-slate-800"></div>
        <div className="mt-3 h-4 w-5/6 rounded-md bg-slate-200 dark:bg-slate-800"></div>
    </div>
);


const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, description, isLoading, className, onClick }) => {
    if (isLoading) {
        return <MetricCardSkeleton />;
    }
    
    // Determine card background and interactive states
    const baseClasses = `
        relative overflow-hidden
        bg-white dark:bg-slate-900/80 
        p-6 rounded-[1.5rem] 
        border border-slate-200 dark:border-slate-700 
        shadow-sm dark:shadow-lg dark:shadow-slate-900/50
        transition-all duration-300 
        ${className || ''}
    `;

    const interactiveClasses = onClick 
        ? 'group cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-blue-300 dark:hover:border-blue-500/50 dark:hover:bg-slate-800' 
        : '';
    
    const cardContent = (
        <>
            {/* Background Glow for Dark Mode */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 dark:bg-blue-600/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="flex justify-between items-start relative z-10">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-800/50 shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <span className="material-icons !text-2xl">{icon}</span>
                </div>
                {onClick && (
                    <div className="p-1.5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <span className="material-icons !text-xl">arrow_outward</span>
                    </div>
                )}
            </div>
            
            <div className="mt-6 relative z-10">
                <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none group-hover:text-blue-900 dark:group-hover:text-blue-100 transition-colors">
                    {value}
                </p>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">
                    {title}
                </h3>
            </div>
            
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-3 leading-relaxed relative z-10 border-t border-slate-100 dark:border-slate-800 pt-3">
                {description}
            </p>
        </>
    );

    if (onClick) {
        return (
            <button onClick={onClick} className={`${baseClasses} ${interactiveClasses} text-left w-full`}>
                {cardContent}
            </button>
        );
    }
    
    return (
        <div className={baseClasses}>
            {cardContent}
        </div>
    );
};

export default MetricCard;
