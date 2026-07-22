/**
 * PenalizationManager — Rediseño v2 (búsqueda unificada por alumno o PPS)
 *
 * Solo cambia la capa visual. La lógica de datos se preserva intacta:
 *   · Query de PPS relevantes del alumno (convocatorias + prácticas en curso).
 *   · applyPenaltyMutation con baja automática de inscripción/práctica según el
 *     tipo de incumplimiento.
 *   · Agregación por alumno con puntaje total y semáforo de severidad.
 *   · Borrado con confirmación (ConfirmModal).
 *
 * Severidad (puntaje): ≥21 crítico · ≥11 medio · resto leve.
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminSearch from "./AdminSearch";
import {
  fetchAllData,
  fetchPaginatedData,
  createRecord,
  deleteRecord,
  updateRecord,
} from "../../services/supabaseService";
import { mockDb } from "../../services/mockDb";
import type { EstudianteFields, Penalizacion, AirtableRecord } from "../../types";
import {
  TABLE_NAME_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  TABLE_NAME_PENALIZACIONES,
  FIELD_PENALIZACION_ESTUDIANTE_LINK,
  FIELD_PENALIZACION_TIPO,
  FIELD_PENALIZACION_FECHA,
  FIELD_PENALIZACION_NOTAS,
  FIELD_PENALIZACION_PUNTAJE,
  TABLE_NAME_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  TABLE_NAME_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_PENALIZACION_CONVOCATORIA_LINK,
  FIELD_LEGAJO_CONVOCATORIAS,
  FIELD_NOMBRE_BUSQUEDA_PRACTICAS,
  FIELD_PENALIZACION_ESTADO,
  FIELD_PENALIZACION_PRACTICA_ID,
  FIELD_PENALIZACION_LANZAMIENTO_ID,
  FIELD_PENALIZACION_ANULADA_AT,
  FIELD_PENALIZACION_ANULACION_MOTIVO,
  STANDARD_PENALTY_TYPES,
  PENALTY_TYPES_THAT_REMOVE_PPS,
  getPenaltyScore,
  isActivePenalty,
} from "../../constants";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import ConfirmModal from "../ConfirmModal";
import { formatDate, normalizeStringForComparison } from "../../utils/formatters";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { injectPremiumMotion } from "./premiumMotion";
import { logger } from "../../utils/logger";
import {
  mapConvocatoria,
  mapLanzamiento,
  mapPenalizacion,
  mapPractica,
  mapEstudiante,
} from "../../utils/mappers";
import DesaprobacionPPSModal from "./DesaprobacionPPSModal";
import { isPracticeDisapproved } from "../../logic/studentRules";

// ─── CSS scoped (Paper & Ink editorial) ───────────────────────────────────────

const CSS = `
.pen {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  --ai:#5A2D86; --ai-s:#5A2D8612;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .pen {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
  --ai:#C9A4F2; --ai-s:#C9A4F21A;
}
.pen .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.pen .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums; }
.pen .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

/* Entrada unificada: alumno o PPS */
.pen-entry-panel{ border:1px solid var(--rule-2); border-radius:16px; background:var(--paper); overflow:visible; }
.pen-entry-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:24px; padding:24px 26px 20px; }
.pen-entry-copy{ min-width:0; }
.pen-entry-copy h2{ font-family:'Instrument Serif', serif; font-size:28px; line-height:1.08; font-weight:700; letter-spacing:-0.025em; margin:0; text-wrap:balance; }
.pen-entry-copy p{ font-size:13.5px; line-height:1.55; color:var(--ink-3); margin:7px 0 0; max-width:680px; text-wrap:pretty; }
.pen-mode-tabs{ display:inline-flex; flex-shrink:0; gap:3px; padding:3px; border-radius:10px; background:var(--paper-2); }
.pen-mode-tab{ display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:38px; padding:0 14px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--ink-3); font:600 12.5px/1 'Hanken Grotesk',system-ui,sans-serif; cursor:pointer; transition:background .16s ease,color .16s ease,border-color .16s ease; }
.pen-mode-tab .material-icons{ font-size:17px; }
.pen-mode-tab:hover{ color:var(--ink); }
.pen-mode-tab[aria-selected="true"]{ border-color:var(--rule-2); background:var(--paper); color:var(--ink); }
.pen-mode-tab:focus-visible,.pen-target-clear:focus-visible,.pen-target-action:focus-visible,.pen-pps-result:focus-visible,.pen-search-input:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
.pen-entry-body{ padding:0 26px 24px; }
.pen-search-label{ display:block; margin-bottom:8px; font-size:12px; font-weight:600; color:var(--ink-2); }
.pen-unified-search,.pen-pps-search-control{ height:50px; border:1px solid var(--rule-3); border-radius:10px; background:var(--paper-2); transition:border-color .16s ease,background .16s ease; }
.pen-unified-search:focus-within,.pen-pps-search-control:focus-within{ border-color:var(--accent); background:var(--paper); }
.pen-search-wrap{ position:relative; }
.pen-pps-search-control{ display:flex; align-items:center; }
.pen-search-icon{ display:flex; align-items:center; justify-content:center; width:46px; flex-shrink:0; color:var(--ink-3); }
.pen-search-icon .material-icons{ font-size:20px; }
.pen-search-input{ width:100%; height:100%; padding:0 14px 0 0; border:0; outline:0; background:transparent; color:var(--ink); font:500 14px/1 'Hanken Grotesk',system-ui,sans-serif; }
.pen-search-input::placeholder{ color:var(--ink-3); opacity:1; }
.pen-search-spinner{ width:16px; height:16px; margin-right:15px; flex-shrink:0; border:2px solid var(--rule-3); border-top-color:var(--accent); border-radius:999px; animation:pen-spin .8s linear infinite; }
.pen-search-results{ position:absolute; z-index:120; top:calc(100% + 7px); left:0; right:0; max-height:310px; overflow-y:auto; border:1px solid var(--rule-3); border-radius:10px; background:var(--paper); box-shadow:0 6px 8px rgba(20,19,16,.12); }
.pen-search-results ul{ margin:0; padding:5px; list-style:none; }
.pen-pps-result{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:11px 12px; border:0; border-radius:7px; background:transparent; color:var(--ink); text-align:left; font-family:inherit; cursor:pointer; }
.pen-pps-result:hover{ background:var(--paper-2); }
.pen-pps-result-main{ min-width:0; }
.pen-pps-result-name{ display:block; overflow:hidden; color:var(--ink); font-size:13.5px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.pen-pps-result-meta{ display:block; margin-top:2px; color:var(--ink-3); font-size:11.5px; }
.pen-pps-result .material-icons{ flex-shrink:0; color:var(--ink-4); font-size:18px; }
.pen-search-feedback{ padding:18px; color:var(--ink-3); font-size:12.5px; text-align:center; }
.pen-search-help{ margin:9px 2px 0; color:var(--ink-3); font-size:11.5px; line-height:1.45; }
.pen-target{ display:flex; align-items:center; justify-content:space-between; gap:18px; margin-top:14px; padding:15px 16px; border-top:1px solid var(--rule-2); border-bottom:1px solid var(--rule-2); }
.pen-target-id{ min-width:0; display:flex; align-items:center; gap:11px; }
.pen-target-icon{ width:36px; height:36px; display:flex; flex-shrink:0; align-items:center; justify-content:center; border-radius:9px; background:var(--paper-2); color:var(--ink-3); }
.pen-target-icon .material-icons{ font-size:19px; }
.pen-target-name{ overflow:hidden; color:var(--ink); font-size:14px; font-weight:650; text-overflow:ellipsis; white-space:nowrap; }
.pen-target-meta{ margin-top:2px; color:var(--ink-3); font-size:11.5px; }
.pen-target-actions{ display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-shrink:0; }
.pen-target-action{ min-height:36px; display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:0 12px; border:1px solid var(--rule-3); border-radius:8px; background:var(--paper); color:var(--ink); font:600 12px/1 'Hanken Grotesk',system-ui,sans-serif; cursor:pointer; transition:background .16s ease,border-color .16s ease; }
.pen-target-action:hover{ border-color:var(--ink-4); background:var(--paper-2); }
.pen-target-action .material-icons{ font-size:16px; }
.pen-target-action-danger{ border-color:var(--warn); background:var(--warn); color:#fff; }
.pen-target-action-danger:hover{ border-color:var(--warn); background:var(--warn); opacity:.9; }
.pen-target-action:disabled{ border-color:var(--rule-2); background:var(--paper-2); color:var(--ink-4); cursor:not-allowed; opacity:1; }
.pen-target-clear{ width:34px; height:34px; display:flex; align-items:center; justify-content:center; border:0; border-radius:8px; background:transparent; color:var(--ink-3); cursor:pointer; }
.pen-target-clear:hover{ background:var(--paper-2); color:var(--ink); }
.pen-target-clear .material-icons{ font-size:18px; }
.pen-roster{ margin-top:18px; border-top:1px solid var(--rule-2); }
.pen-roster-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:18px; padding:18px 2px 11px; }
.pen-roster-head h3{ margin:0; color:var(--ink); font-size:14px; font-weight:650; }
.pen-roster-head p{ margin:3px 0 0; color:var(--ink-3); font-size:11.5px; }
.pen-roster-count{ flex-shrink:0; color:var(--ink-3); font:500 11.5px/1 'JetBrains Mono',monospace; }
.pen-roster-list{ border-top:1px solid var(--rule-2); }
.pen-roster-row{ display:grid; grid-template-columns:minmax(190px,1.4fr) minmax(120px,.7fr) minmax(95px,.55fr) auto; align-items:center; gap:14px; min-height:62px; padding:9px 2px; border-bottom:1px solid var(--rule-2); }
.pen-roster-person{ min-width:0; }
.pen-roster-name{ overflow:hidden; color:var(--ink); font-size:13.5px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.pen-roster-legajo{ margin-top:2px; color:var(--ink-3); font:500 11px/1.3 'JetBrains Mono',monospace; }
.pen-roster-state{ min-width:0; color:var(--ink-3); font-size:11.5px; }
.pen-status{ display:inline-flex; align-items:center; min-height:24px; padding:0 8px; border-radius:999px; background:var(--paper-2); color:var(--ink-2); font-size:10.5px; font-weight:600; white-space:nowrap; }
.pen-status[data-status="disapproved"]{ background:var(--warn-s); color:var(--warn); }
.pen-roster-hours{ color:var(--ink-3); font:500 11.5px/1.3 'JetBrains Mono',monospace; white-space:nowrap; }
.pen-roster-empty{ padding:24px 4px 4px; color:var(--ink-3); font-size:12.5px; line-height:1.5; text-align:center; }
.pen-roster-skeleton{ height:62px; border-bottom:1px solid var(--rule-2); background:linear-gradient(90deg,transparent,var(--paper-2),transparent); background-size:220% 100%; animation:pen-skeleton 1.2s ease-in-out infinite; }
@keyframes pen-skeleton{ from{ background-position:100% 0; } to{ background-position:-100% 0; } }
.pen-inline-error{ margin-top:12px; padding:10px 12px; border-radius:8px; background:var(--warn-s); color:var(--warn); font-size:12px; }

@media (max-width:760px){
  .pen-entry-head{ flex-direction:column; padding:20px 18px 16px; }
  .pen-mode-tabs{ width:100%; }
  .pen-mode-tab{ flex:1; }
  .pen-entry-body{ padding:0 18px 20px; }
  .pen-target{ align-items:flex-start; flex-direction:column; padding:14px 2px; }
  .pen-target-actions{ width:100%; justify-content:flex-start; flex-wrap:wrap; }
  .pen-target-action{ flex:1; }
  .pen-roster-row{ grid-template-columns:minmax(0,1fr) auto; gap:7px 12px; padding:12px 2px; }
  .pen-roster-state,.pen-roster-hours{ grid-column:1; }
  .pen-roster-row>.pen-target-action{ grid-column:2; grid-row:1 / span 3; align-self:center; }
}

@media (prefers-reduced-motion:reduce){
  .pen-mode-tab,.pen-unified-search,.pen-pps-search-control,.pen-target-action{ transition:none; }
  .pen-search-spinner,.pen-spin,.pen-roster-skeleton{ animation:none; }
}

/* Header de listado */
.pen-list-head{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin:30px 0 14px; flex-wrap:wrap; }
.pen-legend{ display:flex; gap:14px; flex-wrap:wrap; }
.pen-legend span{ display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--ink-3); }
.pen-legend .dot{ width:8px; height:8px; border-radius:999px; }

/* Tarjeta de alumno */
.pen-card{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); overflow:hidden; transition:border-color .12s ease; }
.pen-card:hover{ border-color:var(--rule-3); }
.pen-card[data-sev="critico"]{ border-color:var(--warn); }
.pen-card-head{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; cursor:pointer; background:transparent; border:none; text-align:left; font-family:inherit; }
.pen-card-head:hover{ background:var(--paper-2); }
.pen-id{ display:flex; align-items:center; gap:13px; min-width:0; }
.pen-sev-ico{ width:38px; height:38px; flex-shrink:0; border-radius:10px; display:flex; align-items:center; justify-content:center; }
.pen-sev-ico .material-icons{ font-size:20px; }
.pen-sev-ico[data-sev="critico"]{ background:var(--warn-s); color:var(--warn); }
.pen-sev-ico[data-sev="medio"]{ background:var(--warn-s); color:var(--warn); }
.pen-sev-ico[data-sev="leve"]{ background:var(--paper-3); color:var(--ink-3); }
.pen-name{ font-size:15px; font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pen-legajo{ font-size:12px; color:var(--ink-3); font-family:'JetBrains Mono', monospace; margin-top:1px; }
.pen-score-wrap{ display:flex; align-items:center; gap:14px; flex-shrink:0; }
.pen-score{ text-align:right; }
.pen-score .num{ font-family:'JetBrains Mono', monospace; font-size:30px; font-weight:300; letter-spacing:-0.04em; line-height:1; }
.pen-score .num[data-sev="critico"]{ color:var(--warn); }
.pen-score .num[data-sev="medio"]{ color:var(--warn); }
.pen-score .num[data-sev="leve"]{ color:var(--ink-2); }
.pen-score .lbl{ font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-4); margin-top:2px; }
.pen-chev{ color:var(--ink-4); transition:transform .2s ease; }
.pen-chev.open{ transform:rotate(180deg); }

