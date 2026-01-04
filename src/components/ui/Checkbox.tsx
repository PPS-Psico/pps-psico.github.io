import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    sublabel?: string;
    wrapperClassName?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ id, checked, onChange, disabled = false, label, sublabel, className = '', wrapperClassName = '', ...props }, ref) => (
        <label
            htmlFor={id}
            className={`
            group flex items-start gap-3 p-2 rounded-lg transition-colors 
            ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40'}
            ${wrapperClassName}
        `}
        >
            <div className="relative flex items-center h-6">
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    ref={ref}
                    className="peer sr-only"
                    {...props}
                />
                <div className={`
            h-5 w-5 rounded border-2 transition-all duration-200 ease-out flex items-center justify-center
            peer-focus-visible:ring-4 peer-focus-visible:ring-blue-100 dark:peer-focus-visible:ring-blue-900/30
            
            ${checked
                        ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                        : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 group-hover:border-blue-400 dark:group-hover:border-blue-500'}
            
            ${className}
        `}>
                    <svg
                        className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${checked ? 'scale-100' : 'scale-0'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                </div>
            </div>
            {(label || sublabel) && (
                <div className="flex flex-col select-none">
                    {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-amber-900 dark:group-hover:text-blue-100 transition-colors">{label}</span>}
                    {sublabel && <span className="text-xs text-slate-500 dark:text-slate-400">{sublabel}</span>}
                </div>
            )}
        </label>
    )
);

Checkbox.displayName = 'Checkbox';
export default Checkbox;
