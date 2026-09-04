import { expect, test } from "@playwright/test";
import { ALUMNO, LANZAMIENTO, mockSupabase, type MockOptions } from "./supabaseMock";

/**
 * Inscribirse a una convocatoria es la acción que más caro sale si se rompe:
 * el alumno pierde el cupo y nadie se entera hasta que reclama.
 */
test.describe("Inscripción a una convocatoria", () => {
  // El primer montaje puede absorber el costo de compilación fría de Vite.
  // Las esperas funcionales siguen acotadas a 15 s cada una.
  test.describe.configure({ timeout: 60_000 });

  const escrituras: Array<{ table: string; method: string; body: unknown }> = [];

  const entrar = async (page: import("@playwright/test").Page, extra: MockOptions = {}) => {
    await mockSupabase(page, {
      tables: {
        estudiantes: [ALUMNO],
        lanzamientos_pps: [LANZAMIENTO],
        ...extra.tables,
      },
      onWrite: (table, method, body) => escrituras.push({ table, method, body }),
    });

    await page.goto("/");
    await page.locator("#legajo").fill(ALUMNO.legajo);
    await page.locator("#password").fill("cualquiera");
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await expect(page.locator("#legajo")).toBeHidden({ timeout: 15_000 });
  };

  test.beforeEach(() => {
    escrituras.length = 0;
  });

  test("la convocatoria abierta aparece y se puede abrir su detalle", async ({ page }) => {
    await entrar(page);

    await expect(page.getByText(LANZAMIENTO.nombre_pps).first()).toBeVisible({ timeout: 15_000 });
  });

  test("completar el formulario deja la inscripción registrada", async ({ page }) => {
    await entrar(page);

    // La tarjeta se despliega en la misma vista; no hay ruta de detalle aparte.
    await page.getByText(LANZAMIENTO.nombre_pps).first().click();
    await page.getByRole("button", { name: /inscribirme/i }).click();

    /*
      "Inscribirme" no inscribe: abre el formulario de inscripción, que pide
      situación laboral y estado académico. Se elige "No trabajo" a propósito,
      porque la otra opción exige adjuntar un certificado y eso metería una
      subida de archivo en un test que no es sobre eso.
    */
    await page.getByRole("button", { name: /no trabajo/i }).click();
    await page.getByRole("button", { name: /solo debo finales/i }).click();
    /*
      Responder "solo debo finales" despliega un segundo campo obligatorio. Sus
      opciones son `div role="radio"`, no botones, así que hay que buscarlas por
      ese rol: con `getByRole("button")` no aparecen.
    */
    await page.getByRole("radio", { name: "Solo TIF/PPS" }).click();
    await page.getByRole("button", { name: /confirmar inscripción/i }).click();

    /*
      Se afirma sobre la escritura y no sobre un cartel de éxito: es la
      diferencia entre "parece que anduvo" y "quedó anotada".

      Este lanzamiento no tiene franjas horarias, así que la inscripción va por
      `db.convocatorias.create` -> POST a la tabla. Con franjas iría por el RPC
      `inscribir_convocatoria_multiopcion_v2`, que es otro camino y merece su
      propio test.
    */
    await expect
      .poll(() => escrituras.filter((e) => e.table === "convocatorias" && e.method === "POST"), {
        timeout: 15_000,
      })
      .not.toHaveLength(0);

    // Y que quede atada al lanzamiento correcto, no a otro.
    const inscripcion = escrituras.find((e) => e.table === "convocatorias");
    expect(JSON.stringify(inscripcion?.body)).toContain(LANZAMIENTO.id);
  });
});
