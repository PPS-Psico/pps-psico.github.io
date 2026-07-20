export const PENALTY_SCORES = {
  "Baja Anticipada": 30,
  "Baja sobre la Fecha / Ausencia en Inicio": 50,
  "Abandono durante la PPS": 70,
  "Falta sin Aviso": 40,
  "Baja Administrativa / Sin Penalización": 0,
  "PPS desaprobada por la institución": 100,
} as const;

export type PenaltyType = keyof typeof PENALTY_SCORES;

export const STANDARD_PENALTY_TYPES = [
  "Baja Anticipada",
  "Baja sobre la Fecha / Ausencia en Inicio",
  "Abandono durante la PPS",
  "Falta sin Aviso",
] as const satisfies readonly PenaltyType[];

export const PENALTY_TYPES_THAT_REMOVE_PPS = [
  "Baja Anticipada",
  "Baja sobre la Fecha / Ausencia en Inicio",
  "Abandono durante la PPS",
] as const satisfies readonly PenaltyType[];

export const getPenaltyScore = (type: string): number => PENALTY_SCORES[type as PenaltyType] ?? 0;

export const isActivePenalty = (state: string | null | undefined): boolean =>
  !state || state === "Activa";
