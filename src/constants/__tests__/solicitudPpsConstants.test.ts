import { isSolicitudPpsUbicacion, SOLICITUD_PPS_UBICACIONES } from "../solicitudPpsConstants";

describe("solicitudPpsConstants", () => {
  it("expone las cinco ciudades habilitadas y la modalidad virtual", () => {
    expect(SOLICITUD_PPS_UBICACIONES).toEqual([
      "Cipolletti",
      "Neuquén",
      "General Roca",
      "Fernández Oro",
      "Centenario",
      "Virtual",
    ]);
  });

  it("acepta Virtual y rechaza ubicaciones libres o variantes no canónicas", () => {
    expect(isSolicitudPpsUbicacion("Neuquén")).toBe(true);
    expect(isSolicitudPpsUbicacion("Virtual")).toBe(true);
    expect(isSolicitudPpsUbicacion("Plottier")).toBe(false);
    expect(isSolicitudPpsUbicacion("Neuquen")).toBe(false);
    expect(isSolicitudPpsUbicacion(123)).toBe(false);
  });
});
