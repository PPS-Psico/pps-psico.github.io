import { z } from "zod";

export const MOODLE_ORIGIN = "https://campus.uflo.edu.ar";
export const MOODLE_COURSE_ID = 3615;
export const MOODLE_BRIDGE_VERSION = "pps-moodle-bridge/v1";

export const moodleCourseContextSchema = z.object({
  type: z.literal("PPS_MOODLE_CONTEXT_RESULT"),
  version: z.literal(1),
  requestId: z.string().uuid(),
  courseId: z.literal(MOODLE_COURSE_ID),
  moodleUserId: z.number().int().positive(),
  moodleUsername: z.string().regex(/^\d{6,12}$/),
  email: z.string().trim().email().max(320),
  firstname: z.string().trim().min(2).max(120),
  lastname: z.string().trim().min(2).max(120),
  signupTicket: z.string().regex(/^[0-9a-f]{64}$/),
  signupTicketExpiresAt: z.string().datetime({ offset: true }),
});

export type MoodleCourseContext = z.infer<typeof moodleCourseContextSchema>;

const taskStatusSchema = z.enum([
  "no_access",
  "not_submitted",
  "submitted",
  "graded",
  "parse_error",
]);

export const moodleTaskResultSchema = z
  .object({
    cmid: z.number().int().positive(),
    status: taskStatusSchema,
    submitted: z.boolean(),
    gradeValue: z.number().finite().nonnegative().nullable(),
    gradeMax: z.number().finite().positive().nullable(),
    gradeDisplay: z.string().trim().max(160).nullable(),
    gradedAtDisplay: z.string().trim().max(200).nullable(),
    submittedAt: z.string().datetime({ offset: true }).nullable().optional(),
    submittedAtDisplay: z.string().trim().max(200).nullable().optional(),
  })
  .superRefine((task, ctx) => {
    if (!task.submitted && task.submittedAt) {
      ctx.addIssue({ code: "custom", message: "Una tarea no entregada no puede tener fecha." });
    }
    if (task.status !== "graded") return;
    if (task.gradeValue === null || task.gradeMax === null || task.gradeValue > task.gradeMax) {
      ctx.addIssue({ code: "custom", message: "La calificación Moodle no es válida." });
    }
  });

export const moodleTasksResultSchema = z.object({
  type: z.literal("PPS_MOODLE_TASKS_RESULT"),
  version: z.literal(1),
  requestId: z.string().uuid(),
  courseId: z.literal(MOODLE_COURSE_ID),
  observedAt: z.string().datetime({ offset: true }),
  moodleUserId: z.number().int().positive(),
  moodleUsername: z.string().regex(/^\d{6,12}$/),
  tasks: z.array(moodleTaskResultSchema).max(20),
});

export type MoodleTaskResult = z.infer<typeof moodleTaskResultSchema>;
export type MoodleTasksResult = z.infer<typeof moodleTasksResultSchema>;

const jefeSubmissionRowSchema = z
  .object({
    moodleUserId: z.number().int().positive(),
    moodleUsername: z.string().regex(/^\d{6,12}$/),
    email: z.string().trim().email().max(320).nullable(),
    status: z.enum(["submitted", "graded"]),
    submitted: z.literal(true),
    gradeValue: z.number().finite().nonnegative().nullable(),
    gradeMax: z.number().finite().positive().nullable(),
    gradeDisplay: z.string().trim().max(160).nullable(),
    gradedAtDisplay: z.string().trim().max(200).nullable(),
    submittedAt: z.string().datetime({ offset: true }).nullable(),
    submittedAtDisplay: z.string().trim().max(200).nullable(),
  })
  .superRefine((row, ctx) => {
    if (row.status === "graded") {
      if (row.gradeValue === null || row.gradeMax === null || row.gradeValue > row.gradeMax) {
        ctx.addIssue({ code: "custom", message: "La calificación Moodle no es válida." });
      }
      return;
    }
    if (row.gradeValue !== null || row.gradeMax !== null) {
      ctx.addIssue({ code: "custom", message: "Una entrega sin nota no puede incluir escala." });
    }
  });

const jefeTaskScanSchema = z.object({
  cmid: z.number().int().positive(),
  status: z.enum(["ok", "no_access", "parse_error"]),
  errorCode: z.string().trim().max(80).nullable(),
  rows: z.array(jefeSubmissionRowSchema).max(500),
});

export const jefeMoodleTasksResultSchema = z
  .object({
    type: z.literal("PPS_MOODLE_JEFE_TASKS_RESULT"),
    version: z.literal(1),
    requestId: z.string().uuid(),
    courseId: z.literal(MOODLE_COURSE_ID),
    observedAt: z.string().datetime({ offset: true }),
    moodleUserId: z.number().int().positive(),
    moodleUsername: z.string().regex(/^\d{6,12}$/),
    tasks: z.array(jefeTaskScanSchema).min(1).max(20),
  })
  .superRefine((result, ctx) => {
    const totalRows = result.tasks.reduce((total, task) => total + task.rows.length, 0);
    if (totalRows > 1000) {
      ctx.addIssue({ code: "custom", message: "La respuesta Moodle excede el límite de filas." });
    }
    result.tasks.forEach((task, index) => {
      if (task.status !== "ok" && task.rows.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["tasks", index, "rows"],
          message: "Una tarea no leída no puede incluir entregas.",
        });
      }
    });
  });

