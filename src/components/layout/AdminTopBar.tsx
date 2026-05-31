/**
 * AdminTopBar — Barra superior unificada del panel admin en el sistema visual
 * Paper & Ink (v3). Reemplaza la pila de dos barras anterior (AppHeader legacy
 * + cápsula de tabs) por una sola barra full-width: wordmark a la izquierda,
 * navegación centrada y controles a la derecha (notificaciones, tema, salir).
 */
import { motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { useTheme } from "../../contexts/ThemeContext";
import { formatDate } from "../../utils/formatters";
import { type TabItem } from "../UnifiedTabs";
import { injectScopedStyles } from "../../utils/injectScopedStyles";

const CSS = `
.admin-topbar {
  position: sticky; top: 0; z-index: 45;
  background: color-mix(in oklab, var(--paper) 90%, transparent);
  backdrop-filter: blur(10px) saturate(1.08);
  -webkit-backdrop-filter: blur(10px) saturate(1.08);
  border-bottom: 1px solid var(--rule-2);
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
}
.admin-topbar-inner {
  display: flex; align-items: center; gap: 20px;
  padding: 0 24px; height: 60px; width: 100%; min-width: 0;
}
.admin-topbar-brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.admin-topbar-glyph {
  width: 26px; height: 26px; border-radius: 7px;
  background: var(--ink); color: var(--paper);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; flex-shrink: 0;
}
.admin-topbar-word { display: flex; align-items: baseline; gap: 8px; }
.admin-topbar-word b { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink); white-space: nowrap; }
.admin-topbar-word span { font-size: 12px; color: var(--ink-3); white-space: nowrap; }
.admin-topbar-nav { flex: 1; display: flex; justify-content: center; min-width: 0; overflow-x: auto; }
.admin-topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* ── Flat v3 nav tabs (texto en tinta + subrayado activo) ── */
.admin-nav { display: flex; gap: 2px; align-items: stretch; }
.admin-nav-tab {
  position: relative;
  display: inline-flex; align-items: center; gap: 7px;
  border: none; background: transparent; cursor: pointer;
  font-family: inherit; font-size: 13.5px; font-weight: 500;
  color: var(--ink-3); padding: 0 13px; height: 60px;
  white-space: nowrap; transition: color .12s ease;
}
.admin-nav-tab:hover { color: var(--ink-2); }
.admin-nav-tab.active { color: var(--ink); font-weight: 600; }
.admin-nav-tab .material-icons { font-size: 17px; opacity: .75; }
.admin-nav-tab.active .material-icons { opacity: 1; }
.admin-nav-tab .admin-nav-underline {
  position: absolute; left: 11px; right: 11px; bottom: 0; height: 2px;
  background: var(--ink); border-radius: 2px 2px 0 0;
}
.admin-nav-badge {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600;
  padding: 1px 5px; border-radius: 4px;
  background: var(--warn-soft); color: var(--warn);
}
.admin-nav-close {
  display: inline-flex; align-items: center; justify-content: center;
  margin-left: 2px; padding: 2px; border-radius: 999px;
  color: var(--ink-4); transition: color .12s ease, background .12s ease;
}
.admin-nav-close:hover { color: var(--crit); background: var(--paper-2); }

.admin-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 600; letter-spacing: 0.01em;
  padding: 5px 11px; border-radius: 999px;
  background: var(--paper-2); color: var(--ink-3);
  border: 1px solid var(--rule-2);
  white-space: nowrap;
}
.admin-pill .material-icons { color: var(--ink-4); }
.admin-icon-btn {
  position: relative;
  width: 36px; height: 36px; border-radius: 999px;
  border: 1px solid var(--rule-2); background: var(--paper);
  color: var(--ink-3); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .12s ease, color .12s ease, border-color .12s ease;
}
.admin-icon-btn:hover { background: var(--paper-2); color: var(--ink); border-color: var(--rule-3); }
.admin-icon-btn.danger:hover { color: var(--crit); border-color: var(--crit); }
.admin-icon-btn .material-icons { font-size: 19px; }
.admin-topbar-divider { width: 1px; height: 18px; background: var(--rule-2); flex-shrink: 0; margin: 0 2px; }

.admin-notif-badge {
  position: absolute; top: -3px; right: -3px;
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  background: var(--crit); color: #fff;
  font-size: 9.5px; font-weight: 700; line-height: 16px;
  display: flex; align-items: center; justify-content: center;
}
.admin-notif-pop {
  position: absolute; right: 0; top: calc(100% + 8px);
  width: 340px; max-width: calc(100vw - 32px);
  background: var(--paper); color: var(--ink);
  border: 1px solid var(--rule-2); border-radius: 14px;
  box-shadow: 0 18px 48px rgba(0,0,0,0.18);
  overflow: hidden; z-index: 1000;
}
.admin-notif-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--rule-2);
}
.admin-notif-list { max-height: 380px; overflow-y: auto; }
.admin-notif-item {
  display: flex; gap: 10px; padding: 13px 16px;
  border-bottom: 1px solid var(--rule-2); cursor: pointer;
  transition: background .12s ease;
}
.admin-notif-item:last-child { border-bottom: none; }
.admin-notif-item:hover { background: var(--paper-2); }
.admin-notif-empty { padding: 28px 16px; text-align: center; color: var(--ink-3); }
.admin-link-btn {
  border: none; background: transparent; cursor: pointer;
  font-family: inherit; font-size: 11.5px; font-weight: 600; color: var(--accent);
}
.admin-link-btn.mute { color: var(--ink-3); }
.admin-link-btn:hover { text-decoration: underline; }

@media (max-width: 1100px) {
  .admin-topbar-word span { display: none; }
}
@media (max-width: 920px) {
  .admin-topbar-pill-label { display: none; }
}
`;

injectScopedStyles("admin-topbar-v3", CSS);

const NOTIF_ICON: Record<string, string> = {
  solicitud_pps: "assignment_ind",
  acreditacion: "verified",
  recordatorio: "alarm",
};

const NotificationsPopover: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } =
    useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="admin-notif-pop animate-fade-in-up">
      {notifications.length === 0 ? (
        <div className="admin-notif-empty">
          <span className="material-icons" style={{ fontSize: 28, opacity: 0.4 }}>
            notifications_none
          </span>
          <div style={{ fontSize: 13, marginTop: 6 }}>No tenés notificaciones nuevas.</div>
        </div>
      ) : (
        <>
          <div className="admin-notif-head">
            <span style={{ fontWeight: 700, fontSize: 13 }}>Notificaciones</span>
            <div style={{ display: "flex", gap: 12 }}>
              {unreadCount > 0 && (
                <button className="admin-link-btn" onClick={markAllAsRead}>
                  Marcar todo leído
                </button>
              )}
              <button className="admin-link-btn mute" onClick={clearNotifications}>
                Limpiar
              </button>
            </div>
          </div>
          <div className="admin-notif-list">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="admin-notif-item"
                onClick={() => {
                  markAsRead(notif.id);
                  onClose();
                }}
                style={{ background: !notif.isRead ? "var(--accent-soft)" : undefined }}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: 18, color: "var(--ink-3)", marginTop: 1 }}
                >
                  {NOTIF_ICON[notif.type] || "info"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      {notif.title}
                    </span>
                    {!notif.isRead && (
                      <span
                        className="dot"
                        style={{ background: "var(--accent)", marginTop: 5, flexShrink: 0 }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-3)",
                      marginTop: 3,
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {notif.message}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 5 }}
                  >
                    {formatDate(notif.timestamp.toISOString())}{" "}
                    {notif.timestamp.toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface AdminTopBarProps {
  navItems: TabItem[];
  currentTabId: string;
  onTabChange: (id: string, path?: string) => void;
  onTabClose?: (id: string, e: React.MouseEvent) => void;
}

const AdminTopBar: React.FC<AdminTopBarProps> = ({
  navItems,
  currentTabId,
  onTabChange,
  onTabClose,
}) => {
  const { logout, isSuperUserMode, isJefeMode, isDirectivoMode } = useAuth();
  const { theme, setTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const showNotifications = isSuperUserMode || isJefeMode || isDirectivoMode;

  return (
    <header className="admin-topbar no-print">
      <div className="admin-topbar-inner">
        {/* Brand */}
        <div className="admin-topbar-brand">
          <div className="admin-topbar-glyph">ψ</div>
          <div className="admin-topbar-word">
            <b>Mi Panel Académico</b>
            <span>PPS · UFLO Psicología</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="admin-topbar-nav no-scrollbar">
          <div className="admin-nav" role="tablist">
            {navItems.map((tab) => {
              const isActive = currentTabId === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`admin-nav-tab${isActive ? " active" : ""}`}
                  onClick={() => onTabChange(tab.id, tab.path)}
                >
                  {tab.icon && <span className="material-icons">{tab.icon}</span>}
                  {tab.label}
                  {tab.badge != null && <span className="admin-nav-badge">{tab.badge}</span>}
                  {onTabClose && isActive && tab.id === "student-profile" && (
                    <span
                      role="button"
                      className="admin-nav-close"
                      onClick={(e) => onTabClose(tab.id, e)}
                      aria-label="Cerrar"
                    >
                      <span className="material-icons" style={{ fontSize: 14 }}>
                        close
                      </span>
                    </span>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="admin-nav-underline"
                      className="admin-nav-underline"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Controls */}
        <div className="admin-topbar-right">
          {isSuperUserMode && (
            <span className="admin-pill">
              <span className="material-icons" style={{ fontSize: 14 }}>
                shield
              </span>
              <span className="admin-topbar-pill-label">Modo Administrador</span>
            </span>
          )}

          {showNotifications && (
            <div style={{ position: "relative" }}>
              <button
                className="admin-icon-btn"
                onClick={() => setIsNotifOpen((o) => !o)}
                aria-label="Notificaciones"
                title="Notificaciones"
              >
                <span className="material-icons">
                  {unreadCount > 0 ? "notifications_active" : "notifications"}
                </span>
                {unreadCount > 0 && (
                  <span className="admin-notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </button>
              {isNotifOpen && <NotificationsPopover onClose={() => setIsNotifOpen(false)} />}
            </div>
          )}

          <button
            className="admin-icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          >
            <span className="material-icons">{theme === "dark" ? "dark_mode" : "light_mode"}</span>
          </button>

          <div className="admin-topbar-divider" />

          <button
            className="admin-icon-btn danger"
            onClick={logout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <span className="material-icons">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminTopBar;
