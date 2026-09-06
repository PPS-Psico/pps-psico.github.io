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
    // Cuando una tarea recibe dos informes, la catedra reparte ahi la nota de
    // cada PPS ("Clinica de Ninos: 7 (Siete)"). Opcional: las etiquetas viejas
    // del Campus no lo envian.
    feedbackComment: z.string().trim().max(2000).nullable().optional(),
    submittedAt: z.string().datetime({ offset: true }).nullable().optional(),
    submittedAtDisplay: z.string().trim().max(200).nullable().optional(),
    // Se usan transitoriamente para clasificar la composición de la entrega.
    // El backend persiste sólo evidencia derivada, nunca estos nombres.
    submissionFiles: z.array(z.string().trim().min(1).max(180)).max(20).nullable().optional(),
  })
  .superRefine((task, ctx) => {
    if (!task.submitted && task.submittedAt) {
      ctx.addIssue({ code: "custom", message: "Una tarea no entregada no puede tener fecha." });
    }
    if (!task.submitted && task.submissionFiles && task.submissionFiles.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Una tarea no entregada no puede incluir archivos.",
      });
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

// Separate protocol: v1 task responses remain restricted to requested CMIDs.
export const moodleDiscoveryResultSchema = z.object({
  type: z.literal("PPS_MOODLE_DISCOVERY_RESULT"),
  version: z.literal(2),
  requestId: z.string().uuid(),
  courseId: z.literal(MOODLE_COURSE_ID),
  status: z.enum(["ok", "unavailable"]),
  cmids: z.array(z.number().int().positive()).max(500),
  rowsSeen: z.number().int().nonnegative().max(10000),
});

let discoveryCapability: { until: number; pending: Promise<boolean> } | null = null;

function supportsMoodleDiscovery(): Promise<boolean> {
  if (discoveryCapability && discoveryCapability.until > Date.now())
    return discoveryCapability.pending;
  const requestId = createRequestId();
  const pending = new Promise<boolean>((resolve) => {
    const finish = (available: boolean) => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(available);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== MOODLE_ORIGIN || event.source !== window.parent) return;
      const data = event.data;
      if (
        data?.type === "PPS_MOODLE_CAPABILITIES_RESULT" &&
        data.version === 2 &&
        data.requestId === requestId &&
        data.courseId === MOODLE_COURSE_ID &&
        typeof data.discovery === "boolean"
      )
        finish(data.discovery);
    };
    const timer = window.setTimeout(() => finish(false), 1_000);
    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      {
        type: "PPS_MOODLE_CAPABILITIES_REQUEST",
        version: 2,
        requestId,
        courseId: MOODLE_COURSE_ID,
      },
      MOODLE_ORIGIN
    );
  });
  discoveryCapability = { until: Date.now() + 5 * 60_000, pending };
  return pending;
}

export async function requestMoodleDiscovery(timeoutMs = 6_000) {
  if (!isEmbeddedInMoodle()) throw new MoodleBridgeError("not_embedded");
  if (!(await supportsMoodleDiscovery())) return null;
  const requestId = createRequestId();
  return new Promise<z.infer<typeof moodleDiscoveryResultSchema> | null>((resolve) => {
    const finish = (result: z.infer<typeof moodleDiscoveryResultSchema> | null) => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(result);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== MOODLE_ORIGIN || event.source !== window.parent) return;
      const parsed = moodleDiscoveryResultSchema.safeParse(event.data);
      if (parsed.success && parsed.data.requestId === requestId) finish(parsed.data);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      { type: "PPS_MOODLE_DISCOVERY_REQUEST", version: 2, requestId, courseId: MOODLE_COURSE_ID },
      MOODLE_ORIGIN
    );
  });
}

const jefeSubmissionRowSchema = z
  .object({
    moodleUserId: z.number().int().positive(),
    moodleUsername: z.string().regex(/^\d{6,12}$/),
    email: z.string().trim().email().max(320).nullable(),
    status: z.enum(["submitted", "graded", "not_submitted"]),
    submitted: z.boolean(),
    gradeValue: z.number().finite().nonnegative().nullable(),
    gradeMax: z.number().finite().positive().nullable(),
    gradeDisplay: z.string().trim().max(160).nullable(),
    gradedAtDisplay: z.string().trim().max(200).nullable(),
    feedbackComment: z.string().trim().max(2000).nullable().optional(),
    submittedAt: z.string().datetime({ offset: true }).nullable(),
    submittedAtDisplay: z.string().trim().max(200).nullable(),
    // En el barrido anual los nombres sólo cruzan transitoriamente hasta la
    // función SQL, que persiste evidencia derivada y los descarta.
    submissionFiles: z.array(z.string().trim().min(1).max(180)).max(20).nullable().optional(),
  })
  .superRefine((row, ctx) => {
    if (row.submitted !== (row.status !== "not_submitted")) {
      ctx.addIssue({ code: "custom", message: "Estado de entrega contradictorio." });
    }
    if (
      row.status === "not_submitted" &&
      (row.submittedAt !== null || row.submittedAtDisplay !== null)
    ) {
      ctx.addIssue({ code: "custom", message: "Una lectura negativa no tiene fecha de entrega." });
    }
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
  // Keep the v1 positive rows intact. Older clients ignore the additive list.
  rows: z.array(jefeSubmissionRowSchema.refine((row) => row.status !== "not_submitted")).max(500),
  negativeRows: z
    .array(jefeSubmissionRowSchema.refine((row) => row.status === "not_submitted"))
    .max(500)
    .optional(),
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
    if (new Set(result.tasks.map((task) => task.cmid)).size !== result.tasks.length) {
      ctx.addIssue({ code: "custom", message: "La respuesta repite una tarea." });
    }
    if (totalRows > 1000) {
      ctx.addIssue({ code: "custom", message: "La respuesta Moodle excede el límite de filas." });
    }
    result.tasks.forEach((task, index) => {
      const count = task.rows.length + (task.negativeRows?.length ?? 0);
      if (count > 500) {
        ctx.addIssue({
          code: "custom",
          path: ["tasks", index],
          message: "Demasiadas filas por tarea.",
        });
      }
      if (task.status !== "ok" && count > 0) {
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
  // Etiquetas anteriores: hasta 10 s de índice + una tanda de detalles de 10 s.
  // El proveedor usa tandas de tres; otros consumidores conservan hasta 20.
  timeoutMs = 5_000 + 10_000 + Math.ceil(Math.min(rawCmids.length, 20) / 3) * 10_000
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
      const returned = new Set(candidate.data.tasks.map((task) => task.cmid));
      if (
        candidate.data.tasks.length !== requested.size ||
        returned.size !== requested.size ||
        candidate.data.tasks.some((task) => !requested.has(task.cmid))
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
  // Match the bridge's two workers and 36-second per-task budget.
  timeoutMs = 5_000 + Math.ceil(Math.min(rawCmids.length, 20) / 2) * 36_000
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
