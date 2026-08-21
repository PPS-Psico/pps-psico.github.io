/**
 * Dry-run del aprovisionador de tareas Moodle. NO escribe: ni en Moodle ni en
 * Supabase. No reclama leases. Solo responde "que haria el worker si corriera".
 *
 * Uso:
 *   node scripts/moodle-provisioner-dry-run.mjs
 *       -> las intenciones `dedicated` que el worker reclamaria ahora.
 *   node scripts/moodle-provisioner-dry-run.mjs --preview <lanzamiento_id>
 *       -> la hoja de trabajo de ese lanzamiento aunque siga en legacy_shared,
 *          para poder mirar un candidato a piloto antes de convertirlo.
 *
 * La invariante grading_due >= due la garantiza un CHECK en la tabla, asi que
 * una fila que llegue hasta aca ya es aceptable para Moodle.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COURSE_ID = 3615;
const previewIndex = process.argv.indexOf("--preview");
const previewLaunchId = previewIndex > -1 ? process.argv[previewIndex + 1] : null;

const fmt = (iso) =>
  iso
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(iso))
    : "— sin definir —";

const esc = (s) =>
  String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

const AREA_BANNER = {
  clinica: "Área Clínica",
  laboral: "Área Laboral / Comunitaria",
  comunitaria: "Área Laboral / Comunitaria",
  educacional: "Área Educacional",
};

const DISPONIBILIDAD_LABEL = {
  visible: "Mostrar en la pagina del curso",
  hidden: "Ocultar en la pagina del curso",
  stealth: "Hacerlo disponible pero no mostrarlo en la pagina del curso (stealth)",
};

function buildDescriptionHtml(row) {
  const periodo = [row.fecha_inicio, row.fecha_finalizacion]
    .filter(Boolean)
    .map((d) =>
      new Date(d + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    )
    .join(" — ");
  return [
    '<div style="border:1px solid #DCE3EC;border-radius:6px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">',
    '<div style="background:#203B73;color:#ffffff;padding:14px 18px">',
    `<div style="font-size:12px;letter-spacing:.1em;opacity:.85">PPS · ${esc(row.orientacion_key).toUpperCase()}</div>`,
    `<div style="font-size:19px;font-weight:700">${esc(row.nombre_pps)}</div></div>`,
    '<table style="width:100%;border-collapse:collapse;font-size:14px">',
    `<tr><td style="padding:9px 18px;color:#4E5766;width:150px">Período</td><td style="padding:9px 18px">${esc(periodo)} (estimado)</td></tr>`,
    `<tr><td style="padding:9px 18px;color:#4E5766">Horas</td><td style="padding:9px 18px">${esc(row.horas_acreditadas ?? "—")} h</td></tr>`,
    "</table>",
    '<div style="padding:14px 18px;background:#F7E7DE;font-size:13px">',
    "La fecha de cierre de la PPS es estimada. Tenés 30 días corridos desde que termina para subir el informe.",
    "</div></div>",
  ].join("");
}

const SELECT = `
  id, lanzamiento_id, orientacion_key, mode, stable_key, desired_name,
  desired_open_at, desired_due_at, desired_grading_due_at,
  desired_grade_mode, desired_grade_max, desired_section_key,
  desired_visibility, provisioning_status, aula_entrega_id,
  lanzamiento:lanzamientos_pps!moodle_task_intents_lanzamiento_id_fkey(
    nombre_pps, fecha_inicio, fecha_finalizacion, horas_acreditadas
  )`;

let query = supabase.from("moodle_task_intents").select(SELECT);
query = previewLaunchId
  ? query.eq("lanzamiento_id", previewLaunchId)
  : query.eq("mode", "dedicated").in("provisioning_status", ["pending", "error"]);

const { data, error } = await query;

// Las intenciones en needs_attention NO son reclamables: el claim solo toma
// pending/error o leases vencidos. Si no se las mostrara aca, una tarea trabada
// desapareceria del radar y la rutina informaria "nada que hacer" mientras algo
// quedo a medias. Van aparte porque piden una decision humana, no un reintento.
const { data: stuck } = await supabase
  .from("moodle_task_intents")
  .select("id, desired_name, orientacion_key, last_error_code, last_error_message")
  .eq("mode", "dedicated")
  .in("provisioning_status", ["needs_attention", "disabled"]);
if (error) {
  console.error("No se pudo consultar las intenciones:", error.message);
  process.exitCode = 1;
}

console.log(`\n=== DRY RUN · aprovisionador de tareas Moodle · curso ${COURSE_ID} ===`);
console.log(
  previewLaunchId ? `Modo: vista previa del lanzamiento ${previewLaunchId}` : "Modo: cola real"
);
console.log("Sin escrituras: no toca Moodle, no reclama leases, no modifica Supabase.\n");

if (!data.length) {
  console.log("No hay nada que aprovisionar.");
  if (!previewLaunchId) {
    console.log("Las intenciones legacy_shared nunca generan trabajo: sus tareas ya");
    console.log("existen y no se tocan. Para sumar una PPS al modelo nuevo hay que");
    console.log("marcarla con lanzamientos_pps.moodle_pilot_dedicated y reconciliar.");
    console.log("Podes inspeccionar un candidato con: --preview <lanzamiento_id>");
  }
}

for (const row of data ?? []) {
  const l = row.lanzamiento ?? {};
  const flat = { ...row, ...l };
  const action = row.aula_entrega_id ? "adoptar y verificar" : "crear desde plantilla";

  console.log("─".repeat(72));
  console.log(`${flat.nombre_pps} · ${row.orientacion_key}`);
  console.log(`  modo             ${row.mode}   estado: ${row.provisioning_status}`);
  console.log(
    `  accion prevista  ${row.mode === "legacy_shared" ? "ninguna (legacy nunca se crea)" : action}`
  );
  console.log("\n  Valores a cargar en el formulario de Moodle:");
  console.log(`    Nombre de la tarea        ${row.desired_name}`);
  console.log(`    Numero ID                 ${row.stable_key}`);
  console.log(`    Permitir entregas desde   ${fmt(row.desired_open_at)}`);
  console.log(`    Fecha de entrega          ${fmt(row.desired_due_at)}`);
  console.log(`    Fecha limite              DESHABILITADA (se aceptan entregas tarde)`);
  console.log(`    Recordarme calificar en   ${fmt(row.desired_grading_due_at)}`);
  console.log(`    Calificacion maxima       ${row.desired_grade_max} (${row.desired_grade_mode})`);
  console.log(`    Disponibilidad            ${DISPONIBILIDAD_LABEL[row.desired_visibility] ?? row.desired_visibility}`);
  console.log(`    Tipos de entrega          Archivos enviados (texto en linea apagado)`);
  const banner = AREA_BANNER[row.orientacion_key];
  console.log("\n  Donde crearla en Moodle:");
  console.log(`    Pestaña / seccion         Tareas 2026 (course=${COURSE_ID}, section=1)`);
  console.log(
    banner
      ? `    Banner                    despues del ultimo item bajo "${banner}", antes del banner siguiente`
      : `    Banner                    sin mapear para orientacion "${row.orientacion_key}": preguntale a Blas donde va antes de crear`
  );
  console.log("\n  Descripcion (formato HTML):");
  console.log("    " + buildDescriptionHtml(flat));
  console.log("");
}
if (stuck?.length) {
  console.log("─".repeat(72));
  console.log(`ATENCION: ${stuck.length} intencion(es) trabadas.`);
  console.log("El worker NO puede reclamarlas solo. Necesitan una decision y luego");
  console.log("reabrirse con request_moodle_task_reconcile_v1(<intentId>).");
  console.log("");
  for (const st of stuck) {
    console.log(`  ${st.desired_name} (${st.orientacion_key})`);
    console.log(`    intentId ${st.id}`);
    console.log(`    motivo   ${st.last_error_code ?? "-"}: ${st.last_error_message ?? "-"}
`);
  }
}

if (data?.length) {
  console.log("─".repeat(72));
  console.log(`${data.length} unidad(es). Nada fue escrito.\n`);
}
