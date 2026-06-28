/**
 * TallerView — Rediseño v1 (Paper & Ink editorial · "trastienda" del panel)
 *
 * Reemplaza la antigua "Herramientas" (una fila de tabs sueltos) por una
 * trastienda ordenada por intención: una portada con herramientas agrupadas en
 * familias, y un workspace enfocado por herramienta (breadcrumb + volver).
 *
 * Decisiones de arquitectura (acordadas):
 *   · Reportes  → se fue a Métricas (vista ejecutiva). No vive acá.
 *   · Contactos WhatsApp → se fue a Gestión (supervisión de Hermes). No vive acá.
 *   · Editor DB + Backups → zona "Avanzado": modifican datos directamente, con
 *     una guarda de confirmación antes de abrirse.
 *
 * Hermes acá es asistente silencioso DENTRO de una herramienta (p.ej. pre-llena
 * un convenio), nunca narrador. En Editor DB y Backups no interviene.
 *
 * Los sub-componentes (DatabaseEditor, ConvenioGenerator, SeguroGenerator,
 * PenalizationManager, EmailAutomationManager, NuevosConvenios, BackupManager,
 * PersonalizationPanel, AdminSearch) se reutilizan tal cual; sólo cambia la capa
 * visual que los envuelve.
 */
import React, { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useModal } from "../../contexts/ModalContext";
import { useAdminPreferences } from "../../contexts/AdminPreferencesContext";
import { supabase } from "../../lib/supabaseClient";
import { db } from "../../lib/db";
import { schema } from "../../lib/dbSchema";
import {
  TABLE_NAME_PENALIZACIONES,
  TABLE_NAME_INSTITUCIONES,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOTAS_INTERNAS_ESTUDIANTES,
} from "../../constants";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import type { AirtableRecord, EstudianteFields } from "../../types";
import ErrorBoundary from "../../components/ErrorBoundary";
import Loader from "../../components/Loader";
import RecordEditModal from "../../components/admin/RecordEditModal";
import Toast from "../../components/ui/Toast";

// ─── Lazy sub-tools (idéntico a la carga previa) ──────────────────────────────
const DatabaseEditor = lazy(() => import("../../components/admin/DatabaseEditor"));
const PenalizationManager = lazy(() => import("../../components/admin/PenalizationManager"));
const EmailAutomationManager = lazy(() => import("../../components/admin/EmailAutomationManager"));
const NuevosConvenios = lazy(() => import("../../components/admin/NuevosConvenios"));
const ConveniosPorVencerPanel = lazy(
  () => import("../../components/admin/ConveniosPorVencerPanel")
);
const BackupManager = lazy(() => import("../../components/admin/BackupManager"));
const ConvenioGenerator = lazy(() => import("../../components/admin/ConvenioGenerator"));
const SeguroGenerator = lazy(() => import("../../components/admin/SeguroGenerator"));
const PersonalizationPanel = lazy(() => import("../../components/PersonalizationPanel"));
const AdminSearch = lazy(() => import("../../components/admin/AdminSearch"));

// ─── CSS scoped (Paper & Ink · trastienda) ────────────────────────────────────

