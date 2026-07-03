import React, { useState } from "react";
import "./atlasHome.css";
import { useAuth } from "../../../../contexts/AuthContext";
import { useTheme } from "../../../../contexts/ThemeContext";
import type { TabId } from "../../../../types";

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => { finished?: Promise<void> };
};

interface AtlasTopbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

// Convocatorias no es un ítem: las abiertas ya viven en Inicio.
const NAV: { id: TabId; label: string }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "aula", label: "Aula" },
  { id: "solicitudes", label: "Solicitudes" },
  { id: "practicas", label: "Prácticas" },
  { id: "profile", label: "Perfil" },
];

const AtlasTopbar: React.FC<AtlasTopbarProps> = ({ activeTab, onTabChange }) => {
  const { authenticatedUser, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const initial = (authenticatedUser?.nombre || "E").trim().charAt(0).toUpperCase() || "E";

  const runPanelTransition = (update: () => void) => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const startViewTransition = (document as ViewTransitionDocument).startViewTransition;

    if (prefersReducedMotion || typeof startViewTransition !== "function") {
      update();
      return;
    }

    startViewTransition.call(document, update);
  };

  const handleTabChange = (tab: TabId) => {
    if (tab === activeTab) return;
    runPanelTransition(() => onTabChange(tab));
  };

  // Embebido en el campus: mostramos los accesos "Volver al campus" y
  // "Pantalla completa" dentro de esta misma barra (no como franja aparte).
  const [embedded] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  return (
    <div className="ah-root">
      <header className="ah-topbar">
        <div className="ah-topbar__inner">
          <div className="ah-topbar__brand">
            <div className="ah-topbar__mark" aria-hidden>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div>
              <div className="ah-topbar__name">Mi Panel</div>
              <div className="ah-topbar__sub">PPS · Psicología</div>
            </div>
          </div>

          <nav className="ah-nav" aria-label="Secciones del panel">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                className={"ah-nav__item" + (activeTab === n.id ? " active" : "")}
                aria-current={activeTab === n.id ? "page" : undefined}
                onClick={() => handleTabChange(n.id)}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="ah-topbar__right">
            {embedded && (
              <>
                <button
                  type="button"
                  className="ah-iconbtn"
                  onClick={() => window.open(window.location.href, "_blank", "noopener")}
                  title="Abrir en pantalla completa"
                  aria-label="Abrir en pantalla completa"
                >
                  <span className="material-icons" style={{ fontSize: 19 }} aria-hidden>
                    open_in_full
                  </span>
                </button>
              </>
            )}
            <button
              type="button"
              className="ah-iconbtn"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title="Cambiar tema"
              aria-label="Cambiar tema"
            >
              <span className="material-icons" style={{ fontSize: 19 }} aria-hidden>
                {resolvedTheme === "dark" ? "light_mode" : "dark_mode"}
              </span>
            </button>
            <button
              type="button"
              className="ah-iconbtn"
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <span className="material-icons" style={{ fontSize: 19 }} aria-hidden>
                logout
              </span>
            </button>
            <div className="ah-avatar" aria-hidden>
              {initial}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};

export default AtlasTopbar;
