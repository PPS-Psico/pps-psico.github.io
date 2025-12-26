
import React, { useMemo, useState } from 'react';
import { HORAS_OBJETIVO_TOTAL, HORAS_OBJETIVO_ORIENTACION } from '../constants';
import ProgressCircle from './ProgressCircle';
import OrientacionSelector from './OrientacionSelector';
import type { CriteriosCalculados, Orientacion } from '../types';
import { CriteriosPanelSkeleton } from './Skeletons';

// Componente: Widget de Estado Rediseñado
const StatusWidget = ({ 
  icon, 
  label, 
  value, 
  subValue, 
  isCompleted 
}: { 
  icon: string, 
  label: string, 
  value: React.ReactNode, 
  subValue?: string, 
  isCompleted: boolean 
}) => (
  <div className={`
    relative overflow-hidden rounded-[2rem] p-6 flex flex-col justify-between h-full transition-all duration-500
    ${isCompleted 
      ? 'bg-emerald-50/50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-500/30' 
      : 'bg-white border border-blue-100 dark:bg-slate-800/40 dark:border-indigo-500/20 backdrop-blur-sm'
    } shadow-sm hover:shadow-md
  `}>
    <div className="flex justify-between items-start z-10">
        <div className={`
            w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500
            ${isCompleted 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                : 'bg-blue-50 text-blue-600 dark:bg-indigo-500/20 dark:text-indigo-400'
            }
        `}>
            <span className="material-icons !text-2xl">{icon}</span>
        </div>
        {isCompleted && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Completado</span>
            </div>
        )}
    </div>

    <div className="mt-6 z-10">
        <h4 className="text-[11px] font-bold text-blue-300 dark:text-slate-400 uppercase tracking-[0.2em] mb-2">
            {label}
        </h4>
        <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-black tracking-tighter ${isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-900 dark:text-white'}`}>
                {value}
            </span>
            {subValue && (
                <span className="text-sm font-bold text-blue-200 dark:text-slate-500">
                    {subValue}
                </span>
            )}
        </div>
    </div>
  </div>
);