const CSS = `
.taller {
  min-height: calc(100vh - 60px);
  background: var(--paper);
  color: var(--ink);
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
}
.taller-main { max-width: 1280px; margin: 0 auto; padding: 0 48px 72px; }

/* Head */
.taller-head { padding: 40px 0 24px; border-bottom: 1px solid var(--rule-2); }
.taller-title {
  margin: 8px 0 0; font-size: 46px; font-weight: 400;
  letter-spacing: -0.015em; line-height: 1.0;
  font-family: 'Instrument Serif', Georgia, serif;
}
.taller-sub { margin: 10px 0 0; font-size: 15px; color: var(--ink-3); line-height: 1.6; max-width: 560px; }

/* Family section */
.taller-family { padding: 30px 0 4px; }
.taller-family-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px; margin-bottom: 14px;
}
.taller-family-note { font-size: 12px; color: var(--ink-4); }

/* Grid of tool cards */
.taller-grid {
  display: grid; gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 720px) { .taller-grid { grid-template-columns: 1fr; } }

/* Tool card */
.taller-card {
  display: flex; flex-direction: column; gap: 10px;
  padding: 18px 20px; border-radius: 14px;
  border: 1px solid var(--rule-2); background: var(--paper);
  cursor: pointer; text-align: left; width: 100%; font-family: inherit;
  transition: background .12s ease, border-color .12s ease, transform .12s ease;
  position: relative;
}
.taller-card:hover { background: var(--paper-2); border-color: var(--rule-3); }
.taller-card:active { transform: translateY(0.5px); }
.taller-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.taller-card.adv { background: transparent; border-style: dashed; }
.taller-card.adv:hover { background: var(--warn-soft); border-color: var(--warn); }

.taller-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.taller-card-icon {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--paper-2); color: var(--ink-2); border: 1px solid var(--rule-2);
}
.taller-card.adv .taller-card-icon { background: var(--warn-soft); color: var(--warn); border-color: transparent; }
.taller-card-name {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 17px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink);
}
.taller-card-desc { font-size: 13px; line-height: 1.5; color: var(--ink-3); }

/* Badge (dato vivo) */
.taller-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums;
  background: var(--paper-2); color: var(--ink-3); border: 1px solid var(--rule-2);
  white-space: nowrap;
}
.taller-badge.warn { background: var(--warn-soft); color: var(--warn); border-color: transparent; }
.taller-badge.ok { background: var(--ok-soft); color: var(--ok); border-color: transparent; }
.taller-badge.ai { background: var(--ai-soft); color: var(--ai); border-color: transparent; }
.taller-badge .dot { width: 6px; height: 6px; }

.taller-arrow {
  position: absolute; right: 18px; bottom: 16px;
  color: var(--ink-4); opacity: 0; transform: translateX(-4px);
  transition: opacity .12s ease, transform .12s ease;
}
.taller-card:hover .taller-arrow { opacity: 1; transform: translateX(0); }

/* Advanced banner */
.taller-adv-head {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  font-weight: 600; color: var(--warn);
}

/* Workspace */
.taller-ws-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 28px 0 20px; border-bottom: 1px solid var(--rule-2);
  margin-bottom: 28px; flex-wrap: wrap;
}
.taller-crumb {
  display: inline-flex; align-items: center; gap: 8px;
  background: none; border: none; cursor: pointer; font-family: inherit;
  font-size: 13px; color: var(--ink-3); padding: 0;
}
.taller-crumb:hover { color: var(--ink); }
.taller-crumb b { color: var(--ink); font-weight: 600; }
.taller-ws-title {
  margin: 10px 0 0; font-size: 30px; font-weight: 700; letter-spacing: -0.03em;
  font-family: 'Hanken Grotesk', system-ui, sans-serif; line-height: 1.1;
}
.taller-ws-sub { margin: 8px 0 0; font-size: 14px; color: var(--ink-3); max-width: 600px; line-height: 1.5; }

/* Confirm modal (guarda zona avanzada) */
.taller-modal-bg {
  position: fixed; inset: 0; background: rgba(20,19,16,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px;
  animation: taller-fade .15s ease;
}
@keyframes taller-fade { from { opacity: 0; } to { opacity: 1; } }
.taller-modal {
  background: var(--paper); border-radius: 16px; max-width: 440px; width: 100%;
  border: 1px solid var(--rule-2); box-shadow: 0 24px 80px rgba(20,19,16,0.2);
  padding: 26px 28px;
}

/* Footer */
.taller-foot {
  margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--rule-2);
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
}
`;

injectScopedStyles("taller-styles", CSS);

// ─── Catálogo de herramientas ─────────────────────────────────────────────────

type ToolId =
  | "search"
  | "editor-db"
  | "convenios-gen"
  | "seguros"
  | "convenios-nuevos"
  | "convenios-vencer"
  | "penalizaciones"
  | "automation"
  | "backups"
  | "personalization";

type Tone = "neutral" | "warn" | "ok" | "ai";

interface ToolDef {
  id: ToolId;
  name: string;
  desc: string;
  icon: string;
  advanced?: boolean;
  /** clave de AdminPreferences que lo habilita; undefined = siempre visible */
  prefKey?:
    | "showAgreementGenerator"
    | "showNewAgreements"
    | "showPenalizations"
    | "showAutomation"
    | "showBackups";
}

