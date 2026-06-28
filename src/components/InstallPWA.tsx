import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { usePwaInstall } from "../contexts/PwaInstallContext";
import { useTheme } from "../contexts/ThemeContext";
import { haptics } from "../utils/haptics";

const InstallPWA: React.FC = () => {
  const { canInstall, triggerInstall } = usePwaInstall();
  const { resolvedTheme } = useTheme();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Rutas con bottom-nav (estudiante/admin): la tarjeta debe flotar por encima.
  const hasBottomNav = /^\/(student|admin)/.test(location.pathname);

  useEffect(() => {
    // Mostrar si el navegador indica que se puede instalar (Android/Desktop Chrome)
    if (canInstall) {
      setIsVisible(true);
    }

    // Detectar iOS específicamente (no soporta beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isInStandaloneMode =
      "standalone" in window.navigator && (window.navigator as any).standalone;

    if (isIosDevice && !isInStandaloneMode) {
      setIsIOS(true);
      setIsVisible(true);
    }
  }, [canInstall]);

  const handleInstallClick = () => {
    haptics.tap();
    if (isIOS) {
      alert(
        "Para instalar en iOS: toca el botón 'Compartir' de Safari y selecciona 'Agregar a Inicio'."
      );
    } else {
      triggerInstall();
    }
  };

  const handleDismiss = () => {
    haptics.tap();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="ed md:hidden"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        padding: "0 14px",
        paddingBottom: hasBottomNav
          ? "calc(max(env(safe-area-inset-bottom), 18px) + 78px)"
          : "max(env(safe-area-inset-bottom), 14px)",
        pointerEvents: "none",
      }}
    >
      <motion.div
        initial={{ y: 130, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 13,
          background: "var(--bg-elevated)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: "13px 14px",
          boxShadow: "0 1px 2px rgba(15,27,98,.06), 0 20px 44px -18px rgba(15,27,98,.30)",
        }}
      >
        {/* Ícono */}
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: "var(--tint)",
            color: "var(--accent)",
          }}
        >
          <span className="material-icons" style={{ fontSize: 24 }} aria-hidden>
            install_mobile
          </span>
        </span>

        {/* Texto */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="display"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "-.02em",
              lineHeight: 1.05,
            }}
          >
            Instalar app
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-muted)",
              marginTop: 3,
              letterSpacing: ".02em",
            }}
          >
            Acceso rápido y notificaciones
          </div>
        </div>

        {/* CTA + cerrar */}
        <button
          type="button"
          onClick={handleInstallClick}
          className="press"
          style={{
            flexShrink: 0,
            background: "var(--accent)",
            color: "var(--on-accent)",
            border: 0,
            borderRadius: 13,
            padding: "11px 16px",
            font: "inherit",
            fontWeight: 700,
            fontSize: 13.5,
            letterSpacing: "-.01em",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar"
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 10,
            border: 0,
            background: "transparent",
            color: "var(--ink-subtle)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span className="material-icons" style={{ fontSize: 20 }} aria-hidden>
            close
          </span>
        </button>
      </motion.div>
    </div>
  );
};

export default InstallPWA;
