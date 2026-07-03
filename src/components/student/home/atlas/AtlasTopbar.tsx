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

/* Barra unificada en dos bloques: primero la herramienta personal (datos
   vivos del alumno), después —tras un separador y en tono más suave— el
   material de consulta del campus (Guía, Descargas, Preguntas). */
const NAV: { id: TabId; label: string; campus?: boolean }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "entregas", label: "Entregas" },
  { id: "practicas", label: "Prácticas" },
  { id: "solicitudes", label: "Solicitudes" },
  { id: "profile", label: "Perfil" },
  { id: "guia", label: "Guía 2026", campus: true },
  { id: "descargas", label: "Descargas", campus: true },
  { id: "preguntas", label: "Preguntas", campus: true },
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

    /* Si el usuario cambia de pestaña antes de que termine la animación, el
       navegador aborta la transición y rechaza sus promesas ("Transition was
       aborted..."): las silenciamos para que no salte el modal global. */
    const transition = startViewTransition.call(document, update) as
      | {
          finished?: Promise<void>;
          ready?: Promise<void>;
          updateCallbackDone?: Promise<void>;
        }
      | undefined;
    transition?.finished?.catch(() => {});
    transition?.ready?.catch(() => {});
    transition?.updateCallbackDone?.catch(() => {});
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
            {NAV.map((n, idx) => {
              const isLocked = [
                "inicio",
                "entregas",
                "practicas",
                "solicitudes",
                "profile",
              ].includes(n.id);
              const showLock = isLocked && !authenticatedUser;
              const isFirstCampus = n.campus && !NAV[idx - 1]?.campus;
              return (
                <React.Fragment key={n.id}>
                  {isFirstCampus && <span className="ah-nav__sep" aria-hidden />}
                  <button
                    type="button"
                    className={
                      "ah-nav__item" +
                      (n.campus ? " ah-nav__item--campus" : "") +
                      (activeTab === n.id ? " active" : "") +
                      (showLock ? " opacity-60 cursor-pointer" : "")
                    }
                    aria-current={activeTab === n.id ? "page" : undefined}
                    onClick={() => handleTabChange(n.id)}
                  >
                    <span className="flex items-center gap-1.5">
                      {n.label}
                      {showLock && (
                        <span className="material-icons !text-xs text-slate-400">lock</span>
                      )}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
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
