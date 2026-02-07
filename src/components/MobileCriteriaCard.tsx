import React, { useEffect, useState, useRef } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { CriteriosCalculados, Orientacion } from "../types";
import { ROTACION_OBJETIVO_ORIENTACIONES } from "../constants";

interface MobileCriteriaCardProps {
  criterios: CriteriosCalculados;
  selectedOrientacion: Orientacion | "";
}

// Animated Counter Component
const AnimatedCounter: React.FC<{ value: number; isComplete: boolean }> = ({
  value,
  isComplete,
}) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const springValue = useSpring(0, {
    stiffness: 50,
    damping: 20,
    duration: 2000,
  });

  const displayValue = useTransform(springValue, (latest) => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!hasAnimated) {
      springValue.set(value);
      setHasAnimated(true);
    }
  }, [value, springValue, hasAnimated]);

  useEffect(() => {
    const unsubscribe = displayValue.on("change", (latest) => {
      setDisplay(latest);
    });
    return () => unsubscribe();
  }, [displayValue]);

  return (
    <motion.span
      className={`text-6xl font-black tracking-tighter ${
        isComplete
          ? "text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500"
          : "text-slate-900 dark:text-white"
      }`}
    >
      {display}
    </motion.span>
  );
};

// Progress Bar Component with gradient
const ProgressBar: React.FC<{
  progress: number;
  isComplete: boolean;
  color: string;
}> = ({ progress, isComplete, color }) => {
  return (
    <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        className={`absolute inset-y-0 left-0 rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
      >
        {isComplete && (
          <motion.div
            className="absolute inset-0 bg-white/30"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
        )}
      </motion.div>
    </div>
  );
};

const MobileCriteriaCard: React.FC<MobileCriteriaCardProps> = ({
  criterios,
  selectedOrientacion,
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isRotationComplete = criterios.cumpleRotacion;
  const isSpecialtyComplete = criterios.cumpleHorasOrientacion;
  const isTotalComplete = criterios.cumpleHorasTotales;
  const allComplete = isTotalComplete && isRotationComplete && isSpecialtyComplete;

  // Confetti effect when all criteria are met
  useEffect(() => {
    if (allComplete && !showConfetti) {
      setShowConfetti(true);

      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ["#6366f1", "#8b5cf6", "#10b981", "#3b82f6"];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
          disableForReducedMotion: true,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
          disableForReducedMotion: true,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [allComplete, showConfetti]);

  // Calculate progress percentages
  const rotationProgress = Math.min(
    (criterios.orientacionesCursadasCount / ROTACION_OBJETIVO_ORIENTACIONES) * 100,
    100
  );
  const specialtyProgress = selectedOrientacion
    ? Math.min((criterios.horasOrientacionElegida / 100) * 100, 100) // Assuming 100 is target
    : 0;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative mb-6"
    >
      {/* Main Card with Glassmorphism */}
      <div
        className={`
          relative overflow-hidden rounded-3xl p-6
          ${
            allComplete
              ? "bg-gradient-to-br from-emerald-50/90 via-white/90 to-teal-50/90 dark:from-emerald-900/20 dark:via-slate-900/80 dark:to-teal-900/20"
              : "bg-white/90 dark:bg-slate-900/90"
          }
          backdrop-blur-2xl
          border-2 
          ${
            allComplete
              ? "border-emerald-200/60 dark:border-emerald-800/40"
              : "border-slate-200/60 dark:border-slate-700/40"
          }
          shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50
        `}
      >
        {/* Animated gradient border effect */}
        <div
          className={`
            absolute inset-0 rounded-3xl opacity-50
            ${
              allComplete
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
          {allComplete && (
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
          {/* Header with Total Hours */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
              Horas Acumuladas
            </p>
            <div className="flex items-baseline gap-2">
              <AnimatedCounter
                value={Math.round(criterios.horasTotales)}
                isComplete={isTotalComplete}
              />
              <span className="text-xl font-bold text-slate-400 dark:text-slate-600">hs</span>
            </div>

            {/* Main Progress Bar */}
            <div className="mt-4">
              <ProgressBar
                progress={Math.min((criterios.horasTotales / 1000) * 100, 100)}
                isComplete={isTotalComplete}
                color={
                  isTotalComplete
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                    : "bg-gradient-to-r from-indigo-500 to-purple-500"
                }
              />
            </div>
          </div>

          {/* Criteria Items */}
          <div className="space-y-4">
            {/* Rotation Criteria */}
            <motion.div
              className={`
                p-4 rounded-2xl border transition-all duration-300
                ${
                  isRotationComplete
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
                        isRotationComplete
                          ? "bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-400"
                          : "bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-400"
                      }
                    `}
                  >
                    <span className="material-icons text-sm">
                      {isRotationComplete ? "check_circle" : "sync"}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Rotación de Áreas
                  </span>
                </div>
                <span
                  className={`text-lg font-black ${
                    isRotationComplete
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {criterios.orientacionesCursadasCount} / {ROTACION_OBJETIVO_ORIENTACIONES}
                </span>
              </div>
              <ProgressBar
                progress={rotationProgress}
                isComplete={isRotationComplete}
                color={
                  isRotationComplete
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                    : "bg-gradient-to-r from-indigo-400 to-blue-500"
                }
              />
            </motion.div>

            {/* Specialty Criteria */}
            <motion.div
              className={`
                p-4 rounded-2xl border transition-all duration-300
                ${
                  isSpecialtyComplete
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
                        isSpecialtyComplete
                          ? "bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-400"
                          : "bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-400"
                      }
                    `}
                  >
                    <span className="material-icons text-sm">
                      {isSpecialtyComplete ? "check_circle" : "school"}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {selectedOrientacion || "Especialidad"}
                  </span>
                </div>
                <span
                  className={`text-lg font-black ${
                    isSpecialtyComplete
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {selectedOrientacion ? `${Math.round(criterios.horasOrientacionElegida)}hs` : "-"}
                </span>
              </div>
              <ProgressBar
                progress={specialtyProgress}
                isComplete={isSpecialtyComplete}
                color={
                  isSpecialtyComplete
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                    : "bg-gradient-to-r from-purple-400 to-pink-500"
                }
              />
            </motion.div>
          </div>

          {/* Status Message */}
          <AnimatePresence mode="wait">
            {allComplete ? (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center"
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
                className="mt-6 text-center"
              >
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Sigue así, estás avanzando muy bien
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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

export default MobileCriteriaCard;
