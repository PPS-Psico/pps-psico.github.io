import React, { useMemo, useState } from "react";
import {
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS,
} from "../../../constants";
import type { LanzamientoPPS } from "../../../types";
import { formatDate, parseToUTCDate } from "../../../utils/formatters";
import type { InstitutionVM } from "./gestionTypes";

// ─── CalendarView ─────────────────────────────────────────────────────────────

interface CalEvent {
  date: Date;
  tipo: string;
  color: string;
  label: string;
  vmKey: string;
}

const TIPO_META: Record<string, { color: string; label: string }> = {
  inicio: { color: "var(--ok)", label: "Inicio" },
  fin: { color: "var(--warn)", label: "Finaliza" },
  seguimiento: { color: "var(--accent)", label: "Seguimiento" },
  relanzamiento: { color: "var(--ai)", label: "Relanzamiento" },
};

function buildCalendarEvents(institutions: InstitutionVM[]): CalEvent[] {
  const evs: CalEvent[] = [];
  institutions.forEach((vm) => {
    vm.launches.forEach((l) => {
      const push = (field: string, tipo: string) => {
        const raw = l[field as keyof LanzamientoPPS] as unknown as string | null;
        const d = parseToUTCDate(raw || undefined);
        if (d)
          evs.push({
            date: d,
            tipo,
            color: TIPO_META[tipo].color,
            label: `${TIPO_META[tipo].label} · ${vm.nombre}`,
            vmKey: vm.key,
          });
      };
      push(FIELD_FECHA_INICIO_LANZAMIENTOS, "inicio");
      push(FIELD_FECHA_FIN_LANZAMIENTOS, "fin");
      push(FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS, "seguimiento");
      push(FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS, "relanzamiento");
    });
  });
  return evs;
}

export const CalendarView: React.FC<{
  institutions: InstitutionVM[];
  onSelectKey: (key: string) => void;
}> = ({ institutions, onSelectKey }) => {
  const events = useMemo(() => buildCalendarEvents(institutions), [institutions]);
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthEvents = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    events.forEach((e) => {
      const k = `${e.date.getUTCFullYear()}-${e.date.getUTCMonth()}-${e.date.getUTCDate()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return map;
  }, [events]);

  const agenda = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => e.date.getTime() >= now - 86400000)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 14);
  }, [events]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString("es", { month: "long", year: "numeric" });
  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <>
      <header
        style={{
          padding: "20px 32px 16px",
          borderBottom: "1px solid var(--rule-2)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <span className="eyebrow">Planificación</span>
          <h2
            className="serif"
            style={{
              margin: "4px 0 0",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textTransform: "capitalize",
            }}
          >
            {monthLabel}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn-sm press"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>
              chevron_left
            </span>
          </button>
          <button
            className="btn btn-sm press"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Hoy
          </button>
          <button
            className="btn btn-sm press"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>
              chevron_right
            </span>
          </button>
        </div>
      </header>

      <div style={{ padding: "16px 32px 0" }}>
        {/* Leyenda de tipos de evento */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(TIPO_META).map(([k, m]) => (
            <span
              key={k}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "var(--ink-3)",
              }}
            >
              <span className="dot" style={{ background: m.color, width: 7, height: 7 }} />
              {m.label}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {weekdays.map((w) => (
            <div key={w} className="label" style={{ padding: "0 8px 6px", fontSize: 10 }}>
              {w}
            </div>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-cell dim" />;
            const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = monthEvents.get(k) || [];
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} className={`cal-cell ${isToday ? "today" : ""}`}>
                <span className="cal-num">{d.getDate()}</span>
                {dayEvents.slice(0, 3).map((e, j) => (
                  <span
                    key={j}
                    className="cal-ev"
                    title={e.label}
                    onClick={() => onSelectKey(e.vmKey)}
                    style={{
                      background: "var(--paper-2)",
                      color: e.color,
                      borderLeft: `2px solid ${e.color}`,
                    }}
                  >
                    {e.label}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="meta" style={{ fontSize: 9 }}>
                    +{dayEvents.length - 3}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "24px 32px 64px" }}>
        <span className="label">Próximos eventos</span>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
          {agenda.length === 0 ? (
            <div className="meta">No hay eventos con fecha cargada.</div>
          ) : (
            agenda.map((e, i) => (
              <button
                key={i}
                className="row-hover press"
                onClick={() => onSelectKey(e.vmKey)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 10px 1fr",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 6px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span className="meta mono" style={{ fontSize: 11 }}>
                  {formatDate(e.date.toISOString())}
                </span>
                <span className="dot" style={{ background: e.color, width: 7, height: 7 }} />
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--ink-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.label}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
};
