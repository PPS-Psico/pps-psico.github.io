import React from "react";

interface ProgressCircleProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const ProgressCircle: React.FC<ProgressCircleProps> = React.memo(
  ({ value, max, size = 180, strokeWidth = 12, className = "" }) => {
    const percentage = max > 0 ? Math.max(0, Math.min((value / max) * 100, 100)) : 0;
    const isComplete = percentage >= 100;

    // Add padding for glow
    const padding = 20;
    const svgSize = size + padding;
    const center = svgSize / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{ width: svgSize, height: svgSize }}
      >
        {/* Background Glow */}
        {isComplete && (
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse-glow"></div>
        )}

        <svg width={svgSize} height={svgSize} className="transform -rotate-90 relative z-10">
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-slate-200 dark:text-slate-700/30"
          />

          {/* Progress */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={isComplete ? "#10b981" : "#3b82f6"} // Emerald or Blue
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-1000 ease-out drop-shadow-md"
          />
        </svg>

        {/* Percentage Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-center">
            <span
              className={`text-4xl font-black tracking-tighter ${isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-white"}`}
            >
              {Math.round(percentage)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
);

ProgressCircle.displayName = "ProgressCircle";

export default ProgressCircle;
