/**
 * lanzador/SeguroView.tsx — Vista del estado "seguro" (DB 'Cerrado' sin marca).
 * Mesa cerrada: se eligen candidatos y se gestiona el seguro antes de pasar a
 * la sala de consentimientos.
 */
import React, { Suspense } from "react";
import { FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS } from "../../../constants";
import { normalizeStringForComparison } from "../../../utils/formatters";
import type { LanzamientoPPS } from "../../../types";
import { useModal } from "../../../contexts/ModalContext";
import {
  CanvasHeader,
  Loader,
  Stat,
  StatGrid,
  Banner,
  useLaunchEditor,
  SeleccionadorConvocatorias,
  SeguroGenerator,
} from "./shared";
import { useLaunchRoster } from "./useLaunchData";

const SeguroView: React.FC<{
  launch: LanzamientoPPS;
  showModal: ReturnType<typeof useModal>["showModal"];
}> = ({ launch, showModal }) => {
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const { openEdit, modal: editModal } = useLaunchEditor(launch);

  const { data: inscriptos = [] } = useLaunchRoster(launch.id);

  const total = inscriptos.length;
  const seleccionados = inscriptos.filter(
    (i) => normalizeStringForComparison(i.estado_inscripcion) === "seleccionado"
  ).length;

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="seguro"
        secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
      />
      {editModal}
      <div className="lv4-canvas-body">
        {/* Stats */}
        <StatGrid>
          <Stat label="Candidatos" value={total} hint="inscriptos" tone="warn" />
          <Stat label="Cupos" value={cupos ?? "—"} hint="disponibles" />
          <Stat
            label="Seleccionados"
            value={seleccionados}
            hint="hasta ahora"
            tone={seleccionados > 0 ? "ok" : "muted"}
          />
        </StatGrid>

        {/* Banner informativo */}
        <Banner tone="warn" icon="how_to_reg" title="Mesa de selección abierta">
          Seleccioná los estudiantes y confirmá para enviar las notificaciones. Son {total}{" "}
          candidatos para {cupos ?? "?"} cupos.
        </Banner>

        <Suspense fallback={<Loader />}>
          <SeleccionadorConvocatorias isTestingMode={false} preSelectedLaunchId={launch.id} />
        </Suspense>

        {seleccionados > 0 && (
          <>
            <div className="lv4-eyebrow" style={{ marginBottom: 8 }}>
              Seguros y actas
            </div>
            <Suspense fallback={<Loader />}>
              <SeguroGenerator
                showModal={showModal}
                isTestingMode={false}
                preSelectedLanzamientoId={launch.id}
              />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
};

export default SeguroView;
