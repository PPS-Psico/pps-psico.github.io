import React, { useMemo, useState } from "react";
import { matchesGmailFilter } from "../../../hooks/useGmailHilos";
import type { GmailHilo, GmailFilter } from "../../../hooks/useGmailHilos";
import { formatDate } from "../../../utils/formatters";
import Loader from "../../../components/Loader";

// ─── MailsView · bandeja de correos institucionales (gmail_hilos) ────────────
// Muestra EXACTAMENTE el mismo conjunto que cuentan las tarjetas del dashboard
// "Te toca responder" y "Esperando +5 días" (misma tabla y mismos filtros).
// Estética: misma gramática de tabla escaneable que la cartera de Instituciones,
// con buscador, orden por columnas, indicador de no leído y acciones por fila.

export const mailTimeAgo = (iso: string | null): string => {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
};

export const remitenteDeHilo = (h: GmailHilo): string => {
  if (h.email_institucion) return h.email_institucion;
  const p = h.participantes;
  if (Array.isArray(p)) {
    const ext = p.find(
      (x) => typeof x === "string" && !/uflouni|uflo\.edu|battaglia/i.test(x as string)
    );
    if (ext) return String(ext);
    if (p.length) return String(p[0]);
  }
  return "Contacto institucional";
};

type SortKey = "asunto" | "estado" | "remitente" | "fecha";

const MAIL_FILTERS: { id: GmailFilter; label: string; icon: string; note: string }[] = [
  {
    id: "esperando",
    label: "Te toca responder",
    icon: "reply",
    note: "Mails esperando tu respuesta",
  },
  {
    id: "esperando5d",
    label: "Esperando +5 días",
    icon: "schedule_send",
    note: "Te deben respuesta hace +5 días",
  },
  { id: "todos", label: "Todos", icon: "all_inbox", note: "Todos los hilos de correo" },
];

