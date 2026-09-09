import { parseCourseOverviewTasks } from "../moodleCourseOverview";

/**
 * Fixture tomado del campus real (curso 3615, rol estudiante, 05/09/2026).
 * Se conservan los atributos tal cual los emite Moodle, incluida la clave de
 * nota traducida ("Calificación").
 */
function buildDoc(rowsHtml: string): Document {
  return new DOMParser().parseFromString(
    `<table class="course-overview-table"><tbody>${rowsHtml}</tbody></table>`,
    "text/html"
  );
}

const filaCalificada = `
<tr data-mdl-overview-cmid="946366">
  <td data-mdl-overview-item="name" data-mdl-overview-value="Cita Salud">
    <a href="/mod/assign/view.php?id=946366">Cita Salud</a> Tareas 2025
  </td>
  <td data-mdl-overview-item="duedate" data-mdl-overview-value=""> - </td>
  <td data-mdl-overview-item="completion" data-mdl-overview-value="1">Hecho</td>
  <td data-mdl-overview-item="submissionstatus" data-mdl-overview-value="Enviado para calificar">Enviado para calificar</td>
  <td data-mdl-overview-item="Calificación" data-mdl-overview-value="83.00000">83,00</td>
</tr>`;

const filaSinEntrega = `
<tr data-mdl-overview-cmid="805657">
  <td data-mdl-overview-item="name" data-mdl-overview-value="Barriletes en Bandada - 14">Barriletes en Bandada - 14</td>
  <td data-mdl-overview-item="duedate" data-mdl-overview-value=""> - </td>
  <td data-mdl-overview-item="completion" data-mdl-overview-value=""> - </td>
  <td data-mdl-overview-item="submissionstatus" data-mdl-overview-value="No entregado">No entregado</td>
  <td data-mdl-overview-item="Calificación" data-mdl-overview-value=""> - </td>
</tr>`;

const filaEntregadaSinNota = `
<tr data-mdl-overview-cmid="1111226">
  <td data-mdl-overview-item="name" data-mdl-overview-value="Barriletes en Bandada">Barriletes en Bandada</td>
  <td data-mdl-overview-item="duedate" data-mdl-overview-value=""> - </td>
  <td data-mdl-overview-item="completion" data-mdl-overview-value="1">Hecho</td>
  <td data-mdl-overview-item="submissionstatus" data-mdl-overview-value="Enviado para calificar">Enviado para calificar</td>
  <td data-mdl-overview-item="Calificación" data-mdl-overview-value=""> - </td>
</tr>`;

describe("parseCourseOverviewTasks", () => {
  it("lee la nota de una tarea calificada aunque el estado siga diciendo 'Enviado para calificar'", () => {
    const [task] = parseCourseOverviewTasks(buildDoc(filaCalificada));
    expect(task).toMatchObject({
      cmid: 946366,
      name: "Cita Salud",
      status: "graded",
      submitted: true,
      gradeValue: 83,
      gradeDisplay: "83,00",
    });
  });

  it("distingue entrega sin corregir de tarea sin entrega", () => {
    const tasks = parseCourseOverviewTasks(buildDoc(filaEntregadaSinNota + filaSinEntrega));
    expect(tasks.map((t) => [t.cmid, t.status, t.submitted])).toEqual([
      [1111226, "submitted", true],
      [805657, "not_submitted", false],
    ]);
    expect(tasks[0].gradeValue).toBeNull();
  });

  it("devuelve todas las tareas del curso, no sólo las que tienen entrega", () => {
    const tasks = parseCourseOverviewTasks(
      buildDoc(filaCalificada + filaSinEntrega + filaEntregadaSinNota)
    );
    expect(tasks).toHaveLength(3);
    // Enumera tareas. Vincularlas a prácticas requiere otra etapa explícita.
    expect(tasks.map((t) => t.cmid)).toContain(805657);
  });

  it("sigue leyendo la nota si el campus cambia el idioma de la columna", () => {
    const enIngles = filaCalificada.replace('item="Calificación"', 'item="Grade"');
    const [task] = parseCourseOverviewTasks(buildDoc(enIngles));
    expect(task.gradeValue).toBe(83);
    expect(task.status).toBe("graded");
  });

  it("ignora filas sin cmid válido", () => {
    const basura = `<tr data-mdl-overview-cmid="abc"><td data-mdl-overview-item="name" data-mdl-overview-value="X"></td></tr>`;
    expect(parseCourseOverviewTasks(buildDoc(basura + filaSinEntrega))).toHaveLength(1);
  });
});
