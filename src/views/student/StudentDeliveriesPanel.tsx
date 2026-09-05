import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../components/student/ds";
import {
  type MoodleGradeSnapshot,
  useMoodleGradeSync,
} from "../../contexts/MoodleGradeSyncContext";
import { MOODLE_ASSIGN, useAulaEntregas, type DeliveryArea } from "../../hooks/useAulaEntregas";
import {
  useMoodleTaskCloseState,
  type MoodleTaskCloseState,
} from "../../hooks/useMoodleTaskCloseState";
import { useMoodleTaskLinks } from "../../hooks/useMoodleTaskLinks";
import type { InformeTask, Practica } from "../../types";
import {
  formatMoodleObservationTime,
  presentMoodleGrade,
  type MoodleGradePresentation,
} from "../../utils/moodleGradePresentation";
import { buildGuidedDeliveries, type GuidedDelivery } from "./deliveryGuide";
import "./studentDeliveries.css";

interface StudentDeliveriesPanelProps {
  practicas?: Practica[];
  informeTasks?: InformeTask[];
  isPracticasLoading?: boolean;
  isPublic?: boolean;
}

type DeliveryTone = "neutral" | "info" | "ok" | "warn";
type DeadlineUrgency = "normal" | "soon" | "overdue" | "estimated" | "unknown";
type DeliveryBucket = "pending" | "delivered" | "upcoming" | "unknown";

const DAY_MS = 24 * 60 * 60 * 1000;

const areaIcons: Partial<Record<string, IconName>> = {
  clinica: "clinical",
  laboral: "community",
  comunitaria: "community",
  educacional: "education",
};

function cleanAreaName(areaName: string): string {
  return areaName.replace(/^Área\s+/i, "");
}

function formatUtcDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatPracticePeriod(delivery: GuidedDelivery): string {
  if (delivery.isOpenEnded) return "Actividad abierta";
  const start = formatUtcDate(delivery.startDate);
  const end = formatUtcDate(delivery.endDate);
  if (start && end) return `${start} → ${end}`;
  if (end) return `Finalizó ${end}`;
  if (start) return `Desde ${start}`;
  return "Fechas no informadas";
}

