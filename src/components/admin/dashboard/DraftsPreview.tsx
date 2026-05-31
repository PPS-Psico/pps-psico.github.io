import React from "react";
import type { DraftPreview } from "../../../hooks/useInicioData";

export interface DraftsPreviewProps {
  drafts: DraftPreview[];
  total: number;
  onOpenHermes: () => void;
  onOpenDraft?: (draft: DraftPreview) => void;
}

export const DraftsPreview: React.FC<DraftsPreviewProps> = ({
  drafts,
  total,
  onOpenHermes,
  onOpenDraft,
}) => {
  if (drafts.length === 0) return null;

  const openOne = (d: DraftPreview) => (onOpenDraft ? onOpenDraft(d) : onOpenHermes());

  return (
    <section style={{ padding: "28px 0", borderTop: "1px solid var(--rule-2)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <span className="eyebrow">Listo para tu visto</span>
          <h2
            className="serif"
            style={{ margin: "5px 0 0", fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            Hermes preparó {total} {total === 1 ? "respuesta" : "respuestas"}
          </h2>
        </div>
        <button className="btn btn-ai btn-sm press" onClick={onOpenHermes}>
          Revisar {total > drafts.length ? `las ${total}` : "todas"}
          <span className="material-icons" style={{ fontSize: 15 }}>
            arrow_forward
          </span>
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {drafts.map((d) => (
          <DraftPreviewRow key={d.id} d={d} onOpen={() => openOne(d)} />
        ))}
      </div>
    </section>
  );
};

const DraftPreviewRow: React.FC<{ d: DraftPreview; onOpen: () => void }> = ({ d, onOpen }) => {
  const isMail = d.canal === "mail";
  const name = d.nombre || "Contacto";
  const rawDraft = d.borrador || "";
  const preview = rawDraft.replace(/\n+/g, " ").slice(0, 130);

  return (
    <button
      onClick={onOpen}
      className="press"
      style={{
        display: "grid",
        gridTemplateColumns: "34px 1fr auto",
        gap: 14,
        alignItems: "flex-start",
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--rule-2)",
        background: "var(--paper)",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        borderLeft: "3px solid var(--ai)",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          marginTop: 1,
          background: isMail
            ? "var(--accent-soft)"
            : "color-mix(in srgb, var(--ok) 14%, var(--paper))",
          color: isMail ? "var(--accent)" : "#2F8F43",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span className="material-icons" style={{ fontSize: 16 }}>
          {isMail ? "mail" : "chat"}
        </span>
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{name}</span>
          <span className="meta" style={{ fontSize: 11 }}>
            · responder por {isMail ? "mail" : "WhatsApp"}
          </span>
        </div>
        <div
          className="meta"
          style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.45, color: "var(--ink-2)" }}
        >
          “{preview}…”
        </div>
      </div>
      <span
        className="material-icons"
        style={{ fontSize: 18, color: "var(--ink-4)", alignSelf: "center" }}
      >
        arrow_forward
      </span>
    </button>
  );
};
