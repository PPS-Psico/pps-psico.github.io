// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · CSS scoped (Paper & Ink · vista ejecutiva)
//
// Se inyecta una sola vez con injectScopedStyles("metricas-v3-styles", CSS).
// Todo cuelga de `.metricas-v3`, que reusa los tokens globales de index.css
// (--paper/--ink/--accent…) y agrega la firma editorial Instrument Serif para
// los titulares ejecutivos. Light + dark + print contemplados.
// ──────────────────────────────────────────────────────────────────────────
export const METRICAS_V3_CSS = `
.metricas-v3 {
  --mx: 1280px;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-feature-settings: 'ss01', 'cv11';
  min-height: calc(100vh - 120px);
}
.metricas-v3 .wrap { max-width: var(--mx); margin: 0 auto; padding: 0 32px 64px; }

.metricas-v3 .display { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-style: normal; letter-spacing: -0.01em; color: var(--ink); }
.metricas-v3 .display em { font-style: italic; color: #9d3f86; }
html.dark .metricas-v3 .display em { color: #c9a2bd; }
.metricas-v3 .mast-rule { display: block; width: 64px; height: 3px; border-radius: 3px; margin-bottom: 14px; background: linear-gradient(90deg, #46253d 0%, #203b73 50%, #3cb88d 100%); }
.metricas-v3 .serif { font-family: 'Hanken Grotesk', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.025em; }
.metricas-v3 .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; font-feature-settings: 'zero','ss02'; }
.metricas-v3 .eyebrow { font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; color: var(--ink-3); }
.metricas-v3 .label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; color: var(--ink-3); }
.metricas-v3 .meta { font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }

.metricas-v3 .press:active { transform: translateY(0.5px); }
.metricas-v3 .dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }

/* — masthead — */
.metricas-v3 .masthead { padding: 20px 0 26px; border-bottom: 1.5px solid var(--ink); }
.metricas-v3 .masthead h1 { margin: 6px 0 0; font-size: 56px; line-height: 0.98; letter-spacing: -0.015em; }
.metricas-v3 .year-seg { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--rule-2); border-radius: 10px; background: var(--paper); }
.metricas-v3 .year-seg button { border: 0; cursor: pointer; font-family: 'JetBrains Mono', monospace; padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 600; background: transparent; color: var(--ink-3); transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; }
.metricas-v3 .year-seg button[aria-checked="true"] { background: var(--ink); color: var(--paper); }

/* — subtabs — */
.metricas-v3 .subtabs { display: flex; gap: 4px; padding: 20px 0 0; border-bottom: 1px solid var(--rule-2); }
.metricas-v3 .subtabs button { border: 0; background: transparent; cursor: pointer; font-family: inherit; padding: 10px 14px; font-size: 13.5px; font-weight: 500; color: var(--ink-3); display: inline-flex; align-items: center; gap: 7px; position: relative; }
.metricas-v3 .subtabs button.active { font-weight: 600; color: var(--ink); }
.metricas-v3 .subtabs button.active::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px; background: var(--ink); }

/* — bandas / cards — */
.metricas-v3 section.band { padding: 28px 0; }
.metricas-v3 section.band.top { border-top: 1px solid var(--rule-2); }
.metricas-v3 .band-title { margin: 0 0 16px; }
.metricas-v3 .grid { display: grid; gap: 12px; }
.metricas-v3 .grid-3 { grid-template-columns: repeat(3, 1fr); }
.metricas-v3 .grid-4 { grid-template-columns: repeat(4, 1fr); }

.metricas-v3 .kpi { display: flex; flex-direction: column; gap: 8px; padding: 16px 16px 15px; border-radius: 14px; border: 1px solid var(--rule-2); background: var(--paper); cursor: pointer; font-family: inherit; text-align: left; min-width: 0; width: 100%; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; }
.metricas-v3 .kpi:hover { border-color: var(--rule-3); background: var(--paper-2); }
.metricas-v3 .kpi .num { font-size: 30px; font-weight: 300; letter-spacing: -0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
.metricas-v3 .kpi .ctx { font-size: 12px; color: var(--ink-3); line-height: 1.4; }

.metricas-v3 .hero { display: flex; flex-direction: column; gap: 14px; padding: 24px 24px 22px; border-radius: 16px; border: 1px solid var(--rule-2); background: var(--paper); cursor: pointer; font-family: inherit; text-align: left; min-width: 0; width: 100%; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; }
.metricas-v3 .hero:hover { border-color: var(--rule-3); background: var(--paper-2); }
.metricas-v3 .hero .num { font-size: 52px; font-weight: 300; letter-spacing: -0.045em; line-height: 0.9; font-variant-numeric: tabular-nums; }

.metricas-v3 .card { padding: 20px 20px 16px; border: 1px solid var(--rule-2); border-radius: 14px; background: var(--paper); }
.metricas-v3 .charts-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.metricas-v3 .charts-col { display: flex; flex-direction: column; gap: 18px; }

/* — embudo — */
.metricas-v3 .funnel { display: flex; flex-direction: column; align-items: center; gap: 0; max-width: 760px; margin: 0 auto; }
.metricas-v3 .funnel-step { border: 0; cursor: pointer; font-family: inherit; background: transparent; padding: 0; }
.metricas-v3 .funnel-drop { display: flex; align-items: center; gap: 8px; padding: 4px 0; color: var(--ink-4); }

/* — distribución / instituciones rows — */
.metricas-v3 .row-btn { border: 0; background: transparent; cursor: pointer; font-family: inherit; text-align: left; border-radius: 8px; transition: background .12s ease; }
.metricas-v3 .row-btn:hover { background: var(--paper-2); }

/* — trend / bars — */
.metricas-v3 .bar { border-radius: 5px 5px 0 0; transition: height .5s cubic-bezier(.3,.7,.4,1); }

/* — fuente Hermes — */
.metricas-v3 .hermes-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border: 1px solid var(--rule-2); border-radius: 14px; background: var(--paper); flex-wrap: wrap; }

/* — chips de la línea de tiempo (listado completo de PPS por mes) — */
.metricas-v3 .tl-chip { display: inline-flex; align-items: center; max-width: 100%; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 1.3; color: var(--ink-2); background: color-mix(in oklab, var(--chip, var(--accent)) 9%, var(--paper)); border: 1px solid color-mix(in oklab, var(--chip, var(--accent)) 22%, var(--rule-2)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* — modal — */
.metricas-v3-modal { position: fixed; inset: 0; z-index: 1000; background: color-mix(in oklab, var(--ink) 28%, transparent); backdrop-filter: blur(2px); display: flex; align-items: flex-start; justify-content: center; padding: 6vh 20px; }
.metricas-v3-modal .sheet { width: 100%; max-width: 560px; max-height: 84vh; display: flex; flex-direction: column; background: var(--paper); border: 1px solid var(--rule-3); border-radius: 16px; box-shadow: 0 24px 64px -12px color-mix(in oklab, var(--ink) 30%, transparent); overflow: hidden; color: var(--ink); font-family: 'Hanken Grotesk', system-ui, sans-serif; }
.metricas-v3-modal .display { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; }
.metricas-v3-modal .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.metricas-v3-modal .meta { font-size: 12px; color: var(--ink-3); }

/* — skeleton — */
@keyframes mv3-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.metricas-v3 .sk { border-radius: 12px; background: linear-gradient(90deg, var(--paper-2) 25%, var(--paper-3) 37%, var(--paper-2) 63%); background-size: 200% 100%; animation: mv3-shimmer 1.4s ease infinite; }

/* — reporte ejecutivo (documento) — */
.metricas-v3 .exec-sheet { max-width: 880px; margin: 24px auto 0; border: 1px solid var(--rule-2); border-radius: 16px; background: var(--paper); padding: 44px 48px 36px; box-shadow: 0 1px 2px #14131008, 0 14px 36px -20px #14131038; }
html.dark .metricas-v3 .exec-sheet { box-shadow: none; background: var(--paper-2); }

.metricas-v3 .exec-head { border-bottom: 2.5px solid var(--ink); padding-bottom: 14px; position: relative; }
.metricas-v3 .exec-head::after { content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 1px; background: var(--ink); }
.metricas-v3 .exec-head-row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.metricas-v3 .exec-kicker { font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; color: var(--ink-3); }
.metricas-v3 .exec-title { margin: 12px 0 8px; font-size: 36px; line-height: 1.02; letter-spacing: -0.01em; }
.metricas-v3 .exec-head-meta { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: var(--ink-3); }

.metricas-v3 .exec-deck { margin: 28px 0 0; font-family: 'Instrument Serif', Georgia, serif; font-size: 19.5px; line-height: 1.45; color: var(--ink-2); max-width: 62ch; }
/* Marcador suave (mismo efecto que el resaltador del Inicio) para las cifras del copete. */
.metricas-v3 .exec-deck strong {
  font-weight: 400; color: var(--ink);
  background-image: linear-gradient(100deg, transparent 0.4%, color-mix(in oklab, #3cb88d 22%, transparent) 2%, color-mix(in oklab, #3cb88d 22%, transparent) 97%, transparent 99.6%);
  background-repeat: no-repeat; background-size: 100% 56%; background-position: 0 64%;
  padding: 0 0.12em; border-radius: 0.08em;
  -webkit-box-decoration-break: clone; box-decoration-break: clone;
}
html.dark .metricas-v3 .exec-deck strong {
  background-image: linear-gradient(100deg, transparent 0.4%, color-mix(in oklab, #3cb88d 34%, transparent) 2%, color-mix(in oklab, #3cb88d 34%, transparent) 97%, transparent 99.6%);
}

.metricas-v3 .exec-sec { margin-top: 32px; }
.metricas-v3 .exec-sec-head { display: flex; align-items: baseline; gap: 10px; padding-bottom: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--rule-2); }
.metricas-v3 .exec-sec-num { font-size: 11px; font-weight: 600; color: var(--ink-4); }
.metricas-v3 .exec-sec-title { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: var(--ink-2); }
.metricas-v3 .exec-sec-meta { margin-left: auto; font-size: 11px; color: var(--ink-4); }

.metricas-v3 .exec-stats { display: grid; gap: 22px; }
.metricas-v3 .exec-stats-3 { grid-template-columns: repeat(3, 1fr); }
.metricas-v3 .exec-stats-4 { grid-template-columns: repeat(4, 1fr); }
.metricas-v3 .exec-num { font-size: 29px; font-weight: 300; letter-spacing: -0.04em; line-height: 1; color: var(--ink); }
.metricas-v3 .exec-num.big { font-size: 44px; letter-spacing: -0.045em; }
.metricas-v3 .exec-stat-label { font-size: 13px; font-weight: 600; color: var(--ink-2); margin-top: 9px; }
.metricas-v3 .exec-stat-ctx { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; line-height: 1.4; }
.metricas-v3 .exec-prev { font-size: 10.5px; color: var(--ink-4); margin-top: 6px; }

.metricas-v3 .exec-bar { display: flex; gap: 2px; height: 14px; }
.metricas-v3 .exec-bar span { min-width: 3px; border-radius: 2px; }
.metricas-v3 .exec-bar span:first-child { border-top-left-radius: 5px; border-bottom-left-radius: 5px; }
.metricas-v3 .exec-bar span:last-child { border-top-right-radius: 5px; border-bottom-right-radius: 5px; }
.metricas-v3 .exec-legend { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 12px; }
.metricas-v3 .exec-legend-item { display: inline-flex; align-items: baseline; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.metricas-v3 .exec-legend-n { font-size: 11.5px; font-weight: 500; color: var(--ink-3); }
.metricas-v3 .exec-dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; flex: none; align-self: center; }

.metricas-v3 .exec-strip { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--rule-2); border-radius: 10px; overflow: hidden; }
.metricas-v3 .exec-strip > div { padding: 14px 14px 12px; }
.metricas-v3 .exec-strip > div + div { border-left: 1px solid var(--rule-2); }

.metricas-v3 .exec-note { margin: 0 0 14px; font-size: 12.5px; line-height: 1.5; color: var(--ink-3); max-width: 72ch; }
.metricas-v3 .exec-footnote { margin: 10px 0 0; font-size: 10.5px; line-height: 1.5; color: var(--ink-4); max-width: 80ch; }
.metricas-v3 .exec-sel-chip { display: inline-block; font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ok); background: var(--ok-soft); border: 1px solid color-mix(in oklab, var(--ok) 28%, transparent); border-radius: 999px; padding: 1px 8px; margin-right: 8px; vertical-align: 1px; white-space: nowrap; }
.metricas-v3 .exec-t-legajo { font-size: 10.5px; font-weight: 500; color: var(--ink-4); }
.metricas-v3 .exec-table .exec-t-list { font-size: 11.5px; color: var(--ink-3); line-height: 1.5; }

.metricas-v3 .exec-table-wrap { overflow-x: auto; }
.metricas-v3 .exec-table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 12.5px; }
.metricas-v3 .exec-table th { padding: 0 8px 8px; font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 700; color: var(--ink-3); text-align: left; border-bottom: 1.5px solid var(--ink); }
.metricas-v3 .exec-table td { padding: 7px 8px; border-top: 1px solid var(--rule-2); color: var(--ink-2); vertical-align: baseline; line-height: 1.35; }
.metricas-v3 .exec-table th:first-child, .metricas-v3 .exec-table td:first-child { padding-left: 0; }
.metricas-v3 .exec-table th:last-child, .metricas-v3 .exec-table td:last-child { padding-right: 0; }
.metricas-v3 .exec-table .num { text-align: right; white-space: nowrap; }
.metricas-v3 .exec-table td.num { font-size: 12px; color: var(--ink); }
.metricas-v3 .exec-table .exec-t-name { font-weight: 600; color: var(--ink); }
.metricas-v3 .exec-table .exec-t-orient { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; font-size: 12px; color: var(--ink-2); }
.metricas-v3 .exec-table tr.exec-mes td { padding: 16px 8px 6px; border-top: none; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: var(--ink-3); }
.metricas-v3 .exec-table tr.exec-mes td:first-child { padding-left: 0; }
.metricas-v3 .exec-table tr.exec-mes .exec-mes-n { font-weight: 500; color: var(--ink-4); letter-spacing: 0.04em; }
.metricas-v3 .exec-table tfoot tr.exec-total td { border-top: 2px solid var(--ink); padding-top: 10px; font-weight: 600; color: var(--ink); font-size: 12.5px; }
/* Tabla mes a mes: separación visual entre el grupo PPS y el grupo Cupos. */
.metricas-v3 .exec-table.exec-monthly th.sep, .metricas-v3 .exec-table.exec-monthly td.sep { border-left: 1px solid var(--rule-2); padding-left: 16px; }

.metricas-v3 .exec-foot { margin-top: 34px; padding-top: 14px; border-top: 1px solid var(--rule-2); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.metricas-v3 .exec-foot-note { font-size: 11.5px; color: var(--ink-3); }
.metricas-v3 .exec-foot-brand { margin-left: auto; font-size: 10.5px; color: var(--ink-4); }

/* — responsive — */
@media (max-width: 860px) {
  .metricas-v3 .grid-3, .metricas-v3 .grid-4 { grid-template-columns: 1fr 1fr; }
  .metricas-v3 .charts-2col { grid-template-columns: 1fr; }
  .metricas-v3 .masthead h1 { font-size: 40px; }
  .metricas-v3 .exec-stats-3, .metricas-v3 .exec-stats-4 { grid-template-columns: 1fr 1fr; }
  .metricas-v3 .exec-sheet { padding: 32px 26px 28px; }
}
@media (max-width: 560px) {
  .metricas-v3 .grid-3, .metricas-v3 .grid-4 { grid-template-columns: 1fr; }
  .metricas-v3 .masthead h1 { font-size: 34px; }
  .metricas-v3 .exec-stats-3, .metricas-v3 .exec-stats-4 { grid-template-columns: 1fr; }
  .metricas-v3 .exec-strip { grid-template-columns: 1fr; }
  .metricas-v3 .exec-strip > div + div { border-left: none; border-top: 1px solid var(--rule-2); }
  .metricas-v3 .exec-sheet { padding: 26px 18px 24px; }
}

/* — print (reporte ejecutivo) — */
@media print {
  .metricas-v3 .no-print, .metricas-v3 .subtabs, .metricas-v3 .masthead, .metricas-v3 .mv3-footer { display: none !important; }
  .metricas-v3 { background: #fff; min-height: 0; }
  .metricas-v3 .wrap { max-width: none; padding: 0; }
  .metricas-v3 .exec-report { padding: 0 !important; }
  .metricas-v3 .exec-sheet { max-width: none; margin: 0; border: none !important; border-radius: 0; padding: 0 !important; background: #fff !important; box-shadow: none !important; }
  .metricas-v3 .exec-keep, .metricas-v3 .exec-foot { break-inside: avoid; }
  /* El ancho de página (~A4) dispara los breakpoints responsive: acá se anulan
     para que el PDF conserve la misma grilla que la pantalla. */
  .metricas-v3 .exec-stats-3 { grid-template-columns: repeat(3, 1fr) !important; }
  .metricas-v3 .exec-stats-4 { grid-template-columns: repeat(4, 1fr) !important; }
  .metricas-v3 .exec-strip { grid-template-columns: repeat(3, 1fr) !important; }
  .metricas-v3 .exec-strip > div + div { border-left: 1px solid var(--rule-2) !important; border-top: none !important; }
  .metricas-v3 .exec-num.big { font-size: 38px; }
  .metricas-v3 .exec-table { min-width: 0; }
  .metricas-v3 .exec-table-wrap { overflow: visible; }
  .metricas-v3 .exec-table thead { display: table-header-group; }
  .metricas-v3 .exec-table tr { break-inside: avoid; }
  .metricas-v3 .exec-bar span, .metricas-v3 .exec-dot, .metricas-v3 .exec-deck strong, .metricas-v3 .exec-sel-chip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* La hoja se imprime siempre en claro, aunque el panel esté en modo oscuro. */
  html.dark .metricas-v3 {
    --paper: #f7f5f0; --paper-2: #efece4; --paper-3: #e5e1d7;
    --ink: #14130f; --ink-2: #2a2823; --ink-3: #6b6660; --ink-4: #a8a39c;
    --rule: #1413100f; --rule-2: #1413101a; --rule-3: #1413102e;
    --accent: #1f3a8a; --accent-soft: #1f3a8a14;
    --warn: #b4501e; --warn-soft: #b4501e14;
    --ok: #2f5f3a; --ok-soft: #2f5f3a14;
    --ai: #5a2d86; --ai-soft: #5a2d8612;
    --crit: #a6293a; --crit-soft: #a6293a14;
    --orient-clinica: #35804a; --orient-clinica-soft: #35804a14;
    --orient-educacional: #2e5ba8; --orient-educacional-soft: #2e5ba814;
    --orient-laboral: #c0392b; --orient-laboral-soft: #c0392b14;
    --orient-comunitaria: #6e429e; --orient-comunitaria-soft: #6e429e14;
  }
}
`;
