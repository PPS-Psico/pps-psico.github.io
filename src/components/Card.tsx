
import React from 'react';

interface CardProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: string;
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  titleAs?: 'h1' | 'h2' | 'h3';
  titleClassName?: string;
  noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  description,
  icon,
  actions,
  className = '',
  style,
  titleAs = 'h2',
  titleClassName = '',
  noPadding = false
}) => {

  const TitleTag = titleAs;

  return (
    <div
      className={`glass-panel rounded-3xl transition-all duration-300 ${className}`}
      style={style}
    >
      {(title || description || actions) && (
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100/50 dark:border-white/5 ${noPadding ? 'p-6' : 'p-6 sm:p-8 mb-0'}`}>
          {(title || description) && (
            <div className="flex items-start gap-4 flex-grow">
              {icon && (
                <div className="flex-shrink-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 text-blue-600 dark:text-blue-400 rounded-2xl h-12 w-12 flex items-center justify-center shadow-sm">
                  <span className="material-icons !text-2xl">{icon}</span>
                </div>
              )}
              <div>
                {title && (
                  <TitleTag className={`text-slate-900 dark:text-white text-xl font-black tracking-tight ${titleClassName}`}>
                    {title}
                  </TitleTag>
                )}
                {description && (
                  <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm leading-relaxed">{description}</p>
                )}
              </div>
            </div>
          )}
          {actions && (
            <div className="flex-shrink-0 self-start sm:self-center">
                {actions}
            </div>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6 sm:p-8 pt-0'}>
        {children}
      </div>
    </div>
  );
};

export default Card;
