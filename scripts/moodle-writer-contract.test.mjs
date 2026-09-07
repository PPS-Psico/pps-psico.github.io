import test from "node:test";
import assert from "node:assert/strict";
import {
  describeIntent,
  queueState,
  inventoryDecision,
  validateReadback,
} from "./moodle-writer-contract.mjs";
const now = Date.parse("2026-09-07T12:00:00Z");
const row = {
  id: "intent",
  mode: "dedicated",
  provisioning_status: "pending",
  orientacion_key: "clinica",
  stable_key: "PPS:launch:clinica",
  desired_name: "Informe PPS",
  desired_open_at: "2027-01-01T03:00:00Z",
  desired_due_at: "2027-02-01T02:59:59Z",
  desired_grading_due_at: "2027-03-03T02:59:59Z",
  desired_cutoff_at: null,
  desired_grade_mode: "direct_10",
  desired_grade_max: 10,
  desired_section_key: "informes-clinica",
  desired_visibility: "stealth",
  lanzamiento: {
    fecha_inicio: "2027-01-01",
    fecha_finalizacion: "2027-01-02",
    nombre_pps: "Test <safe>",
  },
};
const plan = describeIntent(row);
const inventory = {
  complete: true,
  courseId: 3615,
  observedAt: new Date(now).toISOString(),
  courseAssignmentCmids: [123],
  activities: [{ cmid: 123, idNumber: "", name: "Otra" }],
};
const observed = {
  ...plan.expected,
  cmid: 456,
  courseId: 3615,
  sourceUrl: "https://campus.uflo.edu.ar/course/modedit.php?update=456",
  observedAt: new Date(now).toISOString(),
  sectionId: 12345,
  sectionTitle: "Tareas 2027",
  areaBanner: plan.areaBanner,
};
test("2027 is derived from the launch, not the current year or section 1", () => {
  assert.equal(plan.year, 2027);
  assert.equal(plan.sectionTitle, "Tareas 2027");
  assert.equal(plan.expected.visibility, "stealth");
  assert.match(plan.expected.descriptionHtml, /&lt;safe&gt;/);
});
test("catalog primary key is never mistaken for a CMID", () => {
  assert.throws(() => describeIntent({ ...row, aula_entrega_id: 151 }), /CMID/);
  assert.equal(
    describeIntent(
      { ...row, aula_entrega_id: 151 },
      { id: 151, course_id: 3615, moodle_id: "1222866" }
    ).linkedCmid,
    1222866
  );
});
test("attention is visible even when the runnable queue is empty", () => {
  assert.equal(
    queueState([{ ...row, provisioning_status: "needs_attention" }], now).status,
    "attention"
  );
});
test("expired leases are recoverable while active leases and backoff stay out", () => {
  const expired = {
    ...row,
    provisioning_status: "claimed",
    lease_expires_at: new Date(now - 1).toISOString(),
  };
  assert.equal(queueState([expired], now).ready.length, 1);
  assert.equal(
    queueState([{ ...expired, lease_expires_at: new Date(now + 1000).toISOString() }], now).ready
      .length,
    0
  );
  assert.equal(
    queueState([{ ...row, next_reconcile_at: new Date(now + 1000).toISOString() }], now).ready
      .length,
    0
  );
});
test("creation requires a complete inventory, not a failed name search", () => {
  assert.throws(() => inventoryDecision(plan, { ...inventory, complete: false }, now));
  assert.throws(() => inventoryDecision(plan, { ...inventory, activities: [] }, now));
  assert.equal(inventoryDecision(plan, inventory, now).action, "create");
});
test("a previous run with a renamed task is recovered by ID number", () => {
  assert.deepEqual(
    inventoryDecision(
      plan,
      {
        ...inventory,
        activities: [{ cmid: 123, idNumber: plan.expected.stableKey, name: "Renamed" }],
      },
      now
    ),
    { action: "verify_existing", cmid: 123 }
  );
});
test("duplicate IDs and a same-name task without stable key block creation", () => {
  assert.throws(
    () =>
      inventoryDecision(
        plan,
        {
          ...inventory,
          courseAssignmentCmids: [123, 124],
          activities: [123, 124].map((cmid) => ({ cmid, idNumber: plan.expected.stableKey })),
        },
        now
      ),
    /duplicada/
  );
  assert.throws(
    () =>
      inventoryDecision(
        plan,
        { ...inventory, activities: [{ cmid: 123, idNumber: "", name: plan.expected.name }] },
        now
      ),
    /Nombre/
  );
});
test("minute-precision readback is accepted with all actual fields", () => {
  assert.doesNotThrow(() =>
    validateReadback(
      plan,
      { ...observed, sourceUrl: observed.sourceUrl + "&return=1" },
      new Date(now - 1000).toISOString(),
      now
    )
  );
  assert.equal(
    validateReadback(plan, observed, new Date(now - 1000).toISOString(), now).schema,
    "moodle-writer/v2"
  );
});
for (const [key, value] of Object.entries({
  gradingDueAt: null,
  visibility: "hidden",
  sectionTitle: "Tareas 2026",
  courseId: 99,
  onlineText: true,
  sourceUrl: "https://campus.uflo.edu.ar/course/view.php?id=3615",
}))
  test(`readback rejects ${key} drift`, () =>
    assert.throws(() =>
      validateReadback(plan, { ...observed, [key]: value }, new Date(now - 1000).toISOString(), now)
    ));
test("old observations and missing reminder are not successful confirmations", () => {
  assert.throws(() => validateReadback(plan, observed, "invalid", now));
  assert.throws(() =>
    validateReadback(
      plan,
      { ...observed, observedAt: new Date(now - 5000).toISOString() },
      new Date(now - 1000).toISOString(),
      now
    )
  );
  const copy = { ...observed };
  delete copy.gradingDueAt;
  assert.throws(() => validateReadback(plan, copy, new Date(now - 1000).toISOString(), now));
});
test("legacy never acquires creation or verification permissions", () => {
  const legacy = describeIntent({ ...row, mode: "legacy_shared" });
  assert.equal(legacy.action, "observe_only");
  assert.throws(() => inventoryDecision(legacy, inventory, now));
  assert.throws(() => validateReadback(legacy, observed, new Date(now - 1000).toISOString(), now));
});
