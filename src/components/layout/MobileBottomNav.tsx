import React, { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
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

interface MobileBottomNavProps {
  tabs: NavTab[];
  activeTabId: TabId;
}

const ICON_MAP: Partial<Record<TabId, IconName>> = {
  inicio: "home",
  convocatorias: "search",
  aula: "book",
  informes: "upload",
  practicas: "bag",
  solicitudes: "file",
  profile: "user",
};

/**
 * Barra inferior — dirección editorial (Gamma · StuTabBar).
 * Glass sutil, pill teal deslizante (framer-motion layoutId) en el activo,
 * feedback de presión + háptica. Tokens vía scope `.ed`.
 */
const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ tabs, activeTabId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();

  const handleNavigate = useCallback(
    (tab: NavTab) => {
      if (location.pathname !== tab.path) {
        haptics.tap();
        navigate(tab.path);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [navigate, location.pathname]
  );

  return (
    <nav
      aria-label="Navegación principal"
      className="ed md:hidden fixed bottom-0 left-0 right-0 z-50"
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          gap: 4,
          padding: "10px 8px 6px",
        }}
      >
        {tabs.map((tab) => {
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
                color: on ? "var(--accent)" : "var(--ink-subtle)",
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
      </div>
    </nav>
  );
};

export default MobileBottomNav;
