import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isEmbeddedInMoodle,
  MoodleBridgeError,
  requestJefeMoodlePage,
  supportsJefeMoodlePages,
} from "../../lib/moodleBridge";
import { claimJefePage, commitJefePage, failJefePage, fetchJefePageQueue } from "./jefeMoodlePages";
import type { JefeMoodleSyncState } from "./types";

// A render, query invalidation or interval never clears a failed attempt.
const attempts = new Map<string, { next: number; stopped: boolean }>();
const running = new Set<string>();
const MAX_PAGES = 4;
const RUN_BUDGET_MS = 45_000;
const empty = {
  status: "idle" as const,
  taskCount: 0,
  accepted: 0,
  ambiguous: 0,
  unmatched: 0,
  unmatchedInternal: 0,
  unmatchedReasons: {},
  deduplicated: 0,
  failedTasks: 0,
  campusSessionExpired: false,
  lastObservedAt: null,
  errorMessage: null,
  pagesSaved: 0,
  pendingTasks: 0,
  history: false,
  currentTask: null,
};
type ViewState = Omit<JefeMoodleSyncState, "retry" | "pause" | "reviewHistory">;

export const useJefeMoodleSync = (enabled: boolean, previewKey?: string): JefeMoodleSyncState => {
  const client = useQueryClient();
  const [state, setState] = useState<ViewState>(empty);
  const active = useRef(false);
  const stopped = useRef(false);
  const generation = useRef(0);
  const historyMode = useRef(false);
  const key = previewKey ?? "self";

  const run = useCallback(
    async (manual: boolean, history: boolean) => {
      if (!enabled || active.current || running.has(key)) return;
      const ownGeneration = generation.current;
      const current = () => ownGeneration === generation.current;
      const update = (value: Partial<ViewState>) => {
        if (current()) setState((old) => ({ ...old, ...value }));
      };
      if (!isEmbeddedInMoodle()) {
        update({ status: "unavailable" });
        return;
      }
      active.current = true;
      running.add(key);
      stopped.current = false;
      historyMode.current = history;
      attempts.set(key, { next: Date.now(), stopped: false });
      update({ ...empty, status: "loading", history });
      let saved = 0;
      let accepted = 0;
      let completed = 0;
      let pending = 0;
      try {
        if (!(await supportsJefeMoodlePages())) {
          attempts.set(key, { next: Date.now(), stopped: true });
          update({
            status: "unavailable",
            errorMessage:
              "El puente de Campus necesita actualizarse para leer por páginas. Conservamos los informes guardados.",
          });
          return;
        }
        const startedAt = Date.now();
        while (
          current() &&
          !stopped.current &&
          saved < MAX_PAGES &&
          Date.now() - startedAt < RUN_BUDGET_MS
        ) {
          const queue = await fetchJefePageQueue(previewKey, history, manual);
          if (!current() || stopped.current) break;
          pending = queue.pending;
          update({ pendingTasks: pending });
          if (queue.tasks.length === 0) {
            if (queue.paused > 0)
              throw new Error(
                "Hay tareas pausadas por errores anteriores. Reintentá cuando Campus esté disponible."
              );
            break;
          }
          const task = queue.tasks[0];
          const claim = await claimJefePage(task.cmid, previewKey, manual);
          if (claim.status !== "claimed") break;
          // Once claimed, finish this page even if the view was closed or
          // paused while claiming. Navigation is not a transport failure.
          update({
            status: "syncing",
            currentTask: `${task.task_name} · página ${claim.page + 1}`,
          });
          let payload;
          try {
            payload = await requestJefeMoodlePage(claim.cmid, claim.page);
          } catch (error) {
            await failJefePage(claim.lease, previewKey).catch(() => undefined);
            throw error;
          }
          // Finish saving the current page even after pause/unmount. If the RPC
          // times out, leave the lease alone: its transaction may still commit.
          const receipt = await commitJefePage(claim.lease, payload, previewKey);
          accepted += receipt.accepted;
          if (receipt.status !== "paused") saved += 1;
          if (receipt.status === "complete") {
            completed += 1;
            pending = Math.max(0, pending - 1);
          }
          update({
            accepted,
            pagesSaved: saved,
            taskCount: completed,
            pendingTasks: pending,
            lastObservedAt: receipt.observedAt,
            campusSessionExpired: payload.task.errorCode === "campus_session_expired",
          });
          if (current())
            void client
              .invalidateQueries({ queryKey: ["jefe-dashboard-v1"] })
              .catch(() => undefined);
          if (receipt.status === "paused")
            throw new Error(
              "Campus devolvió una página incompleta. Guardamos la evidencia válida y pausamos la lectura; podés reintentar."
            );
        }
        if (!current()) return;
        const paused = stopped.current;
        attempts.set(key, {
          // Healthy batches continue promptly. A busy queue backs off instead
          // of repeatedly claiming a lease owned by another tab.
          next: Date.now() + (pending > 0 ? (saved > 0 ? 2_000 : 60_000) : 5 * 60_000),
          stopped: paused || history,
        });
        update({
          status: pending > 0 || paused ? "partial" : "synced",
          currentTask: null,
          errorMessage: paused ? "Lectura pausada. El avance quedó guardado." : null,
        });
      } catch (error) {
        attempts.set(key, { next: Date.now(), stopped: true });
        update({
          status: accepted > 0 || saved > 0 ? "partial" : "error",
          failedTasks: 1,
          currentTask: null,
          errorMessage:
            error instanceof MoodleBridgeError
              ? error.code === "timeout"
                ? "Campus tardó demasiado. La lectura quedó pausada y el avance guardado se conserva."
                : "La respuesta de Campus no pudo validarse. La lectura quedó pausada."
              : error instanceof Error && error.message
                ? error.message
                : "No pudimos completar la lectura. El avance guardado se conserva.",
        });
      } finally {
        active.current = false;
        running.delete(key);
      }
    },
    [client, enabled, key, previewKey]
  );

  useEffect(() => {
    const ownGeneration = ++generation.current;
    setState(
      attempts.get(key)?.stopped
        ? {
            ...empty,
            status: "partial",
            errorMessage: "La lectura quedó pausada. Podés continuar desde el avance guardado.",
          }
        : empty
    );
    const tick = () => {
      const attempt = attempts.get(key);
      if (
        enabled &&
        !active.current &&
        !running.has(key) &&
        !attempt?.stopped &&
        (!attempt || attempt.next <= Date.now())
      )
        void run(false, false);
    };
    const initial = window.setTimeout(tick, 300);
    const interval = window.setInterval(tick, 1_000);
    return () => {
      if (generation.current === ownGeneration) generation.current += 1;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [enabled, key, run]);

  const pause = useCallback(() => {
    stopped.current = true;
    attempts.set(key, { next: Date.now(), stopped: true });
    setState((old) => ({
      ...old,
      errorMessage: active.current
        ? "Guardando la página en curso antes de pausar…"
        : "Lectura pausada. El avance quedó guardado.",
    }));
  }, [key]);
  const retry = useCallback(() => run(true, historyMode.current), [run]);
  const reviewHistory = useCallback(() => run(true, true), [run]);
  return { ...state, retry, pause, reviewHistory };
};
