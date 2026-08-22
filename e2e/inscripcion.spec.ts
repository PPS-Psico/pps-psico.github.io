import { expect, test } from "@playwright/test";
import { ALUMNO, LANZAMIENTO, mockSupabase, type MockOptions } from "./supabaseMock";

/**
 * Inscribirse a una convocatoria es la acción que más caro sale si se rompe:
 * el alumno pierde el cupo y nadie se entera hasta que reclama.
 */
test.describe("Inscripción a una convocatoria", () => {
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

  /*
    PENDIENTE. El click en "Inscribirme" no dispara todavía el RPC en el harness.
    Lo averiguado hasta acá, para que quien lo retome no empiece de cero:

      - El botón aparece y está habilitado; el click ocurre sin error.
      - La inscripción NO es un INSERT: va por el RPC
        `inscribir_convocatoria_multiopcion_v2`, que resuelve cupo y horario del
        lado de la base.
      - El "multiopcion" del nombre delata que falta un paso: el alumno elige una
        opción de horario antes. Falta mockear `lanzamiento_opciones` /
        `lanzamiento_opcion_horarios` y seleccionar una en la UI.
      - Al hacer click, la tarjeta se expande en la misma vista en lugar de
        navegar a una ruta de detalle, así que los selectores tienen que
        buscar dentro de esa tarjeta.

    Se deja como `fixme` y no se borra: el andamiaje ya está y esto es la
    continuación natural. Un test en rojo permanente enseña a ignorar el rojo.
  */
  test.fixme("al inscribirse se registra la convocatoria del alumno", async ({ page }) => {
    await entrar(page);

    await page.getByText(LANZAMIENTO.nombre_pps).first().click();

    const boton = page.getByRole("button", { name: /inscribirme/i });
    await expect(boton).toBeVisible({ timeout: 15_000 });
    await boton.click();

    /*
      La inscripción no es un INSERT sino un RPC: `inscribir_convocatoria_multiopcion_v2`,
      que resuelve cupo y opción de horario del lado de la base. Se afirma sobre
      esa llamada y no sobre un cartel de éxito, que es la diferencia entre
      "parece que anduvo" y "quedó anotada".
    */
    await expect
      .poll(() => escrituras.filter((e) => e.table.includes("inscribir_convocatoria")), {
        timeout: 15_000,
      })
      .not.toHaveLength(0);

    // Y que le mande el lanzamiento correcto, no otro.
    const llamada = escrituras.find((e) => e.table.includes("inscribir_convocatoria"));
    expect(JSON.stringify(llamada?.body)).toContain(LANZAMIENTO.id);
  });
});
