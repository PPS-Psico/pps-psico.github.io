import { getCompromisoSubmitErrorMessage } from "../compromisoErrors";

describe("getCompromisoSubmitErrorMessage", () => {
  it("preserva mensajes de negocio seguros emitidos por el RPC", () => {
    expect(
      getCompromisoSubmitErrorMessage({
        message: "El plazo para confirmar esta PPS ya finalizó.",
        code: "P0001",
      })
    ).toBe("El plazo para confirmar esta PPS ya finalizó.");
  });

  it("oculta detalles internos de RLS y ofrece recuperación", () => {
    const result = getCompromisoSubmitErrorMessage({
      message: 'new row violates row-level security policy for table "compromisos_pps"',
      code: "42501",
    });

    expect(result).toContain("Actualizá la página");
    expect(result).not.toContain("row-level security");
    expect(result).not.toContain("compromisos_pps");
  });

  it("explica los errores de red sin borrar los datos ingresados", () => {
    expect(getCompromisoSubmitErrorMessage(new TypeError("Failed to fetch"))).toContain(
      "los datos que completaste siguen acá"
    );
  });

  it("pide actualizar cuando el RPC todavía no está en el schema cache", () => {
    expect(
      getCompromisoSubmitErrorMessage({
        message: "Could not find the function public.submit_compromiso_pps in the schema cache",
        code: "PGRST202",
      })
    ).toContain("Recargá la página");
  });

  it("usa un mensaje genérico seguro para errores desconocidos", () => {
    const result = getCompromisoSubmitErrorMessage(new Error("duplicate key value SQL 23505"));

    expect(result).toContain("contactá a Coordinación");
    expect(result).not.toContain("23505");
  });
});
