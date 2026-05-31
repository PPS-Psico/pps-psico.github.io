// ──────────────────────────────────────────────────────────────────────────
// SolicitudActionPanel — panel DERECHO para accionar una solicitud estancada.
//
// Muestra lo que Hermes ya preparó: según los datos de contacto de la
// institución, un WhatsApp listo (si hay celular) o un correo listo (si hay
// fijo/email). El coordinador edita y dispara el envío:
//   · WhatsApp → abre wa.me con el texto (envío manual, shadow mode).
//   · Email    → abre el cliente de correo (mailto) con asunto + cuerpo.
//
// Si Hermes no encontró datos de contacto, lo dice y ofrece abrir la solicitud
// en la vista de Solicitudes.
// ──────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import type { SolicitudOutreach } from "../../../services/hermesPlan";

interface Props {
  data: SolicitudOutreach;
  onClose: () => void;
  onSent?: (msg: string) => void;
  /** Abrir la solicitud en la vista de Solicitudes (fallback / ver ficha). */
  onOpenSolicitud?: (solicitudId: string) => void;
}

const canalMeta: Record<
  SolicitudOutreach["canal"],
  { icon: string; label: string; color: string }
> = {
  whatsapp: { icon: "chat", label: "WhatsApp listo para enviar", color: "var(--ok)" },
  email: { icon: "mail", label: "Correo listo para enviar", color: "var(--accent)" },
  ninguno: { icon: "help", label: "Sin datos de contacto", color: "var(--warn)" },
};

