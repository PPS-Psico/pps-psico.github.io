/**
 * lanzador/SeguroView.tsx — Vista del paso 4 "Seguro" (DB 'Confirmacion').
 *
 * Llega acá una PPS que ya pasó por la sala de firmas: la nómina decantó y lo
 * que falta es la planilla de seguro y el listado de convocados para la
 * institución. Se entra por decisión explícita de Coordinación desde la sala de
 * firmas, no automáticamente al cerrar la mesa: generar ambos documentos antes
 * de saber quién confirma obliga a rehacerlos por cada baja.
 */
import React, { Suspense, useState } from "react";
import { FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS } from "../../../constants";
import { useModal } from "../../../contexts/ModalContext";
import type { LanzamientoPPS } from "../../../types";
import { normalizeStringForComparison } from "../../../utils/formatters";
import {
  Banner,
  CanvasHeader,
  Loader,
  SeguroGenerator,
  SeleccionadorConvocatorias,
  Stat,
  StatGrid,
  useLaunchEditor,
} from "./shared";
import { useLaunchRoster } from "./useLaunchData";

const SeguroView: React.FC<{
  launch: LanzamientoPPS;
  showModal: ReturnType<typeof useModal>["showModal"];
  onActivar: () => void;
  onVolverAFirmas: () => void;
  isTestingMode?: boolean;
}> = ({ launch, showModal, onActivar, onVolverAFirmas, isTestingMode = false }) => {
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const { openEdit, modal: editModal } = useLaunchEditor(launch);
  const [ajustarOpen, setAjustarOpen] = useState(false);

  const rosterQuery = useLaunchRoster(launch.id, isTestingMode);
  const { data: inscriptos = [] } = rosterQuery;

  const total = inscriptos.length;
  const seleccionados = inscriptos.filter(
    (i) => normalizeStringForComparison(i.estado_inscripcion) === "seleccionado"
  ).length;

  const secondaryActions = [
    { label: "Volver a las firmas", icon: "how_to_reg", onClick: onVolverAFirmas },
    { label: "Editar datos", icon: "edit", onClick: openEdit },
  ];

  if (rosterQuery.isLoading) {
    return (
      <div>
        <CanvasHeader launch={launch} uiState="seguro" secondaryActions={secondaryActions} />
        {editModal}
        <div className="lv4-canvas-body">
          <Loader />
        </div>
      </div>
    );
  }

  if (rosterQuery.isError) {
    return (
      <div>
        <CanvasHeader launch={launch} uiState="seguro" secondaryActions={secondaryActions} />
        {editModal}
        <div className="lv4-canvas-body">
          <Banner
            tone="warn"
            icon="cloud_off"
            title="No se pudo cargar la nómina"
            action={
              <button className="lv4-btn" onClick={() => void rosterQuery.refetch()}>
                Reintentar
              </button>
            }
          >
            Los seguros permanecen ocultos hasta verificar el roster de estudiantes.
          </Banner>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="seguro"
        primaryAction={{
          label: "Activar PPS",
          icon: "play_circle",
          onClick: onActivar,
          disabled: seleccionados === 0,
        }}
        secondaryActions={secondaryActions}
      />
      {editModal}
      <div className="lv4-canvas-body">
        {/* Stats */}
        <StatGrid>
          <Stat
            label="En la nómina"
            value={seleccionados}
            hint="seleccionados vigentes"
            tone={seleccionados > 0 ? "ok" : "warn"}
          />
          <Stat label="Cupos" value={cupos ?? "—"} hint="disponibles" />
          <Stat label="Candidatos" value={total} hint="inscriptos históricos" tone="muted" />
        </StatGrid>

        <Banner tone="warn" icon="shield" title="Seguro y listado de convocados">
          Generá la planilla de seguro y el listado con los {seleccionados} estudiante
          {seleccionados !== 1 ? "s" : ""} que quedaron en la nómina. Si todavía esperás firmas,
          volvé a la sala de firmas antes de armar los documentos.
        </Banner>

        <Suspense fallback={<Loader />}>
          <SeguroGenerator
            showModal={showModal}
            isTestingMode={isTestingMode}
            preSelectedLanzamientoId={launch.id}
          />
        </Suspense>

        {/* Ajustes de última hora sobre la nómina (reemplazos, altas tardías).
            Queda plegado porque a esta altura la selección ya está decidida. */}
        <section className="lv4-consent-section">
          <button
            className="lv4-group-head"
            onClick={() => setAjustarOpen((open) => !open)}
            aria-expanded={ajustarOpen}
            aria-controls="lv4-seguro-ajustes"
          >
            <span className="lv4-group-label">
              <span
                className={`material-icons lv4-disclosure${ajustarOpen ? " is-open" : ""}`}
                aria-hidden="true"
              >
                expand_more
              </span>
              Ajustar la nómina
            </span>
            <span className="lv4-group-count">reemplazos y altas tardías</span>
          </button>
          {ajustarOpen && (
            <div id="lv4-seguro-ajustes" className="lv4-consent-management">
              <p>
                Si cambiás la nómina después de generar los documentos, volvé a descargarlos: el
                seguro y el listado se arman con los seleccionados del momento.
              </p>
              <Suspense fallback={<Loader />}>
                <SeleccionadorConvocatorias
                  isTestingMode={isTestingMode}
                  preSelectedLaunchId={launch.id}
                />
              </Suspense>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SeguroView;
