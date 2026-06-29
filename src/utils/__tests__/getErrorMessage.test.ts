import { getErrorMessage } from "../getErrorMessage";

describe("getErrorMessage", () => {
  it("extrae .message de instancias de Error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage(new TypeError("tipo"))).toBe("tipo");
  });

  it("devuelve el string tal cual", () => {
    expect(getErrorMessage("error plano")).toBe("error plano");
  });

  it("lee message de objetos tipo PostgrestError", () => {
    expect(getErrorMessage({ message: "RLS denied", code: "42501" })).toBe("RLS denied");
  });

  it("usa el fallback por defecto para valores sin mensaje útil", () => {
    expect(getErrorMessage(null)).toBe("Error desconocido");
    expect(getErrorMessage(undefined)).toBe("Error desconocido");
    expect(getErrorMessage(42)).toBe("Error desconocido");
    expect(getErrorMessage({ code: "x" })).toBe("Error desconocido");
  });

  it("usa el fallback cuando message no es string o está vacío", () => {
    expect(getErrorMessage({ message: 123 })).toBe("Error desconocido");
    expect(getErrorMessage({ message: "" })).toBe("Error desconocido");
  });

  it("respeta el fallback personalizado", () => {
    expect(getErrorMessage(null, "Algo salió mal")).toBe("Algo salió mal");
    expect(getErrorMessage({}, "custom")).toBe("custom");
  });
});
