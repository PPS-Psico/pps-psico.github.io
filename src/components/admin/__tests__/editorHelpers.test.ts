import { sumHoursByStudent, paginate } from "../editorHelpers";

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

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7];

  it("devuelve la primera página", () => {
    expect(paginate(items, 1, 3)).toEqual([1, 2, 3]);
  });

  it("devuelve una página intermedia", () => {
    expect(paginate(items, 2, 3)).toEqual([4, 5, 6]);
  });

  it("devuelve la última página parcial", () => {
    expect(paginate(items, 3, 3)).toEqual([7]);
  });

  it("devuelve [] para una página fuera de rango", () => {
    expect(paginate(items, 4, 3)).toEqual([]);
  });

  it("maneja listas vacías", () => {
    expect(paginate([], 1, 10)).toEqual([]);
  });
});
