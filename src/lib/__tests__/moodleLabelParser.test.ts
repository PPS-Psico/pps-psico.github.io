import { readFileSync } from "node:fs";

type ParsedTask = {
  cmid: number;
  status: "no_access" | "not_submitted" | "submitted" | "graded" | "parse_error";
  submitted: boolean;
  gradeValue: number | null;
  gradeMax: number | null;
  submissionFiles: string[] | null;
};

type ParsedJefeTask = {
  cmid: number;
  status: "ok" | "no_access" | "parse_error";
  rows: Array<{
    moodleUserId: number;
    moodleUsername: string;
    submissionFiles: string[] | null;
  }>;
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

function loadJefeLabelParser(): (cmid: number, document: Document) => ParsedJefeTask {
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
    source.replace(
      /\}\)\(\);\s*$/,
      "window.__parseMoodleJefeForTest = parseJefeGradingDocument; })();"
    )
  );
  jest.clearAllTimers();
  jest.useRealTimers();

  return (
    window as typeof window & {
      __parseMoodleJefeForTest: (cmid: number, doc: Document) => ParsedJefeTask;
    }
  ).__parseMoodleJefeForTest;
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

  it("extrae los adjuntos de la fila Archivos enviados sin leer otros enlaces", () => {
    const parseTask = loadLabelParser();
    const taskDocument = new DOMParser().parseFromString(
      `
        <table class="submissionstatustable">
          <tr><th>Estado de la entrega</th><td>Enviado para calificar</td></tr>
          <tr>
            <th>Archivos enviados</th>
            <td>
              <a href="https://campus.uflo.edu.ar/pluginfile.php/1/Informe%20final.pdf">Informe final.pdf</a>
              <a href="https://campus.uflo.edu.ar/pluginfile.php/1/IMG_4182.jpg">IMG_4182.jpg</a>
            </td>
          </tr>
          <tr><th>Comentarios</th><td><a href="/otro-enlace">No es un archivo</a></td></tr>
        </table>
      `,
      "text/html"
    );

    expect(parseTask(946365, taskDocument).submissionFiles).toEqual([
      "Informe final.pdf",
      "IMG_4182.jpg",
    ]);
  });

  it("extrae por estudiante los archivos visibles en la tabla de Entregas", () => {
    const parseJefeTask = loadJefeLabelParser();
    const gradingDocument = new DOMParser().parseFromString(
      `
        <table id="submissions">
          <thead>
            <tr>
              <th>Nombre completo</th>
              <th>Nombre de usuario</th>
              <th>Dirección de correo</th>
              <th>Estado</th>
              <th>Calificación</th>
              <th>Última modificación (entrega)</th>
              <th>Archivos enviados</th>
              <th>Comentarios de la entrega</th>
              <th>Última modificación (calificación)</th>
            </tr>
          </thead>
          <tbody>
            <tr class="user10970">
              <td><a href="/user/view.php?id=10970">Estudiante de prueba</a></td>
              <td>44684830</td>
              <td>estudiante@example.com</td>
              <td>Enviado para calificar</td>
              <td>-</td>
              <td>martes, 21 de julio de 2026, 01:12</td>
              <td>
                <a href="/pluginfile.php/1/assignsubmission_file/submission_files/1/Informe.pdf">Informe.pdf</a>
                <a href="/pluginfile.php/1/assignsubmission_file/submission_files/1/IMG_4182.jpg">IMG_4182.jpg</a>
              </td>
              <td><a href="/otro-enlace">No es un archivo</a></td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      `,
      "text/html"
    );

    expect(parseJefeTask(1085731, gradingDocument)).toMatchObject({
      status: "ok",
      rows: [
        {
          moodleUserId: 10970,
          moodleUsername: "44684830",
          submissionFiles: ["Informe.pdf", "IMG_4182.jpg"],
        },
      ],
    });
  });
});
