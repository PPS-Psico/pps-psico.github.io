import { describe, expect, it } from "@jest/globals";
import { isOnlinePpsDirection } from "../practiceModality";

describe("isOnlinePpsDirection", () => {
  it.each(["Online", "Modalidad Virtual", " virtual ", "A distancia"])(
    "reconoce la modalidad histórica %s como online",
    (direction) => {
      expect(isOnlinePpsDirection(direction)).toBe(true);
    }
  );

  it.each([null, "", "Gallo 1330", "Presencial", "Híbrida: online y presencial"])(
    "no convierte %p en una PPS online",
    (direction) => {
      expect(isOnlinePpsDirection(direction)).toBe(false);
    }
  );
});
