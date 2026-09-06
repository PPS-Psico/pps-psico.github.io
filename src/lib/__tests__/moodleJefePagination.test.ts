import { readFileSync } from "node:fs";

const table = (count: number, submittedIndex: number) =>
  `<table id="submissions"><thead><tr><th>Nombre de usuario</th><th>Estado</th><th>Última modificación (entrega)</th></tr></thead><tbody>${Array.from({ length: count }, (_, i) => `<tr class="user${1000 + i}"><td>${30000000 + i}</td><td>${i === submittedIndex ? "Enviado para calificar" : "Sin entrega"}</td><td>-</td></tr>`).join("")}</tbody></table>`;

function loadBridge() {
  const source = readFileSync("docs/moodle-label-inicio-bridge.html", "utf8").match(
    /<script>([\s\S]*?)<\/script>/
  )?.[1];
  if (!source) throw new Error("Missing bridge");
  document.body.innerHTML = '<div id="pps-aula-embed"><iframe id="pps-aula-frame"></iframe></div>';
  window.eval(source.replace(/\}\)\(\);\s*$/, "window.__jefePagination = fetchJefeTask; })();"));
  return (
    window as unknown as {
      __jefePagination: (cmid: number) => Promise<{
        status: string;
        errorCode: string | null;
        rows: unknown[];
        negativeRows: unknown[];
      }>;
    }
  ).__jefePagination;
}

describe("paginación real del barrido docente", () => {
  const original = window.fetch;
  afterEach(() => {
    window.fetch = original;
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  it("continúa después de 100 alumnos aunque sólo uno haya entregado", async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      url,
      text: async () => (url.includes("&page=1") ? table(2, 1) : table(100, 0)),
    }));
    window.fetch = fetchMock as unknown as typeof fetch;
    const result = await loadBridge()(55);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.rows).toHaveLength(2);
    expect(result.negativeRows).toHaveLength(98);
    expect(result.errorCode).toBeNull();
  });
  it("conserva lo leído y marca parcial cuando falla la siguiente página", async () => {
    jest.useFakeTimers();
    window.fetch = jest.fn(async (url: string) => ({
      ok: !url.includes("&page=1"),
      url,
      text: async () => table(100, 0),
    })) as unknown as typeof fetch;
    const result = await loadBridge()(55);
    expect(result.rows).toHaveLength(1);
    expect(result.errorCode).toBe("partial_page_unavailable");
  });
  it("termina un padrón de cuatro páginas que supera los antiguos 18 segundos", async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(async (url: string) => {
      jest.setSystemTime(Date.now() + 6_000);
      return { ok: true, url, text: async () => table(url.includes("&page=3") ? 46 : 100, -1) };
    });
    window.fetch = fetchMock as unknown as typeof fetch;
    const result = await loadBridge()(55);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.errorCode).toBeNull();
  });
  it("limpia el filtro persistente Enviada en cada página", async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(async (url: string) => {
      const query = new URL(url, "https://campus.uflo.edu.ar").searchParams;
      const complete =
        ["status", "workflowfilter", "markingallocationfilter", "tifirst", "tilast"].every(
          (key) => query.has(key) && query.get(key) === ""
        ) &&
        query.get("group") === "0" &&
        query.get("suspendedparticipantsfilter") === "0";
      return {
        ok: true,
        url,
        text: async () => (complete ? table(query.has("page") ? 2 : 100, -1) : table(1, 0)),
      };
    });
    window.fetch = fetchMock as unknown as typeof fetch;
    const result = await loadBridge()(55);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.rows).toHaveLength(0);
    expect(result.negativeRows).toHaveLength(100);
    expect(result.errorCode).toBeNull();
  });
  it("no pagina por las filas vacías de relleno de Moodle", async () => {
    jest.useFakeTimers();
    const html = table(1, -1).replace(
      "</tbody>",
      `${'<tr class="emptyrow"><td></td><td></td><td></td></tr>'.repeat(99)}</tbody>`
    );
    const fetchMock = jest.fn(async (url: string) => ({ ok: true, url, text: async () => html }));
    window.fetch = fetchMock as unknown as typeof fetch;
    const result = await loadBridge()(55);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.negativeRows).toHaveLength(1);
    expect(result.errorCode).toBeNull();
  });
  it("conserva lecturas negativas incluso si no hubo entregas antes de un fallo", async () => {
    jest.useFakeTimers();
    window.fetch = jest.fn(async (url: string) => ({
      ok: !url.includes("&page=1"),
      url,
      text: async () => table(100, -1),
    })) as unknown as typeof fetch;
    const result = await loadBridge()(55);
    expect(result.rows).toHaveLength(0);
    expect(result.negativeRows).toHaveLength(100);
    expect(result.negativeRows[0]).toMatchObject({
      status: "not_submitted",
      submitted: false,
      submittedAt: null,
    });
    expect(result.errorCode).toBe("partial_page_unavailable");
  });
  it.each(["No entregado", "Draft (not submitted)"])(
    "no convierte %s en una entrega",
    async (status) => {
      jest.useFakeTimers();
      window.fetch = jest.fn(async (url: string) => ({
        ok: true,
        url,
        text: async () => table(1, -1).replace("Sin entrega", status),
      })) as unknown as typeof fetch;
      const result = await loadBridge()(55);
      expect(result.rows).toHaveLength(0);
      expect(result.negativeRows).toHaveLength(1);
      expect(result.errorCode).toBeNull();
    }
  );
  it("un estado desconocido produce cobertura parcial, no ausencia inventada", async () => {
    jest.useFakeTimers();
    window.fetch = jest.fn(async (url: string) => ({
      ok: true,
      url,
      text: async () => table(1, -1).replace("Sin entrega", "Estado nuevo desconocido"),
    })) as unknown as typeof fetch;
    const result = await loadBridge()(55);
    expect(result.rows).toHaveLength(0);
    expect(result.negativeRows).toHaveLength(0);
    expect(result.errorCode).toBe("partial_unknown_submission_status");
  });
});
