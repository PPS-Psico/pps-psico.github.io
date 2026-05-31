/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TopBar, Sidebar, Canvas, CONVOCATORIAS */
const { useState, useEffect, useMemo } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentLight": "#1F3A8A",
  "theme": "light",
  "demoState": "borrador"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = ['#1F3A8A', '#1E4D3A', '#9C3D14', '#3A3A3A'];
const ACCENT_DARK = {
  '#1F3A8A': '#8FB1FF', '#1E4D3A': '#8FC7A5',
  '#9C3D14': '#E69A6B', '#3A3A3A': '#C4C4C4',
};

// Map state -> first convocatoria id of that state (for tweak shortcut)
const FIRST_BY_STATE = {};
CONVOCATORIAS.forEach(c => { if (!FIRST_BY_STATE[c.state]) FIRST_BY_STATE[c.state] = c.id; });

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);

  // Selection — default to the first borrador with content (c2)
  const [selectedId, setSelectedId] = useState('c2');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('lanzador-sidebar-collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('lanzador-sidebar-collapsed', sidebarCollapsed ? '1' : '0'); } catch {}
  }, [sidebarCollapsed]);

  // Theme + accent
  useEffect(() => {
    document.documentElement.classList.toggle('dark', t.theme === 'dark');
  }, [t.theme]);
  useEffect(() => {
    const c = t.theme === 'dark' ? ACCENT_DARK[t.accentLight] : t.accentLight;
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-soft', c + (t.theme === 'dark' ? '1A' : '14'));
  }, [t.accentLight, t.theme]);

  // When demoState tweak changes, jump selection to that state
  useEffect(() => {
    if (t.demoState && FIRST_BY_STATE[t.demoState]) {
      setSelectedId(FIRST_BY_STATE[t.demoState]);
    }
  }, [t.demoState]);

  const selected = useMemo(
    () => CONVOCATORIAS.find(c => c.id === selectedId),
    [selectedId]
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar user="Luis Battaglia" active="lanzador" />

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <Sidebar
          selectedId={selectedId}
          onSelect={setSelectedId}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(c => !c)}
          onNew={() => {
            // Pretend to create a new draft — select c1 (the unnamed draft)
            setSelectedId('c1');
          }}
        />

        <main style={{ flex: 1, minWidth: 0 }}>
          <Canvas convocatoria={selected} />
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Demo: cambiar estado" />
        <TweakRadio
          label="Estado"
          value={t.demoState}
          options={[
            { value: 'borrador',     label: 'Borrador' },
            { value: 'abierta',      label: 'Abierta' },
            { value: 'cerrada',      label: 'Seleccionar' },
            { value: 'seleccionada', label: 'Seguro' },
            { value: 'activa',       label: 'Activa' },
            { value: 'archivada',    label: 'Archivada' },
          ]}
          onChange={(v) => setTweak('demoState', v)}
        />
        <div style={{ padding: '6px 12px 12px', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
          Cambia el canvas para que veas cómo se ve cada estado del lanzamiento.
        </div>

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
