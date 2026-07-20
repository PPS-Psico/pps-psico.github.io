import { lazy, Suspense, useState } from "react";
import Loader from "../../components/Loader";
import { DirectorReport } from "./DirectorReport";
import { ProfessionalExecutiveReport } from "./ProfessionalExecutiveReport";
import type { ExecutiveReportKind } from "./executiveReport.types";
import { useDirectorReport } from "./useDirectorReport";
import { useProfessionalExecutiveReport } from "./useProfessionalExecutiveReport";

const ExecutiveReportPdfDownload = lazy(() => import("./pdf/ExecutiveReportPdfDownload"));
const DirectorReportPdfDownload = lazy(() => import("./pdf/DirectorReportPdfDownload"));

type ProfessionalReportVariant = ExecutiveReportKind | "director";

interface ProfessionalReportHubProps {
  year: number;
  isTestingMode?: boolean;
}

const ProfessionalReportHub = ({ year, isTestingMode = false }: ProfessionalReportHubProps) => {
  const [kind, setKind] = useState<ProfessionalReportVariant>("annual");
  const [includeTechnicalAnnex, setIncludeTechnicalAnnex] = useState(false);
  const executiveKind: ExecutiveReportKind = kind === "director" ? "annual" : kind;
  const executiveReport = useProfessionalExecutiveReport({
    kind: executiveKind,
    year,
    isTestingMode,
  });
  const directorReport = useDirectorReport({
    annualModel: executiveReport.model,
    year,
    enabled: kind === "director",
    isTestingMode,
  });
  const isLoading = executiveReport.isLoading || directorReport.isLoading;
  const error = executiveReport.error || directorReport.error;
  const hasModel =
    kind === "director" ? Boolean(directorReport.model) : Boolean(executiveReport.model);
  const title =
    kind === "annual"
      ? `Informe anual ${year}`
      : kind === "management"
        ? "Informe integral de gestión"
        : `Informe para Dirección · ${year}`;

  return (
    <section className="per-shell">
      <div className="per-toolbar">
        <div className="per-toolbar-copy">
          <span>{kind === "director" ? "Edición confidencial" : "Nueva edición profesional"}</span>
          <h2>{title}</h2>
          <p>
            {kind === "director"
              ? "Preparado para Agostina Reale Berrueta, con seguimiento nominal y presión operativa."
              : "Vista y PDF comparten el mismo contrato de datos, narrativa y reglas de comparación."}
          </p>
        </div>
        <div className="per-toolbar-actions">
          {kind !== "director" && (
            <label className="per-technical-toggle">
              <input
                type="checkbox"
                checked={includeTechnicalAnnex}
                onChange={(event) => setIncludeTechnicalAnnex(event.target.checked)}
              />
              <span>
                Anexo técnico
                <small>solo si lo solicitan</small>
              </span>
            </label>
          )}
          <div className="per-kind-toggle" aria-label="Tipo de informe">
            <button
              type="button"
              aria-pressed={kind === "annual"}
              onClick={() => setKind("annual")}
            >
              Por año
            </button>
            <button
              type="button"
              aria-pressed={kind === "management"}
              onClick={() => setKind("management")}
            >
              Mi gestión
            </button>
            <button
              type="button"
              aria-pressed={kind === "director"}
              onClick={() => setKind("director")}
            >
              Para Dirección
            </button>
          </div>
          {hasModel && !isLoading && (
            <Suspense
              fallback={
                <span className="per-download-button" aria-disabled="true">
                  Preparando PDF…
                </span>
              }
            >
              {kind === "director" && directorReport.model ? (
                <DirectorReportPdfDownload model={directorReport.model} />
              ) : executiveReport.model ? (
                <ExecutiveReportPdfDownload
                  model={executiveReport.model}
                  includeTechnicalAnnex={includeTechnicalAnnex}
                />
              ) : null}
            </Suspense>
          )}
        </div>
      </div>

      {error && <div className="per-state">No se pudo construir el informe: {error.message}</div>}
      {!error && isLoading && (
        <div className="per-state">
          <Loader />
        </div>
      )}
      {!error && !isLoading && !hasModel && (
        <div className="per-state">No hay datos suficientes para construir este informe.</div>
      )}
      {!error && kind === "director" && directorReport.model && (
        <div className="per-preview-canvas">
          <DirectorReport model={directorReport.model} />
        </div>
      )}
      {!error && kind !== "director" && executiveReport.model && (
        <div className="per-preview-canvas">
          <ProfessionalExecutiveReport
            model={executiveReport.model}
            includeTechnicalAnnex={includeTechnicalAnnex}
          />
        </div>
      )}
    </section>
  );
};

export default ProfessionalReportHub;
