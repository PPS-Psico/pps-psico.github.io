import { createHash } from "node:crypto";
import { buildDescriptionHtml } from "./moodle-writer-description.mjs";

export const COURSE_ID = 3615;
export const WRITER_SCHEMA = "moodle-writer/v2";
export const AREAS = {
  clinica: "Área Clínica",
  laboral: "Área Laboral / Comunitaria",
  comunitaria: "Área Laboral / Comunitaria",
  educacional: "Área Educacional",
};
export const minute = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error("Fecha inválida en configuración Moodle");
  return Math.floor(time / 60000);
};
export const isoMinute = (value) =>
  minute(value) === null ? null : new Date(minute(value) * 60000).toISOString();

export function describeIntent(row, catalog = null) {
  const launch = row.lanzamiento ?? {};
  const year = Number(/^([0-9]{4})-/.exec(launch.fecha_inicio ?? "")?.[1]);
  if (!year || !AREAS[row.orientacion_key])
    throw new Error("Año u orientación sin resolver: requiere atención");
  if (
    row.aula_entrega_id &&
    (!catalog ||
      catalog.id !== row.aula_entrega_id ||
      catalog.course_id !== COURSE_ID ||
      !/^[0-9]+$/.test(catalog.moodle_id))
  )
    throw new Error("El vínculo de catálogo no resolvió un CMID real");
  if (!["visible", "hidden", "stealth"].includes(row.desired_visibility))
    throw new Error("Visibilidad no admitida");
  if (
    row.desired_due_at &&
    (!row.desired_grading_due_at || minute(row.desired_grading_due_at) < minute(row.desired_due_at))
  )
    throw new Error("Recordarme calificar en falta o es anterior a la entrega");
  const description = row.desired_description_html ?? buildDescriptionHtml({ ...row, ...launch });
  return {
    intentId: row.id,
    mode: row.mode,
    status: row.provisioning_status,
    year,
    linkedCmid: catalog ? Number(catalog.moodle_id) : null,
    action:
      row.mode === "legacy_shared"
        ? "observe_only"
        : row.aula_entrega_id
          ? "verify_existing"
          : "inventory_before_create",
    courseId: COURSE_ID,
    sectionTitle: `Tareas ${year}`,
    areaBanner: AREAS[row.orientacion_key],
    expected: {
      stableKey: row.stable_key,
      name: row.desired_name,
      descriptionHtml:
        row.aula_entrega_id && row.desired_description_html == null ? null : description,
      openAt: isoMinute(row.desired_open_at),
      dueAt: isoMinute(row.desired_due_at),
      cutoffAt: isoMinute(row.desired_cutoff_at),
      gradingDueAt: isoMinute(row.desired_grading_due_at),
      gradeMode: row.desired_grade_mode,
      gradeMax: row.desired_grade_max,
      sectionKey: row.desired_section_key,
      visibility: row.desired_visibility,
      fileSubmissions: true,
      onlineText: false,
    },
  };
}

export function queueState(rows, now = Date.now()) {
  const dedicated = rows.filter((r) => r.mode === "dedicated");
  const attention = dedicated.filter((r) =>
    ["needs_attention", "disabled"].includes(r.provisioning_status)
  );
  const ready = dedicated.filter(
    (r) =>
      (!r.next_reconcile_at || Date.parse(r.next_reconcile_at) <= now) &&
      (["pending", "error"].includes(r.provisioning_status) ||
        (["claimed", "reconciling"].includes(r.provisioning_status) &&
          Date.parse(r.lease_expires_at) < now))
  );
  return {
    status: attention.length ? "attention" : ready.length ? "ready" : "idle",
    ready,
    attention,
  };
}

