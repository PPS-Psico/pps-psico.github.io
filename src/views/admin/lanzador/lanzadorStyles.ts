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
.lv4-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

/* Menú de estado (kebab) */
.lv4-state-menu {
  position: absolute; top: 36px; right: 8px; z-index: 41; min-width: 188px;
  background: var(--paper); border: 1px solid var(--rule-3); border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.18); padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
}
.lv4-state-menu-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 8px 10px; background: transparent; border: none; border-radius: 7px;
  cursor: pointer; font-size: 13px; color: var(--ink); text-align: left;
  font-family: inherit; transition: background .12s ease;
}
.lv4-state-menu-item:hover,
.lv4-state-menu-item:focus-visible { background: var(--paper-3); outline: none; }
.lv4-state-menu-item .material-icons { font-size: 17px; color: var(--ink-3); }
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
.lv4-dot-seleccion   { background: var(--accent); }
.lv4-dot-seguro      { background: var(--warn); }
.lv4-dot-confirmacion { background: var(--ok); box-shadow: 0 0 0 2px var(--ok-s); }
.lv4-dot-activa      { background: var(--ok); }
.lv4-dot-archivada   { background: var(--ink-4); }

/* ── Status chip ─────────────────────────────────────────────────────────── */
.lv4-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em;
  padding: 3px 10px; border-radius: 20px; border: 1px solid transparent;
}
.lv4-chip-borrador    { background: var(--paper-2); color: var(--ink-3); border-color: var(--rule-3); }
.lv4-chip-seleccion   { background: var(--accent-s); color: var(--accent); }
.lv4-chip-seguro      { background: var(--warn-s); color: var(--warn); }
.lv4-chip-confirmacion { background: var(--ok-s); color: var(--ok); border-color: var(--ok); }
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
.lv4-stat-val.accent { color: var(--accent); }
.lv4-stat-val.ok     { color: var(--ok); }
.lv4-stat-val.warn   { color: var(--warn); }
.lv4-stat-val.muted  { color: var(--ink-4); }
.lv4-stat-val.md { font-size: 20px; padding-top: 4px; }
.lv4-stat-val.sm { font-size: 16px; padding-top: 6px; }

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
.lv4-banner.ok      { border-color: var(--ok);     background: var(--ok-s); }
.lv4-banner.warn    { border-color: var(--warn);   background: var(--warn-s); }
.lv4-banner.info    { border-color: var(--accent); background: var(--accent-s); }
.lv4-banner.neutral { border-color: var(--rule-2); background: var(--paper-2); }
.lv4-banner-ico { font-size: 20px; margin-top: 2px; color: var(--ink-3); flex-shrink: 0; }
.lv4-banner.ok   .lv4-banner-ico { color: var(--ok); }
.lv4-banner.warn .lv4-banner-ico { color: var(--warn); }
.lv4-banner.info .lv4-banner-ico { color: var(--accent); }
.lv4-banner-main { flex: 1; min-width: 0; }
.lv4-banner-title { font-weight: 600; font-size: 13px; margin-bottom: 3px; color: var(--ink); }
.lv4-banner.ok   .lv4-banner-title { color: var(--ok); }
.lv4-banner.warn .lv4-banner-title { color: var(--warn); }
.lv4-banner-body { font-size: 13px; color: var(--ink-2); }
.lv4-banner.neutral .lv4-banner-body { color: var(--ink-3); }

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
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px;
}
.lv4-horario-label { font-size: 13.5px; font-weight: 600; color: var(--ink); line-height: 1.3; }
.lv4-horario-track { height: 5px; border-radius: 999px; background: var(--rule-2); overflow: hidden; position: relative; }
.lv4-horario-fill { height: 100%; border-radius: 999px; transition: width .3s ease; }
.lv4-horario-foot { font-size: 11.5px; color: var(--warn); margin-top: 9px; }

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

