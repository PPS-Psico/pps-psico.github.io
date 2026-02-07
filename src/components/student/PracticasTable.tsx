import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import type { Practica } from "../../types";
import {
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_NOTA_PRACTICAS,
} from "../../constants";
import {
  formatDate,
  getEspecialidadClasses,
  getStatusVisuals,
  parseToUTCDate,
  normalizeStringForComparison,
  cleanDbValue,
} from "../../utils/formatters";
import EmptyState from "../EmptyState";
import NotaSelector from "../NotaSelector";
import { TableSkeleton } from "../Skeletons";

interface PracticasTableProps {
  practicas: Practica[];
  handleNotaChange: (practicaId: string, nota: string, convocatoriaId?: string) => void;
  handleFechaFinChange?: (practicaId: string, fecha: string) => void;
  isLoading?: boolean;
}

// Animated Grade Display with Slot Machine Effect
const AnimatedGradeDisplay: React.FC<{
  nota: string;
  onClick: () => void;
  isSaving: boolean;
  isSuccess: boolean;
  isOpen: boolean;
  prevNota?: string;
}> = ({ nota, onClick, isSaving, isSuccess, isOpen, prevNota }) => {
  const [displayNota, setDisplayNota] = useState(nota);
  const [isAnimating, setIsAnimating] = useState(false);

  // Slot machine animation when grade changes
  useEffect(() => {
    if (nota !== prevNota && prevNota !== undefined && !isNaN(parseInt(nota, 10))) {
      setIsAnimating(true);
      const targetNum = parseInt(nota, 10);
      const duration = 800;
      const steps = 10;
      const stepDuration = duration / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setDisplayNota(nota);
          setIsAnimating(false);
          clearInterval(interval);
        } else {
          // Random number during animation
          const randomNum = Math.floor(Math.random() * 10) + 1;
          setDisplayNota(randomNum.toString());
        }
      }, stepDuration);

      return () => clearInterval(interval);
    } else {
      setDisplayNota(nota);
    }
  }, [nota, prevNota]);

  const getGradeStyle = (n: string) => {
    const num = parseInt(n, 10);
    if (!isNaN(num)) {
      if (num >= 7)
        return "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 shadow-emerald-500/10 dark:shadow-emerald-500/20";
      if (num >= 4)
        return "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 shadow-amber-500/10 dark:shadow-amber-500/20";
      return "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 shadow-rose-500/10 dark:shadow-rose-500/20";
    }
    return "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700";
  };

  const style = getGradeStyle(nota);
  const displayText = !isNaN(parseInt(displayNota, 10)) ? displayNota : "-";

  return (
    <motion.div
      className={`
        relative flex items-center justify-center w-14 h-14 rounded-2xl border-2 text-2xl font-black
        ${style}
        transition-all duration-300 cursor-pointer overflow-hidden
        ${isSaving ? "animate-pulse" : "hover:shadow-lg hover:scale-105"}
        ${isOpen ? "ring-4 ring-blue-100 dark:ring-blue-900/40 border-blue-400 z-50" : ""}
      `}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      whileTap={{ scale: 0.95 }}
      title="Clic para editar nota"
    >
      {isSaving ? (
        <div className="w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin" />
      ) : isSuccess ? (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="material-icons !text-2xl"
        >
          check
        </motion.span>
      ) : (
        <motion.span
          key={isAnimating ? "animating" : displayText}
          initial={isAnimating ? { y: -20, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={isAnimating ? "blur-[1px]" : ""}
        >
          {displayText}
        </motion.span>
      )}
    </motion.div>
  );
};

const DateDisplay: React.FC<{
  dateStr: string | null;
  onDateChange: (newDate: string) => void;
  label: string;
}> = ({ dateStr, onDateChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputValue = dateStr ? dateStr.split("T")[0] : "";

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(false);
    if (e.target.value && e.target.value !== inputValue) {
      onDateChange(e.target.value);
    }
  };

  const handleContainerClick = () => {
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={inputValue}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-slate-800 dark:text-white outline-none w-28"
      />
    );
  }

  return (
    <span
      onClick={handleContainerClick}
      className="group/date relative cursor-default md:cursor-pointer flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      title="Clic para editar fecha (Solo PC)"
    >
      {formatDate(dateStr)}
      <span className="material-icons !text-[10px] opacity-0 group-hover/date:opacity-100 transition-opacity hidden md:inline-block">
        edit
      </span>
    </span>
  );
};

