
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ id, type, value, onChange, placeholder, icon, disabled = false, className = '', wrapperClassName = '', ...props }, ref) => (
    <div className={`relative group ${wrapperClassName}`}>
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors duration-300 text-blue-400 group-focus-within:text-blue-700 dark:group-focus-within:text-blue-400">
          <span className="material-icons !text-lg">{icon}</span>
        </div>
      )}
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        ref={ref}
        className={`
            w-full rounded-xl border-2 
            border-blue-50 dark:border-slate-500 
            py-3.5 pr-4 text-sm font-medium 
            text-blue-950 dark:text-slate-100 
            bg-white dark:bg-slate-950 
            shadow-sm transition-all duration-200 ease-out
            placeholder:text-blue-200 dark:placeholder:text-slate-500
            focus:border-blue-600 dark:focus:border-blue-400 
            focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 
            focus:outline-none 
            disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border-slate-100 dark:disabled:border-slate-800 disabled:cursor-not-allowed
            ${icon ? 'pl-11' : 'pl-4'} 
            ${className}
        `}
        placeholder={placeholder}
        {...props}
      />
    </div>
  )
);

Input.displayName = 'Input';
export default Input;
