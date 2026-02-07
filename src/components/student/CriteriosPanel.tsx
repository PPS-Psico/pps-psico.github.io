import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
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
  const MobileView = () => {
    // Animated counter for hours
    const [displayHours, setDisplayHours] = React.useState(0);

    React.useEffect(() => {
      const targetHours = Math.round(criterios.horasTotales);
      const duration = 2000;
      const steps = 60;
      const increment = targetHours / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= targetHours) {
          setDisplayHours(targetHours);
          clearInterval(timer);
        } else {
          setDisplayHours(Math.round(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, [criterios.horasTotales]);

    // Confetti effect when all criteria met
    React.useEffect(() => {
      if (todosLosCriteriosCumplidos) {
        const colors = ["#6366f1", "#8b5cf6", "#10b981", "#3b82f6"];

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: colors,
          disableForReducedMotion: true,
        });
      }
    }, [todosLosCriteriosCumplidos]);

    // Calculate progress percentages
    const rotationProgress = Math.min(
      (criterios.orientacionesCursadasCount / ROTACION_OBJETIVO_ORIENTACIONES) * 100,
      100
    );

    const specialtyProgress =
      selectedOrientacion && HORAS_OBJETIVO_ORIENTACION > 0
        ? Math.min((criterios.horasOrientacionElegida / HORAS_OBJETIVO_ORIENTACION) * 100, 100)
        : 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mb-6"
      >
        <div
          className={`
            relative overflow-hidden rounded-3xl p-6
            ${
              todosLosCriteriosCumplidos
                ? "bg-gradient-to-br from-emerald-50/90 via-white/90 to-teal-50/90 dark:from-emerald-900/20 dark:via-slate-900/80 dark:to-teal-900/20"
                : "bg-white/90 dark:bg-slate-900/90"
            }
            backdrop-blur-2xl
            border-2 
            ${
              todosLosCriteriosCumplidos
                ? "border-emerald-200/60 dark:border-emerald-800/40"
                : "border-slate-200/60 dark:border-slate-700/40"
            }
            shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50
          `}
        >
          {/* Animated gradient border */}
          <div
            className={`
              absolute inset-0 rounded-3xl opacity-50
              ${
                todosLosCriteriosCumplidos
                  ? "bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20"
                  : "bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10"
              }
            `}
            style={{
              backgroundSize: "200% 200%",
              animation: "gradient-shift 8s ease infinite",
            }}
          />

          {/* Background glow effects */}
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none animate-pulse" />

          {/* Success celebration icon */}
          <AnimatePresence>
            {todosLosCriteriosCumplidos && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="absolute top-4 right-4 w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30"
              >
                <span className="material-icons text-white text-2xl">verified</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative z-10">
            {/* Header with animated counter */}
            <div className="mb-6">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                Horas Acumuladas
              </p>
              <div className="flex items-baseline gap-2">
                <motion.span
                  className={`text-6xl font-black tracking-tighter ${
                    todosLosCriteriosCumplidos
                      ? "text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {displayHours}
                </motion.span>
                <span className="text-xl font-bold text-slate-400 dark:text-slate-600">hs</span>
              </div>

              {/* Main Progress Bar */}
              <div className="mt-4">
                <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${
                      todosLosCriteriosCumplidos
                        ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                        : "bg-gradient-to-r from-indigo-500 to-purple-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min((criterios.horasTotales / HORAS_OBJETIVO_TOTAL) * 100, 100)}%`,
                    }}
                    transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                  >
                    {todosLosCriteriosCumplidos && (
                      <motion.div
                        className="absolute inset-0 bg-white/30"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      />
                    )}
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <AnimatePresence mode="wait">
              {todosLosCriteriosCumplidos ? (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center"
                >
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    ¡Felicitaciones! Has completado todos los criterios
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="incomplete"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 text-center"
                >
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-tight">
                    Has completado el{" "}
                    <strong className="text-blue-600 dark:text-blue-400">{progressPercent}%</strong>{" "}
                    de las horas requeridas.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Criteria Items with Progress Bars */}
            <div className="space-y-4">
              {/* Rotation Criteria */}
              <motion.div
                className={`
                  p-4 rounded-2xl border transition-all duration-300
                  ${
                    criterios.cumpleRotacion
                      ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  }
                `}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                      w-8 h-8 rounded-xl flex items-center justify-center
                      ${
                        criterios.cumpleRotacion
                          ? "bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-400"
                          : "bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-400"
                      }
                    `}
                    >
                      <span className="material-icons text-sm">
                        {criterios.cumpleRotacion ? "check_circle" : "sync"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Rotación de Áreas
                    </span>
                  </div>
                  <span
                    className={`text-lg font-black ${
                      criterios.cumpleRotacion
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {criterios.orientacionesCursadasCount} / {ROTACION_OBJETIVO_ORIENTACIONES}
                  </span>
                </div>

                <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${
                      criterios.cumpleRotacion
                        ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                        : "bg-gradient-to-r from-indigo-400 to-blue-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${rotationProgress}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
              </motion.div>

              {/* Specialty Criteria */}
              <motion.div
                className={`
                  p-4 rounded-2xl border transition-all duration-300
                  ${
                    criterios.cumpleHorasOrientacion
                      ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  }
                `}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                      w-8 h-8 rounded-xl flex items-center justify-center
                      ${
                        criterios.cumpleHorasOrientacion
                          ? "bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-400"
                          : "bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-400"
                      }
                    `}
                    >
                      <span className="material-icons text-sm">
                        {criterios.cumpleHorasOrientacion ? "check_circle" : "school"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {selectedOrientacion || "Especialidad"}
                    </span>
                  </div>
                  <span
                    className={`text-lg font-black ${
                      criterios.cumpleHorasOrientacion
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {selectedOrientacion
                      ? `${Math.round(criterios.horasOrientacionElegida)}hs`
                      : "-"}
                  </span>
                </div>

                {selectedOrientacion && (
                  <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        criterios.cumpleHorasOrientacion
                          ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                          : "bg-gradient-to-r from-purple-400 to-pink-500"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${specialtyProgress}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                    />
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>

        {/* CSS for gradient animation */}
        <style>{`
          @keyframes gradient-shift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      </motion.div>
    );
  };

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