/* ── Badge (small in-row chip for student attributes) ────────────────────── */
.lv4-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
  padding: 2px 8px; border-radius: 4px; border: 1px solid;
  white-space: nowrap; line-height: 1.4; font-family: 'Hanken Grotesk', system-ui, sans-serif;
}
.lv4-badge .material-icons,
.lv4-badge svg { font-size: 11px; line-height: 1; }
.lv4-badge-ok        { background: var(--ok-s);    color: var(--ok);    border-color: color-mix(in oklab, var(--ok) 30%, transparent); }
.lv4-badge-warn      { background: var(--warn-s);  color: var(--warn);  border-color: color-mix(in oklab, var(--warn) 30%, transparent); }
.lv4-badge-accent    { background: var(--accent-s);color: var(--accent);border-color: color-mix(in oklab, var(--accent) 30%, transparent); }
.lv4-badge-ai        { background: var(--ai-s);    color: var(--ai);    border-color: color-mix(in oklab, var(--ai) 30%, transparent); }
.lv4-badge-muted     { background: var(--paper-2); color: var(--ink-3); border-color: var(--rule-3); }
.lv4-badge-danger    { background: var(--warn-s);  color: var(--warn);  border-color: var(--warn); }
.lv4-badge-danger-strong { background: var(--warn); color: var(--paper); border-color: var(--warn); }
.lv4-badge-confirmed { background: var(--ok-s);    color: var(--ok);    border-color: var(--ok); }
.lv4-badge-pending   { background: var(--warn-s);  color: var(--warn);  border-color: var(--warn); }

/* ── Card (student row container) ────────────────────────────────────────── */
.lv4-card {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 2fr auto;
  gap: 16px; align-items: center;
  padding: 14px 18px;
  border: 1px solid var(--rule-2);
  border-radius: 12px;
  background: var(--paper);
  transition: border-color .12s ease, background .12s ease;
}
.lv4-card:hover { border-color: var(--rule-3); }
.lv4-card.selected      { background: color-mix(in oklab, var(--ok) 8%, var(--paper)); border-color: color-mix(in oklab, var(--ok) 40%, var(--rule-2)); }
.lv4-card.confirmed     { background: color-mix(in oklab, var(--accent) 8%, var(--paper)); border-color: color-mix(in oklab, var(--accent) 40%, var(--rule-2)); }
html.dark .lv4-card.selected  { background: color-mix(in oklab, var(--ok) 14%, var(--paper)); }
html.dark .lv4-card.confirmed { background: color-mix(in oklab, var(--accent) 14%, var(--paper)); }

.lv4-card-id {
  display: flex; align-items: center; gap: 12px; min-width: 0;
}
.lv4-avatar-score {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--paper-2); border: 1px solid var(--rule-3);
  display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700;
  color: var(--ink-2); flex-shrink: 0; cursor: pointer;
  transition: transform .12s ease;
}
.lv4-avatar-score:hover { transform: scale(1.06); }
.lv4-avatar-score.high { background: var(--warn-s); color: var(--warn); border-color: color-mix(in oklab, var(--warn) 40%, transparent); }

.lv4-card-name { font-size: 14px; font-weight: 600; color: var(--ink); margin: 0; line-height: 1.2; }
.lv4-card-hours { font-size: 11px; color: var(--ink-3); margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; }
.lv4-card-hours .material-icons { font-size: 12px; }

.lv4-card-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.lv4-card-divider { width: 1px; align-self: stretch; background: var(--rule-2); }

.lv4-card-note {
  display: inline-flex; align-items: flex-start; gap: 6px;
  background: var(--warn-s); border: 1px solid color-mix(in oklab, var(--warn) 30%, transparent);
  border-radius: 6px; padding: 6px 10px; font-size: 12px; color: var(--ink-2);
  width: 100%; margin-top: 6px; line-height: 1.4;
}
.lv4-card-note-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--warn); flex-shrink: 0; }

