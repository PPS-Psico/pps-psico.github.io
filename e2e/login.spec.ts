import { expect, test } from "@playwright/test";
import { ALUMNO, mockSupabase } from "./supabaseMock";

/**
 * El login es la puerta de entrada: si se rompe, no importa qué tan bien
 * funcione el resto. Estos tests cubren los dos desenlaces que le importan a
 * una persona — entra, o le dicen con claridad por qué no.
 */
test.describe("Login del estudiante", () => {
  // El primer montaje puede absorber el costo de compilación fría de Vite.
  // Las aserciones conservan sus timeouts de 15 s; este margen evita que el
  // presupuesto global de 30 s corte un flujo sano justo al final.
  test.describe.configure({ timeout: 60_000 });

  test("con credenciales válidas entra al panel", async ({ page }) => {
    await mockSupabase(page, {
      tables: {
        estudiantes: [ALUMNO],
      },
    });

    await page.goto("/");

    await page.locator("#legajo").fill(ALUMNO.legajo);
    await page.locator("#password").fill("una-contraseña-cualquiera");
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    // El formulario desaparece: la sesión se montó y la app pasó al panel.
    await expect(page.locator("#legajo")).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveURL(/#\/student/);
  });

  test("con credenciales incorrectas explica el problema y no entra", async ({ page }) => {
    await mockSupabase(page, { loginOk: false });

    await page.goto("/");

    await page.locator("#legajo").fill("E2E999");
    await page.locator("#password").fill("incorrecta");
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    // El mensaje tiene que nombrar el problema real, no un error genérico.
    await expect(page.getByText(/legajo o contraseña incorrectos/i)).toBeVisible({
      timeout: 15_000,
    });
    // Y sigue en el login, no a mitad de camino.
    await expect(page.locator("#legajo")).toBeVisible();
  });
});
