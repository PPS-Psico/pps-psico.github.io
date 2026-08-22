import {
  calculateMoodleTaskDates,
  calculateSlaDeadline,
  evaluateReportStatus,
  getDaysRemainingSla,
  isPassingGrade,
  isSlaBreached,
} from "../moodleReportStatus";

describe("moodleReportStatus", () => {
  const now = new Date("2026-08-20T15:00:00Z");

  describe("isPassingGrade", () => {
    it("respects direct 0-10 grades without dividing by Moodle grade_max", () => {
      expect(isPassingGrade(4, 100, "direct_10")).toBe(true);
      expect(isPassingGrade(3.99, 100, "direct_10")).toBe(false);
      expect(isPassingGrade(40, 100, "direct_10")).toBe(false);
    });

    it("normalizes percentage tasks against their observed maximum", () => {
      expect(isPassingGrade(40, 100, "percentage")).toBe(true);
      expect(isPassingGrade(8, 20, "percentage")).toBe(true);
      expect(isPassingGrade(39, 100, "percentage")).toBe(false);
      expect(isPassingGrade(4, 0, "percentage")).toBe(false);
    });

    it("aprueba una nota 1–10 cargada en una tarea configurada sobre 100", () => {
      // No existe una nota menor a 4: un 10 sobre 100 es un diez mal cargado,
      // no un diez por ciento. Antes caía en "reentrega solicitada".
      expect(isPassingGrade(10, 100, "percentage")).toBe(true);
      expect(isPassingGrade(8, 100, "percentage")).toBe(true);
      expect(isPassingGrade(0, 100, "percentage")).toBe(false);
      expect(isPassingGrade(3, 100, "percentage")).toBe(false);
    });

    it("uses the explicit pass/fail contract", () => {
      expect(isPassingGrade(1, 2, "pass_fail")).toBe(true);
      expect(isPassingGrade(0, 2, "pass_fail")).toBe(false);
      expect(isPassingGrade(null, 10, "direct_10")).toBe(false);
      expect(isPassingGrade(Number.NaN, 10, "direct_10")).toBe(false);
    });
  });

  describe("evaluateReportStatus", () => {
    it("keeps administrative exceptions and institutional failure terminal", () => {
      expect(
        evaluateReportStatus({ membershipStatus: "waived", referenceDate: now })
      ).toMatchObject({
        reportStatus: "waived",
        presentationStatus: "Finalizada",
        isTerminal: true,
      });
      expect(
        evaluateReportStatus({ practiceState: "Desaprobada", referenceDate: now })
      ).toMatchObject({
        reportStatus: "failed_final",
        presentationStatus: "Desaprobada",
        isTerminal: true,
      });
    });

    it("does not present a withdrawal or replacement as a failure", () => {
      expect(
        evaluateReportStatus({ membershipStatus: "withdrawn", referenceDate: now })
      ).toMatchObject({
        reportStatus: "not_applicable",
        presentationStatus: "No corresponde",
        isTerminal: true,
      });
    });

    it("fails closed for unlinked and malformed Moodle evidence", () => {
      expect(evaluateReportStatus({ hasLinkedTask: false, referenceDate: now })).toMatchObject({
        reportStatus: "unlinked_legacy",
        requiresActionBy: "admin",
      });
      expect(
        evaluateReportStatus({ hasLinkedTask: true, taskStatus: "parse_error", referenceDate: now })
      ).toMatchObject({
        reportStatus: "unknown",
        requiresActionBy: "admin",
      });
      expect(
        evaluateReportStatus({
          hasLinkedTask: true,
          taskStatus: "graded",
          gradeValue: null,
          referenceDate: now,
        })
      ).toMatchObject({ reportStatus: "unknown", presentationStatus: "Por verificar" });
    });

    it("only finalizes an approved report after the practice end date", () => {
      const beforeEnd = evaluateReportStatus({
        hasLinkedTask: true,
        taskStatus: "graded",
        gradeValue: 8,
        gradeMax: 100,
        gradeConversionMode: "direct_10",
        practiceEndDate: "2026-09-01",
        referenceDate: now,
      });
      expect(beforeEnd).toMatchObject({
        reportStatus: "passed",
        presentationStatus: "En curso",
        isTerminal: false,
        isPassing: true,
      });

      const afterEnd = evaluateReportStatus({
        hasLinkedTask: true,
        taskStatus: "graded",
        gradeValue: 8,
        gradeMax: 100,
        gradeConversionMode: "direct_10",
        practiceEndDate: "2026-08-01",
        referenceDate: now,
      });
      expect(afterEnd).toMatchObject({
        reportStatus: "passed",
        presentationStatus: "Finalizada",
        isTerminal: true,
      });
    });

    it("distinguishes correction, re-entry and awaiting submission", () => {
      expect(
        evaluateReportStatus({
          hasLinkedTask: true,
          submitted: true,
          taskStatus: "submitted",
          referenceDate: now,
        })
      ).toMatchObject({ reportStatus: "under_review", requiresActionBy: "jefe" });

      expect(
        evaluateReportStatus({
          hasLinkedTask: true,
          taskStatus: "graded",
          gradeValue: 3,
          gradeMax: 10,
          gradeConversionMode: "direct_10",
          referenceDate: now,
        })
      ).toMatchObject({
        reportStatus: "revision_required",
        presentationStatus: "Reentrega solicitada",
        requiresActionBy: "student",
      });

      expect(
        evaluateReportStatus({
          hasLinkedTask: true,
          practiceEndDate: "2026-08-01",
          referenceDate: now,
        })
      ).toMatchObject({
        reportStatus: "awaiting_submission",
        presentationStatus: "Informe pendiente",
      });
    });

    it("keeps a future task in course without demanding an action", () => {
      expect(
        evaluateReportStatus({
          hasLinkedTask: true,
          taskOpenDate: "2026-09-01T03:00:00Z",
          practiceEndDate: "2026-09-08",
          referenceDate: now,
        })
      ).toMatchObject({
        reportStatus: "not_open",
        presentationStatus: "En curso",
        requiresActionBy: "none",
      });
    });
  });

  describe("date contracts", () => {
    it("opens seven days before and sets due at the end of day +30 in Argentina", () => {
      expect(calculateMoodleTaskDates("2026-07-01")).toEqual({
        openAt: "2026-06-24T03:00:00.000Z",
        dueAt: "2026-08-01T02:59:59.000Z",
        cutoffAt: null,
      });
    });

    it("rejects impossible and non-ISO dates", () => {
      const empty = { openAt: null, dueAt: null, cutoffAt: null };
      expect(calculateMoodleTaskDates("2026-02-31")).toEqual(empty);
      expect(calculateMoodleTaskDates("31/02/2026")).toEqual(empty);
      expect(calculateMoodleTaskDates(null)).toEqual(empty);
    });

    it("computes the 30-day correction SLA from the real submission timestamp", () => {
      const submittedAt = "2026-07-10T14:00:00Z";
      expect(calculateSlaDeadline(submittedAt)).toBe("2026-08-09T14:00:00.000Z");
      expect(isSlaBreached(submittedAt, new Date("2026-08-09T13:59:59Z"))).toBe(false);
      expect(isSlaBreached(submittedAt, new Date("2026-08-09T14:00:01Z"))).toBe(true);
      expect(getDaysRemainingSla(submittedAt, new Date("2026-07-20T14:00:00Z"))).toBe(20);
    });
  });
});
