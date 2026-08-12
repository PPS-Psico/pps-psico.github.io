import { parseNormalizedMoodleGradeFile } from "../MoodleGradeImportPanel";

describe("parseNormalizedMoodleGradeFile", () => {
  it("acepta TSV con los estados y escalas normalizados", () => {
    expect(
      parseNormalizedMoodleGradeFile(
        "dni\tcmid\testado\tnota\tmaximo\n35154584\t946366\tgraded\t83\t100\n35154585\t946365\tentregado\t\t"
      )
    ).toEqual([
      {
        dni: "35154584",
        cmid: 946366,
        status: "graded",
        gradeValue: 83,
        gradeMax: 100,
        gradeDisplay: null,
      },
      {
        dni: "35154585",
        cmid: 946365,
        status: "submitted",
        gradeValue: null,
        gradeMax: null,
        gradeDisplay: null,
      },
    ]);
  });

  it("rechaza archivos sin identidad y tarea estables", () => {
    expect(() => parseNormalizedMoodleGradeFile("nombre;nota\nBlas;8")).toThrow("dni y cmid");
  });
});
