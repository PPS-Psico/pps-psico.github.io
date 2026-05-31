/* global React, CATEGORIES, INSTITUCIONES, INST_BY_ID, ITEMS, GESTION_STATES, TEMPLATES, missingFlagsFor */
const { useState: useStateG, useMemo: useMemoG, useEffect: useEffectG } = React;

const orientSlug = (o) =>
  o ? o.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

// ─── CALENDAR VIEW ───────────────────────────────────────────────────
// Operational, not decorative. Three modes:
//   · Mes    — grid mensual con barras horizontales para spans + chips puntuales
//   · Semana — vista de 7 días con detalle ampliado
//   · Lista  — agenda cronológica scrolleable
// Filtros por tipo: click en los chips de la leyenda para ocultar/mostrar.
const TODAY = '2026-05-26';

// Date helpers (work in ISO strings, no timezone surprises)
const isoToDate = (iso) => new Date(iso + 'T00:00:00');
const dateToIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (iso, n) => { const d = isoToDate(iso); d.setDate(d.getDate() + n); return dateToIso(d); };
const mondayOf = (iso) => {
  const d = isoToDate(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return dateToIso(d);
};

// Lane assignment for spans within a week range [weekStart .. weekEnd] (inclusive ISO)
// Returns { laneMap: {evId: laneIdx}, laneCount }
function assignLanes(spans, weekStart, weekEnd) {
  const sorted = [...spans].sort((a, b) =>
    a.date.localeCompare(b.date) || b.dateEnd.localeCompare(a.dateEnd)
  );
  const lanes = []; // lanes[i] = clamped endIso of last span in that lane
  const laneMap = {};
  for (const s of sorted) {
    const startIso = s.date < weekStart ? weekStart : s.date;
    const endIso   = s.dateEnd > weekEnd ? weekEnd  : s.dateEnd;
    let lane = lanes.findIndex(end => end < startIso);
    if (lane === -1) { lanes.push(endIso); lane = lanes.length - 1; }
    else lanes[lane] = endIso;
    laneMap[s.id] = lane;
  }
  return { laneMap, laneCount: lanes.length };
}

function CalendarView({ events, onSelectInst }) {
  const [mode, setMode] = useStateG(() => {
    try { return localStorage.getItem('gestion-cal-mode') || 'mes'; } catch { return 'mes'; }
  });
  const [anchor, setAnchor] = useStateG(TODAY); // ancla de navegación (cualquier día del periodo en vista)
  const [enabledTipos, setEnabledTipos] = useStateG(() => new Set(Object.keys(CALENDAR_TIPO_META)));

  useEffectG(() => {
    try { localStorage.setItem('gestion-cal-mode', mode); } catch {}
  }, [mode]);

  // Apply tipo filter
  const filteredEvents = useMemoG(
    () => events.filter(ev => enabledTipos.has(ev.tipo)),
    [events, enabledTipos]
  );

  const toggleTipo = (tipo) => {
    setEnabledTipos(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo); else next.add(tipo);
      return next;
    });
  };
  const onlyTipo = (tipo) => setEnabledTipos(new Set([tipo]));
  const allTipos = () => setEnabledTipos(new Set(Object.keys(CALENDAR_TIPO_META)));

  // Navigation deltas by mode
  const nav = (dir) => {
    if (mode === 'mes') {
      const d = isoToDate(anchor); d.setMonth(d.getMonth() + dir); d.setDate(1);
      setAnchor(dateToIso(d));
    } else if (mode === 'semana') {
      setAnchor(addDays(anchor, dir * 7));
    } else {
      setAnchor(addDays(anchor, dir * 14));
    }
  };
  const goToday = () => setAnchor(TODAY);

  // Header label
  const headerLabel = useMemoG(() => {
    if (mode === 'mes') {
      return isoToDate(anchor).toLocaleDateString('es', { month: 'long', year: 'numeric' });
    }
    if (mode === 'semana') {
      const ws = mondayOf(anchor);
      const we = addDays(ws, 6);
      const a = isoToDate(ws), b = isoToDate(we);
      const sameMonth = a.getMonth() === b.getMonth();
      const left = a.toLocaleDateString('es', { day: 'numeric', month: sameMonth ? undefined : 'short' });
      const right = b.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${left} – ${right}`;
    }
    return 'Próximos 60 días';
  }, [mode, anchor]);

  const eventsInRangeCount = useMemoG(() => {
    if (mode === 'mes') {
      const d = isoToDate(anchor);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return filteredEvents.filter(ev =>
        (ev.date.startsWith(key)) ||
        (ev.dateEnd && ev.date <= `${key}-31` && ev.dateEnd >= `${key}-01`)
      ).length;
    }
    if (mode === 'semana') {
      const ws = mondayOf(anchor), we = addDays(ws, 6);
      return filteredEvents.filter(ev =>
        (ev.date >= ws && ev.date <= we) ||
        (ev.dateEnd && ev.date <= we && ev.dateEnd >= ws)
      ).length;
    }
    const end = addDays(TODAY, 60);
    return filteredEvents.filter(ev => ev.date >= TODAY && ev.date <= end).length;
  }, [filteredEvents, mode, anchor]);

  return (
    <>
      <header style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--rule-2)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">Calendario operativo · 2026</span>
            <h2 className="serif" style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
              {headerLabel}
            </h2>
            <div className="meta" style={{ marginTop: 6 }}>
              {eventsInRangeCount} {eventsInRangeCount === 1 ? 'evento visible' : 'eventos visibles'}
              {enabledTipos.size < Object.keys(CALENDAR_TIPO_META).length && (
                <>
                  {' · '}
                  <button className="btn-link" onClick={allTipos}
                    style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit', fontSize: 12.5 }}>
                    mostrar todos
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Mode switch */}
            <div role="tablist" style={{
              display: 'inline-flex', padding: 2, borderRadius: 999,
              background: 'var(--paper-2)', border: '1px solid var(--rule-2)',
            }}>
              {[
                { id: 'mes',    label: 'Mes' },
                { id: 'semana', label: 'Semana' },
                { id: 'lista',  label: 'Lista' },
              ].map(opt => (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={mode === opt.id}
                  onClick={() => setMode(opt.id)}
                  className="press"
                  style={{
                    padding: '5px 12px', borderRadius: 999, border: 0,
                    background: mode === opt.id ? 'var(--paper)' : 'transparent',
                    color: mode === opt.id ? 'var(--ink)' : 'var(--ink-3)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: mode === opt.id ? '0 1px 2px rgba(20,19,16,0.08)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn btn-sm press" onClick={() => nav(-1)} title="Anterior">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
              <button className="btn btn-sm press" onClick={goToday}>Hoy</button>
              <button className="btn btn-sm press" onClick={() => nav(1)} title="Siguiente">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Clickable legend / tipo filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {Object.entries(CALENDAR_TIPO_META).map(([k, m]) => {
            const on = enabledTipos.has(k);
            return (
              <button
                key={k}
                className="press"
                onClick={() => toggleTipo(k)}
                onDoubleClick={() => onlyTipo(k)}
                title={on ? 'Click: ocultar · Doble click: solo este' : 'Click: mostrar'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 8px', borderRadius: 999,
                  border: `1px solid ${on ? 'var(--rule-2)' : 'var(--rule-2)'}`,
                  background: on ? m.soft : 'transparent',
                  color: on ? m.color : 'var(--ink-4)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: on ? 'none' : 'line-through',
                  opacity: on ? 1 : 0.6,
                  transition: 'all .12s ease',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: m.kind === 'span' ? 2 : 999,
                  background: on ? m.color : 'var(--ink-4)',
                }}></span>
                {m.label}
              </button>
            );
          })}
        </div>
      </header>

      {mode === 'mes' && <MonthView anchor={anchor} events={filteredEvents} onSelectInst={onSelectInst} />}
      {mode === 'semana' && <WeekView anchor={anchor} events={filteredEvents} onSelectInst={onSelectInst} />}
      {mode === 'lista' && <ListView events={filteredEvents} onSelectInst={onSelectInst} />}
    </>
  );
}

// ─── MONTH VIEW ──────────────────────────────────────────────────────
function MonthView({ anchor, events, onSelectInst }) {
  const { year, month } = useMemoG(() => {
    const d = isoToDate(anchor);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [anchor]);

  // 6 weeks × 7 days starting from the Monday before day 1
  const weeks = useMemoG(() => {
    const first = new Date(year, month, 1);
    const dow = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - dow);
    const out = [];
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start);
        dt.setDate(start.getDate() + w * 7 + d);
        days.push({
          iso: dateToIso(dt),
          day: dt.getDate(),
          isCurrentMonth: dt.getMonth() === month,
          isToday: dateToIso(dt) === TODAY,
          isPast: dateToIso(dt) < TODAY,
        });
      }
      out.push({ days });
    }
    // Drop trailing empty week if fully outside the month and no events
    return out;
  }, [year, month]);

  const moments = useMemoG(
    () => events.filter(ev => CALENDAR_TIPO_META[ev.tipo]?.kind === 'moment'),
    [events]
  );
  const spans = useMemoG(
    () => events.filter(ev => CALENDAR_TIPO_META[ev.tipo]?.kind === 'span' && ev.dateEnd),
    [events]
  );

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, padding: '14px 0 8px' }}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="label" style={{ fontSize: 10, textAlign: 'left', padding: '0 8px' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {weeks.map((wk, i) => (
          <WeekRow
            key={i}
            days={wk.days}
            spans={spans}
            moments={moments}
            onSelectInst={onSelectInst}
            compact
          />
        ))}
      </div>
    </div>
  );
}

// One row of 7 days, with span bars overlaid + moment chips inside each day cell
function WeekRow({ days, spans, moments, onSelectInst, compact }) {
  const weekStart = days[0].iso;
  const weekEnd = days[6].iso;

  // Spans active in this week
  const activeSpans = spans.filter(ev => ev.date <= weekEnd && ev.dateEnd >= weekStart);
  const { laneMap, laneCount } = useMemoG(
    () => assignLanes(activeSpans, weekStart, weekEnd),
    [activeSpans.map(s => s.id).join(','), weekStart, weekEnd]
  );

  const laneHeight = 18;
  const lanesArea = laneCount * (laneHeight + 2);

  return (
    <div style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: 0,
      minHeight: compact ? 110 : 140,
      border: '1px solid var(--rule-2)',
      borderRadius: 8,
      overflow: 'hidden',
      background: 'var(--paper)',
    }}>
      {/* Day cells (background, day number, moment chips) */}
      {days.map((d, di) => {
        const dayMoments = moments.filter(ev => ev.date === d.iso);
        const visibleMoments = dayMoments.slice(0, compact ? 3 : 6);
        const extra = dayMoments.length - visibleMoments.length;
        return (
          <div
            key={d.iso}
            style={{
              borderLeft: di === 0 ? 0 : '1px solid var(--rule-2)',
              padding: 8,
              display: 'flex', flexDirection: 'column',
              background: d.isToday ? 'var(--accent-soft)' : 'transparent',
              minHeight: 0,
            }}
          >
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              fontWeight: d.isToday ? 700 : 500,
              color: d.isToday ? 'var(--accent)' : d.isCurrentMonth ? 'var(--ink-2)' : 'var(--ink-4)',
              opacity: d.isPast && !d.isToday ? 0.55 : 1,
              marginBottom: 4,
            }}>
              {d.day}
              {d.isToday && (
                <span className="eyebrow" style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 8.5 }}>hoy</span>
              )}
            </div>
            {/* Reserve space for span lanes above */}
            <div style={{ height: lanesArea }}></div>
            {/* Moment chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              {visibleMoments.map(ev => {
                const meta = CALENDAR_TIPO_META[ev.tipo];
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSelectInst?.(ev.instId)}
                    title={ev.titulo + ' — ' + ev.detalle}
                    className="press"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 5px', borderRadius: 4, border: 0,
                      background: meta.soft, color: meta.color,
                      fontSize: 10, fontWeight: 600, lineHeight: 1.2,
                      cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left',
                      minWidth: 0,
                    }}
                  >
                    <span style={{ width: 4, height: 4, borderRadius: 999, background: meta.color, flexShrink: 0 }}></span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {ev.titulo}
                    </span>
                  </button>
                );
              })}
              {extra > 0 && (
                <span style={{ fontSize: 9.5, color: 'var(--ink-3)', padding: '0 5px' }}>+ {extra} más</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Span bars overlaid */}
      {activeSpans.map(ev => {
        const meta = CALENDAR_TIPO_META[ev.tipo];
        const startIso = ev.date < weekStart ? weekStart : ev.date;
        const endIso   = ev.dateEnd > weekEnd ? weekEnd : ev.dateEnd;
        const startIdx = days.findIndex(d => d.iso === startIso);
        const endIdx   = days.findIndex(d => d.iso === endIso);
        if (startIdx < 0 || endIdx < 0) return null;
        const cols = endIdx - startIdx + 1;
        const lane = laneMap[ev.id] ?? 0;
        const continuesLeft = ev.date < weekStart;
        const continuesRight = ev.dateEnd > weekEnd;
        return (
          <button
            key={ev.id}
            onClick={() => onSelectInst?.(ev.instId)}
            title={ev.titulo + ' — ' + ev.detalle}
            className="press"
            style={{
              position: 'absolute',
              top: `calc(${24 + lane * (laneHeight + 2)}px + 8px)`,
              left: `calc(${(startIdx / 7) * 100}% + 6px)`,
              width: `calc(${(cols / 7) * 100}% - 12px)`,
              height: laneHeight,
              padding: '0 8px',
              display: 'flex', alignItems: 'center', gap: 5,
              background: meta.color,
              color: '#fff',
              fontSize: 10.5, fontWeight: 600,
              border: 0,
              borderRadius: 4,
              borderTopLeftRadius: continuesLeft ? 0 : 4,
              borderBottomLeftRadius: continuesLeft ? 0 : 4,
              borderTopRightRadius: continuesRight ? 0 : 4,
              borderBottomRightRadius: continuesRight ? 0 : 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              boxShadow: '0 1px 2px rgba(20,19,16,0.08)',
            }}
          >
            {continuesLeft && <span style={{ opacity: 0.7, fontSize: 9 }}>‹</span>}
            <span className="material-symbols-outlined" style={{ fontSize: 11, opacity: 0.85 }}>{meta.icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titulo}</span>
            {continuesRight && <span style={{ opacity: 0.7, fontSize: 9, marginLeft: 'auto' }}>›</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── WEEK VIEW ───────────────────────────────────────────────────────
function WeekView({ anchor, events, onSelectInst }) {
  const ws = useMemoG(() => mondayOf(anchor), [anchor]);
  const days = useMemoG(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDays(ws, i);
      const d = isoToDate(iso);
      out.push({
        iso,
        day: d.getDate(),
        weekday: d.toLocaleDateString('es', { weekday: 'short' }),
        isToday: iso === TODAY,
        isPast: iso < TODAY,
        isCurrentMonth: true,
      });
    }
    return out;
  }, [ws]);

  const moments = events.filter(ev => CALENDAR_TIPO_META[ev.tipo]?.kind === 'moment');
  const spans = events.filter(ev => CALENDAR_TIPO_META[ev.tipo]?.kind === 'span' && ev.dateEnd);

  return (
    <div style={{ padding: '20px 24px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 8 }}>
        {days.map(d => (
          <div key={d.iso} style={{ padding: '0 8px' }}>
            <div className="label" style={{ fontSize: 10, color: d.isToday ? 'var(--accent)' : 'var(--ink-3)' }}>
              {d.weekday}
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 18, fontWeight: 600,
              color: d.isToday ? 'var(--accent)' : 'var(--ink)',
              opacity: d.isPast && !d.isToday ? 0.5 : 1,
            }}>
              {d.day}
            </div>
          </div>
        ))}
      </div>
      <WeekRow days={days} spans={spans} moments={moments} onSelectInst={onSelectInst} compact={false} />

      {/* Detail strip below — per day full descriptions */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {days.map(d => {
          const dayMoments = moments.filter(ev => ev.date === d.iso);
          const daySpans = spans.filter(ev =>
            (ev.date === d.iso) || (ev.dateEnd === d.iso)
          );
          if (dayMoments.length + daySpans.length === 0) return null;
          return (
            <DayDetailRow
              key={d.iso}
              date={d.iso}
              moments={dayMoments}
              spans={daySpans}
              onSelectInst={onSelectInst}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayDetailRow({ date, moments, spans, onSelectInst }) {
  const d = isoToDate(date);
  const isToday = date === TODAY;
  const dayLabel = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' });

  const all = [
    ...spans.map(ev => ({ ...ev, _milestone: ev.date === date ? 'inicia' : 'termina' })),
    ...moments.map(ev => ({ ...ev, _milestone: null })),
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, padding: '8px 0', borderTop: '1px solid var(--rule-2)' }}>
      <div style={{ paddingTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--ink-2)', textTransform: 'capitalize' }}>
          {dayLabel}
        </div>
        {isToday && (
          <div className="meta mono" style={{ fontSize: 10.5, marginTop: 2, color: 'var(--accent)' }}>hoy</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {all.map(ev => <EventRow key={ev.id + (ev._milestone || '')} ev={ev} onSelectInst={onSelectInst} milestone={ev._milestone} />)}
      </div>
    </div>
  );
}

// ─── LIST VIEW ───────────────────────────────────────────────────────
function ListView({ events, onSelectInst }) {
  // Flatten: for spans, surface as TWO entries (inicia / termina). Moments as-is.
  const flat = useMemoG(() => {
    const out = [];
    events.forEach(ev => {
      const meta = CALENDAR_TIPO_META[ev.tipo];
      if (meta?.kind === 'span' && ev.dateEnd) {
        out.push({ ...ev, _date: ev.date, _milestone: 'inicia' });
        out.push({ ...ev, _date: ev.dateEnd, _milestone: 'termina' });
      } else {
        out.push({ ...ev, _date: ev.date, _milestone: null });
      }
    });
    return out
      .filter(e => e._date >= TODAY)
      .sort((a, b) => a._date.localeCompare(b._date));
  }, [events]);

  const grouped = useMemoG(() => {
    const map = new Map();
    flat.forEach(ev => {
      if (!map.has(ev._date)) map.set(ev._date, []);
      map.get(ev._date).push(ev);
    });
    return Array.from(map.entries());
  }, [flat]);

  return (
    <div style={{ padding: '20px 32px 64px' }}>
      {grouped.length === 0 ? (
        <div className="meta" style={{ padding: '60px 0', textAlign: 'center' }}>
          No hay eventos próximos con los filtros actuales.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grouped.map(([date, evs]) => (
            <ListGroup key={date} date={date} events={evs} onSelectInst={onSelectInst} />
          ))}
        </div>
      )}
    </div>
  );
}

function ListGroup({ date, events, onSelectInst }) {
  const d = isoToDate(date);
  const isToday = date === TODAY;
  const todayObj = isoToDate(TODAY);
  const diffDays = Math.round((d - todayObj) / 86400000);
  const dayLabel = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const relLabel = isToday ? 'hoy' : diffDays === 1 ? 'mañana' : diffDays < 7 ? `en ${diffDays} días` : diffDays < 30 ? `en ${Math.round(diffDays / 7)} sem` : `en ${Math.round(diffDays / 30)} meses`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--rule-2)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--ink-2)', textTransform: 'capitalize' }}>
          {dayLabel}
        </div>
        <div className="meta mono" style={{ fontSize: 10.5, marginTop: 2, color: isToday ? 'var(--accent)' : 'var(--ink-3)' }}>
          {relLabel}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map(ev => <EventRow key={ev.id + (ev._milestone || '')} ev={ev} milestone={ev._milestone} onSelectInst={onSelectInst} />)}
      </div>
    </div>
  );
}

// Shared event row used by week-detail and list views
function EventRow({ ev, milestone, onSelectInst }) {
  const meta = CALENDAR_TIPO_META[ev.tipo];
  const inst = INST_BY_ID[ev.instId];
  return (
    <button
      onClick={() => onSelectInst?.(ev.instId)}
      className="row-hover press"
      style={{
        display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 12,
        padding: '10px 12px', borderRadius: 8,
        border: '1px solid var(--rule-2)',
        background: 'var(--paper)',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        alignItems: 'flex-start',
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: 6, background: meta.soft, color: meta.color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        marginTop: 1,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{meta.icon}</span>
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{ev.titulo}</span>
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            background: meta.soft, color: meta.color, fontWeight: 600,
          }}>
            {milestone ? `${meta.label} · ${milestone}` : meta.label}
          </span>
        </div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 3 }}>
          {ev.detalle}
          {inst && <span style={{ color: 'var(--ink-4)' }}>{' · '}{inst.nombre}</span>}
        </div>
      </div>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ink-4)', alignSelf: 'center' }}>arrow_forward</span>
    </button>
  );
}

Object.assign(window, { CalendarView });

// ─── EDIT INSTITUCIÓN MODAL ─────────────────────────────────────────
// Surfaces missing fields with the rust flag style; saving emits a patch
// that the app merges into institution overrides + logs the action.
function EditInstitucionModal({ inst, onSave, onClose }) {
  if (!inst) return null;
  const [form, setForm] = useStateG({
    nombre: inst.nombre || '',
    tipo: inst.tipo || '',
    localidad: inst.localidad || '',
    referente: inst.referente || '',
    referenteRol: inst.referenteRol || '',
    telefono: inst.telefono || '',
    mail: inst.mail || '',
    convenio: inst.convenio || '',
    notas: inst.notas || '',
  });
  const initialFlags = useMemoG(() => missingFlagsFor(inst), [inst]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isMissing = (k) => {
    if (k === 'telefono')  return !form.telefono;
    if (k === 'mail')      return !form.mail;
    if (k === 'referente') return !form.referente;
    if (k === 'convenio')  return !form.convenio || /vencido|renovar/i.test(form.convenio);
    return false;
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 640, maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule-2)', position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 2 }}>
          <div className="eyebrow">Editar institución</div>
          <h3 className="serif" style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {inst.nombre}
          </h3>
          {initialFlags.length > 0 && (
            <div className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--warn)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>priority_high</span>
              Cargá los datos faltantes para sacar los flags rojos.
            </div>
          )}
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <EditField label="Nombre" k="nombre" value={form.nombre} onChange={set} fullWidth />
            <EditField label="Tipo" k="tipo" value={form.tipo} onChange={set} placeholder="Ej: Hospital pediátrico" />
            <EditField label="Localidad" k="localidad" value={form.localidad} onChange={set} placeholder="Ej: Almagro, CABA" />
            <EditField label="Referente" k="referente" value={form.referente} onChange={set} missing={isMissing('referente')} placeholder="Nombre y apellido" />
            <EditField label="Rol del referente" k="referenteRol" value={form.referenteRol} onChange={set} placeholder="Ej: Jefe de servicio" />
            <EditField label="Teléfono" k="telefono" value={form.telefono} onChange={set} missing={isMissing('telefono')} placeholder="+54 11 …" mono />
            <EditField label="Mail" k="mail" value={form.mail} onChange={set} missing={isMissing('mail')} placeholder="contacto@…" mono />
            <EditField label="Convenio" k="convenio" value={form.convenio} onChange={set} missing={isMissing('convenio')} placeholder="Vigente · firmado 2024" fullWidth />
          </div>
          <div style={{ marginTop: 16 }}>
            <span className="label">Notas internas</span>
            <textarea
              className="field"
              value={form.notas}
              onChange={(e) => set('notas', e.target.value)}
              style={{ marginTop: 6, minHeight: 80, fontSize: 13.5 }}
              placeholder="Pista para futuras gestiones · cómo responde, cuándo conviene contactar…"
            />
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>history</span>
            Se va a registrar como cambio en el historial.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button
              className="btn btn-primary press"
              onClick={() => onSave(inst.id, form)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditField({ label, k, value, onChange, placeholder, missing, mono, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {label}
        {missing && (
          <span className="flag-missing" style={{ fontSize: 9, padding: '1px 6px' }}>
            faltante
          </span>
        )}
      </span>
      <input
        className="field"
        value={value}
        onChange={(e) => onChange(k, e.target.value)}
        placeholder={placeholder}
        style={{
          marginTop: 6,
          fontSize: 13,
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
          borderColor: missing ? '#B4501E66' : undefined,
        }}
      />
    </div>
  );
}

// ─── REMINDER FORM ──────────────────────────────────────────────────
function ReminderForm({ inst, onSave, onClose }) {
  if (!inst) return null;
  const TYPES = [
    { id: 'contactar',  label: 'Contactar',  icon: 'phone',       hint: 'Llamar o WhatsApp' },
    { id: 'seguimiento', label: 'Seguimiento', icon: 'follow_the_signs', hint: 'Continuar gestión activa' },
    { id: 'vencimiento', label: 'Vencimiento', icon: 'event_busy',  hint: 'Antes de cierre' },
    { id: 'acreditacion', label: 'Acreditación', icon: 'verified',  hint: 'Tras finalizar PPS' },
  ];
  const PRESETS = [
    { id: '1d',  label: 'Mañana',        days: 1 },
    { id: '5d',  label: 'En 5 días',     days: 5 },
    { id: '1w',  label: 'En 1 semana',   days: 7 },
    { id: '2w',  label: 'En 2 semanas',  days: 14 },
    { id: '1m',  label: 'En 1 mes',      days: 30 },
  ];
  const [type, setType] = useStateG('seguimiento');
  const [preset, setPreset] = useStateG('5d');
  const [customDate, setCustomDate] = useStateG('');
  const [note, setNote] = useStateG('');
  const [linkedPps, setLinkedPps] = useStateG(inst.ppsHistory?.[0]?.cohort || '');

  const days = customDate
    ? Math.max(0, Math.round((new Date(customDate).getTime() - Date.now()) / 86400000))
    : (PRESETS.find(p => p.id === preset)?.days ?? 5);

  const dueLabel = useMemoG(() => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [days]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule-2)' }}>
          <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>alarm_add</span>
            Nuevo recordatorio
          </div>
          <h3 className="serif" style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {inst.nombre}
          </h3>
        </div>

        <div style={{ padding: 24 }}>
          {/* Tipo */}
          <span className="label">Tipo</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, marginBottom: 18 }}>
            {TYPES.map(t => {
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className="press"
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${active ? 'var(--ink)' : 'var(--rule-2)'}`,
                    background: active ? 'var(--paper-2)' : 'var(--paper)',
                    color: active ? 'var(--ink)' : 'var(--ink-2)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{t.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</span>
                  </div>
                  <div className="meta" style={{ fontSize: 11 }}>{t.hint}</div>
                </button>
              );
            })}
          </div>

          {/* Cuándo */}
          <span className="label">¿Cuándo?</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 10 }}>
            {PRESETS.map(p => {
              const active = preset === p.id && !customDate;
              return (
                <button
                  key={p.id}
                  onClick={() => { setPreset(p.id); setCustomDate(''); }}
                  className="chip"
                  style={{
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--paper)' : 'var(--ink-2)',
                    borderColor: active ? 'var(--ink)' : 'var(--rule-2)',
                  }}
                >{p.label}</button>
              );
            })}
          </div>
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="field"
            style={{ fontSize: 13, padding: '8px 12px' }}
          />
          <div className="meta mono" style={{ fontSize: 11.5, marginTop: 8 }}>
            → Te aviso el <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{dueLabel}</span>
            <span style={{ color: 'var(--ink-4)' }}> · en {days} día{days === 1 ? '' : 's'}</span>
          </div>

          {/* PPS asociada (opcional) */}
          {inst.ppsHistory && inst.ppsHistory.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <span className="label">PPS asociada · opcional</span>
              <select
                value={linkedPps}
                onChange={(e) => setLinkedPps(e.target.value)}
                className="field"
                style={{ fontSize: 13, marginTop: 6 }}
              >
                <option value="">— sin PPS específica —</option>
                {inst.ppsHistory.map((p, i) => (
                  <option key={i} value={p.cohort}>{p.cohort} · {p.orient} · {p.estado}</option>
                ))}
              </select>
            </div>
          )}

          {/* Nota */}
          <div style={{ marginTop: 18 }}>
            <span className="label">Nota</span>
            <textarea
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: confirmar continuidad cohorte 2026, ofrecer fechas concretas"
              style={{ marginTop: 6, minHeight: 70, fontSize: 13.5 }}
            />
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary press"
            onClick={() => onSave(inst.id, { type, days, dueLabel, note, linkedPps })}
            disabled={!note.trim()}
            style={{ opacity: !note.trim() ? 0.5 : 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>alarm_on</span>
            Crear recordatorio
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EditInstitucionModal, ReminderForm });