export type JefeMoodleTasksResult = z.infer<typeof jefeMoodleTasksResultSchema>;

export class MoodleBridgeError extends Error {
  constructor(public readonly code: "not_embedded" | "timeout" | "invalid_response") {
    super(code);
    this.name = "MoodleBridgeError";
  }
}

function createRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isEmbeddedInMoodle(): boolean {
  if (typeof window === "undefined" || window.parent === window) return false;

  try {
    return new URL(document.referrer).origin === MOODLE_ORIGIN;
  } catch {
    return false;
  }
}

export async function requestMoodleCourseContext(timeoutMs = 5_000): Promise<MoodleCourseContext> {
  if (!isEmbeddedInMoodle()) throw new MoodleBridgeError("not_embedded");

  const requestId = createRequestId();

  return new Promise<MoodleCourseContext>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
      callback();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== MOODLE_ORIGIN || event.source !== window.parent) return;
      const candidate = moodleCourseContextSchema.safeParse(event.data);
      if (!candidate.success || candidate.data.requestId !== requestId) return;
      finish(() => resolve(candidate.data));
    };
    const timeout = window.setTimeout(
      () => finish(() => reject(new MoodleBridgeError("timeout"))),
      timeoutMs
    );

    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      {
        type: "PPS_MOODLE_CONTEXT_REQUEST",
        version: 1,
        requestId,
      },
      MOODLE_ORIGIN
    );
  });
}

export async function requestMoodleTasks(
  rawCmids: string[],
  timeoutMs = 15_000
): Promise<MoodleTasksResult> {
  if (typeof window === "undefined" || window.parent === window) {
    throw new MoodleBridgeError("not_embedded");
  }

  const cmids = [...new Set(rawCmids)]
    .filter((value) => /^\d+$/.test(value))
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value > 0)
    .slice(0, 20);
  if (cmids.length === 0) throw new MoodleBridgeError("invalid_response");

  const requestId = createRequestId();

  return new Promise<MoodleTasksResult>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
      callback();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== MOODLE_ORIGIN || event.source !== window.parent) return;
      const candidate = moodleTasksResultSchema.safeParse(event.data);
      if (!candidate.success || candidate.data.requestId !== requestId) return;
      const requested = new Set(cmids);
      if (candidate.data.tasks.some((task) => !requested.has(task.cmid))) {
        finish(() => reject(new MoodleBridgeError("invalid_response")));
        return;
      }
      finish(() => resolve(candidate.data));
    };
    const timeout = window.setTimeout(
      () => finish(() => reject(new MoodleBridgeError("timeout"))),
      timeoutMs
    );

    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      {
        type: "PPS_MOODLE_TASKS_REQUEST",
        version: 1,
        requestId,
        courseId: MOODLE_COURSE_ID,
        cmids,
      },
      MOODLE_ORIGIN
    );
  });
}

export async function requestJefeMoodleTasks(
  rawCmids: Array<string | number>,
  timeoutMs = 45_000
): Promise<JefeMoodleTasksResult> {
  if (!isEmbeddedInMoodle()) throw new MoodleBridgeError("not_embedded");

  const cmids = [...new Set(rawCmids.map(String))]
    .filter((value) => /^\d+$/.test(value))
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value > 0)
    .slice(0, 20);
  if (cmids.length === 0) throw new MoodleBridgeError("invalid_response");

  const requestId = createRequestId();

  return new Promise<JefeMoodleTasksResult>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
      callback();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== MOODLE_ORIGIN || event.source !== window.parent) return;
      const candidate = jefeMoodleTasksResultSchema.safeParse(event.data);
      if (!candidate.success || candidate.data.requestId !== requestId) return;
      const requested = new Set(cmids);
      const returned = new Set(candidate.data.tasks.map((task) => task.cmid));
      if (
        candidate.data.tasks.some((task) => !requested.has(task.cmid)) ||
        returned.size !== requested.size ||
        [...requested].some((cmid) => !returned.has(cmid))
      ) {
        finish(() => reject(new MoodleBridgeError("invalid_response")));
        return;
      }
      finish(() => resolve(candidate.data));
    };
    const timeout = window.setTimeout(
      () => finish(() => reject(new MoodleBridgeError("timeout"))),
      timeoutMs
    );

    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      {
        type: "PPS_MOODLE_JEFE_TASKS_REQUEST",
        version: 1,
        requestId,
        courseId: MOODLE_COURSE_ID,
        cmids,
      },
      MOODLE_ORIGIN
    );
  });
}
