import {
  isAccreditationTransitionOutcome,
  parseAccreditationDocumentationSnapshot,
} from "../accreditationTransition";

describe("accreditation transition", () => {
  it("parses the server evidence snapshot", () => {
    const parsed = parseAccreditationDocumentationSnapshot({
      version: "moodle-submission-evidence/v1",
      threshold: 0.9,
      items: [
        {
          practicaId: "practice-1",
          esOnline: false,
          cmid: 321,
          reportEvidence: "graded",
          attendanceEvidence: "assumed",
          attendanceConfidence: 0.92,
          fileCount: 3,
          logicalFileCount: 3,
          classifierVersion: "submission-files/v1",
          automatic: true,
        },
      ],
    });

    expect(parsed).toEqual({
      version: "moodle-submission-evidence/v1",
      threshold: 0.9,
      items: [
        {
          practicaId: "practice-1",
          esOnline: false,
          cmid: 321,
          reportEvidence: "graded",
          attendanceEvidence: "assumed",
          attendanceConfidence: 0.92,
          fileCount: 3,
          logicalFileCount: 3,
          classifierVersion: "submission-files/v1",
          automatic: true,
        },
      ],
    });
  });

  it("drops malformed items without breaking the form", () => {
    const parsed = parseAccreditationDocumentationSnapshot({
      version: "v1",
      threshold: "bad",
      items: [null, { practicaId: 123 }, { practicaId: "valid", esOnline: true }],
    });

    expect(parsed?.threshold).toBe(1);
    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0]).toMatchObject({
      practicaId: "valid",
      esOnline: true,
      attendanceEvidence: "needs_review",
      automatic: false,
    });
  });

  it("rejects invalid snapshot roots and unknown outcomes", () => {
    expect(parseAccreditationDocumentationSnapshot([])).toBeNull();
    expect(parseAccreditationDocumentationSnapshot({ items: "no-array" })).toBeNull();
    expect(isAccreditationTransitionOutcome("manual_required")).toBe(true);
    expect(isAccreditationTransitionOutcome("invented")).toBe(false);
  });
});
