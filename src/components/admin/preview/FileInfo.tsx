import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Attachment } from "../../../utils/attachmentUtils";

interface FileInfoButtonProps {
  onClick: () => void;
}

export const FileInfoButton: React.FC<FileInfoButtonProps> = ({ onClick }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
    title="Información del archivo (Ctrl+I)"
  >
    <span className="material-icons">info</span>
  </motion.button>
);

interface FileInfoProps {
  isOpen: boolean;
  onClose: () => void;
  file: Attachment;
  fileType: string;
}

export const FileInfo: React.FC<FileInfoProps> = ({ isOpen, onClose, file, fileType }) => {
  if (!isOpen) return null;

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return "picture_as_pdf";
      case "office":
        return "table_chart";
      case "image":
        return "image";
      default:
        return "insert_drive_file";
    }
  };

  const getMimeType = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  };

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-full max-w-md"
          >
            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <span className="material-icons text-blue-400">{getFileIcon(fileType)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Información del archivo</h3>
                    <p className="text-sm text-gray-400">Detalles técnicos</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <span className="material-icons">close</span>
                </motion.button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <InfoRow label="Nombre" value={file.filename} />
                  <InfoRow label="Tipo" value={fileType.toUpperCase()} />
                  <InfoRow label="MIME Type" value={getMimeType(file.filename)} isCode />
                  <InfoRow label="URL" value={truncateUrl(file.url)} isCode />
                </div>

                <div className="pt-4 border-t border-white/10">
                  <motion.a
                    href={file.signedUrl || file.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium transition-all"
                  >
                    <span className="material-icons">download</span>
                    Descargar archivo
                  </motion.a>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

interface InfoRowProps {
  label: string;
  value?: string;
  isCode?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, isCode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
    <span
      className={`text-sm text-gray-200 break-all ${isCode ? "font-mono text-xs bg-slate-800 px-2 py-1 rounded" : ""}`}
    >
      {value || "—"}
    </span>
  </div>
);

export default FileInfo;