// --- MODAL DE ADVERTENCIA ESTILO FORMULARIO ---
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
        { label: `Completar ${HORAS_OBJETIVO_TOTAL} horas totales`, ok: criterios.cumpleHorasTotales, icon: 'history_toggle_off' },
        { label: `Alcanzar ${HORAS_OBJETIVO_ORIENTACION} horas de especialidad`, ok: criterios.cumpleHorasOrientacion, icon: 'psychology' },
        { label: 'Rotar por al menos 3 áreas', ok: criterios.cumpleRotacion, icon: 'autorenew' },
        { label: 'Cerrar prácticas activas', ok: !criterios.tienePracticasPendientes, icon: 'fact_check' },
    ];

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-blue-950/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-blue-100 dark:border-slate-800 flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
                
                {/* Header Estilo Formulario */}
                <div className="p-6 border-b border-blue-50 dark:border-slate-800 bg-blue-50/30 dark:bg-slate-900/50 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl shadow-sm">
                            <span className="material-icons !text-3xl">warning_amber</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-blue-950 dark:text-white tracking-tight">Requisitos Pendientes</h2>
                            <p className="text-sm font-medium text-blue-600/60 dark:text-slate-400">Verificación de cumplimiento académico</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-icons">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                        Nuestros registros automáticos indican que aún no has completado todos los requisitos obligatorios para solicitar la acreditación definitiva:
                    </p>

                    <div className="grid gap-3">
                        {items.map((item, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${item.ok ? 'bg-emerald-50/30 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/50' : 'bg-blue-50/30 dark:bg-slate-800/40 border-blue-100 dark:border-slate-800'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`material-icons !text-lg ${item.ok ? 'text-emerald-500' : 'text-blue-400'}`}>{item.icon}</span>
                                    <span className={`text-sm font-bold ${item.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-blue-900 dark:text-slate-400'}`}>{item.label}</span>
                                </div>
                                {item.ok ? (
                                    <span className="material-icons text-emerald-500 !text-xl">check_circle</span>
                                ) : (
                                    <span className="material-icons text-rose-400 !text-xl">pending</span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300 italic leading-relaxed">
                            Si crees que esto es un error y tienes los documentos (informes, planillas) que avalan tus horas, puedes proceder con el trámite. La coordinación validará la documentación adjunta.
                        </p>
                    </div>
                </div>

                {/* Footer Estilo Formulario */}
                <div className="p-6 border-t border-blue-50 dark:border-slate-800 bg-blue-50/30 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-3">
                    <button onClick={onClose} className="flex-1 py-3.5 rounded-xl font-bold text-blue-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors text-sm">
                        Volver y Revisar
                    </button>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }}
                        className="flex-[2] py-3.5 rounded-xl font-bold text-white bg-blue-700 dark:bg-white dark:text-slate-900 hover:bg-blue-800 dark:hover:bg-slate-200 shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <span>Iniciar trámite de todas formas</span>
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

  const intelligentComment = useMemo(() => {
    if (todosLosCriteriosCumplidos) {
        return "¡Excelente! Has cumplido con todos los requisitos curriculares. Asegúrate de tener todos los informes corregidos para iniciar tu trámite de acreditación final.";
    }
    
    if (criterios.cumpleHorasTotales && criterios.cumpleRotacion && criterios.cumpleHorasOrientacion && criterios.tienePracticasPendientes) {
        return "Has alcanzado los objetivos de horas, pero aún tienes prácticas vigentes. Debes cerrarlas para poder acreditar.";
    }

    const faltantes = [];
    if (!criterios.cumpleHorasTotales) faltantes.push(`${Math.round(criterios.horasFaltantes250)}hs totales`);
    if (!criterios.cumpleHorasOrientacion) faltantes.push(`${Math.round(criterios.horasFaltantesOrientacion)}hs de especialidad`);
    if (!criterios.cumpleRotacion) faltantes.push(`${3 - criterios.orientacionesCursadasCount} áreas por rotar`);

    if (faltantes.length > 0) {
        return `Para acreditar te falta completar: ${faltantes.join(', ')}.`;
    }

    return "Continúa sumando horas en distintas áreas para completar tu formación académica.";
  }, [criterios, todosLosCriteriosCumplidos]);

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
    <section className="animate-fade-in-up space-y-6">
      {/* 1. MAIN PROGRESS CARD (FULL WIDTH) */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-[#0F172A] p-8 sm:p-10 shadow-xl shadow-blue-900/5 dark:shadow-none border border-blue-50 dark:border-white/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="flex-1 text-center md:text-left space-y-6">
                  <div>
                      <h2 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-3 flex items-center justify-center md:justify-start gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Progreso de Formación
                      </h2>
                      <div className="flex items-baseline justify-center md:justify-start gap-3">
                          <span className="text-7xl sm:text-8xl font-black tracking-tighter text-blue-950 dark:text-white leading-none">
                              {Math.round(criterios.horasTotales)}
                          </span>
                          <span className="text-2xl text-blue-200 dark:text-slate-400 font-bold">/ {HORAS_OBJETIVO_TOTAL} hs</span>
                      </div>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg font-medium leading-relaxed max-w-xl">
                      {intelligentComment}
                  </p>

                  <div className="pt-4">
                      <button
                          onClick={handleButtonClick}
                          className={`
                              group relative overflow-hidden px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 shadow-sm border
                              ${todosLosCriteriosCumplidos 
                                  ? 'bg-white text-blue-600 border-blue-200 hover:shadow-md hover:bg-blue-50 dark:bg-slate-900 dark:text-blue-400 dark:border-blue-800/50 dark:hover:bg-slate-800/80' 
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800/60'
                              }
                          `}
                      >
                          <div className="relative z-10 flex items-center gap-3">
                              <span className="material-icons !text-xl">
                                  {todosLosCriteriosCumplidos ? 'verified' : 'auto_awesome'}
                              </span>
                              <span>Iniciar Acreditación</span>
                          </div>
                      </button>
                  </div>
              </div>
              
              <div className="flex-shrink-0 transform scale-125 md:scale-150 py-10 md:py-0 md:pr-10">
                   <ProgressCircle 
                      value={criterios.horasTotales} 
                      max={HORAS_OBJETIVO_TOTAL} 
                      size={150} 
                      strokeWidth={12}
                  />
              </div>
          </div>
      </div>

      {/* 2. SECONDARY WIDGETS (TWO COLUMNS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="h-full">
              {selectedOrientacion ? (
                   <StatusWidget 
                      icon="psychology"
                      label={`Especialidad: ${selectedOrientacion}`}
                      value={Math.round(criterios.horasOrientacionElegida)}
                      subValue={`/ ${HORAS_OBJETIVO_ORIENTACION}`}
                      isCompleted={criterios.cumpleHorasOrientacion}
                   />
              ) : (
                  <div className="h-full bg-white dark:bg-[#1E293B] rounded-[2rem] p-8 border-2 border-dashed border-blue-100 dark:border-slate-700 flex flex-col justify-center items-center text-center hover:border-blue-400 dark:hover:border-blue-500 transition-all group cursor-pointer shadow-sm">
                      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-500 transition-transform group-hover:scale-110">
                          <span className="material-icons !text-3xl">add_task</span>
                      </div>
                      <OrientacionSelector
                          selectedOrientacion={selectedOrientacion}
                          onOrientacionChange={handleOrientacionChange}
                          showSaveConfirmation={showSaveConfirmation}
                      />
                  </div>
              )}
          </div>

          <div className="h-full">
              <StatusWidget 
                  icon="autorenew"
                  label="Áreas de Rotación"
                  value={`${criterios.orientacionesCursadasCount} áreas`}
                  subValue="/ 3"
                  isCompleted={criterios.cumpleRotacion}
              />
          </div>
      </div>

      {/* Modals */}
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
