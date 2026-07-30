import React from "react";
import ActionButton from "../../ui/admin/ActionButton";
import { DetectionCard, DetectionMetric } from "./DetectionCard";

interface DetectionBandProps {
  metrics: DetectionMetric[];
  onOpenHermes: () => void;
}

export const DetectionBand: React.FC<DetectionBandProps> = ({ metrics, onOpenHermes }) => {
  return (
    <section style={{ padding: "28px 0" }}>
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
          En tus conversaciones · instituciones
        </h2>
        <ActionButton
          variant="ghost"
          size="sm"
          icon="arrow_forward"
          iconPosition="right"
          className="press"
          onClick={onOpenHermes}
        >
          Abrir bandeja Hermes
        </ActionButton>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
        className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      >
        {metrics.map((m) => (
          <DetectionCard key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
};
