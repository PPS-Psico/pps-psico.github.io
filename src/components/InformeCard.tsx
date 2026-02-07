import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { InformeTask } from "../types";
import { formatDate, parseToUTCDate } from "../utils/formatters";

interface InformeCardProps {
  task: InformeTask;
  onConfirmar: (task: InformeTask) => void;
}

// Custom animated icons
const AnimatedCheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <motion.svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    initial="hidden"
    animate="visible"
  >
    <motion.path
      d="M20 6L9 17l-5-5"
      variants={{
        hidden: { pathLength: 0, opacity: 0 },
        visible: {
          pathLength: 1,
          opacity: 1,
          transition: {
            pathLength: { duration: 0.6, ease: "easeOut" },
            opacity: { duration: 0.2 },
          },
        },
      }}
    />
  </motion.svg>
);

const AnimatedHourglassIcon: React.FC<{ className?: string }> = ({ className }) => (
  <motion.svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <motion.g
      animate={{
        rotateY: [0, 360],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "linear",
      }}
      style={{ transformOrigin: "center" }}
    >
      <path d="M6 2v6c0 2.97 2.16 5.44 5 5.9v.1c-2.84.46-5 2.93-5 5.9V22h12v-2.1c0-2.97-2.16-5.44-5-5.9v-.1c2.84-.46 5-2.93 5-5.9V2H6zm10 6c0 2.21-1.79 4-4 4s-4-1.79-4-4V4h8v4z" />
    </motion.g>
  </motion.svg>
);

const AnimatedUploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <motion.svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <motion.path
      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.5 }}
    />
    <motion.path
      d="M17 8l-5-5-5 5"
      initial={{ pathLength: 0, y: 5 }}
      animate={{ pathLength: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    />
    <motion.line
      x1="12"
      y1="3"
      x2="12"
      y2="15"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    />
  </motion.svg>
);

const RippleEffect: React.FC<{ isActive: boolean; color: string }> = ({ isActive, color }) => {
  if (!isActive) return null;

  return (
    <span className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
      <motion.span
        className={`absolute inset-0 rounded-2xl ${color}`}
        initial={{ scale: 0, opacity: 0.5 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </span>
  );
};

const InformeCard: React.FC<InformeCardProps> = ({ task, onConfirmar }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const { nota, informeSubido } = task;

  const statusInfo = useMemo(() => {
    if (
      nota &&
      nota !== "Sin calificar" &&
      nota !== "Entregado (sin corregir)" &&
      nota !== "No Entregado"
    ) {
      return {
        key: "calificado" as const,
        icon: "task_alt",
        iconComponent: <AnimatedCheckIcon className="w-6 h-6" />,
        gradient: "from-blue-500 to-cyan-400",
        darkGradient: "from-blue-400 to-cyan-300",
        glowColor: "shadow-blue-500/30",
        darkGlowColor: "shadow-blue-400/20",
        borderGradient: "from-blue-500 via-cyan-400 to-blue-500",
        iconContainerClass: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
        labelGradient: "from-blue-50 to-blue-100/50",
        darkLabelGradient: "from-blue-900/30 to-blue-800/20",
      };
    }
    if (informeSubido) {
      return {
        key: "en_correccion" as const,
        icon: "hourglass_top",
        iconComponent: <AnimatedHourglassIcon className="w-6 h-6" />,
        gradient: "from-emerald-500 to-teal-400",
        darkGradient: "from-emerald-400 to-teal-300",
        glowColor: "shadow-emerald-500/30",
        darkGlowColor: "shadow-emerald-400/20",
        borderGradient: "from-emerald-500 via-teal-400 to-emerald-500",
        iconContainerClass:
          "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
        labelGradient: "from-emerald-50 to-emerald-100/50",
        darkLabelGradient: "from-emerald-900/30 to-emerald-800/20",
      };
    }
    return {
      key: "pendiente" as const,
      icon: "upload",
      iconComponent: <AnimatedUploadIcon className="w-6 h-6" />,
      gradient: "from-amber-500 to-orange-400",
      darkGradient: "from-amber-400 to-orange-300",
      glowColor: "shadow-amber-500/30",
      darkGlowColor: "shadow-amber-400/20",
      borderGradient: "from-amber-500 via-orange-400 to-amber-500",
      iconContainerClass: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
      labelGradient: "from-amber-50 to-amber-100/50",
      darkLabelGradient: "from-amber-900/30 to-amber-800/20",
    };
  }, [nota, informeSubido]);

  const { deadlineLabel, deadline } = useMemo(() => {
    const isSubmitted = statusInfo.key === "en_correccion" && task.fechaEntregaInforme;
    const baseDateString = isSubmitted ? task.fechaEntregaInforme : task.fechaFinalizacion;
    const label = isSubmitted ? "Límite de Corrección" : "Fecha Estimada de Entrega";

    const baseDate = parseToUTCDate(baseDateString);
    if (!baseDate) {
      return { deadlineLabel: label, deadline: null };
    }

    const deadlineDate = new Date(baseDate.getTime());
    deadlineDate.setUTCDate(deadlineDate.getUTCDate() + 30);

    return { deadlineLabel: label, deadline: deadlineDate };
  }, [task.fechaFinalizacion, task.fechaEntregaInforme, statusInfo.key]);

  const handleConfirmClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsConfirming(true);
    try {
      await onConfirmar(task);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleTouchStart = () => setIsTouched(true);
  const handleTouchEnd = () => setTimeout(() => setIsTouched(false), 800);

  const DeadlineInfo: React.FC = () => {
    if (!deadline) {
      return (
        <p className="text-sm font-bold mt-1.5 text-slate-400 dark:text-slate-500 italic">
          Fecha límite no disponible
        </p>
      );
    }
    if (statusInfo.key === "calificado") {
      return null;
    }

    return (
      <p className="text-sm font-semibold mt-2 text-slate-500 dark:text-slate-400 tracking-tight">
        {deadlineLabel}:{" "}
        <span className="text-slate-700 dark:text-slate-300">
          {formatDate(deadline.toISOString())}
        </span>
      </p>
    );
  };

  const ActionComponent = () => {
    const shineAnimation = {
      initial: { x: "-100%", opacity: 0.5 },
      animate: {
        x: "200%",
        opacity: 0,
        transition: {
          duration: 1.5,
          repeat: Infinity,
          repeatDelay: 2,
          ease: "easeInOut",
        },
      },
    };

    switch (statusInfo.key) {
      case "calificado":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative overflow-hidden w-full inline-flex items-center justify-center gap-2 font-bold text-sm py-2.5 px-5 rounded-xl border-0 shadow-lg ${statusInfo.glowColor} dark:${statusInfo.darkGlowColor}`}
            style={{
              background: `linear-gradient(135deg, var(--tw-gradient-stops))`,
            }}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-r ${statusInfo.labelGradient} dark:${statusInfo.darkLabelGradient} rounded-xl`}
            />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
              variants={shineAnimation}
              initial="initial"
              animate="animate"
            />
            <div className="relative flex items-center gap-2 text-blue-800 dark:text-blue-200">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.2 }}
                className="material-icons !text-base"
              >
                grading
              </motion.span>
              <span>Nota: {nota}</span>
            </div>
          </motion.div>
        );
      case "en_correccion":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative overflow-hidden w-full inline-flex items-center justify-center gap-2 font-bold text-sm py-2.5 px-5 rounded-xl border-0 shadow-lg ${statusInfo.glowColor} dark:${statusInfo.darkGlowColor}`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-r ${statusInfo.labelGradient} dark:${statusInfo.darkLabelGradient} rounded-xl`}
            />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
              variants={shineAnimation}
              initial="initial"
              animate="animate"
            />
            <div className="relative flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="material-icons !text-base"
              >
                schedule
              </motion.span>
              <span>Entregado</span>
            </div>
          </motion.div>
        );
      case "pendiente":
        return (
          <motion.button
            onClick={handleConfirmClick}
            disabled={isConfirming}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="relative overflow-hidden w-full inline-flex items-center justify-center gap-2 font-bold text-sm py-2.5 px-5 rounded-xl border-0 shadow-lg shadow-amber-500/30 dark:shadow-amber-400/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label="Confirmar entrega del informe"
          >
            {/* Gradient background */}
            <motion.div
              className={`absolute inset-0 bg-gradient-to-r ${statusInfo.gradient} dark:${statusInfo.darkGradient}`}
              animate={{
                background: isHovered
                  ? `linear-gradient(135deg, #f59e0b 0%, #fb923c 50%, #f59e0b 100%)`
                  : `linear-gradient(135deg, #f59e0b 0%, #f97316 100%)`,
              }}
              transition={{ duration: 0.3 }}
            />

            {/* Animated gradient border effect */}
            <motion.div
              className="absolute inset-0 rounded-xl opacity-0"
              animate={{ opacity: isHovered ? 1 : 0 }}
              style={{
                padding: "2px",
                background: `linear-gradient(90deg, ${statusInfo.borderGradient.split(" ")[0].replace("from-", "")}, ${statusInfo.borderGradient.split(" ")[2]}, ${statusInfo.borderGradient.split(" ")[0].replace("from-", "")})`,
                backgroundSize: "200% 100%",
              }}
            >
              <motion.div
                className="w-full h-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{ backgroundSize: "200% 100%" }}
              />
            </motion.div>

            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
              variants={shineAnimation}
              initial="initial"
              animate="animate"
            />

            {/* Content */}
            <div className="relative flex items-center gap-2 text-white">
              {isConfirming ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="border-2 border-white/70 border-t-white rounded-full w-4 h-4"
                />
              ) : (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="material-icons !text-base"
                >
                  task_alt
                </motion.span>
              )}
              <span>Confirmar Entrega</span>
            </div>
          </motion.button>
        );
      default:
        return null;
    }
  };

  return (
    <motion.a
      href={task.informeLink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-black/40 border border-slate-200 dark:border-slate-800 cursor-pointer"
      style={{ willChange: "transform, box-shadow" }}
      aria-labelledby={`task-${task.convocatoriaId}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -4,
        transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      transition={{ duration: 0.4 }}
    >
      {/* Ripple effect */}
      <RippleEffect
        isActive={isTouched}
        color={`bg-gradient-to-r ${statusInfo.gradient} dark:${statusInfo.darkGradient}`}
      />

      {/* Animated gradient border on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{
          opacity: isHovered ? 1 : 0,
          scale: isHovered ? 1 : 0.95,
        }}
        transition={{ duration: 0.3 }}
        style={{
          padding: "2px",
          background: `linear-gradient(90deg, ${statusInfo.borderGradient.split(" ")[0].replace("from-", "")}, ${statusInfo.borderGradient.split(" ")[2]}, ${statusInfo.borderGradient.split(" ")[0].replace("from-", "")})`,
          backgroundSize: "200% 100%",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      >
        <motion.div
          className="w-full h-full rounded-2xl"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            background: `linear-gradient(90deg, ${statusInfo.borderGradient.split(" ")[0].replace("from-", "")}, ${statusInfo.borderGradient.split(" ")[2]}, ${statusInfo.borderGradient.split(" ")[0].replace("from-", "")})`,
            backgroundSize: "200% 100%",
          }}
        />
      </motion.div>

      {/* Glow effect */}
      <motion.div
        className={`absolute inset-0 rounded-2xl blur-xl opacity-0 transition-opacity duration-300 pointer-events-none ${statusInfo.glowColor} dark:${statusInfo.darkGlowColor}`}
        animate={{ opacity: isHovered ? 0.6 : 0 }}
        transition={{ duration: 0.3 }}
      />

      <article className="relative flex items-center gap-5">
        <motion.div
          className={`flex-shrink-0 size-12 rounded-xl flex items-center justify-center ${statusInfo.iconContainerClass} transition-all duration-300`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {statusInfo.iconComponent}
        </motion.div>

        <div className="flex-grow flex flex-col sm:flex-row justify-between sm:items-center min-w-0 gap-4">
          <div className="flex-grow min-w-0">
            <motion.h3
              id={`task-${task.convocatoriaId}`}
              className="text-slate-900 dark:text-slate-50 font-extrabold text-lg leading-tight tracking-tight flex items-center"
              layout
            >
              {task.ppsName}
              <motion.span
                className="material-icons !text-base ml-1.5"
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -5 }}
                transition={{ duration: 0.2 }}
              >
                launch
              </motion.span>
            </motion.h3>
            <DeadlineInfo />
          </div>

          <div className="flex-shrink-0 self-start sm:self-center w-full sm:w-52">
            <ActionComponent />
          </div>
        </div>
      </article>
    </motion.a>
  );
};

export default InformeCard;
