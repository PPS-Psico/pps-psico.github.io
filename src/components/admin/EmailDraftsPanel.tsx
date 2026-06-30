import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EmailDraft } from "../../hooks/useAgentSuggestions";
import EmailDraftReviewModal from "./EmailDraftReviewModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailDraftsPanelProps {
  drafts: EmailDraft[];
  isLoading: boolean;
  onApprove: (id: string, editedText: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const EmailDraftsPanel: React.FC<EmailDraftsPanelProps> = ({
  drafts,
  isLoading,
  onApprove,
  onDiscard,
}) => {
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  const handleQuickDiscard = async (draft: EmailDraft) => {
    if (!confirm(`¿Descartar el borrador para "${draft.to}"?`)) return;
    setDiscardingId(draft.id);
    try {
      await onDiscard(draft.id);
    } finally {
      setDiscardingId(null);
    }
  };

  // Don't render if no drafts and not loading
  if (!isLoading && drafts.length === 0) return null;

  return (
    <>
      <section className="space-y-3">
        {/* Section header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-6 bg-violet-500 rounded-full" />
            <div className="flex items-center gap-2">
              <span className="material-icons text-violet-500 !text-lg">smart_toy</span>
              <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider">
                Borradores de Email
              </h3>
            </div>
            {!isLoading && drafts.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-black">
                {drafts.length}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Generados por Hermes · Requieren revisión
          </p>
        </div>

        {/* Draft list */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {isLoading
              ? // Skeleton
                [1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[68px] rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                  />
                ))
              : drafts.map((draft, idx) => {
                  const confidencePct = Math.round(draft.confidence * 100);
                  const isHighConf = confidencePct >= 85;
                  const isMedConf = confidencePct >= 70;

                  return (
                    <motion.div
                      key={draft.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40, scale: 0.96 }}
                      transition={{ delay: idx * 0.04 }}
                      className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition duration-200"
                    >
                      {/* Confidence indicator */}
                      <div
                        className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black ${
                          isHighConf
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                            : isMedConf
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
                        }`}
                      >
                        {confidencePct}%
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                          {draft.to}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {draft.subject}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleQuickDiscard(draft)}
                          disabled={discardingId === draft.id}
                          className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 dark:hover:bg-rose-900/10 dark:hover:border-rose-800 dark:hover:text-rose-400 text-slate-400 transition"
                          title="Descartar"
                        >
                          {discardingId === draft.id ? (
                            <span className="material-icons animate-spin !text-sm">
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-icons !text-sm">delete_outline</span>
                          )}
                        </button>
                        <button
                          onClick={() => setSelectedDraft(draft)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-sm shadow-violet-500/20 transition"
                        >
                          <span className="material-icons !text-sm">edit_note</span>
                          Revisar
                        </button>
                      </div>

                      {/* Always-visible review button on narrow screens */}
                      <button
                        onClick={() => setSelectedDraft(draft)}
                        className="group-hover:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 transition"
                      >
                        <span className="material-icons !text-sm">edit_note</span>
                        Revisar
                      </button>
                    </motion.div>
                  );
                })}
          </AnimatePresence>
        </div>
      </section>

      {/* Review Modal */}
      {selectedDraft && (
        <EmailDraftReviewModal
          draft={selectedDraft}
          onClose={() => setSelectedDraft(null)}
          onApprove={async (id, text) => {
            await onApprove(id, text);
            setSelectedDraft(null);
          }}
          onDiscard={async (id) => {
            await onDiscard(id);
            setSelectedDraft(null);
          }}
        />
      )}
    </>
  );
};

export default EmailDraftsPanel;
