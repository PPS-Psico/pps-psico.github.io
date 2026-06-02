/**
 * LanzadorView — Rediseño v4 (Paper & Ink editorial — nueva capa visual)
 *
 * Layout: sidebar colapsable izquierdo + canvas central por estado.
 *
 * Estados mapeados desde la DB:
 *   'Oculto'    → borrador
 *   'Abierta'   → abierta
 *   'Cerrado'   → cerrada (sin seleccionados) | seleccionada (con seleccionados en convocatorias)
 *   'Activa'    → activa
 *   'Archivado' → archivada
 *
 * NOTA: Los sub-componentes internos (SeleccionadorConvocatorias,
 * SeguroGenerator, LanzadorConvocatorias) no se modifican. Solo cambia la
 * capa visual que los envuelve.
 */
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useLocation } from "react-router-dom";
import { db } from "../../lib/db";
import { supabase } from "../../lib/supabaseClient";
import { useModal } from "../../contexts/ModalContext";
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
} from "../../constants";
import { deriveBucket } from "../../services";
import { normalizeStringForComparison, formatDate } from "../../utils/formatters";
import { parseSchedules, normalizeSchedule } from "../../utils/scheduleUtils";
import type { LanzamientoPPS } from "../../types";
import RecordEditModal from "../../components/admin/RecordEditModal";
import { LAUNCH_TABLE_CONFIG } from "../../components/admin/LanzadorConvocatorias";
import { logger } from "../../utils/logger";
// Estilos scoped (.lv4) — importar este módulo inyecta el CSS una sola vez.
import "./lanzador/lanzadorStyles";
import {
  type UIState,
  type SidebarBucket,
  STATE_META,
  PIPELINE_STEPS,
  BUCKET_META,
  BUCKET_ORDER,
  mapDbToUiState,
  inscripcionVencida,
} from "./lanzador/lanzadorState";

const LanzadorConvocatorias = lazy(() => import("../../components/admin/LanzadorConvocatorias"));
const SeleccionadorConvocatorias = lazy(
  () => import("../../components/admin/SeleccionadorConvocatorias")
);
const SeguroGenerator = lazy(() => import("../../components/admin/SeguroGenerator"));

// ─── Micro-components ─────────────────────────────────────────────────────────

const Dot: React.FC<{ state: UIState }> = ({ state }) => (
  <div className={`lv4-dot lv4-dot-${state}`} />
);

const Chip: React.FC<{ state: UIState }> = ({ state }) => (
  <span className={`lv4-chip lv4-chip-${state}`}>
    <Dot state={state} />
    {STATE_META[state].label}
  </span>
);

const Pipeline: React.FC<{ state: UIState }> = ({ state }) => {
  const step = Math.min(STATE_META[state].step, 5);
  return (
    <div className="lv4-pipeline">
      {PIPELINE_STEPS.map((name, i) => {
        const s = i + 1;
        const done = s < step;
        const active = s === step;
        return (
          <div
            key={name}
            className={`lv4-pipe-step ${done ? "ps-done" : ""} ${active ? "ps-active" : ""}`}
          >
            <span className="lv4-pipe-num">{done ? "✓" : String(s).padStart(2, "0")}</span>
            <span className="lv4-pipe-name">{name}</span>
          </div>
        );
      })}
    </div>
  );
};

const Loader: React.FC = () => (
  <div className="lv4-loader">
    <span
      className="material-icons"
      style={{
        fontSize: 18,
        animation: "lv4-spin 1s linear infinite",
        color: "var(--ink-3)",
        marginRight: 8,
      }}
    >
      refresh
    </span>
    <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Cargando…</span>
  </div>
);

