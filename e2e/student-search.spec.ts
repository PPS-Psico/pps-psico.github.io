import { expect, test } from "@playwright/test";
import { ALUMNO, LANZAMIENTO, mockSupabase } from "./supabaseMock";

test("reemplazos busca por páginas sin descargar el padrón y se recupera de errores", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const requests: URL[] = [];
  const students = Array.from({ length: 40 }, (_, i) => ({
    id: `student-${i}`,
    nombre: `Ana Prueba ${String(i + 1).padStart(2, "0")}`,
    legajo: `E2E${i}`,
  }));
  await mockSupabase(page, {
    tables: {
      estudiantes: [{ ...ALUMNO, role: "SuperUser" }],
      lanzamientos_pps: [
        {
          ...LANZAMIENTO,
          estado_convocatoria: "Activa",
          seguro_gestionado_at: "2026-09-01T12:00:00Z",
        },
      ],
    },
  });
  await page.route("**/rest/v1/rpc/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" })
  );
  let failing = false;
  await page.route("**/rest/v1/estudiantes*", (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has("or")) return route.fallback();
    requests.push(url);
    const start = Number(url.searchParams.get("offset") ?? 0);
    return route.fulfill({
      status: failing ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        failing ? { message: "Servicio no disponible" } : students.slice(start, start + 21)
      ),
    });
  });
  await page.goto("/#/login");
  await page.locator("#legajo").fill(ALUMNO.legajo);
  await page.locator("#password").fill("contraseña-de-prueba");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/#\/admin/, { timeout: 30_000 });
  await page.goto(`/#/admin/lanzador?launchId=${LANZAMIENTO.id}`);
  await page
    .getByRole("button", { name: /Buscar otro estudiante activo/ })
    .click({ timeout: 30_000 });
  expect(requests).toHaveLength(0);
  const input = page.getByRole("searchbox", { name: "Nombre o legajo del estudiante" });
  await input.fill("Ana");
  await expect(page.getByRole("button", { name: /^Seleccionar a / })).toHaveCount(20);
  expect(requests).toHaveLength(1);
  expect(requests[0].searchParams.get("select")).toBe("id,nombre,legajo");
  expect(requests[0].searchParams.get("limit")).toBe("21");
  expect(requests[0].searchParams.get("estado")).toBe("ilike.activo");
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Seleccionar a Ana Prueba 21", exact: true })
  ).toBeVisible();
  expect(requests.at(-1)?.searchParams.get("offset")).toBe("20");
  await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toBeDisabled();
  await page
    .locator(".lv4-replacement-search")
    .screenshot({ path: testInfo.outputPath("search-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await input.scrollIntoViewIfNeeded();
  const box = await input.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page
    .locator(".lv4-replacement-search")
    .screenshot({ path: testInfo.outputPath("search-mobile.png") });
  failing = true;
  await input.fill("Beatriz");
  await expect(page.getByText("No se pudo consultar a los estudiantes.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("No se encontraron estudiantes disponibles.")).toHaveCount(0);
  failing = false;
  await page.getByRole("button", { name: "Reintentar búsqueda" }).click();
  await expect(page.getByRole("button", { name: /^Seleccionar a / })).toHaveCount(20);
});