/* Detalle expandido */
.pen-detail{ border-top:1px solid var(--rule-2); background:var(--paper-2); padding:16px 18px; }
.pen-detail h4{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); margin:0 0 12px; }
.pen-item{ display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border:1px solid var(--rule-2); border-radius:10px; background:var(--paper); }
.pen-item + .pen-item{ margin-top:8px; }
.pen-item-ico{ color:var(--ink-4); margin-top:1px; }
.pen-item-ico .material-icons{ font-size:18px; }
.pen-item-body{ flex:1; min-width:0; }
.pen-item-tipo{ font-size:13.5px; font-weight:600; color:var(--ink); }
.pen-item-pps{ font-size:11.5px; color:var(--ink-3); margin-top:1px; }
.pen-item-date{ font-size:11px; font-family:'JetBrains Mono', monospace; color:var(--ink-3); white-space:nowrap; }
.pen-item-notes{ margin-top:8px; font-size:12.5px; color:var(--ink-2); line-height:1.5; padding-left:10px; border-left:2px solid var(--rule-3); font-style:italic; }
.pen-del{ flex-shrink:0; width:30px; height:30px; border-radius:8px; border:none; background:transparent; color:var(--ink-4); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .12s, color .12s; }
.pen-del:hover{ background:var(--warn-s); color:var(--warn); }
.pen-del .material-icons{ font-size:17px; }
.pen-del:disabled{ opacity:.5; cursor:not-allowed; }
@keyframes pen-spin{ to{ transform:rotate(360deg); } }
.pen-spin{ width:15px; height:15px; border:2px solid var(--rule-3); border-top-color:var(--warn); border-radius:999px; animation:pen-spin .8s linear infinite; }

