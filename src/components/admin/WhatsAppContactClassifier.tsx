/**
 * WhatsAppContactClassifier — "Contactos" (dentro de Gestión)
 *
 * Cola de aprobación humana para la clasificación de contactos que propone
 * Hermes. El agente lee WhatsApp, detecta contactos nuevos y sugiere cómo
 * archivarlos; el coordinador revisa la evidencia (la conversación real),
 * corrige y aprueba. Al aprobar se materializa en `whatsapp_contactos`.
 *
 * Rediseño v3 (Paper & Ink): layout maestro-detalle, clasificación por chips
 * de un toque, conversación como evidencia destacada y confianza inline.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/db";
import { mockDb } from "../../services/mockDb";
import { learnFromFeedback } from "../../services/hermesLearn";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import Toast from "../ui/Toast";
import { getErrorMessage } from "../../utils/getErrorMessage";
import type { Institucion } from "../../types";

interface SuggestionPayload {
  chat_jid: string;
  phone: string;
  nombre_contacto: string;
  tipo:
    | "autoridad_uflo"
    | "institucion_con_convenio"
    | "sin_convenio"
    | "coordinador_externo"
    | "otro";
  institucion_id: string | null;
  confidence: number;
  justificacion: string;
  resumen_patron?: string;
  evidence_message_ids?: string[];
}

interface PendingSuggestion {
  id: string;
  tipo: string;
  estado: string;
  payload: SuggestionPayload;
  contexto?: unknown;
  institucion_id?: string | null;
  created_at: string;
}

interface MessageContext {
  id: string;
  texto: string;
  timestamp: string;
  from_me: boolean;
  media_tipo?: string | null;
}

interface TypeMeta {
  id: string;
  label: string;
  short: string;
  icon: string;
  tone: string; // CSS var token
  needsInstitution?: boolean;
}

const TYPE_META: TypeMeta[] = [
  {
    id: "autoridad_uflo",
    label: "Autoridad UFLO",
    short: "Autoridad",
    icon: "school",
    tone: "--ai",
  },
  {
    id: "institucion_con_convenio",
    label: "Institución con convenio",
    short: "Con convenio",
    icon: "handshake",
    tone: "--ok",
    needsInstitution: true,
  },
  {
    id: "sin_convenio",
    label: "Sin convenio · prospección",
    short: "Prospección",
    icon: "travel_explore",
    tone: "--warn",
  },
  {
    id: "coordinador_externo",
    label: "Coordinador / referente externo",
    short: "Referente",
    icon: "person",
    tone: "--accent",
    needsInstitution: true,
  },
  { id: "otro", label: "Otro / personal / spam", short: "Otro", icon: "block", tone: "--ink-4" },
];

const typeMeta = (id?: string) => TYPE_META.find((t) => t.id === id);

const CSS = `
.wcc {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  color: var(--ink); background: var(--paper);
  display: flex; flex-direction: column;
  flex: 1; min-height: 0; height: 100%;
}
.wcc-head { padding: 18px 28px 14px; border-bottom: 1px solid var(--rule-2); flex-shrink: 0; }
.wcc-eyebrow { font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; color: var(--ink-3); }
.wcc-title { margin: 4px 0 0; font-size: 22px; font-weight: 700; letter-spacing: -0.025em; color: var(--ink); }
.wcc-sub { font-size: 13px; color: var(--ink-3); margin-top: 5px; max-width: 640px; line-height: 1.45; }

.wcc-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 320px 1fr; }
@media (max-width: 980px) { .wcc-body { grid-template-columns: 1fr; } .wcc-detail { display: none; } .wcc-body.show-detail .wcc-list { display: none; } .wcc-body.show-detail .wcc-detail { display: flex; } }

/* ── List rail ── */
.wcc-list { border-right: 1px solid var(--rule-2); display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.wcc-list-head { padding: 12px 16px 8px; display: flex; align-items: baseline; justify-content: space-between; flex-shrink: 0; }
.wcc-list-head .label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; color: var(--ink-3); }
.wcc-list-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-4); }
.wcc-rows { overflow-y: auto; flex: 1; padding-bottom: 12px; }

/* Queue tools: search + confidence filters */
.wcc-queue-tools { padding: 4px 12px 10px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--rule-2); flex-shrink: 0; }
.wcc-queue-search { display: flex; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid var(--rule-2); border-radius: 9px; background: var(--paper); color: var(--ink-4); }
.wcc-queue-search:focus-within { border-color: var(--ink); color: var(--ink-3); }
.wcc-queue-search input { flex: 1; min-width: 0; border: none; background: transparent; outline: none; font-family: inherit; font-size: 12.5px; color: var(--ink); }
.wcc-queue-search input::placeholder { color: var(--ink-4); }
.wcc-queue-search button { border: none; background: transparent; cursor: pointer; color: var(--ink-4); display: inline-flex; padding: 0; }
.wcc-queue-search button:hover { color: var(--ink-2); }
.wcc-conf-filters { display: flex; gap: 5px; }
.wcc-conf-pill { flex: 1; padding: 4px 6px; border-radius: 7px; border: 1px solid var(--rule-2); background: var(--paper); color: var(--ink-3); font-family: inherit; font-size: 11px; font-weight: 600; cursor: pointer; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; }
.wcc-conf-pill:hover { border-color: var(--ink-4); color: var(--ink-2); }
.wcc-conf-pill.on { background: var(--ink); border-color: var(--ink); color: var(--paper); }

