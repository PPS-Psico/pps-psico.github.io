import React from "react";
import { createPortal } from "react-dom";
import type { CriteriosCalculados, InformeTask } from "../types";

interface AcreditacionPreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  criterios: CriteriosCalculados;
  informeTask: InformeTask; // Mantenemos la prop aunque no usemos informeSubido directamente por seguridad
}

const AcreditacionPreflightModal: React.FC<AcreditacionPreflightModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  criterios,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[95%] max-w-3xl bg-white dark:bg-[#0F172A] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh] border border-slate-200 dark:border-slate-800 animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fijo */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <span className="material-icons !text-2xl">verified</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                Estado de Acreditación
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Verificación automática de requisitos académicos
              </p>
            </div>
          </div>
        </div>

        {/* Contenido Scrolleable */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-[#0B1120]">
          {/* Mensaje de advertencia cuando faltan requisitos */}
          {!(
            criterios.cumpleHorasTotales &&
            criterios.cumpleRotacion &&
            criterios.cumpleHorasOrientacion &&
            !criterios.tienePracticasPendientes
          ) && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl">
              <div className="flex items-start gap-3">
                <span className="material-icons text-amber-500 text-xl mt-0.5">warning</span>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                  El sistema detecta que aún no cumples los requisitos para la acreditación. Si esto
                  es un error o tienes la autorización del coordinador, puedes continuar.
                </p>
              </div>
            </div>
          )}

          {/* Grid Layout para ahorrar espacio vertical */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* 1. HORAS TOTALES */}
            <div
              className={`p-4 rounded-2xl border transition-all duration-300 ${criterios.cumpleHorasTotales ? "bg-white border-emerald-100 shadow-sm dark:bg-slate-800 dark:border-emerald-900/30" : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Carga Horaria
                </span>
                <span
                  className={`material-icons !text-lg ${criterios.cumpleHorasTotales ? "text-emerald-500" : "text-slate-300"}`}
                >
                  {criterios.cumpleHorasTotales ? "check_circle" : "schedule"}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span
                  className={`text-2xl font-black ${criterios.cumpleHorasTotales ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}
                >
                  {Math.round(criterios.horasTotales)}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 350 hs</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${criterios.cumpleHorasTotales ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(100, (criterios.horasTotales / 350) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* 2. ROTACIÓN */}
            <div
              className={`p-4 rounded-2xl border transition-all duration-300 ${criterios.cumpleRotacion ? "bg-white border-emerald-100 shadow-sm dark:bg-slate-800 dark:border-emerald-900/30" : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Rotación
                </span>
                <span
                  className={`material-icons !text-lg ${criterios.cumpleRotacion ? "text-emerald-500" : "text-amber-400"}`}
                >
                  {criterios.cumpleRotacion ? "check_circle" : "cached"}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span
                  className={`text-2xl font-black ${criterios.cumpleRotacion ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}
                >
                  {criterios.orientacionesCursadasCount}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 2 áreas</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">
                Áreas clínicas, educacionales, laborales, etc.
              </p>
            </div>

            {/* 3. ESPECIALIDAD */}
            <div
              className={`p-4 rounded-2xl border transition-all duration-300 ${criterios.cumpleHorasOrientacion ? "bg-white border-emerald-100 shadow-sm dark:bg-slate-800 dark:border-emerald-900/30" : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Especialidad
                </span>
                <span
                  className={`material-icons !text-lg ${criterios.cumpleHorasOrientacion ? "text-emerald-500" : "text-purple-400"}`}
                >
                  {criterios.cumpleHorasOrientacion ? "check_circle" : "stars"}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span
                  className={`text-2xl font-black ${criterios.cumpleHorasOrientacion ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}
                >
                  {Math.round(criterios.horasOrientacionElegida)}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 70 hs</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${criterios.cumpleHorasOrientacion ? "bg-emerald-500" : "bg-purple-500"}`}
                  style={{
                    width: `${Math.min(100, (criterios.horasOrientacionElegida / 70) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* 4. ESTADO PRÁCTICAS */}
            <div
              className={`p-4 rounded-2xl border transition-all duration-300 ${!criterios.tienePracticasPendientes ? "bg-white border-emerald-100 shadow-sm dark:bg-slate-800 dark:border-emerald-900/30" : "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30"}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Estado Prácticas
                </span>
                <span
                  className={`material-icons !text-lg ${!criterios.tienePracticasPendientes ? "text-emerald-500" : "text-amber-500"}`}
                >
                  {!criterios.tienePracticasPendientes ? "task_alt" : "warning"}
                </span>
              </div>
              <div className="mb-1">
                <span
                  className={`text-lg font-bold ${!criterios.tienePracticasPendientes ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-500"}`}
                >
                  {!criterios.tienePracticasPendientes ? "Todas Finalizadas" : "Pendientes"}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">
                {!criterios.tienePracticasPendientes
                  ? "Sin cursos activos."
                  : "Debes finalizar tus prácticas activas."}
              </p>
            </div>
          </div>

          {/* ADVERTENCIA INFORMES (Width Full) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 p-5">
            <div className="flex gap-4 relative z-10">
              <div className="p-2.5 bg-white dark:bg-blue-800 rounded-full shadow-sm shrink-0 h-fit text-blue-600 dark:text-blue-200">
                <span className="material-icons !text-lg">description</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">
                  Informes Corregidos
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg">
                  Es requisito indispensable contar con{" "}
                  <strong>todos los informes de prácticas corregidos y aprobados</strong>. El
                  sistema permite avanzar, pero asegúrate de cumplir para evitar rechazos.
                </p>
              </div>
            </div>
            {/* Decoración de fondo */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
          </div>
        </div>

        {/* Footer Fijo */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-end gap-4 z-20">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className={`
                flex-1 sm:flex-none px-8 py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2
                ${
                  criterios.cumpleHorasTotales &&
                  criterios.cumpleRotacion &&
                  criterios.cumpleHorasOrientacion &&
                  !criterios.tienePracticasPendientes
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                    : "bg-slate-900 dark:bg-white dark:text-slate-900 shadow-slate-900/20 dark:shadow-none hover:bg-slate-800 dark:hover:bg-slate-200"
                }
              `}
            >
              <span>
                {criterios.cumpleHorasTotales &&
                criterios.cumpleRotacion &&
                criterios.cumpleHorasOrientacion &&
                !criterios.tienePracticasPendientes
                  ? "Confirmar Todo"
                  : "Continuar"}
              </span>
              <span className="material-icons !text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AcreditacionPreflightModal;
