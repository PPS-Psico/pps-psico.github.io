import React, { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { motion, AnimatePresence } from "framer-motion";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Importar el código del worker de pdf.js
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

// Configurar el worker usando el archivo local
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfViewerProps {
  url: string;
  onLoad?: () => void;
  showThumbnails?: boolean;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, onLoad, showThumbnails = true }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<number[]>([]);
  const [showThumbnailPanel, setShowThumbnailPanel] = useState(showThumbnails);
  const [rotation, setRotation] = useState<number>(0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setThumbnails(Array.from({ length: numPages }, (_, i) => i + 1));
    setIsLoading(false);
    onLoad?.();
  }

  function onDocumentLoadError(err: Error) {
    setError("Error al cargar el PDF: " + err.message);
    setIsLoading(false);
  }

  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.2);
  }, []);

  const rotateClockwise = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const rotateCounterClockwise = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  const jumpToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= numPages) {
        setPageNumber(page);
      }
    },
    [numPages]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === "r" || e.key === "R") {
        rotateClockwise();
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevPage, goToNextPage, rotateClockwise, resetZoom]);

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full text-white p-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 rounded-2xl bg-red-500/20 flex items-center justify-center mb-6"
        >
          <span className="material-icons !text-4xl text-red-400">error</span>
        </motion.div>
        <p className="text-xl font-medium mb-2">Error al cargar el PDF</p>
        <p className="text-sm text-gray-400 mb-6 text-center max-w-md">{error}</p>
        <motion.a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
        >
          <span className="material-icons">download</span>
          Descargar PDF
        </motion.a>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full">
      <AnimatePresence>
        {showThumbnailPanel && numPages > 0 && (
          <motion.div
            initial={{ x: -250, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -250, opacity: 0 }}
            className="w-48 flex-shrink-0 bg-slate-950/80 border-r border-white/10 overflow-y-auto"
          >
            <div className="p-2 space-y-2">
              {thumbnails.map((page) => (
                <motion.button
                  key={page}
                  onClick={() => jumpToPage(page)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                    page === pageNumber
                      ? "border-blue-500 shadow-lg shadow-blue-500/20"
                      : "border-transparent hover:border-white/20"
                  }`}
                >
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <span className="text-xs text-gray-400">{page}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col flex-grow">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-md border-b border-white/10"
        >
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
            >
              <span className="material-icons">chevron_left</span>
            </motion.button>

            <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageNumber}
                onChange={(e) => jumpToPage(parseInt(e.target.value) || 1)}
                className="w-12 bg-transparent text-center text-white text-sm font-medium focus:outline-none"
              />
              <span className="text-gray-400 text-sm">/ {numPages}</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
            >
              <span className="material-icons">chevron_right</span>
            </motion.button>
          </div>

          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowThumbnailPanel(!showThumbnailPanel)}
              className={`p-2 rounded-xl transition-colors ${
                showThumbnailPanel ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-white"
              }`}
              title="Mostrar miniaturas"
            >
              <span className="material-icons">grid_view</span>
            </motion.button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={zoomOut}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
              title="Alejar"
            >
              <span className="material-icons">zoom_out</span>
            </motion.button>

            <div className="w-16 text-center">
              <span className="text-white text-sm font-medium">{Math.round(scale * 100)}%</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={zoomIn}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
              title="Acercar"
            >
              <span className="material-icons">zoom_in</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={resetZoom}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white text-sm font-medium"
              title="Restablecer zoom (Ctrl+0)"
            >
              100%
            </motion.button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={rotateCounterClockwise}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
              title="Rotar izquierda"
            >
              <span className="material-icons">rotate_left</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={rotateClockwise}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
              title="Rotar derecha"
            >
              <span className="material-icons">rotate_right</span>
            </motion.button>
          </div>
        </motion.div>

        <div className="flex-grow overflow-auto flex justify-center p-4 bg-black/20">
          <AnimatePresence mode="wait">
            <motion.div
              key={pageNumber}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.15 }}
              className="shadow-2xl"
            >
              <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center h-96">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                }
                className="shadow-2xl"
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer
                  renderAnnotationLayer
                  className="shadow-2xl"
                  loading={
                    <div className="flex items-center justify-center h-96 w-96">
                      <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                  }
                />
              </Document>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white/80 text-sm border border-white/10"
        >
          Página {pageNumber} de {numPages}
        </motion.div>
      </div>
    </div>
  );
};

export default PdfViewer;