.wcc-row {
  width: 100%; display: grid; grid-template-columns: 9px 1fr auto; gap: 10px;
  align-items: flex-start; padding: 11px 16px; text-align: left;
  border: none; border-left: 2px solid transparent; background: transparent;
  cursor: pointer; font-family: inherit; transition: background .12s ease, border-color .12s ease;
}
.wcc-row:hover { background: var(--paper-2); }
.wcc-row.active { background: var(--paper-3); border-left-color: var(--ink); }
.wcc-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.wcc-row-name { font-size: 13px; font-weight: 600; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wcc-row.active .wcc-row-name { color: var(--ink); }
.wcc-row-phone { font-size: 11px; color: var(--ink-3); font-family: 'JetBrains Mono', monospace; margin-top: 1px; }
.wcc-row-type { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; color: var(--ink-4); margin-top: 5px; }
.wcc-conf { font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
.wcc-conf-hi { color: var(--ok); } .wcc-conf-mid { color: var(--warn); } .wcc-conf-lo { color: var(--crit); }

/* ── Detail ── */
.wcc-detail { display: flex; flex-direction: column; min-height: 0; overflow-y: auto; }
.wcc-detail-head {
  position: sticky; top: 0; z-index: 5;
  padding: 18px 28px 16px; border-bottom: 1px solid var(--rule-2);
  background: color-mix(in oklab, var(--paper) 90%, transparent);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.wcc-detail-body { padding: 22px 28px 48px; display: flex; flex-direction: column; gap: 26px; max-width: 780px; }

.wcc-section-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; color: var(--ink-3); margin-bottom: 9px; display: block; }

/* Type chips */
.wcc-types { display: flex; flex-wrap: wrap; gap: 8px; }
.wcc-type-chip {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 13px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--rule-2); background: var(--paper);
  font-family: inherit; font-size: 13px; font-weight: 500; color: var(--ink-3);
  transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease;
}
.wcc-type-chip:hover { border-color: var(--ink-4); color: var(--ink-2); }
.wcc-type-chip .material-icons { font-size: 16px; }
.wcc-type-chip.on {
  color: var(--ink); font-weight: 600;
  border-color: var(--tone); background: color-mix(in oklab, var(--tone) 9%, var(--paper));
}
.wcc-type-chip.on .material-icons { color: var(--tone); }

/* Conversation */
.wcc-convo {
  border: 1px solid var(--rule-2); border-radius: 14px; background: var(--paper-2);
  padding: 16px; display: flex; flex-direction: column; gap: 9px;
  max-height: 360px; overflow-y: auto;
}
.wcc-bubble { max-width: 80%; display: flex; flex-direction: column; gap: 3px; }
.wcc-bubble.me { align-self: flex-end; align-items: flex-end; }
.wcc-bubble.them { align-self: flex-start; align-items: flex-start; }
.wcc-bubble-text {
  padding: 9px 13px; border-radius: 14px; font-size: 13px; line-height: 1.45;
  white-space: pre-line; word-break: break-word;
}
.wcc-bubble.me .wcc-bubble-text { background: var(--ink); color: var(--paper); border-bottom-right-radius: 4px; }
.wcc-bubble.them .wcc-bubble-text { background: var(--paper); color: var(--ink-2); border: 1px solid var(--rule-2); border-bottom-left-radius: 4px; }
.wcc-bubble-time { font-size: 9.5px; color: var(--ink-4); font-family: 'JetBrains Mono', monospace; padding: 0 3px; }

/* Reasoning callout */
.wcc-reason {
  border: 1px solid var(--rule-2); border-radius: 12px; background: var(--paper);
  padding: 14px 16px; display: flex; gap: 14px; align-items: flex-start;
}
.wcc-reason-quote { font-size: 13px; color: var(--ink-2); font-style: italic; line-height: 1.5; flex: 1; }
.wcc-reason-conf { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }

/* Fields */
.wcc-field { width: 100%; padding: 10px 12px; border-radius: 9px; border: 1px solid var(--rule-2); background: var(--paper); color: var(--ink); font-size: 14px; font-family: inherit; outline: none; transition: border-color .12s ease; box-sizing: border-box; }
.wcc-field:focus { border-color: var(--ink); }
.wcc-field::placeholder { color: var(--ink-4); }
textarea.wcc-field { resize: vertical; min-height: 56px; line-height: 1.5; }

/* Nota para tipo "otro / desconocido" */
.wcc-otro-note { display: flex; gap: 10px; align-items: flex-start; padding: 13px 15px; border-radius: 12px; border: 1px solid var(--rule-2); background: var(--paper-2); font-size: 12.5px; line-height: 1.5; color: var(--ink-2); }
.wcc-otro-note strong { color: var(--ink); font-weight: 600; }

/* Institution search */
.wcc-inst-wrap { position: relative; }
.wcc-inst-pop {
  position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0;
  max-height: 240px; overflow-y: auto;
  background: var(--paper); border: 1px solid var(--rule-2); border-radius: 10px;
  box-shadow: 0 14px 34px rgba(0,0,0,0.14);
}
.wcc-inst-opt {
  width: 100%; text-align: left; border: none; background: transparent; cursor: pointer;
  font-family: inherit; padding: 9px 12px; display: flex; flex-direction: column; gap: 2px;
  border-bottom: 1px solid var(--rule-2);
}
.wcc-inst-opt:last-child { border-bottom: none; }
.wcc-inst-opt:hover { background: var(--paper-2); }
.wcc-inst-opt.on { background: color-mix(in oklab, var(--accent) 8%, var(--paper)); }
.wcc-inst-name { font-size: 13px; font-weight: 500; color: var(--ink-2); }
.wcc-inst-tutor { font-size: 11px; color: var(--ink-4); }
.wcc-inst-linked {
  margin-top: 8px; font-size: 12px; color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--ok-soft); border: 1px solid color-mix(in oklab, var(--ok) 30%, var(--rule-2));
  padding: 6px 10px; border-radius: 8px;
}

