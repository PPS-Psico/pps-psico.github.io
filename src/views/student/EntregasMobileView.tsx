import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "../../components/student/ds";
import { useTheme } from "../../contexts/ThemeContext";
import { haptics } from "../../utils/haptics";
import { MOODLE_ASSIGN, useAulaEntregas } from "../../hooks/useAulaEntregas";

/* ─────────────────────────────────────────────────────────────────────────────
   Entregas · vista MOBILE-FIRST (no es la versión PC responsive).
   Pensada para una sola tarea: subir el informe desde el celular.
   - Chips de área con scroll horizontal (pulgar, sin grids).
   - Filas táctiles de 64px que abren la tarea de Moodle en pestaña nueva.
   Tokens del scope `.ed` (los mismos del resto del panel mobile).
   ──────────────────────────────────────────────────────────────────────────── */

const EntregasMobileView: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { areas } = useAulaEntregas();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);

  const selectedArea = useMemo(
    () => areas.find((a) => a.id === activeAreaId) ?? areas[0],
    [areas, activeAreaId]
  );

  return (
    <div className="ed" data-mode={resolvedTheme} data-accent="teal" style={{ paddingBottom: 8 }}>
      {/* Cabecera */}
      <header style={{ padding: "4px 4px 18px" }}>
        <span
          style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--ink-muted)",
            fontWeight: 500,
          }}
        >
          Aula · Moodle
        </span>
        <h1
          style={{
            margin: "6px 0 0",
            fontFamily: '"Bricolage Grotesque", "Geist", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 34,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            color: "var(--ink)",
          }}
        >
          Entregá <em style={{ fontStyle: "normal", color: "var(--accent)" }}>tu informe.</em>
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 14.5,
            lineHeight: 1.5,
            color: "var(--ink-muted)",
            maxWidth: "40ch",
          }}
        >
          Elegí tu área y la institución donde cursaste. La tarea de Moodle se abre en una pestaña
          nueva.
        </p>
      </header>

      {/* Chips de área — scroll horizontal, targets de pulgar */}
      <div
        role="tablist"
        aria-label="Áreas de entrega"
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          padding: "2px 4px 12px",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {areas.map((area) => {
          const on = area.id === selectedArea.id;
          return (
            <motion.button
              key={area.id}
              type="button"
              role="tab"
              aria-selected={on}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                haptics.tap();
                setActiveAreaId(area.id);
              }}
              style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minHeight: 44,
                padding: "0 16px",
                borderRadius: 999,
                border: `1.5px solid ${on ? area.color : "var(--line, var(--hairline))"}`,
                background: on
                  ? `color-mix(in oklab, ${area.color} 12%, var(--bg-elevated))`
                  : "var(--bg-elevated)",
                color: "var(--ink)",
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                fontWeight: on ? 700 : 500,
                whiteSpace: "nowrap",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: area.color,
                  boxShadow: on
                    ? `0 0 0 3px color-mix(in oklab, ${area.color} 20%, transparent)`
                    : "none",
                }}
              />
              {area.name}
              <span style={{ color: "var(--ink-subtle)", fontWeight: 500, fontSize: 12 }}>
                {area.institutions.length}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Lista de instituciones — filas táctiles */}
      <div
        style={{
          border: "1px solid var(--line, var(--hairline))",
          borderRadius: 18,
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        {selectedArea.institutions.map((institution, idx) => (
          <motion.a
            key={institution.moodleId}
            href={`${MOODLE_ASSIGN}${institution.moodleId}`}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.985 }}
            onClick={() => haptics.tap()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              minHeight: 64,
              padding: "12px 16px",
              borderTop: idx === 0 ? "none" : "1px solid var(--line, var(--hairline))",
              textDecoration: "none",
              color: "var(--ink)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              aria-hidden
              style={{
                flex: "0 0 auto",
                width: 40,
                height: 40,
                display: "grid",
                placeItems: "center",
                borderRadius: 13,
                background: `color-mix(in oklab, ${selectedArea.color} 12%, var(--bg-elevated))`,
                color: selectedArea.color,
              }}
            >
              <Icon name="upload" size={18} />
            </span>
            <span style={{ minWidth: 0, flex: "1 1 auto" }}>
              <strong
                style={{
                  display: "block",
                  fontFamily: "var(--font-sans)",
                  fontSize: 15.5,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                {institution.name}
              </strong>
              <small
                style={{
                  display: "block",
                  marginTop: 3,
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                }}
              >
                Tarea de Moodle · pestaña nueva
              </small>
            </span>
            <span aria-hidden style={{ color: "var(--ink-subtle)", flex: "0 0 auto" }}>
              <Icon name="arrow" size={17} />
            </span>
          </motion.a>
        ))}
      </div>

      {/* Recordatorio de plazo */}
      <p
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "14px 4px 0",
          fontSize: 12.5,
          lineHeight: 1.45,
          color: "var(--ink-muted)",
        }}
      >
        <Icon name="clock" size={14} />
        Tenés 30 días corridos desde que termina la PPS para entregar el informe.
      </p>
    </div>
  );
};

export default EntregasMobileView;
