
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { motion } from 'framer-motion';

interface EvolutionData {
    year: string;
    value: number;
    label: string;
    isProjection?: boolean;
    isManualCorrection?: boolean;
    list?: any[];
}

interface EnrollmentEvolutionChartProps {
  data: EvolutionData[];
  onBarClick?: (yearData: EvolutionData) => void;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{data.year}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-white">{data.label}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{data.value}</span>
          <span className="text-xs font-bold text-slate-500">Nuevos Alumnos</span>
        </div>
        {data.isManualCorrection && (
            <p className="mt-2 text-[9px] text-slate-500 dark:text-slate-400 italic leading-tight max-w-[180px]">
                Valor ajustado: Excluye los 84 alumnos remanentes de 2024 para mayor precisión.
            </p>
        )}
        {data.isProjection && (
            <div className="mt-2 py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded uppercase tracking-tighter">
                Dato Proyectado
            </div>
        )}
      </div>
    );
  }
  return null;
};

const EnrollmentEvolutionChart: React.FC<EnrollmentEvolutionChartProps> = ({ data, onBarClick }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-[380px] bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-8">
         <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <span className="material-icons !text-xl">analytics</span>
         </div>
         <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white leading-none">Nuevos Inscriptos</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Evolución del flujo anual</p>
         </div>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
            <XAxis 
                dataKey="year" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} 
                dy={10}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar 
                dataKey="value" 
                radius={[10, 10, 0, 0]}
                onClick={(data) => onBarClick?.(data)}
                className="cursor-pointer"
            >
                {data.map((entry, index) => {
                    let fillColor = '#2563eb'; // Real
                    if (entry.year === '2025') fillColor = '#3b82f6'; 
                    if (entry.isProjection) fillColor = '#f59e0b'; 

                    return (
                        <Cell 
                            key={`cell-${index}`} 
                            fill={fillColor}
                            stroke={entry.isProjection ? fillColor : 'none'}
                            strokeDasharray={entry.isProjection ? "4 4" : "0"}
                        />
                    );
                })}
                <LabelList 
                    dataKey="value" 
                    position="top" 
                    style={{ fill: '#64748b', fontSize: 13, fontWeight: 900 }} 
                />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dato Histórico</span>
          </div>
          <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 border border-dashed border-amber-600"></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Proyección 2026</span>
          </div>
      </div>
    </motion.div>
  );
};

export default EnrollmentEvolutionChart;