/* Buttons */
.wcc-btn { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 500; padding: 9px 15px; border-radius: 9px; border: 1px solid var(--rule-2); background: transparent; color: var(--ink); cursor: pointer; font-family: inherit; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; }
.wcc-btn:hover { background: var(--paper-2); }
.wcc-btn:disabled { opacity: .5; cursor: not-allowed; }
.wcc-btn-primary { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.wcc-btn-primary:hover { opacity: .9; background: var(--ink-2); }
.wcc-btn-danger { color: var(--crit); border-color: transparent; background: var(--crit-soft); }
.wcc-btn-danger:hover { background: color-mix(in oklab, var(--crit) 16%, var(--paper)); }
.wcc-kbd { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; padding: 1px 5px; border-radius: 4px; border: 1px solid currentColor; opacity: .6; }
.wcc-btn-sm { padding: 6px 10px; font-size: 12px; }

/* Sub-tabs (cola / archivados) */
.wcc-tabs { display: flex; gap: 4px; margin-top: 14px; }
.wcc-tab { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 9px 9px 0 0; border: none; background: transparent; color: var(--ink-3); font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; }
.wcc-tab:hover { color: var(--ink-2); }
.wcc-tab.on { color: var(--ink); font-weight: 600; border-bottom-color: var(--ink); }
.wcc-tab-badge { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 999px; background: var(--ink); color: var(--paper); }
.wcc-tab-badge.mute { background: var(--rule-2); color: var(--ink-3); }

/* Archived view */
.wcc-archived { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.wcc-archived-head { padding: 14px 28px 10px; display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px solid var(--rule-2); flex-shrink: 0; }
.wcc-archived-head .label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; color: var(--ink-3); }
.wcc-archived-rows { overflow-y: auto; flex: 1; padding: 10px 24px 40px; display: flex; flex-direction: column; gap: 8px; }
.wcc-archived-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: 1px solid var(--rule-2); border-radius: 11px; background: var(--paper); }
.wcc-archived-name { font-size: 13.5px; font-weight: 600; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wcc-archived-phone { font-size: 11.5px; color: var(--ink-3); margin-top: 1px; }

/* Empty / loading */
.wcc-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; color: var(--ink-4); padding: 40px; min-height: 300px; }
.wcc-empty .material-icons { font-size: 40px; opacity: .35; }
.wcc-empty h4 { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink-2); }
.wcc-empty p { margin: 0; font-size: 13px; max-width: 320px; line-height: 1.5; color: var(--ink-3); }
@keyframes wcc-spin { to { transform: rotate(360deg); } }
.wcc-spin { animation: wcc-spin 1s linear infinite; }
`;

injectScopedStyles("wcc-v3", CSS);

const confClass = (c: number) =>
  c >= 0.8 ? "wcc-conf-hi" : c >= 0.5 ? "wcc-conf-mid" : "wcc-conf-lo";
const toneVar = (c: number) => (c >= 0.8 ? "--ok" : c >= 0.5 ? "--warn" : "--crit");

// ── Vista de archivados: contactos marcados como 'ignorado' ──────────────────
const ArchivedList: React.FC<{
  archived: ArchivedContact[];
  loading: boolean;
  onRestore: (c: ArchivedContact) => void;
  restoring: boolean;
}> = ({ archived, loading, onRestore, restoring }) => {
  if (loading) {
    return (
      <div className="wcc-empty" style={{ flex: 1 }}>
        <span className="material-icons wcc-spin">progress_activity</span>
        <p>Cargando archivados…</p>
      </div>
    );
  }
  if (archived.length === 0) {
    return (
      <div className="wcc-empty" style={{ flex: 1 }}>
        <span className="material-icons">inventory_2</span>
        <h4>No hay contactos archivados</h4>
        <p>
          Acá aparecen los contactos que archivaste para que no vuelvan a la cola. Podés restaurar
          cualquiera si te equivocaste.
        </p>
      </div>
    );
  }
  return (
    <div className="wcc-archived">
      <div className="wcc-archived-head">
        <span className="label">Archivados · no aparecen en la cola</span>
        <span className="wcc-list-count">{archived.length}</span>
      </div>
      <div className="wcc-archived-rows">
        {archived.map((c) => {
          const phone = c.phone || c.chat_jid.split("@")[0];
          return (
            <div key={c.chat_jid} className="wcc-archived-row">
              <span
                className="material-icons"
                style={{ fontSize: 18, color: "var(--ink-4)", flexShrink: 0 }}
              >
                person_off
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="wcc-archived-name">
                  {c.nombre_contacto || "Contacto sin nombre"}
                </div>
                <div className="wcc-archived-phone mono">{phone}</div>
              </div>
              <a
                className="wcc-btn wcc-btn-sm"
                href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en WhatsApp"
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  chat
                </span>
              </a>
              <button
                type="button"
                className="wcc-btn wcc-btn-sm"
                onClick={() => onRestore(c)}
                disabled={restoring}
                title="Restaurar · vuelve a la cola en la próxima sincronización"
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  unarchive
                </span>
                Restaurar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// QueryKey raíz de las propuestas pendientes. Se comparte con el badge del tab
// (GestionView usa ["pendingContactClassifications", "count", ...]) para que al
// aprobar/descartar se invalide TODO el árbol y el número del tab baje al instante.
const PENDING_KEY = "pendingContactClassifications";

type ConfFilter = "todas" | "alta" | "media" | "baja";
type TabMode = "cola" | "archivados";

interface ArchivedContact {
  chat_jid: string;
  phone: string | null;
  nombre_contacto: string | null;
  tipo: string | null;
  validado_at: string | null;
  updated_at: string | null;
}

const relativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMin = Math.round((Date.now() - t) / 60000);
  if (diffMin < 1) return "recién";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `hace ${diffD} d`;
};

interface WhatsAppContactClassifierProps {
  isTestingMode?: boolean;
}

export const WhatsAppContactClassifier: React.FC<WhatsAppContactClassifierProps> = ({
  isTestingMode = false,
}) => {
  const { authenticatedUser } = useAuth();
  const queryClient = useQueryClient();

  const [selectedSuggestion, setSelectedSuggestion] = useState<PendingSuggestion | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Edit fields state
  const [editedName, setEditedName] = useState("");
  const [editedTipo, setEditedTipo] = useState<string>("");
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [editedNotes, setEditedNotes] = useState("");
  const [instSearchQuery, setInstSearchQuery] = useState("");
  const [instFocused, setInstFocused] = useState(false);

  // Cola: búsqueda + filtro por confianza
  const [queueSearch, setQueueSearch] = useState("");
  const [confFilter, setConfFilter] = useState<ConfFilter>("todas");

  // Tab activo: cola de pendientes vs. archivados
  const [tabMode, setTabMode] = useState<TabMode>("cola");

  // Confirmación de descarte inline (en vez de window.confirm)
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Navegación por teclado dentro del dropdown de instituciones
  const [instHighlight, setInstHighlight] = useState(0);

  // 1. Fetch pending suggestions
  const {
    data: suggestions = [],
    isLoading: isLoadingSuggestions,
    refetch: refetchSuggestions,
    isFetching: isFetchingSuggestions,
    dataUpdatedAt,
  } = useQuery<PendingSuggestion[]>({
    queryKey: [PENDING_KEY, "list", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const rows = await mockDb.getAll("agent_suggestions", {
          tipo: "clasificacion",
          estado: "pending",
        });
        return (rows as PendingSuggestion[]).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      const { data, error } = await supabase
        .from("agent_suggestions")
        .select("*")
        .eq("tipo", "clasificacion")
        .eq("estado", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PendingSuggestion[];
    },
  });

  // 2. Fetch institutions
  const { data: institutions = [] } = useQuery<Institucion[]>({
    queryKey: ["instituciones-all-classifier", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) return (await mockDb.getAll("instituciones")) as unknown as Institucion[];
      return db.instituciones.getAll();
    },
  });

  // 3. Fetch recent messages for context of selected JID
  const selectedJid = selectedSuggestion?.payload?.chat_jid || null;
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<MessageContext[]>({
    queryKey: ["whatsapp-messages-context", selectedJid, isTestingMode],
    queryFn: async () => {
      if (!selectedJid) return [];
      if (isTestingMode) {
        const rows = await mockDb.getAll("whatsapp_mensajes", { chat_jid: selectedJid });
        return (rows as MessageContext[]).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      }
      const { data, error } = await supabase
        .from("whatsapp_mensajes")
        .select("id, texto, timestamp, from_me, media_tipo")
        .eq("chat_jid", selectedJid)
        .order("timestamp", { ascending: true }) // Ascending for conversational flow
        .limit(15);
      if (error) throw error;
      return (data || []) as MessageContext[];
    },
    enabled: !!selectedJid,
  });

  // 3b. Fetch archived (ignored) contacts — los que el coordinador archivó para
  // que no vuelvan a aparecer en la cola. Permite revisarlos y restaurarlos.
  const {
    data: archived = [],
    isLoading: isLoadingArchived,
    isFetching: isFetchingArchived,
  } = useQuery<ArchivedContact[]>({
    queryKey: ["whatsapp_contactos", "archived", isTestingMode],
    enabled: tabMode === "archivados",
    queryFn: async () => {
      if (isTestingMode) {
        const rows = (await mockDb.getAll("whatsapp_contactos", {
          tipo: "ignorado",
        })) as unknown as ArchivedContact[];
        return rows.sort(
          (a, b) =>
            new Date(b.updated_at || b.validado_at || 0).getTime() -
            new Date(a.updated_at || a.validado_at || 0).getTime()
        );
      }
      const { data, error } = await supabase
        .from("whatsapp_contactos")
        .select("chat_jid, phone, nombre_contacto, tipo, validado_at, updated_at")
        .eq("tipo", "ignorado")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ArchivedContact[];
    },
  });

  // Initialize edit form when selected suggestion changes
  useEffect(() => {
    setConfirmDiscard(false);
    setInstHighlight(0);
    if (selectedSuggestion) {
      const payload = selectedSuggestion.payload;
      setEditedName(payload.nombre_contacto || "");
      setEditedTipo(payload.tipo || "otro");
      setSelectedInstId(payload.institucion_id || "");
      setEditedNotes("");
      setInstSearchQuery("");
      setInstFocused(false);
    } else {
      setEditedName("");
      setEditedTipo("");
      setSelectedInstId("");
      setEditedNotes("");
      setInstSearchQuery("");
      setInstFocused(false);
    }
  }, [selectedSuggestion]);

  // Filtered institutions for search dropdown
  const filteredInstitutions = useMemo(() => {
    if (!instSearchQuery) return institutions;
    const query = instSearchQuery.toLowerCase();
    return institutions.filter(
      (inst) =>
        String(inst.nombre || "")
          .toLowerCase()
          .includes(query) ||
        String(inst.tutor || "")
          .toLowerCase()
          .includes(query)
    );
  }, [institutions, instSearchQuery]);

  // Cola filtrada por búsqueda (nombre/teléfono) y nivel de confianza.
  const filteredSuggestions = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    return suggestions.filter((s) => {
      const p = s.payload;
      if (confFilter !== "todas") {
        const c = p.confidence ?? 0;
        if (confFilter === "alta" && c < 0.8) return false;
        if (confFilter === "media" && (c < 0.5 || c >= 0.8)) return false;
        if (confFilter === "baja" && c >= 0.5) return false;
      }
      if (!q) return true;
      const haystack = `${p.nombre_contacto || ""} ${p.phone || ""} ${
        p.chat_jid || ""
      } ${typeMeta(p.tipo)?.label || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [suggestions, queueSearch, confFilter]);

  // Select first item by default if nothing is selected, keeping selection valid
  // with respect to the current filter.
  useEffect(() => {
    if (filteredSuggestions.length === 0) {
      if (selectedSuggestion) setSelectedSuggestion(null);
      return;
    }
    const stillVisible =
      selectedSuggestion && filteredSuggestions.some((s) => s.id === selectedSuggestion.id);
    if (!stillVisible) {
      setSelectedSuggestion(filteredSuggestions[0]);
    }
  }, [filteredSuggestions, selectedSuggestion]);

  // 4. Mutation to validate/approve classification
  const approveMutation = useMutation({
    mutationFn: async ({
      suggestionId,
      payload,
    }: {
      suggestionId: string;
      payload: {
        chat_jid: string;
        phone: string | null;
        nombre_contacto: string;
        tipo: string;
        institucion_id: string | null;
        confidence: number;
        notas: string;
      };
    }) => {
      const validadoPor = authenticatedUser?.id || null;
      const validadoAt = new Date().toISOString();

      if (isTestingMode) {
        // En testing escribimos en mockDb: materializa el contacto y resuelve la
        // sugerencia. La PK real es chat_jid, así que hacemos upsert en memoria.
        const row = {
          chat_jid: payload.chat_jid,
          phone: payload.phone,
          nombre_contacto: payload.nombre_contacto,
          tipo: payload.tipo,
          institucion_id: payload.institucion_id,
          confidence: payload.confidence,
          clasificado_por: "hermes",
          validado_por: validadoPor,
          validado_at: validadoAt,
          notas: payload.notas,
          updated_at: validadoAt,
        };
        const list = mockDb.data.whatsapp_contactos || [];
        const idx = list.findIndex((r) => r.chat_jid === payload.chat_jid);
        if (idx >= 0) list[idx] = { ...list[idx], ...row };
        else list.unshift({ id: `mock_wc_${Date.now()}`, created_at: validadoAt, ...row });
        mockDb.data.whatsapp_contactos = list;
        await mockDb.update("agent_suggestions", suggestionId, {
          estado: "approved",
          resolved_at: validadoAt,
          resolved_by: validadoPor,
        });
        return;
      }

      // a. Insert/Upsert into whatsapp_contactos
      const { error: upsertError } = await supabase.from("whatsapp_contactos").upsert({
        chat_jid: payload.chat_jid,
        phone: payload.phone,
        nombre_contacto: payload.nombre_contacto,
        tipo: payload.tipo,
        institucion_id: payload.institucion_id,
        confidence: payload.confidence,
        clasificado_por: "hermes",
        validado_por: validadoPor,
        validado_at: validadoAt,
        notas: payload.notas,
        updated_at: validadoAt,
      });

      if (upsertError) throw upsertError;

      // b. Update suggestion state
      const { error: updateError } = await supabase
        .from("agent_suggestions")
        .update({
          estado: "approved",
          resolved_at: validadoAt,
          resolved_by: validadoPor,
          edited_payload: {
            nombre_contacto: payload.nombre_contacto,
            tipo: payload.tipo,
            institucion_id: payload.institucion_id,
            notas: payload.notas,
          },
        })
        .eq("id", suggestionId);

      if (updateError) throw updateError;

      // c. Cerrar el loop de aprendizaje. El backend de Hermes destila la
      // lección y (re)materializa whatsapp_contactos. Best-effort: no rompe la
      // acción si Hermes no responde. Detectamos edición comparando lo que
      // Hermes propuso (selectedSuggestion.payload) con lo validado.
      const original = (selectedSuggestion?.payload ?? {}) as Partial<SuggestionPayload>;
      const huboEdicion =
        (original.tipo ?? "") !== payload.tipo ||
        (original.nombre_contacto ?? "") !== payload.nombre_contacto;
      void learnFromFeedback({
        suggestionId,
        accion: huboEdicion ? "edited" : "approved",
        tipo: "clasificacion",
        payloadOriginal: original as unknown as Record<string, unknown>,
        payloadFinal: huboEdicion ? (payload as unknown as Record<string, unknown>) : null,
        validadoPor,
      });
    },
    onSuccess: (_data, variables) => {
      setToast({ message: "Contacto clasificado y guardado correctamente.", type: "success" });
      // Invalida TODO el árbol de pendientes (lista + badge del tab).
      queryClient.invalidateQueries({ queryKey: [PENDING_KEY] });
      // Cierra el loop con el CRM: si se vinculó a una institución, refrescá su
      // contexto y los listados de contactos para que el dato recién validado
      // (teléfono, nombre) aparezca en la ficha sin recargar.
      queryClient.invalidateQueries({ queryKey: ["whatsapp_contactos"] });
      if (variables?.payload?.institucion_id) {
        queryClient.invalidateQueries({
          queryKey: ["institucion_contexto", variables.payload.institucion_id],
        });
      }
      setSelectedSuggestion(null);
    },
    onError: (err) => {
      setToast({ message: `Error al validar: ${getErrorMessage(err)}`, type: "error" });
    },
  });

  // 5. Mutation to archive/ignore a classification suggestion.
  // En vez de solo marcar la sugerencia como 'discarded' (que el agente vuelve a
  // proponer en la próxima sincronización), persistimos el contacto en
  // whatsapp_contactos con tipo 'ignorado'. Como classify_pps_contacts excluye
  // todo lo que ya está en esa tabla, el número no vuelve a aparecer nunca más.
  const discardMutation = useMutation({
    mutationFn: async (suggestion: PendingSuggestion) => {
      const validadoPor = authenticatedUser?.id || null;
      const resolvedAt = new Date().toISOString();
      const p = suggestion.payload;

      if (isTestingMode) {
        const row = {
          chat_jid: p.chat_jid,
          phone: p.phone || null,
          nombre_contacto: p.nombre_contacto || null,
          tipo: "ignorado",
          institucion_id: null,
          confidence: p.confidence,
          clasificado_por: "hermes",
          validado_por: validadoPor,
          validado_at: resolvedAt,
          updated_at: resolvedAt,
        };
        const list = mockDb.data.whatsapp_contactos || [];
        const idx = list.findIndex((r) => r.chat_jid === p.chat_jid);
        if (idx >= 0) list[idx] = { ...list[idx], ...row };
        else list.unshift({ id: `mock_wc_${Date.now()}`, created_at: resolvedAt, ...row });
        mockDb.data.whatsapp_contactos = list;
        await mockDb.update("agent_suggestions", suggestion.id, {
          estado: "discarded",
          resolved_at: resolvedAt,
          resolved_by: validadoPor,
        });
        return;
      }

      // a. Persistir como ignorado para que el agente no lo vuelva a proponer.
      const { error: upsertError } = await supabase.from("whatsapp_contactos").upsert({
        chat_jid: p.chat_jid,
        phone: p.phone || null,
        nombre_contacto: p.nombre_contacto || null,
        tipo: "ignorado",
        institucion_id: null,
        confidence: p.confidence,
        clasificado_por: "hermes",
        validado_por: validadoPor,
        validado_at: resolvedAt,
        updated_at: resolvedAt,
      });
      if (upsertError) throw upsertError;

      // b. Marcar la sugerencia como descartada.
      const { error } = await supabase
        .from("agent_suggestions")
        .update({
          estado: "discarded",
          resolved_at: resolvedAt,
          resolved_by: validadoPor,
        })
        .eq("id", suggestion.id);

      if (error) throw error;

      // c. Cerrar el loop: Hermes aprende por qué este contacto se ignora.
      void learnFromFeedback({
        suggestionId: suggestion.id,
        accion: "discarded",
        tipo: "clasificacion",
        payloadOriginal: (suggestion.payload ?? {}) as unknown as Record<string, unknown>,
        motivo: "Contacto archivado por el operador (no es institucional / ruido).",
        validadoPor,
      });
    },
    onSuccess: () => {
      setToast({
        message: "Contacto archivado · no volverá a aparecer en la cola.",
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: [PENDING_KEY] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp_contactos"] });
      setSelectedSuggestion(null);
    },
    onError: (err) => {
      setToast({ message: `Error al archivar: ${getErrorMessage(err)}`, type: "error" });
    },
  });

  // 6. Mutation to restore an archived contact: borra el registro 'ignorado' de
  // whatsapp_contactos para que el agente pueda volver a proponerlo en la
  // próxima sincronización.
  const restoreMutation = useMutation({
    mutationFn: async (contact: ArchivedContact) => {
      if (isTestingMode) {
        // En mock, los registros se identifican por chat_jid (la PK real de la
        // tabla); filtramos el array en memoria.
        mockDb.data.whatsapp_contactos = (mockDb.data.whatsapp_contactos || []).filter(
          (r) => r.chat_jid !== contact.chat_jid
        );
        return;
      }
      const { error } = await supabase
        .from("whatsapp_contactos")
        .delete()
        .eq("chat_jid", contact.chat_jid)
        .eq("tipo", "ignorado");
      if (error) throw error;
    },
    onSuccess: () => {
      setToast({
        message: "Contacto restaurado · puede volver a aparecer en la próxima sincronización.",
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["whatsapp_contactos"] });
    },
    onError: (err) => {
      setToast({ message: `Error al restaurar: ${getErrorMessage(err)}`, type: "error" });
    },
  });

  const handleSave = useCallback(() => {
    if (!selectedSuggestion) return;
    const payload = selectedSuggestion.payload;
    const needsInst = !!typeMeta(editedTipo)?.needsInstitution;

    if (needsInst && !selectedInstId) {
      setToast({
        message: "Debes seleccionar una institución para esta clasificación.",
        type: "error",
      });
      return;
    }

    approveMutation.mutate({
      suggestionId: selectedSuggestion.id,
      payload: {
        chat_jid: payload.chat_jid,
        phone: payload.phone || null,
        nombre_contacto: editedName.trim(),
        tipo: editedTipo,
        institucion_id: needsInst ? selectedInstId : null,
        confidence: payload.confidence,
        notas: editedNotes.trim(),
      },
    });
  }, [selectedSuggestion, editedTipo, selectedInstId, editedName, editedNotes, approveMutation]);

  const handleDiscard = () => {
    if (!selectedSuggestion) return;
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    discardMutation.mutate(selectedSuggestion);
    setConfirmDiscard(false);
  };

  // Keyboard: Cmd/Ctrl+Enter aprueba (salvo en "otro", que solo se archiva)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && selectedSuggestion) {
        e.preventDefault();
        if (editedTipo === "otro") return;
        if (!approveMutation.isPending && !discardMutation.isPending) handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedSuggestion,
    editedTipo,
    approveMutation.isPending,
    discardMutation.isPending,
    handleSave,
  ]);

  const activeInstitutionName = useMemo(() => {
    if (!selectedInstId) return "";
    const inst = institutions.find((i) => i.id === selectedInstId);
    return inst ? inst.nombre : "";
  }, [selectedInstId, institutions]);

  const currentType = typeMeta(editedTipo);
  const needsInstitution = !!currentType?.needsInstitution;
  const isOtro = editedTipo === "otro";
  const busy = approveMutation.isPending || discardMutation.isPending;

  return (
    <div className="wcc">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="wcc-head">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="wcc-eyebrow">Supervisión de Hermes</span>
            <h1 className="wcc-title">Contactos por clasificar</h1>
            <p className="wcc-sub">
              Hermes lee tu WhatsApp y propone cómo archivar cada contacto nuevo. Revisá la
              conversación, corregí lo que haga falta y confirmá. Nada se guarda sin tu visto bueno.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="wcc-btn"
              onClick={() => refetchSuggestions()}
              disabled={isFetchingSuggestions}
              title="Buscar nuevas propuestas de Hermes"
            >
              <span
                className={`material-icons${isFetchingSuggestions ? " wcc-spin" : ""}`}
                style={{ fontSize: 16 }}
              >
                {isFetchingSuggestions ? "progress_activity" : "refresh"}
              </span>
              Actualizar
            </button>
            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
              Última sincronización ·{" "}
              {relativeTime(dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null)}
            </span>
          </div>
        </div>

        {/* Sub-tabs: cola vs archivados */}
        <div className="wcc-tabs">
          <button
            type="button"
            className={`wcc-tab${tabMode === "cola" ? " on" : ""}`}
            onClick={() => setTabMode("cola")}
          >
            <span className="material-icons" style={{ fontSize: 15 }}>
              inbox
            </span>
            Por clasificar
            {suggestions.length > 0 && <span className="wcc-tab-badge">{suggestions.length}</span>}
          </button>
          <button
            type="button"
            className={`wcc-tab${tabMode === "archivados" ? " on" : ""}`}
            onClick={() => setTabMode("archivados")}
          >
            <span className="material-icons" style={{ fontSize: 15 }}>
              inventory_2
            </span>
            Archivados
            {archived.length > 0 && <span className="wcc-tab-badge mute">{archived.length}</span>}
          </button>
        </div>
      </div>

      {tabMode === "archivados" ? (
        <ArchivedList
          archived={archived}
          loading={isLoadingArchived || isFetchingArchived}
          onRestore={(c) => restoreMutation.mutate(c)}
          restoring={restoreMutation.isPending}
        />
      ) : (
        <div className={`wcc-body${selectedSuggestion ? " show-detail" : ""}`}>
          {/* ── Left: proposals list ── */}
          <div className="wcc-list">
            <div className="wcc-list-head">
              <span className="label">Propuestas</span>
              <span className="wcc-list-count">
                {filteredSuggestions.length}
                {filteredSuggestions.length !== suggestions.length
                  ? ` / ${suggestions.length}`
                  : ""}{" "}
                por revisar
              </span>
            </div>

            {/* Búsqueda + filtro por confianza */}
            {suggestions.length > 0 && (
              <div className="wcc-queue-tools">
                <div className="wcc-queue-search">
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    search
                  </span>
                  <input
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Buscar nombre o teléfono…"
                    aria-label="Buscar en la cola de propuestas"
                  />
                  {queueSearch && (
                    <button
                      type="button"
                      onClick={() => setQueueSearch("")}
                      aria-label="Limpiar búsqueda"
                      title="Limpiar"
                    >
                      <span className="material-icons" style={{ fontSize: 14 }}>
                        close
                      </span>
                    </button>
                  )}
                </div>
                <div className="wcc-conf-filters">
                  {(
                    [
                      { id: "todas", label: "Todas" },
                      { id: "alta", label: "Alta" },
                      { id: "media", label: "Media" },
                      { id: "baja", label: "Baja" },
                    ] as { id: ConfFilter; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`wcc-conf-pill${confFilter === f.id ? " on" : ""}`}
                      onClick={() => setConfFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="wcc-rows">
              {isLoadingSuggestions ? (
                <div className="wcc-empty" style={{ minHeight: 200 }}>
                  <span className="material-icons wcc-spin">progress_activity</span>
                  <p>Buscando propuestas…</p>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="wcc-empty" style={{ minHeight: 200 }}>
                  <span className="material-icons" style={{ color: "var(--ok)", opacity: 0.7 }}>
                    task_alt
                  </span>
                  <h4>Bandeja al día</h4>
                  <p>No hay contactos pendientes. Hermes te avisará al sincronizar a la mañana.</p>
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="wcc-empty" style={{ minHeight: 200 }}>
                  <span className="material-icons" style={{ opacity: 0.5 }}>
                    filter_alt_off
                  </span>
                  <h4>Sin coincidencias</h4>
                  <p>Ninguna propuesta coincide con la búsqueda o el filtro actual.</p>
                </div>
              ) : (
                filteredSuggestions.map((suggestion) => {
                  const payload = suggestion.payload;
                  const meta = typeMeta(payload.tipo);
                  const isSelected = selectedSuggestion?.id === suggestion.id;
                  const confidencePct = Math.round(payload.confidence * 100);
                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => setSelectedSuggestion(suggestion)}
                      className={`wcc-row${isSelected ? " active" : ""}`}
                    >
                      <span
                        className="wcc-dot"
                        style={{ background: `var(${meta?.tone || "--ink-4"})` }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span className="wcc-row-name" style={{ display: "block" }}>
                          {payload.nombre_contacto || "Contacto sin nombre"}
                        </span>
                        <span className="wcc-row-phone" style={{ display: "block" }}>
                          {payload.phone || payload.chat_jid.split("@")[0]}
                        </span>
                        <span className="wcc-row-type" style={{ display: "block" }}>
                          {meta?.label || "Sin tipo"}
                        </span>
                      </span>
                      <span className={`wcc-conf ${confClass(payload.confidence)}`}>
                        {confidencePct}%
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right: detail ── */}
          <div className="wcc-detail">
            {!selectedSuggestion ? (
              <div className="wcc-empty">
                <span className="material-icons">forum</span>
                <h4>Seleccioná una propuesta</h4>
                <p>
                  Elegí un contacto de la izquierda para ver la conversación, ajustar la
                  clasificación y guardarla.
                </p>
              </div>
            ) : (
              <>
                {/* Detail header */}
                <div className="wcc-detail-head">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span className="wcc-eyebrow">Propuesta de Hermes</span>
                      <h2
                        style={{
                          margin: "3px 0 0",
                          fontSize: 19,
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {selectedSuggestion.payload.nombre_contacto || "Contacto sin nombre"}
                      </h2>
                      <span
                        style={{
                          fontSize: 11.5,
                          color: "var(--ink-4)",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {selectedSuggestion.payload.phone ||
                          selectedSuggestion.payload.chat_jid.split("@")[0]}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                      {(selectedSuggestion.payload.phone ||
                        selectedSuggestion.payload.chat_jid) && (
                        <a
                          className="wcc-btn"
                          href={`https://wa.me/${(
                            selectedSuggestion.payload.phone ||
                            selectedSuggestion.payload.chat_jid.split("@")[0]
                          ).replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir el chat real en WhatsApp para editar el contacto allí"
                        >
                          <span className="material-icons" style={{ fontSize: 16 }}>
                            chat
                          </span>
                          Abrir WhatsApp
                        </a>
                      )}
                      {confirmDiscard ? (
                        <>
                          <button
                            type="button"
                            className="wcc-btn"
                            onClick={() => setConfirmDiscard(false)}
                            disabled={busy}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="wcc-btn wcc-btn-danger"
                            onClick={handleDiscard}
                            disabled={busy}
                          >
                            <span
                              className={`material-icons${discardMutation.isPending ? " wcc-spin" : ""}`}
                              style={{ fontSize: 16 }}
                            >
                              {discardMutation.isPending ? "progress_activity" : "inventory_2"}
                            </span>
                            Confirmar · no volver a mostrar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={`wcc-btn${isOtro ? " wcc-btn-primary" : " wcc-btn-danger"}`}
                          onClick={handleDiscard}
                          disabled={busy}
                          title="Archiva el contacto: no vuelve a aparecer en la cola. Editalo en WhatsApp si hace falta."
                        >
                          <span className="material-icons" style={{ fontSize: 16 }}>
                            inventory_2
                          </span>
                          Archivar
                        </button>
                      )}
                      {!isOtro && !confirmDiscard && (
                        <button
                          type="button"
                          className="wcc-btn wcc-btn-primary"
                          onClick={handleSave}
                          disabled={busy}
                        >
                          <span
                            className={`material-icons${approveMutation.isPending ? " wcc-spin" : ""}`}
                            style={{ fontSize: 16 }}
                          >
                            {approveMutation.isPending ? "progress_activity" : "check_circle"}
                          </span>
                          Aprobar y registrar
                          <span className="wcc-kbd">⌘↵</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="wcc-detail-body">
                  {/* Conversation — la evidencia */}
                  <div>
                    <span className="wcc-section-label">Conversación reciente · la evidencia</span>
                    <div className="wcc-convo">
                      {isLoadingMessages ? (
                        <div className="wcc-empty" style={{ minHeight: 120 }}>
                          <span className="material-icons wcc-spin">progress_activity</span>
                          <p>Cargando mensajes…</p>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="wcc-empty" style={{ minHeight: 120 }}>
                          <p>No hay mensajes de este contacto en la base local.</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const d = new Date(msg.timestamp);
                          const timeStr = d.toLocaleTimeString("es-AR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const dateStr = d.toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                          });
                          const hasText = !!(msg.texto && msg.texto.trim());
                          const mediaLabel = msg.media_tipo
                            ? `📎 ${msg.media_tipo}`
                            : "(mensaje sin texto)";
                          return (
                            <div
                              key={msg.id}
                              className={`wcc-bubble ${msg.from_me ? "me" : "them"}`}
                            >
                              <div
                                className="wcc-bubble-text"
                                style={hasText ? undefined : { fontStyle: "italic", opacity: 0.75 }}
                              >
                                {hasText ? msg.texto : mediaLabel}
                              </div>
                              <span className="wcc-bubble-time">
                                {dateStr} {timeStr}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Hermes reasoning + confidence */}
                  <div className="wcc-reason">
                    <div className="wcc-reason-quote">
                      “{selectedSuggestion.payload.justificacion}”
                      {selectedSuggestion.payload.resumen_patron && (
                        <div
                          style={{
                            marginTop: 8,
                            fontStyle: "normal",
                            fontSize: 12.5,
                            color: "var(--ink-3)",
                          }}
                        >
                          {selectedSuggestion.payload.resumen_patron}
                        </div>
                      )}
                    </div>
                    <div className="wcc-reason-conf">
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 400,
                          fontFamily: "'JetBrains Mono', monospace",
                          color: `var(${toneVar(selectedSuggestion.payload.confidence)})`,
                          lineHeight: 1,
                        }}
                      >
                        {Math.round(selectedSuggestion.payload.confidence * 100)}%
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontWeight: 600,
                          color: "var(--ink-4)",
                          textAlign: "center",
                        }}
                      >
                        Confianza
                      </span>
                    </div>
                  </div>

                  {/* Classification chips */}
                  <div>
                    <span className="wcc-section-label">¿Cómo lo clasificamos?</span>
                    <div className="wcc-types">
                      {TYPE_META.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`wcc-type-chip${editedTipo === t.id ? " on" : ""}`}
                          style={{ ["--tone" as string]: `var(${t.tone})` }}
                          onClick={() => setEditedTipo(t.id)}
                        >
                          <span className="material-icons">{t.icon}</span>
                          {t.short}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isOtro ? (
                    /* Tipo "otro / desconocido": no se registra como contacto del CRM.
                     El flujo correcto es editarlo en WhatsApp (si corresponde) y
                     archivarlo acá para que no vuelva a aparecer en la cola. */
                    <div className="wcc-otro-note">
                      <span
                        className="material-icons"
                        style={{ fontSize: 18, color: "var(--ink-3)" }}
                      >
                        info
                      </span>
                      <div>
                        <strong>No se agrega al panel.</strong> Los contactos personales, spam o que
                        no llegaron a nada no se registran como institución. Si querés ponerle
                        nombre, hacelo en WhatsApp. Acá, archivalo: no vuelve a aparecer en la cola.
                      </div>
                    </div>
                  ) : (
                    /* Name + institution */
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: needsInstitution ? "1fr 1fr" : "1fr",
                        gap: 18,
                      }}
                    >
                      <div>
                        <span className="wcc-section-label">Nombre del contacto</span>
                        <input
                          className="wcc-field"
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          placeholder="Ej: Fundación Sol Mapu · Agostina (directora)"
                        />
                      </div>

                      {needsInstitution && (
                        <div>
                          <span className="wcc-section-label">Vincular con institución</span>
                          <div className="wcc-inst-wrap">
                            <input
                              className="wcc-field"
                              type="text"
                              role="combobox"
                              aria-expanded={instFocused}
                              aria-controls="wcc-inst-listbox"
                              aria-autocomplete="list"
                              value={instSearchQuery}
                              onChange={(e) => {
                                setInstSearchQuery(e.target.value);
                                setInstFocused(true);
                                setInstHighlight(0);
                              }}
                              onFocus={() => setInstFocused(true)}
                              onBlur={() => setTimeout(() => setInstFocused(false), 150)}
                              onKeyDown={(e) => {
                                const opts = filteredInstitutions.slice(0, 30);
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setInstFocused(true);
                                  setInstHighlight((h) => Math.min(h + 1, opts.length - 1));
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setInstHighlight((h) => Math.max(h - 1, 0));
                                } else if (e.key === "Enter") {
                                  const pick = opts[instHighlight];
                                  if (pick) {
                                    e.preventDefault();
                                    setSelectedInstId(pick.id);
                                    setInstSearchQuery(pick.nombre || "");
                                    setInstFocused(false);
                                  }
                                } else if (e.key === "Escape") {
                                  setInstFocused(false);
                                }
                              }}
                              placeholder={activeInstitutionName || "Buscar institución…"}
                            />
                            {instFocused && (
                              <div
                                className="wcc-inst-pop no-scrollbar"
                                id="wcc-inst-listbox"
                                role="listbox"
                              >
                                {filteredInstitutions.length === 0 ? (
                                  <div style={{ padding: 12, fontSize: 12, color: "var(--ink-4)" }}>
                                    No se encontraron instituciones.
                                  </div>
                                ) : (
                                  filteredInstitutions.slice(0, 30).map((inst, idx) => (
                                    <button
                                      key={inst.id}
                                      type="button"
                                      role="option"
                                      aria-selected={inst.id === selectedInstId}
                                      className={`wcc-inst-opt${
                                        inst.id === selectedInstId || idx === instHighlight
                                          ? " on"
                                          : ""
                                      }`}
                                      onMouseEnter={() => setInstHighlight(idx)}
                                      onClick={() => {
                                        setSelectedInstId(inst.id);
                                        setInstSearchQuery(inst.nombre || "");
                                        setInstFocused(false);
                                      }}
                                    >
                                      <span className="wcc-inst-name">{inst.nombre}</span>
                                      {inst.tutor && (
                                        <span className="wcc-inst-tutor">Tutor: {inst.tutor}</span>
                                      )}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                          {selectedInstId && (
                            <span className="wcc-inst-linked">
                              <span
                                className="material-icons"
                                style={{ fontSize: 14, color: "var(--ok)" }}
                              >
                                link
                              </span>
                              Vinculado a <strong>{activeInstitutionName}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {!isOtro && (
                    <div>
                      <span className="wcc-section-label">Nota interna · opcional</span>
                      <textarea
                        className="wcc-field"
                        rows={2}
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        placeholder="Ej: primer contacto para coordinar vacantes; esperar propuesta formal."
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppContactClassifier;
