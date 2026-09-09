import { expect, test } from "@playwright/test";
import { ALUMNO, mockSupabase } from "./supabaseMock";

test("Inicio distingue fallo de consulta y cero real, y recupera la sección", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  await mockSupabase(page, { tables: { estudiantes: [{ ...ALUMNO, role: "SuperUser" }] } });
  let failing = true;
  await page.route("**/rest/v1/finalizacion_pps*", (route) =>
    route.fulfill({
      status: failing ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(failing ? { message: "Servicio no disponible" } : []),
    })
  );
  await page.goto("/#/login");
  await page.locator("#legajo").fill(ALUMNO.legajo);
  await page.locator("#password").fill("contraseña-de-prueba");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  // En desarrollo la primera visita compila la vista administrativa diferida.
  await expect(page).toHaveURL(/#\/admin\/dashboard/, { timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "Reintentar egreso · finalizaciones" })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Nada por acreditar", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No disponible", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("inicio-error-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const retry = page.getByRole("button", { name: "Reintentar egreso · finalizaciones" });
  await retry.scrollIntoViewIfNeeded();
  const retryBox = await retry.boundingBox();
  expect(retryBox).not.toBeNull();
  expect(retryBox!.x).toBeGreaterThanOrEqual(0);
  expect(retryBox!.x + retryBox!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("inicio-error-mobile.png"), fullPage: true });
  failing = false;
  await page.getByRole("button", { name: "Reintentar egreso · finalizaciones" }).click();
  await expect(page.getByText("Nada por acreditar", { exact: true })).toBeVisible();
  await expect(page.getByText("No disponible", { exact: true })).toHaveCount(0);
  expect(crashes).toEqual([]);
});
