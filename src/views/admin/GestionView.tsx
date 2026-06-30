/**
 * GestionView — Workspace de coordinación (Paper & Ink editorial)
 *
 * Bandeja de trabajo del coordinador, alimentada por datos reales de Supabase
 * (useGestionConvocatorias) y el plan del agente Hermes (agent_suggestions):
 *   · 5 pestañas: Hoy (bandeja unificada) · Seguimiento (CRM por estado) ·
 *     Instituciones · Calendario · Contactos (clasificación WhatsApp).
 *   · "Hoy" fusiona en una sola lista: correos a responder, solicitudes a
 *     gestionar (MailPanel / SolicitudActionPanel) y el ciclo de vida de las
 *     instituciones (InstitucionActionPanel), todo en el panel derecho.
 *   · Rail contextual (solo en Seguimiento e Instituciones) con categorías.
 *   · Ficha rica + modales (ContactModal, EditInstitución, ReminderForm,
 *     ConfirmStateChange) que escriben en la base real.
 *
 * Hermes permanece en shadow mode: solo propone texto; nunca envía ni cambia
 * estados por su cuenta.
 */
import React, { lazy, Suspense, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useGestionConvocatorias } from "../../hooks/useGestionConvocatorias";
import { useGmailHilos, matchesGmailFilter } from "../../hooks/useGmailHilos";
import type { GmailHilo, GmailFilter } from "../../hooks/useGmailHilos";
import { useFichaSize } from "../../hooks/useFichaSize";
import {
  getThreadsWithDraft,
  generatePendingDrafts,
  planToday,
  modifyThread,
  type GmailAction,
} from "../../services/gmailService";
import type { AccionDia, SolicitudOutreach } from "../../services/hermesPlan";
import { useInstitucionContexto } from "../../hooks/useInstitucionContexto";
import type { ConversationEntry, HermesResumen } from "../../hooks/useInstitucionContexto";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS,
} from "../../constants";
import {
  formatDate,
  getWhatsAppUrl,
  normalizeStringForComparison,
  parseToUTCDate,
} from "../../utils/formatters";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { supabase } from "../../lib/supabaseClient";
import { mockDb } from "../../services/mockDb";
import type { LanzamientoPPS } from "../../types";
import {
  STATE_META,
  STATE_TO_DB,
  dbToUiState,
  CATEGORIES,
  HOY_STATES,
  HOY_ORDER,
  nextActionFor,
  type UiState,
  type CatId,
  type CatDef,
  type MissingFlag,
  type BandejaItem,
  type InstitutionVM,
  type SortKey,
  type FilterOption,
  type ViewMode,
} from "./gestion/gestionTypes";
import { orientSlug, buildItems, buildInstitutions } from "./gestion/gestionHelpers";
import { CalendarView } from "./gestion/CalendarView";
import { Rail, ViewModeTabs } from "./gestion/nav";
import { Bandeja } from "./gestion/Bandeja";
import { FichaSizeToggle } from "./gestion/FichaSizeToggle";
import { LS_GV3_RAIL_COLLAPSED, LS_GV3_MAILS_SEEN } from "../../constants/uiConstants";
import {
  ContactModal,
  EditInstitucionModal,
  ReminderForm,
  ConfirmStateChange,
} from "./gestion/modals";
import { MailsView } from "./gestion/MailsView";
import { Ficha } from "./gestion/Ficha";
import { InstitucionesView } from "./gestion/InstitucionesView";

// Contactos WhatsApp — reubicado desde "Herramientas": es supervisión de Hermes
// (revisar/validar las clasificaciones que el agente propone), por eso vive en
// Gestión y no en el Taller.
const WhatsAppContactClassifier = lazy(
  () => import("../../components/admin/WhatsAppContactClassifier")
);

const MailPanel = lazy(() => import("../../components/admin/gestion/MailPanel"));
const HermesFlow = lazy(() => import("../../components/admin/gestion/HermesFlow"));
type CardDescriptor = import("../../components/admin/gestion/HermesFlow").CardDescriptor;
type CardBadge = import("../../components/admin/gestion/HermesFlow").CardBadge;
const SolicitudActionPanel = lazy(
  () => import("../../components/admin/gestion/SolicitudActionPanel")
);
const InstitucionActionPanel = lazy(
  () => import("../../components/admin/gestion/InstitucionActionPanel")
);

// ─── CSS scoped (Paper & Ink · workspace de tres paneles) ───────────────────

