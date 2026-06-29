import { describe, expect, it } from "@jest/globals";
import {
  dbToUiState,
  nextActionFor,
  STATE_TO_DB,
  NEXT_ACTION_BY_STATE,
  type InstitutionVM,
  type UiState,
} from "../gestionTypes";

describe("dbToUiState", () => {
  it("mapea los estados canónicos de la base a estados de UI", () => {
    expect(dbToUiState("Pendiente de Gestión")).toBe("porContactar");
    expect(dbToUiState("Esperando Respuesta")).toBe("esperandoRespuesta");
    expect(dbToUiState("En Conversación")).toBe("pendienteDecision");
    expect(dbToUiState("Seguimiento Exhaustivo")).toBe("pendienteDecision");
    expect(dbToUiState("Relanzamiento Confirmado")).toBe("confirmada");
    expect(dbToUiState("Relanzada")).toBe("confirmada");
    expect(dbToUiState("Archivado")).toBe("archivada");
  });

  it("es robusto a mayúsculas y acentos (usa normalización)", () => {
    expect(dbToUiState("pendiente de gestion")).toBe("porContactar");
    expect(dbToUiState("EN CONVERSACION")).toBe("pendienteDecision");
  });

  it("usa 'activa' como fallback para estados desconocidos o vacíos", () => {
    expect(dbToUiState("Cualquier Otra Cosa")).toBe("activa");
    expect(dbToUiState("")).toBe("activa");
    expect(dbToUiState(null)).toBe("activa");
    expect(dbToUiState(undefined)).toBe("activa");
  });

  it("es consistente con STATE_TO_DB (ida y vuelta para los estados mapeados)", () => {
    (Object.entries(STATE_TO_DB) as [UiState, string][]).forEach(([uiState, dbValue]) => {
      expect(dbToUiState(dbValue)).toBe(uiState);
    });
  });
});

describe("nextActionFor", () => {
  it("devuelve la acción sugerida según el estado de la institución", () => {
    expect(nextActionFor({ state: "porContactar" } as InstitutionVM)).toBe(
      NEXT_ACTION_BY_STATE.porContactar
    );
    expect(nextActionFor({ state: "activa" } as InstitutionVM)).toBe(NEXT_ACTION_BY_STATE.activa);
  });

  it("cubre todos los estados de UI con una acción no vacía", () => {
    (Object.keys(NEXT_ACTION_BY_STATE) as UiState[]).forEach((state) => {
      expect(nextActionFor({ state } as InstitutionVM)).toBeTruthy();
    });
  });
});