.lv4-card-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.lv4-fab {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--rule-3); background: var(--paper-2); color: var(--ink-3);
  cursor: pointer; transition: all .12s ease; flex-shrink: 0;
}
.lv4-fab:hover { border-color: var(--accent); color: var(--accent); }
.lv4-fab.selected  { background: var(--ok); color: var(--paper); border-color: var(--ok); }
.lv4-fab.confirmed { background: var(--accent); color: var(--paper); border-color: var(--accent); }
.lv4-fab.selected:hover,
.lv4-fab.confirmed:hover { background: var(--warn); border-color: var(--warn); }
.lv4-fab .material-icons { font-size: 20px; }
.lv4-fab .lv4-spinner { width: 16px; height: 16px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: lv4-spin .8s linear infinite; }

/* ── Tooltip (scoring formula hover) ─────────────────────────────────────── */
.lv4-tooltip {
  position: absolute; z-index: 50; left: 50%; bottom: calc(100% + 8px);
  transform: translateX(-50%);
  background: var(--ink); color: var(--paper);
  border-radius: 8px; padding: 10px 14px; font-size: 12px; line-height: 1.5;
  width: max-content; max-width: 280px; box-shadow: 0 6px 24px rgba(0,0,0,0.18);
  pointer-events: none;
}
.lv4-tooltip-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
  margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid color-mix(in oklab, var(--paper) 20%, transparent);
  display: flex; align-items: center; gap: 4px;
}
.lv4-tooltip ul { margin: 0; padding: 0; list-style: none; }
.lv4-tooltip li { display: flex; justify-content: space-between; gap: 12px; }
.lv4-tooltip-arrow {
  position: absolute; top: 100%; left: 50%; transform: translateX(-50%) rotate(45deg);
  width: 8px; height: 8px; background: var(--ink);
}

/* ── Schedule selector (inline) ──────────────────────────────────────────── */
.lv4-schedule-list { display: flex; flex-direction: column; gap: 6px; max-width: 320px; }
.lv4-schedule-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 8px; border: 1px solid var(--rule-3);
  background: var(--paper-2); color: var(--ink-2); font-size: 12px; line-height: 1.3;
  cursor: pointer; transition: all .12s ease; position: relative;
  max-width: 100%;
}
.lv4-schedule-chip:hover { background: var(--paper-3); }
.lv4-schedule-chip.assigned {
  background: var(--ok-s); color: var(--ok);
  border-color: color-mix(in oklab, var(--ok) 40%, transparent);
}
.lv4-schedule-chip .material-icons { font-size: 13px; }
.lv4-schedule-chip-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lv4-schedule-remove {
  flex-shrink: 0; padding: 2px; border-radius: 4px; color: var(--ink-3);
  border: none; background: transparent; cursor: pointer; display: flex; align-items: center;
  transition: all .12s ease;
}
.lv4-schedule-remove:hover { background: var(--warn); color: var(--paper); }
.lv4-schedule-remove .material-icons { font-size: 12px; }

.lv4-schedule-empty {
  font-size: 12px; color: var(--ink-3); background: var(--paper-2);
  border: 1px solid var(--rule-2); border-radius: 8px;
  padding: 6px 12px; max-width: 320px;
}
.lv4-schedule-empty.muted { color: var(--ink-4); }

.lv4-schedule-add {
  width: 100%; max-width: 320px;
  padding: 7px 12px; border-radius: 8px;
  background: var(--paper); color: var(--ok);
  border: 1.5px dashed color-mix(in oklab, var(--ok) 50%, transparent);
  font-size: 12px; font-weight: 600; font-family: inherit;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all .12s ease;
}
.lv4-schedule-add:hover { background: var(--ok-s); }
.lv4-schedule-add .material-icons { font-size: 14px; }

