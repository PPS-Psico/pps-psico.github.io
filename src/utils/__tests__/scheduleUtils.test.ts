import {
  normalizeSchedule,
  cleanSchedule,
  parseSchedules,
  getHorarioEfectivo,
  findMatchingGroupKey,
} from "../scheduleUtils";

describe("normalizeSchedule", () => {
  it("colapsa espacios, recorta y pasa a minúsculas", () => {
    expect(normalizeSchedule("  Lunes   9  a 13  ")).toBe("lunes 9 a 13");
  });

  it("normaliza separadores de punto y coma", () => {
    expect(normalizeSchedule("Lunes 9 a 13 ;  Martes 10 a 12")).toBe(
      "lunes 9 a 13; martes 10 a 12"
    );
  });
});

describe("cleanSchedule", () => {
  it("limpia espacios y separadores preservando mayúsculas", () => {
    expect(cleanSchedule("  Lunes   9 a 13 ; Martes 10 a 12 ")).toBe(
      "Lunes 9 a 13; Martes 10 a 12"
    );
  });

  it("descarta segmentos vacíos", () => {
    expect(cleanSchedule("Lunes 9 a 13;;")).toBe("Lunes 9 a 13");
  });
});

describe("parseSchedules", () => {
  it("devuelve [] para entradas vacías/nulas", () => {
    expect(parseSchedules(null)).toEqual([]);
    expect(parseSchedules(undefined)).toEqual([]);
    expect(parseSchedules("")).toEqual([]);
  });

  it("separa por ; y recorta", () => {
    expect(parseSchedules("Lunes 9 a 13; Martes 10 a 12")).toEqual([
      "Lunes 9 a 13",
      "Martes 10 a 12",
    ]);
  });
});

describe("getHorarioEfectivo", () => {
  it("prioriza el horario asignado sobre el seleccionado", () => {
    expect(
      getHorarioEfectivo({ horario_asignado: "Lunes 9 a 13", horario_seleccionado: "Martes" })
    ).toBe("Lunes 9 a 13");
  });

  it("usa el seleccionado si no hay asignado", () => {
    expect(getHorarioEfectivo({ horario_asignado: null, horario_seleccionado: "Martes 10" })).toBe(
      "Martes 10"
    );
  });

  it("devuelve '' si no hay ninguno", () => {
    expect(getHorarioEfectivo({})).toBe("");
  });
});

describe("findMatchingGroupKey", () => {
  it("encuentra una clave existente equivalente ignorando formato", () => {
    const keys = ["Lunes 9 a 13", "Martes 10 a 12"];
    expect(findMatchingGroupKey("  lunes   9 A 13 ", keys)).toBe("Lunes 9 a 13");
  });

  it("devuelve null si no hay coincidencia", () => {
    expect(findMatchingGroupKey("Viernes 8 a 10", ["Lunes 9 a 13"])).toBeNull();
  });

  it("devuelve la clave original (no la normalizada) al matchear", () => {
    expect(findMatchingGroupKey("MARTES 10 A 12", ["Martes 10 a 12"])).toBe("Martes 10 a 12");
  });
});