function formatDeadlineDate(date: Date): string {
  const label = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}, 23:59`;
}

function parseCalendarDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/**
 * Dos fechas que se ven iguales y no lo son.
 *
 * El plazo que arma `deliveryGuide` sale de la fecha de finalización estimada de
 * la práctica, y esa fecha no la hace cumplir nadie: aunque pase, el estudiante
 * puede seguir subiendo. Pintarla de rojo y decirle "venció" es mentirle, sobre
 * todo cuando su institución extendió la cursada.
 *
 * La Fecha límite cargada en Campus sí bloquea la entrega. El rojo queda
 * reservado para cuando el cierre está anclado a algo real: una primera entrega
 * observada en una tarea del modelo nuevo, o directamente el cutoff ya cargado.
 */
function getDeadlineMeta(
  deadline: Date | null,
  closeState?: MoodleTaskCloseState,
  isOpenEnded = false
): {
  days: number | null;
  elapsed: number;
  progress: number;
  urgency: DeadlineUrgency;
  headline: string;
  unit: string;
  detail: string;
  progressCopy: string;
  isEnforceable: boolean;
} {
  if (isOpenEnded) {
    return {
      days: null,
      elapsed: 0,
      progress: 0,
      urgency: "normal",
      headline: "Libre",
      unit: "sin vencimiento",
      detail: "Esta actividad no tiene fecha límite.",
      progressCopy: "Podés entregar cuando completes la actividad.",
      isEnforceable: false,
    };
  }

  const hardCutoff = parseCalendarDate(closeState?.closeCutoffAt);
  const effective = hardCutoff ?? deadline;
  const isEnforceable =
    Boolean(hardCutoff) || Boolean(closeState?.isEligible && closeState.firstSubmittedAt);

  if (!effective) {
    return {
      days: null,
      elapsed: 0,
      progress: 0,
      urgency: "unknown",
      headline: "—",
      unit: "sin fecha",
      detail: "La fecha de finalización todavía no está informada.",
      progressCopy: "El plazo se calcula cuando la práctica tiene fecha de cierre.",
      isEnforceable: false,
    };
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const deadlineUtc = Date.UTC(
    effective.getUTCFullYear(),
    effective.getUTCMonth(),
    effective.getUTCDate()
  );
  const days = Math.round((deadlineUtc - todayUtc) / DAY_MS);
  const elapsed = Math.min(30, Math.max(0, 30 - days));
  const progress = Math.min(100, Math.max(0, (elapsed / 30) * 100));
  const urgency: DeadlineUrgency =
    days < 0 ? (isEnforceable ? "overdue" : "estimated") : days <= 7 ? "soon" : "normal";

  const absDays = Math.abs(days);
  const dayWord = absDays === 1 ? "día" : "días";

  return {
    days,
    elapsed,
    progress,
    urgency,
    headline: String(absDays),
    unit: dayWord,
    detail: formatDeadlineDate(effective),
    progressCopy:
      days < 0
        ? isEnforceable
          ? `El espacio cerró hace ${absDays} ${dayWord}`
          : `La fecha estimada pasó hace ${absDays} ${dayWord}, pero el espacio sigue abierto`
        : days === 0
          ? isEnforceable
            ? "El espacio cierra hoy"
            : "Es la fecha estimada de cierre"
          : days > 30
            ? "El plazo comienza cuando finalice la práctica"
            : `Quedan ${days} de los 30 días de plazo`,
    isEnforceable,
  };
}

function formatStoredTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatLastRead(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatMoodleObservationTime(value);
  const now = new Date();
  if (parsed.toDateString() === now.toDateString()) {
    const time = new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
    return `hoy, ${time}`;
  }
  return formatMoodleObservationTime(value);
}

function isDelivered(delivery: GuidedDelivery, snapshot?: MoodleGradeSnapshot): boolean {
  if (
    snapshot &&
    (snapshot.submitted ||
      snapshot.task_status === "submitted" ||
      snapshot.task_status === "graded")
  ) {
    return true;
  }
  if (delivery.task?.informeSubido) return true;
  // Antes alcanzaba con que la práctica tuviera nota para darla por entregada.
  // Esa inferencia venía de cuando las notas se cargaban a mano; hoy la nota
  // sale de la corrección del docente en Moodle. Manteniéndola, una práctica
  // con nota vieja y sin ninguna lectura aparecía en "Ya entregadas" junto al
  // cartel "Sin entrega detectada", contradiciéndose en la misma fila.
  //
  // `delivery.task` sólo existe cuando hay una tarea de Moodle vinculada. Una
  // actividad calificada a mano y sin esa tarea (ver deliveryGuide.ts) llega
  // acá con `task` null; sin este chequeo quedaba "pendiente" para siempre.
  return delivery.gradedDirectly;
}

function getDeliveryBucket(
  delivery: GuidedDelivery,
  snapshot?: MoodleGradeSnapshot
): DeliveryBucket {
  if (isDelivered(delivery, snapshot)) return "delivered";
  if (delivery.statusLabel === "Todavía en cursada") return "upcoming";
  if (snapshot?.task_status === "not_submitted") return "pending";

  const note = delivery.task?.nota?.trim().toLocaleLowerCase("es") ?? "";
  if (note === "no entregado") return "pending";
  return "unknown";
}

function deliveryPresentation(
  delivery: GuidedDelivery,
  snapshot?: MoodleGradeSnapshot
): MoodleGradePresentation {
  return (
    presentMoodleGrade(snapshot) ?? {
      label: delivery.statusLabel,
      detail: delivery.statusDetail,
      compact: delivery.statusLabel,
      tone: delivery.statusTone,
      hasGrade: false,
    }
  );
}

function compactStatus(
  delivery: GuidedDelivery,
  snapshot?: MoodleGradeSnapshot
): { label: string; detail: string; tone: DeliveryTone } {
  const presentation = deliveryPresentation(delivery, snapshot);
  if (snapshot?.task_status === "graded" && presentation.hasGrade) {
    return { label: "Calificada", detail: presentation.detail, tone: presentation.tone };
  }
  if (snapshot && (snapshot.submitted || snapshot.task_status === "submitted")) {
    return { label: "En corrección", detail: presentation.detail, tone: "info" };
  }
  return {
    label: presentation.label,
    detail: presentation.detail,
    tone: presentation.tone,
  };
}

/**
 * Qué dice la fila sobre la entrega. Sale sólo de lo que Moodle vio: si no hay
 * lectura, se dice que no la hay en vez de afirmar una entrega que nadie
 * verificó.
 */
function deliveredSummary(snapshot?: MoodleGradeSnapshot): string {
  if (snapshot?.task_status === "graded") return "Calificada";
  if (snapshot && (snapshot.submitted || snapshot.task_status === "submitted")) {
    return "Entregado";
  }
  return "Sin registro en Campus";
}

function PendingDeliveryCard({
  delivery,
  snapshot,
  closeState,
  openedCampus,
  isRefreshing,
  canReopenGrades,
  onOpenCampus,
  onOpenDirectory,
  allowLegacyDirectory,
  onRefresh,
  onReopen,
}: {
  delivery: GuidedDelivery;
  snapshot?: MoodleGradeSnapshot;
  closeState?: MoodleTaskCloseState;
  openedCampus: boolean;
  isRefreshing: boolean;
  canReopenGrades: boolean;
  onOpenCampus: (practiceId: string) => void;
  onOpenDirectory: (areaId: string | null) => void;
  allowLegacyDirectory: boolean;
  onRefresh: () => Promise<void>;
  onReopen: (practicaId: string, cmid: number) => void;
}) {
  const directHref = delivery.institution
    ? `${MOODLE_ASSIGN}${delivery.institution.moodleId}`
    : null;
  const status = compactStatus(delivery, snapshot);
  const deadline = getDeadlineMeta(delivery.deadline, closeState, delivery.isOpenEnded);
  const observedAt = snapshot?.last_observed_at || snapshot?.observed_at || null;
  const observedLabel = formatMoodleObservationTime(observedAt);
  const areaName = cleanAreaName(delivery.areaName);

  return (
    <article
      className="sd-pending"
      data-urgency={deadline.urgency}
      style={{ ["--sd-area" as string]: delivery.areaColor }}
    >
      <div className="sd-pending__body">
        <div className="sd-pending__topline">
          <span className="sd-area">
            <span aria-hidden />
            {areaName}
          </span>
          <span className="sd-status" data-tone={status.tone} title={status.detail} role="status">
            <Icon name={status.tone === "warn" ? "alert" : "clock"} size={14} />
            {status.label}
          </span>
        </div>

        <h3>{delivery.practiceName}</h3>
        <p className="sd-pending__task">
          {delivery.isOpenEnded ? "Entrega de actividad especial" : "Informe final de PPS"}
          {delivery.academicYear ? ` · Tarea ${delivery.academicYear}` : ""} · {areaName}
        </p>

        <div className="sd-upload-list">
          <span>Qué tenés que subir</span>
          <ul>
            <li>
              {delivery.isOpenEnded
                ? "Informe de la actividad (PDF o DOCX)"
                : "Informe final supervisado (PDF o DOCX)"}
            </li>
            {!delivery.isOnline && !delivery.isOpenEnded && (
              <li>Planilla de horas firmada por la institución</li>
            )}
          </ul>
        </div>

        <dl className="sd-pending__facts">
          <div>
            <dt>Práctica</dt>
            <dd>{formatPracticePeriod(delivery)}</dd>
          </div>
          <div>
            <dt>Acredita</dt>
            <dd>
              {delivery.hours ?? "—"} <span>hs</span>
            </dd>
          </div>
          <div>
            <dt>Última lectura</dt>
            <dd>{observedLabel ?? "Sin lectura"}</dd>
          </div>
        </dl>
      </div>

      <aside className="sd-pending__aside">
        <span className="sd-label">
          {delivery.isOpenEnded
            ? "Modalidad de entrega"
            : deadline.isEnforceable
              ? "Cierre de la entrega"
              : "Cierre estimado"}
        </span>
        <div className="sd-deadline-number">
          <strong>{deadline.headline}</strong>
          <span>
            {deadline.days !== null && deadline.days < 0
              ? deadline.isEnforceable
                ? "de atraso"
                : "de margen"
              : deadline.unit}
          </span>
        </div>
        <p className="sd-deadline-date">
          {deadline.detail}
          {delivery.deadline && !deadline.isEnforceable && <sup aria-hidden>*</sup>}
        </p>
        {delivery.deadline && (
          <div
            className="sd-progress"
            role="progressbar"
            aria-label="Plazo académico transcurrido"
            aria-valuemin={0}
            aria-valuemax={30}
            aria-valuenow={deadline.elapsed}
          >
            <span style={{ width: `${deadline.progress}%` }} />
          </div>
        )}
        <p className="sd-progress-copy">{deadline.progressCopy}</p>
        {delivery.deadline && !deadline.isEnforceable && (
          <p className="sd-deadline-note">
            <span aria-hidden>*</span> Son 30 días desde la fecha de finalización, que es estimada y
            puede no coincidir con el día en que vos terminaste. Es orientativa: el espacio sigue
            aceptando entregas. Cuando se defina el cierre real vas a verlo acá.
          </p>
        )}
        {deadline.isEnforceable && closeState?.closeCutoffAt && (
          <p className="sd-deadline-note">
            Esta fecha ya está cargada en Campus: desde ese día el espacio no acepta más entregas.
            Si terminaste tu práctica más tarde, escribile a coordinación antes del cierre.
          </p>
        )}

        <div className="sd-pending__actions">
          {directHref ? (
            <a
              className="sd-primary-action"
              href={directHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby={`campus-open-hint-${delivery.id}`}
              onClick={() => onOpenCampus(delivery.id)}
            >
              Abrir espacio de entrega
              <Icon name="external" size={17} />
            </a>
          ) : allowLegacyDirectory ? (
            <button
              className="sd-primary-action"
              type="button"
              onClick={() => onOpenDirectory(delivery.areaId)}
            >
              Buscar espacio de entrega
              <Icon name="search" size={17} />
            </button>
          ) : (
            <span className="sd-primary-action" aria-disabled="true">
              Tarea pendiente de vinculación
              <Icon name="clock" size={17} />
            </span>
          )}
          <p id={`campus-open-hint-${delivery.id}`} className="sd-action-hint">
            {directHref
              ? "Abrimos la tarea exacta del Campus en otra pestaña."
              : allowLegacyDirectory
                ? "Todavía no hay una tarea exacta vinculada a esta práctica."
                : "Escribí a coordinación: desde 2027 sólo se muestran tareas asignadas."}
          </p>

          {openedCampus && directHref && (
            <div className="sd-return" role="status" aria-live="polite">
              <strong>¿Ya entregaste en Campus?</strong>
              <p>Volvé a consultar para que el panel detecte el archivo.</p>
              <button type="button" disabled={isRefreshing} onClick={() => void onRefresh()}>
                {isRefreshing ? "Consultando Campus…" : "Actualizar estado"}
              </button>
            </div>
          )}

          {snapshot?.scan_closed && canReopenGrades && (
            <button
              type="button"
              className="sd-reopen"
              onClick={() => onReopen(delivery.id, snapshot.cmid)}
            >
              Reabrir verificación de la nota
            </button>
          )}
        </div>
      </aside>
    </article>
  );
}

function DeliveredRow({
  delivery,
  snapshot,
  canReopenGrades,
  onReopen,
}: {
  delivery: GuidedDelivery;
  snapshot?: MoodleGradeSnapshot;
  canReopenGrades: boolean;
  onReopen: (practicaId: string, cmid: number) => void;
}) {
  const directHref = delivery.institution
    ? `${MOODLE_ASSIGN}${delivery.institution.moodleId}`
    : null;
  const status = compactStatus(delivery, snapshot);
  const presentation = deliveryPresentation(delivery, snapshot);
  // Sólo la fecha que Moodle registró. Antes caía a `fechaEntregaInforme`, que
  // es el plazo cargado al lanzar la convocatoria y no cuándo entregó el
  // alumno: se mostraba un vencimiento administrativo como si fuera la entrega.
  const submittedAt =
    formatStoredTime(snapshot?.submitted_at) ?? snapshot?.submitted_at_display ?? null;
  const correctedAt = snapshot?.graded_at_display;
  const deliveredLabel = deliveredSummary(snapshot);
  const deliveredDetail = correctedAt ? `Corregida ${correctedAt}` : submittedAt;
  const grade = presentation.hasGrade ? presentation.compact : null;
  const areaName = cleanAreaName(delivery.areaName);

  return (
    <div className="sd-ledger__row" style={{ ["--sd-area" as string]: delivery.areaColor }}>
      <div className="sd-ledger__identity">
        <span className="sd-area">
          <span aria-hidden />
          {areaName}
        </span>
        <strong>{delivery.practiceName}</strong>
        <small>
          Informe final de PPS{delivery.academicYear ? ` · Tarea ${delivery.academicYear}` : ""}
        </small>
      </div>
      <span className="sd-status" data-tone={status.tone} title={status.detail}>
        <i aria-hidden />
        {status.label}
      </span>
      <div className="sd-ledger__submitted">
        <strong>{deliveredLabel}</strong>
        {deliveredDetail ? <small>{deliveredDetail}</small> : null}
      </div>
      <div className="sd-ledger__grade" aria-label={grade ? `Nota ${grade}` : "Sin nota publicada"}>
        {grade ?? "—"}
      </div>
      <div className="sd-ledger__actions">
        {directHref && (
          <a
            href={directHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir la entrega de ${delivery.practiceName} en el Campus`}
            title="Abrir en Campus"
          >
            <Icon name="external" size={18} />
          </a>
        )}
        {snapshot?.scan_closed && canReopenGrades && (
          <button
            type="button"
            onClick={() => onReopen(delivery.id, snapshot.cmid)}
            title="Reabrir verificación de la nota"
          >
            Reabrir
          </button>
        )}
      </div>
    </div>
  );
}

