import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'outline';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
    icon?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '', icon }) => {
    const variants = {
        default: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-800',
        success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200 dark:border-amber-800',
        error: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 border-rose-200 dark:border-rose-800',
        info: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
        neutral: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        outline: 'bg-transparent text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
    };

    return (
        <span className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border
        ${variants[variant]}
        ${className}
    `}>
            {icon && <span className="material-icons !text-[14px]">{icon}</span>}
            {children}
        </span>
    );
};

export default Badge;
