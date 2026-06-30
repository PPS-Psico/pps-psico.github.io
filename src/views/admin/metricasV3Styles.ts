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

/* — responsive — */
@media (max-width: 860px) {
  .metricas-v3 .grid-3, .metricas-v3 .grid-4 { grid-template-columns: 1fr 1fr; }
  .metricas-v3 .charts-2col { grid-template-columns: 1fr; }
  .metricas-v3 .masthead h1 { font-size: 40px; }
}
@media (max-width: 560px) {
  .metricas-v3 .grid-3, .metricas-v3 .grid-4 { grid-template-columns: 1fr; }
  .metricas-v3 .masthead h1 { font-size: 34px; }
}

/* — print (reporte ejecutivo) — */
@media print {
  .metricas-v3 .no-print, .metricas-v3 .subtabs, .metricas-v3 .masthead .year-seg { display: none !important; }
  .metricas-v3 { background: #fff; }
  .metricas-v3 .exec-sheet { border: none !important; padding: 0 !important; }
}
`;
