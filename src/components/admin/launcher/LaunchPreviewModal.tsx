/**
 * Revisión final de la convocatoria: replica la tarjeta del estudiante y
 * permite ajustar/copiar el mensaje de difusión antes de publicar.
 */
import React from "react";
import {
  FIELD_LOGO_INVERT_DARK_INSTITUCIONES,
  FIELD_LOGO_URL_INSTITUCIONES,
  FIELD_NOMBRE_INSTITUCIONES,
} from "../../../constants";
import { useAccessibleDialog } from "../../../hooks/useAccessibleDialog";
import type { AirtableRecord, InstitucionFields } from "../../../types";
import { formatDate } from "../../../utils/formatters";
import ConvocatoriaCardPremium from "../../ConvocatoriaCardPremium";
import type { FormData, ScheduleEntry } from "./launchForm.types";

interface LaunchPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  schedules: ScheduleEntry[];
  actividades: string[];
  isMultiOrientation: boolean;
  safeOrientacion: string[];
  selectedInstitution: AirtableRecord<InstitucionFields> | null;
  isCopied: boolean;
  onCopy: (text: string) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

const safeText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const LaunchPreviewModal: React.FC<LaunchPreviewModalProps> = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  schedules,
  actividades,
  isMultiOrientation,
  safeOrientacion,
  selectedInstitution,
  isCopied,
  onCopy,
  onConfirm,
  isSubmitting,
}) => {
  const dialogRef = useAccessibleDialog<HTMLElement>({
    isOpen,
    onClose,
    canClose: !isSubmitting,
  });

  if (!isOpen) return null;

  const validSchedules = (Array.isArray(schedules) ? schedules : []).filter((schedule) =>
    safeText(schedule?.time)
  );
  const horariosCursada =
    validSchedules
      .map((schedule) => {
        const time = safeText(schedule.time);
        const orientation = safeText(schedule.orientacion);
        return `${time}${isMultiOrientation && orientation ? ` [${orientation}]` : ""}`;
      })
      .join("; ") || "A confirmar";
  const allSchedulesMandatory =
    validSchedules.length > 0 && validSchedules.every((schedule) => schedule.obligatorio);
  const visibleActivities = (Array.isArray(actividades) ? actividades : [])
    .map(safeText)
    .filter(Boolean);
  const institutionName = safeText(selectedInstitution?.[FIELD_NOMBRE_INSTITUCIONES]);
  const whatsappMessage = formData.mensajeWhatsApp || "";

  const pendingItems = [
    !institutionName && "institución",
    !safeText(formData.nombrePPS) && "nombre",
    safeOrientacion.length === 0 && "orientación",
    !safeText(formData.fechaInicio) && "fecha de inicio",
    !safeText(formData.descripcion) && "descripción",
    validSchedules.length === 0 && "horarios",
  ].filter((item): item is string => Boolean(item));

  const closeIfAllowed = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <div className="lv4 lv4-modal-overlay lv4-preview-overlay">
      <button
        type="button"
        className="lv4-preview-backdrop-hit"
        onClick={closeIfAllowed}
        disabled={isSubmitting}
        aria-label="Cerrar previsualización"
        tabIndex={-1}
      />
      <section
        ref={dialogRef}
        className="lv4-modal-shell lv4-preview-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-preview-title"
        tabIndex={-1}
      >
        <header className="lv4-modal-head">
          <div className="lv4-modal-head-glow-a" />
          <div className="lv4-modal-head-glow-b" />
          <div className="lv4-modal-head-row">
            <div className="lv4-modal-head-info">
              <div className="lv4-modal-head-icon" aria-hidden="true">
                <span className="material-icons">preview</span>
              </div>
              <div>
                <h2 id="launch-preview-title" className="lv4-modal-head-title">
                  Revisión antes de publicar
                </h2>
                <div className="lv4-modal-head-meta">
                  <span>{institutionName || "Institución sin seleccionar"}</span>
                  <span className="lv4-pill">
                    {formData.programarLanzamiento ? "Programada" : "Publicación inmediata"}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="lv4-modal-close"
              onClick={closeIfAllowed}
              disabled={isSubmitting}
              aria-label="Cerrar previsualización"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </header>

        <div className="lv4-modal-body lv4-preview-body">
          <div className={`lv4-preview-summary ${pendingItems.length ? "is-incomplete" : ""}`}>
            <div className="lv4-preview-summary-main">
              <span className="material-icons" aria-hidden="true">
                {pendingItems.length ? "error_outline" : "verified"}
              </span>
              <div>
                <strong>
                  {pendingItems.length
                    ? `${pendingItems.length} ${pendingItems.length === 1 ? "dato pendiente" : "datos pendientes"}`
                    : "Contenido completo para publicar"}
                </strong>
                <span>
                  {pendingItems.length
                    ? `Revisá: ${pendingItems.join(", ")}. Podés volver a editar antes de lanzar.`
                    : "Comprobá el contenido y confirmá el lanzamiento cuando esté listo."}
                </span>
              </div>
            </div>
            <span
              className={`lv4-chip ${pendingItems.length ? "lv4-chip-seguro" : "lv4-chip-activa"}`}
            >
              {pendingItems.length ? "Requiere revisión" : "Lista"}
            </span>
          </div>

          <div className="lv4-preview-grid">
            <article className="lv4-preview-panel">
              <div className="lv4-preview-panel-head">
                <div className="lv4-preview-panel-heading">
                  <div className="lv4-preview-panel-icon" aria-hidden="true">
                    <span className="material-icons">school</span>
                  </div>
                  <div>
                    <h3 className="lv4-preview-panel-title">Vista del estudiante</h3>
                    <div className="lv4-preview-panel-meta">
                      La tarjeta se muestra abierta para revisar todos los detalles
                    </div>
                  </div>
                </div>
                <span className="lv4-chip lv4-chip-seleccion">Panel</span>
              </div>
              <div className="lv4-preview-student-stage">
                <ConvocatoriaCardPremium
                  id="preview"
                  nombre={safeText(formData.nombrePPS) || "Convocatoria sin nombre"}
                  orientacion={safeOrientacion.length ? safeOrientacion : "Sin orientación"}
                  direccion={safeText(formData.direccion) || "Ubicación a confirmar"}
                  descripcion={
                    safeText(formData.descripcion) ||
                    "La descripción de la propuesta aparecerá en este espacio."
                  }
                  actividades={
                    visibleActivities.length
                      ? visibleActivities
                      : ["Las actividades se informarán próximamente"]
                  }
                  actividadesLabel={formData.actividadesLabel || "Actividades"}
                  horasAcreditadas={String(formData.horasAcreditadas || 0)}
                  horariosCursada={horariosCursada}
                  cupo={String(formData.cuposDisponibles || "A confirmar")}
                  requisitoObligatorio={formData.requisitoObligatorio || ""}
                  archivoDescargableNombre={formData.archivoDescargableNombre}
                  archivoDescargableUrl={formData.archivoDescargableUrl}
                  reqCv={formData.reqCv}
                  horariosFijos={allSchedulesMandatory}
                  fechaEncuentroInicial={formData.fechaEncuentroInicial}
                  timeline={{
                    inscripcion:
                      formData.fechaInicioInscripcion && formData.fechaFinInscripcion
                        ? `${formatDate(formData.fechaInicioInscripcion)} – ${formatDate(formData.fechaFinInscripcion)}`
                        : "A definir",
                    inicio: formData.fechaInicio ? formatDate(formData.fechaInicio) : "A confirmar",
                    fin: formData.fechaFin ? formatDate(formData.fechaFin) : "A confirmar",
                  }}
                  logoUrl={selectedInstitution?.[FIELD_LOGO_URL_INSTITUCIONES] as string}
                  invertLogo={
                    selectedInstitution?.[FIELD_LOGO_INVERT_DARK_INSTITUCIONES] as boolean
                  }
                  status="abierta"
                  defaultExpanded
                />
              </div>
            </article>

            <aside className="lv4-preview-panel lv4-preview-wa-panel">
              <div className="lv4-preview-panel-head">
                <div className="lv4-preview-panel-heading">
                  <div className="lv4-preview-panel-icon is-whatsapp" aria-hidden="true">
                    <span className="material-icons">forum</span>
                  </div>
                  <div>
                    <h3 className="lv4-preview-panel-title">Mensaje de WhatsApp</h3>
                    <div className="lv4-preview-panel-meta">Editable y listo para copiar</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="lv4-btn"
                  onClick={() => onCopy(whatsappMessage)}
                  disabled={!whatsappMessage}
                >
                  <span className="material-icons">{isCopied ? "done_all" : "content_copy"}</span>
                  {isCopied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <div className="lv4-preview-editor">
                <textarea
                  className="lv4-textarea lv4-preview-textarea"
                  value={whatsappMessage}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      mensajeWhatsApp: event.target.value,
                    }))
                  }
                  aria-label="Mensaje de WhatsApp"
                  placeholder="El mensaje se genera automáticamente con los datos de la convocatoria."
                />
                <div className="lv4-preview-editor-foot">
                  <span>Podés ajustar el texto antes de copiarlo.</span>
                  <span>{whatsappMessage.length.toLocaleString("es-AR")} caracteres</span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <footer className="lv4-modal-foot lv4-preview-foot">
          <div className="lv4-preview-foot-note">
            <span className="material-icons" aria-hidden="true">
              info
            </span>
            <span>
              {formData.programarLanzamiento
                ? "La convocatoria quedará agendada para la fecha elegida."
                : "La convocatoria se publicará inmediatamente."}
            </span>
          </div>
          <div className="lv4-preview-foot-actions">
            <button
              type="button"
              className="lv4-btn lv4-btn-ghost"
              onClick={closeIfAllowed}
              disabled={isSubmitting}
              data-dialog-autofocus
            >
              Seguir editando
            </button>
            <button
              type="button"
              className="lv4-btn lv4-btn-primary"
              onClick={onConfirm}
              disabled={isSubmitting}
            >
              <span className={`material-icons ${isSubmitting ? "lf-spin" : ""}`}>
                {isSubmitting
                  ? "autorenew"
                  : formData.programarLanzamiento
                    ? "schedule_send"
                    : "rocket_launch"}
              </span>
              {isSubmitting
                ? "Procesando…"
                : formData.programarLanzamiento
                  ? "Confirmar programación"
                  : "Publicar convocatoria"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default LaunchPreviewModal;
