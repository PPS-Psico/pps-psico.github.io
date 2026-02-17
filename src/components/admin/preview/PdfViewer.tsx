import { motion } from "framer-motion";
import React, { useCallback, useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Importar el código del worker de pdf.js
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

// Configurar el worker usando el archivo local
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfViewerProps {
  url: string;
  onLoad?: () => void;
  showThumbnails?: boolean; // Legacy prop, kept for interface compatibility but ignored
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, onLoad }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
    onLoad?.();
  }

  function onDocumentLoadError(err: Error) {
    setError("Error al cargar el PDF: " + err.message);
    setIsLoading(false);
  }

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetZoom();
      } else if (e.key === "r" || e.key === "R") {
        rotateClockwise();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom, rotateClockwise]);

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
    <div className="flex flex-col h-full bg-black/40">
      {/* Toolbar superior simplificada */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-center gap-4 px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/10 z-10 shadow-md"
      >
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

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={resetZoom}
          className="ml-2 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white text-xs font-medium"
          title="Restablecer zoom (Ctrl+0)"
        >
          Reset
        </motion.button>
      </motion.div>

      {/* Contenedor con Scroll Continuo */}
      <div className="flex-grow overflow-auto flex justify-center p-8 custom-scrollbar">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center p-12">
              <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
          }
          className="flex flex-col gap-8 items-center"
        >
          {Array.from(new Array(numPages), (_el, index) => (
            <div key={`page_${index + 1}`} className="shadow-2xl relative group">
              <Page
                pageNumber={index + 1}
                scale={scale}
                rotate={rotation}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="bg-white"
                loading={
                  <div className="h-[800px] w-[600px] bg-white/5 animate-pulse flex items-center justify-center rounded text-white/20">
                    Cargando página {index + 1}...
                  </div>
                }
              />
              <div className="absolute top-2 right-[-40px] opacity-0 group-hover:opacity-100 transition-opacity text-white/50 text-xs font-mono">
                {index + 1}
              </div>
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;
