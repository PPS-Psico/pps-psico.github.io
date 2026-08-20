import {
  computeConfigHash,
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
