/**
 * TallerView (ex "HerramientasView") — Rediseño v1 (Paper & Ink editorial)
 *
 * El antiguo "Herramientas" era un cajón de sastre: una fila horizontal de ~9
 * tabs sueltos sin relación entre sí. Este rediseño lo reorganiza como un
 * "Taller": una portada con herramientas agrupadas por TRABAJO A REALIZAR, y
 * cada herramienta abre un workspace enfocado (una a la vez, con breadcrumb).
 *
 * Decisiones de arquitectura ya tomadas:
 *   · "Contactos WhatsApp" SE QUITA de acá (es supervisión de Hermes → Gestión).
 *   · "Reportes" SE QUITA de acá (se fusiona en Métricas, la vista ejecutiva).
 *   · "Editor DB" y "Backups" → zona "Avanzado" con guardas (acciones que tocan
 *     datos directamente).
 *
 * Rol de Hermes: asistente silencioso DENTRO de una herramienta (pre-rellena,
 * sugiere), nunca dueño. Sin briefing ni narrativa en esta vista.
 *
 * Los componentes internos NO se reescriben todavía: el Taller los envuelve y
 * los monta tal cual en el workspace. El reestilizado fino de cada herramienta
 * al sistema Paper & Ink es un paso posterior, herramienta por herramienta.
 */