export const MailsView: React.FC<{
  hilos: GmailHilo[];
  loading: boolean;
  filter: GmailFilter;
  onFilter: (f: GmailFilter) => void;
  onOpen: (h: GmailHilo) => void;
  selectedId?: string | null;
  draftThreads?: Set<string>;
  onGenerate?: () => void;
  generating?: boolean;
  /** Archiva el hilo (lo saca de la bandeja activa). Reversible. */
  onArchive?: (h: GmailHilo) => void;
  /** Descarta el hilo a papelera (para correos que no corresponden a gestión). */
  onDiscard?: (h: GmailHilo) => void;
  /** Alterna leído/no leído. */
  onToggleSeen?: (h: GmailHilo) => void;
  /** thread_ids con una acción en curso (deshabilita sus botones). */
  busyThreads?: Set<string>;
  /** thread_ids ocultos transitoriamente (ventana de "Deshacer"). */
  hiddenThreads?: Set<string>;
  /** thread_ids ya vistos por el operador (para el indicador de no leído). */
  seenThreads?: Set<string>;
}> = ({
  hilos,
  loading,
  filter,
  onFilter,
  onOpen,
  selectedId,
  draftThreads,
  onGenerate,
  generating,
  onArchive,
  onDiscard,
  onToggleSeen,
  busyThreads,
  hiddenThreads,
  seenThreads,
}) => {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Hilos activos = no ocultos por la ventana de "Deshacer".
  const activeHilos = useMemo(
    () => (hiddenThreads?.size ? hilos.filter((h) => !hiddenThreads.has(h.thread_id)) : hilos),
    [hilos, hiddenThreads]
  );

  const counts = useMemo(
    () => ({
      esperando: activeHilos.filter((h) => matchesGmailFilter(h, "esperando")).length,
      esperando5d: activeHilos.filter((h) => matchesGmailFilter(h, "esperando5d")).length,
      todos: activeHilos.length,
    }),
    [activeHilos]
  );

  const visible = useMemo(() => {
    const base = activeHilos.filter((h) => matchesGmailFilter(h, filter));
    const q = query.trim().toLowerCase();
    const searched = q
      ? base.filter(
          (h) =>
            (h.asunto || "").toLowerCase().includes(q) ||
            remitenteDeHilo(h).toLowerCase().includes(q)
        )
      : base;
    const dir = sortDir === "asc" ? 1 : -1;
    const ts = (h: GmailHilo) =>
      h.ultimo_mensaje_at ? new Date(h.ultimo_mensaje_at).getTime() : 0;
    return [...searched].sort((a, b) => {
      switch (sortKey) {
        case "asunto":
          return dir * (a.asunto || "").localeCompare(b.asunto || "", "es");
        case "remitente":
          return dir * remitenteDeHilo(a).localeCompare(remitenteDeHilo(b), "es");
        case "estado": {
          const rank = (h: GmailHilo) => (h.estado === "esperando_respuesta" ? 0 : 1);
          return dir * (rank(a) - rank(b));
        }
        case "fecha":
        default:
          return dir * (ts(a) - ts(b));
      }
    });
  }, [activeHilos, filter, query, sortKey, sortDir]);

  const unreadCount = useMemo(
    () => visible.filter((h) => !seenThreads?.has(h.thread_id)).length,
    [visible, seenThreads]
  );

  const activeDef = MAIL_FILTERS.find((f) => f.id === filter) || MAIL_FILTERS[0];
  const searching = !!query.trim();

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "fecha" ? "desc" : "asc");
    }
  };

  const SortBtn = ({ k, label, align }: { k: SortKey; label: string; align?: "right" }) => (
    <button
      type="button"
      className={`sort-btn ${sortKey === k ? "active" : ""}`}
      onClick={() => toggleSort(k)}
      style={align === "right" ? { justifySelf: "end" } : undefined}
    >
      {label}
      {sortKey === k && (
        <span className="material-icons" style={{ fontSize: 12 }}>
          {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
        </span>
      )}
    </button>
  );

  return (
    <>
      <header style={{ padding: "20px 32px 16px", borderBottom: "1px solid var(--rule-2)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow">Correo institucional</span>
            <h2
              className="serif"
              style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              {activeDef.label}
            </h2>
            <div className="meta" style={{ marginTop: 6 }}>
              {activeDef.note} · {visible.length} {visible.length === 1 ? "hilo" : "hilos"}
              {unreadCount > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {unreadCount} sin leer
                  </span>
                </>
              )}
            </div>
          </div>
          {onGenerate && (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="press"
              title="Hermes lee los correos sin responder y te deja un borrador listo para cada uno"
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border: "1px solid color-mix(in oklab, var(--ai) 35%, var(--rule-2))",
                background: "color-mix(in oklab, var(--ai) 8%, var(--paper))",
                color: "var(--ai)",
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: generating ? "default" : "pointer",
                opacity: generating ? 0.7 : 1,
              }}
            >
              <span
                className={`material-icons${generating ? " animate-spin" : ""}`}
                style={{ fontSize: 16 }}
              >
                {generating ? "progress_activity" : "auto_awesome"}
              </span>
              {generating ? "Generando…" : "Preparar borradores"}
            </button>
          )}
        </div>

        {/* sub-filtros (mismos conjuntos que las tarjetas del inicio) + buscador */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {MAIL_FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <button
                key={f.id}
                onClick={() => onFilter(f.id)}
                className="press"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 9,
                  border: `1px solid ${on ? "var(--ink)" : "var(--rule-2)"}`,
                  background: on ? "var(--ink)" : "transparent",
                  color: on ? "var(--paper)" : "var(--ink-2)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  {f.icon}
                </span>
                {f.label}
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: on ? "rgba(255,255,255,0.18)" : "var(--paper-3)",
                    color: on ? "var(--paper)" : "var(--ink-3)",
                  }}
                >
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
          <span style={{ flex: 1 }} />
          <div className="inst-search" style={{ flex: "0 1 260px", minWidth: 190 }}>
            <span className="material-icons">search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por asunto o remitente…"
            />
          </div>
        </div>
      </header>

      {/* Encabezado de columnas (sticky, ordenable) — solo cuando hay filas */}
      {!loading && visible.length > 0 && (
        <div className="mail-head">
          <SortBtn k="asunto" label="Asunto" />
          <SortBtn k="estado" label="Estado" />
          <SortBtn k="remitente" label="Remitente" />
          <SortBtn k="fecha" label="Últ. mensaje" />
          <span className="label" style={{ fontSize: 10, justifySelf: "end" }}>
            Acciones
          </span>
        </div>
      )}

      <div style={{ paddingBottom: 64 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Loader />
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-3)" }}>
            <span className="material-icons" style={{ fontSize: 40, color: "var(--ink-4)" }}>
              {searching ? "search_off" : "mark_email_read"}
            </span>
            <div className="serif" style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>
              {searching ? "Sin resultados" : "Sin correos en esta vista"}
            </div>
            <div className="meta" style={{ marginTop: 6 }}>
              {searching
                ? `Nada coincide con «${query.trim()}» en «${activeDef.label}».`
                : `No hay hilos que cumplan «${activeDef.label}».`}
            </div>
          </div>
        ) : (
          visible.map((h) => {
            const waiting = h.estado === "esperando_respuesta";
            const tone = waiting ? "warn" : "accent";
            const isActive = selectedId === h.thread_id;
            const hasDraft = !!draftThreads?.has(h.thread_id);
            const busy = !!busyThreads?.has(h.thread_id);
            const unread = !seenThreads?.has(h.thread_id);
            return (
              <div
                key={h.thread_id}
                role="button"
                tabIndex={0}
                className={`mail-row press ${isActive ? "active" : ""} ${unread ? "unread" : ""}`}
                onClick={() => onOpen(h)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(h);
                  }
                }}
              >
                {/* Asunto + punto de no leído + avatar de estado + borrador */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                  <span className="mail-unread-slot" aria-hidden>
                    {unread && <span className="mail-unread-dot" />}
                  </span>
                  <span className="mail-avatar" data-tone={tone}>
                    <span className="material-icons">{waiting ? "reply" : "schedule_send"}</span>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="serif"
                      style={{
                        fontSize: 14.5,
                        fontWeight: unread ? 700 : 600,
                        letterSpacing: "-0.01em",
                        color: unread ? "var(--ink)" : "var(--ink-2)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {h.asunto || "(sin asunto)"}
                    </div>
                    {hasDraft && (
                      <span className="mail-draft">
                        <span className="material-icons">auto_awesome</span>
                        Borrador listo
                      </span>
                    )}
                  </div>
                </div>

                {/* Estado */}
                <div>
                  <span className="mail-state" data-tone={tone}>
                    <span className={`dot dot-${tone}`} />
                    {waiting ? "Esperando respuesta" : "Te deben respuesta"}
                  </span>
                </div>

                {/* Remitente */}
                <div
                  className="meta"
                  style={{
                    fontSize: 12,
                    color: "var(--ink-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={remitenteDeHilo(h)}
                >
                  {remitenteDeHilo(h)}
                </div>

                {/* Última actividad: relativo + fecha exacta */}
                <div className="meta" style={{ fontSize: 11.5, lineHeight: 1.35 }}>
                  <span style={{ color: "var(--ink-2)" }}>{mailTimeAgo(h.ultimo_mensaje_at)}</span>
                  {h.ultimo_mensaje_at && (
                    <span
                      className="mono"
                      style={{
                        display: "block",
                        fontSize: 10.5,
                        color: "var(--ink-4)",
                        marginTop: 2,
                      }}
                    >
                      {formatDate(h.ultimo_mensaje_at)}
                    </span>
                  )}
                </div>

                {/* Acciones rápidas (aparecen al hover) */}
                <div className="mail-actions" onClick={(e) => e.stopPropagation()}>
                  {onToggleSeen && (
                    <button
                      type="button"
                      className="mail-act press"
                      title={unread ? "Marcar como leído" : "Marcar como no leído"}
                      disabled={busy}
                      onClick={() => onToggleSeen(h)}
                    >
                      <span className="material-icons">
                        {unread ? "mark_email_read" : "mark_email_unread"}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="mail-act press"
                    title="Abrir y responder"
                    disabled={busy}
                    onClick={() => onOpen(h)}
                  >
                    <span className="material-icons">open_in_full</span>
                  </button>
                  {onArchive && (
                    <button
                      type="button"
                      className="mail-act mail-act-archive press"
                      title="Archivar (sale de la bandeja)"
                      disabled={busy}
                      onClick={() => onArchive(h)}
                    >
                      <span className={`material-icons${busy ? " animate-spin" : ""}`}>
                        {busy ? "progress_activity" : "archive"}
                      </span>
                    </button>
                  )}
                  {onDiscard && (
                    <button
                      type="button"
                      className="mail-act mail-act-trash press"
                      title="Descartar · no corresponde a gestión"
                      disabled={busy}
                      onClick={() => onDiscard(h)}
                    >
                      <span className="material-icons">delete_outline</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
