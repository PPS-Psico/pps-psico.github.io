/**
 * LaunchPreviewModal — Previsualización (tarjeta del estudiante + posteo de
 * WhatsApp) y confirmación de lanzamiento, en el sistema Paper & Ink.
 */
import React from "react";
import {
  FIELD_LOGO_INVERT_DARK_INSTITUCIONES,
  FIELD_LOGO_URL_INSTITUCIONES,
} from "../../../constants";
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
  if (!isOpen) return null;

  const horariosCursada =
    schedules
      .map((s) => {
        const time = s.time.trim();
        const orient = isMultiOrientation && s.orientacion ? ` [${s.orientacion}]` : "";
        return time ? `${time}${orient}` : null;
      })
      .filter(Boolean)
      .join("; ") || "A confirmar";
  const validSchedules = schedules.filter((schedule) => schedule.time.trim());
  const allSchedulesMandatory =
    validSchedules.length > 0 && validSchedules.every((schedule) => schedule.obligatorio);

  return (
    <div
      className="lv4"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        minHeight: 0,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 980,
          maxHeight: "94vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper)",
          color: "var(--ink)",
          borderRadius: 16,
          border: "1px solid var(--rule-2)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--rule-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="material-icons" style={{ fontSize: 22, color: "var(--ink-3)" }}>
              visibility
            </span>
            <div>
              <h3 className="serif" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
                Previsualización
              </h3>
              <div className="meta">Tarjeta del estudiante y mensaje de WhatsApp</div>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <span className="material-icons" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 28,
              maxWidth: 760,
              margin: "0 auto",
            }}
          >
            {/* Card preview */}
            <div>
              <span className="label" style={{ display: "block", marginBottom: 12 }}>
                Vista del estudiante
              </span>
              <div
                style={{
                  background: "var(--paper-2)",
                  borderRadius: 14,
                  padding: 4,
                  border: "1px solid var(--rule-2)",
                }}
              >
                <ConvocatoriaCardPremium
                  id="preview"
                  nombre={(formData.nombrePPS as string) || "Sin nombre"}
                  orientacion={safeOrientacion.length ? safeOrientacion : "Sin orientación"}
                  direccion={(formData.direccion as string) || "Sin dirección"}
                  descripcion={formData.descripcion || "Sin descripción…"}
                  actividades={actividades.length ? actividades : ["Actividad 1…", "Actividad 2…"]}
                  actividadesLabel={formData.actividadesLabel}
                  horasAcreditadas={String(formData.horasAcreditadas || 0)}
                  horariosCursada={horariosCursada}
                  cupo={String(formData.cuposDisponibles || 0)}
                  requisitoObligatorio={formData.requisitoObligatorio}
                  archivoDescargableNombre={formData.archivoDescargableNombre}
                  archivoDescargableUrl={formData.archivoDescargableUrl}
                  reqCv={formData.reqCv}
                  horariosFijos={allSchedulesMandatory}
                  fechaEncuentroInicial={formData.fechaEncuentroInicial}
                  timeline={{
                    inscripcion:
                      formData.fechaInicioInscripcion && formData.fechaFinInscripcion
                        ? `${formatDate(formData.fechaInicioInscripcion)} - ${formatDate(formData.fechaFinInscripcion)}`
                        : "Abierta/A definir",
                    inicio: formData.fechaInicio ? formatDate(formData.fechaInicio) : "A confirmar",
                    fin: formData.fechaFin ? formatDate(formData.fechaFin) : "A confirmar",
                  }}
                  logoUrl={selectedInstitution?.[FIELD_LOGO_URL_INSTITUCIONES] as string}
                  invertLogo={
                    selectedInstitution?.[FIELD_LOGO_INVERT_DARK_INSTITUCIONES] as boolean
                  }
                  status="abierta"
                />
              </div>
            </div>

            {/* WhatsApp preview */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span
                  className="label"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span className="material-icons" style={{ fontSize: 14, color: "var(--ok)" }}>
                    chat
                  </span>
                  Posteo de WhatsApp
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onCopy(formData.mensajeWhatsApp || "")}
                >
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    {isCopied ? "done_all" : "content_copy"}
                  </span>
                  {isCopied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <textarea
                className="field"
                value={formData.mensajeWhatsApp}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, mensajeWhatsApp: e.target.value }))
                }
                style={{
                  minHeight: 280,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  background: "var(--paper-2)",
                }}
                placeholder="El mensaje de WhatsApp se genera automáticamente…"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--rule-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="meta" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="material-icons" style={{ fontSize: 14 }}>
              info
            </span>
            {formData.programarLanzamiento
              ? "Se agendará para la fecha seleccionada."
              : "Se publicará inmediatamente."}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
              Seguir editando
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onConfirm}
              disabled={isSubmitting}
            >
              <span
                className={`material-icons ${isSubmitting ? "lf-spin" : ""}`}
                style={{ fontSize: 16 }}
              >
                {isSubmitting
                  ? "autorenew"
                  : formData.programarLanzamiento
                    ? "schedule_send"
                    : "rocket_launch"}
              </span>
              {formData.programarLanzamiento ? "Programar" : "Lanzar ahora"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchPreviewModal;
