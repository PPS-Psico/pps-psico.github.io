import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isEmbeddedInMoodle,
  MoodleBridgeError,
  requestJefeMoodleTasks,
} from "../../lib/moodleBridge";
import { fetchJefeMoodleSyncTasks, syncJefeMoodleReports } from "./jefeService";
import type { JefeMoodleSyncState, JefeMoodleSyncStatus } from "./types";

const recentlyStarted = new Map<string, number>();
const AUTO_SYNC_THROTTLE_MS = 60_000;

export const useJefeMoodleSync = (enabled: boolean, previewKey?: string): JefeMoodleSyncState => {
  const queryClient = useQueryClient();
  const startedRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState<JefeMoodleSyncStatus>("idle");
  const [accepted, setAccepted] = useState(0);
  const [ambiguous, setAmbiguous] = useState(0);
  const [unmatched, setUnmatched] = useState(0);
  const [failedTasks, setFailedTasks] = useState(0);
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
    if (!enabled || tasksQuery.isLoading) return;
    if (tasks.length === 0) {
      setSyncStatus("complete");
      setErrorMessage(null);
      return;
    }
    if (!isEmbeddedInMoodle()) {
      setSyncStatus("unavailable");
      setErrorMessage(null);
      return;
    }

    setSyncStatus("syncing");
    setErrorMessage(null);
    try {
      const bridgeResult = await requestJefeMoodleTasks(tasks.map((task) => task.cmid));
      const academicYears = new Set(tasks.map((task) => task.academic_year));
      if (academicYears.size !== 1) throw new MoodleBridgeError("invalid_response");

      const failed = bridgeResult.tasks.filter((task) => task.status !== "ok").length;
      const persisted = await syncJefeMoodleReports(
        tasks[0].academic_year,
        bridgeResult,
        previewKey
      );
      setAccepted(persisted.accepted);
      setAmbiguous(persisted.ambiguous);
      setUnmatched(persisted.unmatched);
      setFailedTasks(failed);
      setLastObservedAt(persisted.observed_at);

      await queryClient.invalidateQueries({ queryKey: ["jefe-dashboard-v1"] });
      const isPartial = failed > 0 || persisted.ambiguous > 0 || persisted.invalid > 0;
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
    }
  }, [enabled, previewKey, queryClient, tasks, tasksQuery.isLoading]);

  useEffect(() => {
    if (!enabled || tasksQuery.isLoading || tasksQuery.isError || startedRef.current) return;
    startedRef.current = true;
    if (!signature) {
      setSyncStatus("complete");
      return;
    }
    if (!isEmbeddedInMoodle()) {
      setSyncStatus("unavailable");
      return;
    }

    const lastStartedAt = recentlyStarted.get(signature) ?? 0;
    if (Date.now() - lastStartedAt < AUTO_SYNC_THROTTLE_MS) {
      setSyncStatus("synced");
      return;
    }
    const timer = window.setTimeout(() => {
      recentlyStarted.set(signature, Date.now());
      void runSync();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [enabled, runSync, signature, tasksQuery.isError, tasksQuery.isLoading]);

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
    failedTasks,
    lastObservedAt,
    errorMessage: tasksQuery.isError
      ? "No pudimos obtener las tareas habilitadas para tu orientación."
      : errorMessage,
    retry,
  };
};
