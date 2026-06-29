import { getFileType, getStoragePath, getNormalizationState } from "../attachmentUtils";
import { FIELD_ESTADO_FINALIZACION } from "../../constants";

describe("getFileType", () => {
  it("clasifica imágenes", () => {
    expect(getFileType("foto.jpg")).toBe("image");
    expect(getFileType("foto.PNG")).toBe("image");
    expect(getFileType("icono.svg")).toBe("image");
  });

  it("clasifica pdf", () => {
    expect(getFileType("doc.pdf")).toBe("pdf");
  });

  it("clasifica documentos de office", () => {
    expect(getFileType("planilla.xlsx")).toBe("office");
    expect(getFileType("informe.docx")).toBe("office");
    expect(getFileType("present.pptx")).toBe("office");
  });

  it("devuelve other para desconocidos o vacíos", () => {
    expect(getFileType("archivo.zip")).toBe("other");
    expect(getFileType("sinextension")).toBe("other");
    expect(getFileType("")).toBe("other");
  });
});

describe("getStoragePath", () => {
  it("extrae el path tras documentos_finalizacion/", () => {
    expect(getStoragePath("https://x.co/storage/documentos_finalizacion/est1/file.pdf")).toBe(
      "est1/file.pdf"
    );
  });

  it("decodifica caracteres escapados (%20)", () => {
    expect(getStoragePath("https://x.co/documentos_finalizacion/mi%20archivo.pdf")).toBe(
      "mi archivo.pdf"
    );
  });

  it("devuelve null cuando no contiene el segmento o está vacío", () => {
    expect(getStoragePath("https://x.co/otra/ruta.pdf")).toBeNull();
    expect(getStoragePath("")).toBeNull();
  });
});

describe("getNormalizationState", () => {
  it("devuelve '' para entradas nulas o no-objeto", () => {
    expect(getNormalizationState(null)).toBe("");
    expect(getNormalizationState(undefined)).toBe("");
    expect(getNormalizationState("texto")).toBe("");
  });

  it("normaliza el estado de finalización", () => {
    expect(getNormalizationState({ [FIELD_ESTADO_FINALIZACION]: "Cargado" })).toBe("cargado");
    expect(getNormalizationState({ [FIELD_ESTADO_FINALIZACION]: "En Proceso" })).toBe("en proceso");
  });

  it("toma el primer elemento si el estado viene como array (legado Airtable)", () => {
    expect(getNormalizationState({ [FIELD_ESTADO_FINALIZACION]: ["Cargado"] })).toBe("cargado");
  });

  it("devuelve '' si el campo no está presente", () => {
    expect(getNormalizationState({ otro_campo: "x" })).toBe("");
  });
});