const CSS = `
.gestion-v3 {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule:#1413100F; --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-soft:#1F3A8A14;
  --warn:#B4501E; --warn-soft:#B4501E14;
  --ok:#2F5F3A; --ok-soft:#2F5F3A14;
  --ai:#5A2D86; --ai-soft:#5A2D8612;
  --state-porContactar:var(--warn); --state-porContactar-soft:var(--warn-soft);
  --state-reinsistir:var(--warn); --state-reinsistir-soft:var(--warn-soft);
  --state-esperandoRespuesta:var(--accent); --state-esperandoRespuesta-soft:var(--accent-soft);
  --state-pendienteDecision:var(--ai); --state-pendienteDecision-soft:var(--ai-soft);
  --state-confirmada:var(--ok); --state-confirmada-soft:var(--ok-soft);
  --state-porFinalizar:var(--accent); --state-porFinalizar-soft:var(--accent-soft);
  --state-activa:var(--ok); --state-activa-soft:var(--ok-soft);
  --state-indefinida:var(--ink-4); --state-indefinida-soft:#14130F0A;
  --state-archivada:var(--ink-4); --state-archivada-soft:#14130F0A;
  --orient-clinica:#3D7A4B; --orient-clinica-soft:#3D7A4B14;
  --orient-educacional:#2E5BA8; --orient-educacional-soft:#2E5BA814;
  --orient-laboral:#A66626; --orient-laboral-soft:#A6662614;
  --orient-comunitaria:#6E429E; --orient-comunitaria-soft:#6E429E14;
  --rail-w:240px; --ficha-w:380px;
  background:var(--paper); color:var(--ink);
  font-family:'Hanken Grotesk', system-ui, sans-serif;
  display:grid; grid-template-columns:auto 1fr auto;
  height:calc(100vh - 60px);
  transition:grid-template-columns .18s ease;
}
.gestion-v3.rail-collapsed{ --rail-w:58px; }
/* Tamaño del panel derecho (Ficha) — controlado por useFichaSize.
   Las 3 clases se aplican al wrapper .gestion-v3 según la decisión del hook.
   El ancho real lo manda el style inline del <aside> (width: fichaSize.width),
   que es la fuente de verdad. Las variables quedan solo como fallback. */
.gestion-v3.ficha-collapsed{ --ficha-w:48px; }
.gestion-v3.ficha-normal{ --ficha-w:380px; }
.gestion-v3.ficha-expanded{ --ficha-w:560px; }
html.dark .gestion-v3 {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule:#F2EFE810; --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-soft:#8FB1FF1A;
  --warn:#E4965D; --warn-soft:#E4965D1A;
  --ok:#88BD96; --ok-soft:#88BD961A;
  --ai:#C9A4F2; --ai-soft:#C9A4F212;
  --state-indefinida-soft:#F2EFE810; --state-archivada-soft:#F2EFE810;
  --orient-clinica:#88BD96; --orient-clinica-soft:#88BD9614;
  --orient-educacional:#8FB1FF; --orient-educacional-soft:#8FB1FF1A;
  --orient-laboral:#E4965D; --orient-laboral-soft:#E4965D14;
  --orient-comunitaria:#C9A4F2; --orient-comunitaria-soft:#C9A4F214;
}
@media (max-width:1280px){ .gestion-v3{ --rail-w:220px; } .gestion-v3.rail-collapsed{ --rail-w:58px; } }
@media (max-width:1100px){ .gestion-v3{ grid-template-columns:auto 1fr; } .gestion-v3 .gv3-ficha{ display:none; } }
.gestion-v3.contactos-mode{ grid-template-columns:auto 1fr; }
.gestion-v3.contactos-mode .gv3-ficha{ display:none; }
.gestion-v3.contactos-mode .gv3-center{ overflow:hidden; }
/* Rail contextual: solo Bandeja e Instituciones lo usan. En el resto se oculta
   y el workspace pasa a 2 columnas (centro + ficha). */
.gestion-v3.rail-hidden{ grid-template-columns:1fr auto; transition:grid-template-columns .18s ease; }
.gestion-v3.rail-hidden.contactos-mode{ grid-template-columns:1fr; }
@media (max-width:1100px){ .gestion-v3.rail-hidden{ grid-template-columns:1fr; } }

.gestion-v3 .gv3-rail{ width:var(--rail-w); border-right:1px solid var(--rule-2); overflow-y:auto; overflow-x:hidden; background:var(--paper); display:flex; flex-direction:column; flex-shrink:0; transition:width .18s ease; }
.gestion-v3 .gv3-center{ overflow-y:auto; display:flex; flex-direction:column; min-width:0; position:relative; }
.gestion-v3 .gv3-ficha{ border-left:1px solid var(--rule-2); overflow-y:auto; overflow-x:hidden; background:var(--paper); position:relative; display:flex; flex-direction:column; flex-shrink:0; transition:width .2s ease, background .12s ease; }
.gestion-v3 .gv3-ficha-chrome{ position:sticky; top:0; z-index:5; display:flex; justify-content:flex-end; align-items:center; padding:8px 12px; border-bottom:1px solid var(--rule-2); background:var(--paper); }
.gestion-v3 .gv3-ficha-body{ flex:1 1 auto; min-height:0; }
.gestion-v3.ficha-collapsed .gv3-ficha-body{ display:none; }
.gestion-v3.ficha-collapsed .gv3-ficha{ background:transparent; border-left-color:transparent; }
.gestion-v3.ficha-collapsed .gv3-ficha-chrome{ padding:8px 0; justify-content:center; border-bottom-color:transparent; }
.gestion-v3.ficha-collapsed .ficha-size-toggle{ flex-direction:column; padding:4px; gap:0; border-radius:10px; }
.gestion-v3.ficha-collapsed .ficha-size-toggle .ficha-size-btn{ width:32px; height:32px; border-radius:0; }
.gestion-v3.ficha-collapsed .ficha-size-toggle .ficha-size-btn:first-child{ border-radius:7px 7px 0 0; }
.gestion-v3.ficha-collapsed .ficha-size-toggle .ficha-size-btn:last-of-type{ border-radius:0 0 7px 0; }
.gestion-v3.ficha-collapsed .ficha-size-toggle .ficha-size-reset{ border-top:1px solid var(--rule-2); border-radius:0 0 7px 7px; padding:6px 0; width:32px; margin-left:0; }

.gestion-v3 .serif{ font-weight:700; letter-spacing:-0.025em; }
.gestion-v3 .serif em{ font-style:normal; font-weight:700; color:var(--accent); }
.gestion-v3 .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums; }
.gestion-v3 .eyebrow{ font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; font-weight:600; color:var(--ink-3); }
.gestion-v3 .label{ font-size:11px; letter-spacing:0.06em; text-transform:uppercase; font-weight:600; color:var(--ink-3); }
.gestion-v3 .meta{ font-size:12px; color:var(--ink-3); font-variant-numeric:tabular-nums; }

.gestion-v3 .btn{ display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:500; padding:8px 14px; border-radius:8px; border:1px solid var(--rule-2); background:transparent; color:var(--ink); transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; cursor:pointer; font-family:inherit; line-height:1; }
.gestion-v3 .btn:hover{ background:var(--paper-2); border-color:var(--rule-3); }
.gestion-v3 .btn-primary{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.gestion-v3 .btn-primary:hover{ background:var(--ink-2); border-color:var(--ink-2); }
.gestion-v3 .btn-ghost{ border-color:transparent; padding-left:8px; padding-right:8px; }
.gestion-v3 .btn-ghost:hover{ background:var(--rule-2); color:var(--ink); border-color:transparent; }
.gestion-v3 .btn-sm{ font-size:12px; padding:6px 10px; }
.gestion-v3 .btn-wa{ background:#2F8F4314; color:#2F8F43; border-color:transparent; }
.gestion-v3 .btn-wa:hover{ background:#2F8F43; color:var(--paper); border-color:#2F8F43; }
.gestion-v3 .btn-ai{ background:var(--ai-soft); color:var(--ai); border-color:transparent; }
.gestion-v3 .btn-ai:hover{ background:var(--ai); color:var(--paper); border-color:var(--ai); }

.gestion-v3 .dot{ width:8px; height:8px; border-radius:999px; display:inline-block; }
.gestion-v3 .dot-warn{ background:var(--warn); }
.gestion-v3 .dot-accent{ background:var(--accent); }
.gestion-v3 .dot-ok{ background:var(--ok); }
.gestion-v3 .dot-ai{ background:var(--ai); }
.gestion-v3 .dot-mute{ background:var(--ink-4); }
@keyframes gv3-pulse{ 0%,100%{ opacity:1; transform:scale(1);} 50%{ opacity:.5; transform:scale(1.5);} }
.gestion-v3 .dot-live{ position:relative; }
.gestion-v3 .dot-live::after{ content:''; position:absolute; inset:-3px; border-radius:999px; border:1px solid currentColor; opacity:.4; animation:gv3-pulse 2s infinite; }
@keyframes gv3-shimmer{ 0%{ background-position:-200% 0;} 100%{ background-position:200% 0;} }
.gestion-v3 .shimmer{ background:linear-gradient(90deg, var(--ai-soft) 25%, var(--ai-soft) 37%, transparent 63%); background-size:200% 100%; animation:gv3-shimmer 1.4s ease infinite; }

.gestion-v3 .chip{ display:inline-flex; align-items:center; gap:6px; padding:3px 9px; border-radius:999px; font-size:11px; font-weight:600; line-height:1; white-space:nowrap; background:var(--paper-2); color:var(--ink-2); border:1px solid var(--rule-2); }
.gestion-v3 .chip-status{ display:inline-flex; align-items:center; gap:6px; padding:3px 9px 3px 7px; border-radius:999px; font-size:11px; font-weight:600; line-height:1; white-space:nowrap; border:1px solid transparent; }
.gestion-v3 .chip-status[data-state="porContactar"]{ background:var(--state-porContactar-soft); color:var(--state-porContactar); }
.gestion-v3 .chip-status[data-state="reinsistir"]{ background:var(--state-reinsistir-soft); color:var(--state-reinsistir); }
.gestion-v3 .chip-status[data-state="esperandoRespuesta"]{ background:var(--state-esperandoRespuesta-soft); color:var(--state-esperandoRespuesta); }
.gestion-v3 .chip-status[data-state="pendienteDecision"]{ background:var(--state-pendienteDecision-soft); color:var(--state-pendienteDecision); }
.gestion-v3 .chip-status[data-state="confirmada"]{ background:var(--state-confirmada-soft); color:var(--state-confirmada); }
.gestion-v3 .chip-status[data-state="porFinalizar"]{ background:var(--state-porFinalizar-soft); color:var(--state-porFinalizar); }
.gestion-v3 .chip-status[data-state="activa"]{ background:var(--state-activa-soft); color:var(--state-activa); }
.gestion-v3 .chip-status[data-state="indefinida"]{ background:var(--state-indefinida-soft); color:var(--ink-2); }
.gestion-v3 .chip-status[data-state="archivada"]{ background:var(--state-archivada-soft); color:var(--ink-3); }
.gestion-v3 .chip-status .dot{ width:6px; height:6px; }

.gestion-v3 .chip-orient{ display:inline-flex; align-items:center; gap:6px; padding:3px 9px 3px 7px; border-radius:999px; font-size:11px; font-weight:600; line-height:1; white-space:nowrap; background:var(--paper-2); color:var(--ink-2); }
.gestion-v3 .chip-orient::before{ content:''; width:6px; height:6px; border-radius:999px; background:var(--ink-4); }
.gestion-v3 .chip-orient[data-orient="clinica"]{ background:var(--orient-clinica-soft); color:var(--orient-clinica); }
.gestion-v3 .chip-orient[data-orient="clinica"]::before{ background:var(--orient-clinica); }
.gestion-v3 .chip-orient[data-orient="educacional"]{ background:var(--orient-educacional-soft); color:var(--orient-educacional); }
.gestion-v3 .chip-orient[data-orient="educacional"]::before{ background:var(--orient-educacional); }
.gestion-v3 .chip-orient[data-orient="laboral"]{ background:var(--orient-laboral-soft); color:var(--orient-laboral); }
.gestion-v3 .chip-orient[data-orient="laboral"]::before{ background:var(--orient-laboral); }
.gestion-v3 .chip-orient[data-orient="comunitaria"]{ background:var(--orient-comunitaria-soft); color:var(--orient-comunitaria); }
.gestion-v3 .chip-orient[data-orient="comunitaria"]::before{ background:var(--orient-comunitaria); }

.gestion-v3 .flag-missing{ display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:4px; background:var(--warn-soft); color:var(--warn); font-size:10px; font-weight:600; line-height:1.4; white-space:nowrap; border:1px solid #B4501E22; }
.gestion-v3 .flag-missing .material-icons{ font-size:11px; }
.gestion-v3 .flag-unclassified{ display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:4px; background:var(--rule-2); color:var(--ink-3); font-size:10px; font-weight:600; line-height:1.4; white-space:nowrap; border:1px solid var(--rule-3); }
.gestion-v3 .flag-unclassified .material-icons{ font-size:11px; }
.gestion-v3 .flag-icon{ display:inline-flex; align-items:center; justify-content:center; width:23px; height:23px; border-radius:7px; background:var(--warn-soft); color:var(--warn); border:1px solid #B4501E22; transition:transform .12s ease; }
.gestion-v3 .flag-icon:hover{ transform:translateY(-1px); }
.gestion-v3 .flag-icon .material-icons{ font-size:13px; }
.gestion-v3 .flag-complete{ display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:var(--ok); white-space:nowrap; }
.gestion-v3 .flag-complete .material-icons{ font-size:14px; }
.gestion-v3 .inst-search{ position:relative; flex:1 1 260px; min-width:220px; }
.gestion-v3 .inst-search > .material-icons{ position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:17px; color:var(--ink-4); pointer-events:none; }
.gestion-v3 .inst-search input{ width:100%; padding:9px 12px 9px 36px; border-radius:9px; border:1px solid var(--rule-2); background:var(--paper); color:var(--ink); font-size:13px; font-family:inherit; transition:border-color .12s ease; }
.gestion-v3 .inst-search input:focus{ outline:none; border-color:var(--ink); }
.gestion-v3 .inst-search input::placeholder{ color:var(--ink-4); }
.gestion-v3 .inst-act{ display:inline-flex; align-items:center; justify-content:center; width:29px; height:29px; border-radius:8px; border:none; background:transparent; cursor:pointer; color:var(--ink-3); transition:background .12s ease, color .12s ease; }
.gestion-v3 .inst-act:hover{ background:var(--rule-2); }
.gestion-v3 .inst-act .material-icons{ font-size:16px; }
.gestion-v3 .inst-act-wa:hover{ color:#2F8F43; }
.gestion-v3 .inst-act-mail:hover{ color:var(--accent); }
.gestion-v3 .filter-dd{ position:relative; }
.gestion-v3 .filter-trigger{ display:inline-flex; align-items:center; gap:7px; padding:8px 11px; border-radius:9px; border:1px solid var(--rule-2); background:var(--paper); color:var(--ink-2); font-size:12.5px; font-weight:500; font-family:inherit; cursor:pointer; line-height:1; transition:border-color .12s ease, background .12s ease; white-space:nowrap; }
.gestion-v3 .filter-trigger:hover{ border-color:var(--rule-3); background:var(--paper-2); }
.gestion-v3 .filter-trigger.active{ background:var(--ink); border-color:var(--ink); color:var(--paper); }
.gestion-v3 .filter-trigger .filter-caret{ font-size:16px; margin-left:1px; color:var(--ink-4); transition:transform .15s ease; }
.gestion-v3 .filter-trigger.active .filter-caret{ color:var(--paper); }
.gestion-v3 .filter-trigger.open .filter-caret{ transform:rotate(180deg); }
.gestion-v3 .filter-menu{ position:absolute; top:calc(100% + 6px); right:0; z-index:60; min-width:190px; background:var(--paper); border:1px solid var(--rule-2); border-radius:12px; box-shadow:0 12px 32px rgba(20,19,16,0.14); padding:5px; animation:gv3-dd-in .13s ease; }
html.dark .gestion-v3 .filter-menu{ box-shadow:0 12px 32px rgba(0,0,0,0.5); }
@keyframes gv3-dd-in{ from{ opacity:0; transform:translateY(-4px);} to{ opacity:1; transform:translateY(0);} }
.gestion-v3 .filter-opt{ display:flex; align-items:center; gap:9px; width:100%; padding:8px 10px; border-radius:8px; border:none; cursor:pointer; font-family:inherit; font-size:13px; text-align:left; background:transparent; color:var(--ink-2); transition:background .1s ease; }
.gestion-v3 .filter-opt:hover{ background:var(--paper-2); }
.gestion-v3 .filter-opt.selected{ color:var(--ink); font-weight:600; }
.gestion-v3 .filter-opt .filter-dot{ width:8px; height:8px; border-radius:999px; background:var(--ink-4); flex-shrink:0; }
.gestion-v3 .filter-opt .filter-check{ margin-left:auto; font-size:16px; color:var(--ink); }
.gestion-v3 .filter-opt[data-orient="clinica"] .filter-dot{ background:var(--orient-clinica); }
.gestion-v3 .filter-opt[data-orient="educacional"] .filter-dot{ background:var(--orient-educacional); }
.gestion-v3 .filter-opt[data-orient="laboral"] .filter-dot{ background:var(--orient-laboral); }
.gestion-v3 .filter-opt[data-orient="comunitaria"] .filter-dot{ background:var(--orient-comunitaria); }

.gestion-v3 .rail-row{ display:grid; grid-template-columns:14px 1fr auto; gap:10px; padding:8px 14px 8px 12px; border-left:2px solid transparent; cursor:pointer; transition:background .12s ease; align-items:center; min-width:0; font-size:13px; color:var(--ink-2); background:transparent; border-top:none; border-right:none; border-bottom:none; width:100%; text-align:left; font-family:inherit; }
.gestion-v3 .rail-row:hover{ background:var(--paper-2); }
.gestion-v3 .rail-row.active{ background:var(--paper-2); border-left-color:var(--ink); color:var(--ink); font-weight:600; }
.gestion-v3 .rail-row .dot{ width:7px; height:7px; }
.gestion-v3 .rail-row .count{ font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--ink-3); }
.gestion-v3 .rail-row.active .count{ color:var(--ink-2); font-weight:700; }
.gestion-v3 .rail-section-title{ padding:18px 14px 6px; }
.gestion-v3.rail-collapsed .rail-row{ grid-template-columns:1fr; justify-items:center; padding:9px 0; }
.gestion-v3.rail-collapsed .rail-label, .gestion-v3.rail-collapsed .rail-row .count, .gestion-v3.rail-collapsed .rail-hideable{ display:none !important; }

.gestion-v3 .bandeja-card{ border:1px solid var(--rule-2); border-radius:12px; background:var(--paper); padding:16px 18px; cursor:pointer; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; position:relative; }
.gestion-v3 .bandeja-card:hover{ background:var(--paper-2); border-color:var(--rule-3); }
.gestion-v3 .bandeja-card.active{ border-color:var(--ink); background:var(--paper-2); }
.gestion-v3 .bandeja-card:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
.gestion-v3 .bandeja-card.active::before{ content:''; position:absolute; left:-1px; top:14px; bottom:14px; width:3px; background:var(--ink); border-radius:999px; }

.gestion-v3 .inst-row{ display:grid; grid-template-columns:minmax(170px,1.7fr) 132px 104px minmax(128px,1.2fr) 92px 64px; gap:14px; align-items:center; padding:13px 32px; border-bottom:1px solid var(--rule); cursor:pointer; transition:background .12s ease; text-align:left; width:100%; background:transparent; border-left:3px solid transparent; border-right:none; border-top:none; font-family:inherit; }
.gestion-v3 .inst-row:hover{ background:var(--paper-2); }
.gestion-v3 .inst-row:hover .inst-actions{ opacity:1; }
.gestion-v3 .inst-row.active{ background:var(--paper-2); border-left-color:var(--ink); }
.gestion-v3 .inst-actions{ display:flex; gap:2px; justify-content:flex-end; opacity:0; transition:opacity .12s ease; }
@media (hover:none){ .gestion-v3 .inst-actions{ opacity:1; } }
.gestion-v3 .sort-header{ display:grid; grid-template-columns:minmax(170px,1.7fr) 132px 104px minmax(128px,1.2fr) 92px 64px; gap:14px; padding:10px 32px; border-bottom:1px solid var(--rule-2); position:sticky; top:0; background:var(--paper); z-index:2; }
.gestion-v3 .sort-btn{ display:inline-flex; align-items:center; gap:4px; background:none; border:none; cursor:pointer; font-family:inherit; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; font-weight:600; color:var(--ink-3); padding:0; }
.gestion-v3 .sort-btn.active{ color:var(--ink); }

/* Bandeja de correos (tabla, misma gramática visual que Instituciones) */
.gestion-v3 .mail-head{ display:grid; grid-template-columns:minmax(200px,2.4fr) 150px minmax(140px,1.3fr) 112px 104px; gap:16px; padding:10px 32px; border-bottom:1px solid var(--rule-2); position:sticky; top:0; background:var(--paper); z-index:2; }
.gestion-v3 .mail-row{ display:grid; grid-template-columns:minmax(200px,2.4fr) 150px minmax(140px,1.3fr) 112px 104px; gap:16px; align-items:center; padding:13px 32px; border-bottom:1px solid var(--rule); cursor:pointer; transition:background .12s ease; text-align:left; width:100%; background:transparent; border-left:3px solid transparent; border-right:none; border-top:none; font-family:inherit; }
.gestion-v3 .mail-row:hover{ background:var(--paper-2); }
.gestion-v3 .mail-row.active{ background:var(--paper-2); border-left-color:var(--ink); }
.gestion-v3 .mail-row:hover .mail-actions, .gestion-v3 .mail-row.active .mail-actions{ opacity:1; }
.gestion-v3 .mail-avatar{ width:34px; height:34px; border-radius:9px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; margin-top:1px; }
.gestion-v3 .mail-avatar[data-tone="warn"]{ background:var(--warn-soft); color:var(--warn); }
.gestion-v3 .mail-avatar[data-tone="accent"]{ background:var(--accent-soft); color:var(--accent); }
.gestion-v3 .mail-avatar .material-icons{ font-size:18px; }
.gestion-v3 .mail-state{ display:inline-flex; align-items:center; gap:6px; padding:3px 9px 3px 7px; border-radius:999px; font-size:11px; font-weight:600; line-height:1; white-space:nowrap; border:1px solid transparent; }
.gestion-v3 .mail-state[data-tone="warn"]{ background:var(--warn-soft); color:var(--warn); }
.gestion-v3 .mail-state[data-tone="accent"]{ background:var(--accent-soft); color:var(--accent); }
.gestion-v3 .mail-state .dot{ width:6px; height:6px; }
.gestion-v3 .mail-draft{ display:inline-flex; align-items:center; gap:4px; margin-top:7px; font-size:10.5px; font-weight:600; color:var(--ai); background:var(--ai-soft); border:1px solid #5A2D8622; padding:2px 8px 2px 6px; border-radius:999px; }
html.dark .gestion-v3 .mail-draft{ border-color:#C9A4F226; }
.gestion-v3 .mail-draft .material-icons{ font-size:12px; }
.gestion-v3 .mail-actions{ display:flex; gap:2px; justify-content:flex-end; opacity:0; transition:opacity .12s ease; }
@media (hover:none){ .gestion-v3 .mail-actions{ opacity:1; } }
.gestion-v3 .mail-act{ display:inline-flex; align-items:center; justify-content:center; width:29px; height:29px; border-radius:8px; border:none; background:transparent; color:var(--ink-3); cursor:pointer; transition:background .12s ease, color .12s ease; }
.gestion-v3 .mail-act:hover{ background:var(--rule-2); color:var(--ink); }
.gestion-v3 .mail-act:disabled{ opacity:.4; cursor:default; }
.gestion-v3 .mail-act-archive:hover{ color:var(--accent); }
.gestion-v3 .mail-act-trash:hover{ background:var(--warn-soft); color:var(--warn); }
.gestion-v3 .mail-act .material-icons{ font-size:16px; }
.gestion-v3 .mail-unread-slot{ width:7px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; align-self:center; }
.gestion-v3 .mail-unread-dot{ width:7px; height:7px; border-radius:999px; background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 16%, transparent); }
.gestion-v3 .mail-row.unread{ background:color-mix(in oklab, var(--accent) 3%, transparent); }
.gestion-v3 .mail-row.unread:hover{ background:var(--paper-2); }
.gestion-v3 .mail-undo{ display:flex; align-items:center; justify-content:space-between; gap:14px; margin:0 32px; padding:11px 16px; border:1px solid var(--rule-2); border-left:3px solid var(--ink-3); border-radius:10px; background:var(--paper-2); animation:gv3-dd-in .14s ease; }
.gestion-v3 .mail-undo + .mail-undo{ margin-top:8px; }
.gestion-v3 .mail-undo-btn{ display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; border:1px solid var(--rule-3); background:var(--paper); color:var(--ink); font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; transition:background .12s ease; }
.gestion-v3 .mail-undo-btn:hover{ background:var(--paper-3); }

.gestion-v3 .cal-grid{ display:grid; grid-template-columns:repeat(7,1fr); border-top:1px solid var(--rule-2); border-left:1px solid var(--rule-2); }
.gestion-v3 .cal-cell{ min-height:84px; border-right:1px solid var(--rule); border-bottom:1px solid var(--rule); padding:6px 8px; position:relative; }
.gestion-v3 .cal-cell.dim{ background:var(--paper-2); }
.gestion-v3 .cal-cell.today .cal-num{ background:var(--ink); color:var(--paper); border-radius:999px; }
.gestion-v3 .cal-num{ font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--ink-3); width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; }
.gestion-v3 .cal-ev{ display:block; font-size:10px; line-height:1.4; padding:1px 5px; border-radius:4px; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }

.gestion-v3 .field{ width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--rule-2); background:var(--paper); color:var(--ink); font-size:14px; font-family:inherit; transition:border-color .12s ease; }
.gestion-v3 .field:focus{ outline:none; border-color:var(--ink); }
.gestion-v3 .field::placeholder{ color:var(--ink-4); }
.gestion-v3 textarea.field{ resize:vertical; min-height:70px; }

.gestion-v3 .row-hover:hover{ background:var(--paper-2); }
.gestion-v3 .press:active{ transform:translateY(0.5px); }

.gestion-v3 .modal-bg{ position:fixed; inset:0; background:rgba(20,19,16,0.45); display:flex; align-items:center; justify-content:center; z-index:200; padding:24px; animation:gv3-fade .15s ease; }
@keyframes gv3-fade{ from{ opacity:0;} to{ opacity:1;} }
.gestion-v3 .modal-card{ background:var(--paper); border-radius:16px; max-width:460px; width:100%; max-height:90vh; overflow:auto; border:1px solid var(--rule-2); box-shadow:0 24px 80px rgba(20,19,16,0.2); }
.gestion-v3 .timeline-row{ display:grid; grid-template-columns:14px 1fr; gap:12px; position:relative; }
.gestion-v3 .timeline-row::before{ content:''; position:absolute; left:6px; top:16px; bottom:-8px; width:1px; background:var(--rule-2); }
.gestion-v3 .timeline-row:last-child::before{ display:none; }
.gestion-v3 .timeline-dot{ width:13px; height:13px; border-radius:999px; border:2px solid var(--paper); background:var(--ink-4); margin-top:3px; z-index:1; }
.gestion-v3 .hermes-card{ margin:16px 24px 0; padding:14px 16px; border-radius:12px; background:var(--ai-soft); border:1px solid #5A2D8626; }
html.dark .gestion-v3 .hermes-card{ border-color:#C9A4F226; }
.gestion-v3 .chat-bubble{ max-width:84%; padding:8px 11px; border-radius:12px; font-size:12.5px; line-height:1.45; color:var(--ink-2); }
.gestion-v3 .chat-in{ background:var(--paper-2); border:1px solid var(--rule); border-bottom-left-radius:3px; align-self:flex-start; }
.gestion-v3 .chat-out{ background:var(--accent-soft); border:1px solid #1F3A8A22; border-bottom-right-radius:3px; align-self:flex-end; }
.gestion-v3 .chat-marker{ align-self:center; display:inline-flex; align-items:center; gap:6px; font-size:10.5px; color:var(--ink-3); padding:3px 10px; border-radius:999px; background:var(--paper-2); border:1px solid var(--rule-2); }

/* ── FichaSizeToggle ──────────────────────────────────────────────────────
   Segmentado horizontal compacto (3 botones) que en modo "collapsed" rota a
   vertical (los iconos se apilan en una sola columna al borde del workspace). */
.gestion-v3 .ficha-size-toggle{ display:inline-flex; align-items:center; gap:1px; padding:2px; border-radius:8px; background:var(--paper-2); border:1px solid var(--rule-2); }
.gestion-v3 .ficha-size-btn{ display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; padding:0; border-radius:6px; border:none; background:transparent; color:var(--ink-3); cursor:pointer; transition:background .12s ease, color .12s ease; }
.gestion-v3 .ficha-size-btn:hover{ background:var(--rule-2); color:var(--ink-2); }
.gestion-v3 .ficha-size-btn.active{ background:var(--ink); color:var(--paper); }
.gestion-v3 .ficha-size-reset{ display:inline-flex; align-items:center; justify-content:center; width:22px; height:24px; padding:0; margin-left:2px; border:none; border-radius:6px; background:transparent; color:var(--ink-3); cursor:pointer; transition:background .12s ease, color .12s ease; }
.gestion-v3 .ficha-size-reset:hover{ background:var(--rule-2); color:var(--ink-2); }
/* Header de la ficha — el toggle vive en la esquina superior derecha */
.gestion-v3 .gv3-ficha-header{ position:sticky; top:0; z-index:2; display:flex; align-items:flex-start; justify-content:space-between; gap:8px; padding:14px 16px 10px; background:var(--paper); border-bottom:1px solid var(--rule-2); }
.gestion-v3 .gv3-ficha-body{ padding:16px; flex:1 1 auto; }

/* ── Empty state de "Hoy" en la barra derecha ─────────────────────────────
   Cuando en la pestaña Hoy/Mails NO hay tarjeta seleccionada, el panel
   derecho queda en normal (380px) y muestra este empty state. Al tocar
   una tarjeta (mail / solicitud / institución) el panel se expande a
   expanded (560px) y el empty state es reemplazado por el panel de
   acción correspondiente. Al deseleccionar, vuelve a normal y reaparece. */
.gestion-v3 .gv3-ficha-empty{ display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:6px; padding:60px 28px; color:var(--ink-3); min-height:240px; }
.gestion-v3 .gv3-ficha-empty .material-icons{ font-size:40px; color:var(--ink-4); }
.gestion-v3 .gv3-ficha-empty h3{ margin:12px 0 0; font-size:17px; font-weight:700; letter-spacing:-0.02em; color:var(--ink-2); }
.gestion-v3 .gv3-ficha-empty p{ margin:6px 0 0; font-size:12.5px; line-height:1.5; color:var(--ink-3); }
`;

