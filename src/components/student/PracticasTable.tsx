import React, { useRef, useState } from "react";
import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOTA_PRACTICAS,
} from "../../constants";
import type { Practica } from "../../types";
import {
  cleanDbValue,
  formatDate,
  normalizeStringForComparison,
  parseToUTCDate,
} from "../../utils/formatters";
import EmptyState from "../EmptyState";
import NotaSelector from "../NotaSelector";
import { TableSkeleton } from "../Skeletons";
import { logger } from "../../utils/logger";
import { haptics } from "../../utils/haptics";

interface PracticasTableProps {
  practicas: Practica[];
  handleNotaChange: (practicaId: string, nota: string, convocatoriaId?: string) => void;
  handleFechaFinChange?: (practicaId: string, fecha: string) => void;
  isLoading?: boolean;
  onRequestModificacion?: (practica: Practica) => void;
  onDeletePractica?: (practicaId: string) => void;
  onRequestNuevaPPS?: () => void;
}

// Flat editorial grade — número plano clickeable, color de marca (sin caja ni slot-machine)
const FlatGrade: React.FC<{
  nota: string;
  onClick: () => void;
  isSaving: boolean;
  isSuccess: boolean;
  isOpen: boolean;
}> = ({ nota, onClick, isSaving, isSuccess, isOpen }) => {
  const num = parseInt(nota, 10);
  const hasGrade = !isNaN(num);
  const color = !hasGrade
    ? "var(--student-ink-subtle, #94a3b8)"
    : num >= 7
      ? "#3CB88D" // teal · aprobado holgado
      : num >= 4
        ? "#B7770B" // ámbar · aprobado justo
        : "#C0392B"; // rojo · desaprobado
  const displayText = hasGrade ? String(num) : "Pend.";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Clic para editar nota"
      className={`prow__nota cursor-pointer leading-none transition-opacity hover:opacity-60 ${
        isOpen ? "opacity-100 underline underline-offset-4 decoration-2" : ""
      }`}
      style={{
        color,
        fontFamily: hasGrade ? undefined : "var(--font-sans)",
        fontSize: hasGrade ? undefined : 12,
        fontWeight: hasGrade ? undefined : 700,
        letterSpacing: hasGrade ? undefined : 0,
        minWidth: hasGrade ? undefined : 38,
      }}
    >
      {isSaving ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" />
      ) : isSuccess ? (
        <span className="material-icons !text-2xl align-middle">check</span>
      ) : (
        displayText
      )}
    </button>
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
        className="bg-white dark:bg-slate-800 border border-emerald-500 rounded px-1 py-0.5 text-xs text-slate-800 dark:text-white outline-none w-28"
      />
    );
  }

  return (
    <span
      onClick={handleContainerClick}
      className="group/date relative cursor-default md:cursor-pointer flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      title="Clic para editar fecha (Solo PC)"
    >
      {formatDate(dateStr)}
      <span className="material-icons !text-[10px] opacity-0 group-hover/date:opacity-100 transition-opacity hidden md:inline-block">
        edit
      </span>
    </span>
  );
};

