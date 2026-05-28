import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EmailDraft } from "../../hooks/useAgentSuggestions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailDraftReviewModalProps {
  draft: EmailDraft | null;
  onClose: () => void;
  onApprove: (id: string, editedText: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const EmailDraftReviewModal: React.FC<EmailDraftReviewModalProps> = ({
  draft,
  onClose,
  onApprove,
  onDiscard,
}) => {
  const [editedText, setEditedText] = useState(draft?.borrador ?? "");
  const [isApproving, setIsApproving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedText(draft?.borrador ?? "");
  }, [draft?.id]);

  useEffect(() => {
    if (draft && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [draft]);

  if (!draft) return null;

  const isDirty = editedText !== draft.borrador;
  const confidencePct = Math.round(draft.confidence * 100);
  const confidenceColor =
    confidencePct >= 85
      ? "text-emerald-600 dark:text-emerald-400"
      : confidencePct >= 70
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(draft.id, editedText);
      onClose();
    } finally {
      setIsApproving(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    try {
      await onDiscard(draft.id);
      onClose();
    } finally {
      setIsDiscarding(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-icons text-violet-500 !text-lg">smart_toy</span>
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Hermes · Borrador generado
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white truncate">
                {draft.subject}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span className="material-icons !text-sm">business</span>
                {draft.to}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Confianza IA
                </p>
                <p className={`text-xl font-black ${confidenceColor}`}>{confidencePct}%</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-icons text-slate-500 !text-xl">close</span>
              </button>
            </div>
          </div>

          {/* AI Justification */}
          {draft.justificacion && (
            <div className="px-6 py-3 bg-violet-50 dark:bg-violet-900/10 border-b border-violet-100 dark:border-violet-800/30 flex items-start gap-2">
              <span className="material-icons text-violet-500 !text-base mt-0.5">psychology</span>
              <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
                <span className="font-bold">¿Por qué este borrador?</span> {draft.justificacion}
              </p>
            </div>
          )}

          {/* Email body editor */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Cuerpo del email
              </label>
              {isDirty && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <span className="material-icons !text-xs">edit</span>
                  Modificado
                </span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full min-h-[280px] p-4 text-sm font-mono rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition-all leading-relaxed"
              placeholder="El borrador aparecerá aquí..."
              spellCheck
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button
              onClick={handleDiscard}
              disabled={isDiscarding || isApproving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-900/10 dark:hover:text-rose-400 dark:hover:border-rose-800 transition-all disabled:opacity-50"
            >
              {isDiscarding ? (
                <span className="material-icons animate-spin !text-base">progress_activity</span>
              ) : (
                <span className="material-icons !text-base">delete_outline</span>
              )}
              Descartar
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Cerrar
            </button>
            <button
              onClick={handleApprove}
              disabled={isApproving || isDiscarding}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving ? (
                <span className="material-icons animate-spin !text-base">progress_activity</span>
              ) : (
                <span className="material-icons !text-base">check_circle</span>
              )}
              {isDirty ? "Guardar y Aprobar" : "Aprobar borrador"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmailDraftReviewModal;
