import { requestMoodleDiscovery } from "../moodleBridge";

describe("capacidad de descubrimiento", () => {
  const originalParent = Object.getOwnPropertyDescriptor(window, "parent");
  const originalReferrer = Object.getOwnPropertyDescriptor(document, "referrer");
  afterEach(() => {
    jest.useRealTimers();
    if (originalParent) Object.defineProperty(window, "parent", originalParent);
    if (originalReferrer) Object.defineProperty(document, "referrer", originalReferrer);
    else delete (document as unknown as Record<string, unknown>).referrer;
  });
  it("distingue una respuesta docente explícita de un timeout", async () => {
    jest.useFakeTimers();
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://campus.uflo.edu.ar/course/view.php?id=3615",
    });
    const parent = {
      postMessage: jest.fn((data) => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://campus.uflo.edu.ar",
            source: parent as unknown as Window,
            data: {
              type: "PPS_MOODLE_CAPABILITIES_RESULT",
              version: 2,
              courseId: 3615,
              requestId: data.requestId,
              discovery: false,
            },
          })
        );
      }),
    };
    Object.defineProperty(window, "parent", { configurable: true, value: parent });
    expect(await requestMoodleDiscovery()).toMatchObject({ status: "unsupported", cmids: [] });
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(5 * 60_000 + 1);
    parent.postMessage.mockImplementation(() => {});
    const timedOut = requestMoodleDiscovery();
    await jest.advanceTimersByTimeAsync(1001);
    expect(await timedOut).toBeNull();
  });
});