const PracticaRow: React.FC<{
  practica: Practica;
  onNotaChange: (id: string, nota: string) => void;
  onFechaFinChange?: (id: string, fecha: string) => void;
  onRequestModificacion?: (practica: Practica) => void;
  onDeletePractica?: (id: string) => void;
  isSaving: boolean;
  isSuccess: boolean;
  index: number;
}> = ({
  practica,
  onNotaChange,
  onFechaFinChange,
  onRequestModificacion,
  onDeletePractica,
  isSaving,
  isSuccess,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect>(new DOMRect(0, 0, 0, 0));
  const triggerRef = useRef<HTMLDivElement>(null);

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

  const getAreaColor = (area: string) => {
    const norm = normalizeStringForComparison(area);
    if (norm.includes("clinica")) return "var(--area-clinica, #3CB88D)";
    if (norm.includes("educacion") || norm.includes("educacional"))
      return "var(--area-educacional, #203B73)";
    if (norm.includes("laboral") || norm.includes("trabajo")) return "var(--area-laboral, #c23b3f)";
    if (norm.includes("comunitaria") || norm.includes("social"))
      return "var(--area-comunitaria, #7A3F9E)";
    return "var(--accent, #1f3a8a)";
  };

  const areaText = practica[FIELD_ESPECIALIDAD_PRACTICAS] || "General";
  const color = getAreaColor(areaText);
  const notaActual = practica[FIELD_NOTA_PRACTICAS] || "Sin calificar";

  const handleSelectGrade = (selectedNota: string) => {
    haptics.select();
    onNotaChange(practica.id, selectedNota);
    setIsMenuOpen(false);
  };

  // Long-press en la tarjeta → solicitar modificación (reemplaza el botón de
  // editar para ganar espacio). Un toque corto sobre la nota sigue editándola.
  const lpTimer = useRef<number | null>(null);
  const lpFired = useRef(false);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const lpStartPress = (e: React.PointerEvent) => {
    if (!onRequestModificacion) return;
    lpFired.current = false;
    lpStart.current = { x: e.clientX, y: e.clientY };
    lpTimer.current = window.setTimeout(() => {
      lpFired.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
      onRequestModificacion(practica);
    }, 500);
  };
  const lpCancel = () => {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
    lpStart.current = null;
  };
  const lpMove = (e: React.PointerEvent) => {
    if (!lpStart.current) return;
    if (
      Math.abs(e.clientX - lpStart.current.x) > 10 ||
      Math.abs(e.clientY - lpStart.current.y) > 10
    ) {
      lpCancel();
    }
  };

  return (
    <div
      className="prow flex w-full gap-4 items-start relative group select-none bg-white dark:bg-[#131829] border border-slate-200/80 dark:border-slate-800/40 rounded-2xl py-3.5 pl-5 pr-4 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.35)] hover:shadow-md transition-[box-shadow,transform] active:scale-[0.995]"
      onPointerDown={lpStartPress}
      onPointerUp={lpCancel}
      onPointerCancel={lpCancel}
      onPointerLeave={lpCancel}
      onPointerMove={lpMove}
      onContextMenu={(e) => {
        if (onRequestModificacion) e.preventDefault();
      }}
      onClickCapture={(e) => {
        if (lpFired.current) {
          e.preventDefault();
          e.stopPropagation();
          lpFired.current = false;
        }
      }}
      style={onRequestModificacion ? { WebkitTouchCallout: "none" } : undefined}
    >
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="prow__area font-semibold text-xs" style={{ color }}>
            {areaText}
          </span>
          <span className="prow__status text-[10px] inline-flex items-center gap-1 uppercase tracking-wider text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 inline-block" />
            {status}
          </span>
        </div>

        <h3 className="prow__name text-slate-900 dark:text-white text-base md:text-lg font-display font-semibold leading-tight break-words">
          {institucion}
        </h3>

        <div className="prow__dates flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
          <span>{formatDate(practica[FIELD_FECHA_INICIO_PRACTICAS])}</span>
          <span>-</span>
          <DateDisplay
            dateStr={practica[FIELD_FECHA_FIN_PRACTICAS] || null}
            onDateChange={(newDate) => onFechaFinChange && onFechaFinChange(practica.id, newDate)}
            label="Fecha Fin"
          />
        </div>
      </div>

      <div className="prow__metrics flex items-center gap-4 flex-shrink-0 self-center pr-1">
        {/* Eliminar — solo en contextos que lo habilitan (no en el panel del alumno).
            La edición/modificación se dispara manteniendo presionada la tarjeta. */}
        {onDeletePractica && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("¿Estás seguro de que deseas eliminar esta práctica?")) {
                onDeletePractica(practica.id);
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
            title="Eliminar práctica"
          >
            <span className="material-icons text-base">delete_outline</span>
          </button>
        )}

        <div className="prow__hs flex flex-col items-center justify-center text-center">
          <span className="display text-[22px] font-bold font-display text-slate-800 dark:text-slate-200">
            {practica[FIELD_HORAS_PRACTICAS] || 0}
          </span>
          <span className="mono prow__hs-u text-[9px] uppercase tracking-wider text-slate-400">
            hs
          </span>
        </div>

        <div className="relative flex flex-col items-center" ref={triggerRef}>
          <FlatGrade
            nota={notaActual}
            onClick={() => (isMenuOpen ? setIsMenuOpen(false) : handleMenuToggle())}
            isSaving={isSaving}
            isSuccess={isSuccess}
            isOpen={isMenuOpen}
          />
          <span className="mono prow__hs-u text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">
            nota
          </span>
        </div>
      </div>

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
  );
};

const PracticasTable: React.FC<PracticasTableProps> = ({
  practicas,
  handleNotaChange,
  handleFechaFinChange,
  isLoading = false,
  onRequestModificacion,
  onDeletePractica,
  onRequestNuevaPPS,
}) => {
  if (import.meta.env.DEV) {
    logger.info("[DEBUG] PracticasTable Props:", {
      practicasCount: practicas.length,
      hasDateHandler: !!handleFechaFinChange,
      hasModificacionHandler: !!onRequestModificacion,
      hasNuevaPPSHandler: !!onRequestNuevaPPS,
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
      <div className="flex justify-between items-baseline px-2 mb-1">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-normal">
          Mis prácticas
        </h3>
        <span className="mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {sortedPracticas.length} {sortedPracticas.length === 1 ? "práctica" : "prácticas"}
        </span>
      </div>

      {sortedPracticas.map((practica, index) => (
        <PracticaRow
          key={practica.id}
          practica={practica}
          onNotaChange={onLocalNoteChange}
          onFechaFinChange={handleFechaFinChange}
          onRequestModificacion={onRequestModificacion}
          onDeletePractica={onDeletePractica}
          isSaving={savingNotaId === practica.id}
          isSuccess={justUpdatedPracticaId === practica.id}
          index={index}
        />
      ))}

      {/* Botón sutil para agregar nueva PPS */}
      {onRequestNuevaPPS && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={onRequestNuevaPPS}
            className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-uflo-teal hover:shadow-lg hover:scale-110 hover:border-emerald-200 dark:hover:border-emerald-900/30 active:scale-90 transition"
            title="Cargar una PPS realizada"
            aria-label="Cargar una PPS realizada"
          >
            <span className="material-icons text-2xl" aria-hidden="true">
              add
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticasTable;