const fmtFecha = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const SolicitudActionPanel: React.FC<Props> = ({
  data,
  onClose,
  onSent,
  onOpenSolicitud,
}) => {
  const [asunto, setAsunto] = useState(data.asunto || "");
  const [mensaje, setMensaje] = useState(data.mensaje || "");

  // Si cambia la acción seleccionada, recargar el borrador.
  useEffect(() => {
    setAsunto(data.asunto || "");
    setMensaje(data.mensaje || "");
  }, [data]);

  const meta = canalMeta[data.canal];
  const tieneMensaje = !!mensaje.trim();

  const enviarWhatsApp = () => {
    const digits = (data.destino || data.telefono || "").replace(/[^\d]/g, "");
    if (!digits) {
      onSent?.("No hay un número válido para WhatsApp.");
      return;
    }
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener"
    );
    onSent?.("WhatsApp abierto · revisá y enviá manualmente.");
  };

  const enviarEmail = () => {
    const to = data.destino || data.email || "";
    if (!to) {
      onSent?.("No hay una casilla de correo cargada.");
      return;
    }
    const url = `mailto:${to}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank", "noopener");
    onSent?.("Correo abierto en tu cliente · revisá y enviá.");
  };

  return (
    <aside
      className="gv3-ficha"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "calc(100vh - 60px)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid var(--rule-2)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--ai)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              auto_awesome
            </span>
            Acción preparada por Hermes
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--ink-3)",
              padding: 0,
              display: "inline-flex",
            }}
          >
            <span className="material-icons" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>
        <h2
          className="serif"
          style={{ margin: "8px 0 0", fontSize: 19, lineHeight: 1.25, color: "var(--ink)" }}
        >
          {data.nombreAlumno || "Estudiante"}
        </h2>
        <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-2)" }}>
          {data.nombreInstitucion || "Institución"}
        </div>
        <div
          style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--warn)",
              background: "color-mix(in oklab, var(--warn) 13%, var(--paper))",
              padding: "3px 9px",
              borderRadius: 999,
            }}
          >
            {data.estadoSeguimiento || "Pendiente"}
          </span>
          {data.diasSinMovimiento != null && (
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {data.diasSinMovimiento} días sin movimiento
            </span>
          )}
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px" }}>
        {data.canal === "ninguno" ? (
          <div style={{ textAlign: "center", padding: "40px 8px", color: "var(--ink-3)" }}>
            <span className="material-icons" style={{ fontSize: 38, color: "var(--warn)" }}>
              contact_phone
            </span>
            <div
              className="serif"
              style={{ marginTop: 12, fontSize: 17, fontWeight: 700, color: "var(--ink-2)" }}
            >
              Sin datos de contacto
            </div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
              La solicitud no tiene teléfono ni correo de la institución cargados. Abrí la solicitud
              para completar los datos o gestionarla a mano.
            </div>
            {onOpenSolicitud && (
              <button
                onClick={() => onOpenSolicitud(data.solicitudId)}
                className="press"
                style={{
                  marginTop: 16,
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--rule-2)",
                  background: "transparent",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Abrir solicitud
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Destinatario / canal */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid color-mix(in oklab, ${meta.color} 28%, var(--rule-2))`,
                background: `color-mix(in oklab, ${meta.color} 7%, var(--paper))`,
                marginBottom: 14,
              }}
            >
              <span className="material-icons" style={{ fontSize: 18, color: meta.color }}>
                {meta.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {data.canal === "whatsapp"
                    ? data.telefono || data.destino
                    : data.email || data.destino}
                  {data.referente ? ` · ${data.referente}` : ""}
                </div>
              </div>
            </div>

            {/* Contexto: conversación previa (seguimiento) o aviso de primer contacto */}
            {data.esSeguimiento && data.historial.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 13 }}>
                    history
                  </span>
                  Última conversación
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.historial.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: m.deMi ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        padding: "8px 11px",
                        borderRadius: 12,
                        border: "1px solid var(--rule-2)",
                        background: m.deMi ? "var(--paper-2)" : "var(--paper)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)" }}>
                          {m.deMi ? "Vos · Coordinación" : m.autor || "Institución"}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--ink-4)",
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtFecha(m.fecha)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--ink-2)",
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {m.texto || "(sin contenido)"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "9px 11px",
                  borderRadius: 10,
                  border: "1px solid color-mix(in oklab, var(--ai) 22%, var(--rule-2))",
                  background: "color-mix(in oklab, var(--ai) 6%, var(--paper))",
                  marginBottom: 16,
                  fontSize: 12,
                  color: "var(--ink-2)",
                  lineHeight: 1.45,
                }}
              >
                <span className="material-icons" style={{ fontSize: 16, color: "var(--ai)" }}>
                  waving_hand
                </span>
                <span>
                  <b>Primer contacto.</b> No hay conversación previa con esta institución por este
                  canal: Hermes preparó un mensaje de presentación.
                </span>
              </div>
            )}

            {/* Asunto (solo email) */}
            {data.canal === "email" && (
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                    marginBottom: 5,
                  }}
                >
                  Asunto
                </label>
                <input
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 9,
                    border: "1px solid var(--rule-2)",
                    background: "var(--paper-2)",
                    color: "var(--ink)",
                    fontFamily: "inherit",
                    fontSize: 13,
                  }}
                />
              </div>
            )}

            {/* Mensaje editable */}
            <label
              style={{
                display: "block",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--ai)",
                marginBottom: 5,
              }}
            >
              Mensaje · editá y enviá
            </label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={data.canal === "whatsapp" ? 7 : 10}
              placeholder="Hermes no pudo redactar el mensaje. Escribilo a mano."
              style={{
                width: "100%",
                resize: "vertical",
                padding: 11,
                borderRadius: 10,
                border: "1px solid var(--rule-2)",
                background: "var(--paper-2)",
                color: "var(--ink)",
                fontFamily: "inherit",
                fontSize: 13,
                lineHeight: 1.55,
                minHeight: 120,
              }}
            />
          </>
        )}
      </div>

      {/* ── Footer: enviar ── */}
      {data.canal !== "ninguno" && (
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid var(--rule-2)",
            background: "var(--paper)",
            padding: "12px 18px 16px",
            display: "flex",
            gap: 8,
          }}
        >
          <button
            disabled={!tieneMensaje}
            onClick={data.canal === "whatsapp" ? enviarWhatsApp : enviarEmail}
            className="press"
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: data.canal === "whatsapp" ? "var(--ok)" : "var(--ink)",
              color: "var(--paper)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: tieneMensaje ? "pointer" : "default",
              opacity: tieneMensaje ? 1 : 0.5,
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>
              {data.canal === "whatsapp" ? "send" : "mail"}
            </span>
            {data.canal === "whatsapp" ? "Abrir WhatsApp" : "Abrir correo"}
          </button>
          {onOpenSolicitud && (
            <button
              onClick={() => onOpenSolicitud(data.solicitudId)}
              title="Ver la solicitud completa"
              className="press"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--rule-2)",
                background: "transparent",
                color: "var(--ink-2)",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span className="material-icons" style={{ fontSize: 16 }}>
                open_in_new
              </span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};

export default SolicitudActionPanel;
