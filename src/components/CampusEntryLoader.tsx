import React from "react";

/**
 * Loader branded que se muestra mientras se resuelve el ingreso al panel
 * (restauración de sesión + auto-login desde el campus Moodle). Es un ÚNICO
 * spinner reutilizado por AuthContext-gating (StudentDashboard) y por el estado
 * "checking" de <Auth>, para que el usuario vea una sola pantalla de carga
 * continua en vez de dos spinners distintos con el login parpadeando en medio.
 */
interface CampusEntryLoaderProps {
  /** `true` cuando va embebido dentro del panel (tab content); `false` = pantalla completa. */
  inline?: boolean;
  resolvedTheme?: "light" | "dark";
  /** Texto opcional; por defecto el mensaje de ingreso desde el campus. */
  message?: string;
}

const brandMark = (
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
);

const CampusEntryLoader: React.FC<CampusEntryLoaderProps> = ({
  inline = false,
  resolvedTheme,
  message = "Ingresando desde el campus…",
}) => (
  <div
    className={`ed flex flex-col items-center justify-center gap-5 p-8 ${
      inline
        ? "w-full border border-[var(--line)] bg-[var(--bg-elevated)] rounded-3xl"
        : "fixed inset-0 w-full h-[100dvh]"
    }`}
    data-mode={resolvedTheme}
    data-accent="teal"
    style={{ background: inline ? "transparent" : "var(--bg)", color: "var(--ink)" }}
  >
    {brandMark}
    <div className="w-9 h-9 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
    <p className="text-sm font-semibold text-[var(--ink-muted)]">{message}</p>
  </div>
);

export default CampusEntryLoader;
