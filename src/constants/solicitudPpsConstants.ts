export const SOLICITUD_PPS_UBICACIONES = [
  "Cipolletti",
  "Neuquén",
  "General Roca",
  "Fernández Oro",
  "Centenario",
  "Virtual",
] as const;

export type SolicitudPpsUbicacion = (typeof SOLICITUD_PPS_UBICACIONES)[number];

export const isSolicitudPpsUbicacion = (value: unknown): value is SolicitudPpsUbicacion =>
  typeof value === "string" && SOLICITUD_PPS_UBICACIONES.includes(value as SolicitudPpsUbicacion);
