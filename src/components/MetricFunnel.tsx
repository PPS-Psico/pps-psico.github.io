import React from "react";

export interface FunnelRowProps {
  label: string;
  value: number;
  total: number;
  color: string;
  onClick: () => void;
  description: string;
}

const FunnelRow: React.FC<FunnelRowProps> = ({
  label,
  value,
  total,
  color,
  onClick,
  description,
}) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl transition duration-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-600"
      aria-label={`${label}: ${value} (${total > 0 ? Math.round(percentage) : "N/A"}%)`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </div>
        <div className="flex-shrink-0 w-full sm:w-64 flex items-center gap-4">
          <div
            className="w-full bg-slate-200/70 dark:bg-slate-700 rounded-full h-2.5 shadow-inner"
            aria-hidden="true"
          >
            <div
              className={`h-2.5 rounded-full transition-[width] duration-700 ease-out ${color}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="text-right">
            <p className="font-black text-lg text-slate-900 dark:text-slate-50 leading-none">
              {value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-none">
              {total > 0 ? `${Math.round(percentage)}%` : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
};

export default FunnelRow;
