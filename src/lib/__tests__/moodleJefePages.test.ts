import { readFileSync } from "node:fs";
import { jefeMoodlePageSchema } from "../moodleBridge";

const requestId = "550e8400-e29b-41d4-a716-446655440000";
const table =
  '<table id="submissions"><thead><tr><th>Nombre de usuario</th><th>Estado</th><th>Última modificación (entrega)</th></tr></thead><tbody><tr class="user123"><td>12345678</td><td>Sin entrega</td><td>-</td></tr></tbody></table>';
let target: Window;
let reply: jest.SpyInstance;
const originalFetch = window.fetch;
beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML =
    '<div id="pps-aula-embed" data-course-id="3615" data-moodle-user-id="32734" data-moodle-username="35154584"><iframe id="pps-aula-frame"></iframe></div>';
  target = (document.querySelector("iframe") as HTMLIFrameElement).contentWindow!;
  reply = jest.spyOn(target, "postMessage").mockImplementation(() => undefined);
  const script = readFileSync("docs/moodle-label-inicio-bridge.html", "utf8").match(
    /<script>([\s\S]*?)<\/script>/
  )?.[1];
  if (!script) throw new Error("Missing bridge");
  window.eval(script);
});
afterEach(() => {
  window.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

function send(data: object, origin = "https://pps-psico.github.io", source = target) {
  window.dispatchEvent(new MessageEvent("message", { origin, source, data }));
}
const request = {
  type: "PPS_MOODLE_JEFE_PAGE_REQUEST",
  version: 2,
  courseId: 3615,
  requestId,
  cmid: 55,
  page: 3,
};

it("reads exactly the requested page and returns a valid protocol response", async () => {
  const fetchMock = jest.fn(async (url: string) => ({ ok: true, url, text: async () => table }));
  window.fetch = fetchMock as unknown as typeof fetch;
  send(request);
  await jest.advanceTimersByTimeAsync(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain("&page=3");
  const payload = reply.mock.calls[0][0];
  expect(jefeMoodlePageSchema.safeParse(payload).success).toBe(true);
  expect(payload).toMatchObject({ page: 3, requestId, task: { pageRowCount: 1, status: "ok" } });
});
it("advertises page support only to the embedded authorized origin", () => {
  const capabilities = {
    type: "PPS_MOODLE_CAPABILITIES_REQUEST",
    version: 2,
    courseId: 3615,
    requestId,
  };
  send(capabilities, "https://unrelated.example");
  expect(reply).not.toHaveBeenCalled();
  send(capabilities);
  expect(reply).toHaveBeenCalledWith(
    expect.objectContaining({ jefePages: true }),
    "https://pps-psico.github.io"
  );
});
it("rejects another source, course and out-of-range page without fetching", () => {
  window.fetch = jest.fn();
  send(request, "https://pps-psico.github.io", window);
  send({ ...request, courseId: 1 });
  send({ ...request, page: 24 });
  expect(window.fetch).not.toHaveBeenCalled();
});
it("distinguishes a failed network from an expired Campus session", async () => {
  window.fetch = jest.fn().mockRejectedValue(new Error("network"));
  send(request);
  await jest.advanceTimersByTimeAsync(1);
  expect(reply.mock.calls[0][0].task).toMatchObject({
    status: "parse_error",
    errorCode: "grading_page_unavailable",
  });
  reply.mockClear();
  window.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, url: "https://campus.uflo.edu.ar/login/index.php" });
  send(request);
  await jest.advanceTimersByTimeAsync(1);
  expect(reply.mock.calls[0][0].task).toMatchObject({
    status: "no_access",
    errorCode: "campus_session_expired",
  });
});