// ─── INSTITUCIONES (CRM browseable) ──────────────────────────────────
// Different surface, same workspace. Rail filters still apply, but the spine
// is the institutions list (not the actions queue).
function InstitucionesView({ institutions, selectedInstId, onSelect, onContact, query, setQuery, activeCat, counts, onResetCat }) {
  const [sortBy, setSortBy] = useStateG('nombre');         // nombre | actividad | proxima | faltantes
  const [sortDir, setSortDir] = useStateG('asc');
  const [conv, setConv]       = useStateG('all');           // all | vigente | renovar | vencido
  const [orient, setOrient]   = useStateG('all');           // all | clinica | educacional | laboral | comunitaria

  const filtered = useMemoG(() => {
    let rows = institutions;
    // Apply rail category filter (state-based) — only when not "hoy"
    if (activeCat && activeCat !== 'hoy' && activeCat !== 'faltaDato') {
      // Filter institutions that have an item in this state
      // (passed in via institutions, which already carries .currentState)
      rows = rows.filter(r => r.currentState === activeCat);
    }
    if (activeCat === 'faltaDato') {
      rows = rows.filter(r => missingFlagsFor(r).length > 0);
    }
    if (conv !== 'all') {
      rows = rows.filter(r => {
        const c = (r.convenio || '').toLowerCase();
        if (conv === 'vigente')  return /vigente/.test(c);
        if (conv === 'renovar')  return /renovar|vencido/.test(c) && /por renovar/.test(c);
        if (conv === 'vencido')  return /vencido/.test(c);
        return true;
      });
    }
    if (orient !== 'all') {
      rows = rows.filter(r => (r.orientaciones || []).some(o => orientSlug(o) === orient));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(r =>
        (r.nombre || '').toLowerCase().includes(q) ||
        (r.referente || '').toLowerCase().includes(q) ||
        (r.localidad || '').toLowerCase().includes(q) ||
        (r.telefono || '').toLowerCase().includes(q) ||
        (r.mail || '').toLowerCase().includes(q)
      );
    }
    // Sort
    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sortBy === 'nombre') { av = a.nombre || ''; bv = b.nombre || ''; }
      else if (sortBy === 'faltantes') { av = missingFlagsFor(a).length; bv = missingFlagsFor(b).length; }
      else if (sortBy === 'actividad') { av = a._lastActivityKey || ''; bv = b._lastActivityKey || ''; }
      else if (sortBy === 'proxima') { av = a._nextActionKey || ''; bv = b._nextActionKey || ''; }
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [institutions, activeCat, conv, orient, query, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const filtersActive = conv !== 'all' || orient !== 'all' || (activeCat !== 'hoy' && activeCat !== null);

  return (
    <>
      <header style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--rule-2)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">CRM · directorio de instituciones</span>
            <h2 className="serif" style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {filtered.length} {filtered.length === 1 ? 'institución' : 'instituciones'}
              {filtersActive && <span style={{ color: 'var(--ink-4)', fontWeight: 500, fontSize: 18 }}> · de {institutions.length}</span>}
            </h2>
            <div className="meta" style={{ marginTop: 6 }}>
              Buscar, auditar y limpiar — sin depender de la bandeja del día.
            </div>
          </div>
          <button className="btn btn-primary btn-sm press">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Nueva institución
          </button>
        </div>

        {/* Search + filter chips */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 260 }}>
            <span className="material-symbols-outlined" style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 16, color: 'var(--ink-4)', pointerEvents: 'none',
            }}>search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, referente, localidad, tel o mail…"
              className="field"
              style={{ paddingLeft: 38, fontSize: 13 }}
            />
          </div>

          <FilterDropdown label="Orientación" value={orient} onChange={setOrient} options={[
            { value: 'all', label: 'Todas' },
            { value: 'clinica', label: 'Clínica',      dot: 'orient-clinica' },
            { value: 'educacional', label: 'Educacional', dot: 'orient-educacional' },
            { value: 'laboral', label: 'Laboral',      dot: 'orient-laboral' },
            { value: 'comunitaria', label: 'Comunitaria', dot: 'orient-comunitaria' },
          ]} />
          <FilterDropdown label="Convenio" value={conv} onChange={setConv} options={[
            { value: 'all',     label: 'Todos' },
            { value: 'vigente', label: 'Vigente' },
            { value: 'renovar', label: 'Por renovar' },
            { value: 'vencido', label: 'Vencido' },
          ]} />
          {(activeCat && activeCat !== 'hoy') && (
            <button
              onClick={() => onResetCat?.()}
              className="chip"
              style={{ borderColor: 'var(--ink)', background: 'var(--ink)', color: 'var(--paper)' }}
              title="Quitar filtro del rail"
            >
              {CATEGORIES.find(c => c.id === activeCat)?.label}
              <span className="material-symbols-outlined" style={{ fontSize: 12, marginLeft: 2 }}>close</span>
            </button>
          )}
        </div>
      </header>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 2fr) 150px minmax(160px, 1.4fr) minmax(160px, 1.4fr) 140px 100px',
        gap: 16, padding: '12px 32px',
        borderBottom: '1px solid var(--rule-2)',
        background: 'var(--paper-2)',
        position: 'sticky', top: 0, zIndex: 5,
      }}>
        <SortHeader label="Institución"      active={sortBy === 'nombre'}    dir={sortDir} onClick={() => toggleSort('nombre')} />
        <SortHeader label="Estado actual"    static />
        <SortHeader label="Última actividad" active={sortBy === 'actividad'} dir={sortDir} onClick={() => toggleSort('actividad')} />
        <SortHeader label="Próxima acción"   active={sortBy === 'proxima'}   dir={sortDir} onClick={() => toggleSort('proxima')} />
        <SortHeader label="Faltantes"        active={sortBy === 'faltantes'} dir={sortDir} onClick={() => toggleSort('faltantes')} />
        <SortHeader label="" static />
      </div>

      {/* Rows */}
      <div style={{ paddingBottom: 64 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 32px', textAlign: 'center', color: 'var(--ink-3)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--ink-4)' }}>search_off</span>
            <div className="serif" style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>Sin resultados</div>
            <div className="meta" style={{ marginTop: 6 }}>Probá quitando algún filtro o cambiando la búsqueda.</div>
          </div>
        ) : filtered.map(inst => (
          <InstitucionRow
            key={inst.id}
            inst={inst}
            active={selectedInstId === inst.id}
            onSelect={() => onSelect(inst.id)}
            onContact={onContact}
          />
        ))}
      </div>
    </>
  );
}

