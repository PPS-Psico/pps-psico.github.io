import React, { useMemo, useState } from "react";
import {
  HORAS_OBJETIVO_TOTAL,
  HORAS_OBJETIVO_ORIENTACION,
  ROTACION_OBJETIVO_ORIENTACIONES,
} from "../../constants";
import ProgressCircle from "../ProgressCircle";
import OrientacionSelector from "../OrientacionSelector";
import type { CriteriosCalculados, Orientacion, InformeTask } from "../../types";
import { CriteriosPanelSkeleton } from "../Skeletons";
import { normalizeStringForComparison } from "../../utils/formatters";
import AcreditacionPreflightModal from "../AcreditacionPreflightModal";

// --- SUB-COMPONENTES PARA ESTILOS ---

// Helper para colores de etiquetas
const getAreaBadgeStyle = (areaName: string) => {
  const normalized = normalizeStringForComparison(areaName);

  if (normalized.includes("clinica")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20";
  }
  if (normalized.includes("educacional") || normalized.includes("educacion")) {
    return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20";
  }
  if (normalized.includes("laboral") || normalized.includes("trabajo")) {
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20";
  }
  if (normalized.includes("comunitaria") || normalized.includes("social")) {
    return "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20";
  }
  // Default
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
};

const DetailCard = ({
  icon,
  label,
  value,
  subValue,
  isCompleted,
  children,
  colorClass = "text-blue-600",
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  subValue?: string;
  isCompleted: boolean;
  children?: React.ReactNode;
  colorClass?: string;
}) => (
  <div
    className={`
        relative overflow-hidden rounded-[2rem] p-6 flex flex-col justify-between h-full transition-all duration-300
        glass-panel glass-card-hover group border
        ${
          isCompleted
            ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/5 dark:border-emerald-900/30"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40"
        }
    `}
  >
    <div className="flex justify-between items-start mb-4">
      <div
        className={`
                p-3 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300 shadow-sm
                ${
                  isCompleted
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-slate-50 dark:bg-slate-800 " + colorClass
                }
            `}
      >
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
        <span
          className={`text-3xl md:text-4xl font-black tracking-tight ${isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-sm font-bold text-slate-400 dark:text-slate-500">{subValue}</span>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  </div>
);

interface CriteriosPanelProps {
  criterios: CriteriosCalculados;
  selectedOrientacion: Orientacion | "";
  handleOrientacionChange: (orientacion: Orientacion | "") => void;
  showSaveConfirmation: boolean;
  onRequestFinalization: () => void;
  isLoading?: boolean;
  informeTasks?: InformeTask[]; // Nuevo prop
}

const CriteriosPanel: React.FC<CriteriosPanelProps> = ({
  criterios,
  selectedOrientacion,
  handleOrientacionChange,
  showSaveConfirmation,
  onRequestFinalization,
  isLoading = false,
  informeTasks = [],
}) => {
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Incluimos verificación de informes pendientes en la lógica
  const hasPendingCorrections = useMemo(
    () =>
      informeTasks.some(
        (t) =>
          t.informeSubido && (t.nota === "Sin calificar" || t.nota === "Entregado (sin corregir)")
      ),
    [informeTasks]
  );

  const todosLosCriteriosCumplidos = useMemo(
    () =>
      criterios.cumpleHorasTotales &&
      criterios.cumpleRotacion &&
      criterios.cumpleHorasOrientacion &&
      !criterios.tienePracticasPendientes &&
      !hasPendingCorrections, // Nuevo criterio
    [criterios, hasPendingCorrections]
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
    // Siempre mostramos el modal "bonito" ahora, que sirve tanto de confirmación exitosa como de advertencia
    setShowWarningModal(true);
  };

  if (isLoading) {
    return <CriteriosPanelSkeleton />;
  }

  // Calculate percentages
  const progressPercent = Math.min(
    100,
    Math.round((criterios.horasTotales / HORAS_OBJETIVO_TOTAL) * 100)
  );

  // --- VISTA MÓVIL OPTIMIZADA (COMPACTA) ---
  const MobileView = () => (
    <div className="bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl rounded-[2rem] p-6 border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none relative overflow-hidden mb-6">
      {/* Background Ambience */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-end mb-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
              Horas Acumuladas
            </p>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-6xl font-black tracking-tighter leading-none ${todosLosCriteriosCumplidos ? "text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500" : "text-slate-900 dark:text-white"}`}
              >
                {Math.round(criterios.horasTotales)}
              </span>
              <span className="text-lg font-bold text-slate-400 dark:text-slate-600">hs</span>
            </div>
          </div>

          {/* Indicador Global de Estado */}
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 shadow-sm ${todosLosCriteriosCumplidos ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-100 text-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"}`}
          >
            <span className="material-icons !text-2xl">
              {todosLosCriteriosCumplidos ? "verified" : "hourglass_top"}
            </span>
          </div>
        </div>

        {/* Status Text (Matches Desktop logic) */}
        <div className="mb-4">
          {todosLosCriteriosCumplidos ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold leading-tight flex items-start gap-1.5">
              <span className="material-icons !text-sm mt-0.5">check_circle</span>
              <span>¡Felicitaciones! Has completado todos los requisitos.</span>
            </p>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-tight">
              Has completado el{" "}
              <strong className="text-blue-600 dark:text-blue-400">{progressPercent}%</strong> de
              las horas requeridas para tu acreditación.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {/* Badge Rotación */}
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
              criterios.cumpleRotacion
                ? "bg-emerald-50/80 border-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300"
                : "bg-white/60 border-slate-100 text-slate-700 dark:bg-indigo-900/10 dark:border-indigo-800 dark:text-indigo-200"
            }`}
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">
                Rotación de Áreas
              </span>
            </div>
            <span className="text-sm font-black font-mono opacity-100">
              {criterios.orientacionesCursadasCount} / {ROTACION_OBJETIVO_ORIENTACIONES}
            </span>
          </div>

          {/* Badge Especialidad */}
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
              criterios.cumpleHorasOrientacion
                ? "bg-emerald-50/80 border-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300"
                : "bg-white/60 border-slate-100 text-slate-700 dark:bg-indigo-900/10 dark:border-indigo-800 dark:text-indigo-200"
            }`}
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">
                {selectedOrientacion || "Especialidad"}
              </span>
            </div>
            <span className="text-sm font-black font-mono opacity-100">
              {selectedOrientacion ? `${Math.round(criterios.horasOrientacionElegida)}hs` : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="animate-fade-in-up">
      {/* --- MÓVIL --- */}
      <div className="block lg:hidden">
        <MobileView />
      </div>

      {/* --- DESKTOP --- */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        {/* 1. HERO CARD (Recorrido Principal) */}
        <div className="col-span-2 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 dark:from-[#0B1120] dark:to-[#0f172a] text-slate-900 dark:text-white shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-200/80 dark:border-slate-800">
          {/* Background Effects */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-blue-100/60 to-transparent dark:from-blue-900/20 rounded-full blur-[120px] -mr-40 -mt-40 pointer-events-none opacity-80"></div>
          <div className="absolute bottom-0 left-0 w-full h-full bg-[url('https://www.gradients.app/linear-gradient-to-t/white-on-stone/20')] opacity-[0.03] dark:opacity-[0.07] mix-blend-overlay pointer-events-none"></div>

          {/* Grid Layout for Hero Content */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center p-8 sm:p-10 h-full">
            {/* Left Side: Text & Actions (More span) */}
            <div className="md:col-span-7 flex flex-col justify-center h-full space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm mb-4">
                  <span
                    className={`w-2 h-2 rounded-full ${todosLosCriteriosCumplidos ? "bg-emerald-500 animate-pulse" : "bg-blue-500"}`}
                  ></span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Progreso General
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-7xl sm:text-8xl font-black tracking-tighter leading-none text-slate-900 dark:text-white drop-shadow-sm">
                    {Math.round(criterios.horasTotales)}
                  </span>
                  <span className="text-2xl sm:text-3xl text-slate-400 dark:text-slate-500 font-bold">
                    hs
                  </span>
                </div>

                {/* Texto condicional */}
                {todosLosCriteriosCumplidos ? (
                  <p className="text-lg text-emerald-600 dark:text-emerald-400 font-bold mt-2 max-w-sm leading-relaxed flex items-start gap-2">
                    <span className="material-icons mt-1 !text-lg">check_circle</span>
                    ¡Felicitaciones! Has completado todos los requisitos para tu acreditación.
                  </p>
                ) : (
                  <p className="text-lg text-slate-600 dark:text-slate-400 font-medium mt-2 max-w-sm leading-relaxed">
                    Has completado el{" "}
                    <strong className="text-blue-600 dark:text-blue-400">{progressPercent}%</strong>{" "}
                    de las horas requeridas para tu acreditación.
                  </p>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleButtonClick}
                  className={`
                                    group relative inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:scale-95 border w-full sm:w-auto
                                    ${
                                      todosLosCriteriosCumplidos
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent"
                                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600"
                                    }
                                `}
                >
                  {todosLosCriteriosCumplidos ? (
                    <>
                      <span className="material-icons text-emerald-400 !text-xl">verified</span>
                      <span>Solicitar Acreditación</span>
                    </>
                  ) : (
                    <>
                      <span>Trámite de Acreditación</span>
                      <span className="material-icons !text-lg text-slate-400 group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Side: Chart (Less span, centered) */}
            <div className="md:col-span-5 flex items-center justify-center relative">
              {/* Decorative Circle Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-full blur-2xl transform scale-90"></div>

              <div className="relative z-10 scale-110">
                <ProgressCircle
                  value={criterios.horasTotales}
                  max={HORAS_OBJETIVO_TOTAL}
                  size={220}
                  strokeWidth={16}
                  className="drop-shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. COLUMNA LATERAL (Tarjetas Apiladas) */}
        <div className="col-span-1 flex flex-col gap-6">
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
                  uniqueAreas.map((area) => (
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
        informeTask={informeTasks[0]}
      />
    </section>
  );
};

export default React.memo(CriteriosPanel);
