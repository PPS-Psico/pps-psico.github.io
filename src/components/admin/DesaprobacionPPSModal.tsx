import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { invalidateLaunchData } from "../../lib/launchQueryKeys";
import { cleanDbValue, formatDate } from "../../utils/formatters";
import { getErrorMessage } from "../../utils/getErrorMessage";

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
  onSuccess: () => void;
}

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
          "id, lanzamiento_id, nombre_institucion, fecha_inicio, fecha_finalizacion, estado, horas_realizadas"
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
      setFormError(null);
    }
  }, [isOpen]);

  const selectedPractice = useMemo(
    () => practicesQuery.data?.find((practice) => practice.id === practiceId),
    [practiceId, practicesQuery.data]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const causes = [
        attendanceCause ? "inasistencia_responsabilidad" : null,
        participationCause ? "falta_participacion_actitud" : null,
      ].filter((cause): cause is string => Boolean(cause));

      if (!practiceId || causes.length === 0 || !publicReason.trim() || !reportReference.trim()) {
        throw new Error("Completá la PPS, al menos una causa, el motivo comunicado y el informe.");
      }

      const parsedNotification = new Date(notifiedAt);
      if (Number.isNaN(parsedNotification.getTime())) {
        throw new Error("La fecha de notificación no es válida.");
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allPenalizedStudents"] });
      queryClient.invalidateQueries({ queryKey: ["practicesForDisapproval", student.id] });
      invalidateLaunchData(queryClient);
      onSuccess();
      onClose();
    },
    onError: (error) =>
      setFormError(getErrorMessage(error, "No se pudo registrar la desaprobación")),
  });

  if (!isOpen) return null;

  return (
    <div className="lv4-modal-overlay" onClick={onClose}>
      <div className="lv4-modal-shell" onClick={(event) => event.stopPropagation()}>
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
                Estudiante notificado
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
                onChange={(event) => setAttendanceCause(event.target.checked)}
              />
              <span>
                <strong>Asistencia y responsabilidad</strong>
                <small>Menos del 80%, faltas sin aviso o incumplimiento de horarios.</small>
              </span>
            </label>
            <label className="lv4-check-row">
              <input
                type="checkbox"
                checked={participationCause}
                onChange={(event) => setParticipationCause(event.target.checked)}
              />
              <span>
                <strong>Participación y actitud profesional</strong>
                <small>Posición pasiva, falta de compromiso o incumplimiento del encuadre.</small>
              </span>
            </label>
          </fieldset>

          <div className="lv4-form-row">
            <label className="lv4-form-label" htmlFor="disapproval-public-reason">
              Motivo comunicado al estudiante
            </label>
            <textarea
              id="disapproval-public-reason"
              className="lv4-textarea"
              value={publicReason}
              onChange={(event) => setPublicReason(event.target.value)}
              placeholder="Síntesis clara y no sensible del fundamento institucional…"
            />
          </div>

          <div className="lv4-form-row">
            <label className="lv4-form-label" htmlFor="disapproval-report-ref">
              Referencia interna al informe
            </label>
            <input
              id="disapproval-report-ref"
              className="lv4-input"
              value={reportReference}
              onChange={(event) => setReportReference(event.target.value)}
              placeholder="Enlace de Gmail, documento o acta…"
            />
            <div className="lv4-form-help">
              Esta referencia queda sólo en la bitácora administrativa; el estudiante no la ve.
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
            {mutation.isPending ? "Registrando…" : "Confirmar desaprobación"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesaprobacionPPSModal;
