import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import MiPanelLogo from "../MiPanelLogo";
import { useAuth } from "../../contexts/AuthContext";
import ThemeToggle from "./ThemeToggle";
import { useTheme } from "../../contexts/ThemeContext";
import { usePwaInstall } from "../../contexts/PwaInstallContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { formatDate } from "../../utils/formatters";
import { isEmbedded } from "../../utils/isEmbedded";

const NotificationDropdown: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } =
    useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (notifications.length === 0) {
    return (
      <div
        ref={dropdownRef}
        className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 text-center z-[1000] animate-fade-in-up"
      >
        <div className="mx-auto bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-full h-12 w-12 flex items-center justify-center mb-3">
          <span className="material-icons !text-2xl">notifications_none</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 font-medium text-sm">
          No tienes notificaciones nuevas.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[1000] overflow-hidden animate-fade-in-up"
    >
      <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Notificaciones</h3>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Marcar todo leído
            </button>
          )}
          <button
            onClick={clearNotifications}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Limpiar
          </button>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            onClick={() => {
              markAsRead(notif.id);
              onClose();
            }}
            className={`p-4 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${!notif.isRead ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
          >
            <div className="flex gap-3">
              <div
                className={`flex-shrink-0 mt-1 ${
                  notif.type === "solicitud_pps"
                    ? "text-blue-500"
                    : notif.type === "acreditacion"
                      ? "text-emerald-500"
                      : notif.type === "recordatorio"
                        ? "text-amber-500"
                        : "text-slate-500"
                }`}
              >
                <span className="material-icons !text-xl">
                  {notif.type === "solicitud_pps"
                    ? "assignment_ind"
                    : notif.type === "acreditacion"
                      ? "verified"
                      : notif.type === "recordatorio"
                        ? "alarm"
                        : "info"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p
                    className={`text-sm font-bold ${!notif.isRead ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {notif.title}
                  </p>
                  {!notif.isRead && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>
                  )}
                </div>
                <p
                  className={`text-xs mt-1 line-clamp-2 ${!notif.isRead ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-500"}`}
                >
                  {notif.message}
                </p>
                <p className="text-[10px] text-slate-400 mt-2">
                  {formatDate(notif.timestamp.toISOString())}{" "}
                  {notif.timestamp.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AppHeader: React.FC = () => {
  const { authenticatedUser, logout, isSuperUserMode, isJefeMode, isDirectivoMode } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { canInstall, triggerInstall } = usePwaInstall();
  const isLoggedIn = !!authenticatedUser;
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Rutas que deben ocupar todo el ancho de la pantalla
  const fullWidthRoutes = ["/admin", "/jefe", "/directivo", "/reportero", "/testing"];
  const isFullWidth = fullWidthRoutes.some((route) => location.pathname.startsWith(route));

  // Mostrar notificaciones solo a roles admin/gestión
  const showNotifications = isLoggedIn && (isSuperUserMode || isJefeMode || isDirectivoMode);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Border effect (always)
          setHasScrolled(currentScrollY > 10);

          // Smart header visibility (mobile only - hide when scrolling down, show when up)
          if (window.innerWidth < 768) {
            if (currentScrollY < 50) {
              setIsHeaderVisible(true);
            } else if (currentScrollY > lastScrollY.current) {
              // Scrolling down
              setIsHeaderVisible(false);
            } else {
              // Scrolling up
              setIsHeaderVisible(true);
            }
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Header editorial (dirección Gamma) para la vista estudiante.
  const isStudent = location.pathname.startsWith("/student");
  if (isStudent && isLoggedIn) {
    return (
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isHeaderVisible ? 0 : -80 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="ed no-print fixed md:sticky top-0 left-0 right-0 z-50 transition duration-300"
        data-mode={resolvedTheme}
        data-accent="teal"
        style={{
          background: "color-mix(in oklab, var(--bg) 88%, transparent)",
          backdropFilter: "blur(16px) saturate(140%)",
          WebkitBackdropFilter: "blur(16px) saturate(140%)",
          borderBottom: hasScrolled ? "1px solid var(--hairline)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <div className="mp-mark">
              <div className="mp-logo">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <rect x="3" y="10" width="4" height="11" rx="1.5" fill="currentColor" />
                  <rect x="10" y="4" width="4" height="17" rx="1.5" fill="currentColor" />
                  <rect x="17" y="14" width="4" height="7" rx="1.5" fill="currentColor" />
                </svg>
              </div>
              <span className="mp-brand">
                Mi&nbsp;<b>Panel</b>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="mp-iconbtn"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label="Cambiar tema"
                title="Cambiar tema"
              >
                <span className="material-icons" style={{ fontSize: 19 }} aria-hidden="true">
                  {resolvedTheme === "dark" ? "light_mode" : "dark_mode"}
                </span>
              </button>
              <button
                type="button"
                className="mp-iconbtn"
                onClick={logout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <span className="material-icons" style={{ fontSize: 19 }} aria-hidden="true">
                  logout
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.header>
    );
  }

  return (
    <motion.header
      initial={{ y: 0 }}
      animate={{ y: isHeaderVisible ? 0 : -80 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`no-print fixed md:sticky top-0 left-0 right-0 z-50 bg-white dark:bg-gray-950/80 backdrop-blur-xl transition duration-300 ${hasScrolled ? "border-b border-slate-200/70 dark:border-white/10 shadow-sm" : "border-b border-transparent"}`}
    >
      <div className={`px-4 sm:px-6 lg:px-8 ${isFullWidth ? "w-full" : "max-w-7xl mx-auto"}`}>
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Left side */}
          <div className="flex-shrink-0">
            <MiPanelLogo
              className="h-10 md:h-14 w-auto transition duration-300"
              variant={resolvedTheme}
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-4">
            {isSuperUserMode && (
              <span className="hidden sm:inline-flex items-center bg-blue-100 text-blue-800 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full border border-blue-200/80 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800">
                Modo Administrador
              </span>
            )}
            {/* Notifications Bell */}
            {showNotifications && (
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 p-2.5 rounded-full transition duration-200 shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-center group"
                  aria-label="Notificaciones"
                >
                  <span
                    className={`material-icons !text-xl sm:!text-2xl transition-transform duration-300 ease-out ${isNotifOpen ? "text-blue-600 dark:text-blue-400" : ""} group-hover:scale-110`}
                  >
                    {unreadCount > 0 ? "notifications_active" : "notifications"}
                  </span>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-4 w-4 -mt-1 -mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[10px] font-bold items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    </span>
                  )}
                </button>
                {isNotifOpen && <NotificationDropdown onClose={() => setIsNotifOpen(false)} />}
              </div>
            )}

            <ThemeToggle />

            {isEmbedded() && (
              <a
                href="https://pps-psico.github.io"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 p-2.5 rounded-full transition duration-200 shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-center"
                aria-label="Abrir en pestaña nueva"
                title="Abrir en pestaña nueva"
              >
                <span className="material-icons !text-xl sm:!text-2xl">open_in_new</span>
              </a>
            )}

            {canInstall && (
              <button
                onClick={triggerInstall}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold p-2.5 rounded-full transition duration-200 shadow-md border border-blue-700 flex items-center justify-center group animate-pulse"
                aria-label="Instalar aplicación"
                title="Instalar aplicación"
              >
                <span className="material-icons !text-xl sm:!text-2xl transition-transform duration-300 ease-out group-hover:scale-110">
                  install_mobile
                </span>
              </button>
            )}

            {isLoggedIn && (
              <button
                onClick={logout}
                className="bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/50 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-semibold p-2.5 rounded-full transition duration-200 shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-center"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <span className="material-icons !text-xl sm:!text-2xl">logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default AppHeader;
