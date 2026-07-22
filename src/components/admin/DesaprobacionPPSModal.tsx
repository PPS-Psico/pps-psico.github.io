import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FIELD_CORREO_ESTUDIANTES, TABLE_ESTUDIANTES } from "../../constants/dbConstants";
import { supabase } from "../../lib/supabaseClient";
import { invalidateLaunchData } from "../../lib/launchQueryKeys";
import { DISAPPROVAL_CC, sendSmartEmail } from "../../utils/emailService";
import { cleanDbValue, formatDate } from "../../utils/formatters";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../views/admin/lanzador/lanzadorStyles";

interface StudentRef {
  id: string;
  nombre: string;
  legajo: string;
}

interface DesaprobacionPPSModalProps {
  isOpen: boolean;
  student: StudentRef;
  launchId?: string | null;
  onClose: () => void;
  onSuccess: (result: DisapprovalResult) => void;
}

export interface DisapprovalResult {
  emailSent: boolean;
  emailMessage?: string;
  emailKind: "automatico_inasistencia" | "informe_institucional";
}

const ATTENDANCE_REASON =
  "No se alcanzó el mínimo del 80% de asistencia requerido para la aprobación de la práctica.";

const PARTICIPATION_REPORT =
  "La institución informó dificultades sostenidas en la participación, el compromiso con las actividades propuestas y el cumplimiento del encuadre profesional esperado. De acuerdo con el informe recibido, estos aspectos no alcanzaron los criterios requeridos para la aprobación de la práctica.";

const getLaunchName = (launch: unknown): string => {
  const normalized = Array.isArray(launch) ? launch[0] : launch;
  if (!normalized || typeof normalized !== "object") return "";
  return cleanDbValue((normalized as { nombre_pps?: unknown }).nombre_pps);
};

const localDateTimeValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const DesaprobacionPPSModal: React.FC<DesaprobacionPPSModalProps> = ({
  isOpen,
  student,
  launchId,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [practiceId, setPracticeId] = useState("");
  const [failureDate, setFailureDate] = useState(() => localDateTimeValue().slice(0, 10));
  const [notifiedAt, setNotifiedAt] = useState(localDateTimeValue);
  const [attendanceCause, setAttendanceCause] = useState(false);
  const [participationCause, setParticipationCause] = useState(false);
  const [publicReason, setPublicReason] = useState("");
  const [reportReference, setReportReference] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const practicesQuery = useQuery({
    queryKey: ["practicesForDisapproval", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practicas")
        .select(
          "id, lanzamiento_id, nombre_institucion, fecha_inicio, fecha_finalizacion, estado, horas_realizadas, lanzamiento:lanzamientos_pps!fk_practica_lanzamiento(nombre_pps)"
        )
        .eq("estudiante_id", student.id)
        .eq("tipo_actividad", "pps")
        .neq("estado", "Desaprobada")
        .order("fecha_inicio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen || practiceId || !practicesQuery.data?.length) return;
    const launchPractice = launchId
      ? practicesQuery.data.find((practice) => practice.lanzamiento_id === launchId)
      : null;
    setPracticeId((launchPractice || practicesQuery.data[0]).id);
  }, [isOpen, launchId, practiceId, practicesQuery.data]);

  useEffect(() => {
    if (!isOpen) {
      setPracticeId("");
      setAttendanceCause(false);
      setParticipationCause(false);
      setPublicReason("");
      setReportReference("");
      setFailureDate(localDateTimeValue().slice(0, 10));
      setNotifiedAt(localDateTimeValue());
      setFormError(null);
    }
  }, [isOpen]);

  const selectedPractice = useMemo(
    () => practicesQuery.data?.find((practice) => practice.id === practiceId),
    [practiceId, practicesQuery.data]
  );

  const mutation = useMutation({
    mutationFn: async (): Promise<DisapprovalResult> => {
      const causes = [
        attendanceCause ? "inasistencia_responsabilidad" : null,
        participationCause ? "falta_participacion_actitud" : null,
      ].filter((cause): cause is string => Boolean(cause));

      if (!practiceId || causes.length === 0 || !publicReason.trim()) {
        throw new Error("Completá la PPS, al menos una causa y el motivo comunicado.");
      }

      if (!selectedPractice) {
        throw new Error("No se pudo identificar la PPS seleccionada.");
      }

      const parsedNotification = new Date(notifiedAt);
      if (Number.isNaN(parsedNotification.getTime())) {
        throw new Error("La fecha de notificación no es válida.");
      }

      const { data: studentRecord, error: studentError } = await supabase
        .from(TABLE_ESTUDIANTES)
        .select(FIELD_CORREO_ESTUDIANTES)
        .eq("id", student.id)
        .maybeSingle();

      if (studentError) throw studentError;
      const studentEmail = studentRecord?.[FIELD_CORREO_ESTUDIANTES]?.trim();
      if (!studentEmail) {
        throw new Error(
          "El estudiante no tiene un correo registrado. La desaprobación no se guardó para evitar dejarlo sin notificación."
        );
      }

      const { error } = await supabase.rpc("registrar_desaprobacion_pps", {
        p_practica_id: practiceId,
        p_fecha: failureDate,
        p_causas: causes,
        p_motivo_publico: publicReason.trim(),
        p_informe_ref: reportReference.trim(),
        p_notificado_at: parsedNotification.toISOString(),
      });
      if (error) throw error;

      const ppsName =
        getLaunchName(selectedPractice.lanzamiento) ||
        cleanDbValue(selectedPractice.nombre_institucion) ||
        "Práctica Profesional Supervisada";
      const institution =
        cleanDbValue(selectedPractice.nombre_institucion) || ppsName || "la institución";
      const emailKind = participationCause ? "informe_institucional" : "automatico_inasistencia";
      const emailResult = await sendSmartEmail(
        participationCause ? "desaprobacion_institucion" : "desaprobacion_inasistencia",
        {
          studentName: student.nombre,
          studentEmail,
          ppsName,
          institution,
          publicReason: publicReason.trim(),
          cc: DISAPPROVAL_CC,
        }
      );

      return {
        emailSent: emailResult.success,
        emailMessage: emailResult.message,
        emailKind,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["allPenalizedStudents"] });
      queryClient.invalidateQueries({ queryKey: ["practicesForDisapproval", student.id] });
      invalidateLaunchData(queryClient);
      onSuccess(result);
      onClose();
    },
    onError: (error) =>
      setFormError(getErrorMessage(error, "No se pudo registrar la desaprobación")),
  });

  const handleAttendanceCauseChange = (checked: boolean) => {
    setAttendanceCause(checked);
    if (
      checked &&
      !participationCause &&
      (!publicReason.trim() || publicReason === PARTICIPATION_REPORT)
    ) {
      setPublicReason(ATTENDANCE_REASON);
    } else if (!checked && !participationCause && publicReason === ATTENDANCE_REASON) {
      setPublicReason("");
    }
  };

  const handleParticipationCauseChange = (checked: boolean) => {
    setParticipationCause(checked);
    if (checked && (!publicReason.trim() || publicReason === ATTENDANCE_REASON)) {
      setPublicReason(PARTICIPATION_REPORT);
    } else if (!checked && attendanceCause && publicReason === PARTICIPATION_REPORT) {
      setPublicReason(ATTENDANCE_REASON);
    } else if (!checked && !attendanceCause && publicReason === PARTICIPATION_REPORT) {
      setPublicReason("");
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="lv4 lv4-modal-overlay" onClick={onClose}>
      <div
        className={`lv4-modal-shell${participationCause ? " wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lv4-modal-head">
          <span className="lv4-modal-head-glow-a" />
          <span className="lv4-modal-head-glow-b" />
          <div className="lv4-modal-head-row">
            <div className="lv4-modal-head-info">
              <div className="lv4-modal-head-icon lv4-disapproval-icon">
                <span className="material-icons">report</span>
              </div>
              <div>
                <h3 className="lv4-modal-head-title">Registrar PPS desaprobada</h3>
                <div className="lv4-modal-head-meta">
                  {student.nombre} · Legajo {student.legajo}
                </div>
              </div>
            </div>
            <button className="lv4-modal-close" onClick={onClose} aria-label="Cerrar">
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        <div className="lv4-modal-body">
          <div className="lv4-disapproval-impact">
            <span className="material-icons">gavel</span>
            <div>
              <strong>Consecuencia automática</strong>
              <span>
                La práctica queda en el historial con 0 horas y 0 rotaciones computables, y se
                genera una penalización activa de 100 puntos.
              </span>
            </div>
          </div>

          <div className="lv4-form-row">
            <label className="lv4-form-label" htmlFor="disapproval-practice">
              PPS informada por la institución
            </label>
            <select
              id="disapproval-practice"
              className="lv4-select"
              value={practiceId}
              onChange={(event) => setPracticeId(event.target.value)}
              disabled={practicesQuery.isLoading}
            >
              <option value="">Seleccionar práctica…</option>
              {practicesQuery.data?.map((practice) => (
                <option key={practice.id} value={practice.id}>
                  {cleanDbValue(practice.nombre_institucion) || "PPS"}
                  {practice.fecha_inicio ? ` · ${formatDate(practice.fecha_inicio)}` : ""}
                </option>
              ))}
            </select>
            {!practicesQuery.isLoading && practicesQuery.data?.length === 0 ? (
              <div className="lv4-form-help">
                No hay una práctica vigente para marcar. Primero debe reconstruirse o cargarse el
                registro correspondiente.
              </div>
            ) : null}
          </div>

          <div className="lv4-form-grid">
            <div className="lv4-form-row">
              <label className="lv4-form-label" htmlFor="disapproval-date">
                Fecha de resolución
              </label>
              <input
                id="disapproval-date"
                className="lv4-input"
                type="date"
                value={failureDate}
                onChange={(event) => setFailureDate(event.target.value)}
              />
            </div>
            <div className="lv4-form-row">
              <label className="lv4-form-label" htmlFor="disapproval-notified-at">
                Fecha y hora de notificación
              </label>
              <input
                id="disapproval-notified-at"
                className="lv4-input"
                type="datetime-local"
                value={notifiedAt}
                onChange={(event) => setNotifiedAt(event.target.value)}
              />
            </div>
          </div>

          <fieldset className="lv4-form-row lv4-fieldset">
            <legend className="lv4-form-label">Causas informadas</legend>
            <label className="lv4-check-row">
              <input
                type="checkbox"
                checked={attendanceCause}
                onChange={(event) => handleAttendanceCauseChange(event.target.checked)}
              />
              <span>
                <strong>Inasistencia (menos del 80%)</strong>
                <small>La Facultad desaprueba a partir del reporte de asistencia recibido.</small>
              </span>
            </label>
            <label className="lv4-check-row">
              <input
                type="checkbox"
                checked={participationCause}
                onChange={(event) => handleParticipationCauseChange(event.target.checked)}
              />
              <span>
                <strong>Participación y actitud profesional</strong>
                <small>Posición pasiva, falta de compromiso o incumplimiento del encuadre.</small>
              </span>
            </label>
          </fieldset>

          {attendanceCause || participationCause ? (
            <div
              className={`lv4-disapproval-mail ${
                participationCause ? "is-institutional" : "is-automatic"
              }`}
            >
              <span className="material-icons">
                {participationCause ? "edit_note" : "mark_email_read"}
              </span>
              <div>
                <strong>
                  {participationCause
                    ? "Informe institucional editable"
                    : "Correo automático por inasistencia"}
                </strong>
                <span>
                  {participationCause
                    ? "La síntesis que edites abajo se incorporará al correo institucional."
                    : "Se enviará el aviso aprobado por no alcanzar el 80% de asistencia."}
                </span>
                <small>
                  Con copia visible a Agostina Reale Berrueta ·
                  agostina.reale@uflouniversidad.edu.ar
                </small>
              </div>
            </div>
          ) : null}

          <div className="lv4-form-row">
            <label className="lv4-form-label" htmlFor="disapproval-public-reason">
              {participationCause
                ? "Informe institucional para el estudiante"
                : "Motivo registrado"}
            </label>
            <textarea
              id="disapproval-public-reason"
              className={`lv4-textarea${participationCause ? " lv4-report-editor" : ""}`}
              value={publicReason}
              onChange={(event) => setPublicReason(event.target.value)}
              placeholder={
                participationCause
                  ? "Editá la síntesis del informe que recibirá el estudiante…"
                  : "Seleccioná una causa para cargar el motivo…"
              }
            />
            <div className="lv4-form-help">
              {participationCause
                ? "Este texto se enviará al estudiante dentro del formato institucional. Revisalo antes de confirmar."
                : "Este motivo queda en el registro. El correo de inasistencia utiliza el texto institucional fijo."}
            </div>
          </div>

          <div className="lv4-form-row">
            <label className="lv4-form-label" htmlFor="disapproval-report-ref">
              Referencia interna (opcional)
            </label>
            <input
              id="disapproval-report-ref"
              className="lv4-input"
              value={reportReference}
              onChange={(event) => setReportReference(event.target.value)}
              placeholder="Enlace al correo, reporte de asistencia, Drive o acta…"
            />
            <div className="lv4-form-help">
              Si tenés un documento de respaldo, podés guardar el enlace acá. Queda sólo en la
              bitácora administrativa, no se adjunta al correo y el estudiante no lo ve.
            </div>
          </div>

          {selectedPractice ? (
            <div className="lv4-form-help">
              Se conservarán {selectedPractice.horas_realizadas || 0} horas como dato histórico,
              pero su valor computable será 0.
            </div>
          ) : null}

          {formError ? <div className="lv4-form-error">{formError}</div> : null}
        </div>

        <div className="lv4-modal-foot">
          <button className="lv4-btn lv4-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="lv4-btn lv4-btn-danger"
            onClick={() => {
              setFormError(null);
              mutation.mutate();
            }}
            disabled={mutation.isPending || !practiceId}
          >
            {mutation.isPending
              ? "Registrando y enviando…"
              : participationCause
                ? "Desaprobar y enviar informe"
                : attendanceCause
                  ? "Desaprobar y enviar aviso"
                  : "Confirmar desaprobación"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DesaprobacionPPSModal;
