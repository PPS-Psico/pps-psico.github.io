import {
  equivalentCutoff,
  parseManagementReportData,
  testingManagementReportData,
} from "../executiveReport.service";

describe("management-report-v1", () => {
  it("keeps the same month and day for comparable prior cutoffs", () => {
    expect(equivalentCutoff(2025, "2026-08-31")).toBe("2025-08-31");
    expect(equivalentCutoff(2025, "2024-02-29")).toBe("2025-02-28");
  });

  it("parses the external enrollment series without reclassifying it", () => {
    const data = parseManagementReportData({
      report_version: "management-report-v1",
      cutoff: "2026-08-31",
      generated_at: "2026-08-31T12:00:00Z",
      management_start: "2024-09-01",
      agreement_count: 3,
      institution_count: 1,
      access: {
        year: 2026,
        applicants: 218,
        started: 210,
        with_any_pps: 215,
        without_start: 8,
        without_any_pps: 3,
        start_rate_pct: 96.3,
        pending_application_distribution: [
          { applications: 1, students: 6, without_any_pps: 2 },
          { applications: 2, students: 1, without_any_pps: 1 },
          { applications: 3, students: 1, without_any_pps: 0 },
        ],
      },
      population: {
        account_state_as_of: "2026-08-31T12:00:00Z",
        account_history_start: "2025-11-29",
        account_cohorts: [
          {
            year: 2024,
            accounts_created: null,
            currently_active: null,
            available: false,
          },
          {
            year: 2025,
            accounts_created: 139,
            currently_active: 92,
            available: true,
          },
        ],
        current_stock: {},
        administrative_enrollment: [
          { year: 2022, cycle: "2022/1", students: 39 },
          { year: 2023, cycle: "2023/1", students: 87 },
          { year: 2024, cycle: "2024/1", students: 101 },
          { year: 2025, cycle: "2025/1", students: 242 },
        ],
        administrative_source: "Registro administrativo informado por la Facultad",
      },
      agreements: [
        {
          id: "institucion-fernando-ulloa",
          institution_id: "institucion-fernando-ulloa",
          institution: "Institución Fernando Ulloa",
          signed_at: "2025-01-01",
          date_precision: "year",
          validity: "confirmed",
          agreement_count: 3,
          orientations: ["clinica"],
          contributions: [
            {
              year: 2025,
              launches: 4,
              fixed_offered: 0,
              realized: 176,
              applicants: 96,
              practice_students: 86,
            },
            {
              year: 2026,
              launches: 2,
              fixed_offered: 50,
              realized: 69,
              applicants: 86,
              practice_students: 82,
            },
          ],
          total_launches: 6,
          total_fixed_offered: 50,
          total_realized: 245,
          total_applicants: 175,
          total_practice_students: 164,
        },
      ],
      recent_network: [],
      quality: {},
    });

    expect(data.cutoffISO).toBe("2026-08-31");
    expect(data.population.administrativeEnrollment.map((row) => row.students)).toEqual([
      39, 87, 101, 242,
    ]);
    expect(data.population.administrativeSource).toContain("Facultad");
    expect(data.population.accountHistoryStartISO).toBe("2025-11-29");
    expect(data.population.accountCohorts[0]).toMatchObject({
      year: 2024,
      accountsCreated: null,
      currentlyActive: null,
      available: false,
    });
    expect(data.population.accountCohorts[1]).toMatchObject({
      year: 2025,
      accountsCreated: 139,
      currentlyActive: 92,
      available: true,
    });
    expect(data).toMatchObject({
      agreementCount: 3,
      institutionCount: 1,
      access: {
        year: 2026,
        applicants: 218,
        started: 210,
        withoutStart: 8,
        withoutAnyPps: 3,
        startRatePct: 96.3,
        pendingApplicationDistribution: [
          { applications: 1, students: 6, withoutAnyPps: 2 },
          { applications: 2, students: 1, withoutAnyPps: 1 },
          { applications: 3, students: 1, withoutAnyPps: 0 },
        ],
      },
    });
    expect(data.agreements).toHaveLength(1);
    expect(data.agreements[0]).toMatchObject({
      institution: "Institución Fernando Ulloa",
      agreementCount: 3,
      totalApplicants: 175,
      totalPracticeStudents: 164,
    });
    expect(data.agreements[0].contributions[0]).toMatchObject({
      applicants: 96,
      practiceStudents: 86,
    });
  });

  it("keeps agreement aggregates reconciled with their annual detail", () => {
    const data = testingManagementReportData("2026-08-31");

    data.agreements.forEach((agreement) => {
      expect(agreement.totalLaunches).toBe(
        agreement.contributions.reduce((total, row) => total + row.launches, 0)
      );
      expect(agreement.totalFixedOffered).toBe(
        agreement.contributions.reduce((total, row) => total + row.fixedOffered, 0)
      );
      expect(agreement.totalRealized).toBe(
        agreement.contributions.reduce((total, row) => total + row.realized, 0)
      );
      expect(agreement.totalApplicants).toBeLessThanOrEqual(
        agreement.contributions.reduce((total, row) => total + row.applicants, 0)
      );
      expect(agreement.totalPracticeStudents).toBeLessThanOrEqual(
        agreement.contributions.reduce((total, row) => total + row.practiceStudents, 0)
      );
    });
  });

  it("keeps one institutional row when several agreement records are consolidated", () => {
    const data = testingManagementReportData("2026-08-31");
    const ulloa = data.agreements.filter(
      (agreement) => agreement.institution === "Institución Fernando Ulloa"
    );

    expect(ulloa).toHaveLength(1);
    expect(ulloa[0].agreementCount).toBe(3);
    expect(ulloa[0].institution).not.toContain(" - ");
  });
});
