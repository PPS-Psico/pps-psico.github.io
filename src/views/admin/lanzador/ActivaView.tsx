/**
 * lanzador/ActivaView.tsx — Vista del estado "activa" (DB 'Activa').
 * PPS en curso: stats de prácticas y opción de archivar.
 */
import React from "react";
import { FIELD_FECHA_INICIO_LANZAMIENTOS, FIELD_FECHA_FIN_LANZAMIENTOS } from "../../../constants";
import { normalizeStringForComparison, formatDate } from "../../../utils/formatters";
import type { LanzamientoPPS } from "../../../types";
import { CanvasHeader, Stat, StatGrid, Banner, useLaunchEditor } from "./shared";
import { useLaunchPracticas } from "./useLaunchData";

const ActivaView: React.FC<{ launch: LanzamientoPPS; onArchivar: () => void }> = ({
  launch,
  onArchivar,
}) => {
  const { openEdit, modal: editModal } = useLaunchEditor(launch);
  const fechaInicio = launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const fechaFin = launch[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;

  const { data: practicas = [] } = useLaunchPracticas(launch.id);

  const totalHoras = practicas.reduce((sum, p) => sum + ((p.horas_realizadas as number) || 0), 0);
  const activas = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "activa"
  ).length;
  const finalizadas = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "finalizada"
  ).length;

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="activa"
        primaryAction={{ label: "Archivar convocatoria", icon: "archive", onClick: onArchivar }}
        secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
      />
      {editModal}
      <div className="lv4-canvas-body">
        {/* Stats */}
        <StatGrid style={{ marginBottom: 28 }}>
          <Stat label="Prácticas activas" value={activas} hint="en curso" tone="ok" />
          <Stat label="Finalizadas" value={finalizadas} hint="completadas" />
          <Stat label="Horas totales" value={totalHoras} hint="realizadas" />
          <Stat
            label="Período"
            value={fechaInicio ? formatDate(fechaInicio) : "—"}
            hint={fechaFin ? `hasta ${formatDate(fechaFin)}` : "sin fecha fin"}
            size="sm"
          />
        </StatGrid>

        {/* Estado visual */}
        <Banner tone="ok" icon="trending_up" title="Prácticas en curso" style={{ marginBottom: 0 }}>
          {activas} estudiante{activas !== 1 ? "s" : ""} realizando horas actualmente.
          {finalizadas > 0 && ` ${finalizadas} ya completaron.`}
        </Banner>
      </div>
    </div>
  );
};

export default ActivaView;
