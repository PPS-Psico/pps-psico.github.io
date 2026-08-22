import { describe, it, expect } from "@jest/globals";
import {
  classifyDbError,
  DbError,
  getDbErrorMessage,
  isRetryable,
  type DbErrorKind,
} from "../dbError";

describe("classifyDbError", () => {
  it("clasifica por codigo de Postgres", () => {
    const cases: Array<[string, DbErrorKind]> = [
      ["42501", "permission-denied"],
      ["23505", "duplicate"],
      ["23503", "reference-violation"],
      ["23502", "invalid-data"],
      ["23514", "invalid-data"],
      ["42703", "schema-mismatch"],
      ["42P01", "schema-mismatch"],
      ["PGRST301", "session-expired"],
      ["PGRST204", "schema-mismatch"],
    ];

    for (const [code, expected] of cases) {
      const result = classifyDbError({ code, message: "algo" });
      expect(result.kind).toBe(expected);
      expect(result.code).toBe(code);
    }
  });

  it("desenvuelve la forma AppErrorResponse que produce supabaseService", () => {
    const result = classifyDbError({
      error: {
        type: "SUPABASE_ERROR",
        message: "new row violates row-level security",
        code: "42501",
      },
    });
    expect(result.kind).toBe("permission-denied");
    expect(result.code).toBe("42501");
    expect(result.message).toContain("row-level security");
  });

  it("acepta AppErrorResponse con error de tipo string", () => {
    const result = classifyDbError({ error: "algo se rompio" });
    expect(result.message).toBe("algo se rompio");
    expect(result.kind).toBe("unknown");
  });

  it("detecta fallos de red por mensaje cuando no hay codigo", () => {
    for (const message of [
      "TypeError: Failed to fetch",
      "NetworkError when attempting to fetch resource",
      "network request failed",
      "Load failed",
      "The operation timed out",
    ]) {
      expect(classifyDbError({ message }).kind).toBe("network");
    }
  });

  it("detecta sesion vencida por mensaje cuando no hay codigo", () => {
    expect(classifyDbError({ message: "JWT expired" }).kind).toBe("session-expired");
    expect(classifyDbError({ message: "token is expired" }).kind).toBe("session-expired");
  });

  it("el codigo tiene prioridad sobre el texto del mensaje", () => {
    // Un 23505 cuyo mensaje casualmente menciona timeout sigue siendo duplicado.
    const result = classifyDbError({ code: "23505", message: "duplicate key after timeout" });
    expect(result.kind).toBe("duplicate");
  });

  it("cae en unknown ante algo irreconocible", () => {
    expect(classifyDbError({ message: "cualquier cosa" }).kind).toBe("unknown");
    expect(classifyDbError(null).kind).toBe("unknown");
    expect(classifyDbError("texto suelto").message).toBe("texto suelto");
  });

  it("conserva tabla y operacion para que el log diga donde paso", () => {
    const result = classifyDbError(
      { code: "42501", message: "denegado" },
      {
        table: "practicas",
        operation: "getAll",
      }
    );
    expect(result.table).toBe("practicas");
    expect(result.operation).toBe("getAll");
  });

  it("no re-envuelve un DbError ya clasificado", () => {
    const original = new DbError("network", "sin conexion", { table: "estudiantes" });
    expect(classifyDbError(original)).toBe(original);
  });

  it("produce un Error real, no un objeto plano", () => {
    const result = classifyDbError({ code: "23505", message: "duplicado" });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("duplicado");
  });
});

describe("getDbErrorMessage", () => {
  it("da un mensaje distinto y en castellano por categoria", () => {
    const kinds: DbErrorKind[] = [
      "permission-denied",
      "session-expired",
      "duplicate",
      "reference-violation",
      "invalid-data",
      "schema-mismatch",
      "network",
      "unknown",
    ];
    const messages = kinds.map((kind) => getDbErrorMessage(new DbError(kind, "interno")));
    expect(new Set(messages).size).toBe(kinds.length);
    messages.forEach((message) => expect(message.length).toBeGreaterThan(10));
  });

  it("nunca filtra el mensaje interno de Postgres", () => {
    const message = getDbErrorMessage(
      classifyDbError({ code: "42501", message: 'relation "practicas" RLS denied for uid 9f2a' })
    );
    expect(message).not.toContain("practicas");
    expect(message).not.toContain("9f2a");
  });

  it("funciona con errores sin clasificar", () => {
    expect(getDbErrorMessage({ message: "JWT expired" })).toContain("sesión");
  });
});

describe("isRetryable", () => {
  it("solo ofrece reintento cuando puede servir", () => {
    expect(isRetryable(new DbError("network", "x"))).toBe(true);
    expect(isRetryable(new DbError("unknown", "x"))).toBe(true);
    expect(isRetryable(new DbError("permission-denied", "x"))).toBe(false);
    expect(isRetryable(new DbError("duplicate", "x"))).toBe(false);
    expect(isRetryable(new DbError("session-expired", "x"))).toBe(false);
  });
});
