
import React from 'react';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    icon?: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description, icon }) => (
    <div 
        onClick={() => onChange(!checked)}
        className={`flex items-center justify-between cursor-pointer group p-4 rounded-2xl border transition-all duration-200 
            ${checked 
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-500/50' 
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
    >
        <div className="flex items-center gap-3 pr-4">
            {icon && (
                <div className={`p-2 rounded-lg transition-colors ${checked ? 'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    <span className="material-icons !text-xl">{icon}</span>
                </div>
            )}
            <div>
                <span className={`text-sm font-bold transition-colors ${checked ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-200'}`}>
                    {label}
                </span>
                {description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {description}
                    </p>
                )}
            </div>
        </div>

        <div className={`relative w-12 h-7 rounded-full transition-colors duration-300 ease-in-out border-2 shrink-0 ${checked ? 'bg-blue-600 border-blue-600' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
            <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </div>
    </div>
);

export default Toggle;
