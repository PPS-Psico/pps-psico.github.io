import React from "react";

interface BriefingData {
  generadoAgo: string;
  lead: string;
  body: string[];
}

interface BriefingProps {
  data: BriefingData;
  totalChats: number;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

// Resalta cifras y cantidades (ej. "10 solicitudes", "3 novedades", "144 hs")
// con el efecto marcador del Inicio del estudiante. Solo toca nodos de texto,
// nunca el interior de etiquetas, para no romper el HTML que llega de Hermes.
const FIGURE_RX =
  /\d[\d.]*\s*(?:%|hs\b|h\b)?(?:\s(?:solicitudes?|convocatorias?|novedades?|mails?|chats?|instituciones?|d[ií]as?|borradores?|lanzamientos?|alumnos?|pendientes?))?/gi;

const highlightFigures = (html: string): string =>
  html
    .split(/(<[^>]+>)/g)
    .map((seg) =>
      seg.startsWith("<")
        ? seg
        : seg.replace(FIGURE_RX, (m) => `<mark class="brief-hl">${m.trim()}</mark>`)
    )
    .join("");

export const Briefing: React.FC<BriefingProps> = ({
  data,
  totalChats,
  onReanalyze,
  isReanalyzing,
}) => {
  return (
    <section className="admin-brief" style={{ padding: "32px 0 8px" }}>
      <style>{`
        @keyframes hermes-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .admin-brief .brief-hl {
          background-image: linear-gradient(
            100deg,
            transparent 0.4%,
            color-mix(in oklab, #3cb88d 22%, transparent) 2%,
            color-mix(in oklab, #3cb88d 22%, transparent) 97%,
            transparent 99.6%
          );
          background-repeat: no-repeat;
          background-size: 100% 56%;
          background-position: 0 64%;
          padding: 0 0.12em;
          border-radius: 0.08em;
          font-style: normal;
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
        }
        html.dark .admin-brief .brief-hl {
          background-image: linear-gradient(
            100deg,
            transparent 0.4%,
            color-mix(in oklab, #3cb88d 34%, transparent) 2%,
            color-mix(in oklab, #3cb88d 34%, transparent) 97%,
            transparent 99.6%
          );
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span className="material-icons" style={{ fontSize: 17, color: "var(--ai)" }}>
            auto_awesome
          </span>
          <span className="eyebrow" style={{ color: "var(--ai)" }}>
            Briefing de Hermes
          </span>
          <span className="meta" style={{ fontSize: 11 }}>
            · {data.generadoAgo}
          </span>
        </div>

        {onReanalyze && (
          <button
            onClick={onReanalyze}
            disabled={isReanalyzing}
            className="btn btn-ai btn-sm press"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 10px",
              cursor: isReanalyzing ? "not-allowed" : "pointer",
              opacity: isReanalyzing ? 0.7 : 1,
            }}
          >
            <span
              className="material-icons"
              style={{
                fontSize: 14,
                animation: isReanalyzing ? "hermes-spin 1.2s linear infinite" : "none",
              }}
            >
              {isReanalyzing ? "progress_activity" : "sync"}
            </span>
            {isReanalyzing ? "Reanalizando..." : "Reanalizar todo"}
          </button>
        )}
      </div>

      <div
        className="serif"
        style={{
          fontSize: 27,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.32,
          color: "var(--ink)",
          maxWidth: 760,
          textWrap: "pretty",
        }}
        dangerouslySetInnerHTML={{ __html: highlightFigures(data.lead) }}
      />

      <div
        style={{
          marginTop: 20,
          maxWidth: 680,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {data.body.map((p, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--ink-2)",
              textWrap: "pretty",
            }}
            dangerouslySetInnerHTML={{ __html: highlightFigures(p) }}
          />
        ))}
      </div>

      {/* Privacy line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 22,
          fontSize: 11.5,
          color: "var(--ink-3)",
        }}
      >
        <span className="material-icons" style={{ fontSize: 14, color: "var(--ai)" }}>
          shield
        </span>
        Hermes lee {totalChats} chats de tu lista "Instituciones" y la casilla de mail. Nada
        personal entra al sistema.
      </div>
    </section>
  );
};
