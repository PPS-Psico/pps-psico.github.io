import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";

interface OrientationDistributionChartProps {
  data: { name: string; value: number }[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-2 rounded-lg shadow-xl">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {payload[0].name}: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

const OrientationDistributionChart: React.FC<OrientationDistributionChartProps> = ({ data }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  if (!data.length || total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full h-[350px] bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center"
      >
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
          <span className="material-icons !text-4xl text-slate-400 dark:text-slate-500">
            pie_chart
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">
          Distribución por Área
        </h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center max-w-xs">
          No hay datos de distribución disponibles para el año seleccionado.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-full h-[350px] bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex flex-col"
    >
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <span className="material-icons !text-lg">pie_chart</span>
          </span>
          Distribución por Área
        </h3>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center justify-center">
        <div className="h-[220px] w-full md:w-1/2 relative">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    className="outline-none"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-slate-800 dark:text-white">{total}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Total
            </span>
          </div>
        </div>

        <div className="w-full md:w-1/2 pl-0 md:pl-8 flex flex-col justify-center gap-3">
          {data.map((entry, index) => {
            const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
            return (
              <div key={entry.name} className="flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 w-8 text-right">
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default OrientationDistributionChart;
