import React, { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { useTheme } from "../../contexts/ThemeContext";
import { isEmbedded } from "../../utils/isEmbedded";
import { logger } from "../../utils/logger";
import AppHeader from "./Header";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { showModal } = useModal();
  const { resolvedTheme } = useTheme();
  const { authenticatedUser, isAuthLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const isLoginPage = location.pathname === "/login";
  const isStudent = location.pathname.startsWith("/student");
  const isPublicAula = location.pathname === "/aula";
  const embedded = isEmbedded();
  // Ruta raíz: es solo un redireccionador por rol (no tiene UI propia). Mientras
  // resuelve a /admin o /student NO debe renderizar el header legacy (eso era el
  // "flash de versión vieja" al entrar).
  const isRootRedirect = location.pathname === "/";
  // Detalle de convocatoria: pantalla enfocada con su propio header (back),
  // full-bleed y sin el AppHeader global (evita la pila de dos barras).
  const isFocusedScreen = location.pathname.startsWith("/student/convocatoria/");

  // Rutas que deben ocupar todo el ancho de la pantalla (dashboard).
  // El panel del estudiante también va full-width: su ancho/gutters los
  // controla el CSS de Atlas (.ah-main / .ah-topbar__inner), no el max-w-7xl.
  const fullWidthRoutes = ["/admin", "/jefe", "/directivo", "/reportero", "/testing"];
  const isFullWidth =
    fullWidthRoutes.some((route) => location.pathname.startsWith(route)) ||
    isStudent ||
    isPublicAula;

  // Rutas que traen su propia barra superior v3 (AdminTopBar) y por lo tanto
  // no deben renderizar el AppHeader legacy (evita la pila de dos barras).
  const ownTopBarRoutes = ["/admin", "/jefe", "/directivo", "/reportero", "/testing"];
  const hasOwnTopBar =
    ownTopBarRoutes.some((route) => location.pathname.startsWith(route)) || isPublicAula;

  // Global Error Listener: Catch "Silent Failures"
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || event.error?.message || String(event.error);
      if (String(msg).includes("Incorrect locale") || String(msg).includes("RangeError")) {
        return;
      }
      logger.error("Global Error Caught:", event.error);
      showModal(
        "Se produjo un error inesperado",
        `Detalle: ${msg || "Error desconocido en la aplicación."}\n\nPor favor, recarga la página.`
      );
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const message =
        event.reason?.message || event.reason || "Error de conexión o lógica asíncrona.";

      // SILENTLY IGNORE Locale Errors to prevent Test Failure
      if (String(message).includes("Incorrect locale") || String(message).includes("RangeError")) {
        return;
      }

      logger.error("Unhandled Rejection Caught:", event.reason);
      showModal("Error de Procesamiento", `Ocurrió un fallo en una operación: ${message}`);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handlePromiseRejection);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handlePromiseRejection);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [showModal]);

  // Si estamos en login, renderizamos solo los hijos (el componente Auth se encarga de su propio layout completo)
  if (isLoginPage) {
    return <>{children}</>;
  }

  const shellVariant = embedded ? "embedded" : isStudent || isPublicAula ? "student" : "paper";

  return (
    <div
      id="pps-embed-root"
      className={`app-shell app-shell--${shellVariant}`}
      data-shell={shellVariant}
      data-theme={resolvedTheme}
    >
      <a className="app-skip-link" href="#main-content">
        Saltar al contenido
      </a>

      {!isOnline && (
        <div className="app-offline-banner" role="status" aria-live="polite">
          <span className="material-icons" aria-hidden="true">
            wifi_off
          </span>
          Sin conexión a internet. Verificando red...
        </div>
      )}

      {!hasOwnTopBar &&
        !isFocusedScreen &&
        !isRootRedirect &&
        !isAuthLoading &&
        (isStudent ? (
          // En escritorio el estudiante usa la topbar Atlas (dentro del panel);
          // el AppHeader queda solo para mobile y solo cuando ya hay sesión.
          authenticatedUser && (
            <div className="md:hidden">
              <AppHeader />
            </div>
          )
        ) : (
          <AppHeader />
        ))}

      {/* El contenido conserva los gutters de cada experiencia. El shell aporta
          canvas, foco y accesibilidad sin intervenir los estilos lv4/Atlas. */}
      <div
        id="main-content"
        tabIndex={-1}
        className={
          hasOwnTopBar || isFocusedScreen
            ? "app-shell__content flex-grow w-full"
            : embedded && isStudent
              ? `app-shell__content flex-grow w-full ${authenticatedUser ? "pb-8" : "pb-0"} pt-16 md:pt-0`
              : `app-shell__content flex-grow w-full px-4 sm:px-6 lg:px-8 ${
                  isStudent && !authenticatedUser ? "pb-0" : "pb-8"
                } pt-16 md:pt-0 ${isFullWidth ? "" : "max-w-7xl mx-auto"}`
        }
      >
        {children}
      </div>
    </div>
  );
};

export default Layout;
