import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PageHeadProps {
  userName: string;
}

export const PageHead: React.FC<PageHeadProps> = ({ userName }) => {
  const now = new Date();
  const today = format(now, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  // Capitalize first letter of today
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);
  const time = format(now, "HH:mm");

  return (
    <div style={{ padding: "40px 0 24px", borderBottom: "1px solid var(--rule-2)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="eyebrow">Tu mañana · coordinación PPS</span>
          <h1
            style={{
              margin: "8px 0 0",
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 46,
              fontWeight: 400,
              letterSpacing: "-0.015em",
              lineHeight: 1.0,
              color: "var(--ink)",
            }}
          >
            Buen día, {userName}.
          </h1>
        </div>
        <div className="meta mono" style={{ fontSize: 12, textAlign: "right", lineHeight: 1.6 }}>
          <div>{todayCapitalized}</div>
          <div style={{ color: "var(--ink-4)" }}>{time}</div>
        </div>
      </div>
    </div>
  );
};