injectScopedStyles("gv3-styles", CSS);

// ─── Tipos, metadatos y helpers ─────────────────────────────────────────────
// Extraídos a ./gestion/gestionTypes.ts y ./gestion/gestionHelpers.ts para
// mantener esta vista enfocada en composición y estado.

// ─── Rail (colapsable) ───────────────────────────────────────────────────────

// ─── Bandeja (extraída a ./gestion/Bandeja) ─────────────────────────────────

// ─── InstitucionesView (CRM) ─────────────────────────────────────────────────
// FilterDropdown + InstitucionesView extraídos a ./gestion/InstitucionesView

// ─── CalendarView (extraído a ./gestion/CalendarView) ──────────────────────

// ─── Ficha (extraída a ./gestion/Ficha) ────────────────────────────────────

// ─── MailsView · bandeja de correos institucionales (gmail_hilos) ────────────
// Muestra EXACTAMENTE el mismo conjunto que cuentan las tarjetas del dashboard
// "Te toca responder" y "Esperando +5 días" (misma tabla y mismos filtros).

// ─── Componente principal ────────────────────────────────────────────────────

interface GestionViewProps {
  isTestingMode?: boolean;
}

const GestionView: React.FC<GestionViewProps> = ({ isTestingMode = false }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialCat = (searchParams.get("cat") as CatId) || "porContactar";
  const [activeCat, setActiveCat] = useState<CatId>(initialCat);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = searchParams.get("view");
    if (
      v === "contactos" ||
      v === "instituciones" ||
      v === "calendario" ||
      v === "mails" ||
      v === "bandeja"
    )
      return v as ViewMode;
    // Entrada por defecto: la bandeja unificada "Hoy" (board de Hermes).
    return "mails";
  });
  const [mailFilter, setMailFilter] = useState<GmailFilter>(() => {
    const f = searchParams.get("filter");
    if (f === "esperando" || f === "esperando5d" || f === "todos") return f;
    return "esperando";
  });
  // Sub-modo de la pestaña Mails: "flujo" (Hoy con Hermes) o "lista" (todos).
  const [mailSubview, setMailSubview] = useState<"flujo" | "lista">(() =>
    searchParams.get("mails") === "lista" ? "lista" : "flujo"
  );
  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_GV3_RAIL_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [contactVm, setContactVm] = useState<InstitutionVM | null>(null);
  const [editVm, setEditVm] = useState<InstitutionVM | null>(null);
  const [reminderVm, setReminderVm] = useState<InstitutionVM | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    vm: InstitutionVM;
    newState: UiState;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; icon: string } | null>(null);

  // Permite abrir un modo o categoría concretos vía query param, p.ej. desde un
  // enlace del dashboard o una notificación de Hermes:
  //   ?view=contactos          → abre el modo Contactos (WhatsApp)
  //   ?view=mails&filter=...    → abre la bandeja de Mails con un filtro
  //   ?cat=esperandoRespuesta   → abre la bandeja en esa categoría del rail
  useEffect(() => {
    const v = searchParams.get("view");
    if (
      v === "contactos" ||
      v === "instituciones" ||
      v === "calendario" ||
      v === "mails" ||
      v === "bandeja"
    ) {
      setViewMode(v as ViewMode);
    }
    if (v === "mails") {
      const f = searchParams.get("filter");
      if (f === "esperando" || f === "esperando5d" || f === "todos") setMailFilter(f);
    }
    const cat = searchParams.get("cat");
    // Enlaces viejos a ?cat=hoy ahora van al board unificado ("Hoy").
    if (cat === "hoy") {
      setViewMode("mails");
      return;
    }
    const validCats: CatId[] = [
      "porContactar",
      "reinsistir",
      "porFinalizar",
      "pendienteDecision",
      "faltaDato",
      "esperandoRespuesta",
      "confirmada",
      "activa",
      "indefinida",
    ];
    if (cat && (validCats as string[]).includes(cat)) {
      setActiveCat(cat as CatId);
      setViewMode("bandeja");
    }
  }, [searchParams]);

  const {
    filteredData,
    institutionsMap,
    lanzamientos,
    loadingState,
    error,
    searchTerm,
    setSearchTerm,
    handleSave,
    handleUpdateInstitution,
  } = useGestionConvocatorias({ isTestingMode });

  // Bandeja de correos (gmail_hilos) — misma fuente que las tarjetas del inicio.
  const {
    data: gmailHilos = [],
    isLoading: loadingGmail,
    refetch: refetchGmail,
  } = useGmailHilos(isTestingMode);
  const [openMailHilo, setOpenMailHilo] = useState<GmailHilo | null>(null);
  // Acción de solicitud abierta en el panel derecho (Hermes ya preparó WhatsApp/email).
  const [openSolicitud, setOpenSolicitud] = useState<SolicitudOutreach | null>(null);
  // Institución abierta en el panel derecho para contactar/reinsistir (desde "Hoy").
  const [openInstVm, setOpenInstVm] = useState<InstitutionVM | null>(null);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  const [planningToday, setPlanningToday] = useState(false);
  // thread_ids con una acción de bandeja (archivar/descartar) en curso.
  const [busyThreads, setBusyThreads] = useState<Set<string>>(new Set());
  // thread_ids ocultos transitoriamente mientras corre la ventana de "Deshacer".
  const [hiddenThreads, setHiddenThreads] = useState<Set<string>>(new Set());
  // Cola de acciones deshacibles (archivar/descartar) en su ventana de 5s.
  const [undoQueue, setUndoQueue] = useState<
    { key: string; hilo: GmailHilo; action: GmailAction; label: string }[]
  >([]);
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Hilos ya vistos por el operador (indicador de no leído). Persistido localmente.
  const [seenThreads, setSeenThreads] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LS_GV3_MAILS_SEEN);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  // Tamaño del panel derecho: 3 niveles (collapsed / normal / expanded) con
  // auto-ajuste por modo + override manual persistente por modo.
  // En `mails` con un panel denso (MailPanel) → auto=expanded; en calendario
  // → auto=collapsed; resto → normal.
  const hasRichContent =
    viewMode === "mails" &&
    (Boolean(openMailHilo) || Boolean(openInstVm) || Boolean(openSolicitud));
  const fichaSize = useFichaSize({ mode: viewMode, hasRichContent });
  const persistSeen = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(LS_GV3_MAILS_SEEN, JSON.stringify([...next].slice(-500)));
    } catch {
      /* noop */
    }
  }, []);

  // Set de thread_ids que ya tienen borrador de Hermes (para el indicador ✦).
  const { data: threadsWithDraft, refetch: refetchDrafts } = useQuery({
    queryKey: ["gmailThreadsWithDraft", isTestingMode],
    enabled: !isTestingMode,
    staleTime: 60 * 1000,
    queryFn: () => getThreadsWithDraft(isTestingMode),
  });

  // Deep-link desde el Inicio: ?view=mails&thread=<id> abre ese hilo puntual en
  // el panel derecho (en vez de dejar al operador en la bandeja general). Se
  // ejecuta una vez que los hilos están cargados.
  const deepLinkedThreadRef = useRef<string | null>(null);
  useEffect(() => {
    const threadId = searchParams.get("thread");
    if (!threadId || gmailHilos.length === 0) return;
    if (deepLinkedThreadRef.current === threadId) return;
    const hilo = gmailHilos.find((h) => h.thread_id === threadId);
    if (hilo) {
      deepLinkedThreadRef.current = threadId;
      setViewMode("mails");
      setOpenSolicitud(null);
      setOpenInstVm(null);
      setOpenMailHilo(hilo);
    }
  }, [searchParams, gmailHilos]);

  const items = useMemo(
    () => buildItems(filteredData, institutionsMap),
    [filteredData, institutionsMap]
  );
  const institutions = useMemo(
    () => buildInstitutions(lanzamientos, institutionsMap, items),
    [lanzamientos, institutionsMap, items]
  );
  const instByKey = useMemo(() => {
    const m = new Map<string, InstitutionVM>();
    institutions.forEach((vm) => m.set(vm.key, vm));
    return m;
  }, [institutions]);

  // Deep-link desde el Inicio: ?view=instituciones&inst=<id> selecciona y abre
  // la ficha de esa institución (Hermes manda el id de la tabla instituciones).
  const deepLinkedInstRef = useRef<string | null>(null);
  useEffect(() => {
    const instId = searchParams.get("inst");
    if (!instId || institutions.length === 0) return;
    if (deepLinkedInstRef.current === instId) return;
    const vm = institutions.find((i) => i.id === instId);
    if (vm) {
      deepLinkedInstRef.current = instId;
      setViewMode("instituciones");
      setSelectedKey(vm.key);
    }
  }, [searchParams, institutions]);

  // Contactos WhatsApp pendientes de clasificar (propuestas de Hermes sin validar).
  // queryKey comparte raíz con la lista del clasificador (["pendingContactClassifications"])
  // para que al aprobar/descartar se invalide también este contador.
  const { data: pendingContactos = 0 } = useQuery({
    queryKey: ["pendingContactClassifications", "count", isTestingMode],
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<number> => {
      if (isTestingMode) {
        const rows = await mockDb.getAll("agent_suggestions", {
          tipo: "clasificacion",
          estado: "pending",
        });
        return rows.length;
      }
      const { count, error: cErr } = await supabase
        .from("agent_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "clasificacion")
        .eq("estado", "pending");
      if (cErr) return 0;
      return count || 0;
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    c.hoy = items.filter((it) => HOY_STATES.includes(it.state)).length;
    c.faltaDato = items.filter((it) => it.flags.length > 0).length;
    (
      [
        "porContactar",
        "reinsistir",
        "porFinalizar",
        "pendienteDecision",
        "esperandoRespuesta",
        "confirmada",
        "activa",
        "indefinida",
      ] as UiState[]
    ).forEach((s) => {
      c[s] = items.filter((it) => it.state === s).length;
    });
    return c;
  }, [items]);

  const visibleItems = useMemo(() => {
    if (activeCat === "hoy") {
      return items
        .filter((it) => HOY_STATES.includes(it.state))
        .sort((a, b) => {
          const oa = HOY_ORDER[a.state] ?? 99;
          const ob = HOY_ORDER[b.state] ?? 99;
          if (oa !== ob) return oa - ob;
          return b.daysAgo - a.daysAgo;
        });
    }
    if (activeCat === "faltaDato") return items.filter((it) => it.flags.length > 0);
    return items.filter((it) => it.state === (activeCat as UiState));
  }, [items, activeCat]);

  const selectedVm = selectedKey ? instByKey.get(selectedKey) || null : null;

  const toggleRail = useCallback(() => {
    setRailCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_GV3_RAIL_COLLAPSED, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const showToast = useCallback((msg: string, icon = "check_circle") => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const handleGenerateDrafts = useCallback(async () => {
    setGeneratingDrafts(true);
    const res = await generatePendingDrafts(10);
    setGeneratingDrafts(false);
    if (res) {
      showToast(
        res.generados > 0
          ? `Hermes preparó ${res.generados} ${res.generados === 1 ? "borrador" : "borradores"}`
          : "No había correos nuevos para responder",
        "auto_awesome"
      );
      refetchDrafts();
    } else {
      showToast("No se pudo generar borradores ahora", "error");
    }
  }, [showToast, refetchDrafts]);

  // ── Acciones de bandeja con ventana de "Deshacer" ──────────────────────────
  // El hilo se oculta al instante (optimista) y la acción real contra Gmail se
  // dispara recién a los 5s, salvo que el operador deshaga. Así "archivar" y
  // "descartar" son reversibles sin depender de un endpoint de "desarchivar".
  const UNDO_MS = 5000;

  const commitMailAction = useCallback(
    async (entry: { key: string; hilo: GmailHilo; action: GmailAction; label: string }) => {
      undoTimers.current.delete(entry.key);
      setUndoQueue((q) => q.filter((e) => e.key !== entry.key));
      if (isTestingMode) {
        setHiddenThreads((s) => {
          const next = new Set(s);
          next.delete(entry.hilo.thread_id);
          return next;
        });
        showToast("Modo demo: acción no aplicada", "info");
        return;
      }
      setBusyThreads((s) => new Set(s).add(entry.hilo.thread_id));
      const res = await modifyThread(entry.hilo.thread_id, entry.action);
      setBusyThreads((s) => {
        const next = new Set(s);
        next.delete(entry.hilo.thread_id);
        return next;
      });
      if (res.success) {
        if (res.dryRun) showToast("Modo seguro: no se aplicó el cambio", "info");
        refetchGmail();
        refetchDrafts();
      } else {
        // Falló: revelamos de nuevo el hilo y avisamos.
        setHiddenThreads((s) => {
          const next = new Set(s);
          next.delete(entry.hilo.thread_id);
          return next;
        });
        showToast(`No se pudo completar: ${res.message || "error"}`, "error");
      }
    },
    [isTestingMode, showToast, refetchGmail, refetchDrafts]
  );

  const queueMailAction = useCallback(
    (h: GmailHilo, action: GmailAction, label: string) => {
      const key = `${h.thread_id}:${Date.now()}`;
      const entry = { key, hilo: h, action, label };
      setHiddenThreads((s) => new Set(s).add(h.thread_id));
      if (openMailHilo?.thread_id === h.thread_id) setOpenMailHilo(null);
      setUndoQueue((q) => [...q, entry]);
      const timer = setTimeout(() => void commitMailAction(entry), UNDO_MS);
      undoTimers.current.set(key, timer);
    },
    [openMailHilo, commitMailAction]
  );

  const undoMailAction = useCallback((key: string, threadId: string) => {
    const timer = undoTimers.current.get(key);
    if (timer) clearTimeout(timer);
    undoTimers.current.delete(key);
    setUndoQueue((q) => q.filter((e) => e.key !== key));
    setHiddenThreads((s) => {
      const next = new Set(s);
      next.delete(threadId);
      return next;
    });
  }, []);

  const handleArchiveMail = useCallback(
    (h: GmailHilo) => queueMailAction(h, "archive", "Hilo archivado"),
    [queueMailAction]
  );

  const handleDiscardMail = useCallback(
    (h: GmailHilo) => queueMailAction(h, "trash", "Correo descartado a papelera"),
    [queueMailAction]
  );

  // Marca un hilo como leído/no leído (local + sincroniza con Gmail, best-effort).
  const toggleSeenMail = useCallback(
    (h: GmailHilo) => {
      const wasSeen = seenThreads.has(h.thread_id);
      setSeenThreads((s) => {
        const next = new Set(s);
        if (wasSeen) next.delete(h.thread_id);
        else next.add(h.thread_id);
        persistSeen(next);
        return next;
      });
      if (!isTestingMode) void modifyThread(h.thread_id, wasSeen ? "markUnread" : "markRead");
    },
    [seenThreads, persistSeen, isTestingMode]
  );

  // Al abrir un hilo, queda marcado como leído.
  const markSeen = useCallback(
    (h: GmailHilo) => {
      if (seenThreads.has(h.thread_id)) return;
      setSeenThreads((s) => {
        const next = new Set(s).add(h.thread_id);
        persistSeen(next);
        return next;
      });
    },
    [seenThreads, persistSeen]
  );

  // Limpieza de timers pendientes al desmontar (evita commits fantasma).
  useEffect(() => {
    const timers = undoTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Atajos de teclado: [ colapsa, ] normal, Shift+] expande la ficha derecha.
  // No intercepta si el foco está en un input/textarea/contenteditable.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        fichaSize.setSize("collapsed");
      } else if (e.key === "]") {
        e.preventDefault();
        if (e.shiftKey) fichaSize.setSize("expanded");
        else fichaSize.setSize("normal");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fichaSize]);

  const handlePlanToday = useCallback(async () => {
    setPlanningToday(true);
    const res = await planToday(20);
    setPlanningToday(false);
    if (res.ok) {
      showToast(
        res.acciones > 0
          ? `Hermes planificó ${res.acciones} ${res.acciones === 1 ? "acción" : "acciones"} para hoy`
          : "Hermes no detectó acciones pendientes",
        "auto_awesome"
      );
      queryClient.invalidateQueries({ queryKey: ["hermesPlan"] });
    } else {
      showToast(res.motivo, "error");
    }
  }, [showToast, queryClient]);

  const selectByItem = useCallback((item: BandejaItem) => {
    const key = normalizeStringForComparison(item.grupo);
    setSelectedKey((cur) => (cur === key ? null : key));
  }, []);

  const openContact = useCallback(
    (vmOrItem: InstitutionVM | BandejaItem) => {
      const key = "key" in vmOrItem ? vmOrItem.key : normalizeStringForComparison(vmOrItem.grupo);
      const vm = instByKey.get(key);
      if (vm) setContactVm(vm);
    },
    [instByKey]
  );

  // ── Tarjetas de CICLO DE VIDA para la bandeja única "Hoy" ──────────────────
  // Convierte los items de gestión que conviene atender hoy (HOY_STATES) en
  // tarjetas del mismo formato que el plan de Hermes. Al tocarlas, abre el
  // contacto de la institución (ContactModal) sin salir de Gestión.
  const lifecycleCards = useMemo((): CardDescriptor[] => {
    return items
      .filter((it) => HOY_STATES.includes(it.state))
      .sort(
        (a, b) => (HOY_ORDER[a.state] ?? 99) - (HOY_ORDER[b.state] ?? 99) || b.daysAgo - a.daysAgo
      )
      .map((it) => {
        const meta = STATE_META[it.state];
        const badges: CardBadge[] = [];
        if (it.phone) {
          badges.push({ text: "WhatsApp", color: "var(--ok)", icon: "chat" });
        } else {
          badges.push({ text: "sin teléfono", color: "var(--warn)", icon: "phone_disabled" });
        }
        // Urgentes (reinsistir / por finalizar) arriba junto al plan alta;
        // el resto del ciclo de vida entre media y baja del plan.
        const rank =
          it.state === "reinsistir" || it.state === "porFinalizar"
            ? 1
            : it.state === "porContactar"
              ? 3
              : 4;
        return {
          id: `life-${it.id}`,
          rank,
          tone:
            meta.dot === "warn" ? "var(--warn)" : meta.dot === "ai" ? "var(--ai)" : "var(--accent)",
          icon:
            it.state === "porFinalizar"
              ? "event_busy"
              : it.state === "reinsistir"
                ? "mark_email_unread"
                : it.state === "pendienteDecision"
                  ? "how_to_reg"
                  : "campaign",
          label: meta.label,
          titulo: it.titulo,
          porQue: it.razon,
          cta: it.phone ? "Contactar" : "Ver ficha",
          badges,
          onClick: () => {
            const key = normalizeStringForComparison(it.grupo);
            const vm = instByKey.get(key);
            if (vm) {
              if (vm.phone) {
                // Abrir el panel derecho de contacto (con chat e historial),
                // igual que el resto de las acciones de la bandeja.
                setOpenMailHilo(null);
                setOpenSolicitud(null);
                setOpenInstVm(vm);
              } else {
                setSelectedKey(key);
                setViewMode("instituciones");
              }
            }
          },
        };
      });
  }, [items, instByKey]);

  const sendWhatsApp = useCallback(
    (vm: InstitutionVM, text: string) => {
      // Validamos el teléfono con cleanWhatsAppNumber antes de abrir wa.me
      // para evitar el "contacto inexistente" que aparece cuando el número
      // no es un WhatsApp real (fijos mal cargados, números incompletos, etc).
      const url = getWhatsAppUrl(vm.phone, text);
      if (!url) {
        showToast("Este teléfono no es un WhatsApp válido", "info");
        return;
      }
      window.open(url, "_blank", "noopener");
      setContactVm(null);
      showToast("WhatsApp abierto · revisá y enviá manualmente", "chat");
    },
    [showToast]
  );

  const markWaiting = useCallback(
    async (vm: InstitutionVM) => {
      const latest = vm.launches[0];
      if (!latest) return;
      const ok = await handleSave(latest.id, {
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: STATE_TO_DB.esperandoRespuesta,
      } as Partial<LanzamientoPPS>);
      setContactVm(null);
      if (ok) showToast("Marcada como “Esperando respuesta”", "schedule_send");
    },
    [handleSave, showToast]
  );

  const saveReminder = useCallback(
    async (iso: string) => {
      if (!reminderVm) return;
      const latest = reminderVm.launches[0];
      if (!latest) return;
      setSaving(true);
      const ok = await handleSave(latest.id, {
        [FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS]: iso,
      } as Partial<LanzamientoPPS>);
      setSaving(false);
      if (ok) {
        setReminderVm(null);
        showToast(`Recordatorio para el ${formatDate(iso)}`, "alarm");
      }
    },
    [reminderVm, handleSave, showToast]
  );

  const saveInstitution = useCallback(
    async (patch: {
      telefono?: string;
      tutor?: string;
      direccion?: string;
      convenio_nuevo?: string;
    }) => {
      if (!editVm) return;
      if (editVm.id === editVm.key) {
        // No hay registro real de institución (solo se conoce por el grupo de lanzamientos)
        showToast("Esta institución no tiene ficha propia todavía", "info");
        setEditVm(null);
        return;
      }
      setSaving(true);
      const ok = await handleUpdateInstitution(editVm.id, patch);
      setSaving(false);
      if (ok) {
        setEditVm(null);
        showToast("Institución actualizada", "check_circle");
      }
    },
    [editVm, handleUpdateInstitution, showToast]
  );

  const confirmChange = useCallback(
    async (note: string) => {
      if (!pendingChange) return;
      const latest = pendingChange.vm.launches[0];
      if (!latest) return;
      setSaving(true);
      const dbValue = STATE_TO_DB[pendingChange.newState];
      const updates: Partial<LanzamientoPPS> = {
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: dbValue,
      } as Partial<LanzamientoPPS>;
      if (note.trim()) {
        const prev = (latest[FIELD_NOTAS_GESTION_LANZAMIENTOS] as string) || "";
        const stamp = new Date().toLocaleDateString("es", { day: "2-digit", month: "short" });
        (updates as any)[FIELD_NOTAS_GESTION_LANZAMIENTOS] =
          `${prev ? prev + "\n" : ""}[${stamp}] ${note.trim()}`;
      }
      const ok = await handleSave(latest.id, updates);
      setSaving(false);
      if (ok) {
        showToast(`${STATE_META[pendingChange.newState].label} · cambio registrado`, "flag");
        setPendingChange(null);
      }
    },
    [pendingChange, handleSave, showToast]
  );

  if (loadingState === "loading" || loadingState === "initial") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Loader />
      </div>
    );
  }
  if (error) {
    return <EmptyState icon="error" title="Error de carga" message={error} />;
  }

  const railApplies =
    viewMode === "mails" || viewMode === "bandeja" || viewMode === "instituciones";

  return (
    <div
      className={`gestion-v3 ${railCollapsed ? "rail-collapsed" : ""} ficha-${fichaSize.size} ${viewMode === "contactos" ? "contactos-mode" : ""} ${railApplies ? "" : "rail-hidden"}`}
    >
      {railApplies && (
        <Rail
          activeCat={viewMode === "mails" ? ("" as CatId) : activeCat}
          counts={counts}
          search={searchTerm}
          collapsed={railCollapsed}
          onToggle={toggleRail}
          onSearch={setSearchTerm}
          onSelect={(c) => {
            setActiveCat(c);
            setViewMode("bandeja");
          }}
        />
      )}

      <section
        className="gv3-center"
        onClick={(e) => {
          // Dismiss-on-empty: si hay una selección abierta en "Hoy" y el
          // usuario clickeó en el área vacía del centro (no en una tarjeta,
          // filtro, tab o control interactivo), cerramos la selección para
          // que la barra vuelva a "normal" automáticamente.
          if (!openMailHilo && !openSolicitud && !openInstVm) return;
          const t = e.target as HTMLElement | null;
          if (
            t?.closest(
              ".mail-row, .mail-head, .hermes-card, .gv3-no-close, button, a, input, select, textarea, [role=button], [data-keep-selection]"
            )
          ) {
            return;
          }
          setOpenMailHilo(null);
          setOpenSolicitud(null);
          setOpenInstVm(null);
        }}
      >
        <ViewModeTabs
          mode={viewMode}
          onChange={(m) => {
            // Al cambiar de pestaña, cerramos los paneles del modo "Hoy".
            if (m !== "mails") {
              setOpenMailHilo(null);
              setOpenSolicitud(null);
              setOpenInstVm(null);
            }
            setViewMode(m);
          }}
          badges={{
            bandeja: counts.hoy || 0,
            mails:
              gmailHilos.filter((h) => matchesGmailFilter(h, "esperando")).length +
              (counts.hoy || 0),
            instituciones: institutions.length,
            contactos: pendingContactos,
          }}
        />

        {viewMode === "bandeja" && (
          <Bandeja
            items={visibleItems}
            activeCat={activeCat}
            totalCount={items.length}
            selectedKey={selectedKey}
            onSelect={selectByItem}
            onContact={openContact}
          />
        )}
        {viewMode === "mails" && (
          <>
            {/* Toggle: Hoy con Hermes (flujo) · Todos los correos (lista) */}
            <div style={{ display: "flex", gap: 6, padding: "12px 32px 0" }}>
              {[
                { id: "flujo" as const, label: "Hoy con Hermes", icon: "auto_awesome" },
                { id: "lista" as const, label: "Todos los correos", icon: "list" },
              ].map((t) => {
                const on = mailSubview === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setMailSubview(t.id)}
                    className="press"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      fontWeight: on ? 600 : 500,
                      color: on ? (t.id === "flujo" ? "var(--ai)" : "var(--ink)") : "var(--ink-3)",
                      background: on ? "var(--paper-2)" : "transparent",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 15 }}>
                      {t.icon}
                    </span>
                    {t.label}
                  </button>
                );
              })}
            </div>
            {mailSubview === "flujo" ? (
              <Suspense
                fallback={
                  <div style={{ padding: 48, textAlign: "center" }}>
                    <Loader />
                  </div>
                }
              >
                <HermesFlow
                  hilos={gmailHilos}
                  isTestingMode={isTestingMode}
                  extraCards={lifecycleCards}
                  onOpenMail={(h) => {
                    setOpenSolicitud(null);
                    setOpenInstVm(null);
                    setOpenMailHilo(h);
                  }}
                  onOpenSolicitud={(a: AccionDia) => {
                    if (a.solicitud) {
                      setOpenMailHilo(null);
                      setOpenInstVm(null);
                      setOpenSolicitud(a.solicitud);
                    }
                  }}
                />
              </Suspense>
            ) : (
              <>
                {undoQueue.length > 0 && (
                  <div style={{ paddingTop: 16 }}>
                    {undoQueue.map((e) => (
                      <div key={e.key} className="mail-undo">
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 9,
                            minWidth: 0,
                            fontSize: 13,
                            color: "var(--ink-2)",
                          }}
                        >
                          <span
                            className="material-icons"
                            style={{ fontSize: 17, color: "var(--ink-3)" }}
                          >
                            {e.action === "trash" ? "delete_outline" : "archive"}
                          </span>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {e.label} · «{e.hilo.asunto || "(sin asunto)"}»
                          </span>
                        </span>
                        <button
                          type="button"
                          className="mail-undo-btn press"
                          onClick={() => undoMailAction(e.key, e.hilo.thread_id)}
                        >
                          <span className="material-icons" style={{ fontSize: 15 }}>
                            undo
                          </span>
                          Deshacer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <MailsView
                  hilos={gmailHilos}
                  loading={loadingGmail}
                  filter={mailFilter}
                  onFilter={setMailFilter}
                  onOpen={(h) => {
                    setOpenSolicitud(null);
                    setOpenInstVm(null);
                    setOpenMailHilo(h);
                    markSeen(h);
                  }}
                  selectedId={openMailHilo?.thread_id || null}
                  draftThreads={threadsWithDraft}
                  onGenerate={isTestingMode ? undefined : handleGenerateDrafts}
                  generating={generatingDrafts}
                  onArchive={handleArchiveMail}
                  onDiscard={handleDiscardMail}
                  onToggleSeen={toggleSeenMail}
                  busyThreads={busyThreads}
                  hiddenThreads={hiddenThreads}
                  seenThreads={seenThreads}
                />
              </>
            )}
          </>
        )}
        {viewMode === "instituciones" && (
          <InstitucionesView
            institutions={institutions}
            selectedKey={selectedKey}
            onSelect={(vm) => setSelectedKey((cur) => (cur === vm.key ? null : vm.key))}
            onContact={openContact}
          />
        )}
        {viewMode === "calendario" && (
          <CalendarView
            institutions={institutions}
            onSelectKey={(key) => {
              setSelectedKey(key);
            }}
          />
        )}
        {viewMode === "contactos" && (
          <Suspense
            fallback={
              <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                <Loader />
              </div>
            }
          >
            <WhatsAppContactClassifier isTestingMode={isTestingMode} />
          </Suspense>
        )}
      </section>

      {viewMode === "mails" ? (
        <aside className="gv3-ficha" style={{ width: fichaSize.width }}>
          <div className="gv3-ficha-chrome">
            <FichaSizeToggle
              size={fichaSize.size}
              onChange={fichaSize.setSize}
              autoActive={!fichaSize.isUserOverride}
              onReset={fichaSize.resetForMode}
            />
          </div>
          {openInstVm ? (
            <Suspense
              fallback={
                <div
                  className="gv3-ficha-body"
                  style={{ display: "flex", justifyContent: "center", padding: 48 }}
                >
                  <Loader />
                </div>
              }
            >
              <InstitucionActionPanel
                vm={openInstVm}
                isTestingMode={isTestingMode}
                onClose={() => setOpenInstVm(null)}
                onSend={(vm, text) => {
                  sendWhatsApp(vm, text);
                  setOpenInstVm(null);
                }}
                onMarkWaiting={(vm) => {
                  markWaiting(vm);
                  setOpenInstVm(null);
                }}
              />
            </Suspense>
          ) : openSolicitud ? (
            <Suspense
              fallback={
                <div
                  className="gv3-ficha-body"
                  style={{ display: "flex", justifyContent: "center", padding: 48 }}
                >
                  <Loader />
                </div>
              }
            >
              <SolicitudActionPanel
                data={openSolicitud}
                onClose={() => setOpenSolicitud(null)}
                onSent={(msg) => showToast(msg, "chat")}
                onOpenSolicitud={(id) => navigate(`/admin/solicitudes?tab=ingreso&focus=${id}`)}
              />
            </Suspense>
          ) : openMailHilo ? (
            <Suspense
              fallback={
                <div
                  className="gv3-ficha-body"
                  style={{ display: "flex", justifyContent: "center", padding: 48 }}
                >
                  <Loader />
                </div>
              }
            >
              <MailPanel
                hilo={openMailHilo}
                isTestingMode={isTestingMode}
                onClose={() => setOpenMailHilo(null)}
                onActionDone={(msg) => showToast(msg, "mail")}
                onRefetch={() => refetchGmail()}
              />
            </Suspense>
          ) : (
            <div className="gv3-ficha-body gv3-ficha-empty">
              <span className="material-icons">auto_awesome</span>
              <h3 className="serif">Elegí una acción</h3>
              <p>
                Tocá un correo, una solicitud o una institución del plan de Hermes para verla acá y
                accionar sin salir del panel.
              </p>
            </div>
          )}
        </aside>
      ) : (
        <aside className="gv3-ficha" style={{ width: fichaSize.width }}>
          <div className="gv3-ficha-chrome">
            <FichaSizeToggle
              size={fichaSize.size}
              onChange={fichaSize.setSize}
              autoActive={!fichaSize.isUserOverride}
              onReset={fichaSize.resetForMode}
            />
          </div>
          <div className="gv3-ficha-body">
            <Ficha
              vm={selectedVm}
              isTestingMode={isTestingMode}
              onChangeState={(vm, newState) => setPendingChange({ vm, newState })}
              onContact={(vm) => setContactVm(vm)}
              onReminder={(vm) => setReminderVm(vm)}
              onEdit={(vm) => setEditVm(vm)}
            />
          </div>
        </aside>
      )}

      {contactVm && (
        <ContactModal
          vm={contactVm}
          onClose={() => setContactVm(null)}
          onSend={sendWhatsApp}
          onMarkWaiting={markWaiting}
        />
      )}
      {editVm && (
        <EditInstitucionModal
          vm={editVm}
          saving={saving}
          onSave={saveInstitution}
          onClose={() => setEditVm(null)}
        />
      )}
      {reminderVm && (
        <ReminderForm
          vm={reminderVm}
          saving={saving}
          onSave={saveReminder}
          onClose={() => setReminderVm(null)}
        />
      )}
      {pendingChange && (
        <ConfirmStateChange
          vm={pendingChange.vm}
          newState={pendingChange.newState}
          saving={saving}
          onConfirm={confirmChange}
          onCancel={() => setPendingChange(null)}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 18px",
            borderRadius: 999,
            background: "var(--ink)",
            color: "var(--paper)",
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(20,19,16,0.2)",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            zIndex: 300,
          }}
        >
          <span className="material-icons" style={{ fontSize: 16 }}>
            {toast.icon}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default GestionView;
