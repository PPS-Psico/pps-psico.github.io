
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: string;
  wrapperClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ children, id, value, onChange, disabled = false, className = '', icon, wrapperClassName = '', ...props }, ref) => (
    <div className={`relative group ${wrapperClassName}`}>
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors duration-300 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400">
          <span className="material-icons !text-lg text-blue-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400">{icon}</span>
        </div>
      )}
      <select
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        ref={ref}
        className={`
            appearance-none w-full rounded-xl border-2 
            border-blue-50 dark:border-slate-500 
            py-3 pr-10 text-sm font-medium
            text-blue-950 dark:text-slate-100 
            bg-white dark:bg-slate-950 
            shadow-sm 
            focus:border-blue-600 dark:focus:border-blue-400 
            focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 
            outline-none transition-all 
            disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border-slate-100 dark:disabled:border-slate-800 disabled:cursor-not-allowed
            ${icon ? 'pl-12' : 'pl-4'} 
            ${className}
        `}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
        <span className="material-icons !text-lg text-blue-200 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">expand_more</span>
      </div>
    </div>
  )
);

Select.displayName = 'Select';
export default Select;