const StudentDeliveriesPanel: React.FC<StudentDeliveriesPanelProps> = ({
  practicas = [],
  informeTasks = [],
  isPracticasLoading = false,
  isPublic = false,
}) => {
  const { areas } = useAulaEntregas();
  const {
    snapshotsByPractice,
    status,
    errorMessage,
    lastObservedAt,
    retry,
    canReopenGrades,
    reopenGrade,
  } = useMoodleGradeSync();
  const { links: exactTaskLinks, isLoading: areTaskLinksLoading } = useMoodleTaskLinks(!isPublic);
  const { closeStateByCmid } = useMoodleTaskCloseState(!isPublic);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(isPublic);
  const [openedCampusIds, setOpenedCampusIds] = useState<Set<string>>(() => new Set());
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const catalogRef = useRef<HTMLDetailsElement>(null);
  const allowLegacyDirectory = new Date().getFullYear() <= 2026;

  const guidedDeliveries = useMemo(
    () => buildGuidedDeliveries(practicas, informeTasks, areas, new Date(), exactTaskLinks),
    [areas, exactTaskLinks, informeTasks, practicas]
  );
  const selectedArea = useMemo(
    () => areas.find((area) => area.id === activeAreaId) ?? areas[0],
    [activeAreaId, areas]
  );
  const deliveriesByBucket = useMemo(() => {
    const buckets: Record<DeliveryBucket, GuidedDelivery[]> = {
      pending: [],
      delivered: [],
      upcoming: [],
      unknown: [],
    };
    guidedDeliveries.forEach((delivery) => {
      const bucket = getDeliveryBucket(delivery, snapshotsByPractice.get(delivery.id));
      buckets[bucket].push(delivery);
    });
    return buckets;
  }, [guidedDeliveries, snapshotsByPractice]);
  const pendingDeliveries = deliveriesByBucket.pending;
  const deliveredDeliveries = deliveriesByBucket.delivered;
  const upcomingDeliveries = deliveriesByBucket.upcoming;
  const unknownDeliveries = deliveriesByBucket.unknown;
  const lastObservedLabel = formatLastRead(lastObservedAt);
  const isRefreshing = isManualRefreshing || status === "loading" || status === "syncing";
  const isCampusDataLoading = isPracticasLoading || areTaskLinksLoading || isRefreshing;
  const isInitialCampusLoading =
    isPracticasLoading || areTaskLinksLoading || (isRefreshing && snapshotsByPractice.size === 0);

  const syncMessage =
    status === "loading" || status === "syncing"
      ? "Consultando tus tareas en Campus…"
      : status === "synced"
        ? `Campus leído ${lastObservedLabel ?? "ahora"}`
        : status === "complete"
          ? lastObservedLabel
            ? `Campus leído ${lastObservedLabel}`
            : "Campus al día · sin tareas pendientes"
          : status === "partial"
            ? errorMessage ||
              "Campus respondió parcialmente; conservamos el último estado confirmado."
            : status === "error"
              ? errorMessage || "No pudimos actualizar Campus."
              : lastObservedLabel
                ? `Última lectura ${lastObservedLabel}`
                : "Abrí Mi Panel desde Campus para sincronizar";

  const handleRefresh = useCallback(async () => {
    if (isManualRefreshing) return;
    setIsManualRefreshing(true);
    try {
      await retry();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [isManualRefreshing, retry]);

  const closeStateFor = useCallback(
    (delivery: GuidedDelivery): MoodleTaskCloseState | undefined =>
      delivery.institution ? closeStateByCmid.get(delivery.institution.moodleId) : undefined,
    [closeStateByCmid]
  );

  const handleOpenCampus = useCallback((practiceId: string) => {
    setOpenedCampusIds((current) => {
      const next = new Set(current);
      next.add(practiceId);
      return next;
    });
  }, []);

  const openDirectory = useCallback((areaId: string | null) => {
    if (areaId) setActiveAreaId(areaId);
    setCatalogOpen(true);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      catalogRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      if (areaId) document.getElementById(`delivery-directory-tab-${areaId}`)?.focus();
    });
  }, []);

  const handleReopenGrade = useCallback(
    async (practicaId: string, cmid: number) => {
      const reason = window.prompt(
        "Motivo de la reapertura (por ejemplo: el docente corrigió nuevamente la nota):"
      );
      if (!reason) return;
      try {
        await reopenGrade(practicaId, cmid, reason);
      } catch (error) {
        window.alert(
          error instanceof Error ? error.message : "No se pudo reabrir la verificación."
        );
      }
    },
    [reopenGrade]
  );

  const handleAreaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % areas.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + areas.length) % areas.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = areas.length - 1;
      else return;

      event.preventDefault();
      const nextArea = areas[nextIndex];
      setActiveAreaId(nextArea.id);
      document.getElementById(`delivery-directory-tab-${nextArea.id}`)?.focus();
    },
    [areas]
  );

  return (
    <div className="sd-deliveries">
      {!isPublic && (
        <>
          <section className="sd-section" aria-labelledby="pending-deliveries-title">
            <header className="sd-section__head">
              <h2 id="pending-deliveries-title">Te falta subir</h2>
              <div
                className="sd-sync"
                data-state={status}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="sd-sync__icon" aria-hidden>
                  <Icon
                    name={
                      status === "error" || status === "partial"
                        ? "alert"
                        : status === "loading" || status === "syncing"
                          ? "refresh"
                          : "check"
                    }
                    size={14}
                    className={isRefreshing ? "is-spinning" : undefined}
                  />
                </span>
                <span>
                  {isCampusDataLoading ? "Consultando tus tareas en Campus…" : syncMessage}
                </span>
                {isCampusDataLoading ? (
                  <span className="sd-sync__loader" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <button type="button" onClick={() => void handleRefresh()}>
                    <Icon name="refresh" size={15} />
                    {status === "error" || status === "partial" ? "Reintentar" : "Actualizar"}
                  </button>
                )}
              </div>
            </header>

            {isInitialCampusLoading ? (
              <div className="sd-pending-skeleton" aria-busy="true" aria-label="Cargando entregas">
                <span />
                <span />
              </div>
            ) : pendingDeliveries.length > 0 ? (
              <div className="sd-pending-list">
                {pendingDeliveries.map((delivery) => (
                  <PendingDeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    snapshot={snapshotsByPractice.get(delivery.id)}
                    closeState={closeStateFor(delivery)}
                    openedCampus={openedCampusIds.has(delivery.id)}
                    isRefreshing={isRefreshing}
                    canReopenGrades={canReopenGrades}
                    onOpenCampus={handleOpenCampus}
                    onOpenDirectory={openDirectory}
                    allowLegacyDirectory={allowLegacyDirectory}
                    onRefresh={handleRefresh}
                    onReopen={handleReopenGrade}
                  />
                ))}
              </div>
            ) : guidedDeliveries.length > 0 ? (
              <div className="sd-empty sd-empty--compact">
                <span aria-hidden>
                  <Icon name="check" size={20} />
                </span>
                <div>
                  <strong>No tenés informes pendientes.</strong>
                  <p>Las entregas detectadas en Campus quedan ordenadas debajo.</p>
                </div>
              </div>
            ) : (
              <div className="sd-empty">
                <span aria-hidden>
                  <Icon name="file" size={20} />
                </span>
                <div>
                  <strong>Todavía no tenés una PPS para mostrar acá.</strong>
                  <p>
                    Cuando una práctica figure en Mi Panel, su espacio de entrega aparecerá primero.
                  </p>
                </div>
                <Link to="/student/practicas">Ver Mis Prácticas</Link>
              </div>
            )}
          </section>

          {!isInitialCampusLoading && unknownDeliveries.length > 0 && (
            <section className="sd-section" aria-labelledby="unknown-deliveries-title">
              <header className="sd-section__head">
                <div>
                  <h2 id="unknown-deliveries-title">Por revisar en Campus</h2>
                  <p>
                    Mi Panel todavía no tiene una lectura suficiente para confirmar estas entregas.
                  </p>
                </div>
              </header>
              <div className="sd-pending-list">
                {unknownDeliveries.map((delivery) => (
                  <PendingDeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    snapshot={snapshotsByPractice.get(delivery.id)}
                    closeState={closeStateFor(delivery)}
                    openedCampus={openedCampusIds.has(delivery.id)}
                    isRefreshing={isRefreshing}
                    canReopenGrades={canReopenGrades}
                    onOpenCampus={handleOpenCampus}
                    onOpenDirectory={openDirectory}
                    allowLegacyDirectory={allowLegacyDirectory}
                    onRefresh={handleRefresh}
                    onReopen={handleReopenGrade}
                  />
                ))}
              </div>
            </section>
          )}

          {!isInitialCampusLoading && upcomingDeliveries.length > 0 && (
            <section className="sd-section" aria-labelledby="upcoming-deliveries-title">
              <header className="sd-section__head">
                <div>
                  <h2 id="upcoming-deliveries-title">Próximamente</h2>
                  <p>Estas prácticas siguen en curso; el informe se entrega al finalizar.</p>
                </div>
              </header>
              <div className="sd-pending-list">
                {upcomingDeliveries.map((delivery) => (
                  <PendingDeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    snapshot={snapshotsByPractice.get(delivery.id)}
                    closeState={closeStateFor(delivery)}
                    openedCampus={openedCampusIds.has(delivery.id)}
                    isRefreshing={isRefreshing}
                    canReopenGrades={canReopenGrades}
                    onOpenCampus={handleOpenCampus}
                    onOpenDirectory={openDirectory}
                    allowLegacyDirectory={allowLegacyDirectory}
                    onRefresh={handleRefresh}
                    onReopen={handleReopenGrade}
                  />
                ))}
              </div>
            </section>
          )}

          {deliveredDeliveries.length > 0 && (
            <section className="sd-section sd-section--delivered" aria-labelledby="delivered-title">
              <header className="sd-section__head sd-section__head--ledger">
                <h2 id="delivered-title">Ya entregadas</h2>
                <span className="sd-section__count">
                  {deliveredDeliveries.length}{" "}
                  {deliveredDeliveries.length === 1 ? "entregada" : "entregadas"}
                </span>
              </header>
              <div className="sd-ledger">
                <div className="sd-ledger__header" aria-hidden>
                  <span>Práctica</span>
                  <span>Estado en Campus</span>
                  <span>Entrega</span>
                  <span>Nota</span>
                  <span />
                </div>
                {deliveredDeliveries.map((delivery) => (
                  <DeliveredRow
                    key={delivery.id}
                    delivery={delivery}
                    snapshot={snapshotsByPractice.get(delivery.id)}
                    canReopenGrades={canReopenGrades}
                    onReopen={handleReopenGrade}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {allowLegacyDirectory && (
        <details
          ref={catalogRef}
          className="sd-directory"
          open={isPublic || catalogOpen}
          onToggle={(event) => setCatalogOpen(event.currentTarget.open)}
        >
          <summary>
            <span className="sd-directory__icon" aria-hidden>
              <Icon name="upload" size={19} />
            </span>
            <span className="sd-directory__copy">
              <strong>
                {isPublic ? "Espacios de entrega por área" : "¿No aparece tu práctica?"}
              </strong>
              <small>
                Vinculamos cada informe con la tarea exacta del año para no mandarte a otra cohorte.
                Si falta la tuya, buscala en el directorio por área.
              </small>
            </span>
            <span className="sd-directory__action">
              {catalogOpen ? "Cerrar directorio" : "Buscar otro espacio de entrega"}
              <Icon name={catalogOpen ? "chev" : "search"} size={17} />
            </span>
          </summary>

          <div className="sd-directory__body">
            <p>Elegí el área y después la institución donde realizaste la práctica.</p>
            <div className="sd-directory__tabs" role="tablist" aria-label="Áreas de entrega">
              {areas.map((area: DeliveryArea, index) => {
                const selected = area.id === selectedArea.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    role="tab"
                    id={`delivery-directory-tab-${area.id}`}
                    aria-selected={selected}
                    aria-controls="delivery-directory-panel"
                    tabIndex={selected ? 0 : -1}
                    className={selected ? "is-active" : undefined}
                    style={{ ["--sd-area" as string]: area.color }}
                    onClick={() => setActiveAreaId(area.id)}
                    onKeyDown={(event) => handleAreaKeyDown(event, index)}
                  >
                    <span aria-hidden>
                      <Icon name={areaIcons[area.id] ?? "upload"} size={18} />
                    </span>
                    <strong>{area.name}</strong>
                    <small>{area.institutions.length}</small>
                  </button>
                );
              })}
            </div>

            <div
              id="delivery-directory-panel"
              role="tabpanel"
              aria-labelledby={`delivery-directory-tab-${selectedArea.id}`}
              className="sd-directory__grid"
              key={selectedArea.id}
            >
              {selectedArea.institutions.map((institution) => (
                <a
                  key={institution.moodleId}
                  href={`${MOODLE_ASSIGN}${institution.moodleId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ["--sd-area" as string]: selectedArea.color }}
                  aria-label={`Abrir la entrega de ${institution.name} en el Campus`}
                >
                  <strong>{institution.name}</strong>
                  <span>
                    Abrir en Campus
                    <Icon name="external" size={16} />
                  </span>
                </a>
              ))}
            </div>
            <p className="sd-directory__note">
              El directorio es una alternativa manual. Si tenés dudas, confirmá el año y la
              institución antes de subir el informe.
            </p>
          </div>
        </details>
      )}
    </div>
  );
};

export default StudentDeliveriesPanel;
