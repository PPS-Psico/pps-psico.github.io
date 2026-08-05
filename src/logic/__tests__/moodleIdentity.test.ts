import { describe, expect, it } from "@jest/globals";
import {
  isValidProfile,
  namesAgree,
  normalizeDni,
  normalizeEmail,
  pendingNameBackfill,
  type StudentIdentity,
} from "../../../supabase/functions/moodle-autologin/identity";

/**
 * Identidad del ingreso desde el campus (Edge Function moodle-autologin).
 *
 * El test vive acá porque jest sólo busca bajo `src/`, pero importa el módulo
 * real que despliega la función: no es una copia. Es la única cobertura
 * automática de ese archivo, que además queda fuera de `tsc --noEmit` porque
 * `tsconfig.json` sólo incluye `src`.
 */

const ficha = (overrides: Partial<StudentIdentity> = {}): StudentIdentity => ({
  correo: "joseph.elionoch@uflouniversidad.edu.ar",
  nombre: null,
  nombre_separado: null,
  apellido_separado: null,
  ...overrides,
});

describe("namesAgree", () => {
  it("acepta cuando los campos separados coinciden con el campus", () => {
    const s = ficha({ nombre_separado: "Joseph", apellido_separado: "Elionoch" });
    expect(namesAgree(s, "joseph", "elionoch")).toBe(true);
  });

  it("ignora acentos y mayúsculas, como ya hacía", () => {
    const s = ficha({ nombre_separado: "MARÍA VICTORIA", apellido_separado: "Navarrete" });
    expect(namesAgree(s, "maria victoria", "navarrete")).toBe(true);
  });

  it("rechaza cuando los separados existen y NO coinciden", () => {
    const s = ficha({ nombre_separado: "Joseph", apellido_separado: "Elionoch" });
    expect(namesAgree(s, "otro", "distinto")).toBe(false);
  });

  it("cae a comparar contra el nombre completo si faltan los separados", () => {
    const s = ficha({ nombre: "María Victoria Navarrete", nombre_separado: "María Victoria" });
    expect(namesAgree(s, "maria victoria", "navarrete")).toBe(true);
  });

  it("tolera las fichas cargadas como 'Apellido Nombre'", () => {
    const s = ficha({ nombre: "Perticone Mariano Julián" });
    expect(namesAgree(s, "mariano julian", "perticone")).toBe(true);
  });

  it("rechaza un nombre completo que no corresponde", () => {
    const s = ficha({ nombre: "Aldana Rocio Mondaca" });
    expect(namesAgree(s, "joseph", "elionoch")).toBe(false);
  });

  it("no acepta un apellido de más colado en el nombre del campus", () => {
    const s = ficha({ nombre: "Milagros Moya" });
    expect(namesAgree(s, "milagros", "moya perez")).toBe(false);
  });

  it("sin ningún nombre en la ficha, la identidad la sostienen correo y DNI", () => {
    expect(namesAgree(ficha(), "joseph", "elionoch")).toBe(true);
  });
});

describe("pendingNameBackfill", () => {
  it("rellena los tres campos cuando la ficha no tiene ninguno", () => {
    expect(pendingNameBackfill(ficha(), "Joseph", "Elionoch")).toEqual({
      nombre: "Joseph Elionoch",
      nombre_separado: "Joseph",
      apellido_separado: "Elionoch",
    });
  });

  it("completa sólo el apellido que falta", () => {
    const s = ficha({ nombre: "María Victoria Navarrete", nombre_separado: "María Victoria" });
    expect(pendingNameBackfill(s, "María Victoria", "Navarrete")).toEqual({
      apellido_separado: "Navarrete",
    });
  });

  it("nunca pisa un dato ya cargado, aunque el campus informe otro", () => {
    const s = ficha({
      nombre: "Joseph Elionoch",
      nombre_separado: "Joseph",
      apellido_separado: "Elionoch",
    });
    expect(pendingNameBackfill(s, "Otro", "Distinto")).toEqual({});
  });

  it("no escribe nada si el campus no informa nombres", () => {
    expect(pendingNameBackfill(ficha(), "", "")).toEqual({});
  });

  it("trata como vacío un campo que sólo tiene espacios", () => {
    const s = ficha({ nombre_separado: "   ", apellido_separado: "Elionoch" });
    expect(pendingNameBackfill(s, "Joseph", "Elionoch")).toMatchObject({
      nombre_separado: "Joseph",
    });
  });
});

describe("isValidProfile", () => {
  it("exige correo, DNI de 6 a 9 dígitos y nombre y apellido de al menos 2 letras", () => {
    expect(isValidProfile("a@b.com", "35596147", "paula", "gerez")).toBe(true);
    expect(isValidProfile("no-es-correo", "35596147", "paula", "gerez")).toBe(false);
    expect(isValidProfile("a@b.com", "123", "paula", "gerez")).toBe(false);
    expect(isValidProfile("a@b.com", "35596147", "p", "gerez")).toBe(false);
  });

  it("acepta el DNI de 8 dígitos para extranjeros (95…)", () => {
    expect(isValidProfile("a@b.com", "95639616", "joseph", "elionoch")).toBe(true);
  });
});

describe("normalizadores", () => {
  it("normalizeEmail recorta y baja a minúsculas", () => {
    expect(normalizeEmail("  Paula@Example.COM ")).toBe("paula@example.com");
  });

  it("normalizeDni se queda sólo con los dígitos", () => {
    expect(normalizeDni("35.596.147")).toBe("35596147");
    expect(normalizeDni(null)).toBe("");
  });
});
