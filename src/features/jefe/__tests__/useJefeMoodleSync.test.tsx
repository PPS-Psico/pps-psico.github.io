import React, { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useJefeMoodleSync } from "../useJefeMoodleSync";
import {
  claimJefePage,
  commitJefePage,
  failJefePage,
  fetchJefePageQueue,
} from "../jefeMoodlePages";
import {
  isEmbeddedInMoodle,
  requestJefeMoodlePage,
  supportsJefeMoodlePages,
} from "../../../lib/moodleBridge";

jest.mock("../jefeMoodlePages", () => ({
  claimJefePage: jest.fn(),
  commitJefePage: jest.fn(),
  failJefePage: jest.fn(),
  fetchJefePageQueue: jest.fn(),
}));
jest.mock("../../../lib/moodleBridge", () => ({
  MoodleBridgeError: jest.requireActual("../../../lib/moodleBridge").MoodleBridgeError,
  isEmbeddedInMoodle: jest.fn(),
  requestJefeMoodlePage: jest.fn(),
  supportsJefeMoodlePages: jest.fn(),
}));
const queue = jest.mocked(fetchJefePageQueue);
const claim = jest.mocked(claimJefePage);
const read = jest.mocked(requestJefeMoodlePage);
const commit = jest.mocked(commitJefePage);
let sequence = 0;
const clients: QueryClient[] = [];
const task = { cmid: 55, task_name: "Clínica", next_page: 0 };
const available = { pending: 1, paused: 0, tasks: [task] };
const finished = { pending: 0, paused: 0, tasks: [] };
const observedAt = "2026-09-10T12:00:00Z";
function mount(key = `pages-${++sequence}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const invalidate = jest.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <StrictMode>{children}</StrictMode>
    </QueryClientProvider>
  );
  return { ...renderHook(() => useJefeMoodleSync(true, key), { wrapper }), invalidate, key };
}
async function advance(ms = 350) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  jest.mocked(isEmbeddedInMoodle).mockReturnValue(true);
  jest.mocked(supportsJefeMoodlePages).mockResolvedValue(true);
  jest.mocked(failJefePage).mockResolvedValue(undefined);
  queue.mockResolvedValue(available);
  claim.mockImplementation(async () => ({
    status: "claimed",
    cmid: 55,
    page: claim.mock.calls.length - 1,
    lease: "lease",
    cycle: "cycle",
    rowsSeen: 0,
  }));
  read.mockImplementation(async (cmid, page) => ({
    type: "PPS_MOODLE_JEFE_PAGE_RESULT",
    version: 2,
    courseId: 3615,
    page,
    requestId: "request",
    moodleUserId: 4227,
    moodleUsername: "12345678",
    observedAt,
    task: { cmid, status: "ok", rows: [], negativeRows: [], errorCode: null, pageRowCount: 100 },
  }));
  commit.mockResolvedValue({
    status: "progress",
    accepted: 1,
    nextPage: 1,
    rowsSeen: 100,
    error: null,
    observedAt,
  });
});
afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
  jest.clearAllTimers();
  jest.useRealTimers();
});

it("bounds a StrictMode run to four pages and publishes every receipt", async () => {
  const { result, invalidate } = mount();
  await advance();
  expect(read.mock.calls).toEqual([
    [55, 0],
    [55, 1],
    [55, 2],
    [55, 3],
  ]);
  expect(invalidate).toHaveBeenCalledTimes(4);
  expect(result.current).toMatchObject({ status: "partial", pagesSaved: 4, accepted: 4 });
});
it("stops on first transport failure and does not restart on intervals or remount", async () => {
  read.mockRejectedValue(new Error("Campus timeout"));
  const first = mount();
  await advance();
  expect(first.result.current.status).toBe("error");
  expect(failJefePage).toHaveBeenCalledTimes(1);
  await advance(180_000);
  first.unmount();
  const second = mount(first.key);
  await advance(180_000);
  expect(read).toHaveBeenCalledTimes(1);
  expect(second.result.current.status).toBe("partial");
});
it("manual retry obtains a fresh queue and resumes the server page", async () => {
  read.mockRejectedValueOnce(new Error("timeout"));
  const { result } = mount();
  await advance();
  queue.mockResolvedValueOnce(available).mockResolvedValue(finished);
  claim.mockResolvedValue({
    status: "claimed",
    cmid: 55,
    page: 3,
    lease: "lease",
    cycle: "cycle",
    rowsSeen: 300,
  });
  commit.mockResolvedValue({
    status: "complete",
    accepted: 1,
    nextPage: 4,
    rowsSeen: 346,
    error: null,
    observedAt,
  });
  await act(async () => {
    await result.current.retry();
  });
  expect(queue).toHaveBeenLastCalledWith(expect.any(String), false, true);
  expect(read).toHaveBeenLastCalledWith(55, 3);
  expect(result.current.status).toBe("synced");
});
it("does not release an uncertain commit and stops without rereading", async () => {
  commit.mockRejectedValue(new Error("ack timeout"));
  const { result } = mount();
  await advance(180_000);
  expect(read).toHaveBeenCalledTimes(1);
  expect(failJefePage).not.toHaveBeenCalled();
  expect(result.current.status).toBe("error");
});
it("saves valid evidence from an incomplete page and pauses", async () => {
  commit.mockResolvedValue({
    status: "paused",
    accepted: 2,
    nextPage: 0,
    rowsSeen: 0,
    error: "incomplete_page_identity",
    observedAt,
  });
  const { result, invalidate } = mount();
  await advance(180_000);
  expect(result.current).toMatchObject({ status: "partial", accepted: 2, pagesSaved: 0 });
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(1);
});
it("requires page capability and never starts the old all-task scan", async () => {
  jest.mocked(supportsJefeMoodlePages).mockResolvedValue(false);
  const { result } = mount();
  await advance(180_000);
  expect(result.current.status).toBe("unavailable");
  expect(queue).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
});
it("does not loop when another tab owns the task", async () => {
  claim.mockResolvedValue({ status: "busy" });
  mount();
  await advance();
  expect(claim).toHaveBeenCalledTimes(1);
  expect(read).not.toHaveBeenCalled();
});
it("keeps history explicit and does not automatically drain it", async () => {
  queue.mockResolvedValue(finished);
  const { result } = mount();
  await advance();
  queue.mockResolvedValue(available);
  await act(async () => {
    await result.current.reviewHistory?.();
  });
  expect(queue).toHaveBeenLastCalledWith(expect.any(String), true, true);
  await advance(180_000);
  expect(read).toHaveBeenCalledTimes(4);
});
it("pauses after committing the in-flight page", async () => {
  let finish!: (value: Awaited<ReturnType<typeof requestJefeMoodlePage>>) => void;
  const response = await read(55, 0);
  read.mockClear();
  read.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { result } = mount();
  await advance();
  act(() => result.current.pause?.());
  await act(async () => {
    finish(response);
  });
  await advance(180_000);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(1);
  expect(result.current.pagesSaved).toBe(1);
});
