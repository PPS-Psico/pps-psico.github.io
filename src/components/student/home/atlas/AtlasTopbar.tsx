import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const resourcesTriggerRef = useRef<HTMLButtonElement>(null);
  const resourcesMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const initial = (authenticatedUser?.nombre || "").trim().charAt(0).toUpperCase() || "E";
  const firstName = authenticatedUser?.nombre?.trim().split(/\s+/)[0] || "Estudiante";
  const panelUrl = "https://pps-psico.github.io/#/student";

  const restoreMenuTriggerFocus = useCallback((menu: "resources" | "account") => {
    const trigger = menu === "resources" ? resourcesTriggerRef.current : accountTriggerRef.current;
    requestAnimationFrame(() => trigger?.focus());
  }, []);

  const handleTabChange = (tab: TabId) => {
    const menuToRestore = openMenu;
    setOpenMenu(null);
    if (tab !== activeTab) onTabChange(tab);
    if (menuToRestore) restoreMenuTriggerFocus(menuToRestore);
  };

  const handleMenuKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    menu: "resources" | "account"
  ) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    );
    const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpenMenu(null);
      restoreMenuTriggerFocus(menu);
      return;
    }
    if (event.key === "Tab") {
      setOpenMenu(null);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || items.length === 0) {
      return;
    }

    event.preventDefault();
    if (event.key === "Home") items[0]?.focus();
    else if (event.key === "End") items[items.length - 1]?.focus();
    else if (event.key === "ArrowDown") items[(activeIndex + 1) % items.length]?.focus();
    else items[(activeIndex - 1 + items.length) % items.length]?.focus();
  };

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menusRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openMenu) {
        setOpenMenu(null);
        restoreMenuTriggerFocus(openMenu);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu, restoreMenuTriggerFocus]);

  useEffect(() => {
    if (!openMenu) return;
    const menu = openMenu === "resources" ? resourcesMenuRef.current : accountMenuRef.current;
    requestAnimationFrame(() =>
      menu?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    );
  }, [openMenu]);

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
                ref={resourcesTriggerRef}
                type="button"
                className={
                  "ah-nav__item ah-nav__item--resources" +
                  (RESOURCE_NAV.some((item) => item.id === activeTab) ? " active" : "")
                }
                aria-haspopup="menu"
                aria-expanded={openMenu === "resources"}
                aria-controls="atlas-resources-menu"
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
                <div
                  ref={resourcesMenuRef}
                  id="atlas-resources-menu"
                  className="ah-menu ah-menu--resources"
                  role="menu"
                  tabIndex={-1}
                  onKeyDown={(event) => handleMenuKeyDown(event, "resources")}
                >
                  <div className="ah-menu__label" role="presentation">
                    Campus PPS
                  </div>
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
                  ref={accountTriggerRef}
                  type="button"
                  className="ah-account__trigger"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "account"}
                  aria-controls="atlas-account-menu"
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
                  <div
                    ref={accountMenuRef}
                    id="atlas-account-menu"
                    className="ah-menu ah-menu--account"
                    role="menu"
                    tabIndex={-1}
                    onKeyDown={(event) => handleMenuKeyDown(event, "account")}
                  >
                    <div className="ah-menu__account-name" role="presentation">
                      {authenticatedUser.nombre}
                    </div>
                    <div className="ah-menu__account-meta" role="presentation">
                      Cuenta de estudiante
                    </div>
                    <div className="ah-menu__divider" role="separator" />
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
