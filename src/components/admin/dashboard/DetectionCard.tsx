import React from "react";
import type { DetectionMetric as InicioMetric } from "../../../hooks/useInicioData";
import { SectionDataStatus } from "./SectionDataStatus";

export interface DetectionMetric extends InicioMetric {
  onClick: () => void;
  onRetry: () => void;
}

interface DetectionCardProps {
  m: DetectionMetric;
}

export const DetectionCard: React.FC<DetectionCardProps> = ({ m }) => {
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

  const C = getColors(m.tone);

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <button
        onClick={m.onClick}
        className="press"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
          padding: "18px 18px 16px",
          borderRadius: 14,
          border: "1px solid var(--rule-2)",
          background: "var(--paper)",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          transition:
            "border-color .12s ease, background-color .12s ease, box-shadow .12s ease, transform .12s ease, color .12s ease",
          minWidth: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--rule-3)";
          e.currentTarget.style.background = "var(--paper-2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--rule-2)";
          e.currentTarget.style.background = "var(--paper)";
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: C.s,
            color: C.c,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className="material-icons" style={{ fontSize: 17 }}>
            {m.icon}
          </span>
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: m.n !== null && m.n > 0 ? "var(--ink)" : "var(--ink-3)",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {m.n ?? "—"}
          </span>
        </div>
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.25 }}>
            {m.label}
          </div>
          <div className="meta" style={{ fontSize: 11.5, marginTop: 2 }}>
            {m.sub}
          </div>
          {m.note && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid var(--rule-2)",
                fontSize: 11,
                fontWeight: 600,
                color: `var(--${m.noteTone || "ai"})`,
              }}
            >
              <span className="material-icons" style={{ fontSize: 13 }}>
                {m.noteIcon || "auto_awesome"}
              </span>
              {m.note}
            </div>
          )}
        </div>
      </button>
      <SectionDataStatus state={m.state} label={m.label} onRetry={m.onRetry} />
    </div>
  );
};
