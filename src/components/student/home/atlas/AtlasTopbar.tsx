import React, { useEffect, useRef, useState } from "react";
import "./atlasHome.css";
import { useAuth } from "../../../../contexts/AuthContext";
import { useTheme } from "../../../../contexts/ThemeContext";
import { isEmbedded } from "../../../../utils/isEmbedded";
import type { TabId } from "../../../../types";

interface AtlasTopbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const PRIMARY_NAV: { id: TabId; label: string }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "entregas", label: "Entregas" },
  { id: "practicas", label: "Prácticas" },
  { id: "solicitudes", label: "Solicitudes" },
];

const RESOURCE_NAV: { id: TabId; label: string; icon: string }[] = [
  { id: "guia", label: "Guía 2026", icon: "menu_book" },
  { id: "descargas", label: "Descargas", icon: "download" },
  { id: "preguntas", label: "Preguntas frecuentes", icon: "help_outline" },
];

const AtlasTopbar: React.FC<AtlasTopbarProps> = ({ activeTab, onTabChange }) => {
  const { authenticatedUser, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [openMenu, setOpenMenu] = useState<"resources" | "account" | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);
  const initial = (authenticatedUser?.nombre || "").trim().charAt(0).toUpperCase() || "E";
  const firstName = authenticatedUser?.nombre?.trim().split(/\s+/)[0] || "Estudiante";
  const panelUrl = "https://pps-psico.github.io/#/student";

  const handleTabChange = (tab: TabId) => {
    setOpenMenu(null);
    if (tab !== activeTab) onTabChange(tab);
  };

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menusRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const [embedded] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  const [showOpenInNew] = useState(() => {
    try {
      const referrer = document.referrer.toLowerCase();
      const search = new URLSearchParams(window.location.search);
      return (
        embedded ||
        isEmbedded() ||
        referrer.includes("campus.uflo.edu.ar") ||
        search.has("embedded") ||
        search.get("from") === "campus"
      );
    } catch {
      return embedded;
    }
  });

  return (
    <div className="ah-root">
      <header className="ah-topbar">
        <div className="ah-topbar__inner" ref={menusRef}>
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
            {PRIMARY_NAV.map((n) => {
              const showLock = !authenticatedUser;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={
                    "ah-nav__item" +
                    (activeTab === n.id ? " active" : "") +
                    (showLock ? " is-locked" : "")
                  }
                  aria-current={activeTab === n.id ? "page" : undefined}
                  onClick={() => handleTabChange(n.id)}
                >
                  <span>{n.label}</span>
                  {showLock && (
                    <span className="material-icons ah-nav__lock" aria-hidden>
                      lock
                    </span>
                  )}
                </button>
              );
            })}

            <div className="ah-navmenu">
              <button
                type="button"
                className={
                  "ah-nav__item ah-nav__item--resources" +
                  (RESOURCE_NAV.some((item) => item.id === activeTab) ? " active" : "")
                }
                aria-haspopup="menu"
                aria-expanded={openMenu === "resources"}
                onClick={() =>
                  setOpenMenu((current) => (current === "resources" ? null : "resources"))
                }
              >
                Recursos
                <span className="material-icons ah-nav__chevron" aria-hidden>
                  expand_more
                </span>
              </button>
              {openMenu === "resources" && (
                <div className="ah-menu ah-menu--resources" role="menu">
                  <div className="ah-menu__label">Campus PPS</div>
                  {RESOURCE_NAV.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className={"ah-menu__item" + (activeTab === item.id ? " active" : "")}
                      onClick={() => handleTabChange(item.id)}
                    >
                      <span className="material-icons" aria-hidden>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ah-topbar__right">
            {showOpenInNew && (
              <a
                href={panelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ah-iconbtn"
                title="Abrir en pestaña nueva"
                aria-label="Abrir en pestaña nueva"
              >
                <span className="material-icons" style={{ fontSize: 19 }} aria-hidden>
                  open_in_new
                </span>
              </a>
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
            {authenticatedUser ? (
              <div className="ah-account">
                <button
                  type="button"
                  className="ah-account__trigger"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "account"}
                  onClick={() =>
                    setOpenMenu((current) => (current === "account" ? null : "account"))
                  }
                >
                  <span className="ah-avatar" aria-hidden>
                    {initial}
                  </span>
                  <span className="ah-account__name">{firstName}</span>
                  <span className="material-icons ah-account__chevron" aria-hidden>
                    expand_more
                  </span>
                </button>
                {openMenu === "account" && (
                  <div className="ah-menu ah-menu--account" role="menu">
                    <div className="ah-menu__account-name">{authenticatedUser.nombre}</div>
                    <div className="ah-menu__account-meta">Cuenta de estudiante</div>
                    <div className="ah-menu__divider" />
                    <button
                      type="button"
                      role="menuitem"
                      className={"ah-menu__item" + (activeTab === "profile" ? " active" : "")}
                      onClick={() => handleTabChange("profile")}
                    >
                      <span className="material-icons" aria-hidden>
                        person_outline
                      </span>
                      <span>Mi perfil</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ah-menu__item ah-menu__item--danger"
                      onClick={() => {
                        setOpenMenu(null);
                        logout();
                      }}
                    >
                      <span className="material-icons" aria-hidden>
                        logout
                      </span>
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="ah-loginbtn"
                onClick={() => handleTabChange("inicio")}
              >
                Ingresar
              </button>
            )}
          </div>
        </div>
      </header>
    </div>
  );
};

export default AtlasTopbar;
