// ──────────────────────────────────────────────────────────────────────────
// FichaSizeToggle — segmented control de 3 botones (colapsado / normal /
// expandido) para el panel derecho de Gestión.
//
// Tamaño compacto (~22px de alto) pensado para vivir en el header de la ficha.
// Se muestra "1|1|1" tipo icono expand/contract. Mantiene el estilo Paper &
// Ink del workspace (border, fondo paper-2, dots de color por estado).
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import type { FichaSize } from "../../../hooks/useFichaSize";

const SIZE_META: Record<FichaSize, { label: string; icon: string; tip: string }> = {
  collapsed: { label: "Colapsar ficha", icon: "right_panel_open", tip: "Colapsar" },
  normal: { label: "Tamaño normal", icon: "right_panel_close", tip: "Normal" },
  expanded: { label: "Expandir ficha", icon: "vertical_split", tip: "Expandido" },
};

export const FichaSizeToggle: React.FC<{
  size: FichaSize;
  onChange: (s: FichaSize) => void;
  /** Si el sistema está auto-ajustando (no hay override del usuario). */
  autoActive?: boolean;
  /** Tooltip opcional para el botón "reset" que aparece cuando hay override. */
  onReset?: () => void;
}> = ({ size, onChange, autoActive, onReset }) => {
  const order: FichaSize[] = ["collapsed", "normal", "expanded"];
  return (
    <div className="ficha-size-toggle" role="group" aria-label="Tamaño del panel derecho">
      {order.map((s) => {
        const m = SIZE_META[s];
        const active = size === s;
        return (
          <button
            key={s}
            type="button"
            className={`ficha-size-btn press ${active ? "active" : ""}`}
            onClick={() => onChange(s)}
            title={m.label}
            aria-label={m.label}
            aria-pressed={active}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              {m.icon}
            </span>
          </button>
        );
      })}
      {onReset && !autoActive && (
        <button
          type="button"
          className="ficha-size-reset press"
          onClick={onReset}
          title="Volver al tamaño automático"
          aria-label="Restablecer tamaño automático"
        >
          <span className="material-icons" style={{ fontSize: 12 }}>
            autorenew
          </span>
        </button>
      )}
    </div>
  );
};
