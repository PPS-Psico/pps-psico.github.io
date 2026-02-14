import React from "react";

export interface HeroMetricProps {
  title: string;
  value: string | number;
  icon: string;
  description: string;
  onClick: () => void;
  color: "blue" | "indigo" | "emerald";
  trend?: {
    value: number;
    label: string;
  };
}

const HeroMetric: React.FC<HeroMetricProps> = ({
  title,
  value,
  icon,
  description,
  onClick,
  color,
  trend,
}) => {
  const colorClasses = {
    blue: "from-blue-50 to-sky-100/50 border-blue-200/60 text-blue-700 hover:border-blue-300 hover:shadow-blue-500/10 dark:from-blue-900/20 dark:to-sky-900/20 dark:border-blue-800/60 dark:text-blue-300 dark:hover:border-blue-700 dark:hover:shadow-blue-500/10",
    indigo:
      "from-indigo-50 to-purple-100/50 border-indigo-200/60 text-indigo-700 hover:border-indigo-300 hover:shadow-indigo-500/10 dark:from-indigo-900/20 dark:to-purple-900/20 dark:border-indigo-800/60 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:shadow-indigo-500/10",
    emerald:
      "from-emerald-50 to-teal-100/50 border-emerald-200/60 text-emerald-700 hover:border-emerald-300 hover:shadow-emerald-500/10 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:shadow-emerald-500/10",
  };

  const trendIsPositive = trend && trend.value > 0;
  const trendIsNegative = trend && trend.value < 0;

  return (
    <button
      onClick={onClick}
      className={`group relative text-left w-full p-6 rounded-2xl border bg-gradient-to-br transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 dark:focus-visible:ring-offset-slate-900 ${colorClasses[color]}`}
      aria-label={title}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <p className="text-sm font-bold opacity-80">{title}</p>
          <p className="text-5xl md:text-6xl font-black text-slate-900 dark:text-slate-50 tracking-tighter mt-2">
            {value}
          </p>
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs font-bold ${
                trendIsPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : trendIsNegative
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <span className="material-icons !text-sm">
                {trendIsPositive
                  ? "trending_up"
                  : trendIsNegative
                    ? "trending_down"
                    : "trending_flat"}
              </span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="opacity-70">{trend.label}</span>
            </div>
          )}
        </div>
        <div
          className={`p-3 rounded-xl bg-white/50 dark:bg-slate-900/30 shadow-sm border border-black/5 dark:border-white/5 ${
            color === "blue"
              ? "text-blue-600 dark:text-blue-400"
              : color === "indigo"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          <span className="material-icons !text-3xl" aria-hidden="true">
            {icon}
          </span>
        </div>
      </div>
      <p className="text-xs opacity-70 mt-4 dark:text-current dark:opacity-60">{description}</p>
    </button>
  );
};

export default HeroMetric;