.lv4-schedule-dropdown {
  background: var(--paper); border: 1px solid var(--rule-3);
  border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,0.10); overflow: hidden;
  max-width: 320px; width: 100%;
}
.lv4-schedule-dropdown-head {
  padding: 6px 12px; background: var(--ok-s); color: var(--ok);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  border-bottom: 1px solid var(--rule-2);
}
.lv4-schedule-dropdown-list { max-height: 200px; overflow-y: auto; }
.lv4-schedule-dropdown-list button {
  width: 100%; text-align: left; padding: 7px 12px; font-size: 12px;
  background: transparent; color: var(--ink-2); border: none; border-bottom: 1px solid var(--rule-2);
  cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px;
  transition: background .12s ease;
}
.lv4-schedule-dropdown-list button:last-child { border-bottom: none; }
.lv4-schedule-dropdown-list button:hover { background: var(--ok-s); color: var(--ok); }
.lv4-schedule-dropdown-list .material-icons { font-size: 13px; color: var(--ok); }

/* ── Commitment chip (large block version) ──────────────────────────────── */
.lv4-commit-block {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 8px 14px; border-radius: 10px; border: 1px solid;
  font-size: 12px; line-height: 1.3;
}
.lv4-commit-block .material-icons { font-size: 16px; }
.lv4-commit-block.confirmed { background: var(--accent-s); border-color: color-mix(in oklab, var(--accent) 40%, transparent); color: var(--accent); }
.lv4-commit-block.pending   { background: var(--warn-s);   border-color: var(--warn); color: var(--warn); }
.lv4-commit-block-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; display: block; }
.lv4-commit-block-sub { font-size: 11px; opacity: .85; }

/* ── Modal shell ─────────────────────────────────────────────────────────── */
.lv4-modal-overlay {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); padding: 16px;
}
.lv4-modal-shell {
  background: var(--paper); color: var(--ink);
  border-radius: 16px; box-shadow: 0 24px 60px rgba(0,0,0,0.25);
  max-width: 42rem; width: 100%; max-height: 85vh;
  display: flex; flex-direction: column; overflow: hidden;
  border: 1px solid var(--rule-2);
  animation: lv4-modal-in .18s ease-out;
}
.lv4-modal-shell.wide { max-width: 56rem; }
@keyframes lv4-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
.lv4-modal-head {
  position: relative; padding: 22px 28px;
  background: linear-gradient(135deg, var(--ink) 0%, var(--ink-2) 60%, var(--accent) 140%);
  color: var(--paper); overflow: hidden;
}
.lv4-modal-head-glow-a {
  position: absolute; top: -40px; right: -40px;
  width: 180px; height: 180px; border-radius: 50%;
  background: var(--accent); opacity: .25; filter: blur(40px); pointer-events: none;
}
.lv4-modal-head-glow-b {
  position: absolute; bottom: -40px; left: -40px;
  width: 140px; height: 140px; border-radius: 50%;
  background: var(--ai); opacity: .18; filter: blur(30px); pointer-events: none;
}
.lv4-modal-head-row {
  position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.lv4-modal-head-info { display: flex; align-items: center; gap: 14px; }
.lv4-modal-head-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: color-mix(in oklab, var(--paper) 15%, transparent);
  border: 1px solid color-mix(in oklab, var(--paper) 25%, transparent);
  display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);
}
.lv4-modal-head-icon .material-icons { font-size: 26px; }
.lv4-modal-head-title { font-size: 19px; font-weight: 700; letter-spacing: -.02em; margin: 0; line-height: 1.2; }
.lv4-modal-head-meta {
  display: inline-flex; align-items: center; gap: 8px; margin-top: 4px;
  font-size: 11px; opacity: .85;
}
.lv4-modal-head-meta .lv4-pill {
  background: color-mix(in oklab, var(--paper) 15%, transparent);
  border: 1px solid color-mix(in oklab, var(--paper) 25%, transparent);
  padding: 2px 10px; border-radius: 999px; font-size: 11px;
}
.lv4-modal-close {
  width: 36px; height: 36px; border-radius: 8px; padding: 0;
  background: transparent; color: var(--paper);
  border: 1px solid transparent; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .12s ease;
}
.lv4-modal-close:hover { background: color-mix(in oklab, var(--paper) 15%, transparent); border-color: color-mix(in oklab, var(--paper) 25%, transparent); }
.lv4-modal-close .material-icons { font-size: 20px; }
.lv4-modal-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
.lv4-modal-foot {
  padding: 14px 24px; border-top: 1px solid var(--rule-2);
  background: var(--paper-2); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;
}

