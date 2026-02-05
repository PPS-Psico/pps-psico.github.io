import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Attachment, getFileType } from "../../../utils/attachmentUtils";
import { PdfViewer } from "./PdfViewer";
import { ExcelViewer } from "./ExcelViewer";
import { ImageViewer } from "./ImageViewer";

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

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsLoading(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
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
          onClose();
          break;
        case "ArrowLeft":
          if (files.length > 1) {
            e.preventDefault();
            handlePrev();
          }
          break;
        case "ArrowRight":
          if (files.length > 1) {
            e.preventDefault();
            handleNext();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, files.length, currentIndex]);

  const handleNext = useCallback(() => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev + 1) % files.length);
  }, [files.length]);

  const handlePrev = useCallback(() => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev - 1 + files.length) % files.length);
  }, [files.length]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  if (!isOpen || files.length === 0) return null;

  const currentFile = files[currentIndex];
  const fileType = getFileType(currentFile.filename);
  const displayUrl = currentFile.signedUrl || currentFile.url;

  const renderViewer = () => {
    switch (fileType) {
      case "pdf":
        return <PdfViewer url={displayUrl} onLoad={handleLoad} />;
      case "office":
        return <ExcelViewer url={displayUrl} onLoad={handleLoad} />;
      case "image":
        return <ImageViewer url={displayUrl} onLoad={handleLoad} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-white p-8">
            <span className="material-icons !text-6xl mb-4 opacity-80">description</span>
            <p className="text-lg mb-2">Vista previa no disponible</p>
            <p className="text-sm text-gray-400 mb-6">{currentFile.filename}</p>
            <a
              href={displayUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
            >
              <span className="material-icons">download</span>
              Descargar archivo
            </a>
          </div>
        );
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex justify-between items-center p-4 text-white z-50 h-16 bg-gradient-to-b from-black/80 to-transparent border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <h3 className="font-bold text-lg truncate max-w-md">{currentFile.filename}</h3>
          <span className="text-xs text-gray-400">
            {currentIndex + 1} de {files.length} • {fileType.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Thumbnail strip toggle */}
          {files.length > 1 && (
            <span className="text-xs text-gray-400 mr-2 hidden sm:block">← → para navegar</span>
          )}

          <a
            href={displayUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
            title="Descargar"
          >
            <span className="material-icons">download</span>
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
            title="Cerrar (Esc)"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {renderViewer()}

        {/* Navigation arrows */}
        {files.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-all backdrop-blur-sm z-10"
            >
              <span className="material-icons !text-2xl">chevron_left</span>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-all backdrop-blur-sm z-10"
            >
              <span className="material-icons !text-2xl">chevron_right</span>
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {files.length > 1 && (
        <div
          className="flex-shrink-0 bg-black/60 backdrop-blur-md border-t border-white/10 p-3 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2 justify-center">
            {files.map((file, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsLoading(true);
                  setCurrentIndex(index);
                }}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
                  index === currentIndex
                    ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-black"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                {getFileType(file.filename) === "image" ? (
                  <img
                    src={file.signedUrl || file.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                    <span className="material-icons text-white/50 text-xl">
                      {getFileType(file.filename) === "pdf"
                        ? "picture_as_pdf"
                        : getFileType(file.filename) === "office"
                          ? "table_chart"
                          : "insert_drive_file"}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default FilePreview;
