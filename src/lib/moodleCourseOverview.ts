/**
 * Parser del índice de tareas del curso (`/course/overview.php?id=<curso>&expand[]=assign`).
 *
 * Hoy el puente del alumno abre una página por cada tarea vinculada
 * (`/mod/assign/view.php?id=<cmid>`), así que sólo puede confirmar lo que ya
 * sospechábamos: si la práctica está vinculada a la tarea equivocada, o no está
 * vinculada a ninguna, no hay forma de que encuentre la entrega. Medido sobre
 * producción el 05/09/2026: 284 prácticas sin lectura no tienen vínculo, así que
 * el panel nunca pide nada para ellas.
 *
 * Esta página resuelve las tres cosas de una: lista TODAS las tareas del curso
 * -incluidas las ocultas- con el estado de entrega y la nota del propio alumno,
 * en una sola request. Verificado en el campus con rol estudiante: 112 filas.
 *
 * El DOM es estable y no hace falta adivinar nada: cada fila trae el cmid como
 * atributo y cada celda se identifica por `data-mdl-overview-item`.
 *
 *   <tr data-mdl-overview-cmid="946366">
 *     <td data-mdl-overview-item="name"             data-mdl-overview-value="Cita Salud">
 *     <td data-mdl-overview-item="duedate"          data-mdl-overview-value="">
 *     <td data-mdl-overview-item="completion"       data-mdl-overview-value="1">
 *     <td data-mdl-overview-item="submissionstatus" data-mdl-overview-value="Enviado para calificar">
 *     <td data-mdl-overview-item="Calificación"     data-mdl-overview-value="83.00000">
 *
 * La nota ya viene en formato máquina (`83.00000`, no `83,00`).
 */

export type CourseOverviewStatus = "graded" | "submitted" | "not_submitted" | "unknown";

export interface CourseOverviewTask {
  cmid: number;
  name: string;
  status: CourseOverviewStatus;
  submitted: boolean;
  gradeValue: number | null;
  gradeDisplay: string | null;
  dueDate: string | null;
}

/** Claves de celda conocidas; cualquier otra es la de nota, que viene traducida. */
const KNOWN_ITEMS = new Set(["name", "duedate", "completion", "submissionstatus"]);

function normalize(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function cellValue(row: Element, item: string): string | null {
  const cell = row.querySelector(`td[data-mdl-overview-item="${item}"]`);
  if (!cell) return null;
  const raw = cell.getAttribute("data-mdl-overview-value");
  return raw !== null && raw !== "" ? raw : null;
}

/**
 * La celda de nota se identifica por una clave traducida ("Calificación"), así
 * que se la busca por nombre y, si el campus cambia de idioma, por descarte
 * entre las claves conocidas. Sin esto, un cambio de idioma dejaría de leer
 * notas en silencio.
 */
function gradeCell(row: Element): Element | null {
  const cells = Array.from(row.querySelectorAll("td[data-mdl-overview-item]"));
  const byName = cells.find((cell) =>
    /calificacion|grade|nota/.test(normalize(cell.getAttribute("data-mdl-overview-item")))
  );
  if (byName) return byName;
  return (
    cells.find((cell) => !KNOWN_ITEMS.has(cell.getAttribute("data-mdl-overview-item") ?? "")) ??
    null
  );
}

function parseGrade(row: Element): { value: number | null; display: string | null } {
  const cell = gradeCell(row);
  if (!cell) return { value: null, display: null };
  const raw = cell.getAttribute("data-mdl-overview-value");
  const display = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
  if (raw === null || raw.trim() === "") {
    return { value: null, display: null };
  }
  const parsed = Number(raw.replace(",", "."));
  return {
    value: Number.isFinite(parsed) ? parsed : null,
    display: display && display !== "-" ? display : null,
  };
}

function parseStatus(rawStatus: string | null, hasGrade: boolean): CourseOverviewStatus {
  const status = normalize(rawStatus);
  // Una tarea calificada sigue diciendo "Enviado para calificar" en esta vista:
  // la señal de que hay nota es la celda de nota, no el estado.
  if (hasGrade) return "graded";
  if (!status || status === "-") return "unknown";
  if (status.includes("no entregado") || status.includes("sin entrega")) return "not_submitted";
  if (status.includes("enviado") || status.includes("entregado")) return "submitted";
  return "unknown";
}

export function parseCourseOverviewTasks(doc: Document): CourseOverviewTask[] {
  const rows = Array.from(doc.querySelectorAll("tr[data-mdl-overview-cmid]"));
  const tasks: CourseOverviewTask[] = [];

  rows.forEach((row) => {
    const rawCmid = row.getAttribute("data-mdl-overview-cmid");
    if (!rawCmid || !/^\d+$/.test(rawCmid)) return;
    const cmid = Number(rawCmid);
    if (!Number.isSafeInteger(cmid) || cmid <= 0) return;

    const grade = parseGrade(row);
    const status = parseStatus(cellValue(row, "submissionstatus"), grade.value !== null);

    tasks.push({
      cmid,
      name: cellValue(row, "name") ?? "",
      status,
      submitted: status === "graded" || status === "submitted",
      gradeValue: grade.value,
      gradeDisplay: grade.display,
      dueDate: cellValue(row, "duedate"),
    });
  });

  return tasks;
}