.lv4-modal-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.lv4-modal-stat {
  padding: 14px 16px; border-radius: 12px; border: 1px solid;
  display: flex; align-items: center; gap: 12px;
  transition: box-shadow .12s ease;
}
.lv4-modal-stat:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.06); }
.lv4-modal-stat.accent  { background: var(--accent-s); border-color: color-mix(in oklab, var(--accent) 30%, transparent); }
.lv4-modal-stat.success { background: var(--ok-s);     border-color: color-mix(in oklab, var(--ok) 30%, transparent); }
.lv4-modal-stat.warn    { background: var(--warn-s);   border-color: color-mix(in oklab, var(--warn) 30%, transparent); }
.lv4-modal-stat-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in oklab, currentColor 18%, transparent);
}
.lv4-modal-stat.accent  .lv4-modal-stat-icon { color: var(--accent); }
.lv4-modal-stat.success .lv4-modal-stat-icon { color: var(--ok); }
.lv4-modal-stat.warn    .lv4-modal-stat-icon { color: var(--warn); }
.lv4-modal-stat-icon .material-icons { font-size: 18px; }
.lv4-modal-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 600; line-height: 1; }
.lv4-modal-stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; opacity: .75; margin-top: 2px; }

.lv4-modal-empty {
  text-align: center; padding: 48px 16px; color: var(--ink-4);
}
.lv4-modal-empty .material-icons { font-size: 48px; opacity: .35; margin-bottom: 8px; }
.lv4-modal-empty p { font-size: 13px; }

.lv4-modal-loader {
  display: flex; align-items: center; justify-content: center; padding: 48px 0;
}
.lv4-modal-loader .lv4-spinner {
  width: 28px; height: 28px; border: 3px solid var(--accent); border-top-color: transparent;
  border-radius: 50%; animation: lv4-spin .8s linear infinite;
}

/* ── Table (practicas list) ──────────────────────────────────────────────── */
.lv4-table-wrap {
  border: 1px solid var(--rule-2); border-radius: 10px; overflow: hidden;
  background: var(--paper);
}
.lv4-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lv4-table th {
  padding: 10px 14px; text-align: left; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3);
  background: var(--paper-2); border-bottom: 1px solid var(--rule-2);
}
.lv4-table th.center { text-align: center; }
.lv4-table td { padding: 10px 14px; border-bottom: 1px solid var(--rule-2); color: var(--ink-2); vertical-align: middle; }
.lv4-table td.center { text-align: center; }
.lv4-table tr:last-child td { border-bottom: none; }
.lv4-table tr:hover td { background: var(--paper-2); }
.lv4-table-name { font-weight: 500; color: var(--ink); }
.lv4-table-sub { font-size: 11px; color: var(--ink-3); margin-top: 2px; }

/* ── Form controls (penalty modal: select + textarea) ────────────────────── */
.lv4-form-row { margin-bottom: 14px; }
.lv4-form-label {
  display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: var(--ink-3); margin-bottom: 6px;
}
.lv4-select, .lv4-textarea {
  width: 100%; box-sizing: border-box; font-family: inherit; font-size: 13px;
  padding: 9px 12px; border-radius: 8px; background: var(--paper-2);
  border: 1px solid var(--rule-3); color: var(--ink); outline: none;
  transition: border-color .12s ease;
}
.lv4-select:focus, .lv4-textarea:focus { border-color: var(--accent); }
.lv4-textarea { resize: vertical; min-height: 76px; line-height: 1.5; }

