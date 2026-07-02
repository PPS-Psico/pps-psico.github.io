import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import type { GroupedSeleccionados, SelectedStudent } from "../types";

/* ============================================================
   SeleccionadosModal — rediseño mobile de la "lista de convocados".
   Resultados oficiales de una convocatoria cerrada, vista del
   estudiante: tu resultado destacado, stats en hairline, filtros
   y la lista agrupada por horario con estado Confirmado/Pendiente.
   Lenguaje editorial-data del prototipo PPS (scope .ed):
   tipografía protagonista, datos en línea, una sola pieza fuerte.

   Mantiene el contrato existente (isOpen / onClose / seleccionados:
   GroupedSeleccionados / convocatoriaName / simpleMode) y adapta esa
   data al diseño por dentro, sin tocar ModalContext ni AppModals.
   ============================================================ */

/* ── Íconos de trazo (lucide-style) ── */
type SelIconName = "close" | "download";
const SEL_PATHS: Record<SelIconName, React.ReactNode> = {
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="M6 10l6 6 6-6" />
      <path d="M5 20h14" />
    </>
  ),
};
const SelIcon: React.FC<{ name: SelIconName; size?: number; strokeWidth?: number }> = ({
  name,
  size = 17,
  strokeWidth = 1.8,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {SEL_PATHS[name]}
  </svg>
);

/* ── Tipos internos del diseño ── */
type EstadoConvocado = "confirmado" | "pendiente";
type AvatarTone = "teal" | "navy" | "purple" | "amber";

interface Convocado {
  nombre: string;
  legajo: string;
  estado: EstadoConvocado;
  horario: string;
  esVos?: boolean;
}

interface SeleccionadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  seleccionados: GroupedSeleccionados | null;
  /** Nombre de la convocatoria — se muestra como titular. */
  convocatoriaName: string;
  /** Orientación (área) — define el color del kicker. Opcional. */
  orientacion?: string;
  /** Cupos publicados, para el subtítulo de la stat. Opcional. */
  cupos?: number;
  /** Callback del botón descargar; si no se pasa, el botón se oculta. */
  onDescargar?: () => void;
  /** Reservado para compatibilidad con el contrato previo. */
  simpleMode?: boolean;
}

/* ── Helpers ── */
const AREA_COLOR: Record<string, string> = {
  ["Cl\u00ednica"]: "var(--area-clinica)",
  Educacional: "var(--area-educacional)",
  Laboral: "var(--area-laboral)",
  Comunitaria: "var(--area-comunitaria)",
};

