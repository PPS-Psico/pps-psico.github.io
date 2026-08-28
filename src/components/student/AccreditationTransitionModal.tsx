import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type {
  AccreditationTransitionEvent,
  AccreditationTransitionOutcome,
} from "../../domain/finalizacion/accreditationTransition";
import { isAccreditationTransitionOutcome } from "../../domain/finalizacion/accreditationTransition";
import { useTheme } from "../../contexts/ThemeContext";
import { Icon } from "./ds";

interface AccreditationTransitionModalProps {
  event: AccreditationTransitionEvent;
  isBusy?: boolean;
  onPrimary: () => void;
  onLater: () => void;
}

const requirementLabels: Record<string, string> = {
  total_hours: "horas totales",
  specialty_hours: "horas de tu orientación",
  rotation: "rotación por áreas",
  active_practices: "PPS todavía en curso",
};

const copyFor = (
  outcome: AccreditationTransitionOutcome,
  uncertainCount: number,
  requirementGaps: string[]
) => {
  if (outcome === "auto_started") {
    return {
      eyebrow: "Último informe aprobado",
      title: "¡Felicitaciones! Tu acreditación ya está en marcha.",
      body: "Campus confirmó los informes y la documentación necesaria de tus PPS. Iniciamos el trámite automáticamente: no tenés que volver a subir esos archivos.",
      detail: "Coordinación continuará la carga y vas a ver cada cambio de estado en el panel.",
      primary: "Ver estado del trámite",
      icon: "check" as const,
    };
  }

  if (outcome === "manual_required") {
    const label = `${uncertainCount} ${uncertainCount === 1 ? "PPS presencial" : "PPS presenciales"}`;
    return {
      eyebrow: "Último informe aprobado",
      title: "¡Felicitaciones! Sólo falta confirmar una parte.",
      body: `Tus informes ya están verificados. En ${label} no pudimos asegurar que la planilla de asistencia esté incluida en la entrega.`,
      detail:
        "Abriremos un formulario reducido que pide únicamente esas planillas. No vas a repetir informes ni documentación que ya está en Campus.",
      primary: `Completar ${uncertainCount === 1 ? "la planilla" : "las planillas"}`,
      icon: "file" as const,
    };
  }

  const gaps = requirementGaps.map((gap) => requirementLabels[gap] ?? gap).join(", ");
  return {
    eyebrow: "Último informe aprobado",
    title: "¡Felicitaciones! Tu último informe fue aprobado.",
    body: "La corrección académica ya está completa, pero el trámite todavía no puede iniciarse.",
    detail: gaps
      ? `Antes falta completar o corregir: ${gaps}. El panel te muestra el detalle actualizado.`
      : "Revisá los requisitos registrados en el panel antes de iniciar la acreditación.",
    primary: "Ver requisitos",
    icon: "alert" as const,
  };
};

const AccreditationTransitionModal: React.FC<AccreditationTransitionModalProps> = ({
  event,
  isBusy = false,
  onPrimary,
  onLater,
}) => {
  const { resolvedTheme } = useTheme();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const outcome: AccreditationTransitionOutcome = isAccreditationTransitionOutcome(event.outcome)
    ? event.outcome
    : "requirements_pending";
  const content = useMemo(
    () => copyFor(outcome, event.uncertain_practice_ids.length, event.requirement_gaps),
    [event.requirement_gaps, event.uncertain_practice_ids.length, outcome]
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => primaryRef.current?.focus(), 80);
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape" && !isBusy) onLater();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isBusy, onLater]);

  return createPortal(
    <div
      className="ed fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/55 p-4"
      data-mode={resolvedTheme}
      data-accent="teal"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget && !isBusy) onLater();
      }}
    >
      <section
        className="w-full max-w-xl overflow-hidden rounded-2xl border animate-scale-in"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--line-strong)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accreditation-transition-title"
        aria-describedby="accreditation-transition-description"
      >
        <div className="grid grid-cols-[4px_1fr]">
          <div style={{ background: "var(--accent)" }} aria-hidden="true" />
          <div className="px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex items-start gap-4">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--tint)", color: "var(--accent-text)" }}
                aria-hidden="true"
              >
                <Icon name={content.icon} size={21} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[11px] font-bold" style={{ color: "var(--ink-muted)" }}>
                  {content.eyebrow}
                </p>
                <h2
                  id="accreditation-transition-title"
                  className="mt-2 text-[22px] font-extrabold leading-[1.08] tracking-[-0.035em]"
                  style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
                >
                  {content.title}
                </h2>
              </div>
            </div>

            <div id="accreditation-transition-description" className="mt-6 space-y-3">
              <p className="m-0 text-sm leading-6" style={{ color: "var(--ink-soft)" }}>
                {content.body}
              </p>
              <p
                className="m-0 border-t pt-3 text-xs leading-5"
                style={{ color: "var(--ink-muted)", borderColor: "var(--line)" }}
              >
                {content.detail}
              </p>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onLater}
                disabled={isBusy}
                className="h-10 rounded-lg px-4 text-xs font-bold transition hover:bg-[var(--bg-sunken)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                style={{ color: "var(--ink-muted)", outlineColor: "var(--accent)" }}
              >
                Ahora no
              </button>
              <button
                ref={primaryRef}
                type="button"
                onClick={onPrimary}
                disabled={isBusy}
                className="flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-xs font-extrabold text-white transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                style={{ background: "var(--accent)", outlineColor: "var(--accent)" }}
              >
                {isBusy ? "Guardando…" : content.primary}
                {!isBusy && <Icon name="arrow" size={15} color="currentColor" />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
};

export default AccreditationTransitionModal;