// 3D Tilt Card Component
const TiltCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseYSpring = useSpring(y, { stiffness: 500, damping: 100 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const PracticaRow: React.FC<{
  practica: Practica;
  onNotaChange: (id: string, nota: string) => void;
  onFechaFinChange?: (id: string, fecha: string) => void;
  isSaving: boolean;
  isSuccess: boolean;
  index: number;
}> = ({ practica, onNotaChange, onFechaFinChange, isSaving, isSuccess, index }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect>(new DOMRect(0, 0, 0, 0));
  const triggerRef = useRef<HTMLDivElement>(null);
  const [prevNota, setPrevNota] = useState(practica[FIELD_NOTA_PRACTICAS] || "Sin calificar");

  const handleMenuToggle = () => {
    if (!isSaving && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTriggerRect(rect);
      setIsMenuOpen(true);
    } else {
      setIsMenuOpen(false);
    }
  };

  const rawName = practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
  const institucion = cleanDbValue(rawName) || "Institución desconocida";

  let status = practica[FIELD_ESTADO_PRACTICA];

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (normalizeStringForComparison(status) === "en curso" && practica[FIELD_FECHA_FIN_PRACTICAS]) {
    const endDate = parseToUTCDate(practica[FIELD_FECHA_FIN_PRACTICAS]);
    if (endDate && endDate < now) {
      status = "Finalizada";
    }
  }

  const statusVisuals = getStatusVisuals(status || "");
  const espVisuals = getEspecialidadClasses(practica[FIELD_ESPECIALIDAD_PRACTICAS] || "");
  const notaActual = practica[FIELD_NOTA_PRACTICAS] || "Sin calificar";

  const handleSelectGrade = (selectedNota: string) => {
    setPrevNota(notaActual);
    onNotaChange(practica.id, selectedNota);
    setIsMenuOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <TiltCard
        className={`
          group relative bg-white dark:bg-slate-900 rounded-2xl p-5 
          border border-slate-200 dark:border-slate-800 
          transition-shadow duration-300 
          flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between
          shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50
          ${isMenuOpen ? "z-[60] ring-2 ring-blue-200 dark:ring-blue-800" : "z-10"}
          border-l-[6px] ${espVisuals.leftBorder}
        `}
      >
        <div className="pl-1 flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className={`${espVisuals.tag} text-[10px] py-0.5 px-2 font-bold rounded-full`}>
              {practica[FIELD_ESPECIALIDAD_PRACTICAS] || "General"}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusVisuals.labelClass} border bg-opacity-10`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {status}
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white pr-2 leading-tight break-words hyphens-auto">
            {institucion}
          </h3>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700/50">
              <span className="material-icons !text-sm opacity-70">date_range</span>
              <span>{formatDate(practica[FIELD_FECHA_INICIO_PRACTICAS])}</span>
              <span className="mx-1">-</span>
              <DateDisplay
                dateStr={practica[FIELD_FECHA_FIN_PRACTICAS] || null}
                onDateChange={(newDate) =>
                  onFechaFinChange && onFechaFinChange(practica.id, newDate)
                }
                label="Fecha Fin"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0">
          <div className="flex flex-col items-center justify-center min-w-[3rem] text-center">
            <motion.p
              className="text-2xl font-black text-slate-800 dark:text-slate-200 leading-none text-center w-full"
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {practica[FIELD_HORAS_PRACTICAS] || 0}
            </motion.p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 text-center w-full">
              Horas
            </p>
          </div>

          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-200 dark:via-slate-700 to-transparent hidden sm:block" />

          <div className="relative flex flex-col items-center">
            <div ref={triggerRef}>
              <AnimatedGradeDisplay
                nota={notaActual}
                prevNota={prevNota}
                onClick={() => (isMenuOpen ? setIsMenuOpen(false) : handleMenuToggle())}
                isSaving={isSaving}
                isSuccess={isSuccess}
                isOpen={isMenuOpen}
              />
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 text-center">
              Nota
            </p>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                  }}
                />

                <NotaSelector
                  onSelect={handleSelectGrade}
                  onClose={() => setIsMenuOpen(false)}
                  currentValue={notaActual}
                  triggerRect={triggerRect}
                />
              </>
            )}
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
};

const PracticasTable: React.FC<PracticasTableProps> = ({
  practicas,
  handleNotaChange,
  handleFechaFinChange,
  isLoading = false,
}) => {
  if (import.meta.env.DEV) {
    console.log("[DEBUG] PracticasTable Props:", {
      practicasCount: practicas.length,
      hasDateHandler: !!handleFechaFinChange,
    });
  }

  const [savingNotaId, setSavingNotaId] = useState<string | null>(null);
  const [justUpdatedPracticaId, setJustUpdatedPracticaId] = useState<string | null>(null);

  const onLocalNoteChange = async (practicaId: string, nota: string) => {
    setSavingNotaId(practicaId);
    await handleNotaChange(practicaId, nota);
    setSavingNotaId(null);
    setJustUpdatedPracticaId(practicaId);
    setTimeout(() => setJustUpdatedPracticaId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-end px-2 mb-1">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (practicas.length === 0) {
    return (
      <EmptyState
        type="no-practicas"
        title="Sin Prácticas"
        message="Aún no tienes historial de prácticas registradas. Completa tu primera PPS desde el panel de convocatorias."
        className="py-8"
        size="md"
      />
    );
  }

  const sortedPracticas = [...practicas].sort((a, b) => {
    const dateA = new Date(a[FIELD_FECHA_INICIO_PRACTICAS] || 0).getTime();
    const dateB = new Date(b[FIELD_FECHA_INICIO_PRACTICAS] || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-end px-2 mb-1">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Total: {sortedPracticas.length} Prácticas
        </h3>
      </div>

      {sortedPracticas.map((practica, index) => (
        <PracticaRow
          key={practica.id}
          practica={practica}
          onNotaChange={onLocalNoteChange}
          onFechaFinChange={handleFechaFinChange}
          isSaving={savingNotaId === practica.id}
          isSuccess={justUpdatedPracticaId === practica.id}
          index={index}
        />
      ))}
    </div>
  );
};

export default PracticasTable;
