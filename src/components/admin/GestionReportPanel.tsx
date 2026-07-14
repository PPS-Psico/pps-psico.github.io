import React, { useState } from "react";
import useExecutiveReportData from "../../hooks/useExecutiveReportData";
import PrintableExecutiveReport from "../PrintableExecutiveReport";
import Loader from "../Loader";
import EmptyState from "../EmptyState";

// Punto de entrada visible del Informe General de Gestión (balance integral de
// la coordinación desde septiembre de 2024) dentro de la pestaña Reporte
// ejecutivo. El mismo informe también puede generarse desde Descargas →
// Balance de Prácticas Profesionales → modo "Informe de gestión".
const GestionReportPanel: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
  const [open, setOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const {
    data: reportData,
    isLoading,
    error,
  } = useExecutiveReportData({
    selection: { mode: "gestion", year: new Date().getFullYear() },
    enabled: open,
    isTestingMode,
  });

  const handleDownloadPdf = async () => {
    if (!reportData) return;
    setIsGeneratingPdf(true);
    try {
      const { generateExecutiveReportPdf } = await import("../../utils/executiveReportPdf");
      generateExecutiveReportPdf(reportData);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <section className="no-print" style={{ margin: "28px 0 8px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          padding: "18px 22px",
          border: "1px solid var(--rule-2)",
          borderRadius: 14,
          background: "var(--paper)",
        }}
      >
        <div style={{ minWidth: 260, flex: 1 }}>
          <span className="eyebrow">Balance integral · septiembre 2024 → hoy</span>
          <h3
            className="display"
            style={{ margin: "5px 0 3px", fontSize: 23, letterSpacing: "-0.01em", lineHeight: 1 }}
          >
            Informe general de gestión
          </h3>
          <p className="meta" style={{ margin: 0, fontSize: 12.5 }}>
            Evolución anual, crecimiento de cupos, relación ingreso/egreso y el listado completo de
            convenios nuevos de la coordinación, con descarga en PDF.
          </p>
        </div>
        <button className="btn btn-primary press" type="button" onClick={() => setOpen((v) => !v)}>
          <span className="material-icons" style={{ fontSize: 17 }}>
            {open ? "expand_less" : "summarize"}
          </span>
          {open ? "Ocultar informe" : "Ver informe"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          {isLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: 32,
              }}
            >
              <Loader />
              <p className="meta" style={{ margin: 0 }}>
                Generando el informe de gestión...
              </p>
            </div>
          )}

          {error && (
            <EmptyState
              icon="error"
              title="No pudimos generar el informe"
              message={(error as Error)?.message || "Error desconocido"}
            />
          )}

          {reportData && !isLoading && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button
                  className="btn btn-primary press"
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                >
                  <span className="material-icons" style={{ fontSize: 17 }}>
                    picture_as_pdf
                  </span>
                  {isGeneratingPdf ? "Generando..." : "Descargar PDF"}
                </button>
              </div>
              <div
                style={{
                  border: "1px solid var(--rule-2)",
                  borderRadius: 14,
                  overflow: "auto",
                  maxHeight: 820,
                }}
              >
                <PrintableExecutiveReport data={reportData} />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default GestionReportPanel;
