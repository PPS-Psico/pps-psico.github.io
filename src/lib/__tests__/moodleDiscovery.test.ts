import { moodleDiscoveryResultSchema, moodleTasksResultSchema } from "../moodleBridge";

describe("protocolo de descubrimiento separado", () => {
  const result = {
    type: "PPS_MOODLE_DISCOVERY_RESULT",
    version: 2,
    requestId: "550e8400-e29b-41d4-a716-446655440000",
    courseId: 3615,
    status: "ok",
    cmids: [946366],
    rowsSeen: 112,
  };
  it("admite tareas descubiertas sin convertirlas en una respuesta v1", () => {
    expect(moodleDiscoveryResultSchema.safeParse(result).success).toBe(true);
    expect(moodleTasksResultSchema.safeParse(result).success).toBe(false);
  });
  it("rechaza cursos y límites inválidos", () => {
    expect(moodleDiscoveryResultSchema.safeParse({ ...result, courseId: 12 }).success).toBe(false);
    expect(
      moodleDiscoveryResultSchema.safeParse({ ...result, cmids: Array(501).fill(1) }).success
    ).toBe(false);
    expect(moodleDiscoveryResultSchema.safeParse({ ...result, cmids: [-1] }).success).toBe(false);
  });
});
