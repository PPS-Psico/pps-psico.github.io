/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor,
   TopBar, Rail, Bandeja, Ficha, ContactModal, ConfirmStateChange,
   EditInstitucionModal, ReminderForm, InstitucionesView, ViewModeTabs,
   CalendarView, CALENDAR_EVENTS, UnlinkedContactsView, HermesBandeja,
   CATEGORIES, INSTITUCIONES, INST_BY_ID, ITEMS, GESTION_STATES, missingFlagsFor,
   CONTACT_TIPOS, HERMES_ALLOWLIST, UNLINKED_CONTACTS, HERMES_SUGGESTIONS */
const { useState, useEffect, useMemo } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentLight": "#1F3A8A",
  "theme": "light",
  "demoCategory": "hoy"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = ['#1F3A8A', '#1E4D3A', '#9C3D14', '#3A3A3A'];
const ACCENT_DARK = {
  '#1F3A8A': '#8FB1FF', '#1E4D3A': '#8FC7A5',
  '#9C3D14': '#E69A6B', '#3A3A3A': '#C4C4C4',
};

// Format current time as HH:MM
function nowStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// History log entry helper
function logEntry({ instId, action, channel, prevState, nextState, note }) {
  return {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    instId,
    action,                 // 'sent' | 'state' | 'reminder' | 'note'
    channel,                // 'mail' | 'whatsapp' | null
    prevState, nextState,
    note,
    fecha: new Date().toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', ''),
    hora: nowStr(),
  };
}

// Filter items by category
// Conversation status helper: if the newest message is mine (from_me) and the
// other side hasn't replied, returns days waiting. Otherwise null.
function convWaitDays(inst) {
  if (!inst || !inst.conversacion) return null;
  const msgs = inst.conversacion.filter(x => x.kind === 'msg').sort((a, b) => (a.iso || '').localeCompare(b.iso || ''));
  const last = msgs[msgs.length - 1];
  if (!last || !last.from_me) return null;
  return last.diasEsperando ?? 0;
}

