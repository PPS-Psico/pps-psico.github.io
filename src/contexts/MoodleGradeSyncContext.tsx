import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useStudentPanel } from "./StudentPanelContext";
import { useMoodleTaskLinks } from "../hooks/useMoodleTaskLinks";
import {
  MOODLE_BRIDGE_VERSION,
  MOODLE_COURSE_ID,
  MoodleBridgeError,
  requestMoodleTasks,
} from "../lib/moodleBridge";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/supabase";
import { resolveExactMoodleTaskLink } from "../utils/moodleTaskResolution";

export type MoodleGradeSnapshot = Database["public"]["Tables"]["moodle_grade_snapshots"]["Row"];

export type MoodleGradeSyncStatus =
  | "idle"
  | "loading"
  | "syncing"
  | "synced"
  | "unavailable"
  | "error";

interface MoodleGradeSyncValue {
  snapshotsByPractice: Map<string, MoodleGradeSnapshot>;
  status: MoodleGradeSyncStatus;
  errorMessage: string | null;
  lastObservedAt: string | null;
  retry: () => Promise<void>;
}

const defaultValue: MoodleGradeSyncValue = {
  snapshotsByPractice: new Map(),
  status: "unavailable",
  errorMessage: null,
  lastObservedAt: null,
  retry: async () => {},
};

const MoodleGradeSyncContext = createContext<MoodleGradeSyncValue>(defaultValue);

export const MoodleGradeSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authenticatedUser, isSuperUserMode, isJefeMode, isDirectivoMode, isAdminTesterMode } =
    useAuth();
  const { studentId, practicas, isPracticasLoading } = useStudentPanel();
  const { links, isLoading: areLinksLoading } = useMoodleTaskLinks(!!studentId);
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<MoodleGradeSyncStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastAutoSignatureRef = useRef<string | null>(null);

  const isOwnStudentSession =
    !!studentId &&
    authenticatedUser?.studentId === studentId &&
    !isSuperUserMode &&
    !isJefeMode &&
    !isDirectivoMode &&
    !isAdminTesterMode;
  const isInsideParentFrame =
    typeof window !== "undefined" && window.parent !== window && window.self !== window.top;

  const assignments = useMemo(() => {
    const byCmid = new Map<string, string[]>();
    if (!isOwnStudentSession) return byCmid;
    practicas.forEach((practice) => {
      const task = resolveExactMoodleTaskLink(practice, links);
      if (!task) return;
      const practiceIds = byCmid.get(task.moodleId) ?? [];
      practiceIds.push(practice.id);
      byCmid.set(task.moodleId, practiceIds);
    });
    return byCmid;
  }, [isOwnStudentSession, links, practicas]);

  const practiceIds = useMemo(() => [...new Set([...assignments.values()].flat())], [assignments]);
  const snapshotsQuery = useQuery({
    queryKey: ["moodle-grade-snapshots", studentId, practiceIds],
    enabled: isOwnStudentSession && practiceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moodle_grade_snapshots")
        .select("*")
        .in("practica_id", practiceIds)
        .order("observed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
    retry: 1,
  });

  const snapshotsByPractice = useMemo(() => {
    const result = new Map<string, MoodleGradeSnapshot>();
    for (const snapshot of snapshotsQuery.data ?? []) {
      if (!result.has(snapshot.practica_id)) result.set(snapshot.practica_id, snapshot);
    }
    return result;
  }, [snapshotsQuery.data]);

  const lastObservedAt = useMemo(() => {
    let latest: string | null = null;
    snapshotsByPractice.forEach((snapshot) => {
      if (!latest || snapshot.observed_at > latest) latest = snapshot.observed_at;
    });
    return latest;
  }, [snapshotsByPractice]);

  const runSync = useCallback(async () => {
    if (!isOwnStudentSession || assignments.size === 0) return;
    if (!isInsideParentFrame) {
      setSyncStatus("unavailable");
      setErrorMessage(null);
      return;
    }

    setSyncStatus("syncing");
    setErrorMessage(null);
    try {
      const result = await requestMoodleTasks([...assignments.keys()]);
      const observations = result.tasks.flatMap((task) =>
        (assignments.get(String(task.cmid)) ?? []).map((practicaId) => ({
          practicaId,
          cmid: task.cmid,
          status: task.status,
          submitted: task.submitted,
          gradeValue: task.gradeValue,
          gradeMax: task.gradeMax,
          gradeDisplay: task.gradeDisplay,
          gradedAtDisplay: task.gradedAtDisplay,
        }))
      );
      if (observations.length === 0) throw new MoodleBridgeError("invalid_response");

      const { error } = await supabase.functions.invoke("ingest-moodle-grade-observation", {
        body: {
          requestId: result.requestId,
          bridgeVersion: MOODLE_BRIDGE_VERSION,
          courseId: MOODLE_COURSE_ID,
          observedAt: result.observedAt,
          moodleUserId: result.moodleUserId,
          moodleUsername: result.moodleUsername,
          observations,
        },
      });
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["moodle-grade-snapshots", studentId] }),
        // La Edge Function inserta la observacion y el trigger del servidor aplica
        // una eventual correccion en practicas.nota. Revalidamos el panel para que
        // Inicio y Practicas reflejen la nota sin que el alumno cambie de seccion.
        queryClient.invalidateQueries({ queryKey: ["practicas"] }),
      ]);
      setSyncStatus("synced");
    } catch (error) {
      if (error instanceof MoodleBridgeError && error.code === "not_embedded") {
        setSyncStatus("unavailable");
        setErrorMessage(null);
        return;
      }
      setSyncStatus("error");
      setErrorMessage(
        error instanceof MoodleBridgeError && error.code === "timeout"
          ? "Campus no respondió a tiempo. Podés reintentar sin perder los últimos datos guardados."
          : "No pudimos validar la respuesta de Campus. Reintentá desde la página del curso."
      );
    }
  }, [assignments, isInsideParentFrame, isOwnStudentSession, queryClient, studentId]);

  useEffect(() => {
    if (!isOwnStudentSession || isPracticasLoading || areLinksLoading) return;
    if (assignments.size === 0) {
      setSyncStatus("idle");
      return;
    }
    if (!isInsideParentFrame) {
      setSyncStatus("unavailable");
      return;
    }
    const signature = `${studentId}:${[...assignments.keys()].sort().join(",")}`;
    if (lastAutoSignatureRef.current === signature) return;
    const timer = window.setTimeout(() => {
      lastAutoSignatureRef.current = signature;
      void runSync();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    areLinksLoading,
    assignments,
    isInsideParentFrame,
    isOwnStudentSession,
    isPracticasLoading,
    runSync,
    studentId,
  ]);

  const status: MoodleGradeSyncStatus = snapshotsQuery.isLoading
    ? "loading"
    : syncStatus === "idle" && snapshotsByPractice.size > 0
      ? "synced"
      : syncStatus;

  const value = useMemo<MoodleGradeSyncValue>(
    () => ({ snapshotsByPractice, status, errorMessage, lastObservedAt, retry: runSync }),
    [errorMessage, lastObservedAt, runSync, snapshotsByPractice, status]
  );

  return (
    <MoodleGradeSyncContext.Provider value={value}>{children}</MoodleGradeSyncContext.Provider>
  );
};

export const useMoodleGradeSync = (): MoodleGradeSyncValue => useContext(MoodleGradeSyncContext);
