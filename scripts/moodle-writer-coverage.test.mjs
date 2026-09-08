import test from "node:test";
import assert from "node:assert/strict";
import { assessCoverage, readAll } from "./moodle-writer-coverage.mjs";
const practice = {
  id: "p",
  lanzamiento_id: "may",
  nombre_institucion: "Brochero",
  especialidad: "Clínica",
  fecha_inicio: "2026-05-02",
  estado: "Finalizada",
  tipo_actividad: "pps",
};
const base = () => ({
  practices: [practice],
  launches: [{ id: "may", moodle_task_policy: "legacy_shared" }],
  links: [],
  practiceLinks: [],
  catalog: [],
  intents: [],
});
test("closed historical launch is visible even with an empty queue", () => {
  const result = assessCoverage(base());
  assert.equal(result.summary.uncoveredPractices, 1);
  assert.equal(result.attention[0].error, "PRACTICE_OUTSIDE_QUEUE");
});
test("same institution in another cohort never supplies coverage", () => {
  const data = base();
  data.catalog.push({ id: 164, activo: true, course_id: 3615, moodle_id: "1228014" });
  data.links.push({
    lanzamiento_id: "sep",
    orientacion_key: "clinica",
    aula_entrega_id: 164,
    validation_status: "confirmed",
  });
  assert.equal(assessCoverage(data).summary.uncoveredPractices, 1);
});
test("verified intent without a confirmed link remains a gap", () => {
  const data = base();
  data.intents.push({
    id: "i",
    lanzamiento_id: "may",
    orientacion_key: "clinica",
    mode: "dedicated",
    provisioning_status: "verified",
  });
  assert.equal(assessCoverage(data).attention[0].error, "TASK_NOT_LINKED");
});
test("direct historical exception covers a practice without a launch", () => {
  const data = base();
  data.practices = [{ ...practice, lanzamiento_id: null }];
  data.catalog.push({ id: 1, activo: true, course_id: 3615, moodle_id: "123" });
  data.practiceLinks.push({ practica_id: "p", aula_entrega_id: 1, validation_status: "confirmed" });
  assert.equal(assessCoverage(data).summary.linkedPractices, 1);
  data.catalog[0].activo = false;
  assert.equal(assessCoverage(data).summary.uncoveredPractices, 1);
});
test("orientation and ambiguity are checked within a launch", () => {
  const data = base();
  data.catalog.push({ id: 1, activo: true, course_id: 3615, moodle_id: "123" });
  data.links.push({
    lanzamiento_id: "may",
    orientacion_key: "laboral",
    aula_entrega_id: 1,
    validation_status: "confirmed",
  });
  assert.equal(assessCoverage(data).summary.uncoveredPractices, 1);
  data.links[0].orientacion_key = "clinica";
  assert.equal(assessCoverage(data).summary.linkedPractices, 1);
  data.links.push({ ...data.links[0] });
  assert.equal(assessCoverage(data).attention[0].error, "AMBIGUOUS_TASK_LINK");
});
test("manual grade does not remove a gap, undated records need review", () => {
  const data = base();
  data.practices = [{ ...practice, fecha_inicio: null, nota: "9" }];
  assert.equal(assessCoverage(data).summary.uncoveredPractices, 1);
});
test("special activities, withdrawals and explicit historical scope are counted separately", () => {
  const data = base();
  data.practices = [
    { ...practice, tipo_actividad: "actividad_especial" },
    { ...practice, estado: "Cancelada" },
    { ...practice, fecha_inicio: "2023-02-01" },
  ];
  assert.deepEqual(assessCoverage(data).summary, {
    scopedPractices: 0,
    linkedPractices: 0,
    uncoveredPractices: 0,
    excludedSpecial: 1,
    excludedWithdrawn: 1,
    historicalBefore2024: 1,
  });
});
test("pagination reads beyond 1000 and propagates later-page failures", async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const factory = () => ({
    order: () => ({ range: async (from, to) => ({ data: rows.slice(from, to + 1) }) }),
  });
  assert.equal((await readAll(factory)).length, 1201);
  await assert.rejects(
    readAll(() => ({
      order: () => ({
        range: async (from) =>
          from ? { error: new Error("offline") } : { data: rows.slice(0, 500) },
      }),
    })),
    /offline/
  );
});
