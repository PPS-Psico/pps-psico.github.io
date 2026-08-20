import React from "react";
import type {
  MoodleProvisioningStatus,
  MoodleTaskMode,
} from "../../../domain/moodle/moodleReportStatus";
import { formatDate } from "../../../utils/formatters";

interface LanzadorMoodleAutomationCardProps {
  orientationKey: string;
  cmid: number | null;
  courseId: number | null;
  stableKey: string;
  mode: MoodleTaskMode;
  status: MoodleProvisioningStatus;
  desiredOpenAt: string | null;
  desiredDueAt: string | null;
  totalExpected: number;
  totalSubmitted: number;
  totalMissing: number;
  totalUnderReview: number;
  totalRevisionRequired: number;
  totalPassed: number;
  totalFailed: number;
  totalWaived: number;
  totalSettled: number;
  lastVerifiedAt: string | null;
  onRetryReconcile?: () => Promise<void>;
  isReconciling?: boolean;
}

const STATUS_COPY: Record<
  MoodleProvisioningStatus,
  { label: string; tone: string; explanation: string }
> = {
  pending: {
    label: "En cola",
    tone: "lv4-badge-accent",
    explanation: "La unidad está declarada y espera que el agente configure Campus.",
  },
  claimed: {
    label: "Tomada por agente",
    tone: "lv4-badge-accent",
    explanation: "Un agente tiene un lease vigente para procesar esta unidad.",
  },
  reconciling: {
    label: "Verificando",
    tone: "lv4-badge-accent",
    explanation: "La configuración observada se está comparando con el contrato.",
  },
  verified: {
    label: "Verificada",
    tone: "lv4-badge-ok",
    explanation: "El vínculo y la configuración quedaron verificados.",
  },
  needs_attention: {
    label: "Requiere atención",
    tone: "lv4-badge-warn",
    explanation: "Se detectó una ambigüedad o una diferencia de configuración.",
  },
  error: {
    label: "Error",
    tone: "lv4-badge-warn",
    explanation: "El último intento falló y requiere una nueva ejecución.",
  },
  disabled: {
    label: "Deshabilitada",
    tone: "lv4-badge-neutral",
    explanation: "La automatización está deshabilitada para esta unidad.",
  },
  cancelled: {
    label: "Cancelada",
    tone: "lv4-badge-neutral",
    explanation: "La unidad ya no será procesada.",
  },
};

const orientationLabel = (orientation: string): string =>
  orientation ? `${orientation.charAt(0).toUpperCase()}${orientation.slice(1)}` : "Sin orientación";

export const LanzadorMoodleAutomationCard: React.FC<LanzadorMoodleAutomationCardProps> = ({
  orientationKey,
  cmid,
  courseId,
  stableKey,
  mode,
  status,
  desiredOpenAt,
  desiredDueAt,
  totalExpected,
  totalSubmitted,
  totalMissing,
  totalUnderReview,
  totalRevisionRequired,
  totalPassed,
  totalFailed,
  totalWaived,
  totalSettled,
  lastVerifiedAt,
  onRetryReconcile,
  isReconciling = false,
}) => {
  const statusCopy = STATUS_COPY[status];
  const canRetry = status === "error" || status === "needs_attention";

  return (
    <section
      className="lv4-moodle-card"
      aria-label={`Tarea Moodle ${orientationLabel(orientationKey)}`}
    >
      <header className="lv4-moodle-head">
        <div className="lv4-moodle-title">
          <span className="material-icons" aria-hidden="true">
            school
          </span>
          <div>
            <span className="lv4-eyebrow">Campus Virtual · {orientationLabel(orientationKey)}</span>
            <h3>Unidad de entrega del informe</h3>
          </div>
        </div>
        <div className="lv4-moodle-badges">
          <span className="lv4-badge lv4-badge-neutral">
            {mode === "dedicated" ? "Exclusiva por PPS" : "Legacy compartida"}
          </span>
          <span className={`lv4-badge ${statusCopy.tone}`}>{statusCopy.label}</span>
        </div>
      </header>

      <p className="lv4-moodle-explanation">{statusCopy.explanation}</p>

      <div className="lv4-moodle-facts">
        <div>
          <span>Clave canónica</span>
          <code>{stableKey}</code>
        </div>
        <div>
          <span>Actividad Campus</span>
          {cmid && courseId ? (
            <a
              href={`https://campus.uflo.edu.ar/mod/assign/view.php?id=${cmid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              CMID {cmid} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <strong>Sin vínculo verificado</strong>
          )}
        </div>
        <div>
          <span>Apertura y vencimiento</span>
          <strong>
            {desiredOpenAt ? formatDate(desiredOpenAt) : "Sin fecha"} ·{" "}
            {desiredDueAt ? formatDate(desiredDueAt) : "Sin fecha"}
          </strong>
        </div>
        <div>
          <span>Última verificación</span>
          <strong>{lastVerifiedAt ? formatDate(lastVerifiedAt) : "Todavía no verificada"}</strong>
        </div>
      </div>

      <div className="lv4-moodle-metrics" aria-label="Estado del padrón de informes">
        <div>
          <strong>{totalExpected}</strong>
          <span>Deben entregar</span>
        </div>
        <div>
          <strong>{totalSubmitted}</strong>
          <span>Entregados</span>
        </div>
        <div className={totalMissing > 0 ? "is-warning" : ""}>
          <strong>{totalMissing}</strong>
          <span>Faltantes</span>
        </div>
        <div>
          <strong>{totalUnderReview}</strong>
          <span>En corrección</span>
        </div>
        <div className={totalRevisionRequired > 0 ? "is-warning" : ""}>
          <strong>{totalRevisionRequired}</strong>
          <span>Reentrega</span>
        </div>
        <div className="is-success">
          <strong>{totalPassed}</strong>
          <span>Aprobados</span>
        </div>
        <div>
          <strong>{totalSettled}</strong>
          <span>Resueltos</span>
        </div>
      </div>

      {(totalFailed > 0 || totalWaived > 0) && (
        <p className="lv4-moodle-exceptions">
          Excepciones del padrón: {totalFailed} desaprobación institucional · {totalWaived} eximido
          {totalWaived === 1 ? "" : "s"}.
        </p>
      )}

      {canRetry && onRetryReconcile && (
        <footer className="lv4-moodle-actions">
          <button
            type="button"
            className="lv4-btn lv4-btn-subtle"
            onClick={() => void onRetryReconcile()}
            disabled={isReconciling}
          >
            <span className="material-icons" aria-hidden="true">
              refresh
            </span>
            {isReconciling ? "Encolando…" : "Volver a encolar"}
          </button>
        </footer>
      )}
    </section>
  );
};
