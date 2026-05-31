import { normalizeStringForComparison } from "../../../utils/formatters";
import type { LanzamientoPPS } from "../../../types";

// ─── Estados de UI y mapeos con la base ─────────────────────────────────────

export type UiState =
  | "porContactar"
  | "reinsistir"
  | "esperandoRespuesta"
  | "pendienteDecision"
  | "confirmada"
  | "porFinalizar"
  | "activa"
  | "indefinida"
  | "archivada";

// Modos de vista del workspace central (tabs superiores)
export type ViewMode = "bandeja" | "instituciones" | "calendario" | "contactos" | "mails";

export const STATE_META: Record<UiState, { label: string; dot: string }> = {
  porContactar: { label: "Por contactar", dot: "warn" },
  reinsistir: { label: "Reinsistir", dot: "warn" },
  esperandoRespuesta: { label: "Esperando respuesta", dot: "accent" },
  pendienteDecision: { label: "Pendiente de decisión", dot: "ai" },
  confirmada: { label: "Confirmada", dot: "ok" },
  porFinalizar: { label: "Por finalizar", dot: "accent" },
  activa: { label: "Activa", dot: "ok" },
  indefinida: { label: "Indefinida", dot: "mute" },
  archivada: { label: "Archivada", dot: "mute" },
};

// Valor canónico de estado_gestion al registrar un cambio
export const STATE_TO_DB: Partial<Record<UiState, string>> = {
  porContactar: "Pendiente de Gestión",
  esperandoRespuesta: "Esperando Respuesta",
  pendienteDecision: "En Conversación",
  confirmada: "Relanzamiento Confirmado",
  archivada: "Archivado",
};

export const dbToUiState = (raw?: string | null): UiState => {
  const s = normalizeStringForComparison(raw || "");
  if (s === "pendiente de gestion") return "porContactar";
  if (s === "esperando respuesta") return "esperandoRespuesta";
  if (s === "en conversacion" || s === "seguimiento exhaustivo") return "pendienteDecision";
  if (s === "relanzamiento confirmado" || s === "relanzada") return "confirmada";
  if (s === "archivado") return "archivada";
  return "activa";
};

// ─── Categorías del rail ────────────────────────────────────────────────────

export type CatId =
  | "hoy"
  | "porContactar"
  | "reinsistir"
  | "porFinalizar"
  | "pendienteDecision"
  | "faltaDato"
  | "esperandoRespuesta"
  | "confirmada"
  | "activa"
  | "indefinida";

export interface CatDef {
  id: CatId;
  label: string;
  icon: string;
  tone: string | null;
  note: string;
}

export const CATEGORIES: CatDef[] = [
  { id: "hoy", label: "Hoy", icon: "today", tone: null, note: "Lo que conviene hacer primero" },
  {
    id: "porContactar",
    label: "Por contactar",
    icon: "campaign",
    tone: "warn",
    note: "Finalizadas sin gestión",
  },
  {
    id: "reinsistir",
    label: "Reinsistir",
    icon: "mark_email_unread",
    tone: "warn",
    note: "Hace tiempo sin respuesta",
  },
  {
    id: "porFinalizar",
    label: "Por finalizar",
    icon: "event_busy",
    tone: "accent",
    note: "Activas que terminan pronto",
  },
  {
    id: "pendienteDecision",
    label: "Pendiente de decisión",
    icon: "how_to_reg",
    tone: "ai",
    note: "Respondieron · falta definir",
  },
  {
    id: "faltaDato",
    label: "Falta dato clave",
    icon: "priority_high",
    tone: "warn",
    note: "Sin teléfono cargado",
  },
  {
    id: "esperandoRespuesta",
    label: "Esperando respuesta",
    icon: "schedule_send",
    tone: "accent",
    note: "Contactadas, monitoreando",
  },
  {
    id: "confirmada",
    label: "Confirmadas",
    icon: "check_circle",
    tone: "ok",
    note: "Ya tienen relanzamiento",
  },
  { id: "activa", label: "Activas", icon: "trending_up", tone: "ok", note: "PPS en curso" },
  {
    id: "indefinida",
    label: "Indefinidas",
    icon: "all_inclusive",
    tone: "mute",
    note: "Sin fechas · falta data",
  },
];

// Umbral (en días) a partir del cual una institución contactada y sin respuesta
// pasa de "Esperando respuesta" a "Reinsistir". Unificado con la vista de Mails
// ("Esperando +5 días") para que ambas superficies usen el mismo criterio.
export const REINSISTIR_THRESHOLD_DAYS = 5;

// Umbral (en días) a partir del cual una PPS activa se considera "Por finalizar".
export const POR_FINALIZAR_THRESHOLD_DAYS = 45;

export const HOY_STATES: UiState[] = [
  "porContactar",
  "reinsistir",
  "porFinalizar",
  "pendienteDecision",
];

export const HOY_ORDER: Record<string, number> = {
  reinsistir: 0,
  porContactar: 1,
  porFinalizar: 2,
  pendienteDecision: 3,
  esperandoRespuesta: 4,
  activa: 5,
  indefinida: 6,
  confirmada: 7,
  archivada: 8,
};

// ─── View-models de bandeja e instituciones ─────────────────────────────────

export interface MissingFlag {
  k: string;
  label: string;
  icon: string;
}

export interface BandejaItem {
  id: string;
  launch: LanzamientoPPS;
  state: UiState;
  nombre: string;
  grupo: string;
  orientacion: string | null;
  phone: string | null;
  titulo: string;
  razon: string;
  nextStep: string;
  daysAgo: number;
  flags: MissingFlag[];
  /** True si la PPS está en "Por contactar" por tener un estado de gestión no reconocido. */
  noClasificada?: boolean;
}

export interface InstitutionVM {
  key: string; // normalized group name (clave de unión)
  id: string; // institution id (si existe en la tabla)
  nombre: string; // nombre de grupo para mostrar
  state: UiState;
  orientaciones: string[];
  phone: string | null;
  referente: string | null;
  localidad: string | null;
  convenio: string | null;
  notas: string | null;
  historial: string | null;
  proximo: string | null;
  lastActivity: number; // timestamp para ordenar por actividad
  lastActivityLabel: string | null; // texto descriptivo de la última actividad
  launches: LanzamientoPPS[];
  flags: MissingFlag[];
  itemState: UiState | null; // estado de bandeja si aparece en items
  /** True si la PPS está en "Por contactar" por tener un estado de gestión no reconocido. */
  noClasificada?: boolean;
}

export type SortKey = "nombre" | "actividad" | "proxima" | "faltantes";

// Acción sugerida según el estado de gestión — texto corto y accionable.
export const NEXT_ACTION_BY_STATE: Record<UiState, string> = {
  porContactar: "Contactar para confirmar continuidad",
  reinsistir: "Reinsistir · sin respuesta hace tiempo",
  esperandoRespuesta: "Esperar respuesta · monitorear",
  pendienteDecision: "Definir continuidad y fechas",
  confirmada: "Esperar fecha de inicio",
  porFinalizar: "Preparar cierre y relanzamiento",
  activa: "Monitorear · sin acción inmediata",
  indefinida: "Cargar fechas o archivar",
  archivada: "Archivada · sin seguimiento",
};

export const nextActionFor = (vm: InstitutionVM): string => NEXT_ACTION_BY_STATE[vm.state] || "—";

export interface FilterOption {
  value: string;
  label: string;
  orient?: string;
}
