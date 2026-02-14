import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";

interface EnrollmentTrendChartProps {
  data: { year: string; value: number; label?: string }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Año {label}</p>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-slate-500 dark:text-slate-400 font-medium">Matrícula Activa:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

const EnrollmentTrendChart: React.FC<EnrollmentTrendChartProps> = ({ data }) => {
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full h-[350px] bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center"
      >
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
          <span className="material-icons !text-4xl text-slate-400 dark:text-slate-500">
            trending_up
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">
          Evolución de Matrícula Activa
        </h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center max-w-xs">
          No hay datos de evolución disponibles para el año seleccionado.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-[350px] bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <span className="material-icons !text-lg">trending_up</span>
          </span>
          Evolución de Matrícula Activa
        </h3>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActivos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
              className="dark:stroke-slate-800"
            />
            <XAxis
              dataKey="year"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              dy={10}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorActivos)"
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default EnrollmentTrendChart;
