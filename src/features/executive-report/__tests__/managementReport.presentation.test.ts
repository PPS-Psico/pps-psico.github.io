import { testingManagementReportData, testingSnapshot } from "../executiveReport.service";
import {
  buildManagementAccessPresentation,
  managementCapacityValue,
  visibleManagementAgreements,
} from "../managementReport.presentation";

describe("management report presentation", () => {
  it("shows one reconciled capacity value under the executive cupos label", () => {
    const snapshot = testingSnapshot(2025, "2025-12-31");

    expect(managementCapacityValue(snapshot)).toBe(552);
    expect(managementCapacityValue(snapshot)).toBe(
      snapshot.capacity.fixedOffered + snapshot.capacity.realized
    );
  });

  it("explains pending access against the total launches of the year", () => {
    const data = testingManagementReportData("2026-08-31");
    const snapshot = testingSnapshot(2026, "2026-08-31");
    const presentation = buildManagementAccessPresentation(data.access, [snapshot]);

    expect(presentation.overview).toContain("210 de 218");
    expect(presentation.pending).toContain("8 restantes");
    expect(presentation.pending).toContain("de los 41 lanzamientos realizados en 2026");
    expect(presentation.pending).toContain("6 estudiantes en 1 lanzamiento");
    expect(presentation.pending).toContain("1 estudiante en 3 lanzamientos");
    expect(presentation.withoutAnyPps).toContain("3 no registraban ninguna PPS");
  });

  it("omits Banco Provincia del Neuquén only from the management contribution table", () => {
    const data = testingManagementReportData("2026-08-31");
    const bank = {
      ...data.agreements[0],
      id: "banco-provincia",
      institution: "Banco Provincia del Neuquen",
      contributions: [],
      totalLaunches: 0,
      totalFixedOffered: 0,
      totalRealized: 0,
      totalApplicants: 0,
      totalPracticeStudents: 0,
    };

    expect(visibleManagementAgreements([bank, ...data.agreements])).toEqual(data.agreements);
  });
});
