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
  // Solo el primer nombre para un saludo más cercano ("Buen día, Blas.")
  const firstName = (userName || "").trim().split(/\s+/)[0] || userName;

  return (
    <div
      className="admin-pagehead"
      style={{ padding: "40px 0 24px", borderBottom: "1px solid var(--rule-2)" }}
    >
      <style>{`
        .admin-pagehead__rule {
          display: block;
          width: 64px;
          height: 3px;
          border-radius: 3px;
          margin-bottom: 14px;
          background: linear-gradient(90deg, #46253d 0%, #203b73 50%, #3cb88d 100%);
        }
        .admin-pagehead h1 em {
          font-style: italic;
          color: #9d3f86;
        }
        html.dark .admin-pagehead h1 em { color: #c9a2bd; }
      `}</style>
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
          <span className="admin-pagehead__rule" aria-hidden="true" />
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
            Buen día, <em>{firstName}</em>.
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
