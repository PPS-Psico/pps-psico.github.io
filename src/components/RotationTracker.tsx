import React from "react";
import { ROTACION_OBJETIVO_ORIENTACIONES } from "../constants";

interface RotationTrackerProps {
  count: number;
  orientacionesUnicas: string[];
  compact?: boolean;
}

const RotationTracker: React.FC<RotationTrackerProps> = ({
  count,
  orientacionesUnicas,
  compact = false,
}) => {
  const total = ROTACION_OBJETIVO_ORIENTACIONES;
  const isComplete = count >= total;

  const activeColor = isComplete ? "bg-emerald-500" : "bg-blue-600";
  const iconColorClass = isComplete
    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
    : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400";

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {[...Array(total)].map((_, i) => (
            <div
              key={i}
              className="w-8 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
            >
              <div
                className={`h-full rounded-full transition duration-500 ease-out ${i < count ? activeColor : "opacity-0"}`}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>
        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
          Rotación {count}/{total}
        </span>
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
            <span className="material-icons !text-xl">autorenew</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Diversidad
            </p>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
              Rotación de Áreas
            </h3>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`text-2xl font-black tracking-tight ${isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-white"}`}
          >
            {count}
          </span>
          <span className="text-xs font-bold text-slate-400 ml-1">/ {total}</span>
        </div>
      </div>

      {/* Progress Bars Segmented */}
      <div className="flex gap-2 h-2.5 mb-4">
        {[...Array(total)].map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition duration-500 ease-out ${i < count ? activeColor : "opacity-0"}`}
              style={{ width: "100%" }}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {orientacionesUnicas.length > 0 ? (
          orientacionesUnicas.map((o) => (
            <span
              key={o}
              className="text-[10px] uppercase font-bold px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
            >
              {o}
            </span>
          ))
        ) : (
          <p className="text-xs text-slate-400 italic pl-1">Sin rotaciones iniciadas.</p>
        )}
      </div>
    </div>
  );
};

export default RotationTracker;
