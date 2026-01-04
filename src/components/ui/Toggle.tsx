import React from 'react';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled = false, size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: { switch: 'w-8 h-4', dot: 'h-3 w-3', translate: 'translate-x-4' },
        md: { switch: 'w-11 h-6', dot: 'h-5 w-5', translate: 'translate-x-5' },
        lg: { switch: 'w-14 h-7', dot: 'h-6 w-6', translate: 'translate-x-7' },
    };

    const s = sizeClasses[size];

    return (
        <label className={`inline-flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
            <div className="relative">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={checked}
                    onChange={(e) => !disabled && onChange(e.target.checked)}
                    disabled={disabled}
                />
                <div className={`
            ${s.switch} rounded-full transition-colors duration-200 ease-in-out border-2
            peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 dark:peer-focus:ring-blue-900/30
            ${checked
                        ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                        : 'bg-slate-200 border-slate-200 dark:bg-slate-800 dark:border-slate-800'}
        `}></div>
                <div className={`
            absolute top-[2px] left-[2px] bg-white border border-slate-200 dark:border-slate-700/10 rounded-full shadow-sm transition-transform duration-200 ease-in-out
            ${s.dot}
            ${checked ? s.translate : 'translate-x-0'}
        `}></div>
            </div>
            {label && <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
        </label>
    );
};

export default Toggle;
