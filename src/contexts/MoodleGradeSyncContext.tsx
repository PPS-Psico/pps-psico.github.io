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
import type { MoodleGradeConversionMode } from "../domain/moodle/moodleReportStatus";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/supabase";
import {
  buildPendingMoodleAssignments,
  selectCurrentMoodleSnapshots,
} from "../utils/moodleTaskResolution";

/**
 * El snapshot no guarda la escala de la tarea: vive en `aula_entregas`. Sin
 * ella no se puede interpretar una nota como "8,00 / 100,00", que según el
 * contrato de la tarea puede valer 8 o 0,8.
 */
export type MoodleGradeSnapshot = Database["public"]["Tables"]["moodle_grade_snapshots"]["Row"] & {
  grade_conversion_mode: MoodleGradeConversionMode | null;
};

export type MoodleGradeSyncStatus =
  | "idle"
  | "loading"
  | "syncing"
  | "synced"
  | "partial"
  | "complete"
  | "unavailable"
  | "error";

interface MoodleGradeSyncValue {
  snapshotsByPractice: Map<string, MoodleGradeSnapshot>;
  status: MoodleGradeSyncStatus;
  errorMessage: string | null;
  lastObservedAt: string | null;
  retry: () => Promise<void>;
  canReopenGrades: boolean;
  reopenGrade: (practicaId: string, cmid: number, reason: string) => Promise<void>;
}

const defaultValue: MoodleGradeSyncValue = {
  snapshotsByPractice: new Map(),
  status: "unavailable",
  errorMessage: null,
  lastObservedAt: null,
  retry: async () => {},
  canReopenGrades: false,
  reopenGrade: async () => {},
};

const MoodleGradeSyncContext = createContext<MoodleGradeSyncValue>(defaultValue);