// ─── MiniSpark — sparkline inline (tendencia de inscripción) ───────────────────
const MiniSpark: React.FC<{ values: number[]; w?: number; h?: number; color?: string }> = ({
  values,
  w = 320,
  h = 48,
  color = "var(--ink)",
}) => {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, h - ((v - min) / range) * (h - 8) - 4] as const);
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const fill = `M 0 ${h} ${path.slice(2)} L ${w} ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <path d={fill} fill={color} opacity={0.06} />
      <path
        d={path}
        stroke={color}
        fill="none"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarEntry {
  id: string;
  nombre: string | null;
  uiState: UIState;
  bucket: SidebarBucket;
  orientacion: string | null;
  metaLine: string;
  needsAction: boolean;
  seguroGestionado: boolean;
}

interface SidebarProps {
  entries: SidebarEntry[];
  selectedId: string | null;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onToggleCollapsed: () => void;
}

const LanzadorSidebar: React.FC<SidebarProps> = ({
  entries,
  selectedId,
  collapsed,
  onSelect,
  onNew,
  onToggleCollapsed,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<SidebarBucket>>(
    () => new Set(BUCKET_ORDER.filter((b) => BUCKET_META[b].collapsedByDefault))
  );
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      (e) =>
        (e.nombre || "").toLowerCase().includes(q) ||
        (e.orientacion || "").toLowerCase().includes(q)
    );
  }, [entries, query]);

  const groups = useMemo(
    () =>
      BUCKET_ORDER.map((k) => ({
        key: k,
        items: filtered.filter((e) => e.bucket === k),
      })).filter((g) => g.items.length > 0),
    [filtered]
  );

  const toggleGroup = (k: SidebarBucket) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // ── Collapsed rail ──────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="lv4-aside collapsed">
        <button
          onClick={onToggleCollapsed}
          className="lv4-icon-btn"
          title="Expandir lista"
          style={{ margin: "14px auto 8px", width: 36, height: 36, justifyContent: "center" }}
        >
          <span className="material-icons" style={{ fontSize: 20 }}>
            chevron_right
          </span>
        </button>
        <button
          onClick={onNew}
          className="lv4-icon-btn"
          title="Nueva convocatoria"
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            margin: "0 auto",
            width: 36,
            height: 36,
            borderRadius: 8,
            justifyContent: "center",
          }}
        >
          <span className="material-icons" style={{ fontSize: 18 }}>
            add
          </span>
        </button>
        <div className="lv4-groups" style={{ paddingTop: 8 }}>
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={onToggleCollapsed}
              title={`${BUCKET_META[g.key].label}: ${g.items.length}`}
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "10px 0",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <div className={`lv4-dot lv4-dot-${BUCKET_META[g.key].tone}`} />
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ink-4)" }}>
                {g.items.length}
              </span>
            </button>
          ))}
        </div>
      </aside>
    );
  }

  // ── Full sidebar ────────────────────────────────────────────────────────
  return (
    <aside className="lv4-aside">
      {/* Header */}
      <div className="lv4-aside-head">
        <div className="lv4-aside-title">
          <h2>Convocatorias</h2>
          <button className="lv4-icon-btn" onClick={onToggleCollapsed} title="Plegar">
            <span className="material-icons" style={{ fontSize: 18 }}>
              chevron_left
            </span>
          </button>
        </div>
        <button className="lv4-btn-new" onClick={onNew}>
          <span className="material-icons" style={{ fontSize: 16 }}>
            add
          </span>
          Nueva convocatoria
        </button>
        <div className="lv4-search-wrap">
          <span className="material-icons lv4-search-icon">search</span>
          <input
            className="lv4-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar…"
          />
        </div>
      </div>

      {/* Groups */}
      <div className="lv4-groups">
        {groups.map((g) => {
          const isGroupCollapsed = collapsedGroups.has(g.key);
          return (
            <div key={g.key}>
              <button className="lv4-group-head" onClick={() => toggleGroup(g.key)}>
                <span className="lv4-group-label">
                  <span
                    className="material-icons"
                    style={{
                      fontSize: 14,
                      transition: "transform .15s",
                      transform: isGroupCollapsed ? "rotate(-90deg)" : "rotate(0)",
                      color: "var(--ink-4)",
                    }}
                  >
                    expand_more
                  </span>
                  {BUCKET_META[g.key].label}
                </span>
                <span className="lv4-group-count">{g.items.length}</span>
              </button>

              {!isGroupCollapsed &&
                g.items.map((entry) => (
                  <div
                    key={entry.id}
                    className={`lv4-row ${selectedId === entry.id ? "active" : ""}`}
                    onClick={() => onSelect(entry.id)}
                  >
                    <div className={`lv4-dot lv4-dot-${entry.uiState}`} />
                    <div style={{ minWidth: 0 }}>
                      <div className="lv4-row-name">
                        {entry.nombre || (
                          <span style={{ fontStyle: "italic", color: "var(--ink-4)" }}>
                            Sin nombre
                          </span>
                        )}
                        {entry.seguroGestionado && (
                          <span
                            className="lv4-seguro-badge"
                            title="Seguro gestionado"
                            aria-label="Seguro gestionado"
                          >
                            <span className="material-icons">verified_user</span>
                          </span>
                        )}
                      </div>
                      {entry.orientacion && <div className="lv4-row-sub">{entry.orientacion}</div>}
                      <div className="lv4-row-meta">{entry.metaLine}</div>
                    </div>
                    {entry.needsAction && <div className="lv4-badge-attn">!</div>}
                  </div>
                ))}
            </div>
          );
        })}

        {groups.length === 0 && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: "var(--ink-4)",
              fontSize: 13,
            }}
          >
            No se encontraron convocatorias.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="lv4-aside-foot">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-3)",
          }}
        >
          <span className="material-icons" style={{ fontSize: 14, color: "var(--ok)" }}>
            cloud_done
          </span>
          Sincronizado
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-4)", fontFamily: "monospace" }}>
          {entries.length} total
        </span>
      </div>
    </aside>
  );
};

// ─── Canvas header ────────────────────────────────────────────────────────────

interface CanvasHeaderProps {
  launch: LanzamientoPPS;
  uiState: UIState;
  primaryAction?: { label: string; icon: string; onClick: () => void; disabled?: boolean };
  secondaryActions?: Array<{ label: string; icon: string; onClick: () => void }>;
}

const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  launch,
  uiState,
  primaryAction,
  secondaryActions = [],
}) => {
  const nombre = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;
  const orientacion = launch[FIELD_ORIENTACION_LANZAMIENTOS] as string | null;
  const orientaciones = orientacion
    ? orientacion
        .split(/[,/]/)
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="lv4-canvas-head">
      {/* Row 1: chip + orientacion + ID */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Chip state={uiState} />
        {orientaciones.length > 0 && (
          <span
            className="lv4-chip"
            style={{
              background: "transparent",
              border: "1px solid var(--rule-3)",
              color: "var(--ink-3)",
            }}
          >
            <span className="material-icons" style={{ fontSize: 13 }}>
              school
            </span>
            {orientaciones[0]}
            {orientaciones.length > 1 ? ` +${orientaciones.length - 1}` : ""}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontFamily: "monospace",
            color: "var(--ink-4)",
          }}
        >
          ID {String(launch.id).slice(0, 8).toUpperCase()}
        </span>
      </div>

      {/* Row 2: title + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 33,
              fontWeight: 400,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
              fontFamily: "'Instrument Serif', Georgia, serif",
            }}
          >
            {nombre || (
              <span style={{ color: "var(--ink-4)", fontWeight: 400, fontStyle: "italic" }}>
                Convocatoria sin nombre
              </span>
            )}
          </h1>
          {orientaciones.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {orientaciones.map((o) => (
                <span key={o} className="lv4-orient-chip">
                  {o}
                </span>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            marginTop: 2,
          }}
        >
          {secondaryActions.map((a, i) => (
            <button key={i} className="lv4-btn" onClick={a.onClick}>
              <span className="material-icons" style={{ fontSize: 14 }}>
                {a.icon}
              </span>
              {a.label}
            </button>
          ))}
          {primaryAction && (
            <button
              className="lv4-btn lv4-btn-primary"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                {primaryAction.icon}
              </span>
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>

      {/* Row 3: pipeline */}
      {uiState !== "archivada" && <Pipeline state={uiState} />}
    </div>
  );
};

// ─── BorradorView ─────────────────────────────────────────────────────────────

interface BorradorViewProps {
  launch: LanzamientoPPS;
  onPublish: () => void;
  onRefresh: () => void;
}

function buildWhatsappFromLaunch(launch: LanzamientoPPS): string {
  const nombre = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;
  const orientacion = launch[FIELD_ORIENTACION_LANZAMIENTOS] as string | null;
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const fechaInicio = launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const fechaFin = launch[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;
  const fechaFinInsc = launch[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
  const descripcion = launch[FIELD_DESCRIPCION_LANZAMIENTOS] as string | null;
  const direccion = launch[FIELD_DIRECCION_LANZAMIENTOS] as string | null;
  const horario = launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] as string | null;

  const lines: string[] = [];
  lines.push(`📣 *¡Nueva Convocatoria PPS${nombre ? `: ${nombre}` : ""}!* 📣`);
  lines.push("");
  if (orientacion) lines.push(`🎓 *Orientación:* ${orientacion}`);
  if (direccion) lines.push(`📍 *Lugar:* ${direccion}`);
  if (cupos) lines.push(`👥 *Cupos:* ${cupos}`);
  if (horario) lines.push(`🕒 *Horario:* ${horario}`);
  lines.push("");
  if (fechaFinInsc) lines.push(`📅 *Inscripción hasta:* ${formatDate(fechaFinInsc)}`);
  if (fechaInicio) lines.push(`🚀 *Inicio práctica:* ${formatDate(fechaInicio)}`);
  if (fechaFin) lines.push(`🏁 *Fin práctica:* ${formatDate(fechaFin)}`);
  if (descripcion) {
    lines.push("");
    lines.push(`🎯 *Sobre la práctica:*`);
    lines.push(descripcion);
  }
  lines.push("");
  lines.push(`🔗 Inscribite en tu panel: *pps.psico.uflo.edu.ar*`);
  return lines.join("\n");
}

const BorradorView: React.FC<BorradorViewProps> = ({ launch, onPublish, onRefresh }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waCopied, setWaCopied] = useState(false);
  const queryClient = useQueryClient();

  const nombre = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;
  const orientacion = launch[FIELD_ORIENTACION_LANZAMIENTOS] as string | null;
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const fechaInicio = launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const fechaFin = launch[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;
  const fechaInicioInsc = launch[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS] as string | null;
  const fechaFinInsc = launch[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
  const descripcion = launch[FIELD_DESCRIPCION_LANZAMIENTOS] as string | null;
  const horario = launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] as string | null;
  const mensajeWa =
    (launch[FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS] as string | null) ||
    buildWhatsappFromLaunch(launch);

  const campos = [
    { label: "Nombre PPS", value: nombre, icon: "label", required: true },
    { label: "Orientación", value: orientacion, icon: "school", required: true },
    {
      label: "Cupos disponibles",
      value: cupos !== null ? String(cupos) : null,
      icon: "group",
      required: true,
    },
    {
      label: "Fecha inicio PPS",
      value: fechaInicio ? formatDate(fechaInicio) : null,
      icon: "event",
      required: true,
    },
    {
      label: "Fecha fin PPS",
      value: fechaFin ? formatDate(fechaFin) : null,
      icon: "event_available",
      required: true,
    },
    {
      label: "Inicio inscripción",
      value: fechaInicioInsc ? formatDate(fechaInicioInsc) : null,
      icon: "calendar_today",
    },
    {
      label: "Cierre inscripción",
      value: fechaFinInsc ? formatDate(fechaFinInsc) : null,
      icon: "calendar_month",
    },
    { label: "Horario", value: horario, icon: "schedule" },
    { label: "Descripción", value: descripcion ? "Definida" : null, icon: "description" },
  ];

  const requiredFilled = [nombre, orientacion, cupos, fechaInicio, fechaFin].filter(Boolean).length;
  const totalRequired = 5;
  const pct = Math.round((requiredFilled / totalRequired) * 100);
  const isReady = pct >= 80;

  const handleSave = async (recordId: string | null, fields: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (recordId) {
        await db.lanzamientos.update(recordId, fields);
        await queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setSaving(false);
      setEditOpen(false);
      onRefresh();
    }
  };

  const copyWa = async () => {
    try {
      await navigator.clipboard.writeText(mensajeWa);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 1800);
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="borrador"
        primaryAction={{
          label: "Lanzar ahora",
          icon: "rocket_launch",
          onClick: onPublish,
          disabled: !isReady,
        }}
        secondaryActions={[
          {
            label: saved ? "¡Guardado!" : "Editar datos",
            icon: "edit",
            onClick: () => setEditOpen(true),
          },
        ]}
      />
      <div className="lv4-canvas-body">
        {/* Completitud banner */}
        <div
          className="lv4-banner"
          style={{
            borderColor: isReady ? "var(--ok)" : "var(--rule-3)",
            background: isReady ? "var(--ok-s)" : "var(--paper-2)",
          }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: isReady ? "var(--ok)" : "var(--ink-4)", marginTop: 1 }}
          >
            {isReady ? "check_circle" : "edit_note"}
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: isReady ? "var(--ok)" : "var(--ink-2)",
                marginBottom: 6,
              }}
            >
              {isReady ? "Listo para lanzar" : "Borrador en preparación"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="lv4-progress-track">
                <div
                  className="lv4-progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: isReady ? "var(--ok)" : "var(--accent)",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "var(--ink-3)",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {pct}%
              </span>
            </div>
            {!isReady && (
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>
                Faltan:{" "}
                {campos
                  .filter((c) => c.required && !c.value)
                  .map((c) => c.label)
                  .join(", ")}
              </div>
            )}
          </div>
          <button className="lv4-btn" onClick={() => setEditOpen(true)} style={{ flexShrink: 0 }}>
            <span className="material-icons" style={{ fontSize: 14 }}>
              edit
            </span>
            Editar
          </button>
        </div>

        {/* Campo cards */}
        <div className="lv4-eyebrow" style={{ marginBottom: 10 }}>
          Datos del borrador
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {campos.map((c) => (
            <div
              key={c.label}
              className="lv4-field-card"
              style={{
                borderColor: !c.value && c.required ? "var(--warn)" : "var(--rule-2)",
              }}
            >
              <div className="lv4-field-label">
                <span className="material-icons" style={{ fontSize: 12 }}>
                  {c.icon}
                </span>
                {c.label}
              </div>
              <div
                className="lv4-field-val"
                style={{
                  color: c.value ? "var(--ink-2)" : "var(--ink-4)",
                  fontStyle: c.value ? "normal" : "italic",
                }}
              >
                {c.value ||
                  (c.required ? (
                    <span
                      style={{
                        color: "var(--warn)",
                        fontStyle: "normal",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      ⚠ Sin completar
                    </span>
                  ) : (
                    "—"
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* WhatsApp preview */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div>
              <div className="lv4-eyebrow">Difusión</div>
              <div className="lv4-section-title" style={{ marginBottom: 0 }}>
                Mensaje WhatsApp
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="lv4-btn" onClick={() => setWaOpen((o) => !o)}>
                <span className="material-icons" style={{ fontSize: 14 }}>
                  {waOpen ? "visibility_off" : "visibility"}
                </span>
                {waOpen ? "Ocultar" : "Ver"}
              </button>
              {waOpen && (
                <button className="lv4-btn" onClick={copyWa}>
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    content_copy
                  </span>
                  {waCopied ? "¡Copiado!" : "Copiar"}
                </button>
              )}
            </div>
          </div>
          {waOpen && <div className="lv4-wa-bubble">{mensajeWa}</div>}
          {!waOpen && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--rule-2)",
                background: "var(--paper-2)",
                fontSize: 13,
                color: "var(--ink-3)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span className="material-icons" style={{ fontSize: 18, color: "#25D366" }}>
                chat
              </span>
              Generá el mensaje WhatsApp listo para compartir con los estudiantes.
            </div>
          )}
        </div>
      </div>

      <RecordEditModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        record={launch as Record<string, unknown>}
        tableConfig={LAUNCH_TABLE_CONFIG}
        onSave={handleSave}
        isSaving={saving}
      />
    </div>
  );
};

// ─── SeleccionView ──────────────────────────────────────────────────────────────
// State "seleccion" = DB 'Abierta' (mesa abierta). Muestra estadísticas de
// inscripción, tendencia y botón "Cerrar inscripción". Cuando el admin cierra la
// mesa, el lanzamiento pasa al state "seguro" (SeguroView).

const SeleccionView: React.FC<{ launch: LanzamientoPPS; onCerrarInscripcion: () => void }> = ({
  launch,
  onCerrarInscripcion,
}) => {
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const fechaFin = launch[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;

  const { data: inscriptos = [] } = useQuery({
    queryKey: ["inscriptosForLaunch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select("id, estado_inscripcion, estudiante_id, horario_asignado, created_at")
        .eq("lanzamiento_id", launch.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Latest inscriptos (ids + horario + timestamp)
  const { data: lastConvs = [] } = useQuery({
    queryKey: ["lastConvsForLaunch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select("id, horario_asignado, created_at, estudiante_id")
        .eq("lanzamiento_id", launch.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return (data || []) as Array<{
        id: string;
        horario_asignado: string | null;
        created_at: string;
        estudiante_id: string | null;
      }>;
    },
  });

  // Student names for those IDs (separate query to avoid FK ambiguity)
  const estudianteIds = lastConvs.map((c) => c.estudiante_id).filter(Boolean) as string[];
  const { data: estudiantesMap = {} } = useQuery({
    queryKey: ["estudiantesNombres", estudianteIds.join(",")],
    queryFn: async () => {
      if (estudianteIds.length === 0) return {};
      const { data } = await supabase
        .from("estudiantes")
        .select("id, nombre")
        .in("id", estudianteIds);
      const map: Record<string, string | null> = {};
      (data || []).forEach((e: { id: string; nombre: string | null }) => {
        map[e.id] = e.nombre;
      });
      return map;
    },
    enabled: estudianteIds.length > 0,
  });

  // Merge for render
  const inscriptosNombres = lastConvs.map((c) => ({
    id: c.id,
    horario_asignado: c.horario_asignado,
    created_at: c.created_at,
    nombre: c.estudiante_id ? (estudiantesMap[c.estudiante_id] ?? null) : null,
  }));

  const total = inscriptos.length;
  const seleccionados = inscriptos.filter(
    (i) => normalizeStringForComparison(i.estado_inscripcion) === "seleccionado"
  ).length;

  // ── Salud por franja horaria ──────────────────────────────────────────────
  // Parseamos las franjas declaradas en el lanzamiento y contamos inscriptos por
  // franja (matcheando su horario_asignado). Se muestra en la grilla visual
  // más abajo; ya no disparamos un banner de "Falta gente" porque confundía al
  // coordinador cuando los cupos totales ya estaban cubiertos.
  const horarioStr = launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] as string | null;
  const horarioHealth = useMemo(() => {
    const slots = parseSchedules(horarioStr);
    if (slots.length === 0) return [];
    const cuposPorSlot = cupos ? Math.max(1, Math.round(cupos / slots.length)) : null;
    return slots.map((slot) => {
      const norm = normalizeSchedule(slot);
      const count = inscriptos.filter((i) => {
        const h = (i as { horario_asignado?: string | null }).horario_asignado;
        return h && normalizeSchedule(h) === norm;
      }).length;
      const pct = cuposPorSlot ? count / cuposPorSlot : 0;
      const status: "low" | "ok" | "full" =
        cuposPorSlot && count === 0 ? "low" : pct >= 1 ? "full" : pct >= 0.5 ? "ok" : "low";
      return { label: slot, count, cuposLocal: cuposPorSlot, pct, status };
    });
  }, [horarioStr, inscriptos, cupos]);

  // ── Tendencia de inscripción (acumulada en buckets temporales) ────────────
  const inscripcionTrend = useMemo(() => {
    const times = inscriptos
      .map((i) => new Date((i as { created_at: string }).created_at).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);
    if (times.length < 2) return [];
    const first = times[0];
    const last = times[times.length - 1];
    const span = Math.max(1, last - first);
    const buckets = Math.min(12, Math.max(4, times.length));
    const counts = new Array(buckets).fill(0);
    times.forEach((t) => {
      const idx = Math.min(buckets - 1, Math.floor(((t - first) / span) * (buckets - 1)));
      counts[idx] += 1;
    });
    let acc = 0;
    return counts.map((c) => (acc += c));
  }, [inscriptos]);

  // ── Difusión: link público + mensaje WhatsApp ─────────────────────────────
  const publicLink = "pps.psico.uflo.edu.ar";
  const waMessage =
    (launch[FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS] as string | null) ||
    buildWhatsappFromLaunch(launch);
  const [linkCopied, setLinkCopied] = useState(false);
  const [waCopied, setWaCopied] = useState(false);
  const copyText = async (text: string, which: "link" | "wa") => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "link") {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1800);
      } else {
        setWaCopied(true);
        setTimeout(() => setWaCopied(false), 1800);
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const iniciales = (nombre: string | null) => {
    if (!nombre) return "?";
    return nombre
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "hace menos de 1h";
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  };

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="seleccion"
        primaryAction={{ label: "Cerrar inscripción", icon: "lock", onClick: onCerrarInscripcion }}
        secondaryActions={[{ label: "Editar", icon: "edit", onClick: () => {} }]}
      />
      <div className="lv4-canvas-body">
        {/* Stats */}
        <div className="lv4-stats" style={{ marginBottom: 20 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Inscriptos</div>
            <div className="lv4-stat-val" style={{ color: "var(--accent)" }}>
              {total}
            </div>
            <div className="lv4-stat-hint">postulados</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Cupos</div>
            <div className="lv4-stat-val">{cupos ?? "—"}</div>
            <div className="lv4-stat-hint">disponibles</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Ocupación</div>
            <div className="lv4-stat-val" style={{ fontSize: 20, paddingTop: 4 }}>
              {cupos ? `${Math.round((total / cupos) * 100)}%` : "—"}
            </div>
            <div className="lv4-stat-hint">del total de cupos</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Cierre inscripción</div>
            <div className="lv4-stat-val" style={{ fontSize: 16, paddingTop: 6 }}>
              {fechaFin ? formatDate(fechaFin) : "—"}
            </div>
            <div className="lv4-stat-hint">fecha límite</div>
          </div>
        </div>

        {/* Tendencia de inscripción (sparkline) */}
        {inscripcionTrend.length >= 2 && (
          <div
            style={{
              border: "1px solid var(--rule-2)",
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span className="lv4-eyebrow" style={{ marginBottom: 0 }}>
                Ritmo de inscripción
              </span>
              <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>acumulado en el tiempo</span>
            </div>
            <MiniSpark values={inscripcionTrend} color="var(--accent)" />
          </div>
        )}

        {/* Acción principal — el orden recomendado es revisar la mesa primero
           y cerrar al final. El banner avisa cuántos cupos quedan por cubrir
           y ofrece un atajo para bajar a la mesa. */}
        <div
          className="lv4-banner"
          style={{ borderColor: "var(--rule-2)", background: "var(--paper-2)" }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: "var(--ink-3)", marginTop: 2 }}
          >
            lock
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {total} candidato{total !== 1 ? "s" : ""} para {cupos ?? "?"} cupos
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              RevIsá la mesa de selección abajo y, cuando termines de elegir, cerrá la inscripción
              para enviar los consentimientos.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              className="lv4-btn"
              onClick={() => {
                document
                  .getElementById("mesa-seleccion")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                arrow_downward
              </span>
              Ir a la mesa
            </button>
            <button className="lv4-btn lv4-btn-primary" onClick={onCerrarInscripcion}>
              <span className="material-icons" style={{ fontSize: 14 }}>
                lock
              </span>
              Cerrar inscripción
            </button>
          </div>
        </div>

        {/* Salud por franja horaria */}
        {horarioHealth.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div className="lv4-eyebrow">Lo importante hoy</div>
            <div className="lv4-section-title">Salud por franja horaria</div>
            <div className="lv4-horario-grid">
              {horarioHealth.map((h, idx) => {
                const toneColor =
                  h.status === "low"
                    ? "var(--warn)"
                    : h.status === "full"
                      ? "var(--ok)"
                      : "var(--accent)";
                return (
                  <div key={idx} className={`lv4-horario-card${h.status === "low" ? " low" : ""}`}>
                    <div className="lv4-horario-head">
                      <span className="lv4-horario-label">{h.label}</span>
                      {h.status === "low" && (
                        <span
                          className="material-icons"
                          style={{ fontSize: 18, color: "var(--warn)" }}
                        >
                          warning
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 24,
                          fontWeight: 400,
                          color: toneColor,
                          lineHeight: 1,
                        }}
                      >
                        {h.count}
                      </span>
                      {h.cuposLocal && (
                        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
                          de {h.cuposLocal} cupos
                        </span>
                      )}
                    </div>
                    <div className="lv4-horario-track">
                      <div
                        className="lv4-horario-fill"
                        style={{
                          width: `${Math.min(100, h.pct * 100)}%`,
                          background: toneColor,
                        }}
                      />
                    </div>
                    {h.status === "low" && (
                      <div className="lv4-horario-foot">
                        Probablemente quede vacía si no se difunde con foco en este día.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Difusión: link público + WhatsApp */}
        <div style={{ marginTop: 28 }}>
          <div className="lv4-eyebrow">Difusión</div>
          <div className="lv4-section-title">Compartir la convocatoria</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div className="lv4-linkbox">
              <span
                className="lv4-stat-label"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span className="material-icons" style={{ fontSize: 14, color: "var(--ink-4)" }}>
                  link
                </span>
                Link público
              </span>
              <div className="lv4-link-url">{publicLink}</div>
              <button
                className="lv4-btn"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => copyText(publicLink, "link")}
              >
                <span className="material-icons" style={{ fontSize: 14 }}>
                  {linkCopied ? "check" : "content_copy"}
                </span>
                {linkCopied ? "¡Copiado!" : "Copiar link"}
              </button>
            </div>
            <div className="lv4-linkbox">
              <span
                className="lv4-stat-label"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span className="material-icons" style={{ fontSize: 14, color: "#25D366" }}>
                  chat
                </span>
                Mensaje WhatsApp
              </span>
              <div className="lv4-link-url" style={{ maxHeight: 48, overflow: "hidden" }}>
                {waMessage.split("\n")[0]}…
              </div>
              <button
                className="lv4-btn"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => copyText(waMessage, "wa")}
              >
                <span className="material-icons" style={{ fontSize: 14 }}>
                  {waCopied ? "check" : "content_copy"}
                </span>
                {waCopied ? "¡Copiado!" : "Copiar mensaje"}
              </button>
            </div>
          </div>
        </div>

        {/* Últimos inscriptos */}
        {inscriptosNombres.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div>
                <div className="lv4-eyebrow">Preselección</div>
                <div className="lv4-section-title">Últimos inscriptos</div>
              </div>
            </div>
            <div
              style={{ border: "1px solid var(--rule-2)", borderRadius: 12, overflow: "hidden" }}
            >
              {inscriptosNombres.map((row) => {
                const nombre = row.nombre ?? null;
                return (
                  <div key={row.id} className="lv4-insc-row">
                    <div className="lv4-avatar">{iniciales(nombre)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
                        {nombre ?? (
                          <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>
                            Sin nombre
                          </span>
                        )}
                      </div>
                      {row.horario_asignado && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--ink-3)",
                            marginTop: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: 12 }}>
                            schedule
                          </span>
                          {row.horario_asignado}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontFamily: "monospace" }}>
                      {relativeTime(row.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mesa de selección (SeleccionadorConvocatorias)
           Ya no hace falta cerrar la inscripción para ver / marcar estudiantes:
           el admin puede elegir acá mismo y, cuando termine, recién cerrar
           la inscripción desde el botón del header. La PPS sigue en `Abierta`
           en la DB hasta ese cierre formal (los `seleccionado` crean la
           práctica vía trigger pero NO disparan emails hasta el cierre). */}
        <div id="mesa-seleccion" style={{ marginTop: 32, scrollMarginTop: 80 }}>
          <div className="lv4-eyebrow">Mesa de selección</div>
          <div className="lv4-section-title">Elegí los estudiantes</div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-3)",
              margin: "0 0 14px",
              maxWidth: 640,
              lineHeight: 1.5,
            }}
          >
            Marcá los estudiantes que van a cursar la PPS. Podés hacerlo ahora y revisar antes de
            cerrar la inscripción. Cuando termines, usá <b>Cerrar inscripción</b> arriba para
            confirmar y enviar los consentimientos.
          </div>
          <Suspense fallback={<Loader />}>
            <SeleccionadorConvocatorias isTestingMode={false} preSelectedLaunchId={launch.id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

// ─── SeguroView ────────────────────────────────────────────────────────────────
// State "seguro" = DB 'Cerrado' (mesa cerrada) + sin marca de seguro. Es la
// etapa donde se eligen los candidatos y se gestiona el seguro antes de pasar
// a la sala de consentimientos.

const SeguroView: React.FC<{
  launch: LanzamientoPPS;
  onNavigateToInsurance: (id: string) => void;
  showModal: ReturnType<typeof useModal>["showModal"];
}> = ({ launch, onNavigateToInsurance, showModal }) => {
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;

  const { data: inscriptos = [] } = useQuery({
    queryKey: ["inscriptos-seguro", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select("id, estado_inscripcion")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  const total = inscriptos.length;
  const seleccionados = inscriptos.filter(
    (i) => normalizeStringForComparison(i.estado_inscripcion) === "seleccionado"
  ).length;

  return (
    <div>
      <CanvasHeader launch={launch} uiState="seguro" />
      <div className="lv4-canvas-body">
        {/* Stats */}
        <div className="lv4-stats" style={{ marginBottom: 24 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Candidatos</div>
            <div className="lv4-stat-val" style={{ color: "var(--warn)" }}>
              {total}
            </div>
            <div className="lv4-stat-hint">inscriptos</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Cupos</div>
            <div className="lv4-stat-val">{cupos ?? "—"}</div>
            <div className="lv4-stat-hint">disponibles</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Seleccionados</div>
            <div
              className="lv4-stat-val"
              style={{ color: seleccionados > 0 ? "var(--ok)" : "var(--ink-4)" }}
            >
              {seleccionados}
            </div>
            <div className="lv4-stat-hint">hasta ahora</div>
          </div>
        </div>

        {/* Banner informativo */}
        <div
          className="lv4-banner"
          style={{ borderColor: "var(--warn)", background: "var(--warn-s)", marginBottom: 28 }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: "var(--warn)", marginTop: 2 }}
          >
            how_to_reg
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--warn)", marginBottom: 3 }}>
              Mesa de selección abierta
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Seleccioná los estudiantes y confirmá para enviar las notificaciones. Son {total}{" "}
              candidatos para {cupos ?? "?"} cupos.
            </div>
          </div>
        </div>

        <Suspense fallback={<Loader />}>
          <SeleccionadorConvocatorias
            isTestingMode={false}
            preSelectedLaunchId={launch.id}
            onNavigateToInsurance={onNavigateToInsurance}
          />
        </Suspense>

        {seleccionados > 0 && (
          <>
            <div className="lv4-eyebrow" style={{ marginBottom: 8 }}>
              Seguros y actas
            </div>
            <Suspense fallback={<Loader />}>
              <SeguroGenerator
                showModal={showModal}
                isTestingMode={false}
                preSelectedLanzamientoId={launch.id}
              />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
};

// ─── ConfirmacionView ─────────────────────────────────────────────────────────
// State "confirmacion" = DB 'Confirmacion' (o 'Cerrado' + marca de seguro).
// Sala de consentimientos: muestra avance de compromisos por estudiante, banner
// de pendientes, y al final un botón "Activar PPS" para transicionar a 'Activa'.
// Reemplaza al viejo SeleccionadaView (que renderizaba también el
// SeguroGenerator — eso ahora vive en SeguroView).

const ConfirmacionView: React.FC<{
  launch: LanzamientoPPS;
  showModal: ReturnType<typeof useModal>["showModal"];
}> = ({ launch, showModal }) => {
  const { data: seleccionados = [] } = useQuery({
    queryKey: ["seleccionadosForLaunch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select("id, estado_inscripcion, estudiante_id, horario_asignado")
        .eq("lanzamiento_id", launch.id)
        .eq("estado_inscripcion", "seleccionado");
      return data || [];
    },
  });

  const { data: compromisos = [] } = useQuery({
    queryKey: ["compromisosForLaunch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("compromisos_pps")
        .select("estado, convocatoria_id, accepted_at")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  // Nombres de los seleccionados (query aparte para evitar ambigüedad de FK)
  const selEstudianteIds = seleccionados
    .map((s) => (s as { estudiante_id?: string | null }).estudiante_id)
    .filter(Boolean) as string[];
  const { data: selNombresMap = {} } = useQuery({
    queryKey: ["seleccionadosNombres", selEstudianteIds.join(",")],
    queryFn: async () => {
      if (selEstudianteIds.length === 0) return {};
      const { data } = await supabase
        .from("estudiantes")
        .select("id, nombre")
        .in("id", selEstudianteIds);
      const map: Record<string, string | null> = {};
      (data || []).forEach((e: { id: string; nombre: string | null }) => {
        map[e.id] = e.nombre;
      });
      return map;
    },
    enabled: selEstudianteIds.length > 0,
  });

  const confirmados = compromisos.filter(
    (c) => normalizeStringForComparison(c.estado) === "aceptado"
  ).length;
  const pendientes = seleccionados.length - confirmados;
  const consentPct =
    seleccionados.length > 0 ? Math.round((confirmados / seleccionados.length) * 100) : 0;

  // Mapa convocatoria_id → compromiso (estado + fecha) para el tracker por alumno
  const compromisoByConv = useMemo(() => {
    const map: Record<string, { estado: string | null; accepted_at: string | null }> = {};
    compromisos.forEach((c) => {
      const cid = (c as { convocatoria_id?: string | null }).convocatoria_id;
      if (cid)
        map[cid] = {
          estado: (c as { estado?: string | null }).estado ?? null,
          accepted_at: (c as { accepted_at?: string | null }).accepted_at ?? null,
        };
    });
    return map;
  }, [compromisos]);

  // Lista por alumno: confirmados primero por fecha, pendientes al final
  const consentRows = useMemo(() => {
    return seleccionados
      .map((s) => {
        const conv = s as {
          id: string;
          estudiante_id?: string | null;
          horario_asignado?: string | null;
        };
        const comp = compromisoByConv[conv.id];
        const accepted = comp ? normalizeStringForComparison(comp.estado) === "aceptado" : false;
        return {
          id: conv.id,
          nombre: conv.estudiante_id ? (selNombresMap[conv.estudiante_id] ?? null) : null,
          horario: conv.horario_asignado ?? null,
          accepted,
          acceptedAt: comp?.accepted_at ?? null,
        };
      })
      .sort((a, b) => {
        if (a.accepted !== b.accepted) return a.accepted ? 1 : -1; // pendientes arriba
        return (a.nombre || "").localeCompare(b.nombre || "");
      });
  }, [seleccionados, compromisoByConv, selNombresMap]);

  const iniciales = (nombre: string | null) =>
    !nombre
      ? "?"
      : nombre
          .split(" ")
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();

  const fmtAccepted = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  return (
    <div>
      <CanvasHeader launch={launch} uiState="confirmacion" />
      <div className="lv4-canvas-body">
        {/* Stats compromisos */}
        <div className="lv4-stats" style={{ marginBottom: 24 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Seleccionados</div>
            <div className="lv4-stat-val">{seleccionados.length}</div>
            <div className="lv4-stat-hint">estudiantes</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Consintieron</div>
            <div className="lv4-stat-val" style={{ color: "var(--ok)" }}>
              {confirmados}
            </div>
            <div className="lv4-stat-hint">compromiso digital</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Pendientes</div>
            <div
              className="lv4-stat-val"
              style={{ color: pendientes > 0 ? "var(--warn)" : "var(--ok)" }}
            >
              {pendientes}
            </div>
            <div className="lv4-stat-hint">sin firmar</div>
          </div>
        </div>

        {/* Progreso de consentimientos */}
        {seleccionados.length > 0 && (
          <div
            style={{
              border: "1px solid var(--rule-2)",
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span className="lv4-eyebrow" style={{ marginBottom: 0 }}>
                Avance de consentimientos
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  fontWeight: 600,
                  color: consentPct === 100 ? "var(--ok)" : "var(--warn)",
                }}
              >
                {confirmados}/{seleccionados.length} · {consentPct}%
              </span>
            </div>
            <div className="lv4-progress-track">
              <div
                className="lv4-progress-fill"
                style={{
                  width: `${consentPct}%`,
                  background: consentPct === 100 ? "var(--ok)" : "var(--warn)",
                }}
              />
            </div>
          </div>
        )}

        {/* Banner estado */}
        {pendientes > 0 ? (
          <div
            className="lv4-banner"
            style={{ borderColor: "var(--warn)", background: "var(--warn-s)", marginBottom: 28 }}
          >
            <span
              className="material-icons"
              style={{ fontSize: 20, color: "var(--warn)", marginTop: 2 }}
            >
              pending_actions
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--warn)", marginBottom: 3 }}>
                {pendientes} compromiso{pendientes !== 1 ? "s" : ""} pendiente
                {pendientes !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                Los estudiantes seleccionados deben aceptar el compromiso digital. El sistema les
                envía recordatorio automático.
              </div>
            </div>
          </div>
        ) : (
          <div
            className="lv4-banner"
            style={{ borderColor: "var(--ok)", background: "var(--ok-s)", marginBottom: 28 }}
          >
            <span
              className="material-icons"
              style={{ fontSize: 20, color: "var(--ok)", marginTop: 2 }}
            >
              check_circle
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ok)", marginBottom: 3 }}>
                Todos los compromisos aceptados
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                Podés proceder a generar los seguros y actas.
              </div>
            </div>
          </div>
        )}

        {/* Tracker de consentimientos por alumno */}
        {consentRows.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="lv4-eyebrow">A asegurar</div>
            <div className="lv4-section-title">Consentimiento por estudiante</div>
            <div
              style={{ border: "1px solid var(--rule-2)", borderRadius: 12, overflow: "hidden" }}
            >
              {consentRows.map((row) => (
                <div key={row.id} className="lv4-insc-row">
                  <div
                    className="lv4-avatar"
                    style={{
                      background: row.accepted ? "var(--ok-s)" : "var(--warn-s)",
                      color: row.accepted ? "var(--ok)" : "var(--warn)",
                      borderColor: "transparent",
                    }}
                  >
                    {iniciales(row.nombre)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
                      {row.nombre ?? (
                        <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>
                          Sin nombre
                        </span>
                      )}
                    </div>
                    {row.horario && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--ink-3)",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: 12 }}>
                          schedule
                        </span>
                        {row.horario}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: row.accepted ? "var(--ok-s)" : "var(--warn-s)",
                      color: row.accepted ? "var(--ok)" : "var(--warn)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 13 }}>
                      {row.accepted ? "verified" : "hourglass_empty"}
                    </span>
                    {row.accepted
                      ? `Firmó${row.acceptedAt ? ` · ${fmtAccepted(row.acceptedAt)}` : ""}`
                      : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="lv4-eyebrow" style={{ marginBottom: 8 }}>
          Activar la PPS
        </div>
        <div
          className="lv4-banner"
          style={{
            borderColor: "var(--ok)",
            background: "var(--ok-s)",
            marginBottom: 16,
          }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: "var(--ok)", marginTop: 2 }}
          >
            play_circle
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ok)", marginBottom: 3 }}>
              {pendientes > 0
                ? `${pendientes} compromiso${pendientes !== 1 ? "s" : ""} aún pendiente${
                    pendientes !== 1 ? "s" : ""
                  }`
                : "Todos los compromisos aceptados"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {pendientes > 0
                ? "Podés avanzar igual: la PPS arranca con los confirmados y los pendientes pasan a la lista de reemplazos."
                : "Activá la PPS para marcar el lanzamiento como en curso. Los estudiantes ya están listos."}
            </div>
          </div>
        </div>
        {pendientes > 0 && (
          <button
            className="lv4-btn lv4-btn-ghost"
            style={{ marginBottom: 24 }}
            onClick={() =>
              showModal(
                "Avanzar con pendientes",
                "Esta acción mueve el lanzamiento a Activa aunque haya compromisos sin firmar. Los pendientes podrán ser reemplazados desde la sala de Confirmación."
              )
            }
          >
            <span className="material-icons" style={{ fontSize: 16 }}>
              warning
            </span>
            ¿Por qué hay pendientes?
          </button>
        )}
      </div>
    </div>
  );
};

// ─── ActivaView ───────────────────────────────────────────────────────────────

const ActivaView: React.FC<{ launch: LanzamientoPPS; onArchivar: () => void }> = ({
  launch,
  onArchivar,
}) => {
  const fechaInicio = launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const fechaFin = launch[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;

  const { data: practicas = [] } = useQuery({
    queryKey: ["practicasForLaunch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("practicas")
        .select("id, estado, horas_realizadas")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  const totalHoras = practicas.reduce((sum, p) => sum + ((p.horas_realizadas as number) || 0), 0);
  const activas = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "activa"
  ).length;
  const finalizadas = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "finalizada"
  ).length;

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="activa"
        primaryAction={{ label: "Archivar convocatoria", icon: "archive", onClick: onArchivar }}
      />
      <div className="lv4-canvas-body">
        {/* Stats */}
        <div className="lv4-stats" style={{ marginBottom: 28 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Prácticas activas</div>
            <div className="lv4-stat-val" style={{ color: "var(--ok)" }}>
              {activas}
            </div>
            <div className="lv4-stat-hint">en curso</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Finalizadas</div>
            <div className="lv4-stat-val">{finalizadas}</div>
            <div className="lv4-stat-hint">completadas</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Horas totales</div>
            <div className="lv4-stat-val">{totalHoras}</div>
            <div className="lv4-stat-hint">realizadas</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Período</div>
            <div className="lv4-stat-val" style={{ fontSize: 14, paddingTop: 8 }}>
              {fechaInicio ? formatDate(fechaInicio) : "—"}
            </div>
            <div className="lv4-stat-hint">
              {fechaFin ? `hasta ${formatDate(fechaFin)}` : "sin fecha fin"}
            </div>
          </div>
        </div>

        {/* Estado visual */}
        <div
          className="lv4-banner"
          style={{ borderColor: "var(--ok)", background: "var(--ok-s)", marginBottom: 0 }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 22, color: "var(--ok)", marginTop: 2 }}
          >
            trending_up
          </span>
          <div>
            <div style={{ fontWeight: 600, color: "var(--ok)", marginBottom: 4 }}>
              Prácticas en curso
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {activas} estudiante{activas !== 1 ? "s" : ""} realizando horas actualmente.
              {finalizadas > 0 && ` ${finalizadas} ya completaron.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ArchivadaView ────────────────────────────────────────────────────────────

