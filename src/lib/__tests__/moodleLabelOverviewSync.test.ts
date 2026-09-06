import { readFileSync } from "node:fs";
import { parseCourseOverviewTasks } from "../moodleCourseOverview";

type TestBridge = {
  fetchTasks: (cmids: number[]) => Promise<Array<{ cmid: number; status: string }>>;
  parse: (doc: Document) => Record<string, { status: string; gradeValue: number | null }>;
};

const studentRow = `<tr data-mdl-overview-cmid="1">
  <td data-mdl-overview-item="submissionstatus" data-mdl-overview-value="No entregado"></td>
  <td data-mdl-overview-item="Calificación" data-mdl-overview-value=""></td></tr>`;
const html = (rows: string) => `<table><tbody>${rows}</tbody></table>`;
const detail = `<table class="submissionstatustable"><tr><th>Estado de la entrega</th><td>Todavía no se han realizado envíos</td></tr></table>`;
const response = (body: string) => ({
  ok: true,
  url: "https://campus.uflo.edu.ar/",
  text: async () => body,
});

function loadBridge(): TestBridge {
  const source = readFileSync("docs/moodle-label-inicio-bridge.html", "utf8").match(
    /<script>([\s\S]*?)<\/script>/
  )?.[1];
  if (!source) throw new Error("missing bridge");
  document.body.innerHTML = `<div id="pps-aula-embed" data-course-id="3615"><iframe id="pps-aula-frame"></iframe></div>`;
  window.eval(
    source.replace(
      /\}\)\(\);\s*$/,
      "esEstudiante = function () { return true; }; window.__overviewSyncTest = {fetchTasks: fetchTasks, parse: parseCourseOverviewDoc}; })();"
    )
  );
  jest.clearAllTimers();
  return (window as unknown as { __overviewSyncTest: TestBridge }).__overviewSyncTest;
}

describe("índice y detalle del puente real", () => {
  const originalFetch = window.fetch;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    window.fetch = originalFetch;
  });

  it("comparte el índice entre tandas cercanas sin omitir detalles ausentes del índice", async () => {
    const fetchMock = jest.fn(async (url: string) =>
      response(url.includes("overview.php") ? html(studentRow) : detail)
    );
    window.fetch = fetchMock as unknown as typeof fetch;
    const bridge = loadBridge();
    const results = await Promise.all([bridge.fetchTasks([1]), bridge.fetchTasks([2])]);
    expect(results.flat().map((task) => task.cmid)).toEqual([1, 2]);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("overview.php"))).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("view.php?id=2"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("view.php?id=1"))).toBe(false);
  });

  it("un índice lento cae al detalle en 4 s y no vuelve a pagar el fallo en la siguiente tanda", async () => {
    const fetchMock = jest.fn((url: string, options: RequestInit) => {
      if (!url.includes("overview.php")) return Promise.resolve(response(detail));
      return new Promise((_, reject) =>
        options.signal?.addEventListener("abort", () => reject(new Error("aborted")))
      );
    });
    window.fetch = fetchMock as unknown as typeof fetch;
    const bridge = loadBridge();
    const first = bridge.fetchTasks([1, 2, 3]);
    await jest.advanceTimersByTimeAsync(4000);
    expect(await first).toHaveLength(3);
    await bridge.fetchTasks([4]);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("overview.php"))).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => url.includes("/mod/assign/view.php"))
    ).toHaveLength(4);
  });

  it("vence el cache para detectar una entrega posterior", async () => {
    const fetchMock = jest.fn(async (url: string) =>
      response(url.includes("overview.php") ? html(studentRow) : detail)
    );
    window.fetch = fetchMock as unknown as typeof fetch;
    const bridge = loadBridge();
    await bridge.fetchTasks([1]);
    await jest.advanceTimersByTimeAsync(30001);
    await bridge.fetchTasks([1]);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("overview.php"))).toHaveLength(2);
  });

  it("ambos parsers excluyen agregados docentes y columnas numéricas desconocidas", () => {
    const bridge = loadBridge();
    const teacher = `<tr data-mdl-overview-cmid="3"><td data-mdl-overview-item="submissions" data-mdl-overview-value="12">12 de 346</td></tr>`;
    const unknownColumn = studentRow.replace(
      "</tr>",
      '<td data-mdl-overview-item="extension" data-mdl-overview-value="99"></td></tr>'
    );
    const doc = new DOMParser().parseFromString(html(teacher + unknownColumn), "text/html");
    expect(Object.keys(bridge.parse(doc))).toEqual(["1"]);
    expect(bridge.parse(doc)[1]).toMatchObject({ status: "not_submitted", gradeValue: null });
    expect(parseCourseOverviewTasks(doc)).toHaveLength(1);
    expect(parseCourseOverviewTasks(doc)[0]).toMatchObject({
      status: "not_submitted",
      gradeValue: null,
    });
  });

  it("una tabla docente nunca permite omitir la página de detalle", async () => {
    window.fetch = jest.fn(async (url: string) =>
      response(
        url.includes("overview.php")
          ? html(
              `<tr data-mdl-overview-cmid="1"><td data-mdl-overview-item="submissions" data-mdl-overview-value="0"></td></tr>`
            )
          : detail
      )
    ) as unknown as typeof fetch;
    const bridge = loadBridge();
    await bridge.fetchTasks([1]);
    expect(window.fetch).toHaveBeenCalledWith(
      expect.stringContaining("view.php?id=1"),
      expect.anything()
    );
  });
});
