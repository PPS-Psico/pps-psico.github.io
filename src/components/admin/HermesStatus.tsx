// ──────────────────────────────────────────────────────────────────────────
// HermesStatus — indicador de disponibilidad real + versión del build.
//
// Reemplaza los footers que tenían "Hermes online" y "v3.2 · build 2026.05.26"
// escritos a mano en cada vista (Inicio, Métricas, Taller) y el "Sincronizado"
// fijo del rail de Gestión. Ninguno comprobaba nada.
//
// El estado sale de `useHermesHealth` (sonda server-side) y la versión de
// package.json inyectada en build.
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import { useHermesHealth, type HermesHealthState } from "../../hooks/useHermesHealth";

/** Versión y fecha del build — fuente única, inyectadas por Vite. */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
export const BUILD_DATE = typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : "—";

const TONE_VAR: Record<HermesHealthState["tone"], string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger, #c0392b)",
  mute: "var(--ink-4)",
};

interface HermesStatusProps {
  /** Muestra `v3.2.0 · build YYYY-MM-DD` junto al estado. */
  showVersion?: boolean;
  className?: string;
}

/**
 * Punto de estado + etiqueta. El punto sólo pulsa (`dot-live`) cuando Hermes
 * está efectivamente online: un indicador quieto comunica "no confirmado".
 */
export const HermesStatus: React.FC<HermesStatusProps> = ({
  showVersion = false,
  className = "meta mono",
}) => {
  const health = useHermesHealth();
  const color = TONE_VAR[health.tone];

  const title = health.verificadoEn
    ? `Verificado ${new Date(health.verificadoEn).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })}${health.latenciaMs != null ? ` · ${health.latenciaMs} ms` : ""}`
    : "Comprobando disponibilidad de Hermes";

  return (
    <div className={className} style={{ display: "flex", gap: 16, alignItems: "center" }}>
      {showVersion && (
        <span>
          v{APP_VERSION} · build {BUILD_DATE}
        </span>
      )}
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        title={title}
        role="status"
        aria-live="polite"
      >
        <span
          className={health.estado === "online" ? "dot dot-live" : "dot"}
          style={{ color, background: color }}
        />
        {health.label}
      </span>
    </div>
  );
};

export default HermesStatus;
