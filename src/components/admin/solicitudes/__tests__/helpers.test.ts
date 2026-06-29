import { normalizeAttachments, getInstitutionNameFromRequest, timeAgo } from "../helpers";

describe("normalizeAttachments", () => {
  it("devuelve [] para entradas vacías/nulas", () => {
    expect(normalizeAttachments(null)).toEqual([]);
    expect(normalizeAttachments(undefined)).toEqual([]);
    expect(normalizeAttachments("")).toEqual([]);
  });

  it("normaliza un objeto único con url", () => {
    const result = normalizeAttachments({ url: "http://x/a.pdf", filename: "a.pdf", type: "pdf" });
    expect(result).toEqual([{ url: "http://x/a.pdf", filename: "a.pdf", type: "pdf" }]);
  });

  it("usa signedUrl y name como fallback", () => {
    const result = normalizeAttachments({ signedUrl: "http://x/b", name: "b" });
    expect(result).toEqual([{ url: "http://x/b", filename: "b", type: undefined }]);
  });

  it("aplica defaults de filename cuando faltan", () => {
    const result = normalizeAttachments({ url: "http://x/c" });
    expect(result[0]).toMatchObject({ url: "http://x/c", filename: "Archivo" });
  });

  it("normaliza un array de adjuntos y descarta los que no tienen url", () => {
    const result = normalizeAttachments([
      { url: "http://x/1" },
      { filename: "sin-url" },
      { signedUrl: "http://x/2" },
    ]);
    expect(result.map((a) => a.url)).toEqual(["http://x/1", "http://x/2"]);
  });

  it("trata strings sueltos como una url", () => {
    const result = normalizeAttachments("http://x/solo.pdf");
    // Un string que no parsea como JSON cae al branch de catch
    expect(result).toEqual([
      { url: "http://x/solo.pdf", filename: "Archivo Adjunto", type: "unknown" },
    ]);
  });

  it("parsea un string JSON de array", () => {
    const json = JSON.stringify([{ url: "http://x/j1" }, { url: "http://x/j2" }]);
    const result = normalizeAttachments(json);
    expect(result.map((a) => a.url)).toEqual(["http://x/j1", "http://x/j2"]);
  });

  it("normaliza un array de strings", () => {
    const result = normalizeAttachments(["http://x/s1", "http://x/s2"]);
    expect(result.map((a) => a.url)).toEqual(["http://x/s1", "http://x/s2"]);
  });
});

describe("getInstitutionNameFromRequest", () => {
  it("toma el primer campo no vacío en orden de prioridad", () => {
    expect(getInstitutionNameFromRequest({ nombre_institucion: "Hospital A" })).toBe("Hospital A");
    expect(
      getInstitutionNameFromRequest({
        nombre_institucion: "",
        nombre_institucion_manual: "Consultorio B",
      })
    ).toBe("Consultorio B");
  });

  it("recorre los fallbacks hasta empresa", () => {
    expect(getInstitutionNameFromRequest({ empresa: "Empresa C" })).toBe("Empresa C");
  });

  it("ignora valores 'No especificado'", () => {
    expect(
      getInstitutionNameFromRequest({
        nombre_institucion: "No Especificado",
        nombre_institucion_manual: "Real",
      })
    ).toBe("Real");
  });

  it("recorta espacios y devuelve '' si no hay candidatos válidos", () => {
    expect(getInstitutionNameFromRequest({ nombre_institucion: "  Trim  " })).toBe("Trim");
    expect(getInstitutionNameFromRequest({})).toBe("");
    expect(getInstitutionNameFromRequest({ nombre_institucion: null })).toBe("");
  });
});

describe("timeAgo", () => {
  it("devuelve guion para entradas vacías", () => {
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo(undefined)).toBe("—");
  });

  it("formatea minutos, horas y días", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 5 * 60000).toISOString())).toBe("hace 5 min");
    expect(timeAgo(new Date(now - 3 * 3600000).toISOString())).toBe("hace 3 h");
    expect(timeAgo(new Date(now - 2 * 86400000).toISOString())).toBe("hace 2 d");
  });
});
