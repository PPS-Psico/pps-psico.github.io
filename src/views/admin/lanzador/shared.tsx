/**
 * lanzador/shared.tsx — Núcleo compartido del Lanzador.
 *
 * Primitivos de presentación, helpers puros, el hook `useLaunchEditor`,
 * `CanvasHeader`, `PropagateDatesDialog` y `LanzadorSidebar`. Extraído de
 * `LanzadorView.tsx` (relocalización pura, sin cambios de lógica) para que el
 * orquestador y los step-views consuman estas piezas desde un único lugar.
 */
import React, { useState, useMemo, useEffect, lazy } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "../../../lib/db";
import { supabase } from "../../../lib/supabaseClient";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
} from "../../../constants";
import { formatDate } from "../../../utils/formatters";
import type { LanzamientoPPS } from "../../../types";
import RecordEditModal from "../../../components/admin/RecordEditModal";
import { LAUNCH_TABLE_CONFIG } from "../../../components/admin/LanzadorConvocatorias";
import { logger } from "../../../utils/logger";
import {
  type UIState,
  type SidebarBucket,
  type SidebarEntry,
  STATE_META,
  PIPELINE_STEPS,
  BUCKET_META,
  BUCKET_ORDER,
} from "./lanzadorState";
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

// ─── Stat / StatGrid — tarjetas de estadística reutilizables ───────────────────
// Reemplazan el markup repetido de `.lv4-stat` en todas las vistas. El color y
// el tamaño del valor se resuelven por clase (ver lanzadorStyles), no inline.
type StatTone = "accent" | "ok" | "warn" | "muted";

const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatTone;
  size?: "md" | "sm";
}> = ({ label, value, hint, tone, size }) => (
  <div className="lv4-stat">
    <div className="lv4-stat-label">{label}</div>
    <div className={`lv4-stat-val${tone ? ` ${tone}` : ""}${size ? ` ${size}` : ""}`}>{value}</div>
    {hint != null && <div className="lv4-stat-hint">{hint}</div>}
  </div>
);

const StatGrid: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div className="lv4-stats" style={style}>
    {children}
  </div>
);

// ─── Banner — aviso con ícono, título y cuerpo (tono por clase) ────────────────
type BannerTone = "ok" | "warn" | "info" | "neutral";

const Banner: React.FC<{
  tone?: BannerTone;
  icon: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ tone = "neutral", icon, title, children, action, style }) => (
  <div className={`lv4-banner ${tone}`} style={style}>
    <span className="material-icons lv4-banner-ico">{icon}</span>
    <div className="lv4-banner-main">
      {title != null && <div className="lv4-banner-title">{title}</div>}
      {children != null && <div className="lv4-banner-body">{children}</div>}
    </div>
    {action}
  </div>
);

// ─── Archivada efectiva ─────────────────────────────────────────────────────

/** Buckets "pre-inicio": tareas que solo tienen sentido ANTES de que arranque la PPS. */
// ─── Sidebar ──────────────────────────────────────────────────────────────────

/** Acciones de estado disponibles desde el menú inline de cada convocatoria. */
type RowAction = "abrir" | "cerrar" | "ocultar" | "archivar" | "desarchivar";

interface SidebarProps {
  entries: SidebarEntry[];
  selectedId: string | null;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onToggleCollapsed: () => void;
  onAction: (id: string, action: RowAction) => void;
  /** En mobile el sidebar es un drawer; este flag controla si está abierto. */
  mobileOpen?: boolean;
}

