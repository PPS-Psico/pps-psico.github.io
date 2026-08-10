import React, { useEffect, useRef } from "react";
import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
} from "../../constants";
import {
  type MoodleGradeSnapshot,
  useMoodleGradeSync,
} from "../../contexts/MoodleGradeSyncContext";
import { getPracticePresentationStatus, isPracticeDisapproved } from "../../logic/studentRules";
import type { Practica } from "../../types";
import { cleanDbValue, formatDate, normalizeStringForComparison } from "../../utils/formatters";
import { haptics } from "../../utils/haptics";
import { logger } from "../../utils/logger";
import { presentMoodleGrade } from "../../utils/moodleGradePresentation";
import EmptyState from "../EmptyState";
import { TableSkeleton } from "../Skeletons";
import { canShowPpsAssignmentSummary } from "./PpsAssignmentSummary";

interface PracticasTableProps {
  practicas: Practica[];
  isLoading?: boolean;
  onRequestModificacion?: (practica: Practica) => void;
  onRequestNuevaPPS?: () => void;
  onViewAssignmentSummary?: (practica: Practica) => void;
}

// Flat editorial grade — número plano clickeable, color de marca (sin caja ni slot-machine)
const PracticaRow: React.FC<{
  practica: Practica;
  moodleSnapshot?: MoodleGradeSnapshot;
  onRequestModificacion?: (practica: Practica) => void;
  onViewAssignmentSummary?: (practica: Practica) => void;
  index: number;
}> = ({ practica, moodleSnapshot, onRequestModificacion, onViewAssignmentSummary }) => {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    },
    []
  );

  const rawName = practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
  const institucion = cleanDbValue(rawName) || "Institución desconocida";

  const disapproved = isPracticeDisapproved(practica[FIELD_ESTADO_PRACTICA]);
  const presentationStatus = getPracticePresentationStatus(practica);

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
  const campusGrade = presentMoodleGrade(moodleSnapshot);

  const canRequestModification = Boolean(onRequestModificacion && !disapproved);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  const isNestedControl = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(target.closest("button, input, select, textarea, a, [role='button']"));

  const handleLongPressStart = (event: React.PointerEvent<HTMLElement>) => {
    if (!canRequestModification || isNestedControl(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    cancelLongPress();
    longPressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressStartRef.current = null;
      haptics.select();
      onRequestModificacion?.(practica);
    }, 550);
  };

  const handleLongPressMove = (event: React.PointerEvent<HTMLElement>) => {
    const start = longPressStartRef.current;
    if (!start) return;
    if (Math.abs(event.clientX - start.x) > 12 || Math.abs(event.clientY - start.y) > 12) {
      cancelLongPress();
    }
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!canRequestModification || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      haptics.select();
      onRequestModificacion?.(practica);
    }
  };

  return (
    <article
      className={`prow flex w-full gap-4 items-start relative group flex-wrap bg-white dark:bg-[#131829] border border-slate-200/80 dark:border-slate-800/40 rounded-2xl py-3.5 pl-5 pr-4 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.35)] hover:shadow-md transition-[box-shadow,background-color] ${
        canRequestModification
          ? "select-none active:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:active:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
          : ""
      }`}
      role={canRequestModification ? "button" : undefined}
      tabIndex={canRequestModification ? 0 : undefined}
      aria-label={
        canRequestModification
          ? `${institucion}. Abrir opciones de edición de la práctica.`
          : undefined
      }
      aria-describedby={canRequestModification ? "practicas-edit-hint" : undefined}
      onPointerDown={handleLongPressStart}
      onPointerMove={handleLongPressMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onKeyDown={handleCardKeyDown}
      onContextMenu={(event) => {
        if (canRequestModification && !isNestedControl(event.target)) event.preventDefault();
      }}
      style={canRequestModification ? { WebkitTouchCallout: "none" } : undefined}
    >
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="prow__area font-semibold text-xs" style={{ color }}>
            {areaText}
          </span>
          <span
            className={`prow__status text-[10px] inline-flex items-center gap-1 uppercase tracking-wider ${
              presentationStatus.tone === "active"
                ? "text-blue-600 dark:text-blue-300"
                : presentationStatus.tone === "complete"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : presentationStatus.tone === "danger"
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${
                presentationStatus.tone === "active"
                  ? "bg-blue-500"
                  : presentationStatus.tone === "complete"
                    ? "bg-emerald-500"
                    : presentationStatus.tone === "danger"
                      ? "bg-rose-500"
                      : "bg-slate-400"
              }`}
              aria-hidden="true"
            />
            {presentationStatus.label}
          </span>
        </div>

        <h3 className="prow__name text-slate-900 dark:text-white text-base md:text-lg font-display font-semibold leading-tight break-words">
          {institucion}
        </h3>

        <div className="prow__dates flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
          <span>{formatDate(practica[FIELD_FECHA_INICIO_PRACTICAS])}</span>
          <span>-</span>
          <span>{formatDate(practica[FIELD_FECHA_FIN_PRACTICAS])}</span>
        </div>
      </div>

      <div className="prow__metrics flex items-center gap-4 flex-shrink-0 self-center pr-1">
        <div className="prow__hs flex flex-col items-center justify-center text-center">
          <span className="display text-[22px] font-bold font-display text-slate-800 dark:text-slate-200">
            {disapproved ? 0 : practica[FIELD_HORAS_PRACTICAS] || 0}
          </span>
          <span className="mono prow__hs-u text-[9px] uppercase tracking-wider text-slate-400">
            hs
          </span>
        </div>

        <div className="relative flex flex-col items-center">
          {disapproved ? (
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              Desaprobada
            </span>
          ) : (
            <span
              className={`prow__nota min-w-11 min-h-11 inline-flex items-center justify-center text-center leading-tight ${
                campusGrade?.hasGrade
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              title={campusGrade?.detail || "Todavía no hay datos sincronizados desde Campus"}
            >
              {campusGrade?.compact || "Pend."}
            </span>
          )}
          <span className="mono prow__hs-u text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">
            Campus
          </span>
        </div>
      </div>

      {onViewAssignmentSummary && canShowPpsAssignmentSummary(practica) ? (
        <div className="pps-summary-mobile-action">
          <div>
            <strong>Resumen de tu asignación</strong>
            <span>Horario y datos listos para imprimir</span>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewAssignmentSummary(practica);
            }}
            aria-label={`Ver resumen informativo de ${institucion}`}
          >
            Ver resumen
            <span className="material-icons" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </div>
      ) : null}
    </article>
  );
};

const PracticasTable: React.FC<PracticasTableProps> = ({
  practicas,
  isLoading = false,
  onRequestModificacion,
  onRequestNuevaPPS,
  onViewAssignmentSummary,
}) => {
  const { snapshotsByPractice } = useMoodleGradeSync();
  if (import.meta.env.DEV) {
    logger.info("[DEBUG] PracticasTable Props:", {
      practicasCount: practicas.length,
      hasModificacionHandler: !!onRequestModificacion,
      hasNuevaPPSHandler: !!onRequestNuevaPPS,
    });
  }

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
        title="Todavía no hay prácticas"
        message="Tu historial va a aparecer cuando ingreses mediante una convocatoria o cargues una PPS que ya realizaste."
        className="py-8"
        size="md"
        action={
          onRequestNuevaPPS ? (
            <button
              type="button"
              onClick={onRequestNuevaPPS}
              className="min-h-11 px-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              <span className="material-icons !text-lg" aria-hidden="true">
                add
              </span>
              Cargar una PPS realizada
            </button>
          ) : undefined
        }
      />
    );
  }

  const sortedPracticas = [...practicas].sort((a, b) => {
    const dateA = new Date(a[FIELD_FECHA_INICIO_PRACTICAS] || 0).getTime();
    const dateB = new Date(b[FIELD_FECHA_INICIO_PRACTICAS] || 0).getTime();
    return dateB - dateA;
  });
  const hasEditablePractices =
    Boolean(onRequestModificacion) &&
    sortedPracticas.some((practica) => !isPracticeDisapproved(practica[FIELD_ESTADO_PRACTICA]));

  return (
    <div className="flex flex-col gap-4">
      <div className="px-2 mb-1">
        <div className="flex justify-between items-baseline">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-normal">
            Mis prácticas
          </h2>
          <span className="mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {sortedPracticas.length} {sortedPracticas.length === 1 ? "práctica" : "prácticas"}
          </span>
        </div>
        {hasEditablePractices ? (
          <p
            id="practicas-edit-hint"
            className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400"
          >
            Mantené presionada una práctica para editarla.
          </p>
        ) : null}
      </div>

      {sortedPracticas.map((practica, index) => (
        <PracticaRow
          key={practica.id}
          practica={practica}
          moodleSnapshot={snapshotsByPractice.get(practica.id)}
          onRequestModificacion={onRequestModificacion}
          onViewAssignmentSummary={onViewAssignmentSummary}
          index={index}
        />
      ))}

      {/* Acción secundaria para agregar otra PPS realizada */}
      {onRequestNuevaPPS && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={onRequestNuevaPPS}
            className="min-h-11 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors"
          >
            <span className="material-icons !text-lg" aria-hidden="true">
              add
            </span>
            Cargar otra PPS
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticasTable;
