import React from "react";

export interface PriorityItem {
  id: string;
  tone: "warn" | "accent" | "ai" | "ok" | "crit" | "ink";
  eyebrow: string;
  title: string;
  detail: string;
  cta: string;
  onClick: () => void;
}

interface PrioritiesListProps {
  items: PriorityItem[];
}

export const PrioritiesList: React.FC<PrioritiesListProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <section style={{ padding: "28px 0", borderTop: "1px solid var(--rule-2)" }}>
      <span className="eyebrow">Si hacés tres cosas hoy</span>
      <h2
        className="serif"
        style={{ margin: "5px 0 18px", fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}
      >
        Prioridades
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((p, i) => (
          <PriorityRow key={p.id} p={p} n={i + 1} />
        ))}
      </div>
    </section>
  );
};

const PriorityRow: React.FC<{ p: PriorityItem; n: number }> = ({ p, n }) => {
  const getColors = (tone: string) => {
    switch (tone) {
      case "accent":
        return { c: "var(--accent)", s: "var(--accent-soft)" };
      case "warn":
        return { c: "var(--warn)", s: "var(--warn-soft)" };
      case "ai":
        return { c: "var(--ai)", s: "var(--ai-soft)" };
      case "ok":
        return { c: "var(--ok)", s: "var(--ok-soft)" };
      case "crit":
        return { c: "var(--crit)", s: "var(--crit-soft)" };
      default:
        return { c: "var(--ink)", s: "var(--paper-2)" };
    }
  };

  const C = getColors(p.tone);

  return (
    <button
      onClick={p.onClick}
      className="press"
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr auto",
        gap: 16,
        alignItems: "center",
        padding: "16px 12px",
        borderRadius: 10,
        border: 0,
        borderBottom: "1px solid var(--rule-2)",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--paper-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: C.c }}>
        {String(n).padStart(2, "0")}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 999,
              background: C.s,
              color: C.c,
            }}
          >
            {p.eyebrow}
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{p.title}</span>
        </div>
        <div className="meta" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>
          {p.detail}
        </div>
      </div>
      <span className="btn btn-sm" style={{ pointerEvents: "none", flexShrink: 0 }}>
        {p.cta}
        <span className="material-icons" style={{ fontSize: 14 }}>
          arrow_forward
        </span>
      </span>
    </button>
  );
};
