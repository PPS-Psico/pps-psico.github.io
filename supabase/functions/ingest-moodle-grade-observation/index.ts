import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = "https://pps-psico.github.io";
const COURSE_ID = 3615;
const BRIDGE_VERSION = "pps-moodle-bridge/v1";
const PARSER_VERSION = "assignment-page/v1";
const MAX_OBSERVATIONS = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_STATUSES = new Set(["no_access", "not_submitted", "submitted", "graded", "parse_error"]);
const TASK_STATUS_RANK: Record<string, number> = {
  no_access: 1,
  parse_error: 1,
  not_submitted: 2,
  submitted: 3,
  graded: 4,
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const isAllowedOrigin = (origin: string): boolean => {
  if (origin === APP_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
};

const responseHeaders = (origin: string) => ({
  ...(isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
});

const json = (origin: string, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const boundedText = (value: unknown, maxLength: number): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("invalid_text");
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > maxLength) throw new Error("invalid_text");
  return cleaned;
};

const finiteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("invalid_number");
  return value;
};

const normalizeDni = (value: unknown): string => String(value ?? "").replace(/\D/g, "");

const normalizeOrientation = (value: unknown): string | null => {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("educ")) return "educacional";
  if (normalized.includes("clinic")) return "clinica";
  if (normalized.includes("comunit")) return "comunitaria";
  if (normalized.includes("labor") || normalized.includes("organiz")) return "laboral";
  return null;
};