function filterItems(items, cat, query) {
  let result = items;
  if (cat === 'hoy') {
    // Pile ordering: porContactar/reinsistir first, then porFinalizar, then pendienteDecision,
    // then everything else by daysAgo. faltaDato is a flag, not a filter.
    const order = {
      reinsistir: 0,
      porContactar: 1,
      porFinalizar: 2,
      pendienteDecision: 3,
      esperandoRespuesta: 4,
      activa: 5,
      indefinida: 6,
      confirmada: 7,
      archivada: 8,
    };
    result = [...items].sort((a, b) => {
      const oa = order[a.state] ?? 99;
      const ob = order[b.state] ?? 99;
      if (oa !== ob) return oa - ob;
      // tie-breaker: more days ago = higher urgency
      const da = Math.abs(a.daysAgo || 0);
      const db = Math.abs(b.daysAgo || 0);
      return db - da;
    });
  } else if (cat === 'faltaDato') {
    result = items.filter(item => {
      const inst = INST_BY_ID[item.institucion];
      return missingFlagsFor(inst).length > 0;
    });
  } else if (cat === 'esperando5d') {
    result = items
      .filter(item => {
        const d = convWaitDays(INST_BY_ID[item.institucion]);
        return d != null && d > 5;
      })
      .sort((a, b) => (convWaitDays(INST_BY_ID[b.institucion]) || 0) - (convWaitDays(INST_BY_ID[a.institucion]) || 0));
  } else if (cat === 'requiereDecision') {
    result = items.filter(item => INST_BY_ID[item.institucion]?.requiereDecision === true);
  } else if (cat === 'sinVincular') {
    // Handled by a dedicated view (UNLINKED_CONTACTS) — no bandeja items here.
    result = [];
  } else {
    result = items.filter(item => item.state === cat);
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(item => {
      const inst = INST_BY_ID[item.institucion];
      return (
        (inst.nombre || '').toLowerCase().includes(q) ||
        (inst.referente || '').toLowerCase().includes(q) ||
        (inst.localidad || '').toLowerCase().includes(q) ||
        (item.titulo || '').toLowerCase().includes(q)
      );
    });
  }

  return result;
}

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);
  const [activeCat, setActiveCat] = useState(() => {
    try {
      const dl = localStorage.getItem('gestion-deeplink-cat');
      if (dl) { localStorage.removeItem('gestion-deeplink-cat'); return dl; }
    } catch {}
    return t.demoCategory || 'hoy';
  });
  const [selectedItemId, setSelectedItemId] = useState('i01');
  const [selectedInstId, setSelectedInstId] = useState('manantiales');
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('gestion-view-mode') || 'bandeja'; } catch { return 'bandeja'; }
  });
  useEffect(() => {
    try { localStorage.setItem('gestion-view-mode', viewMode); } catch {}
  }, [viewMode]);
  const [query, setQuery] = useState('');
  const [contactCtx, setContactCtx] = useState(null);
  const [pendingStateChange, setPendingStateChange] = useState(null);
  const [editingInstId, setEditingInstId] = useState(null);
  const [reminderInstId, setReminderInstId] = useState(null);
  const [toast, setToast] = useState(null);
  const [institutionOverrides, setInstitutionOverrides] = useState({}); // { instId: patchObj }
  const [reminders, setReminders] = useState([]); // [{ id, instId, type, days, dueLabel, note, linkedPps, createdAt }]
  // Hermes suggestion queue
  const [suggestions, setSuggestions] = useState(() => (typeof HERMES_SUGGESTIONS !== 'undefined' ? HERMES_SUGGESTIONS : []));
  const [justActed, setJustActed] = useState({}); // { suggestionId: 'approved'|'discarded'|'confirmed' } — transient acted overlay
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try { return localStorage.getItem('gestion-rail-collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('gestion-rail-collapsed', railCollapsed ? '1' : '0'); } catch {}
  }, [railCollapsed]);

  // Apply institution overrides to get the "effective" view of any inst
  const effectiveInst = (id) => {
    const base = INST_BY_ID[id];
    if (!base) return null;
    const patch = institutionOverrides[id];
    return patch ? { ...base, ...patch } : base;
  };

  // Session-persisted state changes per item (id → new state)
  // History log — newest first
  const [stateOverrides, setStateOverrides] = useState({});  // { itemId: newState }
  const [actionLog, setActionLog] = useState([]);

  // Item state with overrides applied
  const itemsWithState = useMemo(
    () => ITEMS.map(it => stateOverrides[it.id]
      ? { ...it, state: stateOverrides[it.id] }
      : it),
    [stateOverrides]
  );

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', t.theme === 'dark');
  }, [t.theme]);
  useEffect(() => {
    const c = t.theme === 'dark' ? ACCENT_DARK[t.accentLight] : t.accentLight;
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-soft', c + (t.theme === 'dark' ? '1A' : '14'));
  }, [t.accentLight, t.theme]);

  // Sync category from tweaks
  useEffect(() => {
    if (t.demoCategory && t.demoCategory !== activeCat) {
      setActiveCat(t.demoCategory);
    }
  }, [t.demoCategory]);

  // Counts per category for the rail
  const counts = useMemo(() => {
    const c = {};
    c.hoy = itemsWithState.filter(it => ['porContactar', 'reinsistir', 'porFinalizar', 'pendienteDecision'].includes(it.state)).length;
    CATEGORIES.filter(cat => cat.id !== 'hoy').forEach(cat => {
      if (cat.id === 'faltaDato') {
        c.faltaDato = itemsWithState.filter(it => missingFlagsFor(INST_BY_ID[it.institucion]).length > 0).length;
      } else if (cat.id === 'esperando5d') {
        c.esperando5d = itemsWithState.filter(it => { const d = convWaitDays(INST_BY_ID[it.institucion]); return d != null && d > 5; }).length;
      } else if (cat.id === 'requiereDecision') {
        c.requiereDecision = itemsWithState.filter(it => INST_BY_ID[it.institucion]?.requiereDecision === true).length;
      } else if (cat.id === 'sinVincular') {
        c.sinVincular = (typeof UNLINKED_CONTACTS !== 'undefined') ? UNLINKED_CONTACTS.length : 0;
      } else {
        c[cat.id] = itemsWithState.filter(it => it.state === cat.id).length;
      }
    });
    return c;
  }, [itemsWithState]);

  const visibleItems = useMemo(() => filterItems(itemsWithState, activeCat, query), [activeCat, query, itemsWithState]);

  // Enriched institutions for the CRM view — adds currentState, lastActivity, nextAction
  const enrichedInstitutions = useMemo(() => {
    return INSTITUCIONES.map(inst => {
      const patched = institutionOverrides[inst.id] ? { ...inst, ...institutionOverrides[inst.id] } : inst;
      const item = itemsWithState.find(it => it.institucion === inst.id);
      const log = actionLog.filter(l => l.instId === inst.id)[0]; // newest first
      const lastHistorial = inst.historial?.[0];

      let lastActivity = null;
      let lastActivityKey = '';
      if (log) {
        lastActivity = `${log.action === 'sent' ? (log.channel === 'whatsapp' ? 'WhatsApp enviado' : 'Mail enviado') : log.action === 'state' ? `→ ${GESTION_STATES[log.nextState]?.label}` : log.action === 'edit' ? 'Datos actualizados' : 'Recordatorio creado'} · ${log.fecha}`;
        lastActivityKey = '9' + log.fecha;
      } else if (lastHistorial) {
        lastActivity = `${lastHistorial.titulo.slice(0, 40)}${lastHistorial.titulo.length > 40 ? '…' : ''} · ${lastHistorial.fecha}`;
        lastActivityKey = lastHistorial.fecha;
      }

      let nextAction = item?.nextStep || null;
      let nextActionKey = item ? String(Math.abs(item.daysAgo || 0)).padStart(5, '0') : 'z';

      return {
        ...patched,
        currentState: item?.state || null,
        _lastActivity: lastActivity,
        _lastActivityKey: lastActivityKey,
        _nextAction: nextAction,
        _nextActionKey: nextActionKey,
      };
    });
  }, [itemsWithState, actionLog, institutionOverrides]);

  // Merge static calendar events with reminders created in session
  const calendarEvents = useMemo(() => {
    const sessionEvents = reminders.map(r => {
      const d = new Date();
      d.setDate(d.getDate() + (r.days || 0));
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        id: 'cal-' + r.id,
        date: iso,
        tipo: 'recordatorio',
        instId: r.instId,
        titulo: `${r.type === 'contactar' ? 'Contactar' : r.type === 'seguimiento' ? 'Seguimiento' : r.type === 'vencimiento' ? 'Cierre' : 'Acreditación'} · ${INST_BY_ID[r.instId]?.nombre || ''}`,
        detalle: r.note || 'Recordatorio creado en sesión',
        _session: true,
      };
    });
    return [...CALENDAR_EVENTS, ...sessionEvents];
  }, [reminders]);

  // Selected institution comes from selectedInstId directly
  const selectedInst = selectedInstId ? effectiveInst(selectedInstId) : null;
  const selectedLog = useMemo(
    () => selectedInstId ? actionLog.filter(l => l.instId === selectedInstId) : [],
    [selectedInstId, actionLog]
  );

  // Resumen payload for the right pane when nothing is selected
  const resumenData = useMemo(() => {
    const TODAY_ISO = '2026-05-26';
    const endWeek = (() => {
      const d = new Date(TODAY_ISO + 'T00:00:00'); d.setDate(d.getDate() + 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const todayEvents = calendarEvents.filter(ev => ev.date === TODAY_ISO);
    const upcomingRaw = calendarEvents
      .filter(ev => ev.date > TODAY_ISO && ev.date <= endWeek)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(ev => {
        const d = new Date(ev.date + 'T00:00:00');
        const tdy = new Date(TODAY_ISO + 'T00:00:00');
        const diff = Math.round((d - tdy) / 86400000);
        return { ...ev, _date: ev.date, _relLabel: diff === 1 ? 'mañana' : `en ${diff} d` };
      });
    return {
      todayEvents,
      upcomingEvents: upcomingRaw,
      counts,
      totalInstituciones: INSTITUCIONES.length,
      recentLog: actionLog,
      onSelectInst: handleSelectInst,
      onGoToCategory: (catId) => { setViewMode('bandeja'); handleSelectCat(catId); },
      onGoToCalendar: () => setViewMode('calendario'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarEvents, counts, actionLog]);

  const handleSelectCat = (catId) => {
    setActiveCat(catId);
    setTweak('demoCategory', catId);
    setTimeout(() => {
      const next = filterItems(itemsWithState, catId, '');
      if (next.length > 0 && !next.find(it => it.institucion === selectedInstId)) {
        setSelectedItemId(next[0].id);
        setSelectedInstId(next[0].institucion);
      }
    }, 0);
  };

  const handleSelectItem = (itemId) => {
    setSelectedItemId(itemId);
    const it = itemsWithState.find(i => i.id === itemId);
    if (it) setSelectedInstId(it.institucion);
  };

  const handleSelectInst = (instId) => {
    setSelectedInstId(instId);
    // Also update bandeja highlight if there's a matching item
    const it = itemsWithState.find(i => i.institucion === instId);
    if (it) setSelectedItemId(it.id);
  };

  const handleContact = (item, channel) => {
    if (channel === 'ai') {
      setToast({ msg: 'Hermes está pensando…', icon: 'auto_awesome' });
      setTimeout(() => setToast(null), 1800);
      return;
    }
    setContactCtx({ item, channel });
  };

  const handleSent = (item, channel, markAsWaiting) => {
    // Always log the send
    setActionLog(log => [
      logEntry({
        instId: item.institucion,
        action: 'sent',
        channel,
        prevState: item.state,
        nextState: markAsWaiting ? 'esperandoRespuesta' : item.state,
        note: channel === 'whatsapp' ? 'Mensaje preparado por WhatsApp' : 'Mail preparado y enviado',
      }),
      ...log,
    ]);
    if (markAsWaiting) {
      setStateOverrides(s => ({ ...s, [item.id]: 'esperandoRespuesta' }));
      setToast({ msg: `Marcado como Esperando respuesta · ${INST_BY_ID[item.institucion].nombre}`, icon: 'check_circle' });
    } else {
      setToast({ msg: 'Mensaje listo · sin cambio de estado', icon: 'check' });
    }
    setTimeout(() => setToast(null), 2400);
  };

  // Ficha emits: open confirmation
  const handleRequestStateChange = (instId, newState) => {
    // current state — first item for this inst
    const currentItem = itemsWithState.find(it => it.institucion === instId);
    setPendingStateChange({
      instId,
      newState,
      currentState: currentItem?.state,
      itemId: currentItem?.id,
    });
  };

  const handleConfirmStateChange = (note) => {
    if (!pendingStateChange) return;
    const { instId, newState, currentState, itemId } = pendingStateChange;
    if (itemId) {
      setStateOverrides(s => ({ ...s, [itemId]: newState }));
    }
    setActionLog(log => [
      logEntry({
        instId,
        action: 'state',
        channel: null,
        prevState: currentState,
        nextState: newState,
        note: note || null,
      }),
      ...log,
    ]);
    setPendingStateChange(null);
    setToast({ msg: `${GESTION_STATES[newState].label} · cambio registrado`, icon: 'flag' });
    setTimeout(() => setToast(null), 2400);
  };

  // Save edits to an institution — merges patch into overrides + logs
  const handleSaveInst = (instId, patch) => {
    const original = INST_BY_ID[instId] || {};
    const changedFields = Object.entries(patch)
      .filter(([k, v]) => (original[k] || '') !== (v || ''))
      .map(([k]) => k);

    setInstitutionOverrides(o => ({ ...o, [instId]: { ...(o[instId] || {}), ...patch } }));
    setActionLog(log => [
      logEntry({
        instId,
        action: 'edit',
        channel: null,
        prevState: null,
        nextState: null,
        note: changedFields.length > 0 ? `Actualizados: ${changedFields.join(', ')}` : 'Datos confirmados sin cambios',
      }),
      ...log,
    ]);
    setEditingInstId(null);
    setToast({
      msg: changedFields.length > 0
        ? `Datos guardados · ${changedFields.length} campo${changedFields.length === 1 ? '' : 's'} actualizado${changedFields.length === 1 ? '' : 's'}`
        : 'Sin cambios para guardar',
      icon: 'check_circle',
    });
    setTimeout(() => setToast(null), 2400);
  };

  // Save a reminder
  const handleSaveReminder = (instId, payload) => {
    const id = 'r-' + Date.now();
    setReminders(rs => [{ id, instId, createdAt: new Date().toISOString(), ...payload }, ...rs]);
    setActionLog(log => [
      logEntry({
        instId,
        action: 'reminder',
        channel: null,
        prevState: null,
        nextState: null,
        note: `${payload.type} · ${payload.dueLabel} · ${payload.note?.slice(0, 60) || ''}`,
      }),
      ...log,
    ]);
    setReminderInstId(null);
    setToast({ msg: `Recordatorio creado · te aviso el ${payload.dueLabel}`, icon: 'alarm' });
    setTimeout(() => setToast(null), 2400);
  };

  // ── Hermes suggestion handlers ──
  // Each action shows a brief acted-on overlay on the card, logs to the session,
  // then removes the suggestion from the queue.
  const resolveSuggestion = (id, kind, toastMsg, toastIcon, logRow) => {
    setJustActed(prev => ({ ...prev, [id]: kind }));
    if (logRow) setActionLog(log => [logRow, ...log]);
    setToast({ msg: toastMsg, icon: toastIcon });
    setTimeout(() => setToast(null), 2400);
    setTimeout(() => {
      setSuggestions(prev => prev.filter(s => s.id !== id));
      setJustActed(prev => { const n = { ...prev }; delete n[id]; return n; });
    }, 900);
  };

  const handleApproveDraft = (id, edited) => {
    const s = suggestions.find(x => x.id === id);
    if (!s) return;
    const name = s.instId ? INST_BY_ID[s.instId]?.nombre : (s.enRespuestaA?.from || 'contacto');
    resolveSuggestion(id, 'approved',
      `${edited?.edited ? 'Editado y enviado' : 'Enviado'} · ${name}`,
      s.canal === 'mail' ? 'mail' : 'chat',
      s.instId ? logEntry({ instId: s.instId, action: 'sent', channel: s.canal, note: edited?.edited ? 'Respuesta de Hermes (editada)' : 'Respuesta de Hermes aprobada' }) : null
    );
  };

  const handleConfirmClasificacion = (id) => {
    const s = suggestions.find(x => x.id === id);
    if (!s) return;
    const c = (typeof UNLINKED_CONTACTS !== 'undefined') ? UNLINKED_CONTACTS.find(u => u.id === s.contactId) : null;
    const msg = s.accion === 'agregar_catalogo' ? `“${c?.nombre}” agregado al catálogo`
      : s.accion === 'vincular' ? `Vinculado a ${INST_BY_ID[s.vincularA]?.nombre}`
      : `“${c?.nombre}” quedó fuera del catálogo`;
    resolveSuggestion(id, 'confirmed', msg, s.accion === 'agregar_catalogo' ? 'add_link' : s.accion === 'vincular' ? 'link' : 'block', null);
  };

  const handleResolveDecision = (id, optIdx) => {
    const s = suggestions.find(x => x.id === id);
    if (!s) return;
    const op = s.opciones?.[optIdx];
    // Navigate to the institution's ficha so the user can act
    if (s.instId) { setSelectedInstId(s.instId); }
    resolveSuggestion(id, 'approved', `${op?.label || 'Resuelto'} · ${INST_BY_ID[s.instId]?.nombre || ''}`, op?.icon || 'check', null);
  };

  const handleDiscardSuggestion = (id) => {
    resolveSuggestion(id, 'discarded', 'Sugerencia descartada', 'delete', null);
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar user="Luis Battaglia" active="gestion" />

      <div
        className="workspace"
        style={railCollapsed ? { '--rail-w': '56px' } : undefined}
      >
        <Rail
          activeCat={activeCat}
          onSelectCat={handleSelectCat}
          counts={counts}
          query={query}
          setQuery={setQuery}
          collapsed={railCollapsed}
          onToggleCollapsed={() => setRailCollapsed(c => !c)}
        />

        <section
          className="center"
          style={{ display: 'flex', flexDirection: 'column' }}
          onClick={(e) => {
            // Click on background (not on a card, button, link, input…) → clear selection
            if (e.target.closest('button, a, input, textarea, select, label, [role="button"], [role="tab"], [role="tablist"], [data-no-deselect]')) return;
            setSelectedInstId(null);
          }}
        >
          <ViewModeTabs
            mode={viewMode}
            onChange={setViewMode}
            badges={{
              bandeja: counts.hoy || 0,
              hermes: suggestions.length || null,
              instituciones: enrichedInstitutions.length,
              calendario: calendarEvents.filter(ev => ev.date >= '2026-05-26').length,
            }}
          />
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {viewMode === 'hermes' && (
              <HermesBandeja
                suggestions={suggestions}
                justActed={justActed}
                onApproveDraft={handleApproveDraft}
                onConfirmClasificacion={handleConfirmClasificacion}
                onResolveDecision={handleResolveDecision}
                onDiscard={handleDiscardSuggestion}
                onSelectInst={handleSelectInst}
                onAddToCatalog={(c) => {
                  setToast({ msg: `“${c.nombre}” agregado al catálogo`, icon: 'add_link' });
                  setTimeout(() => setToast(null), 2200);
                }}
              />
            )}
            {viewMode === 'bandeja' && activeCat === 'sinVincular' && (
              <UnlinkedContactsView
                contacts={typeof UNLINKED_CONTACTS !== 'undefined' ? UNLINKED_CONTACTS : []}
                onAddToCatalog={(c) => {
                  setToast({ msg: `“${c.nombre}” agregado al catálogo`, icon: 'add_link' });
                  setTimeout(() => setToast(null), 2200);
                }}
                onReply={(c) => {
                  setToast({ msg: `Abriendo WhatsApp con ${c.nombre}…`, icon: 'chat' });
                  setTimeout(() => setToast(null), 2000);
                }}
              />
            )}
            {viewMode === 'bandeja' && activeCat !== 'sinVincular' && (
              <Bandeja
                items={visibleItems}
                selectedItemId={selectedItemId}
                onSelect={handleSelectItem}
                onContact={handleContact}
                activeCat={activeCat}
                totalCount={itemsWithState.length}
                onOpenAI={() => {
                  setToast({ msg: 'Hermes está priorizando tu día…', icon: 'auto_awesome' });
                  setTimeout(() => setToast(null), 2200);
                }}
                noSectionWrap
              />
            )}
            {viewMode === 'instituciones' && (
              <InstitucionesView
                institutions={enrichedInstitutions}
                selectedInstId={selectedInstId}
                onSelect={handleSelectInst}
                onContact={handleContact}
                query={query}
                setQuery={setQuery}
                activeCat={activeCat}
                counts={counts}
                onResetCat={() => handleSelectCat('hoy')}
                noSectionWrap
              />
            )}
            {viewMode === 'calendario' && (
              <CalendarView
                events={calendarEvents}
                selectedInstId={selectedInstId}
                onSelectInst={handleSelectInst}
              />
            )}
          </div>
        </section>

        <Ficha
          inst={selectedInst}
          sessionLog={selectedLog}
          onChangeState={handleRequestStateChange}
          onEdit={(instId) => setEditingInstId(instId)}
          onCreateReminder={(instId) => setReminderInstId(instId)}
          onContact={handleContact}
          onClose={() => setSelectedInstId(null)}
          resumen={resumenData}
        />
      </div>

      {contactCtx && (
        <ContactModal
          item={contactCtx.item}
          channel={contactCtx.channel}
          onClose={() => setContactCtx(null)}
          onSent={handleSent}
        />
      )}

      {pendingStateChange && (
        <ConfirmStateChange
          inst={effectiveInst(pendingStateChange.instId)}
          newState={pendingStateChange.newState}
          currentState={pendingStateChange.currentState}
          onConfirm={handleConfirmStateChange}
          onCancel={() => setPendingStateChange(null)}
        />
      )}

      {editingInstId && (
        <EditInstitucionModal
          inst={effectiveInst(editingInstId)}
          onSave={handleSaveInst}
          onClose={() => setEditingInstId(null)}
        />
      )}

      {reminderInstId && (
        <ReminderForm
          inst={effectiveInst(reminderInstId)}
          onSave={handleSaveReminder}
          onClose={() => setReminderInstId(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 18px', borderRadius: 999,
          background: 'var(--ink)', color: 'var(--paper)',
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(20,19,16,0.2)',
          display: 'inline-flex', alignItems: 'center', gap: 10,
          zIndex: 300,
          animation: 'fadeIn .15s ease',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{toast.icon}</span>
          {toast.msg}
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Demo: cambiar vista" />
        <TweakRadio
          label="Categoría"
          value={activeCat}
          options={[
            { value: 'hoy',                 label: 'Hoy' },
            { value: 'porContactar',        label: 'Por contactar' },
            { value: 'reinsistir',           label: 'Reinsistir' },
            { value: 'porFinalizar',        label: 'Por finalizar' },
            { value: 'pendienteDecision',   label: 'Pendiente decisión' },
            { value: 'faltaDato',           label: 'Falta dato' },
            { value: 'confirmada',          label: 'Confirmadas' },
          ]}
          onChange={(v) => { setActiveCat(v); setTweak('demoCategory', v); }}
        />

        <TweakSection label="Apariencia" />
        <TweakRadio
          label="Tema"
          value={t.theme}
          options={[
            { value: 'light', label: 'Claro' },
            { value: 'dark',  label: 'Oscuro' },
          ]}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakColor
          label="Acento"
          value={t.accentLight}
          options={ACCENT_OPTIONS}
          onChange={(v) => setTweak('accentLight', v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
