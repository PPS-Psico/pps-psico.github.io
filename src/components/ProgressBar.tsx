import React from "react";

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  isComplete: boolean;
  compact?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  label,
  unit = "",
  isComplete,
  compact = false,
}) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const roundedValue = Math.round(value);

  // Dynamic colors based on completion
  const colorClass = isComplete
    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
    : "bg-gradient-to-r from-blue-500 to-indigo-600";

  const iconColorClass = isComplete
    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
    : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";

  if (compact) {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate max-w-[70%]">
            {label}
          </span>
          <span
            className={`text-xs font-bold ${isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}
          >
            {roundedValue}/{max}
            {unit}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={`${colorClass} h-full rounded-full transition-[width] duration-1000 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-5 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm transition hover:shadow-md">
      {/* Header Unificado */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconColorClass}`}
          >
            <span className="material-icons !text-xl">{isComplete ? "verified" : "schedule"}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Criterio de Horas
            </p>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
              {label}
            </h3>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`text-2xl font-black tracking-tight ${isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-white"}`}
          >
            {roundedValue}
          </span>
          <span className="text-xs font-bold text-slate-400 ml-1">
            / {max}
            {unit}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
        <div
          className={`${colorClass} h-full rounded-full transition-[width] duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.3)]`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>

      {isComplete && (
        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-fade-in">
          <span className="material-icons !text-sm">check_circle</span>
          Objetivo cumplido
        </p>
      )}
    </div>
  );
};

export default ProgressBar;