// An inventory is a read artifact, never a name search or a database catalog.
export function inventoryDecision(plan, inventory, now = Date.now()) {
  if (plan.mode !== "dedicated") throw new Error("Legacy es sólo lectura");
  if (
    inventory?.courseId !== COURSE_ID ||
    inventory.complete !== true ||
    !Array.isArray(inventory.courseAssignmentCmids) ||
    !Array.isArray(inventory.activities) ||
    !Number.isFinite(Date.parse(inventory.observedAt)) ||
    now - Date.parse(inventory.observedAt) > 30 * 60000 ||
    Date.parse(inventory.observedAt) > now + 300000
  )
    throw new Error("Inventario completo y reciente del curso requerido");
  const ids = inventory.courseAssignmentCmids;
  if (
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(ids).size !== ids.length ||
    inventory.activities.length !== ids.length ||
    new Set(inventory.activities.map((a) => a.cmid)).size !== ids.length ||
    inventory.activities.some((a) => !ids.includes(a.cmid) || typeof a.idNumber !== "string")
  )
    throw new Error("El inventario no cubre todas las tareas enumeradas en Campus");
  const matches = inventory.activities.filter((a) => a.idNumber === plan.expected.stableKey);
  if (matches.length > 1) throw new Error("Clave estable duplicada en Campus");
  if (plan.linkedCmid && (matches.length !== 1 || matches[0].cmid !== plan.linkedCmid))
    throw new Error("El vínculo confirmado no coincide con el inventario");
  if (matches.length) return { action: "verify_existing", cmid: matches[0].cmid };
  if (inventory.activities.some((a) => a.name === plan.expected.name))
    throw new Error("Nombre coincidente sin clave estable: requiere revisión, no creación");
  return { action: "create", cmid: null };
}

export function validateReadback(plan, observed, claimedAt, now = Date.now()) {
  if (plan.mode !== "dedicated") throw new Error("Legacy no admite confirmación automática");
  if (!Number.isSafeInteger(observed.cmid) || observed.cmid <= 0 || observed.courseId !== COURSE_ID)
    throw new Error("Curso o CMID inválido");
  if (plan.linkedCmid && observed.cmid !== plan.linkedCmid)
    throw new Error("No se puede sustituir la tarea vinculada");
  if (
    ![
      `https://campus.uflo.edu.ar/course/modedit.php?update=${observed.cmid}`,
      `https://campus.uflo.edu.ar/course/modedit.php?update=${observed.cmid}&return=1`,
    ].includes(observed.sourceUrl) ||
    !Number.isFinite(Date.parse(claimedAt)) ||
    !Number.isFinite(Date.parse(observed.observedAt)) ||
    Date.parse(observed.observedAt) < Date.parse(claimedAt) ||
    Date.parse(observed.observedAt) > now + 300000
  )
    throw new Error("Relectura posterior al lease requerida");
  if (
    observed.sectionTitle !== plan.sectionTitle ||
    observed.areaBanner !== plan.areaBanner ||
    !Number.isSafeInteger(observed.sectionId) ||
    observed.sectionId <= 0
  )
    throw new Error("Sección real o año incorrectos");
  const mismatches = [];
  for (const [key, value] of Object.entries(plan.expected)) {
    if (!(key in observed)) {
      mismatches.push(key);
      continue;
    }
    // Existing tasks with no declared HTML keep their teacher-authored text.
    if (key === "descriptionHtml" && value === null && typeof observed[key] === "string") continue;
    if (["openAt", "dueAt", "cutoffAt", "gradingDueAt"].includes(key)) {
      if (minute(value) !== minute(observed[key])) mismatches.push(key);
    } else if (observed[key] !== value) mismatches.push(key);
  }
  if (mismatches.length) throw new Error(`Configuración diferente: ${mismatches.join(", ")}`);
  return {
    schema: WRITER_SCHEMA,
    sourceUrl: observed.sourceUrl,
    observedAt: observed.observedAt,
    sectionTitle: observed.sectionTitle,
    sectionId: observed.sectionId,
    areaBanner: observed.areaBanner,
    gradingDueAt: observed.gradingDueAt,
    fileSubmissions: observed.fileSubmissions,
    onlineText: observed.onlineText,
    readbackSha256: createHash("sha256").update(JSON.stringify(observed)).digest("hex"),
  };
}
