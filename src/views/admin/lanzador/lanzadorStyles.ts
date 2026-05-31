/**
 * lanzadorStyles — Hoja de estilos scoped del Lanzador (Paper & Ink editorial).
 *
 * Extraída de LanzadorView.tsx para mantener la vista enfocada en la lógica.
 * Importar este módulo inyecta los estilos una sola vez (idempotente vía
 * injectScopedStyles). El namespace de clases es `.lv4`.
 */
import { injectScopedStyles } from "../../../utils/injectScopedStyles";

export const LANZADOR_CSS = `
.lv4 {
  /* Light mode tokens */
  --paper:     #F7F5F0;
  --paper-2:   #EFECE4;
  --paper-3:   #E5E1D7;
  --ink:       #14130F;
  --ink-2:     #2A2823;
  --ink-3:     #6B6660;
  --ink-4:     #A8A39C;
  --rule-2:    #1413101A;
  --rule-3:    #1413102E;
  --accent:    #1F3A8A;
  --accent-s:  #1F3A8A14;
  --warn:      #B4501E;
  --warn-s:    #B4501E14;
  --ok:        #2F5F3A;
  --ok-s:      #2F5F3A14;
  --ai:        #5A2D86;
  --ai-s:      #5A2D8612;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  display: flex;
  min-height: calc(100vh - 60px);
}
html.dark .lv4 {
  --paper:    #0E0E0C;
  --paper-2:  #17171A;
  --paper-3:  #1F1F23;
  --ink:      #F2EFE8;
  --ink-2:    #DAD6CD;
  --ink-3:    #97928A;
  --ink-4:    #5C5852;
  --rule-2:   #F2EFE822;
  --rule-3:   #F2EFE836;
  --accent:   #8FB1FF;
  --accent-s: #8FB1FF1A;
  --warn:     #E4965D;
  --warn-s:   #E4965D1A;
  --ok:       #88BD96;
  --ok-s:     #88BD961A;
  --ai:       #C9A4F2;
  --ai-s:     #C9A4F21A;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.lv4-aside {
  width: 296px; flex-shrink: 0;
  border-right: 1px solid var(--rule-3);
  display: flex; flex-direction: column;
  height: calc(100vh - 60px);
  position: sticky; top: 60px;
  background: var(--paper);
  transition: width .2s ease;
  overflow: hidden;
}
.lv4-aside.collapsed { width: 52px; }

.lv4-aside-head {
  padding: 18px 16px 10px;
  border-bottom: 1px solid var(--rule-2);
  flex-shrink: 0;
}
.lv4-aside-title {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.lv4-aside-title h2 {
  margin: 0; font-size: 18px; font-weight: 700;
  letter-spacing: -0.025em;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lv4-btn-new {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 9px 14px; border-radius: 8px;
  background: var(--ink); color: var(--paper);
  border: none; cursor: pointer; font-size: 13px; font-weight: 500;
  font-family: inherit; white-space: nowrap;
  transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
  margin-top: 8px;
}
.lv4-btn-new:hover { opacity: .92; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
.lv4-btn-new:active { transform: translateY(0); }
.lv4-icon-btn {
  border: none; background: transparent; cursor: pointer; color: var(--ink-3);
  display: flex; align-items: center; padding: 4px; border-radius: 6px;
  transition: background .12s ease;
}
.lv4-icon-btn:hover { background: var(--paper-3); color: var(--ink); }

.lv4-search-wrap { position: relative; margin-top: 8px; }
.lv4-search-icon {
  position: absolute; left: 9px; top: 50%; transform: translateY(-50%);
  font-size: 14px; color: var(--ink-4); pointer-events: none;
}
.lv4-search {
  width: 100%; padding: 7px 10px 7px 30px;
  border: 1px solid var(--rule-3); border-radius: 8px;
  background: var(--paper-2); color: var(--ink);
  font-size: 12.5px; font-family: inherit; outline: none;
  box-sizing: border-box;
}
.lv4-search::placeholder { color: var(--ink-4); }
.lv4-search:focus { border-color: var(--accent); }

.lv4-groups { overflow-y: auto; flex: 1; padding-bottom: 16px; }

.lv4-group-head {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px 5px; border: none; background: transparent;
  cursor: pointer; font-family: inherit;
}
.lv4-group-head:hover .lv4-group-label { color: var(--ink-2); }
.lv4-group-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em;
  font-weight: 600; color: var(--ink-3); transition: color .12s ease;
}
.lv4-group-count {
  font-size: 10.5px; font-family: 'JetBrains Mono', monospace; color: var(--ink-4);
  background: var(--paper-2); border-radius: 999px; padding: 1px 7px; min-width: 18px;
  text-align: center;
}

/* Side row */
.lv4-row {
  display: grid; grid-template-columns: 9px 1fr auto; gap: 10px;
  align-items: flex-start; padding: 9px 14px;
  cursor: pointer; border-left: 2px solid transparent;
  transition: background .12s ease, border-color .12s ease;
}
.lv4-row:hover { background: var(--paper-2); }
.lv4-row.active { background: var(--paper-3); border-left-color: var(--ink); }
.lv4-row.active .lv4-row-name { color: var(--ink); font-weight: 600; }
.lv4-row-name {
  font-size: 13px; font-weight: 500; color: var(--ink-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 1px;
}
.lv4-row-sub {
  font-size: 11px; color: var(--ink-3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lv4-row-meta {
  font-size: 10.5px; color: var(--ink-4);
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 3px;
}
.lv4-badge-attn {
  font-size: 9px; width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--warn-s); color: var(--warn);
  font-weight: 800; letter-spacing: 0; flex-shrink: 0;
  margin-top: 3px;
  box-shadow: 0 0 0 0 var(--warn-s);
  animation: lv4-attn-pulse 2.4s ease-in-out infinite;
}
@keyframes lv4-attn-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--warn-s); }
  50% { box-shadow: 0 0 0 4px transparent; }
}
.lv4-seguro-badge {
  display: inline-flex; align-items: center; justify-content: center;
  vertical-align: middle; margin-left: 6px;
  color: var(--ok);
}
.lv4-seguro-badge .material-icons { font-size: 13px; }
.lv4-aside-foot {
  padding: 10px 14px; border-top: 1px solid var(--rule-2);
  display: flex; justify-content: space-between; align-items: center;
  flex-shrink: 0;
}

/* ── Dot system ──────────────────────────────────────────────────────────── */
.lv4-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
}
.lv4-dot-borrador    { background: var(--ink-4); }
.lv4-dot-abierta     { background: var(--accent); }
.lv4-dot-cerrada     { background: var(--warn); }
.lv4-dot-seleccionada { background: var(--ok); box-shadow: 0 0 0 2px var(--ok-s); }
.lv4-dot-activa      { background: var(--ok); }
.lv4-dot-archivada   { background: var(--ink-4); }

/* ── Status chip ─────────────────────────────────────────────────────────── */
.lv4-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em;
  padding: 3px 10px; border-radius: 20px; border: 1px solid transparent;
}
.lv4-chip-borrador    { background: var(--paper-2); color: var(--ink-3); border-color: var(--rule-3); }
.lv4-chip-abierta     { background: var(--accent-s); color: var(--accent); }
.lv4-chip-cerrada     { background: var(--warn-s); color: var(--warn); }
.lv4-chip-seleccionada { background: var(--ok-s); color: var(--ok); border-color: var(--ok); }
.lv4-chip-activa      { background: var(--ok-s); color: var(--ok); border-color: var(--ok); }
.lv4-chip-archivada   { background: var(--paper-2); color: var(--ink-3); border-color: var(--rule-3); }

/* ── Orientation chips ───────────────────────────────────────────────────── */
.lv4-orient-chip {
  display: inline-flex; align-items: center;
  font-size: 10.5px; font-weight: 500; letter-spacing: .01em;
  padding: 2px 9px; border-radius: 20px;
  background: var(--paper-3); color: var(--ink-3);
  border: 1px solid var(--rule-3);
}

/* ── Pipeline ────────────────────────────────────────────────────────────── */
.lv4-pipeline {
  display: flex; border: 1px solid var(--rule-3); border-radius: 8px; overflow: hidden;
}
.lv4-pipe-step {
  flex: 1; padding: 8px 10px; text-align: center; font-size: 11px;
  border-right: 1px solid var(--rule-2); background: var(--paper-2);
  display: flex; flex-direction: column; gap: 2px; transition: background .12s;
}
.lv4-pipe-step:last-child { border-right: none; }
.lv4-pipe-step.ps-done { background: var(--paper-2); color: var(--ink-3); }
.lv4-pipe-step.ps-active { background: var(--ink); color: var(--paper); }
.lv4-pipe-num { font-family: 'JetBrains Mono', monospace; font-size: 10px; opacity: .6; }
.lv4-pipe-name { font-weight: 600; letter-spacing: .02em; }

/* ── Canvas ──────────────────────────────────────────────────────────────── */
.lv4-canvas { flex: 1; min-width: 0; overflow-y: auto; }

.lv4-canvas-head {
  padding: 22px 40px 18px; border-bottom: 1px solid var(--rule-2);
  position: sticky; top: 0; z-index: 10;
  background: color-mix(in oklab, var(--paper) 88%, transparent);
  backdrop-filter: blur(10px) saturate(1.05);
  -webkit-backdrop-filter: blur(10px) saturate(1.05);
}
.lv4-canvas-body { padding: 28px 40px 56px; }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.lv4-btn {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 13px; font-weight: 500; padding: 8px 14px;
  border-radius: 8px; border: 1px solid var(--rule-3);
  background: transparent; color: var(--ink); cursor: pointer;
  font-family: inherit; transition: all .12s ease;
}
.lv4-btn:hover { background: var(--paper-2); }
.lv4-btn-primary {
  background: var(--ink); color: var(--paper); border-color: var(--ink);
}
.lv4-btn-primary:hover { opacity: .85; }
.lv4-btn:disabled { opacity: .4; cursor: not-allowed; }

/* ── Stat grid ───────────────────────────────────────────────────────────── */
.lv4-stats {
  display: flex; border: 1px solid var(--rule-3); border-radius: 12px; overflow: hidden;
  background: var(--paper);
}
.lv4-stat {
  flex: 1; padding: 16px 20px; border-right: 1px solid var(--rule-2);
  display: flex; flex-direction: column; gap: 4px;
  transition: background .12s ease;
}
.lv4-stat:hover { background: var(--paper-2); }
.lv4-stat:last-child { border-right: none; }
.lv4-stat-label {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .09em;
  font-weight: 600; color: var(--ink-3);
}
.lv4-stat-val {
  font-size: 28px; font-weight: 400; letter-spacing: -0.04em;
  font-family: 'JetBrains Mono', monospace; line-height: 1;
}
.lv4-stat-hint { font-size: 11.5px; color: var(--ink-4); }

/* ── Section titles ──────────────────────────────────────────────────────── */
.lv4-eyebrow {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .12em;
  font-weight: 600; color: var(--ink-3); margin-bottom: 5px;
}
.lv4-section-title {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 20px; font-weight: 700; letter-spacing: -0.025em;
  margin: 0 0 14px; color: var(--ink);
}

/* ── Info banner ─────────────────────────────────────────────────────────── */
.lv4-banner {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 18px; border-radius: 10px; border: 1px solid;
  margin-bottom: 24px;
}

/* ── Progress bar ────────────────────────────────────────────────────────── */
.lv4-progress-track {
  flex: 1; height: 4px; border-radius: 2px; background: var(--rule-3); overflow: hidden;
}
.lv4-progress-fill { height: 100%; border-radius: 2px; transition: width .3s ease; }

/* ── Field cards ─────────────────────────────────────────────────────────── */
.lv4-field-card {
  padding: 14px 16px; border-radius: 10px; border: 1px solid var(--rule-2);
  background: var(--paper);
}
.lv4-field-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: .1em;
  font-weight: 600; color: var(--ink-4); margin-bottom: 6px;
  display: flex; align-items: center; gap: 5px;
}
.lv4-field-val { font-size: 14px; font-weight: 500; color: var(--ink-2); }

/* ── WhatsApp preview ────────────────────────────────────────────────────── */
.lv4-wa-bubble {
  background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;
  padding: 16px 18px; font-size: 13px; line-height: 1.6;
  white-space: pre-wrap; word-break: break-word; color: #14130F;
  max-height: 320px; overflow-y: auto;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .lv4-wa-bubble {
  background: #052e16; border-color: #166534; color: #F2EFE8;
}

/* ── Inscripto row ───────────────────────────────────────────────────────── */
.lv4-insc-row {
  display: grid; grid-template-columns: 32px 1fr auto;
  gap: 12px; padding: 11px 16px; align-items: center;
  border-top: 1px solid var(--rule-2); transition: background .1s;
}
.lv4-insc-row:first-child { border-top: none; }
.lv4-insc-row:hover { background: var(--paper-2); }
.lv4-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--paper-2); border: 1px solid var(--rule-2);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: var(--ink-3);
  flex-shrink: 0;
}

/* ── Action card grid ────────────────────────────────────────────────────── */
.lv4-action-card {
  padding: 18px 20px; border-radius: 12px; border: 1px solid var(--rule-2);
  background: var(--paper-2);
}

/* ── Horario health cards (AbiertaView) ──────────────────────────────────── */
.lv4-horario-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;
}
.lv4-horario-card {
  padding: 14px 16px; border-radius: 12px; border: 1px solid var(--rule-2); background: var(--paper);
}
.lv4-horario-card.low { border-color: color-mix(in oklab, var(--warn) 40%, var(--rule-2)); }
.lv4-horario-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8; margin-bottom: 10px;
}
.lv4-horario-label { font-size: 13.5px; font-weight: 600; color: var(--ink); line-height: 1.3; }
.lv4-horario-track { height: 5px; border-radius: 999px; background: var(--rule-2); overflow: hidden; position: relative; }
.lv4-horario-fill { height: 100%; border-radius: 999px; transition: width .3s ease; }
.lv4-horario-foot { font-size: 11.5px; color: var(--warn); margin-top: 9px; }

/* ── Mix bars ────────────────────────────────────────────────────────────── */
.lv4-mix-row { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
.lv4-mix-label { font-size: 11px; color: var(--ink-3); min-width: 72px; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.lv4-mix-bar { display: flex; height: 7px; border-radius: 999px; overflow: hidden; flex: 1; background: var(--rule-2); }
.lv4-mix-legend { font-size: 10.5px; color: var(--ink-4); font-family: 'JetBrains Mono', monospace; min-width: 120px; text-align: right; }

/* ── Difusión / link box ─────────────────────────────────────────────────── */
.lv4-linkbox {
  padding: 14px 16px; border-radius: 12px; border: 1px solid var(--rule-2); background: var(--paper-2);
}
.lv4-link-url {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-2);
  word-break: break-all; margin: 8px 0 12px; line-height: 1.4;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.lv4-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; min-height: 400px; color: var(--ink-4);
  gap: 12px; text-align: center;
}
.lv4-empty .material-icons { font-size: 40px; opacity: .35; }
.lv4-empty p { font-size: 14px; max-width: 280px; line-height: 1.5; color: var(--ink-3); }

/* ── Loader ──────────────────────────────────────────────────────────────── */
.lv4-loader { display: flex; align-items: center; justify-content: center; min-height: 300px; }
@keyframes lv4-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

injectScopedStyles("lv4-styles", LANZADOR_CSS);
