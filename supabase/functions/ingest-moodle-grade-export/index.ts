import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = "https://pps-psico.github.io";
const COURSE_ID = 3615;
const MAX_ROWS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["not_submitted", "submitted", "graded"]);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const isAllowedOrigin = (origin: string): boolean => {
  if (origin === APP_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
};

const headers = (origin: string) => ({
  ...(isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, max-age=0",
  Vary: "Origin",
});

const json = (origin: string, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: headers(origin) });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const normalizeDni = (value: unknown): string => String(value ?? "").replace(/\D/g, "");
const finiteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
};
const bounded = (value: unknown, max: number): string | null => {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text && text.length <= max ? text : null;
};
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
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

type Practice = {
  id: string;
  estudiante_id: string;
  lanzamiento_id: string | null;
  especialidad: string | null;
};
type Task = { id: number; course_id: number; moodle_id: string; moodle_grade_max: number | null };
type LaunchLink = { lanzamiento_id: string; orientacion_key: string; aula_entregas: Task | null };
type PracticeLink = { practica_id: string; aula_entregas: Task | null };

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")?.replace(/\/$/, "") ?? "";
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: isAllowedOrigin(origin) ? 204 : 403,
      headers: headers(origin),
    });
  }
  if (!isAllowedOrigin(origin)) return json(origin, { error: "origin_not_allowed" }, 403);
  if (req.method !== "POST") return json(origin, { error: "method_not_allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(origin, { error: "authentication_required" }, 401);

  let batchId: string | null = null;
  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json(origin, { error: "invalid_session" }, 401);

    const scoped = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: isAdmin, error: adminError } = await scoped.rpc("is_admin");
    if (adminError || !isAdmin) return json(origin, { error: "admin_required" }, 403);

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) throw new Error("invalid_body");
    batchId = bounded(body.batchId, 36);
    const fileName = bounded(body.fileName, 180);
    const observedAt = bounded(body.observedAt, 40);
    const dryRun = body.dryRun === true;
    const rawRows = body.rows;
    if (!batchId || !UUID_RE.test(batchId)) throw new Error("invalid_batch_id");
    if (!fileName) throw new Error("invalid_file_name");
    if (!observedAt || Number.isNaN(Date.parse(observedAt))) throw new Error("invalid_observed_at");
    if (!Array.isArray(rawRows) || rawRows.length < 1 || rawRows.length > MAX_ROWS) {
      throw new Error("invalid_row_count");
    }

    const rows = rawRows.map((raw, index) => {
      if (!isRecord(raw)) throw new Error(`invalid_row_${index + 1}`);
      const dni = normalizeDni(raw.dni);
      const cmid = finiteNumber(raw.cmid);
      const status = bounded(raw.status, 24) ?? "graded";
      const gradeValue = finiteNumber(raw.gradeValue);
      const gradeMax = finiteNumber(raw.gradeMax);
      const gradeDisplay = bounded(raw.gradeDisplay, 160);
      if (dni.length < 6 || dni.length > 11) throw new Error(`invalid_dni_${index + 1}`);
      if (!cmid || !Number.isInteger(cmid) || cmid <= 0)
        throw new Error(`invalid_cmid_${index + 1}`);
      if (!STATUSES.has(status)) throw new Error(`invalid_status_${index + 1}`);
      if (status === "graded") {
        if (
          gradeValue === null ||
          gradeMax === null ||
          gradeMax <= 0 ||
          gradeValue < 0 ||
          gradeValue > gradeMax
        ) {
          throw new Error(`invalid_grade_${index + 1}`);
        }
      }
      return { dni, cmid, status, gradeValue, gradeMax, gradeDisplay };
    });
    const uniqueRowKeys = new Set(rows.map((row) => `${row.dni}:${row.cmid}`));
    if (uniqueRowKeys.size !== rows.length) throw new Error("invalid_duplicate_rows");

    if (!dryRun) {
      const { error: batchError } = await admin.from("moodle_grade_import_batches").insert({
        id: batchId,
        requested_by: authData.user.id,
        file_name: fileName,
        observed_at: observedAt,
        row_count: rows.length,
      });
      if (batchError) throw new Error("batch_insert_failed");
    }

    const { data: students, error: studentError } = await admin
      .from("estudiantes")
      .select("id, dni");
    if (studentError) throw new Error("student_lookup_failed");
    const studentsByDni = new Map(
      (students ?? []).map((student) => [normalizeDni(student.dni), student] as const)
    );
    const studentIds = [
      ...new Set(rows.map((row) => studentsByDni.get(row.dni)?.id).filter(Boolean)),
    ] as string[];

    const { data: practiceData, error: practiceError } = await admin
      .from("practicas")
      .select("id, estudiante_id, lanzamiento_id, especialidad")
      .in(
        "estudiante_id",
        studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]
      );
    if (practiceError) throw new Error("practice_lookup_failed");
    const practices = (practiceData ?? []) as Practice[];
    const practiceIds = practices.map((practice) => practice.id);
    const launchIds = [
      ...new Set(practices.map((practice) => practice.lanzamiento_id).filter(Boolean)),
    ] as string[];

    const [directResult, launchResult, snapshotResult] = await Promise.all([
      admin
        .from("practica_moodle_tareas")
        .select("practica_id, aula_entregas!inner(id, course_id, moodle_id, moodle_grade_max)")
        .eq("validation_status", "confirmed")
        .in(
          "practica_id",
          practiceIds.length ? practiceIds : ["00000000-0000-0000-0000-000000000000"]
        ),
      admin
        .from("lanzamiento_moodle_tareas")
        .select(
          "lanzamiento_id, orientacion_key, aula_entregas!inner(id, course_id, moodle_id, moodle_grade_max)"
        )
        .eq("validation_status", "confirmed")
        .in(
          "lanzamiento_id",
          launchIds.length ? launchIds : ["00000000-0000-0000-0000-000000000000"]
        ),
      admin
        .from("moodle_grade_snapshots")
        .select("practica_id, cmid, scan_closed, last_observed_at")
        .in(
          "practica_id",
          practiceIds.length ? practiceIds : ["00000000-0000-0000-0000-000000000000"]
        ),
    ]);
    if (directResult.error || launchResult.error || snapshotResult.error) {
      throw new Error("link_lookup_failed");
    }
    const directLinks = (directResult.data ?? []) as unknown as PracticeLink[];
    const launchLinks = (launchResult.data ?? []) as unknown as LaunchLink[];
    const snapshots = new Map(
      (snapshotResult.data ?? []).map(
        (snapshot) => [`${snapshot.practica_id}:${snapshot.cmid}`, snapshot] as const
      )
    );

    const rejected: Array<{ dni: string; cmid: number; practicaId?: string; error: string }> = [];
    const acceptedRowIndexes = new Set<number>();
    const observationRows: Record<string, unknown>[] = [];
    for (const [rowIndex, row] of rows.entries()) {
      const student = studentsByDni.get(row.dni);
      if (!student) {
        rejected.push({ dni: row.dni, cmid: row.cmid, error: "student_not_found" });
        continue;
      }
      const studentPractices = practices.filter(
        (practice) => practice.estudiante_id === student.id
      );
      let matches = 0;
      for (const practice of studentPractices) {
        const direct = directLinks.filter(
          (link) => link.practica_id === practice.id && link.aula_entregas
        );
        let task: Task | null = null;
        if (direct.length > 0) {
          const exact = direct.filter(
            (link) => String(link.aula_entregas?.moodle_id) === String(row.cmid)
          );
          if (exact.length === 1) task = exact[0].aula_entregas;
        } else if (practice.lanzamiento_id) {
          const orientation = normalizeOrientation(practice.especialidad);
          const exact = launchLinks.filter(
            (link) =>
              link.lanzamiento_id === practice.lanzamiento_id &&
              link.orientacion_key === orientation &&
              String(link.aula_entregas?.moodle_id) === String(row.cmid)
          );
          if (exact.length === 1) task = exact[0].aula_entregas;
        }
        if (!task || task.course_id !== COURSE_ID) continue;
        const existingSnapshot = snapshots.get(`${practice.id}:${row.cmid}`);
        if (existingSnapshot?.scan_closed) {
          rejected.push({
            dni: row.dni,
            cmid: row.cmid,
            practicaId: practice.id,
            error: "terminal_requires_reopen",
          });
          matches += 1;
          continue;
        }
        if (
          existingSnapshot?.last_observed_at &&
          Date.parse(observedAt) < Date.parse(existingSnapshot.last_observed_at)
        ) {
          rejected.push({
            dni: row.dni,
            cmid: row.cmid,
            practicaId: practice.id,
            error: "stale_import",
          });
          matches += 1;
          continue;
        }
        if (
          row.gradeMax !== null &&
          task.moodle_grade_max !== null &&
          Math.abs(Number(task.moodle_grade_max) - row.gradeMax) > 0.001
        ) {
          rejected.push({
            dni: row.dni,
            cmid: row.cmid,
            practicaId: practice.id,
            error: "grade_scale_mismatch",
          });
          matches += 1;
          continue;
        }
        const payload = { batchId, observedAt, practiceId: practice.id, ...row };
        observationRows.push({
          observed_at: observedAt,
          auth_user_id: authData.user.id,
          estudiante_id: student.id,
          practica_id: practice.id,
          lanzamiento_id: practice.lanzamiento_id,
          aula_entrega_id: task.id,
          course_id: COURSE_ID,
          cmid: row.cmid,
          moodle_user_id: null,
          moodle_username: row.dni,
          task_status: row.status,
          submitted: row.status === "graded" || row.status === "submitted",
          grade_value: row.status === "graded" ? row.gradeValue : null,
          grade_max: row.gradeMax ?? task.moodle_grade_max,
          grade_display: row.gradeDisplay,
          graded_at_display: null,
          request_id: batchId,
          bridge_version: "moodle-grade-import/v1",
          parser_version: "normalized-csv/v1",
          confidence: "moodle_export_verified",
          payload_hash: await sha256(payload),
        });
        acceptedRowIndexes.add(rowIndex);
        matches += 1;
      }
      if (matches === 0) rejected.push({ dni: row.dni, cmid: row.cmid, error: "task_not_linked" });
    }
    if (observationRows.length > 1000) throw new Error("resolved_observation_limit");

    if (dryRun) {
      return json(origin, {
        dryRun: true,
        status:
          rejected.length === 0 ? "success" : observationRows.length > 0 ? "partial" : "failed",
        accepted: acceptedRowIndexes.size,
        rejected,
        observations: observationRows.length,
      });
    }

    if (observationRows.length > 0) {
      const { error: insertError } = await admin
        .from("moodle_grade_observations")
        .upsert(observationRows, {
          onConflict: "request_id,practica_id,cmid",
          ignoreDuplicates: true,
        });
      if (insertError) throw new Error("observation_insert_failed");
    }
    const { data: persisted, error: persistedError } = await admin
      .from("moodle_grade_observations")
      .select("*")
      .eq("request_id", batchId);
    if (persistedError) throw new Error("observation_readback_failed");
    const snapshotsToUpsert = (persisted ?? []).map((row) => ({
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
    if (snapshotsToUpsert.length > 0) {
      const { error: snapshotError } = await admin
        .from("moodle_grade_snapshots")
        .upsert(snapshotsToUpsert, { onConflict: "practica_id,cmid" });
      if (snapshotError) throw new Error("snapshot_upsert_failed");
    }

    const acceptedInputCount = acceptedRowIndexes.size;
    const status =
      rejected.length === 0 ? "success" : observationRows.length > 0 ? "partial" : "failed";
    await admin
      .from("moodle_grade_import_batches")
      .update({
        completed_at: new Date().toISOString(),
        status,
        accepted_count: acceptedInputCount,
        rejected_count: rejected.length,
        observation_count: persisted?.length ?? 0,
        snapshot_count: snapshotsToUpsert.length,
        details: { rejected: rejected.slice(0, MAX_ROWS) },
      })
      .eq("id", batchId);

    return json(
      origin,
      {
        success: status !== "failed",
        status,
        accepted: acceptedInputCount,
        rejected,
        observations: persisted?.length ?? 0,
        snapshots: snapshotsToUpsert.length,
      },
      status === "failed" ? 400 : 200
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "server_error";
    if (batchId) {
      await admin
        .from("moodle_grade_import_batches")
        .update({
          completed_at: new Date().toISOString(),
          status: "failed",
          details: { error: code },
        })
        .eq("id", batchId);
    }
    console.error(`[moodle-grade-import] ${code}`);
    return json(origin, { error: code }, code.startsWith("invalid_") ? 400 : 500);
  }
});
