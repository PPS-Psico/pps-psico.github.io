import { PDFDownloadLink } from "@react-pdf/renderer";
import type { ExecutiveReportModel } from "../executiveReport.types";
import { ExecutiveReportPdf } from "./ExecutiveReportPdf";

const fileName = (model: ExecutiveReportModel): string =>
  model.kind === "annual"
    ? `informe-pps-sede-comahue-${model.year}.pdf`
    : `informe-gestion-pps-sede-comahue-2024-${model.year}.pdf`;

const ExecutiveReportPdfDownload = ({
  model,
  includeTechnicalAnnex = false,
}: {
  model: ExecutiveReportModel;
  includeTechnicalAnnex?: boolean;
}) => (
  <PDFDownloadLink
    document={<ExecutiveReportPdf model={model} includeTechnicalAnnex={includeTechnicalAnnex} />}
    fileName={fileName(model)}
    className="per-download-button"
  >
    {({ loading }) => (
      <>
        <span className="material-icons" style={{ fontSize: 16 }} aria-hidden="true">
          picture_as_pdf
        </span>
        {loading ? "Preparando PDF…" : "Descargar PDF profesional"}
      </>
    )}
  </PDFDownloadLink>
);

export default ExecutiveReportPdfDownload;
