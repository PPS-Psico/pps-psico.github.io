
import React from 'react';
import { CriteriosCalculados, Orientacion } from '../types';
import { ROTACION_OBJETIVO_ORIENTACIONES } from '../constants';

interface MobileCriteriaCardProps {
  criterios: CriteriosCalculados;
  selectedOrientacion: Orientacion | "";
}

const MobileCriteriaCard: React.FC<MobileCriteriaCardProps> = ({ criterios, selectedOrientacion }) => {
  const isRotationComplete = criterios.cumpleRotacion;
  const isSpecialtyComplete = criterios.cumpleHorasOrientacion;
  const isTotalComplete = criterios.cumpleHorasTotales;

  const Badge = ({ isComplete, text, subtext }: { isComplete: boolean; text: string; subtext?: string }) => (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${isComplete 
      ? 'bg-emerald-50/80 border-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' 
      : 'bg-white/60 border-slate-100 text-slate-700 dark:bg-indigo-900/10 dark:border-indigo-800 dark:text-indigo-200'
    }`}>
      <div>
        <span className="text-xs font-bold uppercase tracking-wider block">{text}</span>
      </div>
      <span className="text-sm font-black font-mono opacity-100">
        {subtext}
      </span>
    </div>
  );

  return (
    <div className="bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl rounded-[2rem] p-6 border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none relative overflow-hidden mb-6 animate-slide-up">
       {/* Background Ambience */}
       <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
       <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

       <div className="relative z-10">
          <div className="flex justify-between items-end mb-6 pb-4 border-b border-slate-100 dark:border-white/5">
              <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Horas Acumuladas</p>
                  <div className="flex items-baseline gap-1.5">
                      <span className={`text-6xl font-black tracking-tighter leading-none ${isTotalComplete ? 'text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500' : 'text-slate-900 dark:text-white'}`}>
                          {Math.round(criterios.horasTotales)}
                      </span>
                      <span className="text-lg font-bold text-slate-400 dark:text-slate-600">hs</span>
                  </div>
              </div>
              
              {/* Indicador Global de Estado */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 shadow-sm ${isTotalComplete && isRotationComplete && isSpecialtyComplete ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-100 text-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}>
                  <span className="material-icons !text-2xl">
                      {isTotalComplete && isRotationComplete && isSpecialtyComplete ? 'verified' : 'hourglass_top'}
                  </span>
              </div>
          </div>

          <div className="space-y-2">
              <Badge 
                isComplete={isRotationComplete}
                text="Rotación de Áreas"
                subtext={`${criterios.orientacionesCursadasCount} / ${ROTACION_OBJETIVO_ORIENTACIONES}`}
              />

              <Badge 
                isComplete={isSpecialtyComplete}
                text={selectedOrientacion ? selectedOrientacion : "Especialidad"}
                subtext={selectedOrientacion ? `${Math.round(criterios.horasOrientacionElegida)}hs` : "-"}
              />
          </div>
       </div>
    </div>
  );
};

export default MobileCriteriaCard;
