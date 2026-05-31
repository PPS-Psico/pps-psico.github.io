import React from "react";
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
        <button className="btn btn-ghost btn-sm press" onClick={onOpenHermes}>
          Abrir bandeja Hermes
          <span className="material-icons" style={{ fontSize: 15 }}>
            arrow_forward
          </span>
        </button>
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
