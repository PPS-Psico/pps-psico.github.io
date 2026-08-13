import { buildEmbeddedPanelMessage, isViewportBoundedPanelRoute } from "../embeddedFrameSizing";

describe("embeddedFrameSizing", () => {
  it.each([
    "#/admin",
    "#/admin/lanzador",
    "#/jefe",
    "#/directivo/reportes",
    "#/reportero",
    "#/testing/visual",
  ])("mantiene una altura estable en la ruta operativa %s", (hash) => {
    expect(isViewportBoundedPanelRoute(hash)).toBe(true);
    expect(buildEmbeddedPanelMessage({ hash, bodyOverflow: "", contentHeight: 140_000 })).toEqual({
      ppsPanel: true,
    });
  });

  it("conserva el autoalto en las rutas estudiantiles", () => {
    expect(isViewportBoundedPanelRoute("#/student")).toBe(false);
    expect(
      buildEmbeddedPanelMessage({
        hash: "#/student/convocatorias",
        bodyOverflow: "",
        contentHeight: 913.2,
      })
    ).toEqual({ ppsPanel: true, height: 914 });
  });

  it("usa la altura estable mientras cualquier diálogo bloquea el fondo", () => {
    expect(
      buildEmbeddedPanelMessage({
        hash: "#/student",
        bodyOverflow: "hidden",
        contentHeight: 8_000,
      })
    ).toEqual({ ppsPanel: true });
  });
});
