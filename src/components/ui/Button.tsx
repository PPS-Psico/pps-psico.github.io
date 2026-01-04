import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

const baseClasses = 'inline-flex items-center justify-center font-bold rounded-lg transition-all duration-300 ease-in-out shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 active:scale-95';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30 dark:hover:shadow-blue-400/20 hover:-translate-y-1 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-slate-900 disabled:from-slate-400 disabled:to-slate-400 has-shine-effect hover:shine-effect',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:-translate-y-px active:bg-slate-100 focus-visible:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600 dark:active:bg-slate-500 dark:focus-visible:ring-offset-slate-900 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 hover:-translate-y-1 focus-visible:ring-rose-500 dark:focus-visible:ring-offset-slate-900 disabled:bg-rose-300',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'py-2 px-4 text-sm gap-2',
  md: 'py-2.5 px-6 text-base gap-2.5',
  lg: 'py-3 px-8 text-lg gap-3',
};

const iconSizeClasses: Record<ButtonSize, string> = {
    sm: '!text-base',
    md: '!text-lg',
    lg: '!text-xl',
};

const Button: React.FC<ButtonProps> = ({ 
    children, 
    variant = 'primary',
    size = 'md', 
    icon, 
    iconPosition = 'left',
    isLoading = false,
    disabled,
    className,
    ...props 
}) => {
  const finalClassName = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ].filter(Boolean).join(' ');

  const iconMarkup = icon && (
    <span className={`material-icons ${iconSizeClasses[size]}`}>{icon}</span>
  );

  return (
    <button className={finalClassName} disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <>
            <div className="w-5 h-5 border-2 border-current/50 border-t-current rounded-full animate-spin"></div>
            <span>Cargando...</span>
        </>
      ) : (
        <>
          {iconPosition === 'left' && iconMarkup}
          {children}
          {iconPosition === 'right' && iconMarkup}
        </>
      )}
    </button>
  );
};

export default Button;
