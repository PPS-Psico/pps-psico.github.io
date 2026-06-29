/**
 * lanzador/ArchivadaView.tsx — Vista del estado "archivada".
 * Referencia histórica: stats finales y acciones (duplicar / reabrir).
 */
import React from "react";
import { normalizeStringForComparison } from "../../../utils/formatters";
import type { LanzamientoPPS } from "../../../types";
import { CanvasHeader, Stat, StatGrid, Banner } from "./shared";
import { useLaunchRoster, useLaunchPracticas } from "./useLaunchData";

const ArchivadaView: React.FC<{
  launch: LanzamientoPPS;
  onDuplicar: () => void;
  onReabrir: () => void;
}> = ({ launch, onDuplicar, onReabrir }) => {
  const { data: practicas = [] } = useLaunchPracticas(launch.id);

  const { data: convocatorias = [] } = useLaunchRoster(launch.id);

  const inscriptos = convocatorias.length;
  const seleccionados = convocatorias.filter(
    (c) => normalizeStringForComparison(c.estado_inscripcion) === "seleccionado"
  ).length;
  const acreditados = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "finalizada"
  ).length;
  const tasa = seleccionados > 0 ? Math.round((acreditados / seleccionados) * 100) : null;

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="archivada"
        primaryAction={{ label: "Duplicar como base", icon: "content_copy", onClick: onDuplicar }}
      />
      <div className="lv4-canvas-body">
        {/* Banner histórico */}
        <Banner
          tone="neutral"
          icon="archive"
          title="Convocatoria archivada"
          style={{ marginBottom: 28 }}
        >
          Este ciclo ha concluido. Los datos quedan como referencia histórica.
        </Banner>

        {/* Stats */}
        <StatGrid style={{ marginBottom: 28 }}>
          <Stat label="Inscriptos" value={inscriptos} hint="se postularon" />
          <Stat label="Seleccionados" value={seleccionados} hint="comenzaron" />
          <Stat label="Acreditados" value={acreditados} hint="finalizaron" tone="ok" />
          <Stat label="Tasa éxito" value={tasa !== null ? `${tasa}%` : "—"} hint="acred./selecc." />
        </StatGrid>

        {/* Acciones */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            {
              icon: "content_copy",
              title: "Duplicar como base",
              desc: "Crea un nuevo borrador con los datos de esta convocatoria.",
              cta: "Crear borrador",
              onClick: onDuplicar,
            },
            {
              icon: "restart_alt",
              title: "Reabrir inscripción",
              desc: "Vuelve a abrir para recibir nuevos postulantes.",
              cta: "Reabrir",
              onClick: onReabrir,
            },
          ].map((a) => (
            <div key={a.title} className="lv4-action-card">
              <span
                className="material-icons"
                style={{ fontSize: 20, color: "var(--ink-3)", marginBottom: 10, display: "block" }}
              >
                {a.icon}
              </span>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>{a.desc}</div>
              <button className="lv4-btn" onClick={a.onClick}>
                {a.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ArchivadaView;
