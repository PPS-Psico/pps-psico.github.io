import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";

const snapshot = {
  practica_id: "practice-1",
  cmid: 946366,
  latest_observation_id: "observation-1",
  estudiante_id: "student-selected",
  lanzamiento_id: "launch-1",
  aula_entrega_id: 1,
  task_status: "graded",
  submitted: true,
  grade_value: 90,
  grade_max: 100,
  grade_display: "90,00 / 100,00",
  graded_at_display: "lunes, 10 de agosto de 2026",
  observed_at: "2026-08-11T14:17:10.080Z",
  received_at: "2026-08-11T14:17:16.705Z",
  confidence: "moodle_session_observed",
};

const orderSpy = jest.fn(async (_column: string, _options: { ascending: boolean }) => ({
  data: [snapshot],
  error: null,
}));
const eqSpy = jest.fn((_column: string, _value: string) => ({ order: orderSpy }));
const selectSpy = jest.fn((_columns: string) => ({ eq: eqSpy }));
const fromSpy = jest.fn((_table: string) => ({ select: selectSpy }));
const requestMoodleTasksSpy = jest.fn(async (_cmids: string[]) => null);
const useMoodleTaskLinksSpy = jest.fn((_enabled: boolean) => ({
  links: [
    {
      practiceId: "practice-1",
      launchId: "",
      orientationKey: "",
      moodleId: "946366",
      name: "Tarea de prueba",
      area: "Clínica",
      academicYear: 2026,
    },
  ],
  isLoading: false,
}));

jest.mock("../AuthContext", () => ({
  useAuth: () => ({
    authenticatedUser: { studentId: "admin-profile" },
    isSuperUserMode: true,
    isJefeMode: false,
    isDirectivoMode: false,
    isAdminTesterMode: false,
  }),
}));

jest.mock("../StudentPanelContext", () => ({
  useStudentPanel: () => ({
    studentId: "student-selected",
    practicas: [{ id: "practice-1" }],
    isPracticasLoading: false,
  }),
}));

jest.mock("../../hooks/useMoodleTaskLinks", () => ({
  useMoodleTaskLinks: (enabled: boolean) => useMoodleTaskLinksSpy(enabled),
}));

jest.mock("../../lib/moodleBridge", () => ({
  MOODLE_BRIDGE_VERSION: "test",
  MOODLE_COURSE_ID: 3615,
  MoodleBridgeError: class MoodleBridgeError extends Error {},
  requestMoodleTasks: (cmids: string[]) => requestMoodleTasksSpy(cmids),
}));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromSpy(table),
    functions: { invoke: jest.fn() },
  },
}));

const { MoodleGradeSyncProvider, useMoodleGradeSync } = require("../MoodleGradeSyncContext");

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MoodleGradeSyncProvider>{children}</MoodleGradeSyncProvider>
    </QueryClientProvider>
  );
};

describe("MoodleGradeSyncProvider — lectura administrativa", () => {
  beforeEach(() => {
    orderSpy.mockClear();
    eqSpy.mockClear();
    selectSpy.mockClear();
    fromSpy.mockClear();
    requestMoodleTasksSpy.mockClear();
    useMoodleTaskLinksSpy.mockClear();
  });

  it("lee el último snapshot del estudiante seleccionado sin consultar Moodle", async () => {
    const { result } = renderHook(() => useMoodleGradeSync(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.status).toBe("synced"));

    expect(fromSpy).toHaveBeenCalledWith("moodle_grade_snapshots");
    expect(eqSpy).toHaveBeenCalledWith("estudiante_id", "student-selected");
    expect(result.current.lastObservedAt).toBe(snapshot.observed_at);
    expect(result.current.snapshotsByPractice.get("practice-1")?.grade_value).toBe(90);
    // Coordinación necesita el vínculo vigente para no mostrar como actual un
    // snapshot perteneciente a una tarea que luego fue remapeada.
    expect(useMoodleTaskLinksSpy).toHaveBeenCalledWith(true);
    expect(requestMoodleTasksSpy).not.toHaveBeenCalled();
  });
});
