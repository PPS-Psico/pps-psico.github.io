import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isEmbeddedInMoodle,
  MoodleBridgeError,
  requestJefeMoodleTasks,
} from "../../lib/moodleBridge";
import { buildJefeMoodleBatches } from "./jefeMoodleBatches";
import { hasJefeMoodleSyncProblems } from "./jefeMoodleSyncStatus";
import { fetchJefeMoodleSyncTasks, syncJefeMoodleReports } from "./jefeService";
import type {
  JefeMoodleSyncState,
  JefeMoodleSyncStatus,
  JefeMoodleUnmatchedReason,
  JefeMoodleUnmatchedReasons,
} from "./types";

const recentlyStarted = new Map<string, number>();
const AUTO_SYNC_THROTTLE_MS = 60_000;

export const useJefeMoodleSync = (enabled: boolean, previewKey?: string): JefeMoodleSyncState => {
  const queryClient = useQueryClient();
  const startedRef = useRef(false);
  const inFlightRef = useRef(false);
  const [queueRefresh, setQueueRefresh] = useState(0);
  const [syncStatus, setSyncStatus] = useState<JefeMoodleSyncStatus>("idle");
  const [accepted, setAccepted] = useState(0);
  const [ambiguous, setAmbiguous] = useState(0);
  const [unmatched, setUnmatched] = useState(0);
  const [deduplicated, setDeduplicated] = useState(0);
  const [unmatchedExternal, setUnmatchedExternal] = useState(0);
  const [unmatchedReasons, setUnmatchedReasons] = useState<JefeMoodleUnmatchedReasons>({});
  const [failedTasks, setFailedTasks] = useState(0);
  const [noAccessTasks, setNoAccessTasks] = useState(0);
  const [lastObservedAt, setLastObservedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["jefe-moodle-sync-tasks-v1", previewKey ?? "self"],
    queryFn: () => fetchJefeMoodleSyncTasks(previewKey),
    enabled,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const refetchTasks = tasksQuery.refetch;
  const signature = useMemo(
    () =>
      tasks.length > 0
        ? `${previewKey ?? "self"}:${tasks[0].academic_year}:${tasks
            .map((task) => task.cmid)
            .sort((left, right) => left - right)
            .join(",")}`
        : "",
    [previewKey, tasks]
  );

  const runSync = useCallback(async () => {
    if (!enabled || tasksQuery.isLoading || inFlightRef.current) return;
    if (tasks.length === 0) {
      setSyncStatus("idle");
      setErrorMessage(null);
      return;
    }
    if (!isEmbeddedInMoodle()) {
      setSyncStatus("unavailable");
      setErrorMessage(null);
      return;
    }

    inFlightRef.current = true;
    setSyncStatus("syncing");
    setErrorMessage(null);
    setNoAccessTasks(0);
    try {
      const academicYears = new Set(tasks.map((task) => task.academic_year));
      if (academicYears.size !== 1) throw new MoodleBridgeError("invalid_response");

      const batches = buildJefeMoodleBatches(tasks.map((task) => task.cmid));
      let acceptedTotal = 0;
      let ambiguousTotal = 0;
      let unmatchedTotal = 0;
      let unmatchedExternalTotal = 0;
      const unmatchedReasonTotals: JefeMoodleUnmatchedReasons = {};
      let deduplicatedTotal = 0;
      let invalidTotal = 0;
      let failedTotal = 0;
      let noAccessTotal = 0;
      let successfulBatches = 0;
      let latestObservedAt: string | null = null;
      let lastBatchError: unknown = null;

      for (const batch of batches) {
        try {
          const bridgeResult = await requestJefeMoodleTasks(batch);
          const persisted = await syncJefeMoodleReports(
            tasks[0].academic_year,
            bridgeResult,
            previewKey
          );
          successfulBatches += 1;
          failedTotal += bridgeResult.tasks.filter(
            (task) => task.status !== "ok" || !!task.errorCode
          ).length;
          // Campus contesta el login cuando la sesión de Moodle venció: el
          // puente lo reporta como `no_access` tarea por tarea.
          noAccessTotal += bridgeResult.tasks.filter((task) => task.status === "no_access").length;
          acceptedTotal += persisted.accepted;
          ambiguousTotal += persisted.ambiguous;
          unmatchedTotal += persisted.unmatched;
          unmatchedExternalTotal += persisted.unmatched_external ?? 0;
          for (const [reason, count] of Object.entries(persisted.unmatched_reasons ?? {})) {
            if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) continue;
            const typedReason = reason as JefeMoodleUnmatchedReason;
            unmatchedReasonTotals[typedReason] = (unmatchedReasonTotals[typedReason] ?? 0) + count;
          }
          deduplicatedTotal += persisted.deduplicated ?? 0;
          invalidTotal += persisted.invalid;
          if (!latestObservedAt || persisted.observed_at > latestObservedAt) {
            latestObservedAt = persisted.observed_at;
          }
        } catch (error) {
          if (error instanceof MoodleBridgeError && error.code === "not_embedded") throw error;
          failedTotal += batch.length;
          lastBatchError = error;
        }
      }

      if (successfulBatches === 0)
        throw lastBatchError ?? new MoodleBridgeError("invalid_response");

      setAccepted(acceptedTotal);
      setAmbiguous(ambiguousTotal);
      setUnmatched(unmatchedTotal);
      setDeduplicated(deduplicatedTotal);
      setUnmatchedExternal(unmatchedExternalTotal);
      setUnmatchedReasons(unmatchedReasonTotals);
      setFailedTasks(failedTotal);
      setNoAccessTasks(noAccessTotal);
      setLastObservedAt(latestObservedAt);

      await queryClient.invalidateQueries({ queryKey: ["jefe-dashboard-v1"] });
      // Una fila interna sin vínculo queda aislada y auditada, pero no vuelve
      // parcial una sincronización cuyas tareas sí se leyeron correctamente.
      const isPartial = hasJefeMoodleSyncProblems({
        failedTasks: failedTotal,
        ambiguous: ambiguousTotal,
        invalid: invalidTotal,
      });
      setSyncStatus(isPartial ? "partial" : "synced");
    } catch (error) {
      if (error instanceof MoodleBridgeError && error.code === "not_embedded") {
        setSyncStatus("unavailable");
        setErrorMessage(null);
        return;
      }
      setSyncStatus("error");
      setErrorMessage(
        error instanceof MoodleBridgeError && error.code === "timeout"
          ? "Campus tardó demasiado en responder. Podés reintentar sin perder los datos guardados."
          : "No pudimos completar la lectura anual de Campus."
      );
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled, previewKey, queryClient, tasks, tasksQuery.isLoading]);

  useEffect(() => {
    if (!enabled || tasksQuery.isFetching || tasksQuery.isError || startedRef.current) return;
    if (!signature) {
      setSyncStatus("idle");
      return;
    }
    if (!isEmbeddedInMoodle()) {
      setSyncStatus("unavailable");
      return;
    }

    const lastStartedAt = recentlyStarted.get(signature) ?? 0;
    // A recent attempt may still be running or may have failed. Preserve this
    // instance's result and wait out the throttle instead of reporting success
    // or dropping a queue refresh that arrived just before the deadline.
    const delay = Math.max(300, AUTO_SYNC_THROTTLE_MS - (Date.now() - lastStartedAt));
    const timer = window.setTimeout(() => {
      if (inFlightRef.current) return;
      startedRef.current = true;
      recentlyStarted.set(signature, Date.now());
      void runSync();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, runSync, signature, tasksQuery.isError, tasksQuery.isFetching, queueRefresh]);

  // Drain later slices while the authorized Campus session stays open. Coverage
  // and retry budgets live in SQL, so reopening the panel resumes the queue.
  useEffect(() => {
    if (!enabled || !isEmbeddedInMoodle()) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      if (inFlightRef.current) return;
      void refetchTasks().then((result) => {
        if (disposed || !result.isSuccess) return;
        startedRef.current = false;
        // React Query may retain identical data and batch its fetching state.
        // A completed refresh must still wake retries of the same task slice.
        setQueueRefresh((value) => value + 1);
      });
    }, 60_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [enabled, refetchTasks]);

  const status: JefeMoodleSyncStatus = !enabled
    ? "idle"
    : tasksQuery.isLoading
      ? "loading"
      : tasksQuery.isError
        ? "error"
        : syncStatus;

  const retry = useCallback(async () => {
    if (tasksQuery.isError) {
      startedRef.current = false;
      await tasksQuery.refetch();
      return;
    }
    await runSync();
  }, [runSync, tasksQuery]);

  return {
    status,
    taskCount: tasks.length,
    accepted,
    ambiguous,
    unmatched,
    unmatchedInternal: Math.max(0, unmatched - unmatchedExternal),
    unmatchedReasons,
    deduplicated,
    failedTasks,
    campusSessionExpired: noAccessTasks > 0 && noAccessTasks === failedTasks,
    lastObservedAt,
    errorMessage: tasksQuery.isError
      ? "No pudimos obtener las tareas habilitadas para tu orientación."
      : errorMessage,
    retry,
  };
};
