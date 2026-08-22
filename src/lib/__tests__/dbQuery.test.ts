import { describe, it, expect } from "@jest/globals";
import { runQuery, runCount, runMutation } from "../dbQuery";
import { DbError } from "../dbError";

/** Simula lo que resuelve un builder de PostgREST. */
const resolves = <T>(value: { data?: T; error?: unknown; count?: number | null }) =>
  Promise.resolve(value) as never;

describe("runQuery", () => {
  it("devuelve data cuando no hay error", async () => {
    const rows = await runQuery(resolves({ data: [{ id: "1" }], error: null }), {
      table: "practicas",
      operation: "test",
    });
    expect(rows).toEqual([{ id: "1" }]);
  });

  it("conserva el null de maybeSingle sin tratarlo como error", async () => {
    const row = await runQuery(resolves({ data: null, error: null }), {
      table: "estudiantes",
      operation: "test",
    });
    expect(row).toBeNull();
  });

  it("lanza DbError clasificado y con contexto", async () => {
    expect.assertions(4);
    try {
      await runQuery(resolves({ data: null, error: { message: "denegado", code: "42501" } }), {
        table: "practicas",
        operation: "listar",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DbError);
      expect((error as DbError).kind).toBe("permission-denied");
      expect((error as DbError).table).toBe("practicas");
      expect((error as DbError).operation).toBe("listar");
    }
  });
});

describe("runCount", () => {
  it("devuelve el conteo", async () => {
    const total = await runCount(resolves({ count: 7, error: null }), {
      table: "practicas",
      operation: "contar",
    });
    expect(total).toBe(7);
  });

  it("normaliza un count nulo a 0 en vez de propagarlo", async () => {
    const total = await runCount(resolves({ count: null, error: null }), {
      table: "practicas",
      operation: "contar",
    });
    expect(total).toBe(0);
  });

  it("distingue 'cero filas' de 'la query fallo'", async () => {
    await expect(
      runCount(resolves({ count: null, error: { message: "boom", code: "42P01" } }), {
        table: "practicas",
        operation: "contar",
      })
    ).rejects.toBeInstanceOf(DbError);
  });
});

describe("runMutation", () => {
  it("resuelve sin devolver nada cuando la escritura funciona", async () => {
    await expect(
      runMutation(resolves({ data: null, error: null }), {
        table: "estudiantes",
        operation: "actualizar",
      })
    ).resolves.toBeUndefined();
  });

  it("lanza si la escritura falla", async () => {
    await expect(
      runMutation(resolves({ data: null, error: { message: "duplicado", code: "23505" } }), {
        table: "estudiantes",
        operation: "actualizar",
      })
    ).rejects.toMatchObject({ kind: "duplicate" });
  });
});
