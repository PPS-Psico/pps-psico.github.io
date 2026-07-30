import React from "react";
import ActionButton from "../../ui/admin/ActionButton";
import { DetectionCard, DetectionMetric } from "./DetectionCard";

interface SolicitudesBandProps {
  metrics: DetectionMetric[];
  onOpenSolicitudes: (tab?: string) => void;
}

export const SolicitudesBand: React.FC<SolicitudesBandProps> = ({ metrics, onOpenSolicitudes }) => {
  return (
    <section style={{ padding: "28px 0", borderTop: "1px solid var(--rule-2)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          Solicitudes de alumnos
        </h2>
        <ActionButton
          variant="ghost"
          size="sm"
          icon="arrow_forward"
          iconPosition="right"
          className="press"
          onClick={() => onOpenSolicitudes()}
        >
          Ver todas
        </ActionButton>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
        className="grid-cols-1 md:grid-cols-3"
      >
        {metrics.map((m) => (
          <DetectionCard key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
};
