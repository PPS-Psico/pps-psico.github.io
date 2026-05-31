import React from "react";
import ErrorBoundary from "../../components/ErrorBoundary";
import MetricasV3View from "./MetricasV3View";

interface MetricsViewProps {
  onStudentSelect: (student: { legajo: string; nombre: string }) => void;
  isTestingMode?: boolean;
  onModalOpen?: (isOpen: boolean) => void;
}

/**
 * Sección Métricas (admin) · Rediseño v3 Paper & Ink.
 *
 * La vista ejecutiva ahora vive en `MetricasV3View`, que trae su propio
 * masthead serif, selector de año y sub-pestañas (Dashboard · Línea de tiempo ·
 * Reporte ejecutivo). El masthead reemplaza al SubTabs genérico anterior para
 * mantener consistencia con Inicio / Lanzador / Gestión / Solicitudes.
 */
const MetricsView: React.FC<MetricsViewProps> = ({
  onStudentSelect,
  isTestingMode = false,
  onModalOpen,
}) => {
  return (
    <ErrorBoundary>
      <MetricasV3View
        onStudentSelect={onStudentSelect}
        isTestingMode={isTestingMode}
        onModalOpen={onModalOpen}
      />
    </ErrorBoundary>
  );
};

export default MetricsView;