export const MoodleGradeSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authenticatedUser, isSuperUserMode, isJefeMode, isDirectivoMode, isAdminTesterMode } =
    useAuth();
  const { studentId, practicas, isPracticasLoading } = useStudentPanel();
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<MoodleGradeSyncStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastAutoSignatureRef = useRef<string | null>(null);

  const isPrivilegedViewer = isSuperUserMode || isJefeMode || isDirectivoMode || isAdminTesterMode;
  const isOwnStudentSession =
    !!studentId && authenticatedUser?.studentId === studentId && !isPrivilegedViewer;
  const canReadSnapshots = !!studentId && (isOwnStudentSession || isPrivilegedViewer);
  const { links, isLoading: areLinksLoading } = useMoodleTaskLinks(canReadSnapshots);
  const isInsideParentFrame =
    typeof window !== "undefined" && window.parent !== window && window.self !== window.top;

  const snapshotsQuery = useQuery({
    queryKey: ["moodle-grade-snapshots", studentId],
    enabled: canReadSnapshots,
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("moodle_grade_snapshots")
        .select("*, aula_entregas(grade_conversion_mode)")
        .eq("estudiante_id", studentId)
        .order("observed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const { aula_entregas: task, ...snapshot } = row as typeof row & {
          aula_entregas: { grade_conversion_mode: string | null } | null;
        };
        return {
          ...snapshot,
          grade_conversion_mode:
            (task?.grade_conversion_mode as MoodleGradeConversionMode | null) ?? null,
        } as MoodleGradeSnapshot;
      });
    },
    staleTime: 60_000,
    retry: 1,
  });

  const snapshotsByPractice = useMemo(() => {
    return selectCurrentMoodleSnapshots(practicas, links, snapshotsQuery.data ?? []);
  }, [links, practicas, snapshotsQuery.data]);

  const assignments = useMemo(() => {
    if (!isOwnStudentSession || snapshotsQuery.isLoading) return new Map<string, string[]>();
    // La primera calificación completa cierra esta tarea. El snapshot queda
    // disponible para alumno y coordinación, pero ya no se vuelve a pedir a
    // Moodle en cada ingreso.
    return buildPendingMoodleAssignments(practicas, links, snapshotsByPractice);
  }, [isOwnStudentSession, links, practicas, snapshotsByPractice, snapshotsQuery.isLoading]);

  const lastObservedAt = useMemo(() => {
    let latest: string | null = null;
    snapshotsByPractice.forEach((snapshot) => {
      const observedAt = snapshot.last_observed_at || snapshot.observed_at;
      if (!latest || observedAt > latest) latest = observedAt;
    });
    return latest;
  }, [snapshotsByPractice]);

  const runSync = useCallback(async () => {
    if (!isOwnStudentSession) return;
    if (assignments.size === 0) {
      setSyncStatus(practicas.length > 0 ? "complete" : "idle");
      setErrorMessage(null);
      return;
    }
    if (!isInsideParentFrame) {
      setSyncStatus("unavailable");
      setErrorMessage(null);
      return;
    }

    setSyncStatus("syncing");
    setErrorMessage(null);
    try {
      const cmids = [...assignments.keys()];
      const batches = Array.from({ length: Math.ceil(cmids.length / 20) }, (_, index) =>
        cmids.slice(index * 20, index * 20 + 20)
      );
      let rejectedCount = 0;

      for (const batch of batches) {
        const result = await requestMoodleTasks(batch);
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
            submittedAt: task.submittedAt ?? null,
            submittedAtDisplay: task.submittedAtDisplay ?? null,
            submissionFiles: task.submissionFiles ?? null,
          }))
        );
        if (observations.length === 0) throw new MoodleBridgeError("invalid_response");

        const { data, error } = await supabase.functions.invoke("ingest-moodle-grade-observation", {
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
        if (data && typeof data === "object" && Array.isArray(data.rejected)) {
          rejectedCount += data.rejected.length;
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["moodle-grade-snapshots", studentId] }),
        // La Edge Function inserta la observacion y el trigger del servidor aplica
        // una eventual correccion en practicas.nota. Revalidamos el panel para que
        // Inicio y Practicas reflejen la nota sin que el alumno cambie de seccion.
        queryClient.invalidateQueries({ queryKey: ["practicas"] }),
      ]);
      if (rejectedCount > 0) {
        setSyncStatus("partial");
        setErrorMessage(
          `Campus respondió, pero ${rejectedCount} ${rejectedCount === 1 ? "tarea requiere" : "tareas requieren"} revisión. Conservamos el último estado confirmado.`
        );
      } else {
        setSyncStatus("synced");
      }
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
  }, [
    assignments,
    isInsideParentFrame,
    isOwnStudentSession,
    practicas.length,
    queryClient,
    studentId,
  ]);

  useEffect(() => {
    if (!isOwnStudentSession || isPracticasLoading || areLinksLoading) return;
    if (assignments.size === 0) {
      setSyncStatus(practicas.length > 0 ? "complete" : "idle");
      setErrorMessage(null);
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
    practicas.length,
    runSync,
    studentId,
  ]);

  const status: MoodleGradeSyncStatus = snapshotsQuery.isLoading
    ? "loading"
    : snapshotsQuery.isError
      ? "error"
      : syncStatus === "idle" && snapshotsByPractice.size > 0
        ? "synced"
        : syncStatus;

  const resolvedErrorMessage = snapshotsQuery.isError
    ? "No pudimos leer el último registro guardado del Campus."
    : errorMessage;

  const reopenGrade = useCallback(
    async (practicaId: string, cmid: number, reason: string) => {
      if (!isPrivilegedViewer) throw new Error("Acceso restringido a coordinación.");
      const cleanReason = reason.trim();
      if (cleanReason.length < 8) throw new Error("Indicá un motivo de al menos 8 caracteres.");
      const { error } = await supabase.from("moodle_grade_reopen_events").insert({
        practica_id: practicaId,
        cmid,
        reason: cleanReason,
        previous_revision: 0,
        new_revision: 1,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["moodle-grade-snapshots", studentId] });
    },
    [isPrivilegedViewer, queryClient, studentId]
  );

  const value = useMemo<MoodleGradeSyncValue>(
    () => ({
      snapshotsByPractice,
      status,
      errorMessage: resolvedErrorMessage,
      lastObservedAt,
      retry: runSync,
      canReopenGrades: isPrivilegedViewer,
      reopenGrade,
    }),
    [
      isPrivilegedViewer,
      lastObservedAt,
      reopenGrade,
      resolvedErrorMessage,
      runSync,
      snapshotsByPractice,
      status,
    ]
  );

  return (
    <MoodleGradeSyncContext.Provider value={value}>{children}</MoodleGradeSyncContext.Provider>
  );
};

export const useMoodleGradeSync = (): MoodleGradeSyncValue => useContext(MoodleGradeSyncContext);