const TONES: AvatarTone[] = ["teal", "navy", "purple", "amber"];
function toneFor(nombre: string): AvatarTone {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
function initials(name: string): string {
  return name
    .replace(/^LU\s*/i, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const isConfirmed = (s: SelectedStudent) => (s.compromisoEstado || "").toLowerCase() === "aceptado";

type Filtro = "all" | "confirmed" | "pending";

const SeleccionadosModal: React.FC<SeleccionadosModalProps> = ({
  isOpen,
  onClose,
  seleccionados,
  convocatoriaName,
  orientacion,
  cupos,
  onDescargar,
}) => {
  const { resolvedTheme } = useTheme();
  const { authenticatedUser } = useAuth();
  const currentLegajo = authenticatedUser?.legajo;

  const [mounted, setMounted] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("all");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset de filtro + lock de scroll + cierre con Escape mientras está abierto.
  useEffect(() => {
    if (!isOpen) return;
    setFiltro("all");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  // Adaptar GroupedSeleccionados → lista plana de convocados (preserva orden).
  const convocados: Convocado[] = useMemo(() => {
    if (!seleccionados) return [];
    const out: Convocado[] = [];
    Object.entries(seleccionados).forEach(([horario, students]) => {
      (students as SelectedStudent[]).forEach((s) => {
        out.push({
          nombre: s.nombre,
          legajo: s.legajo,
          estado: isConfirmed(s) ? "confirmado" : "pendiente",
          horario,
          esVos: !!currentLegajo && s.legajo === currentLegajo,
        });
      });
    });
    return out;
  }, [seleccionados, currentLegajo]);

  const { total, confirmados, pendientes, me, grupos } = useMemo(() => {
    const total = convocados.length;
    const confirmados = convocados.filter((p) => p.estado === "confirmado").length;
    const me = convocados.find((p) => p.esVos);
    const orden: string[] = [];
    const map = new Map<string, Convocado[]>();
    for (const p of convocados) {
      if (!map.has(p.horario)) {
        map.set(p.horario, []);
        orden.push(p.horario);
      }
      map.get(p.horario)!.push(p);
    }
    const grupos = orden.map((h) => ({ horario: h, people: map.get(h)! }));
    return { total, confirmados, pendientes: total - confirmados, me, grupos };
  }, [convocados]);

  if (!mounted || !isOpen) return null;

  const orientacionLabel = orientacion ? String(orientacion).toUpperCase() : "CONVOCATORIA";
  const areaColor = (orientacion && AREA_COLOR[orientacion]) || "var(--accent)";
  const isEmpty = total === 0;

  const pasa = (p: Convocado) =>
    filtro === "all" ||
    (filtro === "confirmed" && p.estado === "confirmado") ||
    (filtro === "pending" && p.estado === "pendiente");

  const chips: { k: Filtro; label: string; n: number }[] = [
    { k: "all", label: "Todos", n: total },
    { k: "confirmed", label: "Confirmados", n: confirmados },
    { k: "pending", label: "Pendientes", n: pendientes },
  ];

  const visibles = grupos.reduce((acc, g) => acc + g.people.filter(pasa).length, 0);

  return createPortal(
    <div
      className="ed sel-overlay"
      data-mode={resolvedTheme}
      data-accent="teal"
      role="dialog"
      aria-modal="true"
      aria-label={`Convocados · ${convocatoriaName}`}
      onClick={onClose}
    >
      <div className="sel-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sel-grab" aria-hidden="true" />

        {/* Header */}
        <header className="sel-header">
          <button type="button" className="sel-iconbtn" onClick={onClose} aria-label="Cerrar">
            <SelIcon name="close" size={18} />
          </button>
          <span className="sel-header__label">Resultados</span>
          {onDescargar ? (
            <button
              type="button"
              className="sel-iconbtn"
              onClick={onDescargar}
              aria-label="Descargar listado"
            >
              <SelIcon name="download" size={17} />
            </button>
          ) : (
            <span style={{ width: 36, height: 36, flexShrink: 0 }} aria-hidden="true" />
          )}
        </header>

        {/* Body scrollable */}
        <div className="sel-body">
          {/* Title block — editorial */}
          <span className="sel-kicker">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: areaColor,
                display: "inline-block",
              }}
            />
            <span className="sel-kicker__area" style={{ color: areaColor }}>
              {orientacionLabel}
            </span>
            <span className="sel-kicker__sep" aria-hidden="true">
              {"\u00b7"}
            </span>
            <span className="sel-closed-pill">Cerrada</span>
          </span>
          <div style={{ marginTop: 8 }}>
            <span className="ed-eyebrow" style={{ fontSize: 10.5 }}>
              Resultados oficiales
            </span>
          </div>
          <h2 className="sel-title">{convocatoriaName}</h2>

          {isEmpty ? (
            <div className="sel-empty">
              <p className="sel-empty__title">Lista no disponible</p>
              <p className="sel-empty__msg">Aún no se publicó la lista de seleccionados.</p>
            </div>
          ) : (
            <>
              {/* Stats — hairline, sin cajas */}
              <div className="sel-stats">
                <div className="sel-stat">
                  <div className="sel-stat__lbl">Convocados</div>
                  <div className="sel-stat__val">{total}</div>
                  <div className="sel-stat__sub">{cupos ? `de ${cupos} cupos+` : "en total"}</div>
                </div>
                <div className="sel-stat">
                  <div className="sel-stat__lbl">Confirmados</div>
                  <div className="sel-stat__val" data-tone="ok">
                    {confirmados}
                  </div>
                  <div className="sel-stat__sub">firmaron</div>
                </div>
                <div className="sel-stat">
                  <div className="sel-stat__lbl">Pendientes</div>
                  <div className="sel-stat__val" data-tone="warn">
                    {pendientes}
                  </div>
                  <div className="sel-stat__sub">sin firmar</div>
                </div>
              </div>

              {/* Tu resultado — ancla emocional, destacada */}
              {me && (
                <>
                  <span className="ed-eyebrow" style={{ fontSize: 10.5 }}>
                    Tu resultado
                  </span>
                  <div className="sel-you">
                    <div className="sel-you__av">{initials(me.nombre)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="sel-you__name">{me.nombre}</span>
                        <span className="sel-badge-vos">Vos</span>
                      </div>
                      <div className="sel-you__msg">
                        {me.estado === "confirmado" ? (
                          <>
                            Quedaste <b style={{ fontWeight: 600 }}>seleccionado</b>. Tu cupo está
                            confirmado.
                          </>
                        ) : (
                          <>
                            Quedaste <b style={{ fontWeight: 600 }}>seleccionado</b>. Firmá el
                            compromiso desde Inicio.
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Lista + filtros */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 11,
                }}
              >
                <span className="ed-eyebrow" style={{ fontSize: 10.5 }}>
                  La lista
                </span>
                <span
                  className="sel-group__n"
                  style={{ fontSize: 10.5, color: "var(--ink-subtle)" }}
                >
                  {total} {total === 1 ? "persona" : "personas"}
                </span>
              </div>

              <div className="sel-filters">
                {chips.map((c) => (
                  <button
                    key={c.k}
                    type="button"
                    className="sel-chip"
                    data-on={filtro === c.k}
                    onClick={() => setFiltro(c.k)}
                  >
                    {c.label}
                    <span className="sel-chip__n">{c.n}</span>
                  </button>
                ))}
              </div>

              {/* Grupos por horario */}
              {visibles === 0 ? (
                <p className="sel-empty__msg" style={{ textAlign: "center", padding: "8px 0" }}>
                  No hay convocados con este filtro.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {grupos.map((g) => {
                    const people = g.people.filter(pasa);
                    if (!people.length) return null;
                    const showHead = g.horario && g.horario !== "No especificado";
                    return (
                      <div key={g.horario} className="sel-group">
                        {showHead && (
                          <div className="sel-group__head">
                            <span className="sel-group__h">{g.horario}</span>
                            <span className="sel-group__rule" />
                            <span className="sel-group__n">{people.length}</span>
                          </div>
                        )}
                        {people.map((p) => (
                          <ConvRow key={`${p.legajo}-${g.horario}`} convocado={p} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const ConvRow: React.FC<{ convocado: Convocado }> = ({ convocado }) => {
  const ok = convocado.estado === "confirmado";
  return (
    <div className="sel-row">
      <div className="sel-av" data-tone={toneFor(convocado.nombre)}>
        {initials(convocado.nombre)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span className="sel-row__name">{convocado.nombre}</span>
          {convocado.esVos && <span className="sel-badge-vos">Vos</span>}
        </div>
        <div className="sel-row__legajo">{convocado.legajo}</div>
      </div>
      <span className="sel-status" data-ok={ok}>
        {ok ? "Confirmado" : "Pendiente"}
      </span>
    </div>
  );
};

export default SeleccionadosModal;
