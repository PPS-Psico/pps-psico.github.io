import React, { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useJefeMoodleSync } from "../useJefeMoodleSync";
import { fetchJefeMoodleSyncTasks, syncJefeMoodleReports } from "../jefeService";
import { isEmbeddedInMoodle, requestJefeMoodleTasks } from "../../../lib/moodleBridge";

jest.mock("../jefeService", () => ({
  fetchJefeMoodleSyncTasks: jest.fn(),
  syncJefeMoodleReports: jest.fn(),
}));
jest.mock("../../../lib/moodleBridge", () => ({
  isEmbeddedInMoodle: jest.fn(),
  requestJefeMoodleTasks: jest.fn(),
  MoodleBridgeError: class extends Error {},
}));

const fetchTasks = jest.mocked(fetchJefeMoodleSyncTasks);
const readTasks = jest.mocked(requestJefeMoodleTasks);
const persist = jest.mocked(syncJefeMoodleReports);
let sequence = 0;
let clients: QueryClient[] = [];

function mount(count = 13, strict = false, key = `scan-${++sequence}`) {
  const tasks = Array.from({ length: count }, (_, index) => ({
    academic_year: 2026,
    course_id: 3615,
    cmid: 1000 + index,
    task_name: `Task ${index}`,
    area_keys: ["clinica"],
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  client.setQueryData(["jefe-moodle-sync-tasks-v1", key], tasks);
  fetchTasks.mockResolvedValue(tasks);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      {strict ? <StrictMode>{children}</StrictMode> : children}
    </QueryClientProvider>
  );
  return { ...renderHook(() => useJefeMoodleSync(true, key), { wrapper }), key };
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(isEmbeddedInMoodle).mockReturnValue(true);
  readTasks.mockImplementation(async (cmids) => ({
    type: "PPS_MOODLE_JEFE_TASKS_RESULT",
    version: 1,
    requestId: "test-request",
    bridgeVersion: "pps-moodle-bridge/v1",
    courseId: 3615,
    observedAt: "2026-09-06T14:00:00Z",
    moodleUserId: 10,
    moodleUsername: "test",
    tasks: cmids.map((cmid) => ({ cmid: Number(cmid), status: "ok", errorCode: null, rows: [] })),
  }));
  persist.mockResolvedValue({
    accepted: 1,
    ambiguous: 0,
    unmatched: 0,
    invalid: 0,
    observed_at: "2026-09-06T14:00:00Z",
  } as Awaited<ReturnType<typeof syncJefeMoodleReports>>);
});

afterEach(() => {
  clients.forEach((client) => client.clear());
  clients = [];
  jest.clearAllTimers();
  jest.useRealTimers();
});

it("runs a cached queue in StrictMode as 4 + 4 + 4 + 1", async () => {
  const { result } = mount(13, true);
  await advance(350);
  expect(readTasks.mock.calls.map(([batch]) => batch.length)).toEqual([4, 4, 4, 1]);
  expect(persist).toHaveBeenCalledTimes(4);
  expect(result.current.status).toBe("synced");
});

it("continues after a failed batch and preserves partial coverage", async () => {
  readTasks.mockRejectedValueOnce(new Error("Campus timeout"));
  const { result } = mount();
  await advance(350);
  expect(readTasks).toHaveBeenCalledTimes(4);
  expect(persist).toHaveBeenCalledTimes(3);
  expect(result.current).toMatchObject({ status: "partial", failedTasks: 4, accepted: 3 });
});

it("does not report a throttled remount as a successful scan", async () => {
  readTasks.mockRejectedValue(new Error("Campus unavailable"));
  const first = mount(1);
  await advance(350);
  expect(first.result.current.status).toBe("error");
  first.unmount();
  const second = mount(1, false, first.key);
  await advance(350);
  expect(second.result.current.status).toBe("idle");
  expect(readTasks).toHaveBeenCalledTimes(1);
});

it("resumes the persistent queue while the Campus panel remains open", async () => {
  const { result } = mount(1);
  await advance(350);
  expect(readTasks).toHaveBeenCalledTimes(1);
  await advance(60_100);
  await advance(350);
  expect(fetchTasks).toHaveBeenCalled();
  expect(readTasks).toHaveBeenCalledTimes(2);
  expect(result.current.status).toBe("synced");
});

it("does not turn a failed queue lookup into an empty successful scan", async () => {
  const { result } = mount(1);
  await advance(350);
  fetchTasks.mockRejectedValue(new Error("queue unavailable"));
  await advance(62_000);
  expect(result.current.status).toBe("error");
  expect(readTasks).toHaveBeenCalledTimes(1);
});

it("keeps standalone mode unavailable without calling Campus", async () => {
  jest.mocked(isEmbeddedInMoodle).mockReturnValue(false);
  const { result } = mount(1);
  await advance(350);
  expect(result.current.status).toBe("unavailable");
  expect(readTasks).not.toHaveBeenCalled();
});
