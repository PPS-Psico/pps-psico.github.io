
import React, { useMemo, useState } from 'react';
import { HORAS_OBJETIVO_TOTAL, HORAS_OBJETIVO_ORIENTACION, ROTACION_OBJETIVO_ORIENTACIONES } from '../constants';
import ProgressCircle from './ProgressCircle';
import OrientacionSelector from './OrientacionSelector';
import type { CriteriosCalculados, Orientacion } from '../types';
import { CriteriosPanelSkeleton } from './Skeletons';
import { normalizeStringForComparison } from '../utils/formatters';

// --- SUB-COMPONENTES PARA ESTILOS ---

// Helper para colores de etiquetas
const getAreaBadgeStyle = (areaName: string) => {
    const normalized = normalizeStringForComparison(areaName);
    
    if (normalized.includes('clinica')) {
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20';
    }
    if (normalized.includes('educacional') || normalized.includes('educacion')) {
        return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20';
    }
    if (normalized.includes('laboral') || normalized.includes('trabajo')) {
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20';
    }
    if (normalized.includes('comunitaria') || normalized.includes('social')) {
        return 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20';
    }
    // Default
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
};

const DetailCard = ({ 
    icon, 
    label, 
    value, 
    subValue, 
    isCompleted,
    children,
    colorClass = "text-blue-600"
}: { 
    icon: string, 
    label: string, 
    value: React.ReactNode, 
    subValue?: string, 
    isCompleted: boolean,
    children?: React.ReactNode,
    colorClass?: string
}) => (
    <div className={`
        relative overflow-hidden rounded-[2rem] p-6 flex flex-col justify-between h-full transition-all duration-300
        glass-panel hover:shadow-lg group border
        ${isCompleted 
            ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/5 dark:border-emerald-900/30' 
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40'
        }
    `}>
        <div className="flex justify-between items-start mb-4">
             <div className={`
                p-3 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300 shadow-sm
                ${isCompleted 
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                    : 'bg-slate-50 dark:bg-slate-800 ' + colorClass
                }
            `}>
                <span className="material-icons !text-2xl">{icon}</span>
            </div>
            {isCompleted && (
                <div className="text-emerald-500 animate-fade-in bg-emerald-100 dark:bg-emerald-900/30 rounded-full p-1">
                    <span className="material-icons !text-lg block">check</span>
                </div>
            )}
        </div>
        
        <div>
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 truncate">
                {label}
            </h4>
            <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl md:text-4xl font-black tracking-tight ${isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                    {value}
                </span>
                {subValue && (
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                        {subValue}
                    </span>
                )}
            </div>
            {children && <div className="mt-3">{children}</div>}
        </div>
    </div>
);

const AcreditacionPreflightModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    criterios 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: () => void; 
    criterios: CriteriosCalculados 
}) => {
    if (!isOpen) return null;

    const items = [
        { 
            label: `Completar ${HORAS_OBJETIVO_TOTAL} horas totales`,
            ok: criterios.cumpleHorasTotales, 
            icon: 'schedule',
            subtext: criterios.cumpleHorasTotales ? null : `${Math.round(criterios.horasTotales)}/${HORAS_OBJETIVO_TOTAL} hs`
        },
        { 
            label: `Alcanzar ${HORAS_OBJETIVO_ORIENTACION} horas de especialidad`,
            ok: criterios.cumpleHorasOrientacion, 
            icon: 'psychology',
            subtext: criterios.cumpleHorasOrientacion ? null : `${Math.round(criterios.horasOrientacionElegida)}/${HORAS_OBJETIVO_ORIENTACION} hs`
        },
        { 
            label: `Rotar por al menos ${ROTACION_OBJETIVO_ORIENTACIONES} áreas`,
            ok: criterios.cumpleRotacion, 
            icon: 'cached',
            subtext: criterios.cumpleRotacion ? null : `${criterios.orientacionesCursadasCount}/${ROTACION_OBJETIVO_ORIENTACIONES} áreas`
        },
        { 
            label: "Cerrar prácticas activas",
            ok: !criterios.tienePracticasPendientes, 
            icon: 'library_books',
            subtext: !criterios.tienePracticasPendientes ? null : "Pendientes"
        },
    ];

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in" onClick={onClose}>
            <div className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
                
                <div className="p-8 pb-0">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-2xl">
                            <span className="material-icons !text-3xl">warning_amber</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Requisitos Pendientes</h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">Verificación de cumplimiento</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                        Nuestros registros automáticos indican que aún no has completado todos los requisitos. Si tienes documentación que lo avale, puedes continuar.
                    </p>

                    <div className="space-y-3 mb-6">
                        {items.map((item, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${item.ok ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`material-icons !text-lg ${item.ok ? 'text-emerald-500' : 'text-slate-400'}`}>
                                        {item.icon}
                                    </span>
                                    <div>
                                        <p className={`text-sm font-bold ${item.ok ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {item.label}
                                        </p>
                                        {item.subtext && (
                                            <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-0.5">
                                                {item.subtext}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {item.ok && (
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                        <span className="material-icons !text-sm font-bold">check</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Volver
                    </button>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }} 
                        className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <span>Iniciar igual</span>
                        <span className="material-icons !text-lg">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

interface CriteriosPanelProps {
  criterios: CriteriosCalculados;
  selectedOrientacion: Orientacion | "";
  handleOrientacionChange: (orientacion: Orientacion | "") => void;
  showSaveConfirmation: boolean;
  onRequestFinalization: () => void;
  isLoading?: boolean;
}

const CriteriosPanel: React.FC<CriteriosPanelProps> = ({ 
    criterios, 
    selectedOrientacion, 
    handleOrientacionChange, 
    showSaveConfirmation, 
    onRequestFinalization,
    isLoading = false
}) => {
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  const todosLosCriteriosCumplidos = useMemo(() => 
    criterios.cumpleHorasTotales && 
    criterios.cumpleRotacion && 
    criterios.cumpleHorasOrientacion && 
    !criterios.tienePracticasPendientes,
    [criterios]
  );

  // Asegurar que no hay duplicados para la visualización en tarjetas
  const uniqueAreas = useMemo(() => {
      // Normalizamos y usamos un Set para unicidad real
      const uniqueNormalized = new Set();
      const uniqueDisplay = [];
      
      for (const area of criterios.orientacionesUnicas) {
          const norm = normalizeStringForComparison(area);
          if (!uniqueNormalized.has(norm)) {
              uniqueNormalized.add(norm);
              uniqueDisplay.push(area);
          }
      }
      return uniqueDisplay;
  }, [criterios.orientacionesUnicas]);

  const handleButtonClick = () => {
      if (todosLosCriteriosCumplidos) {
          onRequestFinalization();
      } else {
          setShowWarningModal(true);
      }
  };

  if (isLoading) {
      return <CriteriosPanelSkeleton />;
  }

  return (
    <section className="animate-fade-in-up">
      {/* GRID LAYOUT MODERNIZADO: 1 Main Hero + 2 Small Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 1. HERO CARD (Recorrido Principal) */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white shadow-xl shadow-slate-200/60 dark:shadow-black/50 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-12 group border border-slate-100 dark:border-slate-800">
               
               {/* Background Effects */}
               <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-blue-100/40 to-purple-100/40 dark:from-blue-600/30 dark:to-purple-600/30 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none opacity-60 dark:opacity-100 group-hover:opacity-80 transition-opacity duration-700"></div>
               <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-100/40 dark:bg-emerald-600/20 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none opacity-60 dark:opacity-100"></div>

               {/* LEFT SIDE: Data Composition */}
               <div className="relative z-10 flex-1 flex flex-col items-center md:items-start text-center md:text-left h-full justify-between gap-6">
                   
                   {/* Badge */}
                   <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 backdrop-blur-md text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-white shadow-sm">
                       <span className={`w-2 h-2 rounded-full ${todosLosCriteriosCumplidos ? 'bg-emerald-500 animate-pulse-glow' : 'bg-blue-500'}`}></span>
                       Tu Progreso Global
                   </div>
                   
                   {/* Main Metric Block */}
                   <div>
                       <div className="flex items-baseline justify-center md:justify-start">
                           <span className="text-8xl font-black tracking-tighter leading-none text-slate-900 dark:text-white drop-shadow-sm">
                               {Math.round(criterios.horasTotales)}
                           </span>
                           <span className="text-3xl text-slate-400 dark:text-slate-500 font-bold ml-1">hs</span>
                       </div>
                       <p className="text-lg font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                           Acumuladas de <strong className="text-slate-700 dark:text-slate-300 font-bold">{HORAS_OBJETIVO_TOTAL}</strong> requeridas
                       </p>
                   </div>

                   {/* Action Button: COMPACT VERSION */}
                   <button
                        onClick={handleButtonClick}
                        className={`
                            group relative inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 border backdrop-blur-md w-full sm:w-auto mt-4
                            ${todosLosCriteriosCumplidos 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/20 border-transparent' 
                                : 'bg-white/80 dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                            }
                        `}
                    >
                        <span className={`material-icons !text-lg ${todosLosCriteriosCumplidos ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'}`}>
                            {todosLosCriteriosCumplidos ? 'verified' : 'auto_awesome'}
                        </span>
                        <span>{todosLosCriteriosCumplidos ? 'Solicitar Acreditación' : 'Trámite de Acreditación'}</span>
                    </button>
               </div>

               {/* RIGHT SIDE: Chart */}
               <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-blue-100/50 dark:bg-blue-500/20 blur-3xl rounded-full transform scale-110"></div>
                    <ProgressCircle 
                        value={criterios.horasTotales} 
                        max={HORAS_OBJETIVO_TOTAL} 
                        size={180} 
                        strokeWidth={14}
                        className="drop-shadow-2xl"
                    />
               </div>
          </div>

          {/* 2. COLUMNA LATERAL (Tarjetas Apiladas) */}
          <div className="lg:col-span-1 flex flex-col gap-6">
              
              {/* Tarjeta Especialidad */}
              <div className="flex-1">
                  {selectedOrientacion ? (
                       <DetailCard 
                          icon="psychology"
                          label={`Especialidad: ${selectedOrientacion}`}
                          value={Math.round(criterios.horasOrientacionElegida)}
                          subValue={`/ ${HORAS_OBJETIVO_ORIENTACION}`}
                          isCompleted={criterios.cumpleHorasOrientacion}
                          colorClass="text-purple-600 dark:text-purple-400"
                       />
                  ) : (
                      <div className="h-full glass-panel rounded-[2rem] p-6 flex flex-col justify-center items-center text-center hover:border-blue-300 dark:hover:border-blue-700 transition-all group cursor-pointer relative overflow-hidden border-dashed border-2 border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                          <div className="relative z-10 w-full">
                              <div className="mb-4 text-slate-400 group-hover:text-blue-500 transition-colors transform group-hover:scale-110 duration-300">
                                  <span className="material-icons !text-5xl">add_task</span>
                              </div>
                              <OrientacionSelector
                                  selectedOrientacion={selectedOrientacion}
                                  onOrientacionChange={handleOrientacionChange}
                                  showSaveConfirmation={showSaveConfirmation}
                              />
                          </div>
                      </div>
                  )}
              </div>

              {/* Tarjeta Rotación */}
              <div className="flex-1">
                  <DetailCard 
                      icon="cached"
                      label="Áreas Rotadas"
                      value={criterios.orientacionesCursadasCount}
                      subValue={`/ ${ROTACION_OBJETIVO_ORIENTACIONES}`}
                      isCompleted={criterios.cumpleRotacion}
                      colorClass="text-amber-600 dark:text-amber-500"
                  >
                      {/* Unique badges list */}
                      <div className="flex flex-wrap gap-2 mt-2">
                          {uniqueAreas.length > 0 ? (
                              uniqueAreas.map(area => (
                                  <span 
                                    key={area} 
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wide shadow-sm ${getAreaBadgeStyle(area)}`}
                                  >
                                      {area}
                                  </span>
                              ))
                          ) : (
                              <span className="text-xs text-slate-400 italic">Sin áreas registradas</span>
                          )}
                      </div>
                  </DetailCard>
              </div>
          </div>
      </div>

      <AcreditacionPreflightModal 
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onConfirm={() => {
            setShowWarningModal(false);
            onRequestFinalization();
        }}
        criterios={criterios}
      />
    </section>
  );
};

export default React.memo(CriteriosPanel);