interface FamilyDef {
  id: string;
  label: string;
  note: string;
  tools: ToolDef[];
}

const FAMILIES: FamilyDef[] = [
  {
    id: "personas",
    label: "Personas y datos",
    note: "Lo que usás a diario",
    tools: [
      {
        id: "search",
        name: "Buscar alumno",
        desc: "Encontrá un legajo, abrí su panel o dá de alta uno nuevo.",
        icon: "person_search",
      },
    ],
  },
  {
    id: "documentos",
    label: "Convenios y documentos",
    note: "Generación de documentación",
    tools: [
      {
        id: "convenios-gen",
        name: "Generador de convenios",
        desc: "Redactá el convenio marco o específico de una institución con IA.",
        icon: "draft",
        prefKey: "showAgreementGenerator",
      },
      {
        id: "seguros",
        name: "Generador de seguros",
        desc: "Armá la planilla de seguro ART con los alumnos seleccionados.",
        icon: "shield",
      },
      {
        id: "convenios-nuevos",
        name: "Convenios nuevos",
        desc: "Confirmá las instituciones que se incorporan este ciclo.",
        icon: "handshake",
        prefKey: "showNewAgreements",
      },
      {
        id: "convenios-vencer",
        name: "Vencimientos de convenios",
        desc: "Registrá convenios/renovaciones y revisá los próximos a vencer.",
        icon: "event_busy",
      },
    ],
  },
  {
    id: "disciplina",
    label: "Disciplina",
    note: "Seguimiento de incumplimientos",
    tools: [
      {
        id: "penalizaciones",
        name: "Penalizaciones",
        desc: "Aplicá y seguí las sanciones por bajas, ausencias y abandonos.",
        icon: "gavel",
        prefKey: "showPenalizations",
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema y ajustes",
    note: "Configuración del panel",
    tools: [
      {
        id: "automation",
        name: "Automatizaciones",
        desc: "Plantillas de mail y push: editá, activá y probá los envíos.",
        icon: "mark_email_read",
        prefKey: "showAutomation",
      },
      {
        id: "personalization",
        name: "Personalización",
        desc: "Prendé o apagá módulos del panel. Es preferencia de este navegador.",
        icon: "tune",
      },
    ],
  },
];

// Zona avanzada (separada, con guarda)
const ADVANCED_TOOLS: ToolDef[] = [
  {
    id: "editor-db",
    name: "Editor de base de datos",
    desc: "Edición directa de todas las tablas. Sin red de seguridad.",
    icon: "database",
    advanced: true,
  },
  {
    id: "backups",
    name: "Backups",
    desc: "Respaldos y restauración. Restaurar reemplaza datos actuales.",
    icon: "settings_backup_restore",
    advanced: true,
    prefKey: "showBackups",
  },
];

const TOOL_META: Record<ToolId, { title: string; sub: string; crumb: string }> = {
  search: {
    title: "Buscar alumno",
    sub: "Buscá por nombre o legajo para abrir el panel del estudiante, o registrá uno nuevo.",
    crumb: "Buscar alumno",
  },
  "editor-db": {
    title: "Editor de base de datos",
    sub: "Edición directa de los registros. Cada cambio impacta la base al instante.",
    crumb: "Editor DB",
  },
  "convenios-gen": {
    title: "Generador de convenios",
    sub: "Subí la información de la institución y la IA redacta el convenio marco o específico.",
    crumb: "Generador de convenios",
  },
  seguros: {
    title: "Generador de seguros",
    sub: "Elegí las convocatorias con alumnos seleccionados y armá la planilla de seguro ART.",
    crumb: "Generador de seguros",
  },
  "convenios-nuevos": {
    title: "Convenios nuevos",
    sub: "Confirmá las instituciones que firman convenio este ciclo.",
    crumb: "Convenios nuevos",
  },
  "convenios-vencer": {
    title: "Vencimientos de convenios",
    sub: "Registrá convenios y renovaciones, y revisá los que están próximos a vencer.",
    crumb: "Vencimientos",
  },
  penalizaciones: {
    title: "Penalizaciones",
    sub: "Aplicá sanciones y revisá el historial y el puntaje acumulado de cada alumno.",
    crumb: "Penalizaciones",
  },
  automation: {
    title: "Automatizaciones",
    sub: "Editá las plantillas de correo y push, activá los envíos y mandá pruebas.",
    crumb: "Automatizaciones",
  },
  backups: {
    title: "Backups",
    sub: "Respaldos automáticos y manuales. La restauración reemplaza los datos actuales.",
    crumb: "Backups",
  },
  personalization: {
    title: "Personalización",
    sub: "Activá o desactivá módulos del panel. Sólo afecta a este navegador.",
    crumb: "Personalización",
  },
};

// ─── Live badges (datos reales, degradan en silencio) ─────────────────────────

interface BadgeData {
  text: string;
  tone: Tone;
  dot?: boolean;
}

function useTallerBadges(isTestingMode: boolean) {
  return useQuery({
    queryKey: ["tallerBadges", isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Partial<Record<ToolId, BadgeData>>> => {
      const out: Partial<Record<ToolId, BadgeData>> = {};

      // Penalizaciones: cantidad de alumnos con al menos una sanción
      try {
        const { data } = await supabase.from(TABLE_NAME_PENALIZACIONES).select("estudiante_id");
        if (data && data.length) {
          const alumnos = new Set((data as any[]).map((r) => r.estudiante_id).filter(Boolean));
          if (alumnos.size > 0)
            out.penalizaciones = {
              text: `${alumnos.size} con sanciones`,
              tone: "warn",
            };
        }
      } catch {
        /* degradar sin badge */
      }

      // Convenios nuevos: instituciones marcadas con el año actual
      try {
        const year = new Date().getFullYear();
        const { count } = await supabase
          .from(TABLE_NAME_INSTITUCIONES)
          .select("id", { count: "exact", head: true })
          .eq(FIELD_CONVENIO_NUEVO_INSTITUCIONES, year);
        if (count && count > 0)
          out["convenios-nuevos"] = { text: `${count} este ciclo`, tone: "ok" };
      } catch {
        /* degradar sin badge */
      }

      // Automatizaciones: plantillas activas
      try {
        const { count } = await supabase
          .from("email_templates")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        if (count && count > 0) out.automation = { text: `${count} activas`, tone: "neutral" };
      } catch {
        /* degradar sin badge */
      }

      return out;
    },
  });
}

// ─── Card ──────────────────────────────────────────────────────────────────────

const ToolCard: React.FC<{
  tool: ToolDef;
  badge?: BadgeData;
  onOpen: (tool: ToolDef) => void;
}> = ({ tool, badge, onOpen }) => (
  <button className={`taller-card ${tool.advanced ? "adv" : ""}`} onClick={() => onOpen(tool)}>
    <div className="taller-card-top">
      <span className="taller-card-icon">
        <span className="material-icons" style={{ fontSize: 20 }}>
          {tool.icon}
        </span>
      </span>
      {badge && (
        <span className={`taller-badge ${badge.tone}`}>
          {badge.dot && <span className="dot dot-ai" />}
          {badge.text}
        </span>
      )}
    </div>
    <div>
      <div className="taller-card-name">{tool.name}</div>
      <div className="taller-card-desc">{tool.desc}</div>
    </div>
    <span className="material-icons taller-arrow" style={{ fontSize: 18 }}>
      arrow_forward
    </span>
  </button>
);

// ─── Confirmación zona avanzada ────────────────────────────────────────────────

const AdvancedGuard: React.FC<{
  tool: ToolDef;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ tool, onConfirm, onCancel }) => (
  <div className="taller-modal-bg" onClick={onCancel}>
    <div className="taller-modal" onClick={(e) => e.stopPropagation()}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          color: "var(--warn)",
          marginBottom: 10,
        }}
      >
        <span className="material-icons" style={{ fontSize: 18 }}>
          warning_amber
        </span>
        <span className="eyebrow" style={{ color: "var(--warn)" }}>
          Zona avanzada
        </span>
      </div>
      <h3
        className="serif"
        style={{
          margin: "0 0 8px",
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        Vas a abrir {tool.name}
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>
        {tool.id === "backups"
          ? "Esta herramienta crea y restaura respaldos. Restaurar un backup reemplaza los datos actuales y no se puede deshacer."
          : "Esta herramienta edita los registros directamente en la base. Cada cambio impacta al instante, sin confirmación previa por registro."}
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 22 }}>
        <button className="btn press" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary press" onClick={onConfirm}>
          <span className="material-icons" style={{ fontSize: 14 }}>
            check
          </span>
          Entiendo, continuar
        </button>
      </div>
    </div>
  </div>
);

