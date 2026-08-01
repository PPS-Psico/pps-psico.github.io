import React from "react";
import type { InicioDataStatus } from "../../../hooks/useInicioData";

interface DashboardDataStatusProps {
  status: InicioDataStatus;
  onRetry: () => void;
}

export const DashboardDataStatus: React.FC<DashboardDataStatusProps> = ({ status, onRetry }) => {
  if (status.hasError) {
    return (
      <div
        role="alert"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 20,
          padding: "12px 14px",
          border: "1px solid var(--warn)",
          borderRadius: 10,
          background: "var(--warn-soft)",
          color: "var(--ink)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span className="material-icons" aria-hidden="true" style={{ color: "var(--warn)" }}>
            warning
          </span>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <strong>Algunos datos no pudieron actualizarse.</strong>{" "}
            <span className="meta">Faltan: {status.failedSections.join(", ")}.</span>
          </div>
        </div>
        <button className="btn btn-sm press" onClick={onRetry} disabled={status.isFetching}>
          {status.isFetching ? "Reintentando…" : "Reintentar"}
        </button>
      </div>
    );
  }

  const updated = status.updatedAt
    ? new Date(status.updatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="meta mono" role="status" aria-live="polite" style={{ marginTop: 14 }}>
      {status.isFetching ? "Actualizando datos…" : updated ? `Datos actualizados ${updated}` : ""}
    </div>
  );
};
