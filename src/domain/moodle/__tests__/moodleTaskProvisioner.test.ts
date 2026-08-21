import {
  computeConfigHash,
  findUnsatisfiableDateRule,
  planTaskProvisioning,
  verifyObservedMoodleActivity,
  type DesiredTaskConfig,
  type ObservedMoodleActivity,
} from "../moodleTaskProvisioner";

describe("moodleTaskProvisioner", () => {
  const desired: DesiredTaskConfig = {
    intentId: "00000000-0000-4000-8000-000000000001",
    launchId: "11111111-1111-4111-8111-111111111111",
    courseId: 3615,
    orientationKey: "clinica",
    mode: "dedicated",
    stableKey: "PPS:11111111-1111-4111-8111-111111111111:clinica",
    desiredName: "Informe final PPS · Centro Test · Clinica",
    descriptionTemplateVersion: "v1",
    desiredDescriptionHtml: "<p>Consigna oficial</p>",
    desiredOpenAt: "2027-06-24T03:00:00.000Z",
    desiredDueAt: "2027-08-01T02:59:59.000Z",
    desiredCutoffAt: null,
    desiredGradingDueAt: "2027-08-31T02:59:59.000Z",
    desiredGradeMode: "direct_10",
    desiredGradeMax: 10,
    desiredSectionKey: "informes-clinica",
    desiredVisibility: "visible",
  };

  const observed: ObservedMoodleActivity = {
    cmid: 1_999_999,
    courseId: 3615,
    idNumber: desired.stableKey,
    name: desired.desiredName,
    introHtml: desired.desiredDescriptionHtml,
    allowSubmissionsFromDate: Date.parse(desired.desiredOpenAt!) / 1000,
    dueDate: Date.parse(desired.desiredDueAt!) / 1000,
    cutoffDate: null,
    gradingDueDate: Math.floor(Date.parse("2027-08-31T02:59:59.000Z") / 1000),
    gradeMode: "direct_10",
    gradeMax: 10,
    sectionKey: "informes-clinica",
    visible: true,
  };

  it("fingerprints every material desired field deterministically", () => {
    expect(computeConfigHash(desired)).toBe(computeConfigHash({ ...desired }));
    expect(
      computeConfigHash({ ...desired, desiredDescriptionHtml: "<p>Otra consigna</p>" })
    ).not.toBe(computeConfigHash(desired));
    expect(computeConfigHash({ ...desired, desiredSectionKey: "otra-seccion" })).not.toBe(
      computeConfigHash(desired)
    );
  });

  it("creates only dedicated tasks that have no exact stable-key match", () => {
    expect(planTaskProvisioning(desired, [])).toMatchObject({
      action: "create_from_template",
      driftDetected: false,
    });
  });

  it("returns no-op only after full configuration equality", () => {
    expect(planTaskProvisioning(desired, [observed])).toMatchObject({
      action: "no_op",
      targetCmid: observed.cmid,
      driftDetected: false,
      driftDetails: [],
    });
  });

  it("detects grade, section and description drift", () => {
    const plan = planTaskProvisioning(desired, [
      {
        ...observed,
        introHtml: "<p>Vieja</p>",
        gradeMode: "percentage",
        sectionKey: "general",
      },
    ]);
    expect(plan.action).toBe("update_config");
    expect(plan.driftDetails).toEqual(
      expect.arrayContaining(["description_html", "grade_mode", "section_key"])
    );
  });

  it("fails closed when the stable key is duplicated", () => {
    const plan = planTaskProvisioning(desired, [observed, { ...observed, cmid: 2_000_000 }]);
    expect(plan.action).toBe("needs_attention");
    expect(plan.driftDetected).toBe(true);
  });

  it("never adopts or creates a legacy task from fuzzy name matching", () => {
    const legacy: DesiredTaskConfig = { ...desired, mode: "legacy_shared", linkedCmid: null };
    expect(
      planTaskProvisioning(legacy, [{ ...observed, idNumber: "", name: desired.desiredName }])
    ).toMatchObject({ action: "needs_attention" });

    const confirmed: DesiredTaskConfig = { ...legacy, linkedCmid: observed.cmid };
    expect(planTaskProvisioning(confirmed, [observed])).toMatchObject({
      action: "adopt_confirmed_legacy",
      targetCmid: observed.cmid,
    });
  });

  it("verifies every material field, including cutoff and visibility", () => {
    expect(verifyObservedMoodleActivity(desired, observed)).toMatchObject({
      verified: true,
      mismatches: [],
    });

    const result = verifyObservedMoodleActivity(desired, {
      ...observed,
      cutoffDate: 1_800_000_000,
      visible: false,
    });
    expect(result.verified).toBe(false);
    expect(result.mismatches).toEqual(expect.arrayContaining(["cutoff_at", "visibility"]));
  });
});

describe("gradingduedate (Recordarme calificar en)", () => {
  // Moodle rechaza el guardado si esta fecha es anterior a la de entrega, y no
  // muestra el error arriba del formulario. Verificado a mano en el curso 3615.
  const base = {
    intentId: "11111111-1111-1111-1111-111111111111",
    launchId: "22222222-2222-2222-2222-222222222222",
    courseId: 3615,
    orientationKey: "laboral",
    mode: "dedicated" as const,
    stableKey: "PPS:22222222-2222-2222-2222-222222222222:laboral",
    desiredName: "Informe final PPS · Ministerio · Laboral",
    descriptionTemplateVersion: "v1",
    desiredOpenAt: "2026-12-03T03:00:00.000Z",
    desiredDueAt: "2027-01-09T02:59:59.000Z",
    desiredGradeMode: "percentage" as const,
    desiredGradeMax: 100,
    desiredVisibility: "visible" as const,
  };

  it("acepta una fecha de corrección posterior a la entrega", () => {
    expect(
      findUnsatisfiableDateRule({ ...base, desiredGradingDueAt: "2027-02-08T02:59:59.000Z" })
    ).toBeNull();
  });

  it("detecta el caso que Moodle rechaza en silencio", () => {
    expect(
      findUnsatisfiableDateRule({ ...base, desiredGradingDueAt: "2026-09-03T03:00:00.000Z" })
    ).toBe("grading_due_before_due");
  });

  it("exige el campo cuando hay fecha de entrega", () => {
    expect(findUnsatisfiableDateRule(base)).toBe("missing_grading_due_at");
  });

  it("no propone crear una tarea que Moodle no podría guardar", () => {
    const plan = planTaskProvisioning(
      { ...base, desiredGradingDueAt: "2026-09-03T03:00:00.000Z" },
      []
    );
    expect(plan.action).toBe("needs_attention");
    expect(plan.driftDetails).toContain("grading_due_before_due");
  });

  it("cuenta grading_due_at como divergencia de configuración", () => {
    const desired = { ...base, desiredGradingDueAt: "2027-02-08T02:59:59.000Z" };
    const plan = planTaskProvisioning(desired, [
      {
        cmid: 1222569,
        courseId: 3615,
        idNumber: base.stableKey,
        name: base.desiredName,
        introHtml: "",
        allowSubmissionsFromDate: Math.floor(Date.parse(base.desiredOpenAt) / 1000),
        dueDate: Math.floor(Date.parse(base.desiredDueAt) / 1000),
        cutoffDate: null,
        gradingDueDate: null,
        gradeMode: "percentage",
        gradeMax: 100,
        sectionKey: "",
        visible: true,
      },
    ]);
    expect(plan.action).toBe("update_config");
    expect(plan.driftDetails).toContain("grading_due_at");
  });
});
