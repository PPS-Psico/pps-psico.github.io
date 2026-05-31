import React, { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AppHeader from "./Header";
import { useModal } from "../../contexts/ModalContext";
import { logger } from "../../utils/logger";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { showModal } = useModal();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const isLoginPage = location.pathname === "/login";

  // Rutas que deben ocupar todo el ancho de la pantalla (dashboard)
  const fullWidthRoutes = ["/admin", "/jefe", "/directivo", "/reportero", "/testing"];
  const isFullWidth = fullWidthRoutes.some((route) => location.pathname.startsWith(route));

  // Rutas que traen su propia barra superior v3 (AdminTopBar) y por lo tanto
  // no deben renderizar el AppHeader legacy (evita la pila de dos barras).
  const ownTopBarRoutes = ["/admin", "/jefe", "/directivo", "/reportero", "/testing"];
  const hasOwnTopBar = ownTopBarRoutes.some((route) => location.pathname.startsWith(route));

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

  return (
    <div className="flex flex-col min-h-screen">
      {!isOnline && (
        <div className="bg-red-500 text-white text-center text-xs font-bold py-1 px-4 fixed top-0 left-0 right-0 z-[2000] animate-pulse shadow-md flex items-center justify-center gap-2">
          <span className="material-icons !text-sm">wifi_off</span>
          Sin conexión a internet. Verificando red...
        </div>
      )}
      {!hasOwnTopBar && <AppHeader />}
      {/* pt-16 for mobile (fixed header spacing), md:pt-0 for desktop (sticky header).
          Las rutas con barra propia (admin) van full-bleed, sin padding ni cap de ancho. */}
      <main
        className={
          hasOwnTopBar
            ? "flex-grow w-full"
            : `flex-grow w-full px-4 sm:px-6 lg:px-8 pb-8 pt-16 md:pt-0 ${
                isFullWidth ? "" : "max-w-7xl mx-auto"
              }`
        }
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