/* ── Button variants (penalty modal actions) ─────────────────────────────── */
.lv4-btn-danger {
  background: var(--warn); color: var(--paper); border-color: var(--warn);
}
.lv4-btn-danger:hover { opacity: .88; }
.lv4-btn-ghost { background: transparent; color: var(--ink-3); border-color: transparent; }
.lv4-btn-ghost:hover { color: var(--ink); background: var(--paper-2); }

/* ── Launch picker grid (when no lanzamiento is selected) ────────────────── */
.lv4-launch-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px; margin-top: 8px;
}
.lv4-launch-card {
  position: relative; text-align: left; padding: 18px;
  border: 1px solid var(--rule-2); border-radius: 12px;
  background: var(--paper); cursor: pointer;
  transition: all .14s ease; overflow: hidden; font-family: inherit; color: inherit;
  display: flex; flex-direction: column; gap: 12px;
}
.lv4-launch-card::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, transparent 50%, color-mix(in oklab, var(--accent) 8%, transparent) 100%);
  opacity: 0; transition: opacity .14s ease; pointer-events: none;
}
.lv4-launch-card:hover { border-color: var(--accent); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
.lv4-launch-card:hover::before { opacity: 1; }
.lv4-launch-card > * { position: relative; }
.lv4-launch-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.lv4-launch-card-title {
  font-size: 15px; font-weight: 700; color: var(--ink); margin: 0;
  line-height: 1.3; letter-spacing: -.01em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: 2.6em;
  transition: color .14s ease;
}
.lv4-launch-card:hover .lv4-launch-card-title { color: var(--accent); }
.lv4-launch-card-date {
  font-size: 12px; color: var(--ink-3); display: flex; align-items: center; gap: 6px;
  padding-top: 10px; border-top: 1px solid var(--rule-2);
}
.lv4-launch-card-date .material-icons { font-size: 14px; opacity: .65; }
.lv4-launch-card-date strong { color: var(--ink-2); font-weight: 500; }
.lv4-launch-card-cupos {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
  background: var(--ok-s); color: var(--ok); border: 1px solid color-mix(in oklab, var(--ok) 30%, transparent);
}

/* ── Page header (back button + title) ───────────────────────────────────── */
.lv4-page-head {
  display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
}
.lv4-page-head h3 { font-size: 19px; font-weight: 700; color: var(--ink); margin: 0; letter-spacing: -.02em; }
.lv4-page-head .lv4-meta { font-size: 12px; color: var(--ink-3); margin-top: 2px; }
.lv4-back-btn {
  width: 36px; height: 36px; border-radius: 8px;
  background: transparent; color: var(--ink-3);
  border: 1px solid var(--rule-2); cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .12s ease;
}
.lv4-back-btn:hover { background: var(--paper-2); color: var(--ink); border-color: var(--rule-3); }
.lv4-back-btn .material-icons { font-size: 18px; }

/* ── Stats row (commitment counters in main header) ──────────────────────── */
.lv4-stat-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px;
  border: 1px solid;
}
.lv4-stat-pill .material-icons { font-size: 14px; }
.lv4-stat-pill.ok        { background: var(--ok-s);     color: var(--ok);     border-color: color-mix(in oklab, var(--ok) 30%, transparent); }
.lv4-stat-pill.pending   { background: var(--warn-s);   color: var(--warn);   border-color: color-mix(in oklab, var(--warn) 30%, transparent); }
.lv4-stat-pill.complete  { background: var(--accent-s); color: var(--accent); border-color: color-mix(in oklab, var(--accent) 30%, transparent); }
.lv4-stat-pill.idle      { background: var(--paper-2);  color: var(--ink-3);  border-color: var(--rule-3); }