/* Modal */
.pen-modal-bg{ position:fixed; inset:0; background:rgba(20,19,16,0.45); display:flex; align-items:center; justify-content:center; z-index:200; padding:24px; animation:pen-fade .15s ease; }
@keyframes pen-fade{ from{ opacity:0; } to{ opacity:1; } }
.pen-modal{ background:var(--paper); border:1px solid var(--rule-2); border-radius:16px; width:100%; max-width:480px; max-height:90vh; overflow:auto; box-shadow:0 24px 80px rgba(20,19,16,0.22); }
.pen-modal-head{ padding:20px 24px; border-bottom:1px solid var(--rule-2); }
.pen-modal-head .eyebrow{ color:var(--warn); }
.pen-modal-head h3{ font-family:'Instrument Serif', serif; font-size:22px; font-weight:700; letter-spacing:-0.02em; margin:5px 0 0; }
.pen-modal-body{ padding:20px 24px; display:flex; flex-direction:column; gap:16px; }
.pen-modal-foot{ padding:16px 24px; border-top:1px solid var(--rule-2); display:flex; justify-content:flex-end; gap:10px; }
.pen-label{ display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; font-weight:600; color:var(--ink-3); margin-bottom:6px; }
.pen-field{ width:100%; padding:10px 12px; border:1px solid var(--rule-3); border-radius:9px; background:var(--paper-2); color:var(--ink); font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; }
.pen-field:focus{ border-color:var(--accent); }
textarea.pen-field{ resize:vertical; min-height:64px; }
.pen-btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; padding:9px 16px; border-radius:9px; border:1px solid var(--rule-3); background:transparent; color:var(--ink); cursor:pointer; font-family:inherit; transition:background .12s; }
.pen-btn:hover{ background:var(--paper-2); }
.pen-btn-primary{ background:var(--warn); color:#fff; border-color:var(--warn); }
.pen-btn-primary:hover{ opacity:.88; background:var(--warn); }
.pen-btn:disabled{ opacity:.5; cursor:not-allowed; }
.pen-hint{ display:flex; align-items:flex-start; gap:8px; font-size:11.5px; color:var(--ink-3); line-height:1.5; }
.pen-hint .material-icons{ font-size:14px; color:var(--warn); flex-shrink:0; margin-top:1px; }
`;

injectScopedStyles("pen-styles", CSS);
injectPremiumMotion();

// ─── Constantes ───────────────────────────────────────────────────────────────

const PENALTY_TYPES = [...STANDARD_PENALTY_TYPES];
const TRIGGER_TYPES: readonly string[] = PENALTY_TYPES_THAT_REMOVE_PPS;

type Severity = "critico" | "medio" | "leve";

const severityOf = (score: number): Severity =>
  score >= 21 ? "critico" : score >= 11 ? "medio" : "leve";

const severityMeta: Record<Severity, { label: string; icon: string }> = {
  critico: { label: "Crítico", icon: "local_fire_department" },
  medio: { label: "Medio", icon: "warning_amber" },
  leve: { label: "Leve", icon: "priority_high" },
};

const getPenaltyIcon = (type: string | undefined) => {
  if (!type) return "gavel";
  const t = type.toLowerCase();
  if (t.includes("baja anticipada")) return "event_busy";
  if (t.includes("baja sobre la fecha") || t.includes("ausencia")) return "no_accounts";
  if (t.includes("abandono")) return "directions_run";
  if (t.includes("falta sin aviso")) return "person_off";
  return "gavel";
};

interface SelectedStudent {
  id: string;
  legajo: string;
  nombre: string;
}

interface PenalizedStudent {
  id: string;
  legajo: string;
  nombre: string;
  totalScore: number;
  penalties: (Penalizacion & { id: string; ppsName?: string })[];
}

type EntrySearchMode = "student" | "pps";

interface PpsSearchResult {
  id: string;
  name: string;
  startDate?: string | null;
  status?: string | null;
}

interface PpsRosterStudent extends SelectedStudent {
  practiceState: string;
  hours: number | null;
  canDisapprove: boolean;
  blockedLabel?: string;
}

const firstLinkedId = (value: unknown): string => {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved ? String(resolved) : "";
};

const formatPpsMeta = (pps: PpsSearchResult) =>
  [pps.status, pps.startDate ? `Inicio ${formatDate(pps.startDate)}` : null]
    .filter(Boolean)
    .join(" · ");

const PenaltyEntryPanel: React.FC<{
  isTestingMode: boolean;
  onPenalty: (student: SelectedStudent) => void;
  onDisapprove: (student: SelectedStudent, launchId?: string) => void;
  onError: (message: string) => void;
}> = ({ isTestingMode, onPenalty, onDisapprove, onError }) => {
  const [searchMode, setSearchMode] = useState<EntrySearchMode>("student");
  const [selectedSearchStudent, setSelectedSearchStudent] = useState<SelectedStudent | null>(null);
  const [ppsSearchTerm, setPpsSearchTerm] = useState("");
  const [debouncedPpsSearch, setDebouncedPpsSearch] = useState("");
  const [isPpsDropdownOpen, setIsPpsDropdownOpen] = useState(false);
  const [selectedPps, setSelectedPps] = useState<PpsSearchResult | null>(null);
  const ppsSearchRef = useRef<HTMLDivElement>(null);
  const ppsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedPpsSearch(ppsSearchTerm.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [ppsSearchTerm]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (ppsSearchRef.current && !ppsSearchRef.current.contains(event.target as Node)) {
        setIsPpsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const ppsSearchQuery = useQuery<PpsSearchResult[]>({
    queryKey: ["penaltyPpsSearch", debouncedPpsSearch, isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const launches = (await mockDb.getAll("lanzamientos_pps")) as Record<string, unknown>[];
        const normalizedTerm = normalizeStringForComparison(debouncedPpsSearch);
        return launches
          .filter((launch) =>
            normalizeStringForComparison(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS]).includes(
              normalizedTerm
            )
          )
          .slice(0, 15)
          .map((launch) => ({
            id: String(launch.id),
            name: String(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "PPS sin nombre"),
            startDate: (launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null) || null,
            status: (launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] as string | null) || null,
          }));
      }

      const result = await fetchPaginatedData(
        TABLE_NAME_LANZAMIENTOS_PPS,
        1,
        15,
        [
          FIELD_NOMBRE_PPS_LANZAMIENTOS,
          FIELD_FECHA_INICIO_LANZAMIENTOS,
          FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
        ],
        debouncedPpsSearch,
        [FIELD_NOMBRE_PPS_LANZAMIENTOS],
        { field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }
      );
      if (result.error) throw new Error("No se pudo buscar la PPS.");

      return result.records.map((launch) => ({
        id: launch.id,
        name: launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "PPS sin nombre",
        startDate: launch[FIELD_FECHA_INICIO_LANZAMIENTOS],
        status: launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS],
      }));
    },
    enabled: searchMode === "pps" && debouncedPpsSearch.length >= 2 && !selectedPps,
    staleTime: 30_000,
  });

  const rosterQuery = useQuery<PpsRosterStudent[]>({
    queryKey: ["penaltyPpsRoster", selectedPps?.id, isTestingMode],
    queryFn: async () => {
      if (!selectedPps) return [];

      let practices: Record<string, unknown>[];
      let enrollments: Record<string, unknown>[];

      if (isTestingMode) {
        const [mockPractices, mockEnrollments] = await Promise.all([
          mockDb.getAll("practicas"),
          mockDb.getAll("convocatorias"),
        ]);
        practices = (mockPractices as Record<string, unknown>[]).filter(
          (practice) =>
            firstLinkedId(practice[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]) === selectedPps.id
        );
        enrollments = (mockEnrollments as Record<string, unknown>[]).filter(
          (enrollment) =>
            firstLinkedId(enrollment[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]) === selectedPps.id
        );
      } else {
        const [practicesResult, enrollmentsResult] = await Promise.all([
          fetchAllData(
            TABLE_NAME_PRACTICAS,
            [
              FIELD_ESTUDIANTE_LINK_PRACTICAS,
              FIELD_ESTADO_PRACTICA,
              FIELD_HORAS_PRACTICAS,
              FIELD_TIPO_ACTIVIDAD_PRACTICAS,
            ],
            { [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: selectedPps.id }
          ),
          fetchAllData(
            TABLE_NAME_CONVOCATORIAS,
            [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS, FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS],
            { [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: selectedPps.id }
          ),
        ]);
        if (practicesResult.error || enrollmentsResult.error) {
          throw new Error("No se pudo cargar la nómina de la PPS.");
        }
        practices = practicesResult.records;
        enrollments = enrollmentsResult.records;
      }

      const ppsPractices = practices.filter((practice) => {
        const activityType = normalizeStringForComparison(practice[FIELD_TIPO_ACTIVIDAD_PRACTICAS]);
        return !activityType || activityType === "pps";
      });

      const selectedEnrollmentState = new Map<string, string>();
      enrollments.forEach((enrollment) => {
        const state = String(enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "");
        if (normalizeStringForComparison(state) !== "seleccionado") return;
        const studentId = firstLinkedId(enrollment[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
        if (studentId) selectedEnrollmentState.set(studentId, state);
      });

      const practiceByStudent = new Map<string, Record<string, unknown>>();
      ppsPractices.forEach((practice) => {
        const studentId = firstLinkedId(practice[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
        if (!studentId) return;
        const current = practiceByStudent.get(studentId);
        const currentDisapproved = current
          ? isPracticeDisapproved(String(current[FIELD_ESTADO_PRACTICA] || ""))
          : false;
        const nextDisapproved = isPracticeDisapproved(
          String(practice[FIELD_ESTADO_PRACTICA] || "")
        );
        if (!current || (currentDisapproved && !nextDisapproved)) {
          practiceByStudent.set(studentId, practice);
        }
      });

      const studentIds = new Set<string>([
        ...selectedEnrollmentState.keys(),
        ...practiceByStudent.keys(),
      ]);
      if (studentIds.size === 0) return [];

      let students: Record<string, unknown>[];
      if (isTestingMode) {
        const mockStudents = (await mockDb.getAll("estudiantes")) as Record<string, unknown>[];
        students = mockStudents.filter((student) => studentIds.has(String(student.id)));
      } else {
        const studentsResult = await fetchAllData(
          TABLE_NAME_ESTUDIANTES,
          [FIELD_LEGAJO_ESTUDIANTES, FIELD_NOMBRE_ESTUDIANTES],
          { id: Array.from(studentIds) }
        );
        if (studentsResult.error) throw new Error("No se pudieron cargar los estudiantes.");
        students = studentsResult.records;
      }

      return students
        .map((student): PpsRosterStudent => {
          const studentId = String(student.id);
          const practice = practiceByStudent.get(studentId);
          const practiceState = practice
            ? String(practice[FIELD_ESTADO_PRACTICA] || "Sin estado")
            : selectedEnrollmentState.get(studentId) || "Seleccionado";
          const alreadyDisapproved = practice ? isPracticeDisapproved(practiceState) : false;

          return {
            id: studentId,
            legajo: String(student[FIELD_LEGAJO_ESTUDIANTES] || "—"),
            nombre: String(student[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante sin nombre"),
            practiceState,
            hours: practice ? Number(practice[FIELD_HORAS_PRACTICAS] || 0) : null,
            canDisapprove: Boolean(practice) && !alreadyDisapproved,
            blockedLabel: alreadyDisapproved
              ? "Ya desaprobada"
              : practice
                ? undefined
                : "Sin práctica",
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    },
    enabled: Boolean(selectedPps),
  });

  const handleStudentSelect = (student: AirtableRecord<EstudianteFields>) => {
    if (!student[FIELD_LEGAJO_ESTUDIANTES] || !student[FIELD_NOMBRE_ESTUDIANTES]) {
      onError("El registro del estudiante está incompleto.");
      return;
    }
    setSelectedSearchStudent({
      id: student.id,
      legajo: String(student[FIELD_LEGAJO_ESTUDIANTES]),
      nombre: String(student[FIELD_NOMBRE_ESTUDIANTES]),
    });
  };

  const changeMode = (mode: EntrySearchMode) => {
    setSearchMode(mode);
    setSelectedSearchStudent(null);
    setSelectedPps(null);
    setPpsSearchTerm("");
    setDebouncedPpsSearch("");
    setIsPpsDropdownOpen(false);
  };

  const clearSelectedPps = () => {
    setSelectedPps(null);
    setPpsSearchTerm("");
    setDebouncedPpsSearch("");
    setIsPpsDropdownOpen(false);
    window.requestAnimationFrame(() => ppsInputRef.current?.focus());
  };

  const showPpsDropdown = isPpsDropdownOpen && !selectedPps && debouncedPpsSearch.length >= 2;

  return (
    <section className="pen-entry-panel" aria-labelledby="pen-entry-title">
      <div className="pen-entry-head">
        <div className="pen-entry-copy">
          <h2 id="pen-entry-title">Registrar una incidencia</h2>
          <p>
            Buscá un alumno o abrí una PPS para trabajar sobre toda su nómina. Desde acá podés
            registrar una penalización o una desaprobación institucional.
          </p>
        </div>
        <div className="pen-mode-tabs" role="tablist" aria-label="Tipo de búsqueda">
          <button
            type="button"
            role="tab"
            className="pen-mode-tab"
            aria-selected={searchMode === "student"}
            onClick={() => changeMode("student")}
          >
            <span className="material-icons" aria-hidden="true">
              person_search
            </span>
            Alumno
          </button>
          <button
            type="button"
            role="tab"
            className="pen-mode-tab"
            aria-selected={searchMode === "pps"}
            onClick={() => changeMode("pps")}
          >
            <span className="material-icons" aria-hidden="true">
              groups
            </span>
            PPS
          </button>
        </div>
      </div>

      <div className="pen-entry-body">
        {searchMode === "student" ? (
          <div role="tabpanel">
            <span className="pen-search-label">Buscar alumno</span>
            <div className="pen-unified-search">
              <AdminSearch
                onStudentSelect={handleStudentSelect}
                isTestingMode={isTestingMode}
                placeholder="Nombre o legajo del alumno…"
              />
            </div>
            {!selectedSearchStudent ? (
              <p className="pen-search-help">
                Elegí un resultado para ver las acciones disponibles.
              </p>
            ) : (
              <div className="pen-target">
                <div className="pen-target-id">
                  <span className="pen-target-icon">
                    <span className="material-icons" aria-hidden="true">
                      person
                    </span>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="pen-target-name">{selectedSearchStudent.nombre}</div>
                    <div className="pen-target-meta">Legajo {selectedSearchStudent.legajo}</div>
                  </div>
                </div>
                <div className="pen-target-actions">
                  <button
                    type="button"
                    className="pen-target-action pen-target-action-danger"
                    onClick={() => onDisapprove(selectedSearchStudent)}
                  >
                    <span className="material-icons" aria-hidden="true">
                      report
                    </span>
                    Desaprobar PPS
                  </button>
                  <button
                    type="button"
                    className="pen-target-action"
                    onClick={() => onPenalty(selectedSearchStudent)}
                  >
                    <span className="material-icons" aria-hidden="true">
                      gavel
                    </span>
                    Otra penalización
                  </button>
                  <button
                    type="button"
                    className="pen-target-clear"
                    onClick={() => setSelectedSearchStudent(null)}
                    aria-label="Quitar alumno seleccionado"
                  >
                    <span className="material-icons" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div role="tabpanel">
            <label className="pen-search-label" htmlFor="pen-pps-search">
              Buscar PPS
            </label>
            <div className="pen-search-wrap" ref={ppsSearchRef}>
              <div className="pen-pps-search-control">
                <span className="pen-search-icon">
                  <span className="material-icons" aria-hidden="true">
                    search
                  </span>
                </span>
                <input
                  ref={ppsInputRef}
                  id="pen-pps-search"
                  className="pen-search-input"
                  value={ppsSearchTerm}
                  onChange={(event) => {
                    setPpsSearchTerm(event.target.value);
                    setSelectedPps(null);
                    setIsPpsDropdownOpen(true);
                  }}
                  onFocus={() => setIsPpsDropdownOpen(true)}
                  placeholder="Nombre de la PPS…"
                  autoComplete="off"
                />
                {ppsSearchQuery.isFetching ? <span className="pen-search-spinner" /> : null}
              </div>

              {showPpsDropdown ? (
                <div className="pen-search-results">
                  {ppsSearchQuery.isError ? (
                    <div className="pen-search-feedback">No se pudo realizar la búsqueda.</div>
                  ) : ppsSearchQuery.data && ppsSearchQuery.data.length > 0 ? (
                    <ul>
                      {ppsSearchQuery.data.map((pps) => (
                        <li key={pps.id}>
                          <button
                            type="button"
                            className="pen-pps-result"
                            onClick={() => {
                              setSelectedPps(pps);
                              setPpsSearchTerm(pps.name);
                              setIsPpsDropdownOpen(false);
                            }}
                          >
                            <span className="pen-pps-result-main">
                              <span className="pen-pps-result-name">{pps.name}</span>
                              <span className="pen-pps-result-meta">
                                {formatPpsMeta(pps) || "Sin fecha informada"}
                              </span>
                            </span>
                            <span className="material-icons" aria-hidden="true">
                              arrow_forward
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : ppsSearchQuery.isFetching ? (
                    <div className="pen-search-feedback">Buscando PPS…</div>
                  ) : (
                    <div className="pen-search-feedback">
                      No encontramos una PPS con ese nombre.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {!selectedPps ? (
              <p className="pen-search-help">
                Escribí al menos dos caracteres y elegí una PPS para abrir su nómina.
              </p>
            ) : (
              <>
                <div className="pen-target">
                  <div className="pen-target-id">
                    <span className="pen-target-icon">
                      <span className="material-icons" aria-hidden="true">
                        clinical_notes
                      </span>
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="pen-target-name">{selectedPps.name}</div>
                      <div className="pen-target-meta">
                        {formatPpsMeta(selectedPps) || "PPS seleccionada"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pen-target-clear"
                    onClick={clearSelectedPps}
                    aria-label="Cambiar PPS"
                  >
                    <span className="material-icons" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>

                <div className="pen-roster" aria-live="polite">
                  <div className="pen-roster-head">
                    <div>
                      <h3>Nómina de la PPS</h3>
                      <p>Podés desaprobar varios alumnos sin volver a buscar la PPS.</p>
                    </div>
                    {!rosterQuery.isLoading ? (
                      <span className="pen-roster-count">
                        {rosterQuery.data?.length || 0} alumnos
                      </span>
                    ) : null}
                  </div>

                  {rosterQuery.isLoading ? (
                    <div className="pen-roster-list" aria-label="Cargando nómina">
                      <div className="pen-roster-skeleton" />
                      <div className="pen-roster-skeleton" />
                      <div className="pen-roster-skeleton" />
                    </div>
                  ) : rosterQuery.isError ? (
                    <div className="pen-inline-error">No se pudo cargar la nómina de esta PPS.</div>
                  ) : rosterQuery.data && rosterQuery.data.length > 0 ? (
                    <div className="pen-roster-list">
                      {rosterQuery.data.map((student) => {
                        const disapproved = isPracticeDisapproved(student.practiceState);
                        return (
                          <div className="pen-roster-row" key={student.id}>
                            <div className="pen-roster-person">
                              <div className="pen-roster-name">{student.nombre}</div>
                              <div className="pen-roster-legajo">Legajo {student.legajo}</div>
                            </div>
                            <div className="pen-roster-state">
                              <span
                                className="pen-status"
                                data-status={disapproved ? "disapproved" : "current"}
                              >
                                {student.practiceState}
                              </span>
                            </div>
                            <div className="pen-roster-hours">
                              {student.hours === null
                                ? "Sin práctica"
                                : `${student.hours} h cargadas`}
                            </div>
                            <button
                              type="button"
                              className={`pen-target-action ${
                                student.canDisapprove ? "pen-target-action-danger" : ""
                              }`}
                              onClick={() => onDisapprove(student, selectedPps.id)}
                              disabled={!student.canDisapprove}
                            >
                              {student.canDisapprove ? "Desaprobar" : student.blockedLabel}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pen-roster-empty">
                      Esta PPS todavía no tiene alumnos seleccionados ni prácticas asociadas.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

// ─── Modal: aplicar penalización ───────────────────────────────────────────────

const AddPenaltyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  student: SelectedStudent;
  onSuccess: () => void;
  isTestingMode?: boolean;
}> = ({ isOpen, onClose, student, onSuccess, isTestingMode = false }) => {
  const [penaltyType, setPenaltyType] = useState<string>(PENALTY_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [selectedPpsId, setSelectedPpsId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: relevantPPS, isLoading: isLoadingPPS } = useQuery({
    queryKey: ["relevantPPSForModal", student.id, isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const mockRecs = (await mockDb.getAll("lanzamientos_pps")) as Record<string, unknown>[];
        return mockRecs.map((r) => ({
          id: r.id as string,
          name: `${r[FIELD_NOMBRE_PPS_LANZAMIENTOS]} (${formatDate(r[FIELD_FECHA_INICIO_LANZAMIENTOS] as string)})`,
        }));
      }

      const convocatoriasRes = await fetchAllData(
        TABLE_NAME_CONVOCATORIAS,
        [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS],
        {
          [FIELD_LEGAJO_CONVOCATORIAS]: student.legajo,
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: ["Seleccionado", "Inscripto"],
        }
      );

      const practicasRes = await fetchAllData(
        TABLE_NAME_PRACTICAS,
        [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, FIELD_ESTADO_PRACTICA],
        {
          [FIELD_NOMBRE_BUSQUEDA_PRACTICAS]: student.legajo,
          [FIELD_ESTADO_PRACTICA]: "En curso",
        }
      );

      const convocatorias = convocatoriasRes.records.map(mapConvocatoria);
      const practicas = practicasRes.records.map(mapPractica);

      const lanzamientoIds = new Set<string>();
      convocatorias.forEach((c) => {
        const ids = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
        (Array.isArray(ids) ? ids : [ids])
          .filter(Boolean)
          .forEach((id) => lanzamientoIds.add(id as string));
      });
      practicas.forEach((p) => {
        const ids = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
        (Array.isArray(ids) ? ids : [ids])
          .filter(Boolean)
          .forEach((id) => lanzamientoIds.add(id as string));
      });

      if (lanzamientoIds.size === 0) return [];

      const lanzamientosRes = await fetchAllData(
        TABLE_NAME_LANZAMIENTOS_PPS,
        [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS],
        { id: Array.from(lanzamientoIds) }
      );

      return lanzamientosRes.records.map(mapLanzamiento).map((r) => ({
        id: r.id,
        name: `${r[FIELD_NOMBRE_PPS_LANZAMIENTOS]} (${formatDate(r[FIELD_FECHA_INICIO_LANZAMIENTOS])})`,
      }));
    },
    enabled: isOpen,
  });

  const applyPenaltyMutation = useMutation({
    mutationFn: async (penaltyData: Record<string, unknown>) => {
      if (isTestingMode) {
        logger.info("TEST MODE: Applying penalty:", penaltyData);
        await mockDb.create("penalizaciones", penaltyData);
        return;
      }
      const penaltyResult = await createRecord(TABLE_NAME_PENALIZACIONES, penaltyData);
      if (penaltyResult.error) {
        const errorMsg =
          typeof penaltyResult.error.error === "string"
            ? penaltyResult.error.error
            : penaltyResult.error.error.message;
        throw new Error(`Error al crear la penalización: ${errorMsg}`);
      }

      if (selectedPpsId && TRIGGER_TYPES.includes(penaltyType)) {
        const ppsId = selectedPpsId;

        const [convocatoriasRes, practicasRes] = await Promise.all([
          fetchAllData(TABLE_NAME_CONVOCATORIAS, undefined, {
            [FIELD_LEGAJO_CONVOCATORIAS]: student.legajo,
          }),
          fetchAllData(TABLE_NAME_PRACTICAS, undefined, {
            [FIELD_NOMBRE_BUSQUEDA_PRACTICAS]: student.legajo,
          }),
        ]);

        const targetConv = convocatoriasRes.records.map(mapConvocatoria).find((c) => {
          const ids = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
          return (Array.isArray(ids) ? ids : [ids]).includes(ppsId);
        });

        const targetPractica = practicasRes.records.map(mapPractica).find((p) => {
          const ids = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
          return (Array.isArray(ids) ? ids : [ids]).includes(ppsId);
        });

        const sideEffectPromises: Promise<unknown>[] = [];
        if (targetConv) {
          sideEffectPromises.push(
            updateRecord(TABLE_NAME_CONVOCATORIAS, targetConv.id, {
              [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "No Seleccionado",
            })
          );
        }
        if (targetPractica) {
          sideEffectPromises.push(deleteRecord(TABLE_NAME_PRACTICAS, targetPractica.id));
        }
        if (sideEffectPromises.length > 0) {
          await Promise.all(sideEffectPromises);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allPenalizedStudents"] });
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleSave = () => {
    const penaltyData: Record<string, unknown> = {
      [FIELD_PENALIZACION_ESTUDIANTE_LINK]: student.id,
      [FIELD_PENALIZACION_TIPO]: penaltyType,
      [FIELD_PENALIZACION_FECHA]: new Date().toISOString().split("T")[0],
      [FIELD_PENALIZACION_NOTAS]: notes,
      [FIELD_PENALIZACION_PUNTAJE]: getPenaltyScore(penaltyType),
    };
    if (selectedPpsId) {
      penaltyData[FIELD_PENALIZACION_LANZAMIENTO_ID] = selectedPpsId;
      penaltyData[FIELD_PENALIZACION_CONVOCATORIA_LINK] =
        relevantPPS?.find((pps) => pps.id === selectedPpsId)?.name || "PPS";
    }
    applyPenaltyMutation.mutate(penaltyData);
  };

  if (!isOpen) return null;

  const triggersUnsubscribe = TRIGGER_TYPES.includes(penaltyType) && !!selectedPpsId;

  return (
    <div className="pen" onClick={onClose}>
      <div className="pen-modal-bg">
        <div className="pen-modal" onClick={(e) => e.stopPropagation()}>
          <div className="pen-modal-head">
            <span className="eyebrow">Nueva penalización</span>
            <h3>{student.nombre}</h3>
          </div>

          <div className="pen-modal-body">
            <div>
              <label htmlFor="pps-select-modal" className="pen-label">
                PPS afectada (opcional)
              </label>
              {isLoadingPPS ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Cargando PPS…</p>
              ) : (
                <select
                  id="pps-select-modal"
                  className="pen-field"
                  value={selectedPpsId}
                  onChange={(e) => setSelectedPpsId(e.target.value)}
                >
                  <option value="">Sin PPS específica…</option>
                  {relevantPPS?.map((pps: { id: string; name: string }) => (
                    <option key={pps.id} value={pps.id}>
                      {pps.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="penalty-type-modal" className="pen-label">
                Tipo de incumplimiento
              </label>
              <select
                id="penalty-type-modal"
                className="pen-field"
                value={penaltyType}
                onChange={(e) => setPenaltyType(e.target.value)}
              >
                {PENALTY_TYPES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="penalty-notes-modal" className="pen-label">
                Notas (opcional)
              </label>
              <textarea
                id="penalty-notes-modal"
                className="pen-field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contexto del incumplimiento…"
              />
            </div>

            {triggersUnsubscribe && (
              <div className="pen-hint">
                <span className="material-icons">info</span>
                <span>
                  Este tipo da de baja automáticamente la inscripción o práctica del alumno en la
                  PPS seleccionada.
                </span>
              </div>
            )}
          </div>

          <div className="pen-modal-foot">
            <button onClick={onClose} className="pen-btn">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={applyPenaltyMutation.isPending}
              className="pen-btn pen-btn-primary"
            >
              {applyPenaltyMutation.isPending ? "Guardando…" : "Aplicar penalización"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tarjeta de alumno penalizado ──────────────────────────────────────────────

const PenalizedStudentCard: React.FC<{
  student: PenalizedStudent;
  onDeleteRequest: (penaltyId: string) => void;
  deletingId: string | null;
}> = ({ student, onDeleteRequest, deletingId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sev = useMemo(() => severityOf(student.totalScore), [student.totalScore]);

  return (
    <div className="pen-card" data-sev={sev}>
      <button
        className="pen-card-head"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        aria-controls={`penalties-for-${student.legajo}`}
      >
        <div className="pen-id">
          <span className="pen-sev-ico" data-sev={sev}>
            <span className="material-icons">{severityMeta[sev].icon}</span>
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="pen-name">{student.nombre}</div>
            <div className="pen-legajo">Legajo {student.legajo}</div>
          </div>
        </div>
        <div className="pen-score-wrap">
          <div className="pen-score">
            <div className="num" data-sev={sev}>
              {student.totalScore}
            </div>
            <div className="lbl">{severityMeta[sev].label}</div>
          </div>
          <span className={`material-icons pen-chev ${isExpanded ? "open" : ""}`}>expand_more</span>
        </div>
      </button>

      {isExpanded && (
        <div id={`penalties-for-${student.legajo}`} className="pen-detail">
          <h4>Historial de incumplimientos</h4>
          {student.penalties.map((p) => (
            <div key={p.id} className="pen-item">
              <span className="pen-item-ico">
                <span className="material-icons">
                  {getPenaltyIcon(p[FIELD_PENALIZACION_TIPO] ?? undefined)}
                </span>
              </span>
              <div className="pen-item-body">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div className="pen-item-tipo">{p[FIELD_PENALIZACION_TIPO]}</div>
                    {p.ppsName && <div className="pen-item-pps">PPS: {p.ppsName}</div>}
                  </div>
                  <div className="pen-item-date">{formatDate(p[FIELD_PENALIZACION_FECHA])}</div>
                </div>
                {p[FIELD_PENALIZACION_NOTAS] && (
                  <div className="pen-item-notes">{p[FIELD_PENALIZACION_NOTAS]}</div>
                )}
              </div>
              {p[FIELD_PENALIZACION_PRACTICA_ID] ? null : (
                <button
                  className="pen-del"
                  onClick={() => onDeleteRequest(p.id)}
                  disabled={deletingId === p.id}
                  aria-label="Anular penalización"
                >
                  {deletingId === p.id ? (
                    <span className="pen-spin" />
                  ) : (
                    <span className="material-icons">block</span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Vista principal ────────────────────────────────────────────────────────────

interface PenalizationManagerProps {
  isTestingMode?: boolean;
}

const PenalizationManager: React.FC<PenalizationManagerProps> = ({ isTestingMode = false }) => {
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [disapprovalRequest, setDisapprovalRequest] = useState<{
    student: SelectedStudent;
    launchId?: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [penaltyToDelete, setPenaltyToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: penalizedStudents, isLoading } = useQuery<PenalizedStudent[]>({
    queryKey: ["allPenalizedStudents", isTestingMode],
    queryFn: async () => {
      let penaltiesRes: Record<string, unknown>[] = [],
        studentsRes: Record<string, unknown>[] = [],
        lanzamientosRes: Record<string, unknown>[] = [];

      if (isTestingMode) {
        [penaltiesRes, studentsRes, lanzamientosRes] = await Promise.all([
          mockDb.getAll("penalizaciones"),
          mockDb.getAll("estudiantes"),
          mockDb.getAll("lanzamientos_pps"),
        ]);
      } else {
        const [p, s, l] = await Promise.all([
          fetchAllData(TABLE_NAME_PENALIZACIONES),
          fetchAllData(TABLE_NAME_ESTUDIANTES, [
            FIELD_LEGAJO_ESTUDIANTES,
            FIELD_NOMBRE_ESTUDIANTES,
          ]),
          fetchAllData(TABLE_NAME_LANZAMIENTOS_PPS, [FIELD_NOMBRE_PPS_LANZAMIENTOS]),
        ]);
        penaltiesRes = p.records.map(mapPenalizacion);
        studentsRes = s.records.map(mapEstudiante);
        lanzamientosRes = l.records.map(mapLanzamiento);
      }

      const studentsMap = new Map<string, { legajo: string; nombre: string }>();
      studentsRes.forEach((r) => {
        if (r[FIELD_LEGAJO_ESTUDIANTES] && r[FIELD_NOMBRE_ESTUDIANTES]) {
          studentsMap.set(r.id as string, {
            legajo: String(r[FIELD_LEGAJO_ESTUDIANTES]),
            nombre: String(r[FIELD_NOMBRE_ESTUDIANTES]),
          });
        }
      });

      const lanzamientosMap = new Map<string, string>();
      lanzamientosRes.forEach((r) => {
        if (r[FIELD_NOMBRE_PPS_LANZAMIENTOS]) {
          lanzamientosMap.set(r.id as string, String(r[FIELD_NOMBRE_PPS_LANZAMIENTOS]));
        }
      });

      const penaltiesByStudent = new Map<string, PenalizedStudent>();
      penaltiesRes.forEach((p) => {
        if (!isActivePenalty(p[FIELD_PENALIZACION_ESTADO] as string | null | undefined)) return;
        const rawStudentLink = p[FIELD_PENALIZACION_ESTUDIANTE_LINK];
        const studentId = (
          Array.isArray(rawStudentLink) ? rawStudentLink[0] : rawStudentLink
        ) as string;
        const studentInfo = studentId ? studentsMap.get(studentId) : null;
        if (!studentInfo) return;

        if (!penaltiesByStudent.has(studentId)) {
          penaltiesByStudent.set(studentId, {
            id: studentId,
            legajo: studentInfo.legajo,
            nombre: studentInfo.nombre,
            totalScore: 0,
            penalties: [],
          });
        }
        const studentData = penaltiesByStudent.get(studentId)!;
        const rawPpsLink = p[FIELD_PENALIZACION_LANZAMIENTO_ID];
        const ppsId = (Array.isArray(rawPpsLink) ? rawPpsLink[0] : rawPpsLink) as
          | string
          | undefined;
        const fallbackPpsName = p[FIELD_PENALIZACION_CONVOCATORIA_LINK] as string | undefined;

        studentData.penalties.push({
          ...(p as Penalizacion & { id: string }),
          ppsName: (ppsId ? lanzamientosMap.get(ppsId) : undefined) || fallbackPpsName,
        });
        studentData.totalScore += (p[FIELD_PENALIZACION_PUNTAJE] as number) || 0;
      });
      return Array.from(penaltiesByStudent.values()).sort((a, b) => b.totalScore - a.totalScore);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (penaltyId: string) => {
      const voidData = {
        [FIELD_PENALIZACION_ESTADO]: "Anulada",
        [FIELD_PENALIZACION_ANULADA_AT]: new Date().toISOString(),
        [FIELD_PENALIZACION_ANULACION_MOTIVO]: "Anulada desde el gestor de penalizaciones",
      };
      if (isTestingMode) return mockDb.update("penalizaciones", penaltyId, voidData);
      return updateRecord(TABLE_NAME_PENALIZACIONES, penaltyId, voidData);
    },
    onSuccess: () => {
      setToastInfo({
        message: "Penalización anulada; el registro se conserva en auditoría.",
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["allPenalizedStudents"] });
    },
    onError: () => {
      setToastInfo({ message: "Error al anular la penalización.", type: "error" });
    },
    onSettled: () => {
      setDeletingId(null);
      setPenaltyToDelete(null);
    },
  });

  const confirmDelete = () => {
    if (penaltyToDelete) {
      setDeletingId(penaltyToDelete);
      deleteMutation.mutate(penaltyToDelete);
    }
  };

  const handlePenaltyRequest = useCallback((student: SelectedStudent) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  }, []);

  const handleDisapprovalRequest = useCallback((student: SelectedStudent, launchId?: string) => {
    setDisapprovalRequest({ student, launchId });
  }, []);

  const totalPenalties = useMemo(
    () => (penalizedStudents || []).reduce((sum, s) => sum + s.penalties.length, 0),
    [penalizedStudents]
  );

  return (
    <div className="pen">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {selectedStudent && (
        <AddPenaltyModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          student={selectedStudent}
          onSuccess={() =>
            setToastInfo({ message: "Penalización aplicada con éxito.", type: "success" })
          }
          isTestingMode={isTestingMode}
        />
      )}

      {disapprovalRequest ? (
        <DesaprobacionPPSModal
          isOpen
          student={disapprovalRequest.student}
          launchId={disapprovalRequest.launchId}
          onClose={() => setDisapprovalRequest(null)}
          onSuccess={(result) => {
            queryClient.invalidateQueries({ queryKey: ["penaltyPpsRoster"] });
            setToastInfo({
              message: result.emailSent
                ? result.emailKind === "informe_institucional"
                  ? "PPS desaprobada. El informe institucional fue enviado con copia a Agostina."
                  : "PPS desaprobada. El aviso por inasistencia fue enviado con copia a Agostina."
                : `La PPS quedó desaprobada, pero el correo no pudo enviarse${
                    result.emailMessage ? `: ${result.emailMessage}` : "."
                  }`,
              type: result.emailSent ? "success" : "error",
            });
          }}
        />
      ) : null}

      <ConfirmModal
        isOpen={!!penaltyToDelete}
        title="Anular penalización"
        message="¿Seguro que querés anular este registro? Dejará de afectar el puntaje, pero seguirá disponible en la auditoría."
        onConfirm={confirmDelete}
        onClose={() => setPenaltyToDelete(null)}
        confirmText="Anular"
        cancelText="Cancelar"
        type="danger"
      />

      <PenaltyEntryPanel
        isTestingMode={isTestingMode}
        onPenalty={handlePenaltyRequest}
        onDisapprove={handleDisapprovalRequest}
        onError={(message) => setToastInfo({ message, type: "error" })}
      />

      {/* Listado */}
      <div className="pen-list-head">
        <span className="eyebrow">
          Alumnos sancionados{penalizedStudents ? ` · ${penalizedStudents.length}` : ""}
          {totalPenalties > 0 ? ` · ${totalPenalties} registros` : ""}
        </span>
        <div className="pen-legend">
          <span>
            <span className="dot" style={{ background: "var(--warn)" }} /> Crítico ≥ 21
          </span>
          <span>
            <span className="dot" style={{ background: "var(--warn)", opacity: 0.5 }} /> Medio ≥ 11
          </span>
          <span>
            <span className="dot" style={{ background: "var(--ink-4)" }} /> Leve
          </span>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader />
        </div>
      ) : penalizedStudents && penalizedStudents.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 14,
          }}
        >
          {penalizedStudents.map((student) => (
            <PenalizedStudentCard
              key={student.id}
              student={student}
              onDeleteRequest={setPenaltyToDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="verified_user"
          title="Sin penalizaciones"
          message="No hay estudiantes con penalizaciones registradas."
        />
      )}
    </div>
  );
};

export default PenalizationManager;