const ArchivadaView: React.FC<{
  launch: LanzamientoPPS;
  onDuplicar: () => void;
  onReabrir: () => void;
}> = ({ launch, onDuplicar, onReabrir }) => {
  const { data: practicas = [] } = useQuery({
    queryKey: ["practicasForLaunch-arch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("practicas")
        .select("id, estado, horas_realizadas")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  const { data: convocatorias = [] } = useQuery({
    queryKey: ["convocatoriasForLaunch-arch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select("id, estado_inscripcion")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  const inscriptos = convocatorias.length;
  const seleccionados = convocatorias.filter(
    (c) => normalizeStringForComparison(c.estado_inscripcion) === "seleccionado"
  ).length;
  const acreditados = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "finalizada"
  ).length;
  const taxa = seleccionados > 0 ? Math.round((acreditados / seleccionados) * 100) : null;

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="archivada"
        primaryAction={{ label: "Duplicar como base", icon: "content_copy", onClick: onDuplicar }}
      />
      <div className="lv4-canvas-body">
        {/* Banner histórico */}
        <div
          className="lv4-banner"
          style={{ borderColor: "var(--rule-2)", background: "var(--paper-2)", marginBottom: 28 }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: "var(--ink-3)", marginTop: 2 }}
          >
            archive
          </span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Convocatoria archivada</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Este ciclo ha concluido. Los datos quedan como referencia histórica.
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="lv4-stats" style={{ marginBottom: 28 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Inscriptos</div>
            <div className="lv4-stat-val">{inscriptos}</div>
            <div className="lv4-stat-hint">se postularon</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Seleccionados</div>
            <div className="lv4-stat-val">{seleccionados}</div>
            <div className="lv4-stat-hint">comenzaron</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Acreditados</div>
            <div className="lv4-stat-val" style={{ color: "var(--ok)" }}>
              {acreditados}
            </div>
            <div className="lv4-stat-hint">finalizaron</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Tasa éxito</div>
            <div className="lv4-stat-val">{taxa !== null ? `${taxa}%` : "—"}</div>
            <div className="lv4-stat-hint">acred./selecc.</div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            {
              icon: "content_copy",
              title: "Duplicar como base",
              desc: "Crea un nuevo borrador con los datos de esta convocatoria.",
              cta: "Crear borrador",
              onClick: onDuplicar,
            },
            {
              icon: "restart_alt",
              title: "Reabrir inscripción",
              desc: "Vuelve a abrir para recibir nuevos postulantes.",
              cta: "Reabrir",
              onClick: onReabrir,
            },
          ].map((a) => (
            <div key={a.title} className="lv4-action-card">
              <span
                className="material-icons"
                style={{ fontSize: 20, color: "var(--ink-3)", marginBottom: 10, display: "block" }}
              >
                {a.icon}
              </span>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>{a.desc}</div>
              <button className="lv4-btn" onClick={a.onClick}>
                {a.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface LanzadorViewProps {
  isTestingMode?: boolean;
}

const LanzadorView: React.FC<LanzadorViewProps> = ({ isTestingMode = false }) => {
  const { showModal } = useModal();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("lv4-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    return (
      ((location.state as Record<string, unknown>)?.launchId as string | null) ||
      searchParams.get("launchId") ||
      null
    );
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleSelect = useCallback((id: string) => {
    setIsCreating(false);
    setSelectedId(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lv4-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [sidebarCollapsed]);

  // ── Fetch launches ────────────────────────────────────────────────────────
  const { data: launches = [], isLoading } = useQuery<LanzamientoPPS[]>({
    queryKey: ["launchHistory", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) return [];
      return db.lanzamientos.getAll({
        sort: [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }],
      });
    },
  });

  // ── Conteos por lanzamiento (inscriptos totales + seleccionados) ──────────
  // Se cuenta en la base vía RPC (get_convocatoria_counts_by_launch), no en el
  // cliente: evita traer miles de filas y el límite de 1000 de PostgREST.
  const launchIds = launches.map((l) => l.id);
  const { data: countsByLaunch = {} } = useQuery<
    Record<string, { inscriptos: number; seleccionados: number }>
  >({
    queryKey: ["convCountsByLaunch", launchIds.join(",")],
    queryFn: async () => {
      if (launchIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_convocatoria_counts_by_launch", {
        p_launch_ids: launchIds,
      });
      if (error) throw error;
      return (data || {}) as Record<string, { inscriptos: number; seleccionados: number }>;
    },
    enabled: launchIds.length > 0,
  });

  // ── Consentimientos digitales (compromisos) por lanzamiento ───────────────
  // Para la categoría "A asegurar": cuántos seleccionados aceptaron el
  // consentimiento digital vs. cuántos siguen pendientes. También vía RPC.
  const { data: consentByLaunch = {} } = useQuery<
    Record<string, { aceptados: number; total: number }>
  >({
    queryKey: ["consentByLaunch", launchIds.join(",")],
    queryFn: async () => {
      if (launchIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_consent_counts_by_launch", {
        p_launch_ids: launchIds,
      });
      if (error) throw error;
      return (data || {}) as Record<string, { aceptados: number; total: number }>;
    },
    enabled: launchIds.length > 0,
  });

  // ── Build sidebar entries ─────────────────────────────────────────────────
  const entries: SidebarEntry[] = useMemo(() => {
    return launches.map((l) => {
      const dbStatus = (l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] as string) || "";
      const seguroGestionadoAtSidebar =
        (l[FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS] as string | null) ?? null;
      // El uiState de la pipeline ahora se computa de una sola vez, en una
      // sola fuente de verdad (mapDbToUiState), considerando el estado crudo
      // de la DB + la marca de seguro. Ya no hay hacks "cerrada → seleccionada"
      // ni "seguroAt → activa" en este archivo.
      const dbState = mapDbToUiState(dbStatus, seguroGestionadoAtSidebar);
      const nombre = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;
      const orientacion = l[FIELD_ORIENTACION_LANZAMIENTOS] as string | null;
      const cupos = l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
      const fechaInicio = l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
      const fechaFinInsc = l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
      const totalInsc = countsByLaunch[l.id]?.inscriptos || 0;
      const totalSel = countsByLaunch[l.id]?.seleccionados || 0;
      const consent = consentByLaunch[l.id] || { aceptados: 0, total: 0 };
      const vencida = inscripcionVencida(fechaFinInsc);

      // ── uiState (para el canvas/pipeline) ──
      const uiState: UIState = dbState;

      // ── bucket (categoría operativa del sidebar) ──
      // Fuente de verdad única: deriveBucket (servicio de aseguramiento).
      const bucket: SidebarBucket = deriveBucket({
        dbState,
        seguroGestionadoAt: seguroGestionadoAtSidebar,
        totalSel,
        totalInsc,
        vencida,
      });

      // El seguro ya gestionado se refleja como marca, salvo en archivadas.
      const seguroGestionado = bucket !== "archivada" && seguroGestionadoAtSidebar != null;

      // ── meta line por bucket ──
      let metaLine: string;
      switch (bucket) {
        case "borrador":
          metaLine = "Sin publicar";
          break;
        case "abierta":
          metaLine = `${totalInsc} inscripto${totalInsc !== 1 ? "s" : ""} · ${cupos ?? "?"} cupos`;
          break;
        case "seleccionar":
          metaLine = `${totalInsc} candidato${totalInsc !== 1 ? "s" : ""} · ${cupos ?? "?"} cupos`;
          break;
        case "asegurar":
          metaLine =
            consent.total > 0
              ? `${consent.aceptados}/${consent.total} consintieron`
              : `${totalSel} seleccionado${totalSel !== 1 ? "s" : ""} · sin consentir`;
          break;
        case "confirmacion":
          metaLine =
            consent.total > 0
              ? `${consent.aceptados}/${consent.total} consintieron`
              : `${totalSel} seleccionado${totalSel !== 1 ? "s" : ""} · sala de consentimientos`;
          break;
        case "activa":
          metaLine = seguroGestionado
            ? `Seguro gestionado · ${formatDate(seguroGestionadoAtSidebar)}`
            : fechaInicio
              ? `Desde ${formatDate(fechaInicio)}`
              : "Prácticas en curso";
          break;
        default:
          metaLine = fechaInicio ? formatDate(fechaInicio) : "Archivada";
      }

      // ── needsAction (badge "!") ──
      const needsAction =
        bucket === "seleccionar" ||
        (bucket === "asegurar" && consent.aceptados < consent.total) ||
        (bucket === "asegurar" && consent.total === 0) ||
        bucket === "confirmacion";

      return {
        id: l.id,
        nombre,
        uiState,
        bucket,
        orientacion,
        metaLine,
        needsAction,
        seguroGestionado,
      };
    });
  }, [launches, countsByLaunch, consentByLaunch]);

  const selectedLaunch = useMemo(
    () => launches.find((l) => l.id === selectedId) || null,
    [launches, selectedId]
  );

  const selectedUiState = useMemo<UIState | null>(() => {
    if (!selectedLaunch) return null;
    // El estado del canvas se computa de una sola vez, considerando el estado
    // crudo de la DB + la marca de seguro (mapDbToUiState). Esto reemplaza
    // los hacks "cerrada → seleccionada" y "seguroAt → activa" que vivían acá
    // y se saltaban la sala de consentimientos (state "confirmacion").
    const dbStatus = (selectedLaunch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] as string) || "";
    const seguroAt =
      (selectedLaunch[FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS] as string | null) ?? null;
    return mapDbToUiState(dbStatus, seguroAt);
  }, [selectedLaunch]);

  const handleNew = useCallback(() => {
    setSelectedId(null);
    setIsCreating(true);
  }, []);

  const handleNavigateToInsurance = useCallback((lanzamientoId: string) => {
    setSelectedId(lanzamientoId);
  }, []);

  const refreshLaunches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    queryClient.invalidateQueries({ queryKey: ["convStatusByLaunch"] });
    queryClient.invalidateQueries({ queryKey: ["inscCountByLaunch"] });
  }, [queryClient]);

  // ── Estado mutations ──────────────────────────────────────────────────────
  const changeEstadoMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) =>
      db.lanzamientos.update(id, {
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: estado,
      } as Record<string, unknown>),
    onSuccess: () => refreshLaunches(),
    onError: (e: unknown) =>
      showModal(
        "No se pudo actualizar",
        (e as Error)?.message || "Ocurrió un error al cambiar el estado."
      ),
  });

  const handleChangeEstado = useCallback(
    (id: string, estado: string, confirmMsg?: string) => {
      if (confirmMsg && !window.confirm(confirmMsg)) return;
      changeEstadoMutation.mutate({ id, estado });
    },
    [changeEstadoMutation]
  );

  const duplicateMutation = useMutation({
    mutationFn: async (launch: LanzamientoPPS) => {
      const copy: Record<string, unknown> = {
        [FIELD_NOMBRE_PPS_LANZAMIENTOS]: `${(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Convocatoria"} (copia)`,
        [FIELD_ORIENTACION_LANZAMIENTOS]: launch[FIELD_ORIENTACION_LANZAMIENTOS],
        [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS],
        [FIELD_DESCRIPCION_LANZAMIENTOS]: launch[FIELD_DESCRIPCION_LANZAMIENTOS],
        [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS],
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto",
      };
      return db.lanzamientos.create(copy as LanzamientoPPS);
    },
    onSuccess: (created: unknown) => {
      refreshLaunches();
      const id = (created as { id?: string })?.id;
      if (id) setSelectedId(id);
      showModal("Borrador creado", "Se creó un nuevo borrador con los datos de la convocatoria.");
    },
    onError: (e: unknown) =>
      showModal(
        "No se pudo duplicar",
        (e as Error)?.message || "Ocurrió un error al duplicar la convocatoria."
      ),
  });

  // ── Canvas renderer ───────────────────────────────────────────────────────
  const renderCanvas = () => {
    if (isLoading) {
      return (
        <div className="lv4-canvas">
          <div className="lv4-empty">
            <span className="material-icons" style={{ animation: "lv4-spin 1s linear infinite" }}>
              refresh
            </span>
            <p>Cargando convocatorias…</p>
          </div>
        </div>
      );
    }

    if (!selectedId || !selectedLaunch) {
      return (
        <div className="lv4-canvas">
          <div className="lv4-empty">
            {entries.length === 0 ? (
              <>
                <span className="material-icons">rocket_launch</span>
                <p>Aún no hay convocatorias. ¡Creá la primera!</p>
                <button className="lv4-btn lv4-btn-primary" onClick={handleNew}>
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    add
                  </span>
                  Nueva convocatoria
                </button>
              </>
            ) : (
              <>
                <span className="material-icons">arrow_back</span>
                <p>Seleccioná una convocatoria de la lista para ver sus detalles.</p>
              </>
            )}
          </div>
        </div>
      );
    }

    switch (selectedUiState) {
      case "borrador":
        return (
          <div className="lv4-canvas">
            <BorradorView
              launch={selectedLaunch}
              onPublish={() =>
                handleChangeEstado(
                  selectedLaunch.id,
                  "Abierta",
                  "¿Publicar esta convocatoria? Pasará a estado «Abierta» y será visible para inscripción."
                )
              }
              onRefresh={refreshLaunches}
            />
          </div>
        );
      case "seleccion":
        return (
          <div className="lv4-canvas">
            <SeleccionView
              launch={selectedLaunch}
              onCerrarInscripcion={() =>
                handleChangeEstado(
                  selectedLaunch.id,
                  "Cerrado",
                  "¿Cerrar la inscripción? No se aceptarán más postulaciones y se abrirá la mesa de selección."
                )
              }
            />
          </div>
        );
      case "seguro":
        return (
          <div className="lv4-canvas">
            <SeguroView
              launch={selectedLaunch}
              onNavigateToInsurance={handleNavigateToInsurance}
              showModal={showModal}
            />
          </div>
        );
      case "confirmacion":
        return (
          <div className="lv4-canvas">
            <ConfirmacionView launch={selectedLaunch} showModal={showModal} />
          </div>
        );
      case "activa":
        return (
          <div className="lv4-canvas">
            <ActivaView
              launch={selectedLaunch}
              onArchivar={() =>
                handleChangeEstado(
                  selectedLaunch.id,
                  "Archivado",
                  "¿Archivar esta convocatoria? Quedará como referencia histórica."
                )
              }
            />
          </div>
        );
      case "archivada":
        return (
          <div className="lv4-canvas">
            <ArchivadaView
              launch={selectedLaunch}
              onDuplicar={() => duplicateMutation.mutate(selectedLaunch)}
              onReabrir={() =>
                handleChangeEstado(
                  selectedLaunch.id,
                  "Abierta",
                  "¿Reabrir la inscripción de esta convocatoria archivada?"
                )
              }
            />
          </div>
        );
      default:
        return null;
    }
  };

  // ── Nueva convocatoria ────────────────────────────────────────────────────
  const renderNewConvocatoria = () => (
    <div className="lv4-canvas">
      <div className="lv4-canvas-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span className="lv4-chip lv4-chip-borrador">
            <span className="lv4-dot lv4-dot-borrador" />
            Nueva
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 33,
              fontWeight: 400,
              letterSpacing: "-0.015em",
              fontFamily: "'Instrument Serif', Georgia, serif",
            }}
          >
            Nueva convocatoria
          </h1>
          <button className="lv4-btn" onClick={() => setIsCreating(false)}>
            <span className="material-icons" style={{ fontSize: 14 }}>
              arrow_back
            </span>
            Volver
          </button>
        </div>
      </div>
      <div className="lv4-canvas-body">
        <Suspense fallback={<Loader />}>
          <LanzadorConvocatorias forcedTab="new" isTestingMode={isTestingMode} />
        </Suspense>
      </div>
    </div>
  );

  return (
    <>
      <div className="lv4">
        <LanzadorSidebar
          entries={entries}
          selectedId={selectedId}
          collapsed={sidebarCollapsed}
          onSelect={handleSelect}
          onNew={handleNew}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        />
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {isCreating ? renderNewConvocatoria() : renderCanvas()}
        </main>
      </div>
    </>
  );
};

export default LanzadorView;
