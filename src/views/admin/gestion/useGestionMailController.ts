import { useCallback, useEffect, useRef, useState } from "react";
import type { GmailHilo } from "../../../hooks/useGmailHilos";
import {
  generatePendingDrafts,
  modifyThread,
  type GmailAction,
} from "../../../services/gmailService";
import { LS_GV3_MAILS_SEEN } from "../../../constants/uiConstants";

const UNDO_MS = 5000;

interface UndoMailEntry {
  key: string;
  hilo: GmailHilo;
  action: GmailAction;
  label: string;
}

interface UseGestionMailControllerOptions {
  isTestingMode: boolean;
  showToast: (message: string, icon?: string) => void;
  refetchGmail: () => unknown;
  refetchDrafts: () => unknown;
}

export const useGestionMailController = ({
  isTestingMode,
  showToast,
  refetchGmail,
  refetchDrafts,
}: UseGestionMailControllerOptions) => {
  const [openMailHilo, setOpenMailHilo] = useState<GmailHilo | null>(null);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  const [busyThreads, setBusyThreads] = useState<Set<string>>(new Set());
  const [hiddenThreads, setHiddenThreads] = useState<Set<string>>(new Set());
  const [undoQueue, setUndoQueue] = useState<UndoMailEntry[]>([]);
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [seenThreads, setSeenThreads] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LS_GV3_MAILS_SEEN);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const persistSeen = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(LS_GV3_MAILS_SEEN, JSON.stringify([...next].slice(-500)));
    } catch {
      /* noop */
    }
  }, []);

  const handleGenerateDrafts = useCallback(async () => {
    setGeneratingDrafts(true);
    const result = await generatePendingDrafts(10);
    setGeneratingDrafts(false);
    if (result) {
      showToast(
        result.generados > 0
          ? `Hermes preparó ${result.generados} ${result.generados === 1 ? "borrador" : "borradores"}`
          : "No había correos nuevos para responder",
        "auto_awesome"
      );
      refetchDrafts();
    } else {
      showToast("No se pudo generar borradores ahora", "error");
    }
  }, [showToast, refetchDrafts]);

  const commitMailAction = useCallback(
    async (entry: UndoMailEntry) => {
      undoTimers.current.delete(entry.key);
      setUndoQueue((queue) => queue.filter((item) => item.key !== entry.key));
      if (isTestingMode) {
        setHiddenThreads((threads) => {
          const next = new Set(threads);
          next.delete(entry.hilo.thread_id);
          return next;
        });
        showToast("Modo demo: acción no aplicada", "info");
        return;
      }

      setBusyThreads((threads) => new Set(threads).add(entry.hilo.thread_id));
      const result = await modifyThread(entry.hilo.thread_id, entry.action);
      setBusyThreads((threads) => {
        const next = new Set(threads);
        next.delete(entry.hilo.thread_id);
        return next;
      });

      if (result.success) {
        if (result.dryRun) showToast("Modo seguro: no se aplicó el cambio", "info");
        refetchGmail();
        refetchDrafts();
      } else {
        setHiddenThreads((threads) => {
          const next = new Set(threads);
          next.delete(entry.hilo.thread_id);
          return next;
        });
        showToast(`No se pudo completar: ${result.message || "error"}`, "error");
      }
    },
    [isTestingMode, showToast, refetchGmail, refetchDrafts]
  );

  const queueMailAction = useCallback(
    (hilo: GmailHilo, action: GmailAction, label: string) => {
      const key = `${hilo.thread_id}:${Date.now()}`;
      const entry = { key, hilo, action, label };
      setHiddenThreads((threads) => new Set(threads).add(hilo.thread_id));
      if (openMailHilo?.thread_id === hilo.thread_id) setOpenMailHilo(null);
      setUndoQueue((queue) => [...queue, entry]);
      const timer = setTimeout(() => void commitMailAction(entry), UNDO_MS);
      undoTimers.current.set(key, timer);
    },
    [openMailHilo, commitMailAction]
  );

  const undoMailAction = useCallback((key: string, threadId: string) => {
    const timer = undoTimers.current.get(key);
    if (timer) clearTimeout(timer);
    undoTimers.current.delete(key);
    setUndoQueue((queue) => queue.filter((entry) => entry.key !== key));
    setHiddenThreads((threads) => {
      const next = new Set(threads);
      next.delete(threadId);
      return next;
    });
  }, []);

  const handleArchiveMail = useCallback(
    (hilo: GmailHilo) => queueMailAction(hilo, "archive", "Hilo archivado"),
    [queueMailAction]
  );

  const handleDiscardMail = useCallback(
    (hilo: GmailHilo) => queueMailAction(hilo, "trash", "Correo descartado a papelera"),
    [queueMailAction]
  );

  const toggleSeenMail = useCallback(
    (hilo: GmailHilo) => {
      const wasSeen = seenThreads.has(hilo.thread_id);
      setSeenThreads((threads) => {
        const next = new Set(threads);
        if (wasSeen) next.delete(hilo.thread_id);
        else next.add(hilo.thread_id);
        persistSeen(next);
        return next;
      });
      if (!isTestingMode) {
        void modifyThread(hilo.thread_id, wasSeen ? "markUnread" : "markRead");
      }
    },
    [seenThreads, persistSeen, isTestingMode]
  );

  const markSeen = useCallback(
    (hilo: GmailHilo) => {
      if (seenThreads.has(hilo.thread_id)) return;
      setSeenThreads((threads) => {
        const next = new Set(threads).add(hilo.thread_id);
        persistSeen(next);
        return next;
      });
    },
    [seenThreads, persistSeen]
  );

  useEffect(() => {
    const timers = undoTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return {
    openMailHilo,
    setOpenMailHilo,
    generatingDrafts,
    busyThreads,
    hiddenThreads,
    undoQueue,
    seenThreads,
    handleGenerateDrafts,
    handleArchiveMail,
    handleDiscardMail,
    undoMailAction,
    toggleSeenMail,
    markSeen,
  };
};
