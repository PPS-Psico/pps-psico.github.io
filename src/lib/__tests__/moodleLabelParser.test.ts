import { readFileSync } from "node:fs";

type ParsedTask = {
  cmid: number;
  status: "no_access" | "not_submitted" | "submitted" | "graded" | "parse_error";
  submitted: boolean;
  gradeValue: number | null;
  gradeMax: number | null;
};

function loadLabelParser(): (cmid: number, document: Document) => ParsedTask {
  const label = readFileSync("docs/moodle-label-inicio-bridge.html", "utf8");
  const source = label.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!source) throw new Error("La etiqueta Moodle no contiene el script del puente.");

  document.body.innerHTML = `
    <div
      id="pps-aula-embed"
      data-moodle-user-id="32734"
      data-moodle-username="35154584"
    >
      <iframe id="pps-aula-frame"></iframe>
    </div>
  `;
  jest.useFakeTimers();
  window.eval(
    source.replace(/\}\)\(\);\s*$/, "window.__parseMoodleTaskForTest = parseTaskDocument; })();")
  );
  jest.clearAllTimers();
  jest.useRealTimers();

  return (
    window as typeof window & {
      __parseMoodleTaskForTest: (cmid: number, doc: Document) => ParsedTask;
    }
  ).__parseMoodleTaskForTest;
}

describe("lector de tareas de la etiqueta Moodle", () => {
  it("reconoce la variante UFLO sin envíos como tarea no entregada", () => {
    const parseTask = loadLabelParser();
    const taskDocument = new DOMParser().parseFromString(
      `
        <table class="submissionstatustable">
          <tr><th>Estado de la entrega</th><td>Todavía no se han realizado envíos</td></tr>
          <tr><th>Estado de la calificación</th><td>Sin calificar</td></tr>
        </table>
      `,
      "text/html"
    );

    expect(parseTask(1014110, taskDocument)).toMatchObject({
      cmid: 1014110,
      status: "not_submitted",
      submitted: false,
      gradeValue: null,
      gradeMax: null,
    });
  });

  it("conserva la lectura de una nota Moodle con coma decimal", () => {
    const parseTask = loadLabelParser();
    const taskDocument = new DOMParser().parseFromString(
      `
        <table class="feedbacktable">
          <tr><th>Calificación</th><td>83,00 / 100,00</td></tr>
          <tr><th>Calificado sobre</th><td>lunes, 10 de agosto de 2026, 11:09</td></tr>
        </table>
      `,
      "text/html"
    );

    expect(parseTask(946366, taskDocument)).toMatchObject({
      cmid: 946366,
      status: "graded",
      submitted: true,
      gradeValue: 83,
      gradeMax: 100,
    });
  });

  it.each([
    ["0,00 / 100,00", 0],
    ["8,00 / 100,00", 8],
    ["100,00 / 100,00", 100],
  ])("conserva la nota cruda %s sin inferir su escala", (display, expected) => {
    const parseTask = loadLabelParser();
    const taskDocument = new DOMParser().parseFromString(
      `<table class="feedbacktable"><tr><th>Calificación</th><td>${display}</td></tr></table>`,
      "text/html"
    );

    expect(parseTask(946366, taskDocument)).toMatchObject({
      status: "graded",
      submitted: true,
      gradeValue: expected,
      gradeMax: 100,
    });
  });

  it("reconoce una entrega enviada para calificar aunque todavía no tenga nota", () => {
    const parseTask = loadLabelParser();
    const taskDocument = new DOMParser().parseFromString(
      `<table class="submissionstatustable"><tr><th>Estado de la entrega</th><td>Enviado para calificar</td></tr><tr><th>Última modificación</th><td>martes, 11 de agosto de 2026</td></tr></table>`,
      "text/html"
    );

    expect(parseTask(946365, taskDocument)).toMatchObject({
      status: "submitted",
      submitted: true,
      gradeValue: null,
    });
  });
});
