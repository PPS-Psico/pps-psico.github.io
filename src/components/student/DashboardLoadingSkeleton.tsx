import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

const DashboardLoadingSkeleton: React.FC = () => {
  const { resolvedTheme } = useTheme();

  return (
    <div
      className="ed pps-loading-screen"
      data-mode={resolvedTheme}
      data-accent="teal"
      role="status"
      aria-live="polite"
      aria-label="Cargando Mi Panel"
    >
      <div className="pps-loading-screen__inner">
        <div className="pps-loading-screen__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <rect x="3" y="10" width="4" height="11" rx="1.5" fill="currentColor" />
            <rect x="10" y="4" width="4" height="17" rx="1.5" fill="currentColor" />
            <rect x="17" y="14" width="4" height="7" rx="1.5" fill="currentColor" />
          </svg>
        </div>
        <div className="pps-loading-screen__spinner" aria-hidden="true" />
        <p>Cargando Mi Panel</p>
      </div>
    </div>
  );
};

export default DashboardLoadingSkeleton;
