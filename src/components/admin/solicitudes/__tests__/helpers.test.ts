import {
  normalizeAttachments,
  getInstitutionNameFromRequest,
  timeAgo,
  filterIngresoSolicitudes,
  isHistorySolicitud,
  filterEgresoFinalizaciones,
  isHistoryFinalizacion,
} from "../helpers";
import type { SolicitudPPSWithStudent, FinalizacionWithStudent } from "../types";

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

const makeSol = (over: Partial<SolicitudPPSWithStudent>): SolicitudPPSWithStudent =>
  ({
    id: over.id ?? "s",
    createdTime: "",
    _studentName: "",
    _studentLegajo: "",
    _studentEmail: "",
    _daysSinceUpdate: 0,
    ...over,
  }) as SolicitudPPSWithStudent;

describe("isHistorySolicitud", () => {
  it("marca como historial los estados cerrados", () => {
    expect(isHistorySolicitud(makeSol({ estado_seguimiento: "Realizada" }))).toBe(true);
    expect(isHistorySolicitud(makeSol({ estado_seguimiento: "No se pudo concretar" }))).toBe(true);
    expect(isHistorySolicitud(makeSol({ estado_seguimiento: "Archivado" }))).toBe(true);
  });

  it("no marca como historial los estados activos ni vacíos", () => {
    expect(isHistorySolicitud(makeSol({ estado_seguimiento: "Pendiente" }))).toBe(false);
    expect(isHistorySolicitud(makeSol({ estado_seguimiento: null }))).toBe(false);
  });
});

describe("filterIngresoSolicitudes", () => {
  const list: SolicitudPPSWithStudent[] = [
    makeSol({
      id: "a",
      _studentName: "Camila Sosa",
      _studentLegajo: "78421",
      nombre_institucion: "Hospital Borda",
      estado_seguimiento: "Pendiente",
      convenio_uflo: "Sí",
      _daysSinceUpdate: 1,
    }),
    makeSol({
      id: "b",
      _studentName: "Tomás Ferreyra",
      _studentLegajo: "76110",
      nombre_institucion: "Manantiales",
      estado_seguimiento: "En conversaciones",
      convenio_uflo: "No",
      _daysSinceUpdate: 9,
    }),
    makeSol({
      id: "c",
      _studentName: "Bruno Vega",
      _studentLegajo: "75002",
      nombre_institucion: "INEBA",
      estado_seguimiento: "Realizada",
      convenio_uflo: "Sí",
      _daysSinceUpdate: 14,
    }),
  ];

  it("'all' devuelve todas", () => {
    expect(filterIngresoSolicitudes(list, "", "all").map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("busca por nombre de alumno (case-insensitive)", () => {
    expect(filterIngresoSolicitudes(list, "camila", "all").map((s) => s.id)).toEqual(["a"]);
  });

  it("busca por legajo", () => {
    expect(filterIngresoSolicitudes(list, "76110", "all").map((s) => s.id)).toEqual(["b"]);
  });

  it("busca por nombre de institución", () => {
    expect(filterIngresoSolicitudes(list, "ineba", "all").map((s) => s.id)).toEqual(["c"]);
  });

  it("'priorizo' devuelve las que no tienen convenio UFLO confirmado", () => {
    expect(filterIngresoSolicitudes(list, "", "priorizo").map((s) => s.id)).toEqual(["b"]);
  });

  it("'sin_mov' devuelve activas con +4 días sin movimiento (excluye historial)", () => {
    // b tiene 9 días y está activa; c tiene 14 pero está Realizada (historial) → excluida
    expect(filterIngresoSolicitudes(list, "", "sin_mov").map((s) => s.id)).toEqual(["b"]);
  });

  it("filtra por estado_seguimiento exacto", () => {
    expect(filterIngresoSolicitudes(list, "", "Pendiente").map((s) => s.id)).toEqual(["a"]);
  });

  it("combina búsqueda y filtro", () => {
    expect(filterIngresoSolicitudes(list, "ferreyra", "priorizo").map((s) => s.id)).toEqual(["b"]);
    expect(filterIngresoSolicitudes(list, "camila", "priorizo")).toEqual([]);
  });

  // Nota: la búsqueda es case-insensitive pero NO insensible a acentos
  // ("tomas" no encuentra "Tomás"). Conducta actual; mejora opcional futura.
  it("la búsqueda no normaliza acentos (conducta actual)", () => {
    expect(filterIngresoSolicitudes(list, "tomas", "all")).toEqual([]);
    expect(filterIngresoSolicitudes(list, "tomás", "all").map((s) => s.id)).toEqual(["b"]);
  });
});

const makeFin = (over: Partial<FinalizacionWithStudent>): FinalizacionWithStudent =>
  ({
    id: over.id ?? "f",
    createdTime: "",
    studentName: "",
    studentLegajo: "",
    studentEmail: "",
    ...over,
  }) as FinalizacionWithStudent;

describe("isHistoryFinalizacion", () => {
  it("marca como historial los estados resueltos", () => {
    expect(isHistoryFinalizacion(makeFin({ estado: "Cargado" }))).toBe(true);
    expect(isHistoryFinalizacion(makeFin({ estado: "Finalizada" }))).toBe(true);
  });

  it("no marca como historial los pendientes ni vacíos", () => {
    expect(isHistoryFinalizacion(makeFin({ estado: "Pendiente" }))).toBe(false);
    expect(isHistoryFinalizacion(makeFin({ estado: null }))).toBe(false);
  });
});

describe("filterEgresoFinalizaciones", () => {
  const list: FinalizacionWithStudent[] = [
    makeFin({ id: "a", studentName: "Camila Sosa", studentLegajo: "78421", estado: "Pendiente" }),
    makeFin({ id: "b", studentName: "Bruno Vega", studentLegajo: "75002", estado: "Cargado" }),
  ];

  it("sin búsqueda devuelve todas", () => {
    expect(filterEgresoFinalizaciones(list, "").map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("busca por nombre del estudiante (case-insensitive)", () => {
    expect(filterEgresoFinalizaciones(list, "BRUNO").map((s) => s.id)).toEqual(["b"]);
  });

  it("busca por legajo", () => {
    expect(filterEgresoFinalizaciones(list, "78421").map((s) => s.id)).toEqual(["a"]);
  });

  it("devuelve [] si no hay coincidencias", () => {
    expect(filterEgresoFinalizaciones(list, "zzz")).toEqual([]);
  });
});
