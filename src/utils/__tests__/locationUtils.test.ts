import { getLocationModalityLabel, hasPhysicalAddress } from "../locationUtils";

describe("hasPhysicalAddress", () => {
  it.each([
    "Modalidad Virtual",
    "Online",
    "Remota",
    "Presencial",
    "Modalidad híbrida",
    "A confirmar",
    "",
  ])("no considera %s una dirección física", (value) => {
    expect(hasPhysicalAddress(value)).toBe(false);
  });

  it.each([
    "Av. Rivadavia 1234, CABA",
    "Hospital General de Agudos Dr. T. Álvarez",
    "Sarmiento 440, Neuquén",
  ])("considera %s una dirección física", (value) => {
    expect(hasPhysicalAddress(value)).toBe(true);
  });
});

describe("getLocationModalityLabel", () => {
  it.each(["Modalidad Virtual", "Online", "Remota", "A distancia", "No presencial"])(
    "muestra %s como Online",
    (value) => {
      expect(getLocationModalityLabel(value)).toBe("Online");
    }
  );

  it.each(["Modalidad híbrida", "Modalidad mixta"])("muestra %s como Híbrida", (value) => {
    expect(getLocationModalityLabel(value)).toBe("Híbrida");
  });

  it.each(["Presencial", "Av. Rivadavia 1234, CABA"])("muestra %s como Pres.", (value) => {
    expect(getLocationModalityLabel(value)).toBe("Pres.");
  });

  it("no inventa una modalidad cuando el valor está vacío", () => {
    expect(getLocationModalityLabel("")).toBe("—");
  });
});