/* ── Tab strip (selection / review toggle) ───────────────────────────────── */
.lv4-tabs {
  display: inline-flex; background: var(--paper-2); border: 1px solid var(--rule-2);
  border-radius: 8px; padding: 3px; gap: 2px;
}
.lv4-tab {
  padding: 5px 14px; border: none; background: transparent; color: var(--ink-3);
  font-size: 12px; font-weight: 500; border-radius: 6px; cursor: pointer; font-family: inherit;
  display: flex; align-items: center; gap: 6px; transition: all .12s ease;
}
.lv4-tab:hover { color: var(--ink); }
.lv4-tab.active { background: var(--paper); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.lv4-tab .lv4-tab-count {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 1px 6px;
  border-radius: 999px; background: var(--rule-3); color: var(--ink-3);
}
.lv4-tab.active .lv4-tab-count { background: var(--accent-s); color: var(--accent); }

/* ── Tooltip hover wrapper (scoring formula trigger) ─────────────────────── */
.lv4-tip-trigger { position: relative; display: inline-flex; cursor: help; }
.lv4-tip-trigger .material-icons { font-size: 14px; opacity: .65; }
.lv4-tip-trigger:hover .lv4-tooltip { opacity: 1; transform: translateX(-50%) translateY(-2px); pointer-events: auto; }
.lv4-tip-trigger .lv4-tooltip { opacity: 0; transition: opacity .12s ease, transform .12s ease; }

/* ── Foco visible (accesibilidad de teclado) ─────────────────────────────── */
.lv4-btn:focus-visible,
.lv4-btn-new:focus-visible,
.lv4-icon-btn:focus-visible,
.lv4-search:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .lv4-canvas-head { padding: 18px 20px 14px; }
  .lv4-canvas-body { padding: 20px 20px 48px; }
  .lv4-aside:not(.collapsed) { width: 248px; }
}
@media (max-width: 720px) {
  /* Las stats pasan de una fila a una grilla de 2 columnas. */
  .lv4-stats { flex-wrap: wrap; }
  .lv4-stat { flex: 1 1 50%; border-right: none; border-bottom: 1px solid var(--rule-2); }
  .lv4-stat:nth-last-child(-n + 2) { border-bottom: none; }
  /* La grilla de franjas y campos a una sola columna. */
  .lv4-horario-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .lv4-canvas-head { padding: 14px 14px 12px; }
  .lv4-canvas-body { padding: 16px 14px 40px; }
  .lv4-stat { flex-basis: 100%; }
  .lv4-stat:not(:last-child) { border-bottom: 1px solid var(--rule-2); }
}

/* ── Sidebar como drawer en mobile ───────────────────────────────────────── */
.lv4-mobile-menu-btn { display: none; }
.lv4-aside-backdrop { display: none; }
@media (max-width: 760px) {
  /* El sidebar deja de ocupar espacio y se vuelve un panel deslizable. */
  .lv4-aside,
  .lv4-aside.collapsed {
    position: fixed; top: 60px; left: 0; bottom: 0; width: 284px;
    z-index: 60; transform: translateX(-100%); transition: transform .22s ease;
  }
  .lv4-aside.mobile-open { transform: translateX(0); box-shadow: 2px 0 28px rgba(0,0,0,.28); }
  /* Botón flotante para abrir la lista de convocatorias. */
  .lv4-mobile-menu-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    position: fixed; left: 16px; bottom: 16px; z-index: 50;
    height: 44px; padding: 0 16px; border-radius: 999px;
    background: var(--ink); color: var(--paper); border: none; cursor: pointer;
    box-shadow: 0 6px 20px rgba(0,0,0,.28); font-family: inherit; font-size: 13px; font-weight: 600;
  }
  .lv4-mobile-menu-btn .material-icons { font-size: 18px; }
  .lv4-aside-backdrop.open {
    display: block; position: fixed; inset: 60px 0 0 0; z-index: 55;
    background: rgba(0,0,0,.42); backdrop-filter: blur(1px);
  }
}
`;

injectScopedStyles("lv4-styles", LANZADOR_CSS);
