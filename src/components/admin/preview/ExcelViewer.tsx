import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OfficeViewerProps {
  url: string;
  filename: string;
  onLoad?: () => void;
}

export const ExcelViewer: React.FC<OfficeViewerProps> = ({ url, filename, onLoad }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useOfficeViewer, setUseOfficeViewer] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // URL de Office Online con parámetros para vista minimalista
  // embed.aspx con parámetros para ocultar UI innecesaria
  const officeOnlineUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setError("No se pudo cargar la vista previa del archivo");
    setIsLoading(false);
  };

  // Obtener la extensión del archivo
  const getFileExtension = (name: string) => {
    return name.split(".").pop()?.toLowerCase() || "";
  };

  const extension = getFileExtension(filename);
  const fileType =
    extension === "xlsx" || extension === "xls"
      ? "Excel"
      : extension === "docx" || extension === "doc"
        ? "Word"
        : extension === "pptx" || extension === "ppt"
          ? "PowerPoint"
          : "Office";

  if (error || !useOfficeViewer) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full text-white p-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 rounded-2xl bg-yellow-500/20 flex items-center justify-center mb-6"
        >
          <span className="material-icons !text-4xl text-yellow-400">table_chart</span>
        </motion.div>
        <p className="text-xl font-medium mb-2">Archivo {fileType}</p>
        <p className="text-sm text-gray-400 mb-2 text-center max-w-md">{filename}</p>
        <p className="text-sm text-gray-300 mb-8 text-center max-w-md">
          {error || "La vista previa no está disponible para este tipo de archivo."}
        </p>
        <div className="flex gap-3">
          {useOfficeViewer && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setError(null);
                setUseOfficeViewer(false);
                setIsLoading(true);
              }}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-xl font-bold transition-all"
            >
              <span className="material-icons">refresh</span>
              Reintentar
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700"
      >
        <div className="flex items-center gap-2">
          <span className="material-icons text-slate-600 dark:text-slate-300 text-lg">
            table_chart
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{fileType}</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setUseOfficeViewer(false)}
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Vista simplificada
          </motion.button>
        </div>
      </motion.div>

      <div
        className="flex-grow relative bg-slate-50 dark:bg-slate-900 overflow-hidden"
        style={{
          // Ocultar scrollbar horizontal
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>{`
          .excel-viewer-container::-webkit-scrollbar {
            display: none;
          }
          .excel-viewer-container {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-10"
            >
              <div className="w-12 h-12 border-4 border-slate-300 dark:border-slate-600 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Cargando vista previa...</p>
            </motion.div>
          )}
        </AnimatePresence>
        <iframe
          ref={iframeRef}
          src={officeOnlineUrl}
          className="excel-viewer-container w-full h-full border-0"
          style={{
            overflow: "hidden",
            // Ocultar scrollbars
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          title={`Vista previa de ${filename}`}
          onLoad={handleLoad}
          onError={handleError}
          sandbox="allow-scripts allow-same-origin allow-forms"
          scrolling="no"
        />
      </div>
    </div>
  );
};

export default ExcelViewer;
