import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Configurar el worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  onLoad?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, onLoad }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
    onLoad?.();
  }

  function onDocumentLoadError(err: Error) {
    setError("Error al cargar el PDF: " + err.message);
    setIsLoading(false);
  }

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white">
        <span className="material-icons !text-6xl mb-4 text-red-400">error</span>
        <p className="text-lg mb-4">{error}</p>
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold transition-colors"
        >
          Descargar PDF
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
          >
            <span className="material-icons">chevron_left</span>
          </button>
          <span className="text-white text-sm font-medium min-w-[80px] text-center">
            {pageNumber} / {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
          >
            <span className="material-icons">chevron_right</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
            title="Alejar"
          >
            <span className="material-icons">zoom_out</span>
          </button>
          <span className="text-white text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
            title="Acercar"
          >
            <span className="material-icons">zoom_in</span>
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-grow overflow-auto flex justify-center p-4 bg-black/20">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="shadow-2xl"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer
            renderAnnotationLayer
            className="shadow-2xl"
          />
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;
