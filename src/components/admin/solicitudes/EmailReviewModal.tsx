import React from "react";
import type { EmailDraft } from "../../../utils/emailService";

interface EmailReviewModalProps {
  draft: EmailDraft;
  isSending: boolean;
  onChange: (d: EmailDraft) => void;
  onClose: () => void;
  onSend: (e: React.MouseEvent) => void;
}

/**
 * Modal de revisión/edición de un correo institucional antes de enviarlo.
 * Componente de presentación puro: todo su estado llega por props.
 */
const EmailReviewModal: React.FC<EmailReviewModalProps> = ({
  draft,
  isSending,
  onChange,
  onClose,
  onSend,
}) => {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 20px",
            borderBottom: "1px solid var(--rule-2)",
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              Contacto Institucional
            </span>
            <h3 className="serif" style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 700 }}>
              Revisar correo electrónico
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            className="btn btn-ghost btn-sm press"
            style={{ padding: 4 }}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "block" }}>
              <span className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
                Para
              </span>
              <input
                value={draft.to}
                onChange={(e) => onChange({ ...draft, to: e.target.value })}
                className="field"
                style={{ fontSize: 13 }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
                Institución
              </span>
              <input
                value={draft.institution}
                onChange={(e) => onChange({ ...draft, institution: e.target.value })}
                className="field"
                style={{ fontSize: 13 }}
              />
            </label>
          </div>
          <label style={{ display: "block" }}>
            <span className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
              Asunto
            </span>
            <input
              value={draft.subject}
              onChange={(e) => onChange({ ...draft, subject: e.target.value })}
              className="field"
              style={{ fontSize: 13 }}
            />
          </label>
          <label style={{ display: "block" }}>
            <span className="label" style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}>
              Mensaje
            </span>
            <textarea
              value={draft.body}
              onChange={(e) => onChange({ ...draft, body: e.target.value })}
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
          <button onClick={onClose} disabled={isSending} className="btn btn-sm press">
            Cancelar
          </button>
          <button
            onClick={onSend}
            disabled={isSending || !draft.to.trim()}
            className="btn btn-mail btn-sm press"
            style={{ opacity: isSending || !draft.to.trim() ? 0.5 : 1 }}
          >
            {isSending ? (
              <div className="loader-sm" />
            ) : (
              <span className="material-icons" style={{ fontSize: 15 }}>
                send
              </span>
            )}
            {isSending ? "Enviando..." : "Enviar correo"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailReviewModal;
