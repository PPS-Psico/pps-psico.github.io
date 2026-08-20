import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type RpcResponse = { data: unknown; error: unknown };
type RpcCall = (_name: string, _args?: Record<string, unknown>) => Promise<RpcResponse>;

const rpcSpy = jest.fn<RpcCall>(async () => ({ data: [], error: null }));

jest.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: (name: string, args?: Record<string, unknown>) => rpcSpy(name, args),
  },
}));

const { fetchJefeMoodleSyncTasks, syncJefeMoodleReports } = require("../jefeService");

const bridgeResult = {
  requestId: "11111111-1111-4111-8111-111111111111",
  bridgeVersion: "pps-moodle-bridge/v1",
  courseId: 3615,
  observedAt: "2026-08-20T00:30:00.000Z",
  moodleUserId: 99,
  moodleUsername: "12345678",
  tasks: [{ cmid: 1109159, status: "ok", rows: [] }],
};

describe("jefeService — sincronización Moodle", () => {
  beforeEach(() => {
    rpcSpy.mockClear();
  });

  it("usa el alcance de la jefatura autenticada fuera del simulador", async () => {
    await fetchJefeMoodleSyncTasks();

    expect(rpcSpy).toHaveBeenCalledWith("get_jefe_moodle_sync_tasks_v1", undefined);
  });

  it("lista y persiste mediante los RPC protegidos de la jefatura simulada", async () => {
    const previewKey = "c2b55b28-b9c3-4f8e-bb51-73a77832fb28";

    await fetchJefeMoodleSyncTasks(previewKey);
    expect(rpcSpy).toHaveBeenLastCalledWith("get_jefe_moodle_sync_tasks_preview_v1", {
      p_preview_key: previewKey,
    });

    rpcSpy.mockImplementationOnce(async () => ({
      data: {
        success: true,
        academic_year: 2026,
        task_count: 1,
        rows_received: 0,
        accepted: 0,
        stored: 0,
        snapshot_updated: 0,
        ambiguous: 0,
        unmatched: 0,
        invalid: 0,
        observed_at: bridgeResult.observedAt,
      },
      error: null,
    }));

    await syncJefeMoodleReports(2026, bridgeResult, previewKey);
    expect(rpcSpy).toHaveBeenLastCalledWith(
      "sync_jefe_moodle_reports_preview_v1",
      expect.objectContaining({
        p_preview_key: previewKey,
        p_request_id: bridgeResult.requestId,
        p_course_id: 3615,
        p_academic_year: 2026,
        p_tasks: bridgeResult.tasks,
      })
    );
  });
});
