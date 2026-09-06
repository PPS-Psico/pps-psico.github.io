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
      __jefePagination: (
        cmid: number
      ) => Promise<{ status: string; errorCode: string | null; rows: unknown[] }>;
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
});
