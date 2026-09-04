import { act, renderHook } from "@testing-library/react";
import type { GmailHilo } from "../../../../hooks/useGmailHilos";
import { generatePendingDrafts, modifyThread } from "../../../../services/gmailService";
import { useGestionMailController } from "../useGestionMailController";

jest.mock("../../../../services/gmailService", () => ({
  generatePendingDrafts: jest.fn(),
  modifyThread: jest.fn(),
}));

const hilo: GmailHilo = {
  thread_id: "thread-1",
  asunto: "Consulta",
  estado: "esperando_respuesta",
  clasificacion: null,
  institucion_id: null,
  participantes: [],
  primer_mensaje_at: null,
  ultimo_mensaje_at: null,
  ultimo_mensaje_de: null,
};

const mockedGeneratePendingDrafts = jest.mocked(generatePendingDrafts);
const mockedModifyThread = jest.mocked(modifyThread);

describe("useGestionMailController", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const setup = (isTestingMode = false) => {
    const showToast = jest.fn();
    const refetchGmail = jest.fn();
    const refetchDrafts = jest.fn();
    const hook = renderHook(() =>
      useGestionMailController({
        isTestingMode,
        showToast,
        refetchGmail,
        refetchDrafts,
      })
    );
    return { ...hook, showToast, refetchGmail, refetchDrafts };
  };

  it("keeps a queued archive reversible during the undo window", async () => {
    const { result } = setup();

    act(() => result.current.handleArchiveMail(hilo));

    expect(result.current.hiddenThreads.has(hilo.thread_id)).toBe(true);
    expect(result.current.undoQueue).toHaveLength(1);

    const [{ key }] = result.current.undoQueue;
    act(() => result.current.undoMailAction(key, hilo.thread_id));
    await act(async () => jest.advanceTimersByTimeAsync(5000));

    expect(result.current.hiddenThreads.has(hilo.thread_id)).toBe(false);
    expect(result.current.undoQueue).toHaveLength(0);
    expect(mockedModifyThread).not.toHaveBeenCalled();
  });

  it("commits an archive after five seconds and refreshes both sources", async () => {
    mockedModifyThread.mockResolvedValue({ success: true });
    const { result, refetchGmail, refetchDrafts } = setup();

    act(() => result.current.handleArchiveMail(hilo));
    await act(async () => jest.advanceTimersByTimeAsync(5000));

    expect(mockedModifyThread).toHaveBeenCalledWith(hilo.thread_id, "archive");
    expect(refetchGmail).toHaveBeenCalledTimes(1);
    expect(refetchDrafts).toHaveBeenCalledTimes(1);
    expect(result.current.busyThreads.has(hilo.thread_id)).toBe(false);
    expect(result.current.undoQueue).toHaveLength(0);
  });

  it("generates drafts and preserves the existing user feedback contract", async () => {
    mockedGeneratePendingDrafts.mockResolvedValue({ generados: 2 });
    const { result, showToast, refetchDrafts } = setup();

    await act(async () => result.current.handleGenerateDrafts());

    expect(mockedGeneratePendingDrafts).toHaveBeenCalledWith(10);
    expect(showToast).toHaveBeenCalledWith("Hermes preparó 2 borradores", "auto_awesome");
    expect(refetchDrafts).toHaveBeenCalledTimes(1);
    expect(result.current.generatingDrafts).toBe(false);
  });
});
