import {
  jefeMoodleTasksResultSchema,
  moodleCourseContextSchema,
  moodleTasksResultSchema,
} from "../moodleBridge";

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
      submittedAt: "2026-07-21T04:12:00.000Z",
      submittedAtDisplay: "martes, 21 de julio de 2026, 01:12",
      submissionFiles: ["Informe final.pdf", "IMG_4182.jpg", "IMG_4183.jpg"],
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

  it("rechaza una fecha de entrega en una tarea no entregada", () => {
    const candidate = {
      ...validResult,
      tasks: [
        {
          ...validResult.tasks[0],
          status: "not_submitted",
          submitted: false,
          gradeValue: null,
          gradeMax: null,
        },
      ],
    };
    expect(moodleTasksResultSchema.safeParse(candidate).success).toBe(false);
  });

  it("rechaza un username Moodle que no tenga forma de DNI", () => {
    expect(
      moodleTasksResultSchema.safeParse({ ...validResult, moodleUsername: "blas" }).success
    ).toBe(false);
  });

  it("rechaza más archivos que el máximo material de la tarea", () => {
    const candidate = {
      ...validResult,
      tasks: [
        {
          ...validResult.tasks[0],
          submissionFiles: Array.from({ length: 21 }, (_, index) => `archivo-${index}.jpg`),
        },
      ],
    };
    expect(moodleTasksResultSchema.safeParse(candidate).success).toBe(false);
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

describe("jefeMoodleTasksResultSchema", () => {
  const validJefeResult = {
    type: "PPS_MOODLE_JEFE_TASKS_RESULT",
    version: 1,
    requestId: "550e8400-e29b-41d4-a716-446655440000",
    courseId: 3615,
    observedAt: "2026-08-19T22:00:00.000Z",
    moodleUserId: 2338,
    moodleUsername: "34052382",
    tasks: [
      {
        cmid: 1109159,
        status: "ok",
        errorCode: null,
        rows: [
          {
            moodleUserId: 10970,
            moodleUsername: "44684830",
            email: "olivasantiago531@gmail.com",
            status: "submitted",
            submitted: true,
            gradeValue: null,
            gradeMax: null,
            gradeDisplay: null,
            gradedAtDisplay: null,
            submittedAt: "2026-07-21T04:12:00.000Z",
            submittedAtDisplay: "martes, 21 de julio de 2026, 01:12",
          },
        ],
      },
    ],
  };

  it("acepta una entrega de la tabla anual de la jefatura", () => {
    expect(jefeMoodleTasksResultSchema.safeParse(validJefeResult).success).toBe(true);
  });

  it("rechaza filas de una tarea que Moodle no pudo leer", () => {
    const candidate = {
      ...validJefeResult,
      tasks: [{ ...validJefeResult.tasks[0], status: "no_access" }],
    };
    expect(jefeMoodleTasksResultSchema.safeParse(candidate).success).toBe(false);
  });

  it("rechaza una nota sin escala verificable", () => {
    const candidate = {
      ...validJefeResult,
      tasks: [
        {
          ...validJefeResult.tasks[0],
          rows: [
            {
              ...validJefeResult.tasks[0].rows[0],
              status: "graded",
              gradeValue: 80,
              gradeMax: null,
            },
          ],
        },
      ],
    };
    expect(jefeMoodleTasksResultSchema.safeParse(candidate).success).toBe(false);
  });
});