import React, { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ErrorBoundary from "../../components/ErrorBoundary";
import Loader from "../../components/Loader";
import AdminSearch from "../../components/admin/AdminSearch";
import RecordEditModal from "../../components/admin/RecordEditModal";
import Toast from "../../components/ui/Toast";
import {
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOTAS_INTERNAS_ESTUDIANTES,
  TABLE_NAME_PENALIZACIONES,
  TABLE_NAME_INSTITUCIONES,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
} from "../../constants";
import { AdminModuleConfig, useAdminPreferences } from "../../contexts/AdminPreferencesContext";
import { useModal } from "../../contexts/ModalContext";
import { supabase } from "../../lib/supabaseClient";
import { db } from "../../lib/db";
import { schema } from "../../lib/dbSchema";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import type { AirtableRecord, EstudianteFields } from "../../types";

// ─── Lazy de las herramientas internas (se reutilizan sin tocar) ──────────────
const DatabaseEditor = lazy(() => import("../../components/admin/DatabaseEditor"));
const PenalizationManager = lazy(() => import("../../components/admin/PenalizationManager"));
const EmailAutomationManager = lazy(() => import("../../components/admin/EmailAutomationManager"));
const NuevosConvenios = lazy(() => import("../../components/admin/NuevosConvenios"));
const ConvenioGenerator = lazy(() => import("../../components/admin/ConvenioGenerator"));
const SeguroGenerator = lazy(() => import("../../components/admin/SeguroGenerator"));
const PersonalizationPanel = lazy(() => import("../../components/PersonalizationPanel"));
const BackupManager = lazy(() => import("../../components/admin/BackupManager"));

// ─── CSS scoped (Paper & Ink editorial) ───────────────────────────────────────

const CSS = `
.tlr {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  --ai:#5A2D86; --ai-s:#5A2D8612;
  background:var(--paper); color:var(--ink);
  font-family:'Hanken Grotesk', system-ui, sans-serif;
  min-height:calc(100vh - 60px);
  margin:-24px -16px; padding:0;
}
@media (min-width:640px){ .tlr{ margin:-24px -24px; } }
@media (min-width:1024px){ .tlr{ margin:-24px -32px; } }
html.dark .tlr {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
  --ai:#C9A4F2; --ai-s:#C9A4F21A;
}

.tlr-wrap{ max-width:1040px; margin:0 auto; padding:0 32px 72px; }

/* Motion tokens */
.tlr{
  --ease:cubic-bezier(.21,.66,.34,1);
  --ease-out:cubic-bezier(.16,1,.3,1);
  --shadow-soft:0 1px 2px rgba(20,19,16,.04), 0 8px 24px -12px rgba(20,19,16,.18);
}
html.dark .tlr{ --shadow-soft:0 1px 2px rgba(0,0,0,.3), 0 10px 30px -12px rgba(0,0,0,.6); }

@keyframes tlr-rise{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }
@keyframes tlr-ws-in{ from{ opacity:0; transform:translateY(6px) scale(.994); } to{ opacity:1; transform:translateY(0) scale(1); } }

/* Tipografía */
.tlr .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.tlr .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums; }
.tlr .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }
.tlr .meta{ font-size:12px; color:var(--ink-3); }

/* Encabezado */
.tlr-head{ padding:40px 0 24px; border-bottom:1px solid var(--rule-2); }
.tlr-head h1{ margin:8px 0 0; font-size:38px; font-weight:700; line-height:1.05; }
.tlr-head p{ margin:10px 0 0; font-size:14.5px; color:var(--ink-3); max-width:560px; }
.tlr-head .eyebrow, .tlr-head h1, .tlr-head p{ animation:tlr-rise .5s var(--ease-out) both; }
.tlr-head h1{ animation-delay:.04s; }
.tlr-head p{ animation-delay:.08s; }

/* Secciones */
.tlr-section{ padding:30px 0 4px; }
.tlr-section-head{ display:flex; align-items:center; gap:8px; margin-bottom:14px; }
.tlr-section-head .material-icons{ font-size:15px; color:var(--ink-4); }

/* Grilla de tarjetas */
.tlr-grid{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; }
@media (max-width:720px){ .tlr-grid{ grid-template-columns:1fr; } }

/* Tarjeta de herramienta */
.tlr-card{
  display:flex; flex-direction:column; gap:0;
  text-align:left; width:100%; cursor:pointer;
  border:1px solid var(--rule-2); border-radius:14px; background:var(--paper);
  padding:18px 20px;
  transition:background .2s var(--ease), border-color .2s var(--ease),
    box-shadow .25s var(--ease), transform .25s var(--ease);
  font-family:inherit; color:inherit;
  animation:tlr-rise .5s var(--ease-out) both;
  animation-delay:calc(var(--i, 0) * 45ms + .1s);
  will-change:transform;
}
.tlr-card:hover{
  background:var(--paper); border-color:var(--rule-3);
  box-shadow:var(--shadow-soft); transform:translateY(-3px);
}
.tlr-card:active{ transform:translateY(-1px) scale(.995); transition-duration:.08s; }
.tlr-card:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
.tlr-card-top{ display:flex; align-items:flex-start; gap:13px; }
.tlr-card-ico{
  width:38px; height:38px; flex-shrink:0; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  background:var(--paper-3); color:var(--ink-2);
  transition:transform .25s var(--ease), background .2s var(--ease), color .2s var(--ease);
}
.tlr-card:hover .tlr-card-ico{ transform:scale(1.06) rotate(-3deg); }
.tlr-card-ico .material-icons{ font-size:20px; }
.tlr-card-ico[data-tone="warn"]{ background:var(--warn-s); color:var(--warn); }
.tlr-card-ico[data-tone="ok"]{ background:var(--ok-s); color:var(--ok); }
.tlr-card-ico[data-tone="accent"]{ background:var(--accent-s); color:var(--accent); }
.tlr-card-ico[data-tone="ai"]{ background:var(--ai-s); color:var(--ai); }
.tlr-card-body{ flex:1; min-width:0; }
.tlr-card-title{ font-family:'Instrument Serif', serif; font-size:19px; font-weight:600; letter-spacing:-0.02em; line-height:1.15; }
.tlr-card-desc{ margin-top:4px; font-size:13px; line-height:1.5; color:var(--ink-3); }
.tlr-card-arrow{ flex-shrink:0; color:var(--ink-4); margin-top:2px; transition:transform .12s ease, color .12s ease; }
.tlr-card:hover .tlr-card-arrow{ color:var(--ink-2); transform:translateX(2px); }
.tlr-card-foot{ display:flex; align-items:center; gap:10px; margin-top:14px; }
.tlr-stat{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--ink-2); }
.tlr-stat .dot{ width:6px; height:6px; border-radius:999px; background:var(--ink-4); }
.tlr-stat .dot[data-tone="warn"]{ background:var(--warn); }
.tlr-stat .dot[data-tone="ok"]{ background:var(--ok); }
.tlr-stat .dot[data-tone="accent"]{ background:var(--accent); }
.tlr-stat .num{ font-family:'JetBrains Mono', monospace; }
.tlr-chip-ai{
  display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600;
  letter-spacing:.02em; padding:2px 8px; border-radius:999px;
  background:var(--ai-s); color:var(--ai);
}
.tlr-chip-ai .material-icons{ font-size:12px; }
.tlr-chip-adv{
  display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600;
  letter-spacing:.04em; text-transform:uppercase; padding:2px 8px; border-radius:6px;
  background:var(--warn-s); color:var(--warn);
}
.tlr-chip-adv .material-icons{ font-size:12px; }

/* Aviso de zona avanzada */
.tlr-adv-note{
  display:flex; align-items:flex-start; gap:9px; margin:0 0 12px;
  font-size:12px; color:var(--ink-3); line-height:1.5;
}
.tlr-adv-note .material-icons{ font-size:15px; color:var(--warn); flex-shrink:0; margin-top:1px; }

/* Workspace (herramienta abierta) */
.tlr-ws-bar{
  position:sticky; top:60px; z-index:20;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:14px 32px; border-bottom:1px solid var(--rule-2);
  background:var(--paper); backdrop-filter:saturate(180%) blur(6px);
}
.tlr-crumb{ display:flex; align-items:center; gap:7px; font-size:13px; color:var(--ink-3); min-width:0; }
.tlr-crumb b{ color:var(--ink); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tlr-crumb .material-icons{ font-size:15px; color:var(--ink-4); }
.tlr-back{
  display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:500;
  padding:7px 13px; border-radius:8px; border:1px solid var(--rule-3);
  background:transparent; color:var(--ink); cursor:pointer; font-family:inherit;
  transition:background .12s ease;
}
.tlr-back:hover{ background:var(--paper-2); }
.tlr-back .material-icons{ font-size:15px; }
.tlr-ws-body{ padding:28px 32px 64px; animation:tlr-ws-in .42s var(--ease-out) both; }

/* Footer */
.tlr-foot{
  margin-top:8px; padding:24px 0; border-top:1px solid var(--rule-2);
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;
}
.tlr-foot .dot-live{ width:7px; height:7px; border-radius:999px; background:var(--ok); display:inline-block; position:relative; }
.tlr-foot .dot-live::after{ content:''; position:absolute; inset:-3px; border-radius:999px; border:1px solid var(--ok); opacity:.4; animation:tlr-pulse 2.4s var(--ease) infinite; }
@keyframes tlr-pulse{ 0%,100%{ opacity:.4; transform:scale(1); } 50%{ opacity:0; transform:scale(1.7); } }

/* Reduced motion: respetar preferencia del sistema */
@media (prefers-reduced-motion: reduce){
  .tlr *, .tlr *::after, .tlr *::before{
    animation-duration:.001ms !important; animation-delay:0ms !important;
    transition-duration:.001ms !important;
  }
  .tlr-card:hover{ transform:none; }
  .tlr-card:hover .tlr-card-ico{ transform:none; }
  .tlr-foot .dot-live::after{ display:none; }
}
`;

injectScopedStyles("tlr-styles", CSS);

// ─── Configuración rápida de alta de estudiante ───────────────────────────────

const QUICK_STUDENT_CONFIG = {
  label: "Estudiante",
  schema: schema.estudiantes,
  fieldConfig: [
    { key: FIELD_NOMBRE_ESTUDIANTES, label: "Nombre Completo", type: "text" as const },
    { key: FIELD_LEGAJO_ESTUDIANTES, label: "Legajo", type: "text" as const },
    { key: FIELD_NOTAS_INTERNAS_ESTUDIANTES, label: "Notas (Opcional)", type: "textarea" as const },
  ],
};

// ─── Registro de herramientas ──────────────────────────────────────────────────

type Tone = "accent" | "warn" | "ok" | "ai" | "mute";
type StatKey = "penalizaciones" | "plantillasActivas" | "conveniosNuevos";

interface ToolDef {
  id: string;
  label: string;
  desc: string;
  icon: string;
  tone?: Tone;
  ai?: boolean; // Hermes asiste dentro de esta herramienta
  advanced?: boolean; // toca datos directamente
  statKey?: StatKey;
  statSuffix?: string;
  prefFlag?: keyof AdminModuleConfig; // visibilidad según Personalización
}

interface Family {
  id: string;
  label: string;
  icon: string;
  advanced?: boolean;
  note?: string;
  tools: ToolDef[];
}

const FAMILIES: Family[] = [
  {
    id: "personas",
    label: "Personas y datos",
    icon: "groups",
    tools: [
      {
        id: "buscar-alumno",
        label: "Buscar alumno",
        desc: "Encontrá un estudiante y entrá a su panel, o dalo de alta en segundos.",
        icon: "person_search",
        tone: "accent",
      },
    ],
  },
  {
    id: "convenios",
    label: "Convenios y documentos",
    icon: "description",
    tools: [
      {
        id: "convenios-nuevos",
        label: "Convenios nuevos",
        desc: "Confirmá las instituciones que sumaron convenio este ciclo.",
        icon: "handshake",
        tone: "ok",
        statKey: "conveniosNuevos",
        statSuffix: "este año",
        prefFlag: "showNewAgreements",
      },
      {
        id: "generador-convenios",
        label: "Generador de convenios",
        desc: "La IA redacta el convenio marco o específico a partir de los datos de la institución.",
        icon: "auto_awesome",
        tone: "ai",
        ai: true,
        prefFlag: "showAgreementGenerator",
      },
      {
        id: "generador-seguros",
        label: "Generador de seguros",
        desc: "Armá la planilla de seguro de la PPS con los datos de los seleccionados.",
        icon: "shield",
        tone: "accent",
        ai: true,
      },
    ],
  },
  {
    id: "disciplina",
    label: "Disciplina",
    icon: "gavel",
    tools: [
      {
        id: "penalizaciones",
        label: "Penalizaciones",
        desc: "Aplicá y seguí sanciones por incumplimientos, con puntaje y baja automática de la PPS.",
        icon: "gavel",
        tone: "warn",
        statKey: "penalizaciones",
        statSuffix: "registradas",
        prefFlag: "showPenalizations",
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema y ajustes",
    icon: "tune",
    tools: [
      {
        id: "automatizaciones",
        label: "Automatizaciones",
        desc: "Plantillas de mail y push: editá el contenido, activá escenarios y probá envíos.",
        icon: "mark_email_read",
        tone: "accent",
        statKey: "plantillasActivas",
        statSuffix: "activas",
        prefFlag: "showAutomation",
      },
      {
        id: "personalizacion",
        label: "Personalización",
        desc: "Prendé o apagá módulos del panel. Es una preferencia de este navegador.",
        icon: "tune",
        tone: "mute",
      },
    ],
  },
];

const ADVANCED_FAMILY: Family = {
  id: "avanzado",
  label: "Avanzado",
  icon: "warning_amber",
  advanced: true,
  note: "Acciones que modifican datos directamente. Usalas con cuidado: piden confirmación antes de cambios irreversibles.",
  tools: [
    {
      id: "editor-db",
      label: "Editor de base de datos",
      desc: "CRUD directo sobre estudiantes, inscripciones, prácticas e instituciones.",
      icon: "storage",
      tone: "warn",
      advanced: true,
    },
    {
      id: "backups",
      label: "Backups",
      desc: "Respaldos manuales y automáticos de la base, y restauración de un punto previo.",
      icon: "backup",
      tone: "warn",
      advanced: true,
      prefFlag: "showBackups",
    },
  ],
};

// ─── Stats vivos (degradan con elegancia si fallan) ────────────────────────────

function useTallerStats(isTestingMode: boolean) {
  return useQuery({
    queryKey: ["tallerStats", isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Partial<Record<StatKey, number>>> => {
      const year = new Date().getFullYear();
      try {
        const [pen, tmpl, conv] = await Promise.all([
          supabase.from(TABLE_NAME_PENALIZACIONES).select("*", { count: "exact", head: true }),
          supabase
            .from("email_templates")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true),
          supabase
            .from(TABLE_NAME_INSTITUCIONES)
            .select("*", { count: "exact", head: true })
            .eq(FIELD_CONVENIO_NUEVO_INSTITUCIONES, year),
        ]);
        return {
          penalizaciones: pen.count ?? undefined,
          plantillasActivas: tmpl.count ?? undefined,
          conveniosNuevos: conv.count ?? undefined,
        };
      } catch {
        return {};
      }
    },
  });
}

// ─── Tarjeta de herramienta ────────────────────────────────────────────────────

const ToolCard: React.FC<{
  tool: ToolDef;
  stat?: number;
  index?: number;
  onOpen: () => void;
}> = ({ tool, stat, index = 0, onOpen }) => (
  <button className="tlr-card press" onClick={onOpen} style={{ ["--i" as any]: index }}>
    <div className="tlr-card-top">
      <span className="tlr-card-ico" data-tone={tool.tone || "mute"}>
        <span className="material-icons">{tool.icon}</span>
      </span>
      <div className="tlr-card-body">
        <div className="tlr-card-title">{tool.label}</div>
        <div className="tlr-card-desc">{tool.desc}</div>
      </div>
      <span className="material-icons tlr-card-arrow">arrow_forward</span>
    </div>
    {(tool.ai || tool.advanced || (tool.statKey && stat !== undefined)) && (
      <div className="tlr-card-foot">
        {tool.statKey && stat !== undefined && (
          <span className="tlr-stat">
            <span className="dot" data-tone={tool.tone} />
            <span className="num">{stat}</span> {tool.statSuffix}
          </span>
        )}
        {tool.ai && (
          <span className="tlr-chip-ai">
            <span className="material-icons">auto_awesome</span>
            Hermes asiste
          </span>
        )}
        {tool.advanced && (
          <span className="tlr-chip-adv">
            <span className="material-icons">warning_amber</span>
            Avanzado
          </span>
        )}
      </div>
    )}
  </button>
);

// ─── Vista principal ────────────────────────────────────────────────────────────

interface TallerViewProps {
  onStudentSelect: (student: AirtableRecord<EstudianteFields>) => void;
  isTestingMode?: boolean;
}

const TallerView: React.FC<TallerViewProps> = ({ onStudentSelect, isTestingMode = false }) => {
  const { preferences } = useAdminPreferences();
  const { showModal } = useModal();
  const queryClient = useQueryClient();
  const { data: stats } = useTallerStats(isTestingMode);

  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const createStudentMutation = useMutation({
    mutationFn: (fields: any) => {
      if (isTestingMode) return new Promise((resolve) => setTimeout(() => resolve(null), 500));
      return db.estudiantes.create(fields);
    },
    onSuccess: () => {
      setToast({ message: "Estudiante registrado correctamente.", type: "success" });
      setIsCreatingStudent(false);
      queryClient.invalidateQueries({ queryKey: ["databaseEditor", "estudiantes"] });
    },
    onError: (e: any) => setToast({ message: `Error al crear: ${e.message}`, type: "error" }),
  });

  // Familias visibles según preferencias
  const visibleFamilies = useMemo(() => {
    const filterTools = (tools: ToolDef[]) =>
      tools.filter((t) => !t.prefFlag || preferences[t.prefFlag]);
    return [...FAMILIES, ADVANCED_FAMILY]
      .map((f) => ({ ...f, tools: filterTools(f.tools) }))
      .filter((f) => f.tools.length > 0);
  }, [preferences]);

  const allTools = useMemo(() => [...FAMILIES, ADVANCED_FAMILY].flatMap((f) => f.tools), []);
  const current = allTools.find((t) => t.id === activeTool) || null;

  // ── Workspace de cada herramienta ──────────────────────────────────────────
  const renderWorkspace = (toolId: string) => {
    switch (toolId) {
      case "buscar-alumno":
        return (
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div
              style={{
                border: "1px solid var(--rule-2)",
                borderRadius: 14,
                background: "var(--paper)",
                padding: "6px 14px",
              }}
            >
              <AdminSearch
                onStudentSelect={(s) => onStudentSelect(s)}
                isTestingMode={isTestingMode}
              />
            </div>
            <div
              style={{
                marginTop: 28,
                paddingTop: 24,
                borderTop: "1px solid var(--rule-2)",
                textAlign: "center",
              }}
            >
              <p className="meta" style={{ marginBottom: 14 }}>
                ¿No encontrás al estudiante? Agregalo manualmente solo con nombre y legajo.
              </p>
              <button
                onClick={() => setIsCreatingStudent(true)}
                className="tlr-back"
                style={{
                  background: "var(--ink)",
                  color: "var(--paper)",
                  borderColor: "var(--ink)",
                }}
              >
                <span className="material-icons">person_add</span>
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
        );
      case "convenios-nuevos":
        return <NuevosConvenios isTestingMode={isTestingMode} />;
      case "generador-convenios":
        return <ConvenioGenerator isTestingMode={isTestingMode} />;
      case "generador-seguros":
        return <SeguroGenerator showModal={showModal} isTestingMode={isTestingMode} />;
      case "penalizaciones":
        return <PenalizationManager isTestingMode={isTestingMode} />;
      case "automatizaciones":
        return <EmailAutomationManager />;
      case "personalizacion":
        return <PersonalizationPanel />;
      case "editor-db":
        return <DatabaseEditor isTestingMode={isTestingMode} />;
      case "backups":
        return <BackupManager />;
      default:
        return null;
    }
  };

  // ── Render: workspace enfocado ──────────────────────────────────────────────
  if (current) {
    return (
      <div className="tlr">
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        <div className="tlr-ws-bar">
          <div className="tlr-crumb">
            <button
              className="tlr-back"
              onClick={() => setActiveTool(null)}
              style={{ marginRight: 4 }}
            >
              <span className="material-icons">arrow_back</span>
              Taller
            </button>
            <span className="material-icons">chevron_right</span>
            <b>{current.label}</b>
            {current.advanced && (
              <span className="tlr-chip-adv" style={{ marginLeft: 4 }}>
                <span className="material-icons">warning_amber</span>
                Avanzado
              </span>
            )}
            {current.ai && (
              <span className="tlr-chip-ai" style={{ marginLeft: 4 }}>
                <span className="material-icons">auto_awesome</span>
                Hermes asiste
              </span>
            )}
          </div>
        </div>
        <div className="tlr-ws-body">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                  <Loader />
                </div>
              }
            >
              {renderWorkspace(current.id)}
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // ── Render: portada del Taller ──────────────────────────────────────────────
  return (
    <div className="tlr">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="tlr-wrap">
        <header className="tlr-head">
          <span className="eyebrow">Taller · administración PPS</span>
          <h1 className="serif">Taller</h1>
          <p>Herramientas para mantener el sistema al día, ordenadas por lo que necesitás hacer.</p>
        </header>

        {visibleFamilies.map((family) => (
          <section key={family.id} className="tlr-section">
            <div className="tlr-section-head">
              <span className="material-icons">{family.icon}</span>
              <span className="eyebrow">{family.label}</span>
            </div>
            {family.note && (
              <div className="tlr-adv-note">
                <span className="material-icons">info</span>
                <span>{family.note}</span>
              </div>
            )}
            <div className="tlr-grid">
              {family.tools.map((tool, i) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  index={i}
                  stat={tool.statKey ? stats?.[tool.statKey] : undefined}
                  onOpen={() => setActiveTool(tool.id)}
                />
              ))}
            </div>
          </section>
        ))}

        <footer className="tlr-foot">
          <div className="meta">Mi Panel Académico · PPS · UFLO Psicología</div>
          <div
            className="meta mono"
            style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11 }}
          >
            <span>Taller v1</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="dot-live" /> Hermes online
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default TallerView;
