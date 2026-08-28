import { classifyMoodleSubmissionFiles } from "../moodleSubmissionEvidence";

describe("classifyMoodleSubmissionFiles", () => {
  it("no exige asistencia en una PPS online", () => {
    expect(
      classifyMoodleSubmissionFiles({ filenames: ["informe-final.pdf"], isOnline: true })
    ).toMatchObject({
      attendanceEvidence: "not_required",
      attendanceConfidence: 1,
      fileCount: 1,
      logicalFileCount: 1,
    });
  });

  it("detecta una planilla nombrada junto al informe", () => {
    expect(
      classifyMoodleSubmissionFiles({
        filenames: ["Informe final.docx", "Planilla de asistencia firmada.pdf"],
        isOnline: false,
      })
    ).toMatchObject({
      attendanceEvidence: "detected",
      attendanceConfidence: 0.99,
      fileCount: 2,
      logicalFileCount: 2,
    });
  });

  it("asume planilla cuando hay un informe y varias fotos sin nombre útil", () => {
    expect(
      classifyMoodleSubmissionFiles({
        filenames: ["Informe PPS.pdf", "IMG_4182.jpg", "IMG_4183.jpg"],
        isOnline: false,
      })
    ).toMatchObject({
      attendanceEvidence: "assumed",
      attendanceConfidence: 0.92,
      fileCount: 3,
      logicalFileCount: 3,
      fileTypeCounts: { image: 2, pdf: 1, word: 0, other: 0 },
    });
  });

  it("no cuenta como dos documentos el mismo informe en Word y PDF", () => {
    expect(
      classifyMoodleSubmissionFiles({
        filenames: ["Informe final.docx", "Informe final.pdf"],
        isOnline: false,
      })
    ).toMatchObject({
      attendanceEvidence: "duplicate_only",
      fileCount: 2,
      logicalFileCount: 1,
    });
  });

  it("colapsa las copias numeradas que agrega el navegador", () => {
    expect(
      classifyMoodleSubmissionFiles({
        filenames: ["informe.pdf", "informe (1).pdf"],
        isOnline: false,
      })
    ).toMatchObject({
      attendanceEvidence: "duplicate_only",
      logicalFileCount: 1,
    });
  });

  it("manda a revisión dos variantes que parecen informes distintos", () => {
    expect(
      classifyMoodleSubmissionFiles({
        filenames: ["informe adultos.pdf", "informe ninos.pdf"],
        isOnline: false,
      })
    ).toMatchObject({
      attendanceEvidence: "needs_review",
      attendanceConfidence: 0.25,
      logicalFileCount: 2,
    });
  });

  it("no inventa evidencia si la etiqueta vieja no pudo leer la lista", () => {
    expect(classifyMoodleSubmissionFiles({ filenames: null, isOnline: false })).toMatchObject({
      attendanceEvidence: "needs_review",
      attendanceConfidence: 0,
      fileCount: null,
      logicalFileCount: null,
      reasons: ["file_list_not_observed"],
    });
  });
});
