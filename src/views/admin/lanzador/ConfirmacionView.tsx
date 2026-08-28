/**
 * Step 4: sala operativa de consentimientos previa al inicio de la PPS.
 * Separa con claridad firmas, estudiantes en plazo y bajas efectivas.
 */
import { useQuery } from "@tanstack/react-query";
import React, { Suspense, useMemo, useState } from "react";
import {
  FIELD_CONSENTIMIENTO_REQUERIDO_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_LISTA_ESTUDIANTES_ENTREGADA_AT_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
} from "../../../constants";
import { launchKeys } from "../../../lib/launchQueryKeys";
import { supabase } from "../../../lib/supabaseClient";
import { classifyDbError } from "../../../lib/dbError";
import type { LanzamientoPPS } from "../../../types";
import {
  formatConsentimientoDeadline,
  formatConsentimientoDeadlineShort,
  getConsentimientoDeadline,
} from "../../../utils/consentimientoUtils";
import { getWhatsAppUrl, normalizeStringForComparison } from "../../../utils/formatters";
import {
  Banner,
  CanvasHeader,
  Loader,
  SeleccionadorConvocatorias,
  Stat,
  StatGrid,
  useLaunchEditor,
} from "./shared";
import { useLaunchRoster } from "./useLaunchData";

interface ConfirmacionViewProps {
  launch: LanzamientoPPS;
  onActivar: () => void;
  onListaEntregada: (pendientes: number) => void;
  onFinalReminder: (pendientes: number) => void;
  isClosingList?: boolean;
  isSendingFinalReminder?: boolean;
  finalReminderFeedback?: {
    tone: "ok" | "warn";
    title: string;
    message: string;
  } | null;
}

interface ConsentRow {
  id: string;
  nombre: string | null;
  telefono: string | null;
  correo: string | null;
  horario: string | null;
  acceptedAt: string | null;
  bajaAt: string | null;
  selectedAt: string | null;
  finalReminderSentAt: string | null;
  baseDeadline: Date | null;
  deadline: Date | null;
  status: "firmo" | "pendiente" | "baja";
}

const initials = (name: string | null) =>
  name
    ? name
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

const formatCompactDate = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
};

const groupSchedules = (rows: ConsentRow[]) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const schedule = row.horario?.trim() || "Sin horario asignado";
    counts.set(schedule, (counts.get(schedule) || 0) + 1);
  });
  return Array.from(counts, ([horario, count]) => ({ horario, count })).sort(
    (a, b) => b.count - a.count
  );
};

