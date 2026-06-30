import React from "react";

interface HistogramData {
  label: string;
  value: number;
  students: any[];
}
interface HistogramProps {
  data: HistogramData[];
  title: string;
  onBarClick: (label: string, students: any[]) => void;
}

const Histogram: React.FC<HistogramProps> = ({ data, title, onBarClick }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 0);

  return (
    <div>
      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-center mb-4">{title}</h3>
      <div className="flex justify-around items-end h-48 gap-2 px-2 border-b border-l border-slate-200 dark:border-slate-700 pb-2">
        {data.map((bin, index) => {
          const heightPercentage = maxValue > 0 ? (bin.value / maxValue) * 100 : 0;
          return (
            <div
              key={bin.label}
              className="flex-1 flex flex-col items-center justify-end h-full group relative"
            >
              <span className="absolute -top-5 text-xs font-bold text-slate-700 dark:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">
                {bin.value}
              </span>
              <button
                onClick={() => onBarClick(bin.label, bin.students)}
                className="w-3/4 h-full flex items-end justify-center"
                aria-label={`${bin.value} alumnos en el rango ${bin.label}`}
              >
                <div
                  className="w-full bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-md transition-[height,box-shadow] duration-300 group-hover:from-blue-500 group-hover:to-blue-700 group-hover:shadow-lg"
                  style={{
                    height: `${heightPercentage}%`,
                    minHeight: "4px",
                    animation: `grow-bar-vertical 0.8s ${index * 100}ms ease-out forwards`,
                    transformOrigin: "bottom",
                  }}
                ></div>
              </button>
              <div className="text-center text-xs text-slate-500 dark:text-slate-400 mt-1.5 whitespace-nowrap">
                {bin.label}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
            @keyframes grow-bar-vertical {
                from { transform: scaleY(0); }
                to { transform: scaleY(1); }
            }
        `}</style>
    </div>
  );
};

export default Histogram;
