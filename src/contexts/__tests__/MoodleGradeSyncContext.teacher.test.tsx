import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
const mockTasks = jest.fn();
const mockCapture = jest.fn();
const mockDiscovery = jest.fn(async () => ({ status: "unsupported", cmids: [] }));
const mockPractices = [{ id: "practice-1" }];
const mockLinks: unknown[] = [];
jest.mock("../AuthContext", () => ({
  useAuth: () => ({ authenticatedUser: { studentId: "student-1" } }),
}));
jest.mock("../StudentPanelContext", () => ({
  useStudentPanel: () => ({
    studentId: "student-1",
    practicas: mockPractices,
    isPracticasLoading: false,
  }),
}));
jest.mock("../../hooks/useMoodleTaskLinks", () => ({
  useMoodleTaskLinks: () => ({ links: mockLinks, isLoading: false }),
}));
jest.mock("../../utils/moodleTaskResolution", () => ({
  buildPendingMoodleAssignments: () => new Map([["123", ["practice-1"]]]),
}));
jest.mock("../../services/moodleEvidenceService", () => ({
  captureStudentMoodleEvidence: () => mockCapture(),
}));
jest.mock("../../lib/supabaseClient", () => ({
  supabase: { rpc: async () => ({ data: [], error: null }) },
}));
jest.mock("../../lib/moodleBridge", () => ({
  MOODLE_COURSE_ID: 3615,
  MOODLE_BRIDGE_VERSION: "test",
  MoodleBridgeError: class extends Error {},
  requestMoodleDiscovery: () => mockDiscovery(),
  requestMoodleTasks: () => mockTasks(),
}));
const { MoodleGradeSyncProvider, useMoodleGradeSync } = require("../MoodleGradeSyncContext");
it("no consulta tareas personales ni guarda errores de parser en una sesión sin capacidad", async () => {
  const original = Object.getOwnPropertyDescriptor(window, "parent");
  const originalSelf = Object.getOwnPropertyDescriptor(window, "self");
  Object.defineProperty(window, "parent", { configurable: true, value: {} });
  Object.defineProperty(window, "self", { configurable: true, value: {} });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <MoodleGradeSyncProvider>{children}</MoodleGradeSyncProvider>
    </QueryClientProvider>
  );
  const result = renderHook(() => useMoodleGradeSync(), { wrapper });
  try {
    await waitFor(() => expect(result.result.current.status).toBe("unavailable"));
    expect(result.result.current.errorMessage).toContain("no habilita la lectura personal");
    expect(mockTasks).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  } finally {
    result.unmount();
    client.clear();
    if (original) Object.defineProperty(window, "parent", original);
    if (originalSelf) Object.defineProperty(window, "self", originalSelf);
  }
});