const ConfirmacionView: React.FC<ConfirmacionViewProps> = ({
  launch,
  onActivar,
  onListaEntregada,
  onFinalReminder,
  isClosingList = false,
  isSendingFinalReminder = false,
  finalReminderFeedback = null,
}) => {
  const { openEdit, modal: editModal } = useLaunchEditor(launch);
  const [gestionOpen, setGestionOpen] = useState(false);
  const [firmadosOpen, setFirmadosOpen] = useState(false);
  const launchName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;
  const fechaInicio = launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const listaEntregadaAt = launch[FIELD_LISTA_ESTUDIANTES_ENTREGADA_AT_LANZAMIENTOS] as
    string | null;
  const consentimientoRequerido = launch[FIELD_CONSENTIMIENTO_REQUERIDO_LANZAMIENTOS] !== false;

  const rosterQuery = useLaunchRoster(launch.id);
  const { data: roster = [] } = rosterQuery;
  const selectedRoster = useMemo(
    () =>
      roster.filter(
        (row) =>
          normalizeStringForComparison(row.estado_inscripcion) === "seleccionado" ||
          row.baja_automatica_at != null
      ),
    [roster]
  );

  const compromisosQuery = useQuery({
    queryKey: launchKeys.compromisos(launch.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compromisos_pps")
        .select("estado, convocatoria_id, accepted_at")
        .eq("lanzamiento_id", launch.id);
      if (error)
        throw classifyDbError(error, {
          table: "compromisos_pps",
          operation: "compromisosDelLanzamiento",
        });
      return data || [];
    },
  });
  const compromisos = useMemo(() => compromisosQuery.data || [], [compromisosQuery.data]);

  const studentIds = useMemo(
    () => selectedRoster.map((row) => row.estudiante_id).filter((id): id is string => !!id),
    [selectedRoster]
  );
  const studentInfoQuery = useQuery<
    Record<string, { nombre: string | null; telefono: string | null; correo: string | null }>
  >({
    queryKey: ["seleccionadosInfo", studentIds.join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      if (studentIds.length === 0) return {};
      const { data, error } = await supabase
        .from("estudiantes")
        .select("id, nombre, telefono, correo")
        .in("id", studentIds);
      if (error)
        throw classifyDbError(error, {
          table: "estudiantes",
          operation: "contactosDeSeleccionados",
        });
      return Object.fromEntries(
        (data || []).map((student) => [
          student.id,
          { nombre: student.nombre, telefono: student.telefono, correo: student.correo },
        ])
      );
    },
  });
  const studentInfo = useMemo(() => studentInfoQuery.data || {}, [studentInfoQuery.data]);

  const compromisoByConvocatoria = useMemo(
    () =>
      Object.fromEntries(
        compromisos.map((item) => [
          item.convocatoria_id,
          { estado: item.estado, acceptedAt: item.accepted_at },
        ])
      ),
    [compromisos]
  );

  const rows = useMemo<ConsentRow[]>(
    () =>
      selectedRoster
        .map((convocatoria) => {
          const commitment = compromisoByConvocatoria[convocatoria.id];
          const accepted = normalizeStringForComparison(commitment?.estado || "") === "aceptado";
          const current =
            normalizeStringForComparison(convocatoria.estado_inscripcion) === "seleccionado";
          const info = convocatoria.estudiante_id
            ? studentInfo[convocatoria.estudiante_id]
            : undefined;
          const horario =
            convocatoria.horario_asignado?.trim() ||
            convocatoria.horario_seleccionado?.trim() ||
            null;

          return {
            id: convocatoria.id,
            nombre: info?.nombre ?? null,
            telefono: info?.telefono ?? null,
            correo: info?.correo ?? null,
            horario,
            acceptedAt: commitment?.acceptedAt ?? null,
            bajaAt: convocatoria.baja_automatica_at,
            selectedAt: convocatoria.selected_at,
            finalReminderSentAt: convocatoria.final_reminder_sent_at,
            baseDeadline: getConsentimientoDeadline(
              fechaInicio,
              convocatoria.selected_at,
              listaEntregadaAt
            ),
            deadline: getConsentimientoDeadline(
              fechaInicio,
              convocatoria.selected_at,
              listaEntregadaAt,
              convocatoria.final_reminder_sent_at
            ),
            status: accepted ? "firmo" : current ? "pendiente" : "baja",
          } satisfies ConsentRow;
        })
        .sort((a, b) => {
          const rank = { pendiente: 0, baja: 1, firmo: 2 } as const;
          return rank[a.status] - rank[b.status] || (a.nombre || "").localeCompare(b.nombre || "");
        }),
    [selectedRoster, compromisoByConvocatoria, studentInfo, fechaInicio, listaEntregadaAt]
  );

  const pendingRows = rows.filter((row) => row.status === "pendiente");
  const bajaRows = rows.filter((row) => row.status === "baja");
  const signedRows = rows.filter((row) => row.status === "firmo");
  const selectedCurrent = pendingRows.length + signedRows.length;
  const progress =
    selectedCurrent > 0 ? Math.round((signedRows.length / selectedCurrent) * 100) : 0;
  const schedulesToCover = groupSchedules(bajaRows);
  const pendingWithoutFinalReminder = pendingRows.filter((row) => !row.finalReminderSentAt);
  const finalReminderDeadline = pendingRows
    .filter((row) => !!row.finalReminderSentAt && !!row.deadline)
    .map((row) => row.deadline as Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const hasActiveFinalWindow =
    !!finalReminderDeadline && finalReminderDeadline.getTime() > Date.now();
  const canSendFinalReminder =
    !listaEntregadaAt &&
    pendingWithoutFinalReminder.length > 0 &&
    pendingWithoutFinalReminder.every(
      (row) => !!row.baseDeadline && row.baseDeadline.getTime() >= Date.now() + 24 * 60 * 60 * 1000
    );
  const nextDeadline = pendingRows
    .map((row) => row.deadline)
    .filter((date): date is Date => !!date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const deliveredLabel = listaEntregadaAt
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(listaEntregadaAt))
    : null;

  const isLoading =
    rosterQuery.isLoading ||
    compromisosQuery.isLoading ||
    (studentIds.length > 0 && studentInfoQuery.isLoading);
  const hasError = rosterQuery.isError || compromisosQuery.isError || studentInfoQuery.isError;

  const reminderMessage = (row: ConsentRow) =>
    `Hola ${row.nombre || ""}! Te recordamos que tenés pendiente aceptar el compromiso digital ` +
    `para la PPS${launchName ? ` en ${launchName}` : ""}. ` +
    (row.finalReminderSentAt ? "Este es el último recordatorio. " : "") +
    (row.deadline
      ? `El plazo actual cierra el *${formatConsentimientoDeadline(row.deadline)}*. `
      : "") +
    `Ingresá a tu panel y confirmá: pps.psico.uflo.edu.ar`;

  const bajaMessage = (row: ConsentRow) =>
    `Hola ${row.nombre || ""}! Te escribo de la Coordinación de PPS por la práctica${
      launchName ? ` en ${launchName}` : ""
    }. El sistema registró la baja porque no se confirmó el compromiso antes del cierre. ` +
    `Si necesitás que revisemos el caso, respondeme por acá.`;

  const renderRow = (row: ConsentRow) => {
    const meta =
      row.status === "firmo"
        ? {
            tone: "is-signed",
            icon: "verified",
            label: `Firmó${row.acceptedAt ? ` · ${formatCompactDate(row.acceptedAt)}` : ""}`,
          }
        : row.status === "baja"
          ? {
              tone: "is-dropped",
              icon: "person_off",
              label: `Baja${row.bajaAt ? ` · ${formatCompactDate(row.bajaAt)}` : ""}`,
            }
          : { tone: "is-pending", icon: "hourglass_empty", label: "En plazo" };
    const waUrl = getWhatsAppUrl(
      row.telefono,
      row.status === "baja" ? bajaMessage(row) : reminderMessage(row)
    );

    return (
      <div key={row.id} className="lv4-insc-row lv4-consent-row" role="listitem">
        <div className={`lv4-avatar lv4-consent-avatar ${meta.tone}`} aria-hidden="true">
          {initials(row.nombre)}
        </div>
        <div className="lv4-consent-person">
          <div className="lv4-consent-name">{row.nombre || "Sin nombre"}</div>
          <div className="lv4-consent-meta">
            {row.horario && (
              <span>
                <span className="material-icons" aria-hidden="true">
                  schedule
                </span>
                {row.horario}
              </span>
            )}
            {row.correo && (
              <span>
                <span className="material-icons" aria-hidden="true">
                  mail
                </span>
                {row.correo}
              </span>
            )}
          </div>
          {row.status === "pendiente" && row.deadline && (
            <div className="lv4-consent-deadline">
              {row.finalReminderSentAt
                ? "Último aviso enviado · vence "
                : "Firma habilitada hasta "}
              {formatConsentimientoDeadlineShort(row.deadline)}
            </div>
          )}
          {row.status === "baja" && (
            <div className="lv4-consent-drop-help">
              La vacante quedó liberada. Volvé a seleccionarlo solamente si corresponde reabrir el
              caso.
            </div>
          )}
        </div>
        <span className={`lv4-consent-status ${meta.tone}`}>
          <span className="material-icons" aria-hidden="true">
            {meta.icon}
          </span>
          {meta.label}
        </span>
        <div className="lv4-consent-contact">
          {waUrl ? (
            <a
              className="lv4-icon-btn lv4-consent-whatsapp"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escribir por WhatsApp a ${row.nombre || "estudiante"}`}
            >
              <span className="material-icons" aria-hidden="true">
                chat
              </span>
            </a>
          ) : (
            <span className="lv4-icon-btn is-disabled" aria-label="Sin teléfono cargado">
              <span className="material-icons" aria-hidden="true">
                chat
              </span>
            </span>
          )}
          {row.correo ? (
            <a
              className="lv4-icon-btn"
              href={`mailto:${row.correo}`}
              aria-label={`Enviar email a ${row.nombre || row.correo}`}
            >
              <span className="material-icons" aria-hidden="true">
                mail
              </span>
            </a>
          ) : (
            <span className="lv4-icon-btn is-disabled" aria-label="Sin correo cargado">
              <span className="material-icons" aria-hidden="true">
                mail
              </span>
            </span>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div>
        <CanvasHeader
          launch={launch}
          uiState="confirmacion"
          secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
        />
        {editModal}
        <div className="lv4-canvas-body">
          <Loader />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div>
        <CanvasHeader
          launch={launch}
          uiState="confirmacion"
          secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
        />
        {editModal}
        <div className="lv4-canvas-body">
          <Banner
            tone="warn"
            icon="cloud_off"
            title="No se pudo verificar la sala de consentimientos"
            action={
              <button
                className="lv4-btn"
                onClick={() =>
                  void Promise.all([
                    rosterQuery.refetch(),
                    compromisosQuery.refetch(),
                    studentInfoQuery.refetch(),
                  ])
                }
              >
                Reintentar
              </button>
            }
          >
            Las acciones de cierre y activación quedan bloqueadas hasta reconciliar los datos.
          </Banner>
        </div>
      </div>
    );
  }

  if (!consentimientoRequerido) {
    const seleccionadosVigentes = selectedRoster.filter(
      (row) => normalizeStringForComparison(row.estado_inscripcion) === "seleccionado"
    ).length;

    return (
      <div>
        <CanvasHeader
          launch={launch}
          uiState="confirmacion"
          secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
        />
        {editModal}
        <div className="lv4-canvas-body">
          <StatGrid>
            <Stat
              label="Seleccionados vigentes"
              value={seleccionadosVigentes}
              hint="sin firma requerida"
              tone="ok"
            />
            <Stat label="Consentimientos" value={0} hint="omitidos por cierre tardío" />
          </StatGrid>
          <Banner tone="neutral" icon="event_busy" title="Consentimiento no requerido">
            La mesa cerró el mismo día en que comienza la PPS o después. No se envían correos de
            consentimiento, recordatorios ni bajas automáticas; los lugares seleccionados quedan
            vigentes.
          </Banner>
          <section className="lv4-consent-decision is-closed">
            <div className="lv4-consent-decision-copy">
              <span className="material-icons" aria-hidden="true">
                verified
              </span>
              <div>
                <span className="lv4-eyebrow">Decisión automática de cierre</span>
                <strong>La nómina puede continuar sin firmas digitales</strong>
                <p>
                  Podés activar la PPS directamente cuando estén resueltos los pasos operativos.
                </p>
              </div>
            </div>
            <div className="lv4-consent-decision-actions">
              <button
                className="lv4-btn lv4-btn-primary"
                onClick={onActivar}
                disabled={seleccionadosVigentes === 0}
              >
                <span className="material-icons" aria-hidden="true">
                  play_circle
                </span>
                Activar PPS
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="confirmacion"
        secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
      />
      {editModal}
      <div className="lv4-canvas-body">
        <StatGrid>
          <Stat label="Seleccionados vigentes" value={selectedCurrent} hint="con lugar asignado" />
          <Stat label="Firmaron" value={signedRows.length} hint="compromiso aceptado" tone="ok" />
          <Stat
            label="En plazo"
            value={pendingRows.length}
            hint="pueden confirmar"
            tone={pendingRows.length > 0 ? "warn" : "ok"}
          />
          {bajaRows.length > 0 && (
            <Stat label="Bajas" value={bajaRows.length} hint="vacantes liberadas" tone="warn" />
          )}
        </StatGrid>

        {selectedCurrent > 0 && (
          <div className="lv4-consent-progress">
            <div className="lv4-consent-progress-head">
              <span className="lv4-eyebrow">Avance sobre seleccionados vigentes</span>
              <strong>
                {signedRows.length}/{selectedCurrent} · {progress}%
              </strong>
            </div>
            <div
              className="lv4-progress-track"
              role="progressbar"
              aria-label="Avance de consentimientos"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className={`lv4-progress-fill${progress === 100 ? " is-complete" : ""}`}
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </div>
          </div>
        )}

        <section className={`lv4-consent-decision${listaEntregadaAt ? " is-closed" : ""}`}>
          <div className="lv4-consent-decision-copy">
            <span className="material-icons" aria-hidden="true">
              {listaEntregadaAt ? "lock" : "fact_check"}
            </span>
            <div>
              <span className="lv4-eyebrow">
                {listaEntregadaAt ? "Nómina institucional cerrada" : "Decisión de Coordinación"}
              </span>
              <strong>
                {listaEntregadaAt
                  ? `Lista entregada el ${deliveredLabel}`
                  : hasActiveFinalWindow && finalReminderDeadline
                    ? `Último aviso vigente hasta ${formatConsentimientoDeadline(finalReminderDeadline)}`
                    : nextDeadline
                      ? `La firma sigue abierta hasta ${formatConsentimientoDeadline(nextDeadline)}`
                      : "Registrá la entrega cuando envíes la lista a la institución"}
              </strong>
              <p>
                {listaEntregadaAt
                  ? "No se admiten nuevas firmas. Las bajas y sus vacantes quedan separadas del grupo vigente."
                  : hasActiveFinalWindow
                    ? "El correo prometió 24 horas completas. La nómina no puede cerrarse antes de ese vencimiento; después, las faltas de firma se procesan como bajas automáticas."
                    : "El plazo cierra 24 horas antes del inicio o cuando registres la entrega de la lista, lo que ocurra primero. Activar la PPS no cierra por sí solo las firmas."}
              </p>
            </div>
          </div>
          <div className="lv4-consent-decision-actions">
            {!listaEntregadaAt && selectedCurrent > 0 && (
              <button
                className="lv4-btn"
                onClick={() => onListaEntregada(pendingRows.length)}
                disabled={isClosingList || hasActiveFinalWindow}
                title={
                  hasActiveFinalWindow && finalReminderDeadline
                    ? `Disponible después de ${formatConsentimientoDeadline(finalReminderDeadline)}`
                    : undefined
                }
              >
                <span className="material-icons" aria-hidden="true">
                  outgoing_mail
                </span>
                {isClosingList
                  ? "Registrando…"
                  : pendingRows.length > 0
                    ? `Cerrar lista (${pendingRows.length} sin firma)`
                    : "Registrar lista entregada"}
              </button>
            )}
            <button
              className="lv4-btn lv4-btn-primary"
              onClick={onActivar}
              disabled={selectedCurrent === 0}
            >
              <span className="material-icons" aria-hidden="true">
                play_circle
              </span>
              Activar PPS
            </button>
          </div>
        </section>

        {rows.length === 0 && (
          <Banner
            tone="neutral"
            icon="group_add"
            title="Todavía no hay estudiantes seleccionados"
            action={
              <button className="lv4-btn lv4-btn-primary" onClick={() => setGestionOpen(true)}>
                Seleccionar estudiantes
              </button>
            }
          >
            Elegí estudiantes de la lista de inscriptos para iniciar los consentimientos.
          </Banner>
        )}

        {finalReminderFeedback && (
          <Banner
            tone={finalReminderFeedback.tone}
            icon={finalReminderFeedback.tone === "ok" ? "mark_email_read" : "warning"}
            title={finalReminderFeedback.title}
          >
            {finalReminderFeedback.message}
          </Banner>
        )}

        {pendingRows.length > 0 && (
          <section className="lv4-consent-section">
            <div className="lv4-consent-section-head">
              <div>
                <span className="lv4-eyebrow is-warning">Seguimiento</span>
                <h2>En plazo ({pendingRows.length})</h2>
                <p>
                  {pendingWithoutFinalReminder.length > 0
                    ? "El último recordatorio se envía desde Mi Panel a quienes siguen pendientes y abre su plazo final de 24 horas antes de la baja automática."
                    : "El último recordatorio ya fue enviado. Cada estudiante conserva su lugar hasta el vencimiento indicado."}
                </p>
              </div>
              <div className="lv4-consent-section-actions">
                <button
                  className="lv4-btn lv4-btn-final-reminder"
                  type="button"
                  onClick={() => onFinalReminder(pendingWithoutFinalReminder.length)}
                  disabled={!canSendFinalReminder || isSendingFinalReminder}
                  title={
                    !canSendFinalReminder && pendingWithoutFinalReminder.length > 0
                      ? "No quedan 24 horas completas antes del cierre vigente."
                      : undefined
                  }
                >
                  <span className="material-icons" aria-hidden="true">
                    {pendingWithoutFinalReminder.length === 0
                      ? "mark_email_read"
                      : "forward_to_inbox"}
                  </span>
                  {isSendingFinalReminder
                    ? "Enviando…"
                    : pendingWithoutFinalReminder.length === 0
                      ? "Último recordatorio enviado"
                      : `Último recordatorio por email (${pendingWithoutFinalReminder.length})`}
                </button>
                <button
                  className="lv4-btn"
                  onClick={() => setGestionOpen((open) => !open)}
                  aria-expanded={gestionOpen}
                  aria-controls="lv4-consent-management"
                >
                  <span className="material-icons" aria-hidden="true">
                    manage_accounts
                  </span>
                  Gestionar selección
                </button>
              </div>
            </div>
            <div className="lv4-consent-list is-pending" role="list">
              {pendingRows.map(renderRow)}
            </div>
          </section>
        )}

        {bajaRows.length > 0 && (
          <section className="lv4-consent-section">
            <div className="lv4-consent-section-head">
              <div>
                <span className="lv4-eyebrow is-danger">Acción requerida</span>
                <h2>Bajas ({bajaRows.length})</h2>
                <p>
                  Ya no integran la nómina vigente. Estas son las vacantes que sí requieren
                  reemplazo.
                </p>
              </div>
            </div>
            {schedulesToCover.length > 0 && (
              <div className="lv4-consent-schedules">
                <span className="lv4-eyebrow">Horarios a cubrir</span>
                <div>
                  {schedulesToCover.map((item) => (
                    <span key={item.horario} className="lv4-consent-schedule">
                      {item.horario} <b>{item.count}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="lv4-consent-list is-dropped" role="list">
              {bajaRows.map(renderRow)}
            </div>
          </section>
        )}

        {signedRows.length > 0 && (
          <section className="lv4-consent-section">
            <button
              className="lv4-group-head"
              onClick={() => setFirmadosOpen((open) => !open)}
              aria-expanded={firmadosOpen}
              aria-controls="lv4-signed-consents"
            >
              <span className="lv4-group-label">
                <span
                  className={`material-icons lv4-disclosure${firmadosOpen ? " is-open" : ""}`}
                  aria-hidden="true"
                >
                  expand_more
                </span>
                <span className="material-icons lv4-consent-ok" aria-hidden="true">
                  verified
                </span>
                Firmaron ({signedRows.length})
              </span>
              <span className="lv4-group-count">{firmadosOpen ? "ocultar" : "ver"}</span>
            </button>
            {firmadosOpen && (
              <div id="lv4-signed-consents" className="lv4-consent-list" role="list">
                {signedRows.map(renderRow)}
              </div>
            )}
          </section>
        )}

        <section className="lv4-consent-section">
          <button
            className="lv4-group-head"
            onClick={() => setGestionOpen((open) => !open)}
            aria-expanded={gestionOpen}
            aria-controls="lv4-consent-management"
          >
            <span className="lv4-group-label">
              <span
                className={`material-icons lv4-disclosure${gestionOpen ? " is-open" : ""}`}
                aria-hidden="true"
              >
                expand_more
              </span>
              Agregar o cambiar seleccionados
            </span>
            <span className="lv4-group-count">desde inscriptos</span>
          </button>
          {gestionOpen && (
            <div id="lv4-consent-management" className="lv4-consent-management">
              <p>
                Marcá o desmarcá estudiantes. La lista superior y los conteos se reconcilian
                automáticamente.
              </p>
              <Suspense fallback={<Loader />}>
                <SeleccionadorConvocatorias
                  isTestingMode={false}
                  preSelectedLaunchId={launch.id}
                  hideConfirmed
                />
              </Suspense>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ConfirmacionView;