function SortHeader({ label, active, dir, onClick, static: isStatic }) {
  if (isStatic) {
    return <span className="label" style={{ fontSize: 10 }}>{label}</span>;
  }
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        border: 'none', background: 'transparent', cursor: 'pointer',
        padding: 0, fontFamily: 'inherit', textAlign: 'left',
        color: active ? 'var(--ink)' : 'var(--ink-3)',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}
    >
      {label}
      {active && (
        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
          {dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
        </span>
      )}
    </button>
  );
}

function FilterDropdown({ label, value, onChange, options }) {
  const [open, setOpen] = useStateG(false);
  const cur = options.find(o => o.value === value);
  const isActive = value !== 'all';
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        className="chip"
        style={{
          background: isActive ? 'var(--ink)' : 'transparent',
          color: isActive ? 'var(--paper)' : 'var(--ink-2)',
          borderColor: isActive ? 'var(--ink)' : 'var(--rule-2)',
        }}
      >
        {cur?.dot && <span className={`dot dot-${cur.dot}`} style={{ width: 7, height: 7 }}></span>}
        <span>{label}{isActive ? `: ${cur.label}` : ''}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>expand_more</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 50,
          minWidth: 180, background: 'var(--paper)',
          border: '1px solid var(--rule-2)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(20,19,16,0.12)',
          padding: 4,
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onMouseDown={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: opt.value === value ? 'var(--paper-2)' : 'transparent',
                color: 'var(--ink-2)', fontSize: 12.5, textAlign: 'left',
              }}
            >
              {opt.dot && <span className={`dot dot-${opt.dot}`} style={{ width: 7, height: 7 }}></span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InstitucionRow({ inst, active, onSelect, onContact }) {
  const flags = missingFlagsFor(inst);
  const state = inst.currentState ? GESTION_STATES[inst.currentState] : null;
  return (
    <div
      onClick={onSelect}
      className="row-hover press"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 2fr) 150px minmax(160px, 1.4fr) minmax(160px, 1.4fr) 140px 100px',
        gap: 16, padding: '14px 32px',
        borderBottom: '1px solid var(--rule-2)',
        cursor: 'pointer',
        background: active ? 'var(--paper-2)' : 'transparent',
        borderLeft: `3px solid ${active ? 'var(--ink)' : 'transparent'}`,
        paddingLeft: active ? 29 : 32,
        alignItems: 'center', minHeight: 56,
      }}
    >
      {/* Institución */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {inst.nombre}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          {inst.orientaciones?.map(o => (
            <span key={o} className="chip-orient" data-orient={orientSlug(o)} style={{ fontSize: 10, padding: '2px 8px 2px 6px' }}>{o}</span>
          ))}
          {inst.localidad && (
            <span className="meta" style={{ fontSize: 10.5 }}>· {inst.localidad}</span>
          )}
        </div>
      </div>

      {/* Estado */}
      <div>
        {state ? (
          <span className="chip-status" data-state={inst.currentState} style={{ fontSize: 10.5 }}>
            <span className={`dot dot-${inst.currentState === 'pendienteDecision' ? 'ai' : inst.currentState === 'esperandoRespuesta' || inst.currentState === 'porFinalizar' ? 'accent' : inst.currentState === 'confirmada' || inst.currentState === 'activa' ? 'ok' : inst.currentState === 'reinsistir' || inst.currentState === 'porContactar' ? 'warn' : 'mute'}`} style={{ width: 5, height: 5 }}></span>
            {state.label}
          </span>
        ) : (
          <span className="meta" style={{ fontSize: 11 }}>—</span>
        )}
      </div>

      {/* Última actividad */}
      <div className="meta" style={{ fontSize: 12 }}>
        {inst._lastActivity || <span style={{ color: 'var(--ink-4)' }}>—</span>}
      </div>

      {/* Próxima acción */}
      <div className="meta" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
        {inst._nextAction || <span style={{ color: 'var(--ink-4)' }}>—</span>}
      </div>

      {/* Faltantes */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {flags.length === 0 ? (
          <span className="meta" style={{ fontSize: 11, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
            completo
          </span>
        ) : flags.slice(0, 3).map(f => (
          <span key={f.k} className="flag-missing" style={{ fontSize: 9 }} title={f.label}>
            <span className="material-symbols-outlined">{f.icon}</span>
          </span>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        {inst.telefono && (
          <button
            className="btn btn-ghost btn-sm press"
            title={`WhatsApp ${inst.telefono}`}
            onClick={() => onContact?.({ institucion: inst.id, state: inst.currentState || 'porContactar' }, 'whatsapp')}
            style={{ padding: 6, color: '#2F8F43' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chat</span>
          </button>
        )}
        {inst.mail && (
          <button
            className="btn btn-ghost btn-sm press"
            title={`Mail a ${inst.mail}`}
            onClick={() => onContact?.({ institucion: inst.id, state: inst.currentState || 'porContactar' }, 'mail')}
            style={{ padding: 6, color: 'var(--accent)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mail</span>
          </button>
        )}
        <button className="btn btn-ghost btn-sm" style={{ padding: 6, color: 'var(--ink-3)' }} title="Más" onClick={(e) => e.stopPropagation()}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_vert</span>
        </button>
      </div>
    </div>
  );
}

// ─── VIEW MODE TABS (Bandeja / Instituciones / Calendario) ───────────
function ViewModeTabs({ mode, onChange, badges = {} }) {
  const tabs = [
    { id: 'bandeja',      label: 'Bandeja',      icon: 'inbox',          hint: 'Acciones del día' },
    { id: 'hermes',       label: 'Hermes',       icon: 'auto_awesome',   hint: 'Sugerencias por revisar' },
    { id: 'instituciones', label: 'Instituciones', icon: 'apartment',     hint: 'CRM browseable' },
    { id: 'calendario',   label: 'Calendario',   icon: 'calendar_month', hint: 'PPS, recordatorios y cierres' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '8px 16px', background: 'var(--paper-2)',
      borderBottom: '1px solid var(--rule-2)',
    }}>
      {tabs.map(tab => {
        const active = mode === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            className="press"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', borderRadius: 7,
              border: 'none', cursor: tab.disabled ? 'not-allowed' : 'pointer',
              background: active ? 'var(--paper)' : 'transparent',
              color: active ? 'var(--ink)' : tab.disabled ? 'var(--ink-4)' : 'var(--ink-3)',
              fontWeight: active ? 600 : 500, fontSize: 12.5,
              fontFamily: 'inherit',
              opacity: tab.disabled ? 0.6 : 1,
              boxShadow: active ? '0 1px 2px rgba(20,19,16,0.06)' : 'none',
            }}
            title={tab.hint}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
            {badges[tab.id] != null && (
              <span className="mono" style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 999,
                background: active ? 'var(--ink)' : 'var(--rule-2)',
                color: active ? 'var(--paper)' : 'var(--ink-3)',
                fontWeight: 600,
              }}>
                {badges[tab.id]}
              </span>
            )}
            {tab.disabled && (
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 4,
                background: 'var(--rule-2)', color: 'var(--ink-4)',
                fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                pronto
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { InstitucionesView, ViewModeTabs });

// ─── HERMES BANDEJA — cola de aprobación de sugerencias ──────────────
// Nada se envía solo. Hermes lee WhatsApp + Gmail y propone: borradores de
// respuesta, clasificaciones de contactos nuevos, y decisiones que requieren
// criterio humano. Vos aprobás, editás o descartás. Tres familias agrupadas.
function HermesBandeja({
  suggestions, onApproveDraft, onDiscard, onConfirmClasificacion,
  onResolveDecision, onSelectInst, onAddToCatalog, justActed,
}) {
  const a = (typeof HERMES_ALLOWLIST !== 'undefined') ? HERMES_ALLOWLIST : null;
  const drafts = suggestions.filter(s => s.tipo === 'draft');
  const clasifs = suggestions.filter(s => s.tipo === 'clasificacion');
  const decisions = suggestions.filter(s => s.tipo === 'decision');

  const total = suggestions.length;

  return (
    <>
      <header style={{ padding: '20px 32px 18px', borderBottom: '1px solid var(--rule-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ai)' }}>auto_awesome</span>
          <span className="eyebrow" style={{ color: 'var(--ai)' }}>Hermes · por revisar</span>
        </div>
        <h2 className="serif" style={{ margin: '5px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {total === 0 ? 'Bandeja al día' : `${total} ${total === 1 ? 'sugerencia' : 'sugerencias'} esperando tu visto`}
        </h2>
        <div className="meta" style={{ marginTop: 6, maxWidth: 580, lineHeight: 1.5 }}>
          Hermes leyó {a?.totalChats || 55} chats y la casilla de mail. <strong>Nada se envía sin tu aprobación.</strong> Revisá, editá o descartá.
        </div>
      </header>

      {total === 0 ? (
        <div style={{ padding: '80px 32px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--ok-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--ok)' }}>check_circle</span>
          </div>
          <div className="serif" style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: 'var(--ink-2)' }}>
            Todo revisado
          </div>
          <div className="meta" style={{ marginTop: 8, maxWidth: 280, marginInline: 'auto', lineHeight: 1.5 }}>
            Hermes no tiene nada pendiente. Cuando lleguen mensajes nuevos, vas a verlos acá.
          </div>
        </div>
      ) : (
        <div style={{ padding: '8px 32px 64px' }}>
          {drafts.length > 0 && (
            <HermesGroup
              icon="drafts" title="Borradores de respuesta"
              sub="Listos para aprobar y enviar" count={drafts.length}
            >
              {drafts.map(s => (
                <DraftSuggestionCard
                  key={s.id} s={s}
                  onApprove={(edited) => onApproveDraft(s.id, edited)}
                  onDiscard={() => onDiscard(s.id)}
                  onSelectInst={onSelectInst}
                  onAddToCatalog={onAddToCatalog}
                  acted={justActed[s.id]}
                />
              ))}
            </HermesGroup>
          )}

          {clasifs.length > 0 && (
            <HermesGroup
              icon="label" title="Clasificaciones"
              sub="Contactos nuevos que Hermes etiquetó" count={clasifs.length}
            >
              {clasifs.map(s => (
                <ClasificacionCard
                  key={s.id} s={s}
                  onConfirm={() => onConfirmClasificacion(s.id)}
                  onDiscard={() => onDiscard(s.id)}
                  acted={justActed[s.id]}
                />
              ))}
            </HermesGroup>
          )}

          {decisions.length > 0 && (
            <HermesGroup
              icon="pan_tool" title="Requieren tu criterio"
              sub="Hermes no decide esto por vos" count={decisions.length}
            >
              {decisions.map(s => (
                <DecisionCard
                  key={s.id} s={s}
                  onResolve={(idx) => onResolveDecision(s.id, idx)}
                  onSelectInst={onSelectInst}
                  acted={justActed[s.id]}
                />
              ))}
            </HermesGroup>
          )}
        </div>
      )}
    </>
  );
}

function HermesGroup({ icon, title, sub, count, children }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ink-3)' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</h3>
        <span className="mono" style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 999, background: 'var(--paper-2)', color: 'var(--ink-3)', fontWeight: 600 }}>{count}</span>
        <span className="meta" style={{ fontSize: 11.5 }}>{sub}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

// Confidence chip — calibrated, not neon
function ConfidenceTag({ value }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const level = pct >= 85 ? { label: 'alta', c: 'var(--ok)' } : pct >= 70 ? { label: 'media', c: 'var(--warn)' } : { label: 'baja', c: 'var(--ink-3)' };
  return (
    <span title={`Confianza del modelo: ${pct}%`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)',
    }}>
      <span style={{ width: 28, height: 4, borderRadius: 999, background: 'var(--rule-2)', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: level.c, borderRadius: 999 }}></span>
      </span>
      {pct}% · {level.label}
    </span>
  );
}

// Shared card shell — left AI accent rail, acted-on overlay
function HermesCardShell({ acted, children }) {
  return (
    <div style={{
      position: 'relative',
      border: '1px solid var(--rule-2)', borderRadius: 12,
      background: 'var(--paper)', overflow: 'hidden',
      borderLeft: '3px solid var(--ai)',
      opacity: acted ? 0.55 : 1,
      transition: 'opacity .2s ease',
    }}>
      {acted && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: 'color-mix(in srgb, var(--ok) 8%, var(--paper))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: 'var(--ok)', fontSize: 13, fontWeight: 600,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {acted === 'discarded' ? 'delete' : 'check_circle'}
          </span>
          {acted === 'discarded' ? 'Descartado' : acted === 'approved' ? 'Aprobado y enviado' : acted === 'confirmed' ? 'Clasificación confirmada' : 'Listo'}
        </div>
      )}
      {children}
    </div>
  );
}

function SuggestionMeta({ name, role, canal, confidence, generadoHace, onClickName }) {
  const isMail = canal === 'mail';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 16px 0' }}>
      <div style={{ minWidth: 0 }}>
        <button
          onClick={onClickName}
          disabled={!onClickName}
          style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: onClickName ? 'pointer' : 'default', color: 'var(--ink)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}
        >
          {name}
        </button>
        {role && <div className="meta" style={{ fontSize: 11.5 }}>{role}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {canal && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600,
            padding: '2px 8px', borderRadius: 999,
            background: isMail ? 'var(--accent-soft)' : 'color-mix(in srgb, var(--ok) 14%, var(--paper))',
            color: isMail ? 'var(--accent)' : '#2F8F43',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{isMail ? 'mail' : 'chat'}</span>
            {isMail ? 'Mail' : 'WhatsApp'}
          </span>
        )}
        <ConfidenceTag value={confidence} />
      </div>
    </div>
  );
}

function HermesReasoning({ text, warn }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--ai-soft)', alignItems: 'flex-start' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ai)', marginTop: 1, flexShrink: 0 }}>auto_awesome</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{text}</div>
        {warn && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11, fontWeight: 600, color: 'var(--warn)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
            {warn}
          </div>
        )}
      </div>
    </div>
  );
}

