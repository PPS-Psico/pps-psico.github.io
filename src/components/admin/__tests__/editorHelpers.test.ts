import { sumHoursByStudent } from "../editorHelpers";

describe("sumHoursByStudent", () => {
  it("suma las horas por estudiante (link como string)", () => {
    const practicas = [
      { estudiante_id: "st_1", horas_realizadas: 40 },
      { estudiante_id: "st_1", horas_realizadas: 60 },
      { estudiante_id: "st_2", horas_realizadas: 30 },
    ];
    const result = sumHoursByStudent(practicas, "estudiante_id", "horas_realizadas");
    expect(result.get("st_1")).toBe(100);
    expect(result.get("st_2")).toBe(30);
  });

  it("maneja el link como array (legado Airtable)", () => {
    const practicas = [
      { estudiante_id: ["st_1"], horas_realizadas: 25 },
      { estudiante_id: ["st_1"], horas_realizadas: 15 },
    ];
    const result = sumHoursByStudent(practicas, "estudiante_id", "horas_realizadas");
    expect(result.get("st_1")).toBe(40);
  });

  it("trata horas no numéricas o ausentes como 0", () => {
    const practicas = [
      { estudiante_id: "st_1", horas_realizadas: "no-num" },
      { estudiante_id: "st_1" },
      { estudiante_id: "st_1", horas_realizadas: 10 },
    ];
    expect(sumHoursByStudent(practicas, "estudiante_id", "horas_realizadas").get("st_1")).toBe(10);
  });

  it("devuelve un Map vacío para lista vacía", () => {
    expect(sumHoursByStudent([], "estudiante_id", "horas_realizadas").size).toBe(0);
  });

  it("no incluye estudiantes sin prácticas (get devuelve undefined)", () => {
    const result = sumHoursByStudent(
      [{ estudiante_id: "st_1", horas_realizadas: 5 }],
      "estudiante_id",
      "horas_realizadas"
    );
    expect(result.get("st_99")).toBeUndefined();
  });
});
