import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "../../components/student/ds";
import { useTheme } from "../../contexts/ThemeContext";
import { haptics } from "../../utils/haptics";
import { MOODLE_ASSIGN, useAulaEntregas } from "../../hooks/useAulaEntregas";

const EntregasMobileView: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { areas } = useAulaEntregas();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const selectedArea = useMemo(
    () => areas.find((area) => area.id === activeAreaId) ?? areas[0],
    [activeAreaId, areas]
  );
  const handleAreaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % areas.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + areas.length) % areas.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = areas.length - 1;
      else return;

      event.preventDefault();
      const nextArea = areas[nextIndex];
      setActiveAreaId(nextArea.id);
      document.getElementById(`delivery-mobile-tab-${nextArea.id}`)?.focus();
    },
    [areas]
  );

  return (
    <div className="ed" data-mode={resolvedTheme} data-accent="teal" style={{ paddingBottom: 8 }}>
      <header style={{ padding: "0 4px 18px" }}>
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
          Entregas de{" "}
          <em style={{ fontStyle: "normal", color: "var(--accent-text)" }}>informes.</em>
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
          Elegí tu orientación y abrí la tarea de la institución donde cursaste. Subí la planilla
          firmada y el informe final.
        </p>
      </header>

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
        {areas.map((area, index) => {
          const on = area.id === selectedArea.id;
          return (
            <motion.button
              key={area.id}
              type="button"
              role="tab"
              id={`delivery-mobile-tab-${area.id}`}
              aria-selected={on}
              aria-controls="delivery-mobile-panel"
              tabIndex={on ? 0 : -1}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                haptics.tap();
                setActiveAreaId(area.id);
              }}
              onKeyDown={(event) => handleAreaKeyDown(event, index)}
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

      <div
        id="delivery-mobile-panel"
        role="tabpanel"
        aria-labelledby={`delivery-mobile-tab-${selectedArea.id}`}
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
              <small className="delivery-mobile-open">Abrir entrega</small>
            </span>
          </motion.a>
        ))}
      </div>

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
