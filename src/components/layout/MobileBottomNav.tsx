import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { TabId } from "../../types";
import { useTheme } from "../../contexts/ThemeContext";
import { Icon, type IconName } from "../student/ds";
import { haptics } from "../../utils/haptics";

interface NavTab {
  id: TabId;
  label: string;
  icon?: string;
  path: string;
}

interface MoreTab extends NavTab {
  description: string;
  group: "resource" | "account";
}

interface MobileBottomNavProps {
  tabs: NavTab[];
  activeTabId: TabId;
  onTabChange?: (tabId: TabId) => void;
}

const ICON_MAP: Partial<Record<TabId, IconName>> = {
  inicio: "home",
  entregas: "upload",
  practicas: "bag",
  solicitudes: "file",
  descargas: "download",
  preguntas: "help",
  profile: "user",
};

const MORE_TABS: MoreTab[] = [
  {
    id: "guia",
    label: "Guía 2026",
    description: "El recorrido completo de tu PPS",
    group: "resource",
    icon: "book",
    path: "/student/guia",
  },
  {
    id: "descargas",
    label: "Descargas",
    description: "Planillas, modelos y documentos",
    group: "resource",
    icon: "download",
    path: "/student/descargas",
  },
  {
    id: "preguntas",
    label: "Preguntas frecuentes",
    description: "Respuestas rápidas sobre la cursada",
    group: "resource",
    icon: "help",
    path: "/student/preguntas",
  },
  {
    id: "profile",
    label: "Mi perfil",
    description: "Datos personales y orientación",
    group: "account",
    icon: "user",
    path: "/student/perfil",
  },
];

/**
 * Barra inferior — dirección editorial (Gamma · StuTabBar).
 * Glass sutil, pill teal deslizante (framer-motion layoutId) en el activo,
 * feedback de presión + háptica. Tokens vía scope `.ed`.
 */
const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ tabs, activeTabId, onTabChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const mainTabs = useMemo(() => tabs.filter((tab) => tab.id !== "profile"), [tabs]);
  const isMoreActive = MORE_TABS.some((tab) => tab.id === activeTabId);

  const handleNavigate = useCallback(
    (tab: NavTab) => {
      setIsMoreOpen(false);
      if (onTabChange) {
        haptics.tap();
        onTabChange(tab.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (location.pathname !== tab.path) {
        haptics.tap();
        navigate(tab.path);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [navigate, location.pathname, onTabChange]
  );

  useEffect(() => setIsMoreOpen(false), [location.pathname]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMoreOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMoreOpen]);

  return (
    <nav
      aria-label="Navegación principal"
      className="ed student-mobile-nav fixed bottom-0 left-0 right-0 z-50"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{
        background: "color-mix(in oklab, var(--bg-elevated) 92%, transparent)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        borderTop: "1px solid var(--hairline)",
        paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
      }}
    >
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar menú"
              className="student-more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setIsMoreOpen(false)}
            />
            <motion.div
              id="student-more-menu"
              role="menu"
              aria-label="Recursos y cuenta"
              className="student-more-sheet"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="student-more-sheet__head">
                <div>
                  <strong>Recursos</strong>
                  <span>Guía, documentos y respuestas del Campus PPS.</span>
                </div>
                <button
                  type="button"
                  className="student-more-sheet__close"
                  aria-label="Cerrar menú"
                  onClick={() => setIsMoreOpen(false)}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
              <div className="student-more-sheet__list">
                {MORE_TABS.map((tab, index) => {
                  const on = tab.id === activeTabId;
                  const iconName = ICON_MAP[tab.id] ?? "book";
                  return (
                    <React.Fragment key={tab.id}>
                      {tab.group === "account" && index > 0 ? (
                        <div className="student-more-sheet__divider" role="separator" />
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        className={
                          "student-more-sheet__item" +
                          (tab.group === "account" ? " is-account" : "") +
                          (on ? " is-active" : "")
                        }
                        onClick={() => handleNavigate(tab)}
                      >
                        <span className="student-more-sheet__icon" aria-hidden>
                          <Icon name={iconName} size={19} />
                        </span>
                        <span className="student-more-sheet__copy">
                          <strong>{tab.label}</strong>
                          <small>{tab.description}</small>
                        </span>
                        <Icon name="chev" size={15} />
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div
        className="student-mobile-nav__grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${mainTabs.length + 1}, 1fr)`,
          gap: 4,
          padding: "10px 8px 6px",
        }}
      >
        {mainTabs.map((tab) => {
          const on = tab.id === activeTabId;
          const iconName = ICON_MAP[tab.id] ?? "home";
          return (
            <motion.button
              key={tab.id}
              onClick={() => handleNavigate(tab)}
              aria-current={on ? "page" : undefined}
              className={"tab" + (on ? " on" : "")}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                background: "transparent",
                border: 0,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 10.5,
                fontWeight: 500,
                letterSpacing: ".01em",
                /* ink-muted y no ink-subtle: a 10.5px las etiquetas inactivas
                   quedaban por debajo de AA (≈4:1 en dark). */
                color: on ? "var(--accent-text)" : "var(--ink-muted)",
                transition: "color var(--t-fast)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div
                className="tab__icon"
                aria-hidden="true"
                style={{ position: "relative", background: "transparent" }}
              >
                {on && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 999,
                      background: "var(--tint)",
                      zIndex: 0,
                    }}
                  />
                )}
                <span
                  style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center" }}
                >
                  <Icon name={iconName} size={20} strokeWidth={on ? 2.1 : 1.8} />
                </span>
              </div>
              <span>{tab.label}</span>
            </motion.button>
          );
        })}
        <motion.button
          type="button"
          aria-haspopup="menu"
          aria-controls="student-more-menu"
          aria-expanded={isMoreOpen}
          aria-current={isMoreActive ? "page" : undefined}
          className={"tab" + (isMoreActive || isMoreOpen ? " on" : "")}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          onClick={() => {
            haptics.tap();
            setIsMoreOpen((current) => !current);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            background: "transparent",
            border: 0,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: ".01em",
            color: isMoreActive || isMoreOpen ? "var(--accent-text)" : "var(--ink-muted)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span className="tab__icon" aria-hidden style={{ position: "relative" }}>
            {(isMoreActive || isMoreOpen) && (
              <motion.span
                layoutId="nav-pill"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background: "var(--tint)",
                }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1, display: "grid" }}>
              <Icon name="settings" size={20} strokeWidth={isMoreActive ? 2.1 : 1.8} />
            </span>
          </span>
          <span>Más</span>
        </motion.button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