const LanzadorSidebar: React.FC<SidebarProps> = ({
  entries,
  selectedId,
  collapsed,
  onSelect,
  onNew,
  onToggleCollapsed,
  onAction,
  mobileOpen = false,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<SidebarBucket>>(
    () => new Set(BUCKET_ORDER.filter((b) => BUCKET_META[b].collapsedByDefault))
  );
  const [query, setQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Cerrar el menú de estado con Escape (accesibilidad de teclado).
  useEffect(() => {
    if (!openMenuId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openMenuId]);

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
      <aside className={`lv4-aside collapsed${mobileOpen ? " mobile-open" : ""}`}>
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
    <aside className={`lv4-aside${mobileOpen ? " mobile-open" : ""}`}>
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
                g.items.map((entry) => {
                  const isArchived = entry.uiState === "archivada";
                  return (
                    <div
                      key={entry.id}
                      className={`lv4-row ${selectedId === entry.id ? "active" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-current={selectedId === entry.id ? "true" : undefined}
                      aria-label={entry.nombre || "Convocatoria sin nombre"}
                      onClick={() => onSelect(entry.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(entry.id);
                        }
                      }}
                      style={{ position: "relative" }}
                    >
                      <div className={`lv4-dot lv4-dot-${entry.uiState}`} />
                      <div style={{ minWidth: 0, flex: 1 }}>
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
                        {entry.orientacion && (
                          <div className="lv4-row-sub">{entry.orientacion}</div>
                        )}
                        <div className="lv4-row-meta">{entry.metaLine}</div>
                      </div>
                      {entry.needsAction && <div className="lv4-badge-attn">!</div>}

                      {/* Menú de estado (kebab) */}
                      <button
                        className="lv4-icon-btn"
                        title="Cambiar estado"
                        aria-label="Cambiar estado"
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === entry.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((cur) => (cur === entry.id ? null : entry.id));
                        }}
                        style={{ width: 28, height: 28, justifyContent: "center", flexShrink: 0 }}
                      >
                        <span className="material-icons" style={{ fontSize: 18 }}>
                          more_vert
                        </span>
                      </button>

                      {openMenuId === entry.id && (
                        <>
                          {/* Backdrop para cerrar al hacer clic afuera */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                            }}
                            style={{ position: "fixed", inset: 0, zIndex: 40 }}
                          />
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="lv4-state-menu"
                            role="menu"
                          >
                            {(
                              [
                                { action: "abrir", icon: "lock_open", label: "Abrir inscripción" },
                                { action: "cerrar", icon: "lock", label: "Cerrar inscripción" },
                                {
                                  action: "ocultar",
                                  icon: "visibility_off",
                                  label: "Ocultar (borrador)",
                                },
                                isArchived
                                  ? {
                                      action: "desarchivar",
                                      icon: "unarchive",
                                      label: "Des-archivar (hacer visible)",
                                    }
                                  : { action: "archivar", icon: "archive", label: "Archivar" },
                              ] as { action: RowAction; icon: string; label: string }[]
                            ).map((opt) => (
                              <button
                                key={opt.action}
                                role="menuitem"
                                className="lv4-state-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  onAction(entry.id, opt.action);
                                }}
                              >
                                <span className="material-icons">{opt.icon}</span>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
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

// ─── useLaunchEditor ──────────────────────────────────────────────────────────
// Hook reutilizable para editar los datos de un lanzamiento (nombre, fechas,
// cupos, etc.) en CUALQUIER estado del pipeline — no solo en borrador. Devuelve
// un disparador `openEdit` y el `modal` ya listo para renderizar. Esto permite
// corregir, por ejemplo, una fecha mal cargada después de haber lanzado.
//
// Propagación de fechas: las prácticas de los estudiantes ya seleccionados
// guardan una COPIA de las fechas del lanzamiento (se copian al seleccionar, ver
// convocatoriasService). Editar el lanzamiento no las toca. Por eso, si el admin
// cambia una fecha y hay prácticas vinculadas, ofrecemos aplicar el cambio en
// bloque a esas prácticas (con confirmación explícita). Así la divergencia entre
// la fecha del cupo y la de cada práctica es siempre una decisión, no un olvido.

// Normaliza un valor de fecha (DB o input) a "YYYY-MM-DD" para comparar.
const normDateValue = (v: unknown): string =>
  typeof v === "string" ? v.split("T")[0].trim() : v == null ? "" : String(v);

// Campos de fecha que se pueden propagar lanzamiento → práctica.
const PROPAGABLE_DATE_FIELDS = [
  {
    launchKey: FIELD_FECHA_INICIO_LANZAMIENTOS,
    practicaKey: FIELD_FECHA_INICIO_PRACTICAS,
    label: "Fecha de inicio",
  },
  {
    launchKey: FIELD_FECHA_FIN_LANZAMIENTOS,
    practicaKey: FIELD_FECHA_FIN_PRACTICAS,
    label: "Fecha de finalización",
  },
] as const;

interface PropagationPrompt {
  count: number;
  labels: string[];
  practicaFields: Record<string, unknown>;
}

function useLaunchEditor(launch: LanzamientoPPS, onRefresh?: () => void) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState<PropagationPrompt | null>(null);
  const [propagating, setPropagating] = useState(false);
  const queryClient = useQueryClient();

  const invalidatePracticas = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        String(q.queryKey[0] ?? "")
          .toLowerCase()
          .includes("practica"),
    });

  const handleSave = async (recordId: string | null, fields: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (recordId) {
        await db.lanzamientos.update(recordId, fields);
        await queryClient.invalidateQueries({ queryKey: ["launchHistory"] });

        // ¿Cambió alguna fecha propagable respecto del valor previo del lanzamiento?
        const changed = PROPAGABLE_DATE_FIELDS.filter(
          (f) =>
            f.launchKey in fields &&
            normDateValue(fields[f.launchKey]) !== normDateValue(launch[f.launchKey])
        );

        if (changed.length > 0) {
          // Contar prácticas vinculadas (= estudiantes seleccionados con práctica creada).
          const { count } = await supabase
            .from("practicas")
            .select("id", { count: "exact", head: true })
            .eq(FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, recordId);

          if (count && count > 0) {
            const practicaFields: Record<string, unknown> = {};
            changed.forEach((f) => {
              practicaFields[f.practicaKey] = fields[f.launchKey] ?? null;
            });
            setPrompt({ count, labels: changed.map((f) => f.label), practicaFields });
          }
        }
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setSaving(false);
      setEditOpen(false);
      onRefresh?.();
    }
  };

  const confirmPropagation = async () => {
    if (!prompt) return;
    setPropagating(true);
    try {
      const { error } = await supabase
        .from("practicas")
        .update(prompt.practicaFields)
        .eq(FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, launch.id);
      if (error) throw error;
      await invalidatePracticas();
      onRefresh?.();
    } catch (e) {
      logger.error(e);
    } finally {
      setPropagating(false);
      setPrompt(null);
    }
  };

  const modal = (
    <>
      <RecordEditModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        record={launch as Record<string, unknown>}
        tableConfig={LAUNCH_TABLE_CONFIG}
        onSave={handleSave}
        isSaving={saving}
      />
      {prompt && (
        <PropagateDatesDialog
          prompt={prompt}
          busy={propagating}
          onConfirm={confirmPropagation}
          onDismiss={() => setPrompt(null)}
        />
      )}
    </>
  );

  return { openEdit: () => setEditOpen(true), modal };
}

// ─── PropagateDatesDialog ──────────────────────────────────────────────────────
// Diálogo de confirmación que aparece tras editar fechas de un lanzamiento con
// estudiantes ya seleccionados. Estilado con tokens .lv4 (hereda del canvas).
const PropagateDatesDialog: React.FC<{
  prompt: PropagationPrompt;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}> = ({ prompt, busy, onConfirm, onDismiss }) => {
  const { count, labels } = prompt;
  const fechasTxt =
    labels.length === 1 ? labels[0].toLowerCase() : labels.map((l) => l.toLowerCase()).join(" y ");
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(20,19,16,.42)",
        backdropFilter: "blur(2px)",
      }}
      onClick={busy ? undefined : onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--paper)",
          border: "1px solid var(--rule-3)",
          borderRadius: 16,
          boxShadow: "0 1px 2px rgba(20,19,16,.04), 0 24px 48px -16px rgba(20,19,16,.32)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "22px 24px 16px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--accent-s)",
              marginBottom: 14,
            }}
          >
            <span className="material-icons" style={{ fontSize: 22, color: "var(--accent)" }}>
              sync_alt
            </span>
          </div>
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: 21,
              fontWeight: 400,
              letterSpacing: "-0.015em",
              fontFamily: "'Instrument Serif', Georgia, serif",
              color: "var(--ink)",
            }}
          >
            ¿Aplicar también a las prácticas?
          </h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
            Hay <b>{count}</b> estudiante{count !== 1 ? "s" : ""} ya seleccionado
            {count !== 1 ? "s" : ""} con su práctica creada. Cambiaste la <b>{fechasTxt}</b> del
            lanzamiento, pero la práctica de cada estudiante guarda su propia copia.
          </p>
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 9,
              background: "var(--warn-s)",
              border: "1px solid var(--rule-2)",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--ink-3)",
              display: "flex",
              gap: 8,
            }}
          >
            <span className="material-icons" style={{ fontSize: 16, color: "var(--warn)" }}>
              info
            </span>
            <span>
              Si propagás, se sobrescribe la {fechasTxt} en{" "}
              {count === 1 ? "esa práctica" : "esas prácticas"}, incluso si algún estudiante la
              había ajustado por su cuenta.
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            padding: "14px 24px 20px",
          }}
        >
          <button className="lv4-btn" onClick={onDismiss} disabled={busy}>
            No, solo el lanzamiento
          </button>
          <button className="lv4-btn lv4-btn-primary" onClick={onConfirm} disabled={busy}>
            <span
              className="material-icons"
              style={{
                fontSize: 14,
                ...(busy ? { animation: "lv4-spin 1s linear infinite" } : {}),
              }}
            >
              {busy ? "refresh" : "check"}
            </span>
            {busy ? "Aplicando…" : `Sí, aplicar a ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── BorradorView ─────────────────────────────────────────────────────────────

// ─── Sub-componentes pesados (lazy) y helpers de mensajes ──────────────────────
const SeleccionadorConvocatorias = lazy(
  () => import("../../../components/admin/SeleccionadorConvocatorias")
);
const SeguroGenerator = lazy(() => import("../../../components/admin/SeguroGenerator"));

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

// Mensaje dirigido para difundir las franjas que todavía tienen lugar. Detecta
// automáticamente qué grupos están sin completar y arma un texto listo para
// pegar en el grupo de WhatsApp pidiendo que se anoten en esos días puntuales.
function buildFranjasLibresMessage(
  launch: LanzamientoPPS,
  franjas: Array<{ label: string; libres: number | null }>
): string {
  const nombre = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;
  const fechaFinInsc = launch[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
  const lines: string[] = [];
  lines.push(`⏳ *¡Últimos lugares en PPS${nombre ? `: ${nombre}` : ""}!*`);
  lines.push("");
  lines.push(
    franjas.length === 1
      ? "Todavía queda lugar sin cubrir en esta franja:"
      : "Todavía quedan cupos sin cubrir en estas franjas:"
  );
  franjas.forEach((f) => {
    const n = f.libres ?? 0;
    lines.push(`• *${f.label}* — ${n} lugar${n !== 1 ? "es" : ""} libre${n !== 1 ? "s" : ""}`);
  });
  lines.push("");
  if (fechaFinInsc) lines.push(`📅 *Inscripción hasta:* ${formatDate(fechaFinInsc)}`);
  return lines.join("\n");
}

export {
  Dot,
  Chip,
  Pipeline,
  Loader,
  Stat,
  StatGrid,
  Banner,
  normDateValue,
  useLaunchEditor,
  CanvasHeader,
  PropagateDatesDialog,
  LanzadorSidebar,
  SeleccionadorConvocatorias,
  SeguroGenerator,
  buildWhatsappFromLaunch,
  buildFranjasLibresMessage,
};
export type { RowAction, SidebarProps, CanvasHeaderProps, PropagationPrompt };
// Re-exports de la lógica pura (viven en lanzadorState) para compatibilidad de imports.
export { isEffectivelyArchived } from "./lanzadorState";
export type { SidebarEntry } from "./lanzadorState";
