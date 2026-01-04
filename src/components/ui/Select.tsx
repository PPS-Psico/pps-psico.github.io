import React from 'react';

interface Option {
    value: string | number;
    label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options?: Option[];
    placeholder?: string;
    icon?: string;
    wrapperClassName?: string;
    error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ id, value, onChange, options = [], placeholder, icon, disabled = false, className = '', wrapperClassName = '', error, children, ...props }, ref) => (
        <div className={`relative group ${wrapperClassName}`}>
            {icon && (
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors duration-300 text-slate-400 group-focus-within:text-blue-600 dark:text-slate-500 dark:group-focus-within:text-blue-400">
                    <span className="material-icons !text-lg">{icon}</span>
                </div>
            )}
            <select
                id={id}
                value={value}
                onChange={onChange}
                disabled={disabled}
                ref={ref}
                className={`
            w-full appearance-none rounded-xl border-2 
            bg-white dark:bg-slate-950 
            py-3.5 pr-10 text-sm font-medium 
            text-slate-900 dark:text-slate-100 
            shadow-sm transition-all duration-200 ease-out
            
            ${error
                        ? 'border-red-300 dark:border-red-800/50 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900/30'
                        : 'border-slate-200 dark:border-slate-800 focus:border-blue-600 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20'}

            focus:outline-none 
            disabled:bg-slate-50 dark:disabled:bg-slate-900/50 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:border-slate-100 dark:disabled:border-slate-800 disabled:cursor-not-allowed
            ${icon ? 'pl-11' : 'pl-4'} 
            ${className}
        `}
                {...props}
            >
                {placeholder && (
                    <option value="" disabled className="text-slate-400 bg-white dark:bg-slate-950">
                        {placeholder}
                    </option>
                )}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-950">
                        {opt.label}
                    </option>
                ))}
                {children}
            </select>

            {/* Custom Chevron */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 dark:text-slate-600 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400">
                <span className="material-icons !text-xl">expand_more</span>
            </div>

            {error && <span className="text-xs text-red-500 mt-1 ml-1">{error}</span>}
        </div>
    )
);

Select.displayName = 'Select';
export default Select;
