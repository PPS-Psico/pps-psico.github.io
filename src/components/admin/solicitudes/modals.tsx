import React, { useState } from "react";

// ─── Modales del módulo de Solicitudes ──────────────────────────────

// ─── Modal Rechazo (Reutilizado) ────────────────────────────────────
export interface RejectModalProps {
  sol: any;
  onClose: () => void;
  onConfirm: (comentario: string) => void;
}

export const RejectModal: React.FC<RejectModalProps> = ({ sol, onClose, onConfirm }) => {
  const [comentario, setComentario] = useState("");
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--rule-2)" }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Rechazar solicitud
          </h3>
          <div className="meta" style={{ marginTop: 4 }}>
            {sol?.estudiante?.nombre || sol?._studentName || "Alumno"} ·{" "}
            {sol?.tipo_modificacion ? "Modificación" : "Nueva PPS / Ingreso"}
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <label className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
            Motivo del rechazo{" "}
            <span
              style={{
                textTransform: "none",
                letterSpacing: 0,
                color: "var(--ink-4)",
                fontWeight: 400,
              }}
            >
              (se le envía al alumno)
            </span>
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={4}
            className="field"
            placeholder="Explicá por qué se rechaza la solicitud..."
          ></textarea>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "14px 20px",
            borderTop: "1px solid var(--rule-2)",
            background: "var(--paper-2)",
          }}
        >
          <button onClick={onClose} className="btn btn-sm press">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(comentario)}
            disabled={!comentario.trim()}
            className="btn btn-sm press"
            style={{
              background: "var(--crit)",
              color: "var(--paper)",
              borderColor: "var(--crit)",
              opacity: comentario.trim() ? 1 : 0.5,
            }}
          >
            <span className="material-icons" style={{ fontSize: 15 }}>
              close
            </span>
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Borrador Hermes ──────────────────────────────────────────
export interface BorradorModalProps {
  state: {
    confidence: number;
    requiereDecision: boolean;
    motivo?: string;
    to: string;
    institution: string;
    subject: string;
    body: string;
    generando: boolean;
  };
  onClose: () => void;
  onSend: (subject: string, body: string) => void;
}

export const BorradorModal: React.FC<BorradorModalProps> = ({ state, onClose, onSend }) => {
  const [subject, setSubject] = useState(state.subject || "");
  const [body, setBody] = useState(state.body || "");

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 20px",
            borderBottom: "1px solid var(--rule-2)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span className="material-icons" style={{ fontSize: 16, color: "var(--ai)" }}>
                auto_awesome
              </span>
              <span className="label" style={{ color: "var(--ai)" }}>
                Borrador generado por Hermes
              </span>
            </div>
            <h3 className="serif" style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 700 }}>
              Revisá antes de enviar
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm press" style={{ padding: 4 }}>
            <span className="material-icons" style={{ fontSize: 18, color: "var(--ink-3)" }}>
              close
            </span>
          </button>
        </div>

        {state.generando ? (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <div className="meta" style={{ marginTop: 16, fontSize: 13 }}>
              Hermes está redactando…
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--ai-soft)",
                }}
              >
                <span className="material-icons" style={{ fontSize: 15, color: "var(--ai)" }}>
                  verified
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                  Borrador listo{" "}
                  <span className="mono" style={{ color: "var(--ai)", fontWeight: 600 }}>
                    (confianza: {state.confidence})
                  </span>
                  . Podés editar el cuerpo del mensaje.
                </span>
              </div>

              {state.requiereDecision && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "var(--warn-soft)",
                    border: "1px solid #B4501E22",
                  }}
                >
                  <span
                    className="material-icons"
                    style={{ fontSize: 15, color: "var(--warn)", flexShrink: 0, marginTop: 1 }}
                  >
                    pan_tool
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                    <strong style={{ color: "var(--warn)" }}>Hermes detectó un detalle:</strong>{" "}
                    {state.motivo}
                  </span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "block" }}>
                  <span
                    className="label"
                    style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                  >
                    Para
                  </span>
                  <input
                    value={state.to}
                    readOnly
                    className="field"
                    style={{ fontSize: 13, color: "var(--ink-3)" }}
                  />
                </label>
                <label style={{ display: "block" }}>
                  <span
                    className="label"
                    style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                  >
                    Institución
                  </span>
                  <input
                    value={state.institution}
                    readOnly
                    className="field"
                    style={{ fontSize: 13, color: "var(--ink-3)" }}
                  />
                </label>
              </div>
              <label style={{ display: "block" }}>
                <span
                  className="label"
                  style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                >
                  Asunto
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="field"
                  style={{ fontSize: 13 }}
                />
              </label>
              <label style={{ display: "block" }}>
                <span
                  className="label"
                  style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                >
                  Mensaje
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={11}
                  className="field"
                  style={{ fontSize: 13, lineHeight: 1.55 }}
                ></textarea>
              </label>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "14px 20px",
                borderTop: "1px solid var(--rule-2)",
                background: "var(--paper-2)",
              }}
            >
              <button onClick={onClose} className="btn btn-sm press">
                Cancelar
              </button>
              <button
                onClick={() => onSend(subject, body)}
                disabled={state.to === "—" || !state.to}
                className="btn btn-mail btn-sm press"
                style={{ opacity: state.to === "—" ? 0.5 : 1 }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  send
                </span>
                Enviar correo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