const sha256 = async (value: unknown): Promise<string> => {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

type PracticeRow = {
  id: string;
  estudiante_id: string;
  lanzamiento_id: string | null;
  especialidad: string | null;
};

type TaskLinkRow = {
  id: number;
  lanzamiento_id: string;
  orientacion_key: string;
  aula_entregas: {
    id: number;
    course_id: number;
    moodle_id: string;
    moodle_grade_max: number | null;
  } | null;
};

type PracticeTaskLinkRow = {
  id: number;
  practica_id: string;
  aula_entregas: {
    id: number;
    course_id: number;
    moodle_id: string;
    moodle_grade_max: number | null;
  } | null;
};

type ObservationRejection = {
  practicaId: string;
  cmid: number;
  error: string;
};

type SyncRunResult = {
  outcome: "success" | "partial" | "noop" | "failed";
  errorCode?: string | null;
  accepted?: number;
  stored?: number;
  snapshotUpdated?: number;
  preserved?: number;
  skippedTerminal?: number;
  rejected?: ObservationRejection[];
  insertError?: string;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")?.replace(/\/$/, "") ?? "";
  const runStartedAt = Date.now();
  let activeRunId: string | null = null;

  const finishRun = async (result: SyncRunResult): Promise<void> => {
    if (!activeRunId) return;
    const rejected = result.rejected ?? [];
    const { error } = await admin
      .from("moodle_sync_runs")
      .update({
        completed_at: new Date().toISOString(),
        outcome: result.outcome,
        error_code: result.errorCode ?? null,
        accepted_count: result.accepted ?? 0,
        stored_count: result.stored ?? 0,
        snapshot_updated_count: result.snapshotUpdated ?? 0,
        preserved_count: result.preserved ?? 0,
        skipped_terminal_count: result.skippedTerminal ?? 0,
        rejected_count: rejected.length,
        duration_ms: Math.max(0, Date.now() - runStartedAt),
        details: {
          rejected: rejected.slice(0, MAX_OBSERVATIONS),
          ...(result.insertError ? { insertError: result.insertError } : {}),
        },
      })
      .eq("request_id", activeRunId);
    if (error) console.error(`[moodle-grade] sync run update failed: ${error.message}`);
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: isAllowedOrigin(origin) ? 204 : 403,
      headers: responseHeaders(origin),
    });
  }
  if (!isAllowedOrigin(origin)) return json(origin, { error: "origin_not_allowed" }, 403);
  if (req.method !== "POST") return json(origin, { error: "method_not_allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(origin, { error: "authentication_required" }, 401);

  try {
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) return json(origin, { error: "invalid_session" }, 401);

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) return json(origin, { error: "invalid_body" }, 400);

    const requestId = boundedText(body.requestId, 36);
    const bridgeVersion = boundedText(body.bridgeVersion, 48);
    const moodleUsername = boundedText(body.moodleUsername, 64);
    const moodleUserId = finiteNumber(body.moodleUserId);
    const courseId = finiteNumber(body.courseId);
    const observedAt = boundedText(body.observedAt, 40);
    const rawObservations = body.observations;

    if (!requestId || !UUID_RE.test(requestId)) throw new Error("invalid_request_id");
    if (bridgeVersion !== BRIDGE_VERSION) throw new Error("invalid_bridge_version");
    if (courseId !== COURSE_ID) throw new Error("invalid_course");
    if (!moodleUserId || !Number.isInteger(moodleUserId) || moodleUserId <= 0) {
      throw new Error("invalid_moodle_user");
    }
    if (!moodleUsername || !normalizeDni(moodleUsername))
      throw new Error("invalid_moodle_username");
    if (!observedAt || Number.isNaN(Date.parse(observedAt))) throw new Error("invalid_observed_at");
    const observedMs = Date.parse(observedAt);
    if (observedMs < Date.now() - 15 * 60_000 || observedMs > Date.now() + 5 * 60_000) {
      throw new Error("stale_observation");
    }
    if (
      !Array.isArray(rawObservations) ||
      rawObservations.length === 0 ||
      rawObservations.length > MAX_OBSERVATIONS
    ) {
      throw new Error("invalid_observation_count");
    }

    const { data: student, error: studentError } = await admin
      .from("estudiantes")
      .select("id, dni, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (studentError || !student) return json(origin, { error: "student_not_found" }, 403);
    if (student.role && student.role !== "Alumno") {
      return json(origin, { error: "student_role_required" }, 403);
    }
    if (normalizeDni(student.dni) !== normalizeDni(moodleUsername)) {
      return json(origin, { error: "moodle_identity_mismatch" }, 403);
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount, error: rateError } = await admin
      .from("moodle_grade_observations")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", user.id)
      .gte("received_at", oneMinuteAgo);
    if (rateError) throw new Error("rate_limit_lookup_failed");
    if ((recentCount ?? 0) + rawObservations.length > 60) {
      return json(origin, { error: "rate_limit_exceeded" }, 429);
    }

    const normalizedInput = rawObservations.map((raw) => {
      if (!isRecord(raw)) throw new Error("invalid_observation");
      const practicaId = boundedText(raw.practicaId, 36);
      const cmid = finiteNumber(raw.cmid);
      const status = boundedText(raw.status, 24);
      const gradeValue = finiteNumber(raw.gradeValue);
      const gradeMax = finiteNumber(raw.gradeMax);
      const gradeDisplay = boundedText(raw.gradeDisplay, 160);
      const gradedAtDisplay = boundedText(raw.gradedAtDisplay, 200);
      if (!practicaId || !UUID_RE.test(practicaId)) throw new Error("invalid_practice");
      if (!cmid || !Number.isInteger(cmid) || cmid <= 0) throw new Error("invalid_cmid");
      if (!status || !TASK_STATUSES.has(status)) throw new Error("invalid_status");
      if (status === "graded") {
        if (gradeValue === null || gradeMax === null || gradeMax <= 0) {
          throw new Error("invalid_grade");
        }
        if (gradeValue < 0 || gradeValue > gradeMax) throw new Error("invalid_grade_range");
      } else if (gradeValue !== null) {
        throw new Error("grade_without_graded_status");
      }
      return {
        practicaId,
        cmid,
        status,
        submitted: raw.submitted === true || status === "graded" || status === "submitted",
        gradeValue,
        gradeMax,
        gradeDisplay,
        gradedAtDisplay,
      };
    });

    const { error: runInsertError } = await admin.from("moodle_sync_runs").upsert(
      {
        request_id: requestId,
        auth_user_id: user.id,
        estudiante_id: student.id,
        started_at: new Date(runStartedAt).toISOString(),
        observed_at: observedAt,
        bridge_version: bridgeVersion,
        parser_version: PARSER_VERSION,
        outcome: "pending",
        requested_count: rawObservations.length,
        fetched_count: normalizedInput.length,
      },
      { onConflict: "request_id" }
    );
    if (runInsertError) throw new Error("sync_run_insert_failed");
    activeRunId = requestId;

    const practiceIds = [...new Set(normalizedInput.map((item) => item.practicaId))];
    const { data: practiceData, error: practiceError } = await admin
      .from("practicas")
      .select("id, estudiante_id, lanzamiento_id, especialidad")
      .eq("estudiante_id", student.id)
      .in("id", practiceIds);
    if (practiceError) throw new Error("practice_lookup_failed");
    const practices = (practiceData ?? []) as PracticeRow[];
    if (practices.length !== practiceIds.length) throw new Error("practice_not_owned");

    const launchIds = [
      ...new Set(practices.map((practice) => practice.lanzamiento_id).filter(Boolean)),
    ] as string[];
    let links: TaskLinkRow[] = [];
    if (launchIds.length > 0) {
      const { data: linkData, error: linkError } = await admin
        .from("lanzamiento_moodle_tareas")
        .select(
          "id, lanzamiento_id, orientacion_key, aula_entregas!inner(id, course_id, moodle_id, moodle_grade_max)"
        )
        .eq("validation_status", "confirmed")
        .in("lanzamiento_id", launchIds);
      if (linkError) throw new Error("task_link_lookup_failed");
      links = (linkData ?? []) as unknown as TaskLinkRow[];
    }

    const { data: practiceLinkData, error: practiceLinkError } = await admin
      .from("practica_moodle_tareas")
      .select("id, practica_id, aula_entregas!inner(id, course_id, moodle_id, moodle_grade_max)")
      .eq("validation_status", "confirmed")
      .in("practica_id", practiceIds);
    if (practiceLinkError) throw new Error("practice_task_link_lookup_failed");
    const practiceLinks = (practiceLinkData ?? []) as unknown as PracticeTaskLinkRow[];

    const resolvedObservations = await Promise.all(
      normalizedInput.map(async (item) => {
        try {
          const practice = practices.find((candidate) => candidate.id === item.practicaId);
          if (!practice) throw new Error("practice_not_owned");

          const directLinks = practiceLinks.filter(
            (candidate) => candidate.practica_id === practice.id && candidate.aula_entregas
          );
          let task: TaskLinkRow["aula_entregas"] = null;

          // A confirmed practice-level override is authoritative. It exists for
          // legacy records that intentionally have no trustworthy launch.
          if (directLinks.length > 0) {
            const exactDirectLinks = directLinks.filter(
              (candidate) =>
                candidate.aula_entregas?.course_id === COURSE_ID &&
                String(candidate.aula_entregas?.moodle_id) === String(item.cmid)
            );
            if (exactDirectLinks.length !== 1) {
              throw new Error("task_not_confirmed_for_practice");
            }
            task = exactDirectLinks[0].aula_entregas;
          } else {
            if (!practice.lanzamiento_id) throw new Error("practice_without_task_link");
            const orientation = normalizeOrientation(practice.especialidad);
            const matchingLinks = links.filter(
              (link) =>
                link.lanzamiento_id === practice.lanzamiento_id &&
                link.aula_entregas?.course_id === COURSE_ID &&
                String(link.aula_entregas?.moodle_id) === String(item.cmid)
            );
            const link = orientation
              ? matchingLinks.find((candidate) => candidate.orientacion_key === orientation)
              : matchingLinks.length === 1
                ? matchingLinks[0]
                : null;
            task = link?.aula_entregas ?? null;
          }

          if (!task) throw new Error("task_not_confirmed_for_practice");
          const configuredMax = task.moodle_grade_max;
          if (
            item.gradeMax !== null &&
            configuredMax !== null &&
            Math.abs(Number(configuredMax) - item.gradeMax) > 0.001
          ) {
            throw new Error("grade_scale_mismatch");
          }
          const payloadHash = await sha256({
            requestId,
            observedAt,
            practicaId: item.practicaId,
            cmid: item.cmid,
            status: item.status,
            submitted: item.submitted,
            gradeValue: item.gradeValue,
            gradeMax: item.gradeMax,
            gradeDisplay: item.gradeDisplay,
            gradedAtDisplay: item.gradedAtDisplay,
          });
          return {
            row: {
              observed_at: observedAt,
              auth_user_id: user.id,
              estudiante_id: student.id,
              practica_id: practice.id,
              lanzamiento_id: practice.lanzamiento_id,
              aula_entrega_id: task.id,
              course_id: COURSE_ID,
              cmid: item.cmid,
              moodle_user_id: moodleUserId,
              moodle_username: normalizeDni(moodleUsername),
              task_status: item.status,
              submitted: item.submitted,
              grade_value: item.status === "graded" ? item.gradeValue : null,
              grade_max: item.gradeMax ?? configuredMax,
              grade_display: item.gradeDisplay,
              graded_at_display: item.gradedAtDisplay,
              request_id: requestId,
              bridge_version: bridgeVersion,
              parser_version: PARSER_VERSION,
              confidence: "moodle_session_observed",
              payload_hash: payloadHash,
            },
            rejection: null,
          };
        } catch (error) {
          const code = error instanceof Error ? error.message : "invalid_observation";
          return {
            row: null,
            rejection: {
              practicaId: item.practicaId,
              cmid: item.cmid,
              error: code,
            } satisfies ObservationRejection,
          };
        }
      })
    );

    const observationRows = resolvedObservations.flatMap((result) =>
      result.row ? [result.row] : []
    );
    const rejectedObservations = resolvedObservations.flatMap((result) =>
      result.rejection ? [result.rejection] : []
    );
    if (observationRows.length === 0) {
      await finishRun({
        outcome: "failed",
        errorCode: "no_valid_observations",
        rejected: rejectedObservations,
      });
      return json(origin, { error: "no_valid_observations", rejected: rejectedObservations }, 400);
    }

    const candidatePracticeIds = [...new Set(observationRows.map((row) => row.practica_id))];
    const { data: existingSnapshots, error: existingSnapshotError } = await admin
      .from("moodle_grade_snapshots")
      .select(
        "practica_id, cmid, task_status, observed_at, last_observed_at, scan_closed, grade_revision"
      )
      .in("practica_id", candidatePracticeIds);
    if (existingSnapshotError) throw new Error("snapshot_lookup_failed");
    const existingByKey = new Map(
      (existingSnapshots ?? []).map((row) => [`${row.practica_id}:${row.cmid}`, row])
    );

    // Clientes nuevos ni siquiera solicitan estas tareas. Este filtro protege
    // además contra pestañas antiguas todavía abiertas: una nota ya guardada no
    // vuelve a ingresar al ledger ni a ejecutar el trigger académico.
    const terminalSkipped = observationRows.filter(
      (row) => existingByKey.get(`${row.practica_id}:${row.cmid}`)?.scan_closed === true
    ).length;
    const rowsToStore = observationRows.filter(
      (row) => existingByKey.get(`${row.practica_id}:${row.cmid}`)?.scan_closed !== true
    );

    if (rowsToStore.length === 0) {
      const outcome = rejectedObservations.length > 0 ? "partial" : "noop";
      await finishRun({
        outcome,
        accepted: observationRows.length,
        skippedTerminal: terminalSkipped,
        rejected: rejectedObservations,
      });
      return json(origin, {
        success: true,
        stored: 0,
        snapshotUpdated: 0,
        preserved: 0,
        skippedTerminal: terminalSkipped,
        rejected: rejectedObservations,
        observedAt,
      });
    }

    const { error: insertError } = await admin
      .from("moodle_grade_observations")
      .upsert(rowsToStore, {
        onConflict: "request_id,practica_id,cmid",
        ignoreDuplicates: true,
      });
    if (insertError) {
      const insertErrorDetail = `${insertError.code ?? ""} ${insertError.message}`.trim();
      console.error(`[moodle-grade] observation_insert_failed: ${insertErrorDetail}`, {
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        practiceIds: rowsToStore.map((row) => row.practica_id),
      });
      await finishRun({
        outcome: "failed",
        errorCode: "observation_insert_failed",
        rejected: rejectedObservations,
        insertError: insertErrorDetail,
      });
      return json(origin, { error: "observation_insert_failed" }, 500);
    }

    const storedPracticeIds = [...new Set(rowsToStore.map((row) => row.practica_id))];
    const { data: persistedData, error: persistedError } = await admin
      .from("moodle_grade_observations")
      .select("*")
      .eq("auth_user_id", user.id)
      .eq("request_id", requestId)
      .in("practica_id", storedPracticeIds);
    if (persistedError || !persistedData?.length) throw new Error("observation_readback_failed");

    const snapshots = persistedData.map((row) => ({
      practica_id: row.practica_id,
      cmid: row.cmid,
      latest_observation_id: row.id,
      estudiante_id: row.estudiante_id,
      lanzamiento_id: row.lanzamiento_id,
      aula_entrega_id: row.aula_entrega_id,
      task_status: row.task_status,
      submitted: row.submitted,
      grade_value: row.grade_value,
      grade_max: row.grade_max,
      grade_display: row.grade_display,
      graded_at_display: row.graded_at_display,
      observed_at: row.observed_at,
      received_at: row.received_at,
      confidence: row.confidence,
    }));

    const snapshotsToUpsert = snapshots.filter((row) => {
      const existing = existingByKey.get(`${row.practica_id}:${row.cmid}`);
      if (!existing) return true;
      if (existing.scan_closed) return false;
      const previousObservedAt = existing.last_observed_at ?? existing.observed_at;
      return Date.parse(row.observed_at) >= Date.parse(previousObservedAt);
    });
    const preserved = snapshotsToUpsert.filter((row) => {
      const existing = existingByKey.get(`${row.practica_id}:${row.cmid}`);
      if (!existing) return false;
      return (
        existing.task_status === "graded" ||
        TASK_STATUS_RANK[row.task_status] < TASK_STATUS_RANK[existing.task_status]
      );
    }).length;

    if (snapshotsToUpsert.length > 0) {
      const { error: snapshotError } = await admin
        .from("moodle_grade_snapshots")
        .upsert(snapshotsToUpsert, { onConflict: "practica_id,cmid" });
      if (snapshotError) throw new Error("snapshot_upsert_failed");
    }

    console.log(
      `[moodle-grade] Stored ${snapshots.length}; snapshot ${snapshotsToUpsert.length}; preserved ${preserved}; terminal ${terminalSkipped}; rejected ${rejectedObservations.length}.`
    );
    const outcome = rejectedObservations.length > 0 ? "partial" : "success";
    await finishRun({
      outcome,
      accepted: observationRows.length,
      stored: snapshots.length,
      snapshotUpdated: snapshotsToUpsert.length,
      preserved,
      skippedTerminal: terminalSkipped,
      rejected: rejectedObservations,
    });
    return json(origin, {
      success: true,
      stored: snapshots.length,
      snapshotUpdated: snapshotsToUpsert.length,
      preserved,
      skippedTerminal: terminalSkipped,
      rejected: rejectedObservations,
      observedAt,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "server_error";
    await finishRun({ outcome: "failed", errorCode: code });
    const clientErrors = new Set([
      "invalid_text",
      "invalid_number",
      "invalid_request_id",
      "invalid_bridge_version",
      "invalid_course",
      "invalid_moodle_user",
      "invalid_moodle_username",
      "invalid_observed_at",
      "stale_observation",
      "invalid_observation_count",
      "invalid_observation",
      "invalid_practice",
      "invalid_cmid",
      "invalid_status",
      "invalid_grade",
      "invalid_grade_range",
      "grade_without_graded_status",
      "practice_not_owned",
      "practice_without_task_link",
      "task_not_confirmed_for_practice",
      "grade_scale_mismatch",
    ]);
    console.error(`[moodle-grade] ${code}`);
    return json(origin, { error: code }, clientErrors.has(code) ? 400 : 500);
  }
});
