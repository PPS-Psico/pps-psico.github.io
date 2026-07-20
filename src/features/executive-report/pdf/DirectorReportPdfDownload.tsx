import { PDFDownloadLink } from "@react-pdf/renderer";
import type { DirectorReportModel } from "../directorReport.types";
import { DirectorReportPdf } from "./DirectorReportPdf";

const DirectorReportPdfDownload = ({ model }: { model: DirectorReportModel }) => (
  <PDFDownloadLink
    document={<DirectorReportPdf model={model} />}
    fileName={`informe-direccion-pps-agostina-reale-berrueta-${model.annual.year}.pdf`}
    className="per-download-button"
  >
    {({ loading }) => (
      <>
        <span className="material-icons" style={{ fontSize: 16 }} aria-hidden="true">
          picture_as_pdf
        </span>
        {loading ? "Preparando PDF…" : "Descargar informe para Dirección"}
      </>
    )}
  </PDFDownloadLink>
);

export default DirectorReportPdfDownload;
