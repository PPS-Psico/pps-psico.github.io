import { expect, test, type Page } from "@playwright/test";
import { ALUMNO, mockSupabase } from "./supabaseMock";

const PRACTICA_ID = "00000000-0000-4000-8000-000000000030";

const practicaPresencial = {
  id: PRACTICA_ID,
  estudiante_id: ALUMNO.id,
  estado: "Finalizada",
  fecha_inicio: "2026-03-01",
  fecha_finalizacion: "2026-07-31",
  horas_realizadas: 120,
  especialidad: "Clínica",
  es_online: false,
  nombre_institucion: "Hospital de Prueba E2E",
  informe_estado: "calificado",
  nota: "Aprobado",
  nota_moodle: 9,
  nota_moodle_cmid: 4242,
  tipo_actividad: "PPS",
};

const transition = (outcome: "auto_started" | "manual_required" | "requirements_pending") => ({
  id: `00000000-0000-4000-8000-00000000004${
    outcome === "auto_started" ? "1" : outcome === "manual_required" ? "2" : "3"
  }`,
  estudiante_id: ALUMNO.id,
  outcome,
  acknowledged_at: null,
  created_at: "2026-08-28T18:00:00.000Z",
  finalizacion_id: outcome === "auto_started" ? "00000000-0000-4000-8000-000000000050" : null,
  trigger_observation_id: "00000000-0000-4000-8000-000000000060",
  trigger_practica_id: PRACTICA_ID,
  uncertain_practice_ids: outcome === "manual_required" ? [PRACTICA_ID] : [],
  requirement_gaps: outcome === "requirements_pending" ? ["total_hours"] : [],
  documentation_snapshot: {
    version: "moodle-submission-evidence/v1",
    threshold: 0.9,
    items: [
      {
        practicaId: PRACTICA_ID,
        esOnline: false,
        cmid: 4242,
        reportEvidence: "graded",
        attendanceEvidence: outcome === "manual_required" ? "needs_review" : "detected",
        attendanceConfidence: outcome === "manual_required" ? 0 : 1,
        fileCount: 2,
        logicalFileCount: 2,
        classifierVersion: "submission-files/v1",
        automatic: outcome !== "manual_required",
      },
    ],
  },
});

const entrar = async (
  page: Page,
  outcome: "auto_started" | "manual_required" | "requirements_pending",
  onWrite?: (table: string, method: string, body: unknown) => void
) => {
  await mockSupabase(page, {
    tables: {
      estudiantes: [ALUMNO],
      practicas: [practicaPresencial],
      accreditation_transition_events: [transition(outcome)],
      finalizacion_pps: [],
    },
    onWrite,
  });

  await page.goto("/");
  await page.locator("#legajo").fill(ALUMNO.legajo);
  await page.locator("#password").fill("cualquiera");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page.locator("#legajo")).toBeHidden({ timeout: 15_000 });
};

test.describe("Transición automática de acreditación", () => {
  test.describe.configure({ timeout: 60_000 });

  test("informa que el trámite ya se inició cuando toda la evidencia es segura", async ({
    page,
  }) => {
    await entrar(page, "auto_started");

    await expect(
      page.getByRole("heading", { name: /tu acreditación ya está en marcha/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/no tenés que volver a subir esos archivos/i)).toBeVisible();
  });

  test("explica los requisitos académicos pendientes sin pedir documentación", async ({ page }) => {
    await entrar(page, "requirements_pending");

    await expect(
      page.getByRole("heading", { name: /tu último informe fue aprobado/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/antes falta completar o corregir: horas totales/i)).toBeVisible();
  });

  test("abre el formulario reducido y registra que el aviso fue atendido", async ({ page }) => {
    const writes: Array<{ table: string; method: string; body: unknown }> = [];
    await entrar(page, "manual_required", (table, method, body) => {
      writes.push({ table, method, body });
    });

    await expect(
      page.getByRole("heading", { name: /sólo falta confirmar una parte/i })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /completar la planilla/i }).click();

    await expect(page.getByRole("heading", { name: /documentación pendiente/i })).toBeVisible();
    await expect(page.getByText(/planilla de asistencia/i).first()).toBeVisible();
    await expect
      .poll(
        () =>
          writes.some(
            (write) => write.table === "accreditation_transition_events" && write.method === "PATCH"
          ),
        { timeout: 15_000 }
      )
      .toBe(true);
  });
});
