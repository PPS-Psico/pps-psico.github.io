import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Attachment, getFileType } from "../../../utils/attachmentUtils";
import { PdfViewer } from "./PdfViewer";
import { ExcelViewer } from "./ExcelViewer";
import { ImageViewer } from "./ImageViewer";
import { FileInfo, FileInfoButton } from "./FileInfo";
import { KeyboardShortcuts } from "./KeyboardShortcuts";

interface FilePreviewProps {
  files: Attachment[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  files,
  initialIndex,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [direction, setDirection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsLoading(true);
      document.body.style.overflow = "hidden";
      // Show shortcuts hint on first open
      const hasSeenShortcuts = localStorage.getItem("filepreview-shortcuts-seen");
      if (!hasSeenShortcuts) {
        setShowShortcuts(true);
        localStorage.setItem("filepreview-shortcuts-seen", "true");
      }
    } else {
      document.body.style.overflow = "unset";
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          if (showInfo) {
            setShowInfo(false);
          } else if (showShortcuts) {
            setShowShortcuts(false);
          } else {
            onClose();
          }
          break;
        case "ArrowLeft":
          if (files.length > 1 && !e.shiftKey) {
            e.preventDefault();
            handlePrev();
          }
          break;
        case "ArrowRight":
          if (files.length > 1 && !e.shiftKey) {
            e.preventDefault();
            handleNext();
          }
          break;
        case "i":
        case "I":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setShowInfo(!showInfo);
          }
          break;
        case "?":
          setShowShortcuts(!showShortcuts);
          break;
        case "t":
        case "T":
          if (files.length > 1) {
            setShowThumbnails(!showThumbnails);
          }
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, files.length, currentIndex, showInfo, showShortcuts, showThumbnails]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleNext = useCallback(() => {
    if (files.length <= 1) return;
    setDirection(1);
    setIsLoading(true);
    setCurrentIndex((prev) => (prev + 1) % files.length);
  }, [files.length]);

  const handlePrev = useCallback(() => {
    if (files.length <= 1) return;
    setDirection(-1);
    setIsLoading(true);
    setCurrentIndex((prev) => (prev - 1 + files.length) % files.length);
  }, [files.length]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleThumbnailClick = useCallback(
    (index: number) => {
      setDirection(index > currentIndex ? 1 : -1);
      setIsLoading(true);
      setCurrentIndex(index);
    },
    [currentIndex]
  );

  if (!isOpen || files.length === 0) return null;

  const currentFile = files[currentIndex];
  const fileType = getFileType(currentFile.filename);
  const displayUrl = currentFile.signedUrl || currentFile.url;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  const renderViewer = () => {
    const viewerProps = { url: displayUrl, onLoad: handleLoad };

    switch (fileType) {
      case "pdf":
        return <PdfViewer {...viewerProps} showThumbnails={showThumbnails} />;
      case "office":
        return <ExcelViewer {...viewerProps} filename={currentFile.filename} />;
      case "image":
        return <ImageViewer {...viewerProps} />;
      default:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-white p-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mb-6 shadow-2xl"
            >
              <span className="material-icons !text-5xl text-slate-400">description</span>
            </motion.div>
            <h3 className="text-2xl font-semibold mb-2">Vista previa no disponible</h3>
            <p className="text-sm text-gray-400 mb-8 max-w-md text-center">
              {currentFile.filename}
            </p>
            <motion.a
              href={displayUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-3"
            >
              <span className="material-icons">download</span>
              Descargar archivo
            </motion.a>
          </motion.div>
        );
    }
  };

  return createPortal(
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col"
      onClick={onClose}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex-shrink-0 flex justify-between items-center p-4 text-white z-50 h-16 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm border-b border-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="material-icons">close</span>
          </motion.button>
          <div className="flex flex-col">
            <h3 className="font-semibold text-lg truncate max-w-md">{currentFile.filename}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>
                {currentIndex + 1} de {files.length}
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              <span className="uppercase tracking-wider font-medium text-gray-500">{fileType}</span>
              {isLoading && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    Cargando...
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* File Info Button */}
          <FileInfoButton onClick={() => setShowInfo(true)} />

          {/* Thumbnails Toggle */}
          {files.length > 1 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`p-2 rounded-xl transition-colors ${showThumbnails ? "bg-blue-500/20 text-blue-400" : "bg-white/5 hover:bg-white/10"}`}
              title={`${showThumbnails ? "Ocultar" : "Mostrar"} miniaturas (T)`}
            >
              <span className="material-icons">grid_view</span>
            </motion.button>
          )}

          {/* Fullscreen Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            title={isFullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
          >
            <span className="material-icons">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </motion.button>

          {/* Keyboard Shortcuts */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowShortcuts(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            title="Atajos de teclado (?)"
          >
            <span className="material-icons">keyboard</span>
          </motion.button>

          <div className="w-px h-6 bg-white/10 mx-2" />

          {/* Download Button */}
          <motion.a
            href={displayUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg"
          >
            <span className="material-icons text-sm">download</span>
            <span className="hidden sm:inline text-sm font-medium">Descargar</span>
          </motion.a>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-grow relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full"
          >
            {renderViewer()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {files.length > 1 && (
          <>
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.1, x: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-black/40 backdrop-blur-md hover:bg-black/60 text-white/80 hover:text-white transition-all border border-white/10 shadow-2xl group"
            >
              <span className="material-icons !text-3xl group-hover:-translate-x-1 transition-transform">
                chevron_left
              </span>
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.1, x: -5 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-black/40 backdrop-blur-md hover:bg-black/60 text-white/80 hover:text-white transition-all border border-white/10 shadow-2xl group"
            >
              <span className="material-icons !text-3xl group-hover:translate-x-1 transition-transform">
                chevron_right
              </span>
            </motion.button>
          </>
        )}

        {/* Loading overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-white/60 text-sm">Cargando archivo...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Thumbnail strip */}
      <AnimatePresence>
        {files.length > 1 && showThumbnails && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="flex-shrink-0 bg-black/60 backdrop-blur-xl border-t border-white/10 p-4 overflow-x-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3 justify-center">
              {files.map((file, index) => {
                const isActive = index === currentIndex;
                const type = getFileType(file.filename);
                return (
                  <motion.button
                    key={index}
                    onClick={() => handleThumbnailClick(index)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden transition-all border-2 ${
                      isActive
                        ? "border-blue-500 shadow-lg shadow-blue-500/25"
                        : "border-transparent hover:border-white/20"
                    }`}
                  >
                    {type === "image" ? (
                      <img
                        src={file.signedUrl || file.url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                          isActive
                            ? "bg-gradient-to-br from-blue-600/20 to-blue-700/20"
                            : "bg-slate-800"
                        }`}
                      >
                        <span
                          className={`material-icons text-2xl ${isActive ? "text-blue-400" : "text-slate-400"}`}
                        >
                          {type === "pdf"
                            ? "picture_as_pdf"
                            : type === "office"
                              ? "table_chart"
                              : "insert_drive_file"}
                        </span>
                        <span className="text-[10px] uppercase font-medium text-slate-400">
                          {type}
                        </span>
                      </div>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="activeThumb"
                        className="absolute inset-0 ring-2 ring-blue-500 rounded-xl"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <FileInfo
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        file={currentFile}
        fileType={fileType}
      />

      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </motion.div>,
    document.body
  );
};

export default FilePreview;
