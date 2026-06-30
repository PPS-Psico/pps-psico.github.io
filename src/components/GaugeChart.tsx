import React from "react";

interface GaugeChartProps {
  value: number; // A percentage value from 0 to 100
  title: string;
  description: string;
}

const GaugeChart: React.FC<GaugeChartProps> = ({ value, title, description }) => {
  const size = 200;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle

  const percentage = Math.max(0, Math.min(value, 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getGradientColor = (p: number) => {
    if (p < 40) return "from-rose-500 to-orange-500";
    if (p < 75) return "from-amber-500 to-yellow-500";
    return "from-emerald-500 to-teal-500";
  };

  const gradientClass = getGradientColor(percentage);

  return (
    <div className="flex flex-col items-center">
      <h3 className="font-bold text-slate-800 text-center">{title}</h3>
      <p className="text-xs text-slate-500 text-center mb-2">{description}</p>
      <div className="relative" style={{ width: size, height: size / 2 }}>
        <svg className="w-full h-full" viewBox={`0 0 ${size} ${size / 2}`}>
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className="stop-color-from" />
              <stop offset="100%" className="stop-color-to" />
            </linearGradient>
          </defs>
          {/* Background Arc */}
          <path
            d={`M ${strokeWidth / 2},${size / 2} a ${radius},${radius} 0 0 1 ${radius * 2},0`}
            className="text-slate-200"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Foreground Arc */}
          <path
            d={`M ${strokeWidth / 2},${size / 2} a ${radius},${radius} 0 0 1 ${radius * 2},0`}
            className={`bg-gradient-to-r ${gradientClass} transition-[stroke-dashoffset] duration-1000 ease-out`}
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 1s ease-out",
              // @ts-ignore
              "--stop-color-from": `var(--tw-gradient-from, #ef4444)`,
              "--stop-color-to": `var(--tw-gradient-to, #f97316)`,
            }}
          />
        </svg>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <span className="text-4xl font-black text-slate-800 tracking-tighter">{percentage}%</span>
        </div>
      </div>
    </div>
  );
};

export default GaugeChart;