function DraftSuggestionCard({ s, onApprove, onDiscard, onSelectInst, onAddToCatalog, acted }) {
  const inst = s.instId ? INST_BY_ID[s.instId] : null;
  const unlinked = (!inst && s.contactId && typeof UNLINKED_CONTACTS !== 'undefined') ? UNLINKED_CONTACTS.find(c => c.id === s.contactId) : null;
  const name = inst ? inst.nombre : (s.enRespuestaA?.from || unlinked?.nombre || 'Contacto');
  const role = inst ? inst.tipo : (unlinked?.rol || null);
  const isMail = s.canal === 'mail';

  const [editing, setEditing] = useStateG(false);
  const [asunto, setAsunto] = useStateG(s.asunto || '');
  const [body, setBody] = useStateG(s.borrador || '');

  return (
    <HermesCardShell acted={acted}>
      <SuggestionMeta
        name={name} role={role} canal={s.canal} confidence={s.confidence} generadoHace={s.generadoHace}
        onClickName={inst ? () => onSelectInst?.(s.instId) : null}
      />
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Incoming message being replied to */}
        {s.enRespuestaA && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--ink-3)', borderLeft: '2px solid var(--rule-3)', paddingLeft: 10 }}>
            <div style={{ minWidth: 0 }}>
              <span className="meta" style={{ fontSize: 10.5, fontWeight: 600 }}>En respuesta a · {s.enRespuestaA.fecha}</span>
              <div style={{ marginTop: 2, fontStyle: 'italic', color: 'var(--ink-2)', lineHeight: 1.45 }}>"{s.enRespuestaA.texto}"</div>
            </div>
          </div>
        )}

        {/* Draft body */}
        <div style={{ border: '1px solid var(--rule-2)', borderRadius: 10, overflow: 'hidden' }}>
          {isMail && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--rule-2)', background: 'var(--paper-2)' }}>
              {editing ? (
                <input
                  value={asunto} onChange={(e) => setAsunto(e.target.value)}
                  style={{ width: '100%', border: 0, background: 'transparent', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', outline: 'none' }}
                />
              ) : (
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{asunto}</span>
              )}
            </div>
          )}
          {editing ? (
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              rows={Math.min(12, body.split('\n').length + 1)}
              style={{ width: '100%', border: 0, background: 'var(--paper)', font: 'inherit', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink)', padding: '10px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          ) : (
            <div style={{ padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{body}</div>
          )}
        </div>

        <HermesReasoning text={s.justificacion} warn={s.revisarAntes} />

        {/* Linked action (e.g. add to catalog) */}
        {s.accionLigada && (
          <button
            onClick={() => onAddToCatalog?.({ nombre: name })}
            className="press"
            style={{ display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', padding: '6px 11px', borderRadius: 8, border: '1px dashed var(--rule-3)', background: 'transparent', color: 'var(--ink-2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_link</span>
            {s.accionLigada.label}
          </button>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid var(--rule-2)', paddingTop: 12 }}>
          <span className="meta mono" style={{ fontSize: 10, marginRight: 'auto' }}>{s.generadoHace}</span>
          <button className="btn btn-ghost btn-sm press" onClick={onDiscard}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            Descartar
          </button>
          <button className="btn btn-sm press" onClick={() => setEditing(e => !e)}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{editing ? 'check' : 'edit'}</span>
            {editing ? 'Listo' : 'Editar'}
          </button>
          <button
            className={isMail ? 'btn btn-sm btn-mail press' : 'btn btn-sm btn-wa press'}
            onClick={() => onApprove({ asunto, borrador: body, edited: asunto !== s.asunto || body !== s.borrador })}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
            Aprobar y enviar
          </button>
        </div>
      </div>
    </HermesCardShell>
  );
}

function ClasificacionCard({ s, onConfirm, onDiscard, acted }) {
  const unlinked = (s.contactId && typeof UNLINKED_CONTACTS !== 'undefined') ? UNLINKED_CONTACTS.find(c => c.id === s.contactId) : null;
  const name = unlinked?.nombre || 'Contacto';
  const role = unlinked?.rol || null;
  const meta = (s.propuesta && typeof CONTACT_TIPOS !== 'undefined') ? CONTACT_TIPOS[s.propuesta] : null;
  const vincInst = s.vincularA ? INST_BY_ID[s.vincularA] : null;

  const accionLabel = {
    agregar_catalogo: 'Agregar al catálogo',
    vincular: vincInst ? `Vincular a ${vincInst.nombre}` : 'Vincular',
    descartar: 'Dejar fuera del catálogo',
  }[s.accion] || 'Confirmar';
  const accionIcon = { agregar_catalogo: 'add_link', vincular: 'link', descartar: 'block' }[s.accion] || 'check';

  return (
    <HermesCardShell acted={acted}>
      <SuggestionMeta name={name} role={role} confidence={s.confidence} generadoHace={s.generadoHace} />
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Last message preview */}
        {unlinked?.ultimo && (
          <div style={{ display: 'flex', gap: 8, padding: '9px 11px', borderRadius: 10, background: 'var(--paper-2)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.45 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#2F8F43', flexShrink: 0, marginTop: 1 }}>chat</span>
            <span>{unlinked.ultimo.from_me ? 'Vos: ' : ''}{unlinked.ultimo.texto}</span>
          </div>
        )}

        {/* Proposed classification */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="meta" style={{ fontSize: 11.5 }}>Hermes propone:</span>
          {meta ? <TipoBadge tipo={s.propuesta} /> : (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>block</span>
              No es institución
            </span>
          )}
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ink-4)' }}>arrow_forward</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{accionLabel}</span>
        </div>

        <HermesReasoning text={s.justificacion} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid var(--rule-2)', paddingTop: 12 }}>
          <span className="meta mono" style={{ fontSize: 10, marginRight: 'auto' }}>{s.generadoHace}</span>
          <button className="btn btn-ghost btn-sm press" onClick={onDiscard}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            {s.accion === 'descartar' ? 'Es institución' : 'Descartar'}
          </button>
          <button className="btn btn-sm btn-primary press" onClick={onConfirm}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{accionIcon}</span>
            {s.accion === 'descartar' ? 'Confirmar · dejar fuera' : accionLabel}
          </button>
        </div>
      </div>
    </HermesCardShell>
  );
}

function DecisionCard({ s, onResolve, onSelectInst, acted }) {
  const inst = s.instId ? INST_BY_ID[s.instId] : null;
  return (
    <HermesCardShell acted={acted}>
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: 'var(--ai-soft)', color: 'var(--ai)' }}>Tu criterio</span>
              {inst && (
                <button onClick={() => onSelectInst?.(s.instId)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: 11.5, color: 'var(--ink-3)', cursor: 'pointer' }}>
                  {inst.nombre}
                </button>
              )}
            </div>
            <h4 style={{ margin: '8px 0 0', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{s.titulo}</h4>
          </div>
          <span className="meta mono" style={{ fontSize: 10, flexShrink: 0 }}>{s.generadoHace}</span>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s.contexto}</div>

        <HermesReasoning text={s.justificacion} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--rule-2)', paddingTop: 12 }}>
          {s.opciones.map((op, i) => (
            <button
              key={i}
              className={op.primary ? 'btn btn-sm btn-primary press' : 'btn btn-sm press'}
              onClick={() => onResolve(i)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{op.icon}</span>
              {op.label}
            </button>
          ))}
        </div>
      </div>
    </HermesCardShell>
  );
}

Object.assign(window, { HermesBandeja });

// ─── RAIL ─────────────────────────────────────────────────────────────
function Rail({ activeCat, onSelectCat, counts, query, setQuery, collapsed, onToggleCollapsed }) {
  // Collapsed: slim 56px rail — just toggle + state dots + counts
  if (collapsed) {
    return (
      <aside className="rail" style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
        <button
          onClick={onToggleCollapsed}
          className="press"
          title="Mostrar lista"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '16px 0', borderBottom: '1px solid var(--rule-2)',
            display: 'flex', justifyContent: 'center', color: 'var(--ink-3)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
        </button>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {CATEGORIES.map(cat => {
            const count = counts[cat.id] ?? 0;
            const active = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCat(cat.id)}
                title={`${cat.label}${count ? ` · ${count}` : ''}`}
                className="press"
                style={{
                  width: '100%', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4,
                  padding: '10px 0', border: 'none', cursor: 'pointer',
                  background: active ? 'var(--paper-2)' : 'transparent',
                  borderLeft: `2px solid ${active ? 'var(--ink)' : 'transparent'}`,
                }}
              >
                {cat.tone
                  ? <span className={`dot dot-${cat.tone}`} style={{ width: 8, height: 8 }}></span>
                  : <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ink-3)' }}>{cat.icon}</span>}
                <span className="mono" style={{ fontSize: 10, color: active ? 'var(--ink-2)' : 'var(--ink-3)', fontWeight: active ? 700 : 400 }}>
                  {count || '·'}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: '12px 0', borderTop: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'center' }}>
          <span className="dot dot-ok dot-live" style={{ color: 'var(--ok)', width: 8, height: 8 }} title="Sincronizado"></span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="rail" style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em' }}>
              Gestión
            </h1>
            <div className="meta" style={{ marginTop: 4 }}>Escritorio de coordinación</div>
          </div>
          <button
            onClick={onToggleCollapsed}
            className="btn btn-ghost btn-sm"
            title="Plegar lista"
            style={{ padding: 4, flexShrink: 0 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-outlined" style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: 'var(--ink-4)', pointerEvents: 'none',
          }}>search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar institución…"
            className="field"
            style={{ paddingLeft: 32, fontSize: 12.5, paddingTop: 8, paddingBottom: 8 }}
          />
        </div>
      </div>

      <div className="rail-section-title label">Vistas</div>
      {CATEGORIES.filter(c => !c.group).map(cat => (
        <RailRow key={cat.id} cat={cat} active={activeCat === cat.id} count={counts[cat.id]} onClick={() => onSelectCat(cat.id)} />
      ))}

      <div className="rail-section-title label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#2F8F43' }}>forum</span>
        Conversaciones
      </div>
      {CATEGORIES.filter(c => c.group === 'conv').map(cat => (
        <RailRow key={cat.id} cat={cat} active={activeCat === cat.id} count={counts[cat.id]} onClick={() => onSelectCat(cat.id)} />
      ))}

      <div className="rail-section-title label">Estado de gestión</div>
      {CATEGORIES.filter(c => c.group === 'estado').map(cat => (
        <RailRow key={cat.id} cat={cat} active={activeCat === cat.id} count={counts[cat.id]} onClick={() => onSelectCat(cat.id)} />
      ))}

      {/* Privacy / allowlist — qué ve Hermes */}
      <AllowlistCard onClick={() => onSelectCat('sinVincular')} />

      <div style={{ padding: '16px 14px 16px', borderTop: '1px solid var(--rule-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="dot dot-ok dot-live" style={{ color: 'var(--ok)' }}></span>
          Sincronizado
        </span>
        <span className="mono meta" style={{ fontSize: 10.5 }}>v3.2</span>
      </div>
    </aside>
  );
}

function AllowlistCard({ onClick }) {
  const a = (typeof HERMES_ALLOWLIST !== 'undefined') ? HERMES_ALLOWLIST : null;
  if (!a) return null;
  return (
    <div style={{ padding: '14px 14px 4px', marginTop: 'auto' }}>
      <div style={{
        padding: 12, borderRadius: 10,
        background: 'var(--ai-soft)', border: '1px solid #5A2D8626',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ai)' }}>shield_lock</span>
          <span className="label" style={{ color: 'var(--ai)' }}>Privacidad</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          Hermes lee <strong>{a.totalChats} chats</strong> de tu lista <strong>“{a.listaNombre}”</strong>. Nada personal entra al sistema.
        </div>
        <button
          onClick={onClick}
          className="btn btn-ghost btn-sm press"
          style={{ marginTop: 8, padding: '4px 0', color: 'var(--ai)', fontSize: 11.5 }}
        >
          {a.sinVincular} sin vincular al catálogo
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

function RailRow({ cat, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rail-row ${active ? 'active' : ''}`}
      style={{ border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14 }}>
        {cat.tone
          ? <span className={`dot dot-${cat.tone}`}></span>
          : <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ink-3)' }}>{cat.icon}</span>}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.label}</span>
      <span className="count">{count ?? '·'}</span>
    </button>
  );
}

// ─── BANDEJA (center) ────────────────────────────────────────────────
function Bandeja({ items, selectedItemId, onSelect, onContact, activeCat, totalCount, onOpenAI }) {
  const cat = CATEGORIES.find(c => c.id === activeCat);
  const isToday = activeCat === 'hoy';

  // Cap: "Hoy" stays focused — top 7. Other categories show all.
  const cap = isToday ? 7 : items.length;
  const [showAll, setShowAll] = useStateG(false);
  const visible = showAll ? items : items.slice(0, cap);
  const hiddenCount = items.length - visible.length;

  // Reset "show all" when category changes
  useMemoG(() => { setShowAll(false); }, [activeCat]);

  return (
    <>
      <header style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--rule-2)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">{isToday ? 'Bandeja del día · martes 26 may' : 'Categoría'}</span>
            <h2 className="serif" style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {isToday ? <>Hoy conviene <em>esto</em></> : cat?.label}
            </h2>
            <div className="meta" style={{ marginTop: 6 }}>
              {isToday
                ? `${Math.min(items.length, cap)} acciones priorizadas · ${totalCount} cosas en gestión`
                : `${cat?.note} · ${items.length} ítems`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-sm press" onClick={onOpenAI}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ai)' }}>auto_awesome</span>
              <span>Pedirle a Hermes</span>
            </button>
            <button className="btn btn-sm press">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>tune</span>
              Filtros
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: '20px 32px 64px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--ink-4)' }}>check_circle</span>
            <div className="serif" style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>Nada pendiente en esta vista</div>
            <div className="meta" style={{ marginTop: 6 }}>Probá otra categoría o cambiá los filtros.</div>
          </div>
        ) : (
          <>
            {visible.map((item, i) => (
              <BandejaCard
                key={item.id}
                item={item}
                index={i + 1}
                active={selectedItemId === item.id}
                onSelect={() => onSelect(item.id)}
                onContact={onContact}
              />
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="press"
                style={{
                  marginTop: 8, padding: '12px 16px',
                  background: 'transparent', border: '1px dashed var(--rule-3)',
                  borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, color: 'var(--ink-3)', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
                Ver {hiddenCount} más
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── BANDEJA CARD ────────────────────────────────────────────────────
function BandejaCard({ item, index, active, onSelect, onContact }) {
  const inst = INST_BY_ID[item.institucion];
  const flags = missingFlagsFor(inst);
  const state = GESTION_STATES[item.state];

  // Channel icon for the suggested action
  const channelIcons = { whatsapp: 'whatsapp', mail: 'mail', ai: 'auto_awesome', lanzador: 'arrow_outward', note: 'edit_note' };
  const channelLabels = {
    whatsapp: 'WhatsApp',
    mail: 'Mail',
    ai: 'Hermes',
    lanzador: 'Lanzador',
    note: 'Nota',
  };

  return (
    <div className={`bandeja-card ${active ? 'active' : ''}`} onClick={onSelect}>
      <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 16, alignItems: 'flex-start' }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--ink-4)', paddingTop: 4 }}>
          {String(index).padStart(2, '0')}
        </div>

        <div style={{ minWidth: 0 }}>
          {/* Eyebrow row — state + missing flags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="chip-status" data-state={state.tone}>
              <span className={`dot dot-${state.tone === 'pendienteDecision' ? 'ai' : state.tone === 'esperandoRespuesta' || state.tone === 'porFinalizar' ? 'accent' : state.tone === 'confirmada' || state.tone === 'activa' ? 'ok' : state.tone === 'reinsistir' || state.tone === 'porContactar' ? 'warn' : 'mute'}`} style={{ width: 6, height: 6 }}></span>
              {state.label}
            </span>
            {flags.map(f => (
              <span key={f.k} className="flag-missing">
                <span className="material-symbols-outlined">{f.icon}</span>
                {f.label}
              </span>
            ))}
            {inst.orientaciones?.slice(0, 1).map(o => (
              <span key={o} className="chip-orient" data-orient={orientSlug(o)} style={{ fontSize: 10.5 }}>{o}</span>
            ))}
          </div>

          {/* Title — institution + action */}
          <h3 className="serif" style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--ink)' }}>
            {item.titulo}
          </h3>

          {/* Reason — the WHY */}
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>
            {item.razon}
          </div>
          {item.detalle && (
            <div className="meta" style={{ marginTop: 4, fontSize: 12 }}>
              {item.detalle}
            </div>
          )}

          {/* Next step + quick actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span className="meta mono" style={{ fontSize: 11 }}>
              → {item.nextStep}
            </span>
          </div>
        </div>

        {/* Right column — actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {inst.telefono && (
            <button
              className="btn btn-sm btn-wa press"
              onClick={(e) => { e.stopPropagation(); onContact(item, 'whatsapp'); }}
              title={`WhatsApp ${inst.telefono}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chat</span>
              WhatsApp
            </button>
          )}
          {inst.mail && (
            <button
              className="btn btn-sm btn-mail press"
              onClick={(e) => { e.stopPropagation(); onContact(item, 'mail'); }}
              title={`Mail a ${inst.mail}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
              Mail
            </button>
          )}
          {!inst.telefono && !inst.mail && (
            <button className="btn btn-sm btn-ai press" onClick={(e) => { e.stopPropagation(); onContact(item, 'ai'); }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              Hermes
            </button>
          )}
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>more_horiz</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FICHA RESUMEN (empty-state pane: overview when nothing selected) ─
// Shown in the right column when no institution is picked. Acts as the
// pane's "home" — counts del día, próximos eventos, sincronización.
function FichaResumen({
  todayEvents = [],
  upcomingEvents = [],
  counts = {},
  totalInstituciones = 0,
  recentLog = [],
  onSelectInst,
  onGoToCategory,
  onGoToCalendar,
}) {
  const fechaHoy = new Date('2026-05-26T12:00:00').toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <aside className="ficha">
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--rule-2)' }}>
        <span className="eyebrow">Resumen del día</span>
        <h2 className="serif" style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2, textTransform: 'capitalize' }}>
          {fechaHoy}
        </h2>
        <div className="meta" style={{ marginTop: 6, fontSize: 11.5 }}>
          Seleccioná una fila para ver su ficha.
        </div>
      </div>

      {/* Buckets — clickable mini-stat cards */}
      <div style={{ padding: '16px 18px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <ResumenStat
            tone="accent"
            n={(counts.porContactar || 0) + (counts.reinsistir || 0)}
            label="Para contactar hoy"
            sub={`${counts.porContactar || 0} nuevos · ${counts.reinsistir || 0} reinsistir`}
            onClick={() => onGoToCategory?.('porContactar')}
          />
          <ResumenStat
            tone="warn"
            n={counts.porFinalizar || 0}
            label="Por finalizar"
            sub="PPS que terminan"
            onClick={() => onGoToCategory?.('porFinalizar')}
          />
          <ResumenStat
            tone="ai"
            n={counts.pendienteDecision || 0}
            label="Esperan tu decisión"
            sub="Cierres y selección"
            onClick={() => onGoToCategory?.('pendienteDecision')}
          />
          <ResumenStat
            tone="muted"
            n={counts.faltaDato || 0}
            label="Falta dato"
            sub="Fichas incompletas"
            onClick={() => onGoToCategory?.('faltaDato')}
          />
        </div>
      </div>

      {/* Hoy + próximos eventos */}
      <div style={{ padding: '16px 24px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="label">Hoy en el calendario</span>
          <button
            onClick={onGoToCalendar}
            className="btn btn-ghost btn-sm press"
            style={{ padding: '2px 6px', fontSize: 11 }}
          >
            ver todo
            <span className="material-symbols-outlined" style={{ fontSize: 13, marginLeft: 2 }}>arrow_forward</span>
          </button>
        </div>
        {todayEvents.length === 0 ? (
          <div className="meta" style={{ fontSize: 11.5, padding: '6px 0 10px' }}>
            Sin eventos para hoy.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {todayEvents.slice(0, 4).map(ev => (
              <ResumenEventLine key={ev.id} ev={ev} onSelectInst={onSelectInst} relLabel="hoy" />
            ))}
          </div>
        )}
      </div>

      {upcomingEvents.length > 0 && (
        <div style={{ padding: '12px 24px 4px' }}>
          <span className="label">Próximos 7 días</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {upcomingEvents.slice(0, 5).map(ev => (
              <ResumenEventLine key={ev.id + ev._date} ev={ev} onSelectInst={onSelectInst} relLabel={ev._relLabel} />
            ))}
          </div>
        </div>
      )}

      {/* Recent activity in this session */}
      {recentLog.length > 0 && (
        <div style={{ padding: '20px 24px 4px' }}>
          <span className="label">Actividad reciente</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {recentLog.slice(0, 5).map(l => (
              <button
                key={l.id}
                onClick={() => onSelectInst?.(l.instId)}
                className="row-hover press"
                style={{
                  display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 10,
                  padding: '6px 8px', borderRadius: 6, border: 0,
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ink-4)', marginTop: 2 }}>
                  {l.action === 'sent' ? (l.channel === 'whatsapp' ? 'chat' : 'mail') : l.action === 'state' ? 'flag' : l.action === 'reminder' ? 'alarm' : 'edit'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {INST_BY_ID[l.instId]?.nombre || l.instId}
                  </div>
                  <div className="meta" style={{ fontSize: 10.5 }}>
                    {l.note ? (l.note.length > 38 ? l.note.slice(0, 38) + '…' : l.note) : '—'}
                  </div>
                </div>
                <span className="mono meta" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{l.hora}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer: sync state */}
      <div style={{ padding: '20px 24px 32px', marginTop: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--paper-2)', border: '1px solid var(--rule-2)',
        }}>
          <span className="dot dot-ok dot-live" style={{ width: 8, height: 8, color: 'var(--ok)' }}></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600 }}>
              {totalInstituciones} instituciones sincronizadas
            </div>
            <div className="meta" style={{ fontSize: 10.5 }}>
              Última actualización · hace 2 min
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ResumenStat({ tone = 'muted', n, label, sub, onClick }) {
  const colors = {
    accent: { c: 'var(--accent)', s: 'var(--accent-soft)' },
    warn:   { c: 'var(--warn)',   s: 'var(--warn-soft)' },
    ai:     { c: 'var(--ai)',     s: 'var(--ai-soft)' },
    ok:     { c: 'var(--ok)',     s: 'var(--ok-soft)' },
    muted:  { c: 'var(--ink-2)',  s: 'var(--paper-2)' },
  };
  const C = colors[tone] || colors.muted;
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        padding: '12px 12px 10px', borderRadius: 10,
        border: '1px solid var(--rule-2)',
        background: 'var(--paper)',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'all .12s ease',
      }}
    >
      <span style={{
        fontSize: 20, fontWeight: 700, color: n > 0 ? C.c : 'var(--ink-4)',
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em',
      }}>
        {n}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
        {label}
      </span>
      <span className="meta" style={{ fontSize: 10, marginTop: 1 }}>{sub}</span>
    </button>
  );
}

function ResumenEventLine({ ev, onSelectInst, relLabel }) {
  const meta = CALENDAR_TIPO_META[ev.tipo];
  if (!meta) return null;
  return (
    <button
      onClick={() => onSelectInst?.(ev.instId)}
      className="row-hover press"
      style={{
        display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: 10,
        padding: '8px 10px', borderRadius: 6, border: 0,
        background: 'transparent', cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit', alignItems: 'center',
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: meta.kind === 'span' ? 2 : 999,
        background: meta.color, marginLeft: 1,
      }}></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.titulo}
        </div>
        <div className="meta" style={{ fontSize: 10.5 }}>{meta.label}</div>
      </div>
      <span className="mono meta" style={{ fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
        {relLabel}
      </span>
    </button>
  );
}

// ─── FICHA (right pane) ──────────────────────────────────────────────
function Ficha({ inst, sessionLog = [], onChangeState, onCreateReminder, onContact, onEdit, onClose, resumen }) {
  // No selection → show overview (resumen) instead of empty state
  if (!inst) return <FichaResumen {...(resumen || {})} />;

  const flags = missingFlagsFor(inst);

  // Merge persistent + session log events into one timeline
  const sessionAsEvents = sessionLog.map(l => ({
    fecha: l.fecha,
    hora: l.hora,
    tipo: l.action === 'sent'
      ? (l.channel || 'mail')
      : (l.action === 'state' ? 'state'
        : (l.action === 'edit' ? 'note'
          : (l.action === 'reminder' ? 'note' : 'note'))),
    titulo: l.action === 'sent'
      ? (l.channel === 'whatsapp' ? 'WhatsApp preparado' : 'Mail preparado')
        + (l.nextState && l.nextState !== l.prevState ? ` · pasó a "${GESTION_STATES[l.nextState]?.label}"` : '')
      : l.action === 'state'
        ? `Estado: ${l.prevState ? GESTION_STATES[l.prevState]?.label + ' → ' : ''}${GESTION_STATES[l.nextState]?.label}`
        : l.action === 'edit'
          ? 'Ficha actualizada'
          : l.action === 'reminder'
            ? 'Recordatorio creado'
            : 'Nota',
    detalle: l.note || null,
    auto: false,
    session: true,
  }));
  const fullTimeline = [...sessionAsEvents, ...inst.historial];

  return (
    <aside className="ficha">
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--rule-2)', position: 'relative' }}>
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm press"
            title="Cerrar ficha (vuelve al resumen)"
            style={{ position: 'absolute', top: 14, right: 14, padding: 4, lineHeight: 0 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ink-3)' }}>close</span>
          </button>
        )}
        <div className="eyebrow" style={{ marginBottom: 8, paddingRight: 28 }}>
          {inst.tipo}
          {inst.localidad && <span style={{ marginLeft: 8, color: 'var(--ink-4)', fontWeight: 500 }}>· {inst.localidad}</span>}
        </div>
        <h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2, paddingRight: 28 }}>
          {inst.nombre}
        </h2>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {inst.contactTipo && <TipoBadge tipo={inst.contactTipo} />}
          {inst.vinculada === false && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: 'transparent', color: 'var(--ink-3)', border: '1px dashed var(--rule-3)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>link_off</span>
              Sin vincular
            </span>
          )}
          {inst.orientaciones && inst.orientaciones.map(o => (
            <span key={o} className="chip-orient" data-orient={orientSlug(o)}>{o}</span>
          ))}
        </div>
      </div>

      {/* Hermes note — only when there's an actionable insight */}
      {inst.hermesNote && (
        <div style={{ margin: '16px 24px 0', padding: 14, borderRadius: 10, background: 'var(--ai-soft)', border: '1px solid #5A2D8633' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ai)' }}>auto_awesome</span>
            <span className="label" style={{ color: 'var(--ai)' }}>Hermes sugiere</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{inst.hermesNote}</div>
        </div>
      )}

      {/* Missing data flags */}
      {flags.length > 0 && (
        <div style={{ margin: '16px 24px 0', padding: 12, borderRadius: 10, border: '1px dashed #B4501E55', background: 'var(--warn-soft)' }}>
          <div className="label" style={{ marginBottom: 8, color: 'var(--warn)' }}>Falta dato clave</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {flags.map(f => (
              <span key={f.k} className="flag-missing">
                <span className="material-symbols-outlined">{f.icon}</span>
                {f.label}
              </span>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm press" style={{ marginTop: 10, color: 'var(--warn)', padding: 0 }} onClick={() => onEdit?.(inst.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Cargar datos faltantes
          </button>
        </div>
      )}

      {/* Contactos */}
      <div style={{ padding: '20px 24px 12px' }}>
        <span className="label">Contactos</span>
        <div style={{ marginTop: 8 }}>
          {inst.referente
            ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{inst.referente}</div>
                <div className="meta">{inst.referenteRol}</div>
              </div>
            )
            : <div className="meta" style={{ marginBottom: 10, color: 'var(--warn)' }}>Sin referente cargado</div>}

          {inst.telefono && (
            <ContactLine icon="phone" value={inst.telefono} onCopy={() => navigator.clipboard?.writeText(inst.telefono)} />
          )}
          {inst.mail && (
            <ContactLine icon="mail" value={inst.mail} onCopy={() => navigator.clipboard?.writeText(inst.mail)} />
          )}
          {inst.convenio && (
            <ContactLine icon="description" value={inst.convenio} mono={false} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {inst.telefono && (
            <button className="btn btn-sm btn-wa press" onClick={() => onContact?.({ institucion: inst.id }, 'whatsapp')}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chat</span>
              WhatsApp
            </button>
          )}
          {inst.mail && (
            <button className="btn btn-sm btn-mail press" onClick={() => onContact?.({ institucion: inst.id }, 'mail')}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
              Mail
            </button>
          )}
        </div>
      </div>

      {/* Acciones de estado */}
      <div style={{ padding: '16px 24px 12px', borderTop: '1px solid var(--rule-2)' }}>
        <span className="label">Cambiar estado</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {['esperandoRespuesta', 'pendienteDecision', 'confirmada', 'archivada'].map(s => (
            <button key={s} className="chip-status press" data-state={s} style={{ cursor: 'pointer', border: '1px solid currentColor' }} onClick={() => onChangeState?.(inst.id, s)}>
              {GESTION_STATES[s].label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm press" style={{ marginTop: 10, padding: '6px 0' }} onClick={() => onCreateReminder?.(inst.id)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>alarm_add</span>
          Crear recordatorio
        </button>
      </div>

      {/* Conversación — timeline unificado WhatsApp + mail */}
      <div style={{ padding: '20px 24px 12px', borderTop: '1px solid var(--rule-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="label">Conversación · WhatsApp + mail</span>
          {inst.waContacto && (
            <span className="meta" style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#2F8F43' }}>chat</span>
              {inst.waContacto}
            </span>
          )}
        </div>
        {inst.conversacion
          ? <ChatTimeline conversacion={inst.conversacion} sessionLog={sessionLog} onReply={(canal) => onContact?.({ institucion: inst.id, state: inst.currentState }, canal)} />
          : (
            <div style={{ marginTop: 12 }}>
              {fullTimeline.map((ev, i) => (
                <TimelineRow key={i} ev={ev} isLast={i === fullTimeline.length - 1} />
              ))}
            </div>
          )}
      </div>

      {/* Estudiantes vinculados */}
      {inst.estudiantes && inst.estudiantes.length > 0 && (
        <div style={{ padding: '16px 24px 12px', borderTop: '1px solid var(--rule-2)' }}>
          <span className="label">Estudiantes vinculados · {inst.estudiantes.length}</span>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inst.estudiantes.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--paper-2)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                  {s.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
                  <div className="meta" style={{ fontSize: 11 }}>{s.year} · {s.horario}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PPS history */}
      <div style={{ padding: '16px 24px 28px', borderTop: '1px solid var(--rule-2)' }}>
        <span className="label">PPS por cohorte</span>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {inst.ppsHistory.map((pps, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: i === inst.ppsHistory.length - 1 ? 'none' : '1px solid var(--rule-2)' }}>
              <div style={{ minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pps.cohort}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2, color: 'var(--ink-2)' }}>{pps.estado}</div>
                <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
                  {pps.orient} · cupos {pps.cupos}{pps.acreditados !== null && pps.acreditados !== undefined ? ` · ${pps.acreditados} acreditados` : ''}
                </div>
              </div>
              <div className="meta mono" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{pps.fin}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notas */}
      {inst.notas && (
        <div style={{ padding: '16px 24px 32px', borderTop: '1px solid var(--rule-2)' }}>
          <span className="label">Notas</span>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, fontStyle: 'italic' }}>
            "{inst.notas}"
          </div>
        </div>
      )}
    </aside>
  );
}

function ContactLine({ icon, value, onCopy, mono = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', color: 'var(--ink-2)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ink-4)' }}>{icon}</span>
      <span className={mono ? 'mono' : ''} style={{ flex: 1, fontSize: mono ? 12 : 13 }}>{value}</span>
      {onCopy && (
        <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} title="Copiar" onClick={onCopy}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--ink-3)' }}>content_copy</span>
        </button>
      )}
    </div>
  );
}

// ─── Contact typology badge ──────────────────────────────────────────
function TipoBadge({ tipo, size = 'md' }) {
  const meta = (typeof CONTACT_TIPOS !== 'undefined') && CONTACT_TIPOS[tipo];
  if (!meta) return null;
  const sm = size === 'sm';
  return (
    <span
      title={meta.hint}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 5,
        padding: sm ? '2px 7px 2px 6px' : '3px 9px 3px 7px',
        borderRadius: 999, fontSize: sm ? 10.5 : 11, fontWeight: 600,
        background: meta.soft, color: meta.color, whiteSpace: 'nowrap',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: sm ? 12 : 13 }}>{meta.icon}</span>
      {sm ? meta.short : meta.label}
    </span>
  );
}

// ─── Unified conversation timeline (WhatsApp + mail bubbles) ─────────
function ChatTimeline({ conversacion, sessionLog = [], onReply }) {
  // Session-sent messages become from_me bubbles, newest of the day
  const sessionMsgs = sessionLog
    .filter(l => l.action === 'sent')
    .map((l, i) => ({
      kind: 'msg',
      canal: l.channel === 'mail' ? 'mail' : 'whatsapp',
      from_me: true,
      iso: '2026-05-26T' + (l.hora || `12:${String(10 + i).padStart(2, '0')}`),
      fecha: l.fecha || 'hoy', hora: l.hora || '',
      texto: l.note || (l.channel === 'mail' ? 'Mail enviado desde el panel' : 'WhatsApp enviado desde el panel'),
      session: true,
    }));

  const items = [...conversacion, ...sessionMsgs].sort((a, b) => (a.iso || '').localeCompare(b.iso || ''));
  const msgs = items.filter(x => x.kind === 'msg');
  const lastMsg = msgs[msgs.length - 1];

  // Conversation status
  let status = null;
  if (lastMsg) {
    if (lastMsg.from_me) {
      status = { mode: 'esperando', dias: lastMsg.diasEsperando, label: 'Esperando respuesta', canal: lastMsg.canal };
    } else {
      status = { mode: 'responder', label: 'Te toca responder', canal: lastMsg.canal };
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {status && <ConvStatusBanner status={status} onReply={onReply} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: status ? 12 : 0 }}>
        {items.map((it, i) =>
          it.kind === 'system'
            ? <SystemDivider key={i} ev={it} />
            : <ChatBubble key={i} msg={it} />
        )}
      </div>
    </div>
  );
}

function ConvStatusBanner({ status, onReply }) {
  const waiting = status.mode === 'esperando';
  const color = waiting ? 'var(--accent)' : 'var(--warn)';
  const soft = waiting ? 'var(--accent-soft)' : 'var(--warn-soft)';
  const overdue = waiting && status.dias && status.dias > 5;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 10,
      background: soft, border: `1px solid ${overdue ? color : 'transparent'}`,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>
        {waiting ? 'schedule_send' : 'reply'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
          {status.label}
          {waiting && status.dias != null && (
            <span style={{ color, fontWeight: 700 }}> · hace {status.dias} {status.dias === 1 ? 'día' : 'días'}</span>
          )}
        </div>
        <div className="meta" style={{ fontSize: 10.5 }}>
          {waiting
            ? (overdue ? 'Pasó tu ventana habitual · conviene reinsistir' : 'Último mensaje tuyo · monitoreando')
            : `Te escribieron por ${status.canal === 'mail' ? 'mail' : 'WhatsApp'} · sin responder`}
        </div>
      </div>
      {onReply && (
        <button
          className={status.canal === 'mail' ? 'btn btn-sm btn-mail press' : 'btn btn-sm btn-wa press'}
          onClick={() => onReply(status.canal)}
          style={{ flexShrink: 0 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{status.canal === 'mail' ? 'mail' : 'chat'}</span>
          {waiting ? 'Reinsistir' : 'Responder'}
        </button>
      )}
    </div>
  );
}

function SystemDivider({ ev }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--rule-2)' }}></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-4)', flexShrink: 0, maxWidth: '78%' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>flag</span>
        <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.titulo}
        </span>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-4)', flexShrink: 0 }}>{ev.fecha}</span>
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--rule-2)' }}></div>
    </div>
  );
}

function ChatBubble({ msg }) {
  const me = msg.from_me;
  const isMail = msg.canal === 'mail';
  const waBg = 'color-mix(in srgb, var(--ok) 15%, var(--paper))';
  const bubbleBg = me
    ? (isMail ? 'var(--accent-soft)' : waBg)
    : 'var(--paper-2)';
  const channelColor = isMail ? 'var(--accent)' : '#2F8F43';
  return (
    <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '82%', minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3,
          justifyContent: me ? 'flex-end' : 'flex-start',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 11, color: channelColor }}>
            {isMail ? 'mail' : 'chat'}
          </span>
          <span className="meta" style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>
            {me ? 'Vos' : ''}{me ? ' · ' : ''}{msg.fecha} · {msg.hora}
          </span>
          {msg.session && (
            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 4, background: 'var(--ok-soft)', color: 'var(--ok)' }}>
              este turno
            </span>
          )}
        </div>
        <div style={{
          padding: isMail ? '9px 12px' : '8px 11px',
          borderRadius: 12,
          borderTopRightRadius: me ? 3 : 12,
          borderTopLeftRadius: me ? 12 : 3,
          background: bubbleBg,
          border: isMail ? `1px solid ${me ? 'transparent' : 'var(--rule-2)'}` : 'none',
          fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink)',
          textAlign: 'left',
        }}>
          {isMail && msg.asunto && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid var(--rule-2)' }}>
              {msg.asunto}
            </div>
          )}
          {msg.texto}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ ev, isLast }) {
  const iconFor = { mail: 'mail', whatsapp: 'chat', state: 'flag', note: 'edit_note', call: 'phone' };
  const colorFor = { mail: 'var(--accent)', whatsapp: '#2F8F43', state: 'var(--ink-3)', note: 'var(--ink-3)', call: 'var(--ok)' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 10, position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 20, height: 20, borderRadius: 999,
          background: 'var(--paper-2)', color: colorFor[ev.tipo] || 'var(--ink-3)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, zIndex: 1,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{iconFor[ev.tipo] || 'circle'}</span>
        </div>
        {!isLast && (
          <div style={{ position: 'absolute', top: 22, bottom: -12, width: 1, background: 'var(--rule-2)' }}></div>
        )}
      </div>
      <div style={{ paddingBottom: 14, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)' }}>{ev.titulo}</span>
          {ev.auto && <span className="meta" style={{ fontSize: 10, fontStyle: 'italic' }}>auto</span>}
          {ev.session && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              padding: '2px 6px', borderRadius: 4,
              background: 'var(--ok-soft)', color: 'var(--ok)',
            }}>
              este turno
            </span>
          )}
        </div>
        {ev.detalle && (
          <div className="meta" style={{ fontSize: 11.5, marginTop: 2 }}>{ev.detalle}</div>
        )}
        <div className="meta mono" style={{ fontSize: 10, marginTop: 3, color: 'var(--ink-4)' }}>{ev.fecha} · {ev.hora}</div>
      </div>
    </div>
  );
}

// ─── CONTACT MODAL ───────────────────────────────────────────────────
function ContactModal({ item, channel, onClose, onSent }) {
  if (!item) return null;
  const inst = INST_BY_ID[item.institucion];
  const state = item.state;

  const wa = TEMPLATES.whatsapp[state] || TEMPLATES.whatsapp.contactar;
  const mailTpl = TEMPLATES.mail[state === 'pendienteDecision' ? 'pendienteDec' : state] || TEMPLATES.mail.contactar;

  const subject0 = (mailTpl.subject || '').replace('{{institucion}}', inst.nombre);
  const body0 = channel === 'whatsapp'
    ? wa
        .replace('{{referente}}', (inst.referente || '').split(' ').pop() || 'equipo')
        .replace('{{dias}}', Math.abs(item.daysAgo || 0))
    : `Estimado/a ${inst.referente || 'equipo'},\n\n${(mailTpl.body || '').replace('{{referente}}', inst.referente || 'equipo').replace('{{ultimo_contacto}}', 'la semana pasada')}\n\nSaludos cordiales,\nLuis Battaglia\nCoord. PPS · UFLO Psicología`;

  const [subject, setSubject] = useStateG(subject0);
  const [body, setBody] = useStateG(body0);
  const [showConfirm, setShowConfirm] = useStateG(false);
  const [showRewrite, setShowRewrite] = useStateG(false);

  const handleSend = () => {
    setShowConfirm(true);
  };

  const handleConfirm = (markAsWaiting) => {
    onSent?.(item, channel, markAsWaiting);
    onClose();
  };

  if (showRewrite) {
    return (
      <HermesRewrite
        originalText={body}
        onApply={(newBody) => { setBody(newBody); setShowRewrite(false); }}
        onClose={() => setShowRewrite(false)}
      />
    );
  }

  if (showConfirm) {
    return (
      <div className="modal-bg" onClick={onClose}>
        <div className="modal-card" style={{ padding: 32, maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ok)' }}>check_circle</span>
            <span className="label" style={{ color: 'var(--ok)' }}>Mensaje preparado</span>
          </div>
          <h3 className="serif" style={{ margin: '4px 0 8px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            ¿Marcar como <em>Esperando respuesta</em>?
          </h3>
          <p className="meta" style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            El estado actual es <strong>{GESTION_STATES[item.state].label}</strong>. Si ya enviaste el mensaje a {inst.nombre}, podemos pasar a "Esperando respuesta" para no perder el seguimiento.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
            <button className="btn press" onClick={() => handleConfirm(false)}>No, dejar igual</button>
            <button className="btn btn-primary press" onClick={() => handleConfirm(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
              Sí, marcar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule-2)' }}>
          <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{channel === 'whatsapp' ? 'chat' : 'mail'}</span>
            {channel === 'whatsapp' ? 'WhatsApp · preview editable' : 'Mail · preview editable'}
          </div>
          <h3 className="serif" style={{ margin: '6px 0 4px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Mensaje a {inst.nombre}
          </h3>
          <div className="meta">
            Plantilla: <strong>{state}</strong>
            {' · '}
            {channel === 'whatsapp' ? `Tel: ${inst.telefono}` : `Para: ${inst.mail}`}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {channel === 'mail' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <span className="label">Destinatario</span>
                <div className="field" style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-2)', background: 'var(--paper-2)' }}>
                  {inst.referente && <span style={{ fontWeight: 500 }}>{inst.referente}</span>}
                  {inst.mail && <span className="mono" style={{ marginLeft: 8, color: 'var(--ink-3)', fontSize: 12 }}>&lt;{inst.mail}&gt;</span>}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <span className="label">Asunto</span>
                <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginTop: 6 }} />
              </div>
            </>
          )}
          {channel === 'whatsapp' && (
            <div style={{ marginBottom: 14 }}>
              <span className="label">Teléfono</span>
              <div className="field" style={{ marginTop: 6, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', background: 'var(--paper-2)' }}>
                {inst.telefono}
              </div>
            </div>
          )}
          <div>
            <span className="label">Mensaje</span>
            <textarea
              className="field"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ marginTop: 6, minHeight: 160, fontSize: 13.5, lineHeight: 1.5 }}
            />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm press" onClick={() => setShowRewrite(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ai)' }}>auto_awesome</span>
            Pedir reescritura a Hermes
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary press" onClick={handleSend}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {channel === 'whatsapp' ? 'open_in_new' : 'send'}
              </span>
              {channel === 'whatsapp' ? 'Abrir WhatsApp' : 'Enviar mail'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONFIRM STATE CHANGE ────────────────────────────────────────────
function ConfirmStateChange({ inst, newState, currentState, onConfirm, onCancel }) {
  if (!inst) return null;
  const [note, setNote] = useStateG('');
  const newLabel = GESTION_STATES[newState]?.label || newState;
  const curLabel = currentState ? GESTION_STATES[currentState]?.label : '—';

  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal-card" style={{ maxWidth: 460, padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Registrar cambio de estado</div>
        <h3 className="serif" style={{ margin: '4px 0 8px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {inst.nombre}
        </h3>

        {/* Transition pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0 18px', flexWrap: 'wrap' }}>
          <span className="chip-status" data-state={currentState || 'indefinida'} style={{ opacity: 0.6 }}>
            {curLabel}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ink-4)' }}>arrow_forward</span>
          <span className="chip-status" data-state={newState}>{newLabel}</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span className="label">Nota breve · opcional</span>
          <textarea
            className="field"
            placeholder="Ej: hablé con María por teléfono, confirma para julio"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ marginTop: 6, minHeight: 70, fontSize: 13.5 }}
          />
        </div>

        <div className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '8px 0' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>history</span>
          Se va a registrar en el historial con fecha · hora · estado anterior.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn press" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary press" onClick={() => onConfirm(note)}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
            Registrar cambio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HERMES REWRITE MODAL ────────────────────────────────────────────
function HermesRewrite({ originalText, onApply, onClose }) {
  const STYLES = [
    { id: 'formal',     label: 'Más formal',     icon: 'workspace_premium', hint: 'Tono institucional, vocabulario cuidado' },
    { id: 'breve',      label: 'Más breve',      icon: 'compress',          hint: 'Mismo mensaje, mitad de palabras' },
    { id: 'calido',     label: 'Más cálido',     icon: 'favorite',          hint: 'Empático, personal, agradeciendo' },
    { id: 'reinsistir', label: 'Reinsistencia',  icon: 'replay',            hint: 'Recordatorio cortés sin insistir feo' },
  ];
  const [picked, setPicked] = useStateG(null);
  const [working, setWorking] = useStateG(false);
  const [result, setResult] = useStateG('');

  const ask = (styleId) => {
    setPicked(styleId);
    setWorking(true);
    setResult('');
    setTimeout(() => {
      // Mocked rewrites — would call Claude in production
      const rewrites = {
        formal: 'Estimado/a equipo,\n\nLes escribo en relación a la continuidad del convenio para la Práctica Profesional Supervisada del año en curso. Agradeceríamos confirmen disponibilidad para coordinar los próximos pasos.\n\nQuedo a disposición para cualquier consulta.\n\nCordialmente,\nLuis Battaglia\nCoord. PPS · UFLO Psicología',
        breve:  '¡Hola! Te recuerdo el mail de la semana pasada sobre continuidad PPS 2026. Cualquier respuesta nos sirve, incluso si me decís que no este año. Gracias.',
        calido: '¡Hola! Espero que estés bien. Solo te paso un recordatorio cariñoso del mail de la semana pasada — ya sé que estás a mil, pero cualquier respuesta nos ayuda a planificar. Gracias por el tiempo siempre.',
        reinsistir: 'Hola, ¿cómo estás? Te paso un recordatorio del mail del lunes pasado sobre la continuidad de la PPS para 2026. Si necesitás más tiempo o info para responder, decime y te lo mando. Saludos.',
      };
      setResult(rewrites[styleId] || originalText);
      setWorking(false);
    }, 900);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule-2)' }}>
          <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ai)' }}>auto_awesome</span>
            Hermes · reescritura
          </div>
          <h3 className="serif" style={{ margin: '6px 0 4px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Probá un tono distinto
          </h3>
          <div className="meta">Elegí un estilo. El resultado es editable antes de aplicarlo.</div>
        </div>

        <div style={{ padding: 20, borderBottom: '1px solid var(--rule-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {STYLES.map(s => {
              const active = picked === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => ask(s.id)}
                  disabled={working}
                  className="press"
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${active ? 'var(--ai)' : 'var(--rule-2)'}`,
                    background: active ? 'var(--ai-soft)' : 'var(--paper)',
                    color: active ? 'var(--ai)' : 'var(--ink-2)',
                    cursor: working ? 'progress' : 'pointer', fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{s.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                  </div>
                  <div className="meta" style={{ fontSize: 11, color: active ? 'var(--ai)' : 'var(--ink-3)', opacity: 0.8 }}>
                    {s.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {!picked && (
            <div style={{
              padding: 28, borderRadius: 10, border: '1px dashed var(--rule-2)',
              textAlign: 'center', color: 'var(--ink-4)', fontSize: 13,
            }}>
              Elegí un estilo arriba para ver una propuesta.
            </div>
          )}
          {picked && working && (
            <div style={{
              padding: 28, borderRadius: 10,
              background: 'linear-gradient(90deg, var(--ai-soft) 0%, var(--paper-2) 50%, var(--ai-soft) 100%)',
              backgroundSize: '400px 100%',
              animation: 'shimmer 1.6s infinite linear',
              textAlign: 'center', color: 'var(--ai)', fontSize: 13, fontWeight: 500,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 6, verticalAlign: 'middle' }}>auto_awesome</span>
              Hermes está reescribiendo…
            </div>
          )}
          {picked && !working && result && (
            <>
              <span className="label" style={{ display: 'block', marginBottom: 6 }}>Propuesta · editable</span>
              <textarea
                className="field"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                style={{ minHeight: 180, fontSize: 13.5, lineHeight: 1.5 }}
              />
            </>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary press"
            disabled={!result}
            onClick={() => onApply(result)}
            style={{ opacity: result ? 1 : 0.5 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
            Aplicar al mensaje
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UNLINKED CONTACTS VIEW — los chats PPS que no son institución aún ─
function UnlinkedContactsView({ contacts, onAddToCatalog, onReply }) {
  const a = (typeof HERMES_ALLOWLIST !== 'undefined') ? HERMES_ALLOWLIST : null;
  // Group: candidates to add (sin_convenio) first, then authorities, then rest
  const orderRank = { sin_convenio: 0, coordinador_externo: 1, autoridad_uflo: 2 };
  const sorted = [...contacts].sort((x, y) => (orderRank[x.contactTipo] ?? 9) - (orderRank[y.contactTipo] ?? 9));

  return (
    <>
      <header style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--rule-2)' }}>
        <span className="eyebrow">Conversaciones · sin vincular</span>
        <h2 className="serif" style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {contacts.length} chats que no son institución
        </h2>
        <div className="meta" style={{ marginTop: 6, maxWidth: 560, lineHeight: 1.5 }}>
          Hermes los lee de tu lista <strong>“{a?.listaNombre || 'PPS'}”</strong> pero todavía no están en el catálogo.
          Decidí cuáles convertir en institución y cuáles dejar afuera. Nada personal se procesa.
        </div>
      </header>

      <div style={{ padding: '16px 32px 64px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(c => (
          <UnlinkedContactCard key={c.id} c={c} onAddToCatalog={onAddToCatalog} onReply={onReply} />
        ))}
      </div>
    </>
  );
}

function UnlinkedContactCard({ c, onAddToCatalog, onReply }) {
  const meta = (typeof CONTACT_TIPOS !== 'undefined') && CONTACT_TIPOS[c.contactTipo];
  const isCandidate = c.contactTipo === 'sin_convenio';
  const m = c.ultimo;
  const needsReply = m && !m.from_me && m.estado === 'responder';
  return (
    <div style={{
      border: '1px solid var(--rule-2)', borderRadius: 12, padding: 16,
      background: 'var(--paper)',
      display: 'grid', gridTemplateColumns: '1fr', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: meta ? meta.soft : 'var(--paper-2)', color: meta ? meta.color : 'var(--ink-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{meta ? meta.icon : 'person'}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{c.nombre}</div>
            <div className="meta" style={{ fontSize: 11.5 }}>{c.rol}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {needsReply && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              sin responder
            </span>
          )}
          <TipoBadge tipo={c.contactTipo} size="sm" />
        </div>
      </div>

      {/* Last message preview */}
      {m && (
        <div style={{
          display: 'flex', gap: 8, padding: '9px 11px', borderRadius: 10,
          background: 'var(--paper-2)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#2F8F43', flexShrink: 0, marginTop: 1 }}>chat</span>
          <div style={{ minWidth: 0 }}>
            <span style={{ color: 'var(--ink-4)', fontWeight: 600 }}>{m.from_me ? 'Vos: ' : ''}</span>
            {m.texto}
            <span className="mono meta" style={{ fontSize: 10, marginLeft: 6, color: 'var(--ink-4)' }}>{m.fecha} · {m.hora}</span>
          </div>
        </div>
      )}

      {/* Hermes hint */}
      {c.hermesHint && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ai)', marginTop: 1, flexShrink: 0 }}>auto_awesome</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>{c.hermesHint}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--rule-2)', paddingTop: 12 }}>
        <button className="btn btn-sm btn-wa press" onClick={() => onReply?.(c)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chat</span>
          {needsReply ? 'Responder' : 'Abrir chat'}
        </button>
        {isCandidate ? (
          <button className="btn btn-sm btn-primary press" onClick={() => onAddToCatalog?.(c)}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_link</span>
            Agregar al catálogo
          </button>
        ) : (
          <button className="btn btn-sm press" title="No es institución de práctica" disabled style={{ opacity: 0.5, cursor: 'default' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>block</span>
            No es institución
          </button>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Rail, Bandeja, BandejaCard, Ficha, FichaResumen, ContactModal, ConfirmStateChange, HermesRewrite, TipoBadge, UnlinkedContactsView });
