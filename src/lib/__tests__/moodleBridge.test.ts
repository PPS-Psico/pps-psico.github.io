import { moodleCourseContextSchema, moodleTasksResultSchema } from "../moodleBridge";

const validResult = {
  type: "PPS_MOODLE_TASKS_RESULT" as const,
  version: 1 as const,
  requestId: "550e8400-e29b-41d4-a716-446655440000",
  courseId: 3615 as const,
  observedAt: "2026-08-10T14:09:00.000Z",
  moodleUserId: 32734,
  moodleUsername: "35154584",
  tasks: [
    {
      cmid: 946366,
      status: "graded" as const,
      submitted: true,
      gradeValue: 83,
      gradeMax: 100,
      gradeDisplay: "83,00 / 100,00",
      gradedAtDisplay: "lunes, 10 de agosto de 2026, 11:09",
    },
  ],
};

describe("moodleTasksResultSchema", () => {
  it("acepta una calificación Moodle correlacionable", () => {
    expect(moodleTasksResultSchema.safeParse(validResult).success).toBe(true);
  });

  it("rechaza resultados de otro curso", () => {
    expect(moodleTasksResultSchema.safeParse({ ...validResult, courseId: 9999 }).success).toBe(
      false
    );
  });

  it("rechaza una calificación fuera de escala", () => {
    const candidate = {
      ...validResult,
      tasks: [{ ...validResult.tasks[0], gradeValue: 101 }],
    };
    expect(moodleTasksResultSchema.safeParse(candidate).success).toBe(false);
  });

  it("rechaza un username Moodle que no tenga forma de DNI", () => {
    expect(
      moodleTasksResultSchema.safeParse({ ...validResult, moodleUsername: "blas" }).success
    ).toBe(false);
  });
});

describe("moodleCourseContextSchema", () => {
  const validContext = {
    type: "PPS_MOODLE_CONTEXT_RESULT",
    version: 1,
    requestId: "550e8400-e29b-41d4-a716-446655440000",
    courseId: 3615,
    moodleUserId: 32734,
    moodleUsername: "35154584",
    email: "blas.rivera@uflouniversidad.edu.ar",
    firstname: "Blas",
    lastname: "Rivera",
    signupTicket: "a".repeat(64),
    signupTicketExpiresAt: "2026-08-11T16:00:00.000Z",
  };

  it("acepta un comprobante completo emitido para el aula PPS", () => {
    expect(moodleCourseContextSchema.safeParse(validContext).success).toBe(true);
  });

  it("rechaza un contexto de otro curso", () => {
    expect(moodleCourseContextSchema.safeParse({ ...validContext, courseId: 9999 }).success).toBe(
      false
    );
  });

  it("rechaza un contexto sin ticket de alta válido", () => {
    expect(
      moodleCourseContextSchema.safeParse({ ...validContext, signupTicket: "sin-ticket" }).success
    ).toBe(false);
  });
});