// ─── Loader scoped ──────────────────────────────────────────────────────────────

const WsLoader: React.FC = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
    <Loader />
  </div>
);

// ─── Componente principal ────────────────────────────────────────────────────

interface TallerViewProps {
  onStudentSelect: (student: AirtableRecord<EstudianteFields>) => void;
  isTestingMode?: boolean;
}

const QUICK_STUDENT_CONFIG = {
  label: "Estudiante",
  schema: schema.estudiantes,
  fieldConfig: [
    { key: FIELD_NOMBRE_ESTUDIANTES, label: "Nombre Completo", type: "text" as const },
    { key: FIELD_LEGAJO_ESTUDIANTES, label: "Legajo", type: "text" as const },
    {
      key: FIELD_NOTAS_INTERNAS_ESTUDIANTES,
      label: "Notas (Opcional)",
      type: "textarea" as const,
    },
  ],
};

const TallerView: React.FC<TallerViewProps> = ({ onStudentSelect, isTestingMode = false }) => {
  const { preferences } = useAdminPreferences();
  const { showModal } = useModal();
  const queryClient = useQueryClient();

  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [guardTool, setGuardTool] = useState<ToolDef | null>(null);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { data: badges } = useTallerBadges(isTestingMode);

  const createStudentMutation = useMutation({
    mutationFn: (fields: any) => {
      if (isTestingMode) return new Promise((resolve) => setTimeout(() => resolve(null), 400));
      return db.estudiantes.create(fields);
    },
    onSuccess: () => {
      setToast({ message: "Estudiante registrado correctamente.", type: "success" });
      setIsCreatingStudent(false);
      queryClient.invalidateQueries({ queryKey: ["databaseEditor", "estudiantes"] });
    },
    onError: (e: any) => setToast({ message: `Error al crear: ${e.message}`, type: "error" }),
  });

  // Filtra herramientas por preferencias
  const isEnabled = (tool: ToolDef) => !tool.prefKey || preferences[tool.prefKey];

  const openTool = (tool: ToolDef) => {
    if (tool.advanced) {
      setGuardTool(tool);
      return;
    }
    setActiveTool(tool.id);
  };

  const confirmGuard = () => {
    if (guardTool) setActiveTool(guardTool.id);
    setGuardTool(null);
  };

  // ─── Render: portada ──────────────────────────────────────────────────────
  if (!activeTool) {
    const advancedVisible = ADVANCED_TOOLS.filter(isEnabled);
    return (
      <div className="taller">
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        <div className="taller-main">
          <header className="taller-head">
            <span className="eyebrow">Taller · administración PPS</span>
            <h1 className="taller-title">Taller</h1>
            <p className="taller-sub">
              Herramientas para mantener el sistema al día: personas, documentos, disciplina y
              ajustes del panel.
            </p>
          </header>

          {FAMILIES.map((family) => {
            const tools = family.tools.filter(isEnabled);
            if (tools.length === 0) return null;
            return (
              <section key={family.id} className="taller-family">
                <div className="taller-family-head">
                  <span className="eyebrow">{family.label}</span>
                  <span className="taller-family-note">{family.note}</span>
                </div>
                <div className="taller-grid">
                  {tools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      badge={badges?.[tool.id]}
                      onOpen={openTool}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {advancedVisible.length > 0 && (
            <section className="taller-family">
              <div className="taller-family-head">
                <span className="taller-adv-head">
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    warning_amber
                  </span>
                  Avanzado
                </span>
                <span className="taller-family-note">
                  Acciones que modifican datos directamente
                </span>
              </div>
              <div className="taller-grid">
                {advancedVisible.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} badge={badges?.[tool.id]} onOpen={openTool} />
                ))}
              </div>
            </section>
          )}

          <footer className="taller-foot">
            <div className="meta">Mi Panel Académico · PPS · UFLO Psicología</div>
            <div
              className="meta mono"
              style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11 }}
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ok)" }}
              >
                <span className="dot dot-ok dot-live" /> Hermes online
              </span>
            </div>
          </footer>
        </div>

        {guardTool && (
          <AdvancedGuard
            tool={guardTool}
            onConfirm={confirmGuard}
            onCancel={() => setGuardTool(null)}
          />
        )}
      </div>
    );
  }

  // ─── Render: workspace enfocado ───────────────────────────────────────────
  const meta = TOOL_META[activeTool];
  return (
    <div className="taller">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="taller-main">
        <div className="taller-ws-head">
          <div style={{ minWidth: 0 }}>
            <button className="taller-crumb" onClick={() => setActiveTool(null)}>
              <span className="material-icons" style={{ fontSize: 16 }}>
                arrow_back
              </span>
              Taller <span style={{ color: "var(--ink-4)" }}>/</span> <b>{meta.crumb}</b>
            </button>
            <h1 className="taller-ws-title">{meta.title}</h1>
            <p className="taller-ws-sub">{meta.sub}</p>
          </div>
        </div>

        <Suspense fallback={<WsLoader />}>
          {activeTool === "search" && (
            <ErrorBoundary>
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                <div
                  className="field"
                  style={{ padding: 0, display: "flex", alignItems: "center", height: 48 }}
                >
                  <AdminSearch onStudentSelect={onStudentSelect} isTestingMode={isTestingMode} />
                </div>
                <div
                  style={{
                    marginTop: 28,
                    paddingTop: 24,
                    borderTop: "1px solid var(--rule-2)",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 14px" }}>
                    ¿No encontrás al estudiante? Agregalo con nombre y legajo.
                  </p>
                  <button
                    className="btn btn-primary press"
                    onClick={() => setIsCreatingStudent(true)}
                  >
                    <span className="material-icons" style={{ fontSize: 16 }}>
                      person_add
                    </span>
                    Alta rápida de estudiante
                  </button>
                </div>
                {isCreatingStudent && (
                  <RecordEditModal
                    isOpen={isCreatingStudent}
                    onClose={() => setIsCreatingStudent(false)}
                    record={null}
                    tableConfig={QUICK_STUDENT_CONFIG}
                    onSave={(_, fields) => createStudentMutation.mutate(fields)}
                    isSaving={createStudentMutation.isPending}
                  />
                )}
              </div>
            </ErrorBoundary>
          )}

          {activeTool === "editor-db" && (
            <ErrorBoundary>
              <DatabaseEditor isTestingMode={isTestingMode} />
            </ErrorBoundary>
          )}

          {activeTool === "convenios-gen" && preferences.showAgreementGenerator && (
            <ErrorBoundary>
              <ConvenioGenerator isTestingMode={isTestingMode} />
            </ErrorBoundary>
          )}

          {activeTool === "seguros" && (
            <ErrorBoundary>
              <SeguroGenerator showModal={showModal} isTestingMode={isTestingMode} />
            </ErrorBoundary>
          )}

          {activeTool === "convenios-nuevos" && preferences.showNewAgreements && (
            <ErrorBoundary>
              <NuevosConvenios isTestingMode={isTestingMode} />
            </ErrorBoundary>
          )}

          {activeTool === "convenios-vencer" && (
            <ErrorBoundary>
              <ConveniosPorVencerPanel isTestingMode={isTestingMode} />
            </ErrorBoundary>
          )}

          {activeTool === "penalizaciones" && preferences.showPenalizations && (
            <ErrorBoundary>
              <PenalizationManager isTestingMode={isTestingMode} />
            </ErrorBoundary>
          )}

          {activeTool === "automation" && preferences.showAutomation && (
            <ErrorBoundary>
              <EmailAutomationManager />
            </ErrorBoundary>
          )}

          {activeTool === "backups" && preferences.showBackups && (
            <ErrorBoundary>
              <BackupManager />
            </ErrorBoundary>
          )}

          {activeTool === "personalization" && (
            <ErrorBoundary>
              <PersonalizationPanel />
            </ErrorBoundary>
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default TallerView;
