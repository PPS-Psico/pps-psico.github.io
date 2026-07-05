const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./SeleccionadorConvocatorias-BmoqTsfE.js","./index-Bf63COEH.js","./index-CTZWBAWr.css","./injectScopedStyles-B_yJaYqk.js","./aseguramientoService-jZuyHPqy.js","./dbSchema-DNJ7jBHR.js","./SeguroGenerator-DbpaYdDt.js","./premiumMotion-DiBIURyU.js","./LanzadorConvocatorias-Bmf4v8Gz.js","./SubTabs-CbK5NI5C.js","./types-D6En6lfa.js","./conveniosService-DcfiPfa0.js","./geminiService-D_f4Akzb.js"])))=>i.map(i=>d[i]);
import{N as pe,a4 as la,n as oe,a5 as aa,a6 as Qe,a7 as Ca,a8 as Aa,H as Ea,K as Ia,a9 as Pe,aa as za,ab as Va,ac as Fa,F as le,$ as ve,_ as fe,ad as ye,ae as Ka,af as Me,ag as Re,l as $e,ah as Ye,ai as Ge,aj as ue,c as ce,j as a,ak as Ta,al as Ga,am as Qa,an as Za,ao as ba,ap as ta,aq as La,ar as Ja,as as Ya,at as Xa,au as et,av as at,aw as ga,r as L,f as pa,ax as ya,ay as da,az as tt,aA as ot,aB as Sa,a2 as Ne,aC as rt,aD as wa,aE as Da,aF as Oa,o as Ze,aG as Ie,aH as nt,aI as st,aJ as ia,W as it,X as lt,U as Na,aK as ct,aL as fa,aM as ha,aN as dt,aO as pt,aP as mt,aQ as ut,aR as vt,aS as ft,aT as ht,aU as xt,aV as bt,V as gt,M as yt,aW as kt,aX as Pa,g as jt,aY as St,a as wt,aZ as Nt}from"./index-Bf63COEH.js";import{i as Ra}from"./injectScopedStyles-B_yJaYqk.js";import{d as _t,B as Ct,a as At,S as Et,P as It}from"./aseguramientoService-jZuyHPqy.js";import{s as zt,R as $a}from"./dbSchema-DNJ7jBHR.js";async function Ft(t,e){if(e.length===0)return{sent:0,errors:0};const o=t[Pe],n=o?String(o).split(";").filter(l=>l.trim()):[],r=n.length<=1,i=t[za];let s="";if(i){const l=new Date(i),h=l.toLocaleDateString("es-AR",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),g=l.getHours().toString().padStart(2,"0"),x=l.getMinutes().toString().padStart(2,"0");s=`${h} a las ${g}:${x} hs`}let c=0,f=0;const u=e.map(async l=>{const h=l.horarioSeleccionado||(r?n[0]:""),g=Fa(),x=await Va("seleccion",{studentName:l.nombre,studentEmail:l.correo??"",ppsName:t[le]??void 0,schedule:h||void 0,encuentroInicial:s||void 0,panelUrl:g});return x.success?c++:f++,x});return await Promise.all(u),ve.info(`[SelectionNotification] Emails sent: ${c} ok, ${f} errors (${e.length} total)`),{sent:c,errors:f}}async function Tt(t,e){if(e.length!==0)try{const{data:o}=await fe.from("email_templates").select("subject, body, is_active").eq("id","seleccion_push").single();if(o?.is_active===!1){ve.info("[SelectionNotification] Push template disabled, skipping");return}const n=e.map(async r=>{const i=(o?.subject||"¡Fuiste seleccionado! 🎉").replace("{{nombre_alumno}}",r.nombre??"").replace("{{nombre_pps}}",t[le]??""),s=(o?.body||"Hola {{nombre_alumno}}, has sido seleccionado para la PPS: {{nombre_pps}}. Revisá tu correo para más detalles.").replace("{{nombre_alumno}}",r.nombre??"").replace("{{nombre_pps}}",t[le]??"");return fe.functions.invoke("send-fcm-notification",{body:{title:i,body:s,type:"selection",user_ids:[r.userId||r.studentId]}})});await Promise.all(n),ve.info("[SelectionNotification] Push notifications sent successfully")}catch(o){ve.error("[SelectionNotification] Error sending push notifications:",o)}}async function Lt(t,e){if(e.length!==0)try{const{data:o}=await fe.from("email_templates").select("subject, body, is_active").eq("id","compromiso_push").single();if(o?.is_active===!1){ve.info("[SelectionNotification] Consent push template disabled, skipping");return}const n=Fa(),r=e.map(async i=>{const s=(o?.subject||"Falta tu consentimiento digital ✍️").replace("{{nombre_alumno}}",i.nombre??"").replace("{{nombre_pps}}",t[le]??""),c=(o?.body||"Hola {{nombre_alumno}}, para confirmar tu lugar en {{nombre_pps}} tenés que aceptar el compromiso digital desde Mi Panel. ¡No te quedes afuera!").replace("{{nombre_alumno}}",i.nombre??"").replace("{{nombre_pps}}",t[le]??"");return fe.functions.invoke("send-fcm-notification",{body:{title:s,body:c,type:"compromiso",user_ids:[i.userId||i.studentId],data:{tag:"pps-consent",url:n}}})});await Promise.all(r),ve.info("[SelectionNotification] Consent reminder push notifications sent successfully")}catch(o){ve.error("[SelectionNotification] Error sending consent reminder push:",o)}}async function Dt(t,e){const o=await Ft(t,e);return await Tt(t,e),await Lt(t,e),o}async function Ot(t){const o=(await pe.convocatorias.getAll()).filter(s=>s[la]===t&&oe(s[aa])==="seleccionado");if(o.length===0)return[];const n=o.map(s=>s[Qe]).filter(Boolean),r=await pe.estudiantes.getAll({filters:{id:n}}),i=new Map(r.map(s=>[s.id,s]));return o.map(s=>{const c=s[Qe],f=c?i.get(c):null;return f?{nombre:f[Ia]||"Desconocido",correo:f[Ea]||null,horarioSeleccionado:s[Aa]||"",userId:f[Ca],studentId:c}:null}).filter(s=>s!==null)}const Pt=`
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
  font-family: inherit; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease;
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
  cursor: pointer; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; flex-shrink: 0;
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
  cursor: pointer; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease; position: relative;
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
  transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease;
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
  transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease;
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
  transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease;
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
  transition: color .14s ease, background-color .14s ease, border-color .14s ease, box-shadow .14s ease, transform .14s ease, opacity .14s ease, filter .14s ease; overflow: hidden; font-family: inherit; color: inherit;
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
  transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease;
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
  display: flex; align-items: center; gap: 6px; transition: color .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .12s ease, opacity .12s ease, filter .12s ease;
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
`;Ra("lv4-styles",Pt);const De={history:t=>["launchHistory",t],convCounts:t=>["convCountsByLaunch",t.join(",")],consentCounts:t=>["consentByLaunch",t.join(",")],roster:t=>["launchRoster",t],practicas:t=>["launchPracticas",t],compromisos:t=>["launchCompromisos",t]},Rt=["launchHistory","convCountsByLaunch","consentByLaunch","launchRoster","launchPracticas","launchCompromisos","candidatesForLaunch","availableStudents","seleccionadosInfo"];function xa(t){Rt.forEach(e=>t.invalidateQueries({queryKey:[e]}))}const Ba=Et,ca=At,Ma=Ct,$t=It;function Bt(t,e){const o=oe(t);return o==="oculto"?"borrador":o==="abierta"||o==="abierto"?"seleccion":o==="confirmacion"?"confirmacion":o==="activa"||o==="activo"?"activa":o==="archivado"||o==="archivada"?"archivada":o==="cerrado"||o==="cerrada"?e?"confirmacion":"seguro":"borrador"}function Mt(t){if(!t)return!1;const e=new Date(t);if(Number.isNaN(e.getTime()))return!1;const o=new Date;return o.setHours(0,0,0,0),e.setHours(23,59,59,999),e.getTime()<o.getTime()}const qt=["seleccionar","asegurar","confirmacion"];function Wt(t,e,o,n=2){const r=oe(t||"");if(r==="archivado"||r==="no se relanza")return!0;if(qt.includes(e)&&o){const i=new Date(o);if(!Number.isNaN(i.getTime())){i.setHours(0,0,0,0);const s=new Date;if(s.setHours(0,0,0,0),s.setDate(s.getDate()-n),i.getTime()<=s.getTime())return!0}}return!1}function Ht(t,e,o){return t.map(n=>{const r=n[ye]||"",i=n[Ka]??null,s=Bt(r,i),c=n[le],f=n[Me],u=n[Re],l=n[$e],h=n[Ye],g=n[Ge],x=e[n.id]?.inscriptos||0,A=e[n.id]?.seleccionados||0,m=o[n.id]||{aceptados:0,total:0},S=Mt(h),j=_t({dbState:s,seguroGestionadoAt:i,totalSel:A,totalInsc:x,vencida:S}),y=Wt(g,j,l),_=y?"archivada":j,I=y?"archivada":s,F=_!=="archivada"&&i!=null;let w;switch(_){case"borrador":w="Sin publicar";break;case"abierta":w=`${x} inscripto${x!==1?"s":""} · ${u??"?"} cupos`;break;case"seleccionar":w=`${x} candidato${x!==1?"s":""} · ${u??"?"} cupos`;break;case"asegurar":w=m.total>0?`${m.aceptados}/${m.total} consintieron`:`${A} seleccionado${A!==1?"s":""} · sin consentir`;break;case"confirmacion":w=m.total>0?`${m.aceptados}/${m.total} consintieron`:`${A} seleccionado${A!==1?"s":""} · sala de consentimientos`;break;case"activa":w=F?`Seguro gestionado · ${ue(i)}`:l?`Desde ${ue(l)}`:"Prácticas en curso";break;default:w=l?ue(l):"Archivada"}const P=_==="seleccionar"||_==="asegurar"&&m.aceptados<m.total||_==="asegurar"&&m.total===0||_==="confirmacion";return{id:n.id,nombre:c,uiState:I,bucket:_,orientacion:f,metaLine:w,needsAction:P,seguroGestionado:F}})}const Ut=`
.lf-section { margin-bottom: 36px; padding-bottom: 28px; border-bottom: 1px solid var(--rule-2); }
.lf-section:last-child { border-bottom: none; }
.lf-section-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
.lf-section-num {
  font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-4);
  padding-top: 3px; flex-shrink: 0; font-variant-numeric: tabular-nums;
}
.lf-section-title {
  margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink);
  display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.lf-section-sub { font-size: 12px; color: var(--ink-3); margin-top: 4px; }
.lf-pending {
  display: inline-flex; align-items: center; gap: 4px; font-size: 11px;
  color: var(--warn); font-weight: 600;
}
.lf-row { margin-bottom: 18px; }
.lf-row:last-child { margin-bottom: 0; }
.lf-row > .label { display: block; margin-bottom: 7px; }
.lf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.lf-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 720px) { .lf-grid-2, .lf-grid-3 { grid-template-columns: 1fr; } }

.lf-check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; padding: 4px 0; }
.lf-check input { margin-top: 2px; accent-color: var(--ink); width: 15px; height: 15px; cursor: pointer; }
.lf-check-label { font-size: 13px; color: var(--ink); font-weight: 500; }
.lf-check-sub { font-size: 12px; color: var(--ink-3); margin-top: 2px; }

.lf-callout {
  padding: 16px; border-radius: 12px; border: 1px dashed var(--ai);
  background: var(--ai-soft); margin-bottom: 20px;
}
.lf-info-box {
  padding: 14px 16px; border-radius: 10px; border: 1px solid var(--rule-2);
  background: var(--paper-2);
}
.lf-act-num {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-4);
  width: 22px; flex-shrink: 0; text-align: center;
}
@keyframes lf-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.lf-spin { animation: lf-spin 1s linear infinite; }
`;Ra("launcher-form-v3",Ut);const Go=t=>{const e=ce.c(28),{number:o,title:n,subtitle:r,pending:i,right:s,children:c}=t,f=i===void 0?0:i;let u,l;e[0]===Symbol.for("react.memo_cache_sentinel")?(u={justifyContent:"space-between"},l={display:"flex",gap:14,alignItems:"flex-start",minWidth:0},e[0]=u,e[1]=l):(u=e[0],l=e[1]);let h;e[2]!==o?(h=a.jsx("span",{className:"lf-section-num",children:o}),e[2]=o,e[3]=h):h=e[3];let g;e[4]===Symbol.for("react.memo_cache_sentinel")?(g={minWidth:0},e[4]=g):g=e[4];let x;e[5]!==f?(x=f>0&&a.jsxs("span",{className:"lf-pending",title:`Faltan ${f} dato${f===1?"":"s"} en esta sección`,children:[a.jsx("span",{className:"dot dot-warn",style:{width:6,height:6}}),f," pendiente",f===1?"":"s"]}),e[5]=f,e[6]=x):x=e[6];let A;e[7]!==x||e[8]!==n?(A=a.jsxs("h3",{className:"lf-section-title",children:[n,x]}),e[7]=x,e[8]=n,e[9]=A):A=e[9];let m;e[10]!==r?(m=r&&a.jsx("div",{className:"lf-section-sub",children:r}),e[10]=r,e[11]=m):m=e[11];let S;e[12]!==A||e[13]!==m?(S=a.jsxs("div",{style:g,children:[A,m]}),e[12]=A,e[13]=m,e[14]=S):S=e[14];let j;e[15]!==h||e[16]!==S?(j=a.jsxs("div",{style:l,children:[h,S]}),e[15]=h,e[16]=S,e[17]=j):j=e[17];let y;e[18]!==s?(y=s&&a.jsx("div",{style:{flexShrink:0},children:s}),e[18]=s,e[19]=y):y=e[19];let _;e[20]!==j||e[21]!==y?(_=a.jsxs("div",{className:"lf-section-head",style:u,children:[j,y]}),e[20]=j,e[21]=y,e[22]=_):_=e[22];let I;e[23]!==c?(I=a.jsx("div",{children:c}),e[23]=c,e[24]=I):I=e[24];let F;return e[25]!==_||e[26]!==I?(F=a.jsxs("section",{className:"lf-section",children:[_,I]}),e[25]=_,e[26]=I,e[27]=F):F=e[27],F},Qo=t=>{const e=ce.c(9),{label:o,hint:n,className:r,children:i}=t,s=`lf-row ${r||""}`;let c;e[0]!==o?(c=a.jsx("span",{className:"label",children:o}),e[0]=o,e[1]=c):c=e[1];let f;e[2]!==n?(f=n&&a.jsx("div",{className:"meta",style:{marginTop:6},children:n}),e[2]=n,e[3]=f):f=e[3];let u;return e[4]!==i||e[5]!==s||e[6]!==c||e[7]!==f?(u=a.jsxs("div",{className:s,children:[c,i,f]}),e[4]=i,e[5]=s,e[6]=c,e[7]=f,e[8]=u):u=e[8],u},Zo=t=>{const e=ce.c(15),{label:o,sublabel:n,checked:r,onChange:i}=t;let s;e[0]!==i?(s=g=>i(g.target.checked),e[0]=i,e[1]=s):s=e[1];let c;e[2]!==r||e[3]!==s?(c=a.jsx("input",{type:"checkbox",checked:r,onChange:s}),e[2]=r,e[3]=s,e[4]=c):c=e[4];let f;e[5]!==o?(f=a.jsx("span",{className:"lf-check-label",children:o}),e[5]=o,e[6]=f):f=e[6];let u;e[7]!==n?(u=n&&a.jsx("span",{className:"lf-check-sub",style:{display:"block"},children:n}),e[7]=n,e[8]=u):u=e[8];let l;e[9]!==f||e[10]!==u?(l=a.jsxs("span",{children:[f,u]}),e[9]=f,e[10]=u,e[11]=l):l=e[11];let h;return e[12]!==c||e[13]!==l?(h=a.jsxs("label",{className:"lf-check",children:[c,l]}),e[12]=c,e[13]=l,e[14]=h):h=e[14],h},qa={label:"Lanzamientos",schema:zt.lanzamientos,fieldConfig:[{key:"sec_info",label:"Información General",type:"section"},{key:le,label:"Nombre PPS",type:"text",isFullWidth:!0,required:!0},{key:Ta,label:"Ubicación / Dirección",type:"text",isFullWidth:!0},{key:Me,label:"Orientaciones",type:"text",description:"Ej: Clínica, Laboral, Educacional"},{key:ye,label:"Estado",type:"select",options:["Abierta","Cerrado","Oculto","Programada"]},{key:Re,label:"Cupos",type:"number"},{key:Ga,label:"Horas Acreditadas",type:"number"},{key:"sec_req",label:"Requisitos y Horarios",type:"section"},{key:Qa,label:"Solicitar CV",type:"checkbox"},{key:Za,label:"Solicitar Certificado",type:"checkbox"},{key:ba,label:"Horarios Fijos",type:"checkbox",description:"El alumno no podrá proponer otros horarios"},{key:Pe,label:"Horarios Disponibles",type:"textarea",isFullWidth:!0,description:"Separados por punto y coma (;)"},{key:"sec_dates",label:"Fechas y Cronograma",type:"section"},{key:$e,label:"Fecha Inicio PPS",type:"date"},{key:ta,label:"Fecha Fin PPS",type:"date"},{key:La,label:"Inicio Inscripción",type:"date"},{key:Ye,label:"Fin Inscripción",type:"date"},{key:za,label:"Encuentro Inicial",type:"date"},{key:Ja,label:"Fecha Publicación",type:"date",description:"Para lanzamientos programados"},{key:"sec_internal",label:"Notas e Internos",type:"section"},{key:"sec_campus",label:"Campus Virtual · Entregas",type:"section"},{key:Ya,label:"Link de la Tarea (Campus / Moodle)",type:"text",isFullWidth:!0,description:"Pegá el enlace de la Tarea de Moodle (buzón de entrega). El campus genera sola la tarjeta de entrega en la orientación de esta PPS. Dejalo vacío si todavía no la creaste."},{key:"sec_file",label:"Archivo Descargable",type:"section"},{key:Xa,label:"Descripción del archivo",type:"text",isFullWidth:!0,description:"Ej: Descargá la fundamentación completa de la PPS"},{key:et,label:"Archivo",type:"file",isFullWidth:!0,fileBucket:"documentos_pps",filePath:"convocatorias"},{key:"sec_notes",label:"Notas de Gestión",type:"section"},{key:at,label:"Notas de Gestión",type:"textarea",isFullWidth:!0,description:"Uso interno para coordinadores"},{key:ga,label:"Mensaje WhatsApp",type:"textarea",isFullWidth:!0,description:"Cuerpo del mensaje que se envía a los grupos"}]},Vt=t=>{const e=ce.c(2),{state:o}=t,n=`lv4-dot lv4-dot-${o}`;let r;return e[0]!==n?(r=a.jsx("div",{className:n}),e[0]=n,e[1]=r):r=e[1],r},Kt=t=>{const e=ce.c(6),{state:o}=t,n=`lv4-chip lv4-chip-${o}`;let r;e[0]!==o?(r=a.jsx(Vt,{state:o}),e[0]=o,e[1]=r):r=e[1];const i=Ba[o];let s;return e[2]!==n||e[3]!==r||e[4]!==i.label?(s=a.jsxs("span",{className:n,children:[r,i.label]}),e[2]=n,e[3]=r,e[4]=i.label,e[5]=s):s=e[5],s},Gt=t=>{const e=ce.c(4),{state:o}=t,n=Math.min(Ba[o].step,5);let r;e[0]!==n?(r=$t.map((s,c)=>{const f=c+1,u=f<n,l=f===n;return a.jsxs("div",{className:`lv4-pipe-step ${u?"ps-done":""} ${l?"ps-active":""}`,children:[a.jsx("span",{className:"lv4-pipe-num",children:u?"✓":String(f).padStart(2,"0")}),a.jsx("span",{className:"lv4-pipe-name",children:s})]},s)}),e[0]=n,e[1]=r):r=e[1];let i;return e[2]!==r?(i=a.jsx("div",{className:"lv4-pipeline",children:r}),e[2]=r,e[3]=i):i=e[3],i},Je=()=>{const t=ce.c(1);let e;return t[0]===Symbol.for("react.memo_cache_sentinel")?(e=a.jsxs("div",{className:"lv4-loader",children:[a.jsx("span",{className:"material-icons",style:{fontSize:18,animation:"lv4-spin 1s linear infinite",color:"var(--ink-3)",marginRight:8},children:"refresh"}),a.jsx("span",{style:{fontSize:13,color:"var(--ink-3)"},children:"Cargando…"})]}),t[0]=e):e=t[0],e},de=t=>{const e=ce.c(11),{label:o,value:n,hint:r,tone:i,size:s}=t;let c;e[0]!==o?(c=a.jsx("div",{className:"lv4-stat-label",children:o}),e[0]=o,e[1]=c):c=e[1];const f=`lv4-stat-val${i?` ${i}`:""}${s?` ${s}`:""}`;let u;e[2]!==f||e[3]!==n?(u=a.jsx("div",{className:f,children:n}),e[2]=f,e[3]=n,e[4]=u):u=e[4];let l;e[5]!==r?(l=r!=null&&a.jsx("div",{className:"lv4-stat-hint",children:r}),e[5]=r,e[6]=l):l=e[6];let h;return e[7]!==c||e[8]!==u||e[9]!==l?(h=a.jsxs("div",{className:"lv4-stat",children:[c,u,l]}),e[7]=c,e[8]=u,e[9]=l,e[10]=h):h=e[10],h},oa=t=>{const e=ce.c(3),{children:o,style:n}=t;let r;return e[0]!==o||e[1]!==n?(r=a.jsx("div",{className:"lv4-stats",style:n,children:o}),e[0]=o,e[1]=n,e[2]=r):r=e[2],r},Oe=t=>{const e=ce.c(15),{tone:o,icon:n,title:r,children:i,action:s,style:c}=t,u=`lv4-banner ${o===void 0?"neutral":o}`;let l;e[0]!==n?(l=a.jsx("span",{className:"material-icons lv4-banner-ico",children:n}),e[0]=n,e[1]=l):l=e[1];let h;e[2]!==r?(h=r!=null&&a.jsx("div",{className:"lv4-banner-title",children:r}),e[2]=r,e[3]=h):h=e[3];let g;e[4]!==i?(g=i!=null&&a.jsx("div",{className:"lv4-banner-body",children:i}),e[4]=i,e[5]=g):g=e[5];let x;e[6]!==h||e[7]!==g?(x=a.jsxs("div",{className:"lv4-banner-main",children:[h,g]}),e[6]=h,e[7]=g,e[8]=x):x=e[8];let A;return e[9]!==s||e[10]!==c||e[11]!==u||e[12]!==l||e[13]!==x?(A=a.jsxs("div",{className:u,style:c,children:[l,x,s]}),e[9]=s,e[10]=c,e[11]=u,e[12]=l,e[13]=x,e[14]=A):A=e[14],A},Qt=t=>{const e=ce.c(73),{entries:o,selectedId:n,collapsed:r,onSelect:i,onNew:s,onToggleCollapsed:c,onAction:f,mobileOpen:u}=t,l=u===void 0?!1:u,[h,g]=L.useState(ao),[x,A]=L.useState(""),[m,S]=L.useState(null);let j,y;e[0]!==m?(j=()=>{if(!m)return;const R=U=>{U.key==="Escape"&&S(null)};return document.addEventListener("keydown",R),()=>document.removeEventListener("keydown",R)},y=[m],e[0]=m,e[1]=j,e[2]=y):(j=e[1],y=e[2]),L.useEffect(j,y);let _;e:{if(!x.trim()){_=o;break e}let R;if(e[3]!==o||e[4]!==x){const U=x.toLowerCase();R=o.filter(Q=>(Q.nombre||"").toLowerCase().includes(U)||(Q.orientacion||"").toLowerCase().includes(U)),e[3]=o,e[4]=x,e[5]=R}else R=e[5];_=R}const I=_;let F;e[6]!==I?(F=Ma.map(R=>({key:R,items:I.filter(U=>U.bucket===R)})).filter(to),e[6]=I,e[7]=F):F=e[7];const w=F;let P;e[8]===Symbol.for("react.memo_cache_sentinel")?(P=R=>{g(U=>{const Q=new Set(U);return Q.has(R)?Q.delete(R):Q.add(R),Q})},e[8]=P):P=e[8];const B=P;if(r){const R=`lv4-aside collapsed${l?" mobile-open":""}`;let U;e[9]===Symbol.for("react.memo_cache_sentinel")?(U={margin:"14px auto 8px",width:36,height:36,justifyContent:"center"},e[9]=U):U=e[9];let Q;e[10]===Symbol.for("react.memo_cache_sentinel")?(Q=a.jsx("span",{className:"material-icons",style:{fontSize:20},children:"chevron_right"}),e[10]=Q):Q=e[10];let W;e[11]!==c?(W=a.jsx("button",{onClick:c,className:"lv4-icon-btn",title:"Expandir lista",style:U,children:Q}),e[11]=c,e[12]=W):W=e[12];let ne;e[13]===Symbol.for("react.memo_cache_sentinel")?(ne={background:"var(--ink)",color:"var(--paper)",margin:"0 auto",width:36,height:36,borderRadius:8,justifyContent:"center"},e[13]=ne):ne=e[13];let V;e[14]===Symbol.for("react.memo_cache_sentinel")?(V=a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"add"}),e[14]=V):V=e[14];let J;e[15]!==s?(J=a.jsx("button",{onClick:s,className:"lv4-icon-btn",title:"Nueva convocatoria",style:ne,children:V}),e[15]=s,e[16]=J):J=e[16];let se;e[17]===Symbol.for("react.memo_cache_sentinel")?(se={paddingTop:8},e[17]=se):se=e[17];let te;if(e[18]!==w||e[19]!==c){let ee;e[21]!==c?(ee=ae=>a.jsxs("button",{onClick:c,title:`${ca[ae.key].label}: ${ae.items.length}`,style:{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"10px 0",border:"none",background:"transparent",cursor:"pointer"},children:[a.jsx("div",{className:`lv4-dot lv4-dot-${ca[ae.key].tone}`}),a.jsx("span",{style:{fontSize:10,fontFamily:"monospace",color:"var(--ink-4)"},children:ae.items.length})]},ae.key),e[21]=c,e[22]=ee):ee=e[22],te=w.map(ee),e[18]=w,e[19]=c,e[20]=te}else te=e[20];let re;e[23]!==te?(re=a.jsx("div",{className:"lv4-groups",style:se,children:te}),e[23]=te,e[24]=re):re=e[24];let X;return e[25]!==W||e[26]!==J||e[27]!==re||e[28]!==R?(X=a.jsxs("aside",{className:R,children:[W,J,re]}),e[25]=W,e[26]=J,e[27]=re,e[28]=R,e[29]=X):X=e[29],X}const M=`lv4-aside${l?" mobile-open":""}`;let O;e[30]===Symbol.for("react.memo_cache_sentinel")?(O=a.jsx("h2",{children:"Convocatorias"}),e[30]=O):O=e[30];let D;e[31]===Symbol.for("react.memo_cache_sentinel")?(D=a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"chevron_left"}),e[31]=D):D=e[31];let z;e[32]!==c?(z=a.jsxs("div",{className:"lv4-aside-title",children:[O,a.jsx("button",{className:"lv4-icon-btn",onClick:c,title:"Plegar",children:D})]}),e[32]=c,e[33]=z):z=e[33];let q;e[34]===Symbol.for("react.memo_cache_sentinel")?(q=a.jsx("span",{className:"material-icons",style:{fontSize:16},children:"add"}),e[34]=q):q=e[34];let d;e[35]!==s?(d=a.jsxs("button",{className:"lv4-btn-new",onClick:s,children:[q,"Nueva convocatoria"]}),e[35]=s,e[36]=d):d=e[36];let b;e[37]===Symbol.for("react.memo_cache_sentinel")?(b=a.jsx("span",{className:"material-icons lv4-search-icon",children:"search"}),e[37]=b):b=e[37];let k;e[38]===Symbol.for("react.memo_cache_sentinel")?(k=R=>A(R.target.value),e[38]=k):k=e[38];let v;e[39]!==x?(v=a.jsxs("div",{className:"lv4-search-wrap",children:[b,a.jsx("input",{className:"lv4-search",value:x,onChange:k,placeholder:"Filtrar…"})]}),e[39]=x,e[40]=v):v=e[40];let N;e[41]!==z||e[42]!==d||e[43]!==v?(N=a.jsxs("div",{className:"lv4-aside-head",children:[z,d,v]}),e[41]=z,e[42]=d,e[43]=v,e[44]=N):N=e[44];let p;if(e[45]!==h||e[46]!==w||e[47]!==f||e[48]!==i||e[49]!==m||e[50]!==n){let R;e[52]!==h||e[53]!==f||e[54]!==i||e[55]!==m||e[56]!==n?(R=U=>{const Q=h.has(U.key);return a.jsxs("div",{children:[a.jsxs("button",{className:"lv4-group-head",onClick:()=>B(U.key),children:[a.jsxs("span",{className:"lv4-group-label",children:[a.jsx("span",{className:"material-icons",style:{fontSize:14,transition:"transform .15s",transform:Q?"rotate(-90deg)":"rotate(0)",color:"var(--ink-4)"},children:"expand_more"}),ca[U.key].label]}),a.jsx("span",{className:"lv4-group-count",children:U.items.length})]}),!Q&&U.items.map(W=>{const ne=W.uiState==="archivada";return a.jsxs("div",{className:`lv4-row ${n===W.id?"active":""}`,role:"button",tabIndex:0,"aria-current":n===W.id?"true":void 0,"aria-label":W.nombre||"Convocatoria sin nombre",onClick:()=>i(W.id),onKeyDown:V=>{(V.key==="Enter"||V.key===" ")&&(V.preventDefault(),i(W.id))},style:{position:"relative"},children:[a.jsx("div",{className:`lv4-dot lv4-dot-${W.uiState}`}),a.jsxs("div",{style:{minWidth:0,flex:1},children:[a.jsxs("div",{className:"lv4-row-name",children:[W.nombre||a.jsx("span",{style:{fontStyle:"italic",color:"var(--ink-4)"},children:"Sin nombre"}),W.seguroGestionado&&a.jsx("span",{className:"lv4-seguro-badge",title:"Seguro gestionado","aria-label":"Seguro gestionado",children:a.jsx("span",{className:"material-icons",children:"verified_user"})})]}),W.orientacion&&a.jsx("div",{className:"lv4-row-sub",children:W.orientacion}),a.jsx("div",{className:"lv4-row-meta",children:W.metaLine})]}),W.needsAction&&a.jsx("div",{className:"lv4-badge-attn",children:"!"}),a.jsx("button",{className:"lv4-icon-btn",title:"Cambiar estado","aria-label":"Cambiar estado","aria-haspopup":"menu","aria-expanded":m===W.id,onClick:V=>{V.stopPropagation(),S(J=>J===W.id?null:W.id)},style:{width:28,height:28,justifyContent:"center",flexShrink:0},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"more_vert"})}),m===W.id&&a.jsxs(a.Fragment,{children:[a.jsx("div",{onClick:V=>{V.stopPropagation(),S(null)},style:{position:"fixed",inset:0,zIndex:40}}),a.jsx("div",{onClick:oo,className:"lv4-state-menu",role:"menu",children:[{action:"abrir",icon:"lock_open",label:"Abrir inscripción"},{action:"cerrar",icon:"lock",label:"Cerrar inscripción"},{action:"ocultar",icon:"visibility_off",label:"Ocultar (borrador)"},ne?{action:"desarchivar",icon:"unarchive",label:"Des-archivar (hacer visible)"}:{action:"archivar",icon:"archive",label:"Archivar"}].map(V=>a.jsxs("button",{role:"menuitem",className:"lv4-state-menu-item",onClick:J=>{J.stopPropagation(),S(null),f(W.id,V.action)},children:[a.jsx("span",{className:"material-icons",children:V.icon}),V.label]},V.action))})]})]},W.id)})]},U.key)},e[52]=h,e[53]=f,e[54]=i,e[55]=m,e[56]=n,e[57]=R):R=e[57],p=w.map(R),e[45]=h,e[46]=w,e[47]=f,e[48]=i,e[49]=m,e[50]=n,e[51]=p}else p=e[51];let E;e[58]!==w.length?(E=w.length===0&&a.jsx("div",{style:{padding:"24px 16px",textAlign:"center",color:"var(--ink-4)",fontSize:13},children:"No se encontraron convocatorias."}),e[58]=w.length,e[59]=E):E=e[59];let T;e[60]!==p||e[61]!==E?(T=a.jsxs("div",{className:"lv4-groups",children:[p,E]}),e[60]=p,e[61]=E,e[62]=T):T=e[62];let $;e[63]===Symbol.for("react.memo_cache_sentinel")?($={display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"var(--ink-3)"},e[63]=$):$=e[63];let G,H;e[64]===Symbol.for("react.memo_cache_sentinel")?(G=a.jsxs("span",{style:$,children:[a.jsx("span",{className:"material-icons",style:{fontSize:14,color:"var(--ok)"},children:"cloud_done"}),"Sincronizado"]}),H={fontSize:12,color:"var(--ink-4)",fontFamily:"monospace"},e[64]=G,e[65]=H):(G=e[64],H=e[65]);let C;e[66]!==o.length?(C=a.jsxs("div",{className:"lv4-aside-foot",children:[G,a.jsxs("span",{style:H,children:[o.length," total"]})]}),e[66]=o.length,e[67]=C):C=e[67];let Y;return e[68]!==N||e[69]!==T||e[70]!==C||e[71]!==M?(Y=a.jsxs("aside",{className:M,children:[N,T,C]}),e[68]=N,e[69]=T,e[70]=C,e[71]=M,e[72]=Y):Y=e[72],Y},Xe=t=>{const e=ce.c(54),{launch:o,uiState:n,primaryAction:r,secondaryActions:i}=t;let s;e[0]!==i?(s=i===void 0?[]:i,e[0]=i,e[1]=s):s=e[1];const c=s,f=o[le],u=o[Me];let l,h,g,x,A,m;if(e[2]!==o.id||e[3]!==f||e[4]!==u||e[5]!==n){const B=u?u.split(/[,/]/).map(ro).filter(Boolean):[];A="lv4-canvas-head";let M;e[12]===Symbol.for("react.memo_cache_sentinel")?(M={display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"},e[12]=M):M=e[12];let O;e[13]!==n?(O=a.jsx(Kt,{state:n}),e[13]=n,e[14]=O):O=e[14];const D=B.length>0&&a.jsxs("span",{className:"lv4-chip",style:{background:"transparent",border:"1px solid var(--rule-3)",color:"var(--ink-3)"},children:[a.jsx("span",{className:"material-icons",style:{fontSize:13},children:"school"}),B[0],B.length>1?` +${B.length-1}`:""]});let z;e[15]===Symbol.for("react.memo_cache_sentinel")?(z={marginLeft:"auto",fontSize:11,fontFamily:"monospace",color:"var(--ink-4)"},e[15]=z):z=e[15];let q;e[16]!==o.id?(q=String(o.id).slice(0,8).toUpperCase(),e[16]=o.id,e[17]=q):q=e[17];let d;e[18]!==q?(d=a.jsxs("span",{style:z,children:["ID ",q]}),e[18]=q,e[19]=d):d=e[19],e[20]!==O||e[21]!==D||e[22]!==d?(m=a.jsxs("div",{style:M,children:[O,D,d]}),e[20]=O,e[21]=D,e[22]=d,e[23]=m):m=e[23];let b;e[24]===Symbol.for("react.memo_cache_sentinel")?(x={display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:20,marginBottom:16},l={minWidth:0,flex:1},b={margin:0,fontSize:33,fontWeight:400,letterSpacing:"-0.015em",lineHeight:1.1,fontFamily:"'Instrument Serif', Georgia, serif"},e[24]=b,e[25]=l,e[26]=x):(b=e[24],l=e[25],x=e[26]);let k;e[27]!==f?(k=f||a.jsx("span",{style:{color:"var(--ink-4)",fontWeight:400,fontStyle:"italic"},children:"Convocatoria sin nombre"}),e[27]=f,e[28]=k):k=e[28],e[29]!==k?(h=a.jsx("h1",{style:b,children:k}),e[29]=k,e[30]=h):h=e[30],g=B.length>0&&a.jsx("div",{style:{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"},children:B.map(no)}),e[2]=o.id,e[3]=f,e[4]=u,e[5]=n,e[6]=l,e[7]=h,e[8]=g,e[9]=x,e[10]=A,e[11]=m}else l=e[6],h=e[7],g=e[8],x=e[9],A=e[10],m=e[11];let S;e[31]!==l||e[32]!==h||e[33]!==g?(S=a.jsxs("div",{style:l,children:[h,g]}),e[31]=l,e[32]=h,e[33]=g,e[34]=S):S=e[34];let j;e[35]===Symbol.for("react.memo_cache_sentinel")?(j={display:"flex",gap:8,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end",marginTop:2},e[35]=j):j=e[35];let y;e[36]!==c?(y=c.map(so),e[36]=c,e[37]=y):y=e[37];let _;e[38]!==r?(_=r&&a.jsxs("button",{className:"lv4-btn lv4-btn-primary",onClick:r.onClick,disabled:r.disabled,children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:r.icon}),r.label]}),e[38]=r,e[39]=_):_=e[39];let I;e[40]!==y||e[41]!==_?(I=a.jsxs("div",{style:j,children:[y,_]}),e[40]=y,e[41]=_,e[42]=I):I=e[42];let F;e[43]!==I||e[44]!==x||e[45]!==S?(F=a.jsxs("div",{style:x,children:[S,I]}),e[43]=I,e[44]=x,e[45]=S,e[46]=F):F=e[46];let w;e[47]!==n?(w=n!=="archivada"&&a.jsx(Gt,{state:n}),e[47]=n,e[48]=w):w=e[48];let P;return e[49]!==F||e[50]!==w||e[51]!==A||e[52]!==m?(P=a.jsxs("div",{className:A,children:[m,F,w]}),e[49]=F,e[50]=w,e[51]=A,e[52]=m,e[53]=P):P=e[53],P},_a=t=>typeof t=="string"?t.split("T")[0].trim():t==null?"":String(t),Zt=[{launchKey:$e,practicaKey:tt,label:"Fecha de inicio"},{launchKey:ta,practicaKey:ot,label:"Fecha de finalización"}];function ma(t,e){const[o,n]=L.useState(!1),[r,i]=L.useState(!1),[s,c]=L.useState(null),[f,u]=L.useState(!1),l=pa(),h=()=>l.invalidateQueries({predicate:m=>String(m.queryKey[0]??"").toLowerCase().includes("practica")}),g=async(m,S)=>{i(!0);try{if(m){await pe.lanzamientos.update(m,S),await l.invalidateQueries({queryKey:["launchHistory"]});const j=Zt.filter(y=>y.launchKey in S&&_a(S[y.launchKey])!==_a(t[y.launchKey]));if(j.length>0){const{count:y}=await fe.from("practicas").select("id",{count:"exact",head:!0}).eq(Sa,m);if(y&&y>0){const _={};j.forEach(I=>{_[I.practicaKey]=S[I.launchKey]??null}),c({count:y,labels:j.map(I=>I.label),practicaFields:_})}}}}catch(j){ve.error(j)}finally{i(!1),n(!1)}},x=async()=>{if(s){u(!0);try{const{error:m}=await fe.from("practicas").update(s.practicaFields).eq(Sa,t.id);if(m)throw m;await h(),e?.()}catch(m){ve.error(m)}finally{u(!1),c(null)}}},A=a.jsxs(a.Fragment,{children:[a.jsx($a,{isOpen:o,onClose:()=>n(!1),record:t,tableConfig:qa,onSave:g,isSaving:r}),s&&a.jsx(Jt,{prompt:s,busy:f,onConfirm:x,onDismiss:()=>c(null)})]});return{openEdit:()=>n(!0),modal:A}}const Jt=t=>{const e=ce.c(49),{prompt:o,busy:n,onConfirm:r,onDismiss:i}=t,{count:s,labels:c}=o;let f;e[0]!==c?(f=c.length===1?c[0].toLowerCase():c.map(io).join(" y "),e[0]=c,e[1]=f):f=e[1];const u=f;let l;e[2]===Symbol.for("react.memo_cache_sentinel")?(l={position:"fixed",inset:0,zIndex:1e3,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(20,19,16,.42)",backdropFilter:"blur(2px)"},e[2]=l):l=e[2];const h=n?void 0:i;let g,x,A;e[3]===Symbol.for("react.memo_cache_sentinel")?(g={width:"100%",maxWidth:440,background:"var(--paper)",border:"1px solid var(--rule-3)",borderRadius:16,boxShadow:"0 1px 2px rgba(20,19,16,.04), 0 24px 48px -16px rgba(20,19,16,.32)",overflow:"hidden"},x={padding:"22px 24px 16px"},A={display:"inline-flex",alignItems:"center",justifyContent:"center",width:40,height:40,borderRadius:10,background:"var(--accent-s)",marginBottom:14},e[3]=g,e[4]=x,e[5]=A):(g=e[3],x=e[4],A=e[5]);let m,S,j;e[6]===Symbol.for("react.memo_cache_sentinel")?(m=a.jsx("div",{style:A,children:a.jsx("span",{className:"material-icons",style:{fontSize:22,color:"var(--accent)"},children:"sync_alt"})}),S=a.jsx("h3",{style:{margin:"0 0 8px",fontSize:21,fontWeight:400,letterSpacing:"-0.015em",fontFamily:"'Instrument Serif', Georgia, serif",color:"var(--ink)"},children:"¿Aplicar también a las prácticas?"}),j={margin:0,fontSize:13.5,lineHeight:1.55,color:"var(--ink-2)"},e[6]=m,e[7]=S,e[8]=j):(m=e[6],S=e[7],j=e[8]);let y;e[9]!==s?(y=a.jsx("b",{children:s}),e[9]=s,e[10]=y):y=e[10];const _=s!==1?"s":"",I=s!==1?"s":"";let F;e[11]!==u?(F=a.jsx("b",{children:u}),e[11]=u,e[12]=F):F=e[12];let w;e[13]!==y||e[14]!==_||e[15]!==I||e[16]!==F?(w=a.jsxs("p",{style:j,children:["Hay ",y," estudiante",_," ya seleccionado",I," con su práctica creada. Cambiaste la ",F," del lanzamiento, pero la práctica de cada estudiante guarda su propia copia."]}),e[13]=y,e[14]=_,e[15]=I,e[16]=F,e[17]=w):w=e[17];let P;e[18]===Symbol.for("react.memo_cache_sentinel")?(P={marginTop:12,padding:"10px 12px",borderRadius:9,background:"var(--warn-s)",border:"1px solid var(--rule-2)",fontSize:12.5,lineHeight:1.5,color:"var(--ink-3)",display:"flex",gap:8},e[18]=P):P=e[18];let B;e[19]===Symbol.for("react.memo_cache_sentinel")?(B=a.jsx("span",{className:"material-icons",style:{fontSize:16,color:"var(--warn)"},children:"info"}),e[19]=B):B=e[19];const M=s===1?"esa práctica":"esas prácticas";let O;e[20]!==u||e[21]!==M?(O=a.jsxs("div",{style:P,children:[B,a.jsxs("span",{children:["Si propagás, se sobrescribe la ",u," en"," ",M,", incluso si algún estudiante la había ajustado por su cuenta."]})]}),e[20]=u,e[21]=M,e[22]=O):O=e[22];let D;e[23]!==w||e[24]!==O?(D=a.jsxs("div",{style:x,children:[m,S,w,O]}),e[23]=w,e[24]=O,e[25]=D):D=e[25];let z;e[26]===Symbol.for("react.memo_cache_sentinel")?(z={display:"flex",gap:10,justifyContent:"flex-end",padding:"14px 24px 20px"},e[26]=z):z=e[26];let q;e[27]!==n||e[28]!==i?(q=a.jsx("button",{className:"lv4-btn",onClick:i,disabled:n,children:"No, solo el lanzamiento"}),e[27]=n,e[28]=i,e[29]=q):q=e[29];let d;e[30]!==n?(d={fontSize:14,...n?{animation:"lv4-spin 1s linear infinite"}:{}},e[30]=n,e[31]=d):d=e[31];const b=n?"refresh":"check";let k;e[32]!==d||e[33]!==b?(k=a.jsx("span",{className:"material-icons",style:d,children:b}),e[32]=d,e[33]=b,e[34]=k):k=e[34];const v=n?"Aplicando…":`Sí, aplicar a ${s}`;let N;e[35]!==n||e[36]!==r||e[37]!==k||e[38]!==v?(N=a.jsxs("button",{className:"lv4-btn lv4-btn-primary",onClick:r,disabled:n,children:[k,v]}),e[35]=n,e[36]=r,e[37]=k,e[38]=v,e[39]=N):N=e[39];let p;e[40]!==q||e[41]!==N?(p=a.jsxs("div",{style:z,children:[q,N]}),e[40]=q,e[41]=N,e[42]=p):p=e[42];let E;e[43]!==D||e[44]!==p?(E=a.jsxs("div",{onClick:lo,style:g,children:[D,p]}),e[43]=D,e[44]=p,e[45]=E):E=e[45];let T;return e[46]!==E||e[47]!==h?(T=a.jsx("div",{role:"dialog","aria-modal":"true",style:l,onClick:h,children:E}),e[46]=E,e[47]=h,e[48]=T):T=e[48],T},ka=L.lazy(()=>ya(()=>import("./SeleccionadorConvocatorias-BmoqTsfE.js"),__vite__mapDeps([0,1,2,3,4,5]),import.meta.url)),Yt=L.lazy(()=>ya(()=>import("./SeguroGenerator-DbpaYdDt.js"),__vite__mapDeps([6,1,2,4,3,7]),import.meta.url));function Wa(t){const e=t[le],o=t[Me],n=t[Re],r=t[$e],i=t[ta],s=t[Ye],c=t[da],f=t[Ta],u=t[Pe],l=[];return l.push(`📣 *¡Nueva Convocatoria PPS${e?`: ${e}`:""}!* 📣`),l.push(""),o&&l.push(`🎓 *Orientación:* ${o}`),f&&l.push(`📍 *Lugar:* ${f}`),n&&l.push(`👥 *Cupos:* ${n}`),u&&l.push(`🕒 *Horario:* ${u}`),l.push(""),s&&l.push(`📅 *Inscripción hasta:* ${ue(s)}`),r&&l.push(`🚀 *Inicio práctica:* ${ue(r)}`),i&&l.push(`🏁 *Fin práctica:* ${ue(i)}`),c&&(l.push(""),l.push("🎯 *Sobre la práctica:*"),l.push(c)),l.push(""),l.push("🔗 Inscribite en tu panel: *pps.psico.uflo.edu.ar*"),l.join(`
`)}function Xt(t,e){const o=t[le],n=t[Ye],r=[];return r.push(`⏳ *¡Últimos lugares en PPS${o?`: ${o}`:""}!*`),r.push(""),r.push(e.length===1?"Todavía queda lugar sin cubrir en esta franja:":"Todavía quedan cupos sin cubrir en estas franjas:"),e.forEach(i=>{const s=i.libres??0;r.push(`• *${i.label}* — ${s} lugar${s!==1?"es":""} libre${s!==1?"s":""}`)}),r.push(""),n&&r.push(`📅 *Inscripción hasta:* ${ue(n)}`),r.join(`
`)}function eo(t){return ca[t].collapsedByDefault}function ao(){return new Set(Ma.filter(eo))}function to(t){return t.items.length>0}function oo(t){return t.stopPropagation()}function ro(t){return t.trim()}function no(t){return a.jsx("span",{className:"lv4-orient-chip",children:t},t)}function so(t,e){return a.jsxs("button",{className:"lv4-btn",onClick:t.onClick,children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:t.icon}),t.label]},e)}function io(t){return t.toLowerCase()}function lo(t){return t.stopPropagation()}const co=({launch:t,onPublish:e,onRefresh:o})=>{const[n,r]=L.useState(!1),[i,s]=L.useState(!1),[c,f]=L.useState(!1),[u,l]=L.useState(!1),[h,g]=L.useState(!1),x=pa(),A=t[le],m=t[Me],S=t[Re],j=t[$e],y=t[ta],_=t[La],I=t[Ye],F=t[da],w=t[Pe],P=t[ga]||Wa(t),B=[{label:"Nombre PPS",value:A,icon:"label",required:!0},{label:"Orientación",value:m,icon:"school",required:!0},{label:"Cupos disponibles",value:S!==null?String(S):null,icon:"group",required:!0},{label:"Fecha inicio PPS",value:j?ue(j):null,icon:"event",required:!0},{label:"Fecha fin PPS",value:y?ue(y):null,icon:"event_available",required:!0},{label:"Inicio inscripción",value:_?ue(_):null,icon:"calendar_today"},{label:"Cierre inscripción",value:I?ue(I):null,icon:"calendar_month"},{label:"Horario",value:w,icon:"schedule"},{label:"Descripción",value:F?"Definida":null,icon:"description"}],M=[A,m,S,j,y].filter(Boolean).length,D=Math.round(M/5*100),z=D>=80,q=async(b,k)=>{s(!0);try{b&&(await pe.lanzamientos.update(b,k),await x.invalidateQueries({queryKey:["launchHistory"]}),f(!0),setTimeout(()=>f(!1),2500))}catch(v){ve.error(v)}finally{s(!1),r(!1),o()}},d=async()=>{try{await navigator.clipboard.writeText(P),g(!0),setTimeout(()=>g(!1),1800)}catch(b){ve.error(b)}};return a.jsxs("div",{children:[a.jsx(Xe,{launch:t,uiState:"borrador",primaryAction:{label:"Lanzar ahora",icon:"rocket_launch",onClick:e,disabled:!z},secondaryActions:[{label:c?"¡Guardado!":"Editar datos",icon:"edit",onClick:()=>r(!0)}]}),a.jsxs("div",{className:"lv4-canvas-body",children:[a.jsxs("div",{className:"lv4-banner",style:{borderColor:z?"var(--ok)":"var(--rule-3)",background:z?"var(--ok-s)":"var(--paper-2)"},children:[a.jsx("span",{className:"material-icons",style:{fontSize:20,color:z?"var(--ok)":"var(--ink-4)",marginTop:1},children:z?"check_circle":"edit_note"}),a.jsxs("div",{style:{flex:1},children:[a.jsx("div",{style:{fontWeight:600,fontSize:13,color:z?"var(--ok)":"var(--ink-2)",marginBottom:6},children:z?"Listo para lanzar":"Borrador en preparación"}),a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10},children:[a.jsx("div",{className:"lv4-progress-track",children:a.jsx("div",{className:"lv4-progress-fill",style:{width:`${D}%`,background:z?"var(--ok)":"var(--accent)"}})}),a.jsxs("span",{style:{fontSize:11,fontFamily:"monospace",color:"var(--ink-3)",fontWeight:600,flexShrink:0},children:[D,"%"]})]}),!z&&a.jsxs("div",{style:{fontSize:12,color:"var(--ink-3)",marginTop:6},children:["Faltan:"," ",B.filter(b=>b.required&&!b.value).map(b=>b.label).join(", ")]})]}),a.jsxs("button",{className:"lv4-btn",onClick:()=>r(!0),style:{flexShrink:0},children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"edit"}),"Editar"]})]}),a.jsx("div",{className:"lv4-eyebrow",style:{marginBottom:10},children:"Datos del borrador"}),a.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:10,marginBottom:28},children:B.map(b=>a.jsxs("div",{className:"lv4-field-card",style:{borderColor:!b.value&&b.required?"var(--warn)":"var(--rule-2)"},children:[a.jsxs("div",{className:"lv4-field-label",children:[a.jsx("span",{className:"material-icons",style:{fontSize:12},children:b.icon}),b.label]}),a.jsx("div",{className:"lv4-field-val",style:{color:b.value?"var(--ink-2)":"var(--ink-4)",fontStyle:b.value?"normal":"italic"},children:b.value||(b.required?a.jsx("span",{style:{color:"var(--warn)",fontStyle:"normal",fontWeight:600,fontSize:12},children:"⚠ Sin completar"}):"—")})]},b.label))}),a.jsxs("div",{style:{marginBottom:28},children:[a.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10},children:[a.jsxs("div",{children:[a.jsx("div",{className:"lv4-eyebrow",children:"Difusión"}),a.jsx("div",{className:"lv4-section-title",style:{marginBottom:0},children:"Mensaje WhatsApp"})]}),a.jsxs("div",{style:{display:"flex",gap:8},children:[a.jsxs("button",{className:"lv4-btn",onClick:()=>l(b=>!b),children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:u?"visibility_off":"visibility"}),u?"Ocultar":"Ver"]}),u&&a.jsxs("button",{className:"lv4-btn",onClick:d,children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"content_copy"}),h?"¡Copiado!":"Copiar"]})]})]}),u&&a.jsx("div",{className:"lv4-wa-bubble",children:P}),!u&&a.jsxs("div",{style:{padding:"12px 16px",borderRadius:10,border:"1px solid var(--rule-2)",background:"var(--paper-2)",fontSize:13,color:"var(--ink-3)",display:"flex",alignItems:"center",gap:8},children:[a.jsx("span",{className:"material-icons",style:{fontSize:18,color:"#25D366"},children:"chat"}),"Generá el mensaje WhatsApp listo para compartir con los estudiantes."]})]})]}),a.jsx($a,{isOpen:n,onClose:()=>r(!1),record:t,tableConfig:qa,onSave:q,isSaving:i})]})};function ua(t){const e=ce.c(7);let o;e[0]!==t?(o=De.roster(t),e[0]=t,e[1]=o):o=e[1];let n;e[2]!==t?(n=async()=>{const{data:i}=await fe.from("convocatorias").select("id, estado_inscripcion, estudiante_id, horario_asignado, horario_seleccionado, selected_at, baja_automatica_at, reminder_sent_at, created_at").eq("lanzamiento_id",t).order("created_at",{ascending:!1});return i||[]},e[2]=t,e[3]=n):n=e[3];let r;return e[4]!==o||e[5]!==n?(r={queryKey:o,queryFn:n},e[4]=o,e[5]=n,e[6]=r):r=e[6],Ne(r)}function Ha(t){const e=ce.c(7);let o;e[0]!==t?(o=De.practicas(t),e[0]=t,e[1]=o):o=e[1];let n;e[2]!==t?(n=async()=>{const{data:i}=await fe.from("practicas").select("id, estado, horas_realizadas").eq("lanzamiento_id",t);return i||[]},e[2]=t,e[3]=n):n=e[3];let r;return e[4]!==o||e[5]!==n?(r={queryKey:o,queryFn:n},e[4]=o,e[5]=n,e[6]=r):r=e[6],Ne(r)}function po(t){const{horarioStr:e,horariosFijos:o,cupos:n,roster:r}=t;if(o)return[];const i=rt(e);if(i.length===0)return[];const s=n?Math.max(1,Math.round(n/i.length)):null;return i.map(c=>{const f=wa(c),u=r.filter(j=>{const y=j.horario_asignado||j.horario_seleccionado;return y&&wa(y)===f}),l=u.length,h=u.filter(j=>oe(j.estado_inscripcion)==="seleccionado").length,g=s?l/s:0,x=s&&l===0?"low":g>=1?"full":g>=.5?"ok":"low",A=s!=null?Math.max(0,s-l):null,m=s!=null?Math.max(0,s-h):null,S=s==null?"indef":h>s?"excedido":h===s?"completo":"falta";return{label:c,count:l,seleccionados:h,cuposLocal:s,pct:g,status:x,libres:A,faltanSeleccion:m,selStatus:S}})}const mo=t=>{const e=ce.c(94),{launch:o,onCerrarInscripcion:n}=t,r=o[Re],i=o[Ye],{openEdit:s,modal:c}=ma(o),{data:f}=ua(o.id);let u;e[0]!==f?(u=f===void 0?[]:f,e[0]=f,e[1]=u):u=e[1];const l=u,h=l.length,g=o[Pe],x=!!o[ba];let A;e[2]!==r||e[3]!==g||e[4]!==x||e[5]!==l?(A=po({horarioStr:g,horariosFijos:x,cupos:r,roster:l}),e[2]=r,e[3]=g,e[4]=x,e[5]=l,e[6]=A):A=e[6];const m=A;let S;e[7]!==m?(S=m.filter(uo),e[7]=m,e[8]=S):S=e[8];const j=S;let y;e[9]!==o?(y=o[ga]||Wa(o),e[9]=o,e[10]=y):y=e[10];const _=y;let I;e[11]!==j||e[12]!==o?(I=Xt(o,j),e[11]=j,e[12]=o,e[13]=I):I=e[13];const F=I,[w,P]=L.useState(null);let B;e[14]===Symbol.for("react.memo_cache_sentinel")?(B=async(Fe,Be)=>{try{await navigator.clipboard.writeText(Fe),P(Be),setTimeout(()=>P(Z=>Z===Be?null:Z),1800)}catch(Z){const ge=Z;ve.error(ge)}},e[14]=B):B=e[14];const M=B;let O;e[15]!==n?(O={label:"Cerrar inscripción",icon:"lock",onClick:n},e[15]=n,e[16]=O):O=e[16];let D;e[17]!==s?(D=[{label:"Editar datos",icon:"edit",onClick:s}],e[17]=s,e[18]=D):D=e[18];let z;e[19]!==o||e[20]!==O||e[21]!==D?(z=a.jsx(Xe,{launch:o,uiState:"seleccion",primaryAction:O,secondaryActions:D}),e[19]=o,e[20]=O,e[21]=D,e[22]=z):z=e[22];let q;e[23]===Symbol.for("react.memo_cache_sentinel")?(q={marginBottom:20},e[23]=q):q=e[23];let d;e[24]!==h?(d=a.jsx(de,{label:"Inscriptos",value:h,hint:"postulados",tone:"accent"}),e[24]=h,e[25]=d):d=e[25];const b=r??"—";let k;e[26]!==b?(k=a.jsx(de,{label:"Cupos",value:b,hint:"disponibles"}),e[26]=b,e[27]=k):k=e[27];let v;e[28]!==r||e[29]!==h?(v=r?`${Math.round(h/r*100)}%`:"—",e[28]=r,e[29]=h,e[30]=v):v=e[30];let N;e[31]!==v?(N=a.jsx(de,{label:"Ocupación",value:v,hint:"del total de cupos",size:"md"}),e[31]=v,e[32]=N):N=e[32];let p;e[33]!==i?(p=i?ue(i):"—",e[33]=i,e[34]=p):p=e[34];let E;e[35]!==p?(E=a.jsx(de,{label:"Cierre inscripción",value:p,hint:"fecha límite",size:"sm"}),e[35]=p,e[36]=E):E=e[36];let T;e[37]!==d||e[38]!==k||e[39]!==N||e[40]!==E?(T=a.jsxs(oa,{style:q,children:[d,k,N,E]}),e[37]=d,e[38]=k,e[39]=N,e[40]=E,e[41]=T):T=e[41];let $;e[42]!==m?($=m.length>0&&a.jsxs("div",{style:{marginTop:28},children:[a.jsx("div",{className:"lv4-eyebrow",children:"Lo importante hoy"}),a.jsx("div",{className:"lv4-section-title",children:"Salud por franja horaria"}),a.jsxs("p",{style:{fontSize:12,color:"var(--ink-4)",margin:"-6px 0 14px",maxWidth:640,lineHeight:1.5},children:["Los cupos por franja son ",a.jsx("b",{children:"estimados"})," (total ÷ nº de franjas); el sistema no define un cupo por franja. Usalos como referencia, no como número exacto."]}),a.jsx("div",{className:"lv4-horario-grid",children:m.map(vo)})]}),e[42]=m,e[43]=$):$=e[43];let G,H,C;e[44]===Symbol.for("react.memo_cache_sentinel")?(G={marginTop:28},H=a.jsx("div",{className:"lv4-eyebrow",children:"Difusión"}),C=a.jsx("div",{className:"lv4-section-title",children:"Compartir la convocatoria"}),e[44]=G,e[45]=H,e[46]=C):(G=e[44],H=e[45],C=e[46]);const Y=j.length>0?"1fr 1fr":"1fr";let R;e[47]!==Y?(R={display:"grid",gridTemplateColumns:Y,gap:12},e[47]=Y,e[48]=R):R=e[48];let U;e[49]===Symbol.for("react.memo_cache_sentinel")?(U={display:"flex",alignItems:"center",gap:6},e[49]=U):U=e[49];let Q;e[50]===Symbol.for("react.memo_cache_sentinel")?(Q=a.jsxs("span",{className:"lv4-stat-label",style:U,children:[a.jsx("span",{className:"material-icons",style:{fontSize:14,color:"#25D366"},children:"chat"}),"Mensaje de convocatoria"]}),e[50]=Q):Q=e[50];let W;e[51]===Symbol.for("react.memo_cache_sentinel")?(W={maxHeight:48,overflow:"hidden"},e[51]=W):W=e[51];let ne;e[52]!==_?(ne=_.split(`
`),e[52]=_,e[53]=ne):ne=e[53];let V;e[54]!==ne[0]?(V=a.jsxs("div",{className:"lv4-link-url",style:W,children:[ne[0],"…"]}),e[54]=ne[0],e[55]=V):V=e[55];let J;e[56]===Symbol.for("react.memo_cache_sentinel")?(J={width:"100%",justifyContent:"center"},e[56]=J):J=e[56];let se;e[57]!==_?(se=()=>M(_,"wa"),e[57]=_,e[58]=se):se=e[58];let te;e[59]===Symbol.for("react.memo_cache_sentinel")?(te={fontSize:14},e[59]=te):te=e[59];const re=w==="wa"?"check":"content_copy";let X;e[60]!==re?(X=a.jsx("span",{className:"material-icons",style:te,children:re}),e[60]=re,e[61]=X):X=e[61];const ee=w==="wa"?"¡Copiado!":"Copiar mensaje";let ae;e[62]!==se||e[63]!==X||e[64]!==ee?(ae=a.jsxs("button",{className:"lv4-btn",style:J,onClick:se,children:[X,ee]}),e[62]=se,e[63]=X,e[64]=ee,e[65]=ae):ae=e[65];let me;e[66]!==V||e[67]!==ae?(me=a.jsxs("div",{className:"lv4-linkbox",children:[Q,V,ae]}),e[66]=V,e[67]=ae,e[68]=me):me=e[68];let he;e[69]!==w||e[70]!==j||e[71]!==F?(he=j.length>0&&a.jsxs("div",{className:"lv4-linkbox",style:{borderColor:"var(--warn)"},children:[a.jsxs("span",{className:"lv4-stat-label",style:{display:"flex",alignItems:"center",gap:6},children:[a.jsx("span",{className:"material-icons",style:{fontSize:14,color:"var(--warn)"},children:"campaign"}),"Avisar cupos libres"]}),a.jsxs("div",{style:{fontSize:11.5,color:"var(--ink-3)",lineHeight:1.5,margin:"2px 0 8px"},children:[j.length===1?"Queda lugar en 1 franja: ":`Quedan lugares en ${j.length} franjas: `,a.jsx("b",{style:{color:"var(--ink)"},children:j.map(fo).join(" · ")})]}),a.jsxs("button",{className:"lv4-btn",style:{width:"100%",justifyContent:"center"},onClick:()=>M(F,"franjas"),children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:w==="franjas"?"check":"content_copy"}),w==="franjas"?"¡Copiado!":"Copiar aviso"]})]}),e[69]=w,e[70]=j,e[71]=F,e[72]=he):he=e[72];let ke;e[73]!==R||e[74]!==me||e[75]!==he?(ke=a.jsxs("div",{style:G,children:[H,C,a.jsxs("div",{style:R,children:[me,he]})]}),e[73]=R,e[74]=me,e[75]=he,e[76]=ke):ke=e[76];let _e,Ce,ze,je;e[77]===Symbol.for("react.memo_cache_sentinel")?(_e={marginTop:32,scrollMarginTop:80},Ce=a.jsx("div",{className:"lv4-eyebrow",children:"Mesa de selección"}),ze=a.jsx("div",{className:"lv4-section-title",children:"Elegí los estudiantes"}),je={fontSize:12.5,color:"var(--ink-3)",margin:"0 0 14px",maxWidth:640,lineHeight:1.5},e[77]=_e,e[78]=Ce,e[79]=ze,e[80]=je):(_e=e[77],Ce=e[78],ze=e[79],je=e[80]);let Ae;e[81]===Symbol.for("react.memo_cache_sentinel")?(Ae=a.jsxs("div",{style:je,children:["Marcá los estudiantes que van a cursar la PPS. Podés hacerlo ahora y revisar antes de cerrar la inscripción. Cuando termines, usá ",a.jsx("b",{children:"Cerrar inscripción"})," arriba para confirmar y enviar los consentimientos."]}),e[81]=Ae):Ae=e[81];let Se;e[82]===Symbol.for("react.memo_cache_sentinel")?(Se=a.jsx(Je,{}),e[82]=Se):Se=e[82];let xe;e[83]!==o.id?(xe=a.jsxs("div",{id:"mesa-seleccion",style:_e,children:[Ce,ze,Ae,a.jsx(L.Suspense,{fallback:Se,children:a.jsx(ka,{isTestingMode:!1,preSelectedLaunchId:o.id})})]}),e[83]=o.id,e[84]=xe):xe=e[84];let be;e[85]!==T||e[86]!==$||e[87]!==ke||e[88]!==xe?(be=a.jsxs("div",{className:"lv4-canvas-body",children:[T,$,ke,xe]}),e[85]=T,e[86]=$,e[87]=ke,e[88]=xe,e[89]=be):be=e[89];let we;return e[90]!==c||e[91]!==z||e[92]!==be?(we=a.jsxs("div",{children:[z,c,be]}),e[90]=c,e[91]=z,e[92]=be,e[93]=we):we=e[93],we};function uo(t){return t.libres!=null&&t.libres>0}function vo(t,e){const o=t.status==="low"?"var(--warn)":t.status==="full"?"var(--ok)":"var(--accent)",n=t.selStatus==="completo"?"var(--ok)":t.selStatus==="excedido"?"var(--danger, #c0392b)":"var(--warn)",r=t.selStatus==="completo"?"Completo":t.selStatus==="excedido"?`${t.seleccionados-(t.cuposLocal??0)} de más`:t.cuposLocal!=null?`Faltan ~${t.faltanSeleccion}`:`${t.seleccionados} elegidos`,i=t.selStatus==="completo"?"check_circle":t.selStatus==="excedido"?"error":"radio_button_unchecked";return a.jsxs("div",{className:`lv4-horario-card${t.status==="low"?" low":""}`,children:[a.jsxs("div",{className:"lv4-horario-head",children:[a.jsx("span",{className:"lv4-horario-label",children:t.label}),t.status==="low"&&a.jsx("span",{className:"material-icons",style:{fontSize:18,color:"var(--warn)"},children:"warning"})]}),a.jsxs("div",{style:{display:"flex",alignItems:"baseline",gap:8,marginBottom:8},children:[a.jsx("span",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:24,fontWeight:400,color:o,lineHeight:1},children:t.count}),t.cuposLocal&&a.jsxs("span",{style:{fontSize:12,color:"var(--ink-4)"},children:[t.count===1?"inscripto":"inscriptos"," · ~",t.cuposLocal," cupos est."]})]}),a.jsx("div",{className:"lv4-horario-track",children:a.jsx("div",{className:"lv4-horario-fill",style:{width:`${Math.min(100,t.pct*100)}%`,background:o}})}),t.cuposLocal!=null&&a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,marginTop:10,fontSize:12,color:n,fontWeight:600},children:[a.jsx("span",{className:"material-icons",style:{fontSize:15},children:i}),a.jsxs("span",{children:[r,a.jsxs("span",{style:{color:"var(--ink-4)",fontWeight:400},children:[" ","— ",t.seleccionados,"/",t.cuposLocal," seleccionados"]})]})]}),t.status==="low"&&a.jsx("div",{className:"lv4-horario-foot",children:"Probablemente quede vacía si no se difunde con foco en este día."})]},e)}function fo(t){return`${t.label.split(" de ")[0]} (${t.libres})`}const ho=t=>{const e=ce.c(39),{launch:o,showModal:n}=t,r=o[Re],{openEdit:i,modal:s}=ma(o),{data:c}=ua(o.id);let f;e[0]!==c?(f=c===void 0?[]:c,e[0]=c,e[1]=f):f=e[1];const u=f,l=u.length;let h;e[2]!==u?(h=u.filter(xo),e[2]=u,e[3]=h):h=e[3];const g=h.length;let x;e[4]!==i?(x=[{label:"Editar datos",icon:"edit",onClick:i}],e[4]=i,e[5]=x):x=e[5];let A;e[6]!==o||e[7]!==x?(A=a.jsx(Xe,{launch:o,uiState:"seguro",secondaryActions:x}),e[6]=o,e[7]=x,e[8]=A):A=e[8];let m;e[9]!==l?(m=a.jsx(de,{label:"Candidatos",value:l,hint:"inscriptos",tone:"warn"}),e[9]=l,e[10]=m):m=e[10];const S=r??"—";let j;e[11]!==S?(j=a.jsx(de,{label:"Cupos",value:S,hint:"disponibles"}),e[11]=S,e[12]=j):j=e[12];const y=g>0?"ok":"muted";let _;e[13]!==g||e[14]!==y?(_=a.jsx(de,{label:"Seleccionados",value:g,hint:"hasta ahora",tone:y}),e[13]=g,e[14]=y,e[15]=_):_=e[15];let I;e[16]!==_||e[17]!==m||e[18]!==j?(I=a.jsxs(oa,{children:[m,j,_]}),e[16]=_,e[17]=m,e[18]=j,e[19]=I):I=e[19];const F=r??"?";let w;e[20]!==F||e[21]!==l?(w=a.jsxs(Oe,{tone:"warn",icon:"how_to_reg",title:"Mesa de selección abierta",children:["Seleccioná los estudiantes y confirmá para enviar las notificaciones. Son ",l," ","candidatos para ",F," cupos."]}),e[20]=F,e[21]=l,e[22]=w):w=e[22];let P;e[23]===Symbol.for("react.memo_cache_sentinel")?(P=a.jsx(Je,{}),e[23]=P):P=e[23];let B;e[24]!==o.id?(B=a.jsx(L.Suspense,{fallback:P,children:a.jsx(ka,{isTestingMode:!1,preSelectedLaunchId:o.id})}),e[24]=o.id,e[25]=B):B=e[25];let M;e[26]!==o.id||e[27]!==g||e[28]!==n?(M=g>0&&a.jsxs(a.Fragment,{children:[a.jsx("div",{className:"lv4-eyebrow",style:{marginBottom:8},children:"Seguros y actas"}),a.jsx(L.Suspense,{fallback:a.jsx(Je,{}),children:a.jsx(Yt,{showModal:n,isTestingMode:!1,preSelectedLanzamientoId:o.id})})]}),e[26]=o.id,e[27]=g,e[28]=n,e[29]=M):M=e[29];let O;e[30]!==I||e[31]!==w||e[32]!==B||e[33]!==M?(O=a.jsxs("div",{className:"lv4-canvas-body",children:[I,w,B,M]}),e[30]=I,e[31]=w,e[32]=B,e[33]=M,e[34]=O):O=e[34];let D;return e[35]!==s||e[36]!==O||e[37]!==A?(D=a.jsxs("div",{children:[A,s,O]}),e[35]=s,e[36]=O,e[37]=A,e[38]=D):D=e[38],D};function xo(t){return oe(t.estado_inscripcion)==="seleccionado"}const ea={TERMINO_CURSAR:100,CURSANDO_ELECTIVAS:50,BASE_FINALES:30,PER_HOUR:.5,TRABAJA:20},bo=(t,e,o,n)=>{let r=0;const i=t[Da]==="Sí",s=t[Oa]==="Sí";i?r=ea.TERMINO_CURSAR:s?r=ea.CURSANDO_ELECTIVAS:r=ea.BASE_FINALES;const c=e*ea.PER_HOUR,f=n?ea.TRABAJA:0,u=o;return Math.round(r+c+f-u)},go=(t=!1,e,o)=>{const n=e,[r,i]=L.useState(null),[s,c]=L.useState("selection"),[f,u]=L.useState(null),[l,h]=L.useState(null),g=pa(),{data:x=[],isLoading:A}=Ne({queryKey:["openLaunchesForSelector",t,e],queryFn:async()=>{let d=[];return t?d=await Ie.getAll("lanzamientos_pps"):d=await pe.lanzamientos.getAll(),d.map(b=>{const k={...b};return k[le]=ct(b[le]),k}).filter(b=>{const k=oe(b[ye]);return e?b.id===e?!0:k==="abierta"||k==="abierto"||k==="cerrado"||k==="cerrada":k==="abierta"||k==="abierto"})}});L.useEffect(()=>{if(e&&x.length>0&&!r){const d=x.find(b=>b.id===e);d&&i(d)}},[e,x,r]),L.useEffect(()=>{if(n&&x.length>0&&!r){const d=x.find(b=>b.id===n);d&&(i(d),c("selection"),ve.info("[useSeleccionadorLogic] Auto-selected launch for full management:",d.id))}},[n,x,r]),L.useEffect(()=>{if(e&&x.length>0){const d=x.find(b=>b.id===e);d&&(!r||r.id!==d.id)&&i(d)}},[e,x]);const m=["candidatesForLaunch",r?.id,t],{data:S=[],isLoading:j,refetch:y}=Ne({queryKey:m,queryFn:async()=>{if(!r)return[];const d=r.id;let b=[];t?b=await Ie.getAll("convocatorias"):b=await pe.convocatorias.getAll();const k=b.filter(C=>C[la]===d);if(k.length===0)return[];const v=k.map(C=>C[Qe]).filter(Boolean);let N=[],p=[],E=[],T=[];if(t)[N,p,E]=await Promise.all([Ie.getAll("estudiantes",{id:v}),Ie.getAll("practicas",{[fa]:v}),Ie.getAll("penalizaciones",{[ha]:v})]);else{const[C,Y,R,U]=await Promise.all([pe.estudiantes.getAll({filters:{id:v}}),pe.practicas.getAll({filters:{[fa]:v}}),pe.penalizaciones.getAll({filters:{[ha]:v}}),fe.from("compromisos_pps").select("convocatoria_id, estado, accepted_at").eq("lanzamiento_id",d)]);N=C,p=Y,E=R,T=U.data||[]}const $=new Map(N.map(C=>[C.id,C])),G=new Map((T||[]).filter(C=>!!C.convocatoria_id).map(C=>[C.convocatoria_id,C]));return k.map(C=>{const Y=C[Qe],R=Y?$.get(Y):null;if(!R)return null;const U=p.filter(ee=>ee[fa]===Y),Q=U.reduce((ee,ae)=>ee+(ae[dt]||0),0),W=U.length,V=E.filter(ee=>ee[ha]===Y).reduce((ee,ae)=>ee+(ae[pt]||0),0),J=!!C[mt]||!!R[ut],se=C[vt]||R[ft],te=C[ht],re=bo(C,Q,V,J),X=G.get(C.id);return{enrollmentId:C.id,studentId:Y,userId:R[Ca],nombre:R[Ia]||"Desconocido",legajo:String(R[yt]||""),correo:R[Ea]||"",telefono:R[gt]||"",status:C[aa]||"Inscripto",terminoCursar:C[Da]==="Sí",cursandoElectivas:C[Oa]==="Sí",finalesAdeuda:C[bt]||"",notasEstudiante:C[xt]||"",horarioSeleccionado:C[Aa]||"",horarioAsignado:C[ia]!==void 0&&C[ia]!==null?String(C[ia]):null,totalHoras:Q,cantPracticas:W,penalizacionAcumulada:V,puntajeTotal:re,trabaja:J,certificadoTrabajo:se,cvUrl:te,compromisoEstado:X?.estado||null,compromisoFecha:X?.accepted_at||null}}).filter(C=>C!==null).sort((C,Y)=>Y.puntajeTotal-C.puntajeTotal)},enabled:!!r}),_=L.useMemo(()=>S.filter(d=>oe(d.status)==="seleccionado"),[S]),I=L.useMemo(()=>s==="review"?_:S,[S,_,s]),F=Ze({mutationFn:async d=>{if(!r)return;const b=oe(d.status)==="seleccionado";if(t){await new Promise(N=>setTimeout(N,300));const v=b?"Inscripto":"Seleccionado";return await Ie.update("convocatorias",d.enrollmentId,{[aa]:v}),{success:!0,student:d}}return{...await nt(d.enrollmentId,!b,d.studentId,r,d.horarioAsignado||d.horarioSeleccionado),student:d}},onMutate:async d=>{await g.cancelQueries({queryKey:m});const b=g.getQueryData(m);return g.setQueryData(m,k=>k?k.map(v=>{if(v.enrollmentId===d.enrollmentId){const N=oe(v.status)==="seleccionado"?"Inscripto":"Seleccionado";return{...v,status:N}}return v}):[]),{previousCandidates:b}},onSuccess:(d,b,k)=>{d?.success||(u({message:`Error: ${d?.error}`,type:"error"}),k?.previousCandidates&&g.setQueryData(m,k.previousCandidates)),g.invalidateQueries({queryKey:m}),xa(g)},onError:(d,b,k)=>{u({message:`Error: ${d.message}`,type:"error"}),k?.previousCandidates&&g.setQueryData(m,k.previousCandidates)},onSettled:()=>h(null)}),w=Ze({mutationFn:async({id:d,schedule:b,student:k,isSelected:v})=>{const N={[ia]:b};return!t&&v&&r&&await st(k.studentId,r.id,b),t?Ie.update("convocatorias",d,N):pe.convocatorias.update(d,N)},onSuccess:()=>{u({message:"Horario actualizado.",type:"success"}),y().then(()=>{g.invalidateQueries()})},onError:d=>{u({message:`Error: ${d.message}`,type:"error"})}}),P=d=>{h(d.enrollmentId),F.mutate(d)},B=(d,b)=>{w.mutate({id:d.enrollmentId,schedule:b,isEditMode:q,student:d,isSelected:oe(d.status)==="seleccionado"})},{data:M=[],isLoading:O}=Ne({queryKey:["availableStudents",r?.id,t],queryFn:async()=>{if(!r)return[];let d=[];t?d=await Ie.getAll("estudiantes"):d=await pe.estudiantes.getAll();const b=new Set(S.map(k=>k.studentId));return d.filter(k=>!b.has(k.id))},enabled:!!r&&S.length>0}),D=Ze({mutationFn:async d=>{if(r)if(t)await Ie.create("convocatorias",{[la]:r.id,[Qe]:d,[aa]:"seleccionado"});else{const b=await pe.estudiantes.get({filters:{id:d}});if(b&&b.length>0){const k=b[0];if(oe(k[lt])!=="activo")throw new Error("El estudiante no está activo. No se puede inscribir.");if(!k[Na]||String(k[Na]).trim()==="")throw new Error("El estudiante no tiene DNI cargado. Complete los datos del estudiante primero.")}await pe.convocatorias.create({[la]:r.id,[Qe]:d,[aa]:"seleccionado"})}},onSuccess:()=>{g.invalidateQueries({queryKey:m}),g.invalidateQueries({queryKey:["availableStudents"]}),xa(g),u({message:"Estudiante inscripto correctamente",type:"success"})},onError:d=>{u({message:it(d,"Error al inscribir estudiante"),type:"error"})}}),z=L.useMemo(()=>{if(!r)return{showScheduleSelector:!1,horariosFijos:!1,singleSchedule:!1};const d=!!r[ba],b=r[Pe];if(d)return{showScheduleSelector:!1,horariosFijos:!0,singleSchedule:!1};const k=b?String(b).split(";").filter(N=>N.trim()):[],v=k.length===1;return{showScheduleSelector:!v,horariosFijos:!1,singleSchedule:v,horariosDisponibles:k}},[r]),q=L.useMemo(()=>r?oe(r[ye])==="cerrado":!1,[r]);return{selectedLanzamiento:r,setSelectedLanzamiento:i,viewMode:s,setViewMode:c,toastInfo:f,setToastInfo:u,updatingId:l,openLaunches:x,isLoadingLaunches:A,candidates:S,isLoadingCandidates:j,selectedCandidates:_,displayedCandidates:I,scheduleInfo:z,isEditMode:q,handleToggle:P,handleUpdateSchedule:B,availableStudents:M,isLoadingAvailable:O,enrollNewStudent:D.mutate}},yo=({launch:t,onArchivar:e})=>{const{openEdit:o,modal:n}=ma(t),r=t[$e],i=t[ta],{data:s=[]}=Ha(t.id),c=s.reduce((p,E)=>p+(E.horas_realizadas||0),0),f=s.filter(p=>oe(p.estado)==="activa"||oe(p.estado)==="en curso").length,u=s.filter(p=>oe(p.estado)==="finalizada").length,{candidates:l,selectedCandidates:h,availableStudents:g,enrollNewStudent:x,handleToggle:A,isLoadingCandidates:m,toastInfo:S,setToastInfo:j}=go(!1,t.id),[y,_]=L.useState(null),[I,F]=L.useState("Ausencia en Inicio / No se presentó"),[w,P]=L.useState(""),[B,M]=L.useState(!1),[O,D]=L.useState(!1),[z,q]=L.useState(""),d=L.useMemo(()=>l.filter(p=>oe(p.status)==="inscripto"),[l]),b=L.useMemo(()=>{if(!z.trim())return[];const p=z.toLowerCase();return g.filter(E=>E.nombre?.toLowerCase().includes(p)||String(E.legajo||"").toLowerCase().includes(p)).slice(0,5)},[g,z]),k=p=>({"Ausencia en Inicio / No se presentó":50,"Baja Anticipada":30,"Abandono durante la PPS":70,"Falta sin Aviso":40,"Baja Administrativa / Sin Penalización":0})[p]||0,v=async()=>{if(y){M(!0);try{await A(y);const p=k(I),E={estudiante_id:y.studentId,tipo_incumplimiento:I,fecha_incidente:new Date().toISOString().split("T")[0],notas:w.trim()||null,puntaje_penalizacion:p,convocatoria_afectada:t[le]||"PPS"},{error:T}=await fe.from("penalizaciones").insert([E]);if(T)throw T;j({message:"Estudiante dado de baja y penalización registrada.",type:"success"}),_(null),P("")}catch(p){console.error("Error al procesar la baja:",p),j({message:"Error al registrar la baja del estudiante.",type:"error"})}finally{M(!1)}}},N=p=>p.split(" ").map(E=>E[0]).join("").toUpperCase().slice(0,2);return a.jsxs("div",{children:[a.jsx(Xe,{launch:t,uiState:"activa",primaryAction:{label:"Archivar convocatoria",icon:"archive",onClick:e},secondaryActions:[{label:"Editar datos",icon:"edit",onClick:o}]}),n,S&&a.jsx(kt,{message:S.message,type:S.type,onClose:()=>j(null)}),a.jsxs("div",{className:"lv4-canvas-body",children:[a.jsxs(oa,{style:{marginBottom:28},children:[a.jsx(de,{label:"Prácticas activas",value:f,hint:"en curso",tone:"ok"}),a.jsx(de,{label:"Finalizadas",value:u,hint:"completadas"}),a.jsx(de,{label:"Horas totales",value:c,hint:"realizadas"}),a.jsx(de,{label:"Período",value:r?ue(r):"—",hint:i?`hasta ${ue(i)}`:"sin fecha fin",size:"sm"})]}),m?a.jsx(Je,{}):a.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-12 gap-8 items-start",children:[a.jsxs("div",{className:"lg:col-span-7 space-y-4",children:[a.jsxs("div",{className:"flex items-baseline justify-between mb-1",children:[a.jsx("span",{className:"lv4-eyebrow",children:"Alumnos en curso"}),a.jsxs("span",{className:"lv4-badge-ok-strong",style:{fontSize:11,borderRadius:99},children:[h.length," seleccionados"]})]}),h.length===0?a.jsx(Oe,{tone:"neutral",icon:"group",title:"No hay estudiantes en curso",style:{marginBottom:0},children:"Todos los estudiantes seleccionados han sido dados de baja o no hay selecciones en esta convocatoria."}):a.jsx("div",{style:{border:"1px solid var(--rule-2)",borderRadius:12,overflow:"hidden",background:"var(--paper)"},children:h.map((p,E)=>{const T=`Hola ${p.nombre}, te contactamos de la coordinación de PPS de UFLO con respecto a tu práctica en ${t[le]}.`,$=Pa(p.telefono,T);return a.jsxs("div",{className:"lv4-insc-row",style:{gap:12,padding:"12px 16px",borderBottom:E===h.length-1?"none":"1px solid var(--rule-2)"},children:[a.jsx("div",{className:"lv4-avatar",style:{background:"var(--paper-3)",color:"var(--ink)",borderColor:"transparent"},children:N(p.nombre)}),a.jsxs("div",{style:{minWidth:0,flex:1},children:[a.jsx("div",{style:{fontSize:13.5,fontWeight:600,color:"var(--ink)"},children:p.nombre}),a.jsxs("div",{style:{display:"flex",flexWrap:"wrap",gap:10,marginTop:2,fontSize:11.5,color:"var(--ink-3)"},children:[a.jsxs("span",{children:["Legajo: ",p.legajo]}),p.horarioAsignado&&a.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:4},children:[a.jsx("span",{className:"material-icons",style:{fontSize:12},children:"schedule"}),p.horarioAsignado]})]})]}),a.jsxs("div",{style:{display:"flex",gap:6,flexShrink:0},children:[$?a.jsx("a",{className:"lv4-icon-btn",href:$,target:"_blank",rel:"noopener noreferrer",title:"Contactar por WhatsApp",style:{color:"#25D366"},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"chat"})}):a.jsx("span",{className:"lv4-icon-btn",title:"Sin teléfono",style:{color:"var(--ink-4)",cursor:"not-allowed",opacity:.5},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"chat"})}),p.correo?a.jsx("a",{className:"lv4-icon-btn",href:`mailto:${p.correo}`,title:"Enviar Email",style:{color:"var(--ink-3)"},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"mail"})}):a.jsx("span",{className:"lv4-icon-btn",title:"Sin correo",style:{color:"var(--ink-4)",cursor:"not-allowed",opacity:.5},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"mail"})}),a.jsxs("button",{className:"lv4-btn",style:{background:"var(--danger-s, #fde8e8)",color:"var(--warn)",borderColor:"transparent",padding:"4px 8px",fontSize:12,display:"inline-flex",alignItems:"center",gap:4},onClick:()=>{_(p),F("Ausencia en Inicio / No se presentó"),P("")},children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"person_remove"}),"Dar de baja"]})]})]},p.enrollmentId)})})]}),a.jsxs("div",{className:"lg:col-span-5 space-y-4",children:[a.jsx("span",{className:"lv4-eyebrow",children:"Candidatos a reemplazo"}),d.length===0?a.jsx(Oe,{tone:"neutral",icon:"info",title:"Sin candidatos en espera",style:{marginBottom:0},children:"No quedan inscriptos en lista de espera. Podés inscribir y seleccionar un estudiante de reemplazo usando el buscador."}):a.jsx("div",{style:{border:"1px solid var(--rule-2)",borderRadius:12,overflow:"hidden",background:"var(--paper)"},children:d.map((p,E)=>a.jsxs("div",{className:"lv4-insc-row",style:{gap:10,padding:"12px 14px",borderBottom:E===d.length-1?"none":"1px solid var(--rule-2)"},children:[a.jsx("div",{className:"lv4-avatar",style:{background:"var(--paper-2)",color:"var(--ink-3)",borderColor:"transparent"},children:N(p.nombre)}),a.jsxs("div",{style:{minWidth:0,flex:1},children:[a.jsxs("div",{style:{fontSize:13,fontWeight:600,color:"var(--ink)",display:"flex",alignItems:"center",gap:6},children:[a.jsx("span",{className:"truncate",children:p.nombre}),a.jsxs("span",{style:{fontSize:10,fontFamily:"'JetBrains Mono', monospace",padding:"2px 5px",borderRadius:4,background:"var(--paper-3)",color:"var(--accent)",flexShrink:0},children:[p.puntajeTotal," pts"]})]}),a.jsxs("div",{style:{display:"flex",gap:10,marginTop:2,fontSize:11,color:"var(--ink-3)"},children:[a.jsxs("span",{children:["Legajo: ",p.legajo]}),p.horarioSeleccionado&&a.jsxs("span",{className:"truncate",children:["Pref: ",p.horarioSeleccionado]})]})]}),a.jsx("button",{className:"lv4-btn",style:{padding:"4px 8px",fontSize:12,flexShrink:0},onClick:()=>A(p),children:"Seleccionar"})]},p.enrollmentId))}),a.jsxs("div",{style:{marginTop:14},children:[a.jsxs("button",{className:"lv4-group-head",style:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"},onClick:()=>D(p=>!p),children:[a.jsxs("span",{className:"lv4-group-label",style:{display:"flex",alignItems:"center",gap:6},children:[a.jsx("span",{className:"material-icons",style:{fontSize:18,transition:"transform .15s",transform:O?"rotate(0)":"rotate(-90deg)",color:"var(--ink-3)"},children:"expand_more"}),"Buscar otro estudiante activo"]}),a.jsx("span",{className:"lv4-group-count",children:"no postulados"})]}),O&&a.jsxs("div",{style:{marginTop:10,padding:14,border:"1px solid var(--rule-2)",borderRadius:12,background:"var(--paper-2)"},children:[a.jsxs("div",{className:"lv4-search-wrap",style:{marginBottom:10},children:[a.jsx("span",{className:"material-icons lv4-search-icon",style:{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--ink-4)",fontSize:16},children:"search"}),a.jsx("input",{type:"text",className:"lv4-search",style:{width:"100%",paddingLeft:34,fontSize:12.5},placeholder:"Buscar por nombre o legajo...",value:z,onChange:p=>q(p.target.value)})]}),b.length>0?a.jsx("div",{style:{border:"1px solid var(--rule-2)",borderRadius:8,overflow:"hidden",background:"var(--paper)"},children:b.map((p,E)=>a.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderBottom:E===b.length-1?"none":"1px solid var(--rule-2)"},children:[a.jsxs("div",{style:{minWidth:0,flex:1,marginRight:8},children:[a.jsx("div",{style:{fontSize:12.5,fontWeight:600,color:"var(--ink)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:p.nombre}),a.jsxs("div",{style:{fontSize:11,color:"var(--ink-3)",marginTop:1},children:["Legajo: ",p.legajo]})]}),a.jsx("button",{className:"lv4-btn",style:{padding:"4px 8px",fontSize:11.5,flexShrink:0},onClick:()=>{x(p.id),q(""),D(!1)},children:"Seleccionar"})]},p.id))}):z.trim()?a.jsx("div",{style:{textAlign:"center",padding:10,color:"var(--ink-4)",fontSize:12},children:"No se encontraron estudiantes activos."}):null]})]})]})]})]}),y&&a.jsx("div",{className:"lv4-modal-overlay",children:a.jsxs("div",{className:"lv4-modal-shell",style:{maxWidth:"32rem"},children:[a.jsxs("div",{className:"lv4-modal-head",children:[a.jsx("div",{className:"lv4-modal-head-glow-a"}),a.jsx("div",{className:"lv4-modal-head-glow-b"}),a.jsxs("div",{className:"lv4-modal-head-row",children:[a.jsxs("div",{className:"lv4-modal-head-info",children:[a.jsx("div",{className:"lv4-modal-head-icon",style:{background:"var(--warn-s)",color:"var(--warn)"},children:a.jsx("span",{className:"material-icons",children:"gavel"})}),a.jsxs("div",{children:[a.jsx("h4",{className:"lv4-modal-head-title",children:"Dar de baja estudiante"}),a.jsxs("span",{className:"lv4-modal-head-meta",style:{color:"var(--ink-4)"},children:["PPS: ",t[le]]})]})]}),a.jsx("button",{className:"lv4-modal-close",onClick:()=>_(null),children:a.jsx("span",{className:"material-icons",children:"close"})})]})]}),a.jsxs("div",{className:"lv4-modal-body",children:[a.jsxs("p",{style:{fontSize:13,color:"var(--ink-3)",marginBottom:18,lineHeight:1.5},children:["Se removerá a ",a.jsx("b",{children:y.nombre})," (Legajo: ",y.legajo,") de esta práctica activa."]}),a.jsxs("div",{style:{marginBottom:16},children:[a.jsx("label",{className:"lv4-label",style:{display:"block",marginBottom:6,fontWeight:600},children:"Motivo de la baja"}),a.jsxs("select",{className:"lv4-select",style:{width:"100%"},value:I,onChange:p=>F(p.target.value),children:[a.jsx("option",{value:"Ausencia en Inicio / No se presentó",children:"Ausencia en Inicio / No se presentó (50 pts)"}),a.jsx("option",{value:"Baja Anticipada",children:"Baja Anticipada (30 pts)"}),a.jsx("option",{value:"Abandono durante la PPS",children:"Abandono durante la PPS (70 pts)"}),a.jsx("option",{value:"Falta sin Aviso",children:"Falta sin Aviso (40 pts)"}),a.jsx("option",{value:"Baja Administrativa / Sin Penalización",children:"Baja Administrativa / Sin Penalización (0 pts)"})]})]}),a.jsxs("div",{style:{marginBottom:16},children:[a.jsx("label",{className:"lv4-label",style:{display:"block",marginBottom:6,fontWeight:600},children:"Comentarios / Notas del incidente"}),a.jsx("textarea",{className:"lv4-textarea",style:{width:"100%"},placeholder:"Ingresá detalles de la baja si corresponde...",value:w,onChange:p=>P(p.target.value)})]}),k(I)>0&&a.jsxs("div",{style:{padding:"10px 14px",borderRadius:8,background:"var(--warn-s)",border:"1px solid var(--warn)",color:"var(--ink-2)",fontSize:12.5,display:"flex",alignItems:"center",gap:8},children:[a.jsx("span",{className:"material-icons",style:{color:"var(--warn)",fontSize:18},children:"warning"}),a.jsxs("span",{children:["Esta baja restará ",a.jsxs("b",{children:[k(I)," puntos"]})," de la prioridad general del estudiante."]})]})]}),a.jsxs("div",{className:"lv4-modal-foot",style:{display:"flex",justifyContent:"flex-end",gap:10},children:[a.jsx("button",{className:"lv4-btn lv4-btn-ghost",onClick:()=>_(null),disabled:B,children:"Cancelar"}),a.jsx("button",{className:"lv4-btn lv4-btn-danger",onClick:v,disabled:B,children:B?"Procesando...":"Confirmar baja"})]})]})})]})},ko=t=>{const e=ce.c(55),{launch:o,onDuplicar:n,onReabrir:r,onReactivarActiva:i,onReactivarConfirmacion:s}=t,{data:c}=Ha(o.id);let f;e[0]!==c?(f=c===void 0?[]:c,e[0]=c,e[1]=f):f=e[1];const u=f,{data:l}=ua(o.id);let h;e[2]!==l?(h=l===void 0?[]:l,e[2]=l,e[3]=h):h=e[3];const g=h,x=g.length;let A;e[4]!==g?(A=g.filter(jo),e[4]=g,e[5]=A):A=e[5];const m=A.length;let S;e[6]!==u?(S=u.filter(So),e[6]=u,e[7]=S):S=e[7];const j=S.length;let y;e[8]!==j||e[9]!==m?(y=m>0?Math.round(j/m*100):null,e[8]=j,e[9]=m,e[10]=y):y=e[10];const _=y;let I;e[11]!==n?(I={icon:"content_copy",title:"Duplicar como base",desc:"Crea un nuevo borrador con los datos de esta convocatoria.",cta:"Crear borrador",onClick:n,show:!0},e[11]=n,e[12]=I):I=e[12];let F;e[13]!==r?(F={icon:"restart_alt",title:"Reabrir inscripción",desc:"Vuelve a abrir para recibir nuevos postulantes (Paso 2).",cta:"Reabrir",onClick:r,show:!0},e[13]=r,e[14]=F):F=e[14];const w=m>0&&i!=null;let P;e[15]!==i||e[16]!==w?(P={icon:"play_circle",title:"Reactivar PPS (En Curso)",desc:"Pone la PPS en curso (Paso 5) para gestionar alumnos, bajas y reemplazos.",cta:"Reactivar",onClick:i,show:w},e[15]=i,e[16]=w,e[17]=P):P=e[17];const B=m>0&&s!=null;let M;e[18]!==s||e[19]!==B?(M={icon:"pending_actions",title:"Reactivar Sala de Firmas",desc:"Vuelve al paso de firmas digitales y compromisos pendientes (Paso 4).",cta:"Reactivar firmas",onClick:s,show:B},e[18]=s,e[19]=B,e[20]=M):M=e[20];let O;e[21]!==P||e[22]!==M||e[23]!==I||e[24]!==F?(O=[I,F,P,M].filter(wo),e[21]=P,e[22]=M,e[23]=I,e[24]=F,e[25]=O):O=e[25];const D=O;let z;e[26]!==n?(z={label:"Duplicar como base",icon:"content_copy",onClick:n},e[26]=n,e[27]=z):z=e[27];let q;e[28]!==o||e[29]!==z?(q=a.jsx(Xe,{launch:o,uiState:"archivada",primaryAction:z}),e[28]=o,e[29]=z,e[30]=q):q=e[30];let d;e[31]===Symbol.for("react.memo_cache_sentinel")?(d=a.jsx(Oe,{tone:"neutral",icon:"archive",title:"Convocatoria archivada",style:{marginBottom:28},children:"Este ciclo ha concluido. Los datos quedan como referencia histórica."}),e[31]=d):d=e[31];let b;e[32]===Symbol.for("react.memo_cache_sentinel")?(b={marginBottom:28},e[32]=b):b=e[32];let k;e[33]!==x?(k=a.jsx(de,{label:"Inscriptos",value:x,hint:"se postularon"}),e[33]=x,e[34]=k):k=e[34];let v;e[35]!==m?(v=a.jsx(de,{label:"Seleccionados",value:m,hint:"comenzaron"}),e[35]=m,e[36]=v):v=e[36];let N;e[37]!==j?(N=a.jsx(de,{label:"Acreditados",value:j,hint:"finalizaron",tone:"ok"}),e[37]=j,e[38]=N):N=e[38];const p=_!==null?`${_}%`:"—";let E;e[39]!==p?(E=a.jsx(de,{label:"Tasa éxito",value:p,hint:"acred./selecc."}),e[39]=p,e[40]=E):E=e[40];let T;e[41]!==k||e[42]!==v||e[43]!==N||e[44]!==E?(T=a.jsxs(oa,{style:b,children:[k,v,N,E]}),e[41]=k,e[42]=v,e[43]=N,e[44]=E,e[45]=T):T=e[45];let $;e[46]===Symbol.for("react.memo_cache_sentinel")?($={display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:12},e[46]=$):$=e[46];let G;e[47]!==D?(G=a.jsx("div",{style:$,children:D.map(No)}),e[47]=D,e[48]=G):G=e[48];let H;e[49]!==T||e[50]!==G?(H=a.jsxs("div",{className:"lv4-canvas-body",children:[d,T,G]}),e[49]=T,e[50]=G,e[51]=H):H=e[51];let C;return e[52]!==q||e[53]!==H?(C=a.jsxs("div",{children:[q,H]}),e[52]=q,e[53]=H,e[54]=C):C=e[54],C};function jo(t){return oe(t.estado_inscripcion)==="seleccionado"}function So(t){return oe(t.estado)==="finalizada"}function wo(t){return t.show}function No(t){return a.jsxs("div",{className:"lv4-action-card",children:[a.jsx("span",{className:"material-icons",style:{fontSize:20,color:"var(--ink-3)",marginBottom:10,display:"block"},children:t.icon}),a.jsx("div",{style:{fontWeight:600,marginBottom:4},children:t.title}),a.jsx("div",{style:{fontSize:13,color:"var(--ink-3)",marginBottom:14},children:t.desc}),a.jsx("button",{className:"lv4-btn",onClick:t.onClick,children:t.cta})]},t.title)}const _o=t=>{const e=ce.c(131),{launch:o,showModal:n,onActivar:r}=t,{openEdit:i,modal:s}=ma(o),[c,f]=L.useState(!1),[u,l]=L.useState(!1),h=o[le],{data:g}=ua(o.id);let x;e[0]!==g?(x=g===void 0?[]:g,e[0]=g,e[1]=x):x=e[1];const A=x;let m;e[2]!==A?(m=A.filter(Co),e[2]=A,e[3]=m):m=e[3];const S=m;let j;e[4]!==o.id?(j=De.compromisos(o.id),e[4]=o.id,e[5]=j):j=e[5];let y;e[6]!==o.id?(y=async()=>{const{data:Z}=await fe.from("compromisos_pps").select("estado, convocatoria_id, accepted_at").eq("lanzamiento_id",o.id);return Z||[]},e[6]=o.id,e[7]=y):y=e[7];let _;e[8]!==j||e[9]!==y?(_={queryKey:j,queryFn:y},e[8]=j,e[9]=y,e[10]=_):_=e[10];const{data:I}=Ne(_);let F;e[11]!==I?(F=I===void 0?[]:I,e[11]=I,e[12]=F):F=e[12];const w=F;let P,B,M,O;e[13]!==S?(P=S.map(Ao).filter(Boolean),M=Ne,O="seleccionadosInfo",B=P.join(","),e[13]=S,e[14]=P,e[15]=B,e[16]=M,e[17]=O):(P=e[14],B=e[15],M=e[16],O=e[17]);let D;e[18]!==B||e[19]!==O?(D=[O,B],e[18]=B,e[19]=O,e[20]=D):D=e[20];let z;e[21]!==P?(z=async()=>{if(P.length===0)return{};const{data:Z}=await fe.from("estudiantes").select("id, nombre, telefono, correo").in("id",P),ge={};return(Z||[]).forEach(ie=>{ge[ie.id]={nombre:ie.nombre,telefono:ie.telefono,correo:ie.correo}}),ge},e[21]=P,e[22]=z):z=e[22];const q=P.length>0;let d;e[23]!==D||e[24]!==z||e[25]!==q?(d={queryKey:D,queryFn:z,enabled:q},e[23]=D,e[24]=z,e[25]=q,e[26]=d):d=e[26];const{data:b}=M(d);let k;e[27]!==b?(k=b===void 0?{}:b,e[27]=b,e[28]=k):k=e[28];const v=k;let N;e[29]!==w?(N={},w.forEach(Z=>{const ge=Z.convocatoria_id;ge&&(N[ge]={estado:Z.estado??null,accepted_at:Z.accepted_at??null})}),e[29]=w,e[30]=N):N=e[30];const p=N;let E;if(e[31]!==p||e[32]!==v||e[33]!==S){let Z;e[35]!==p||e[36]!==v?(Z=ge=>{const ie=ge,ra=ie.horario_asignado&&String(ie.horario_asignado).trim()||ie.horario_seleccionado&&String(ie.horario_seleccionado).trim()||null,Te=p[ie.id],na=Te?oe(Te.estado)==="aceptado":!1,qe=oe(ie.estado_inscripcion)==="seleccionado",We=ie.estudiante_id?v[ie.estudiante_id]:void 0,Le=na?"firmo":qe?"pendiente":"baja";return{id:ie.id,nombre:We?.nombre??null,telefono:We?.telefono??null,correo:We?.correo??null,horario:ra,accepted:na,acceptedAt:Te?.accepted_at??null,bajaAt:ie.baja_automatica_at??null,status:Le}},e[35]=p,e[36]=v,e[37]=Z):Z=e[37],E=S.map(Z).sort(Eo),e[31]=p,e[32]=v,e[33]=S,e[34]=E}else E=e[34];const T=E,$=T.length;let G;e[38]!==T?(G=T.filter(Io),e[38]=T,e[39]=G):G=e[39];const H=G.length,C=$-H;let Y;e[40]!==H||e[41]!==$?(Y=$>0?Math.round(H/$*100):0,e[40]=H,e[41]=$,e[42]=Y):Y=e[42];const R=Y,U=Fo,Q=To;let W;e[43]!==h?(W=Z=>`Hola ${Z||""}! 👋 Te recordamos que tenés pendiente aceptar el *compromiso digital* para la PPS${h?` en ${h}`:""}. Ingresá a tu panel y confirmá: pps.psico.uflo.edu.ar`,e[43]=h,e[44]=W):W=e[44];const ne=W;let V;e[45]!==h?(V=Z=>`Hola ${Z||""}! Te escribo de la Coordinación de PPS por la práctica${h?` en ${h}`:""}. Vi que no llegaste a confirmar el compromiso digital a tiempo y el sistema te dio de baja. ¿Seguís interesado/a? Avisame y lo resolvemos.`,e[45]=h,e[46]=V):V=e[46];const J=V;let se,te,re,X,ee,ae,me,he;if(e[47]!==J||e[48]!==H||e[49]!==R||e[50]!==T||e[51]!==s||e[52]!==u||e[53]!==o||e[54]!==r||e[55]!==i||e[56]!==C||e[57]!==ne||e[58]!==$){const Z=T.filter(Lo),ge=T.filter(Do),ie=new Map;Z.forEach(K=>{const Ee=(K.horario||"").trim()||"Sin horario asignado";ie.set(Ee,(ie.get(Ee)||0)+1)});const ra=Array.from(ie.entries()).map(Oo).sort(Po);let Te;e[67]===Symbol.for("react.memo_cache_sentinel")?(Te=K=>K.status==="firmo"?{color:"var(--ok)",bg:"var(--ok-s)",icon:"verified",label:`Firmó${K.acceptedAt?` · ${Q(K.acceptedAt)}`:""}`}:K.status==="baja"?{color:"#A12D2D",bg:"rgba(161,45,45,.10)",icon:"person_off",label:`Baja${K.bajaAt?` · ${Q(K.bajaAt)}`:""}`}:{color:"var(--warn)",bg:"var(--warn-s)",icon:"hourglass_empty",label:"Pendiente"},e[67]=Te):Te=e[67];const na=Te;let qe;e[68]!==J||e[69]!==ne?(qe=K=>{const Ee=na(K),Ua=K.status==="pendiente"?ne(K.nombre):K.status==="baja"?J(K.nombre):void 0,ja=Pa(K.telefono,Ua);return a.jsxs("div",{className:"lv4-insc-row",style:{gap:12},children:[a.jsx("div",{className:"lv4-avatar",style:{background:Ee.bg,color:Ee.color,borderColor:"transparent"},children:U(K.nombre)}),a.jsxs("div",{style:{minWidth:0,flex:1},children:[a.jsx("div",{style:{fontSize:13.5,fontWeight:500,color:"var(--ink)"},children:K.nombre??a.jsx("span",{style:{color:"var(--ink-4)",fontStyle:"italic"},children:"Sin nombre"})}),a.jsxs("div",{style:{display:"flex",flexWrap:"wrap",gap:10,marginTop:2,fontSize:11.5,color:"var(--ink-3)"},children:[K.horario&&a.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:4},children:[a.jsx("span",{className:"material-icons",style:{fontSize:12},children:"schedule"}),K.horario]}),K.telefono&&a.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:4},children:[a.jsx("span",{className:"material-icons",style:{fontSize:12},children:"call"}),K.telefono]}),K.correo&&a.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:4,minWidth:0},children:[a.jsx("span",{className:"material-icons",style:{fontSize:12},children:"mail"}),a.jsx("span",{style:{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180},children:K.correo})]})]}),K.status==="baja"&&a.jsx("div",{style:{fontSize:11,color:"#A12D2D",marginTop:4,lineHeight:1.4},children:"Dado de baja automática por no firmar a tiempo. Volvé a seleccionarlo desde «Agregar o cambiar seleccionados» si corresponde."})]}),a.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:999,background:Ee.bg,color:Ee.color,whiteSpace:"nowrap"},children:[a.jsx("span",{className:"material-icons",style:{fontSize:13},children:Ee.icon}),Ee.label]}),a.jsxs("div",{style:{display:"flex",gap:6,flexShrink:0},children:[ja?a.jsx("a",{className:"lv4-icon-btn",href:ja,target:"_blank",rel:"noopener noreferrer",title:K.status==="firmo"?"Escribir por WhatsApp":K.status==="baja"?"Contactar (dado de baja)":"Enviar recordatorio por WhatsApp",style:{color:"#25D366",textDecoration:"none"},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"chat"})}):a.jsx("span",{className:"lv4-icon-btn",title:"Sin teléfono cargado",style:{color:"var(--ink-4)",cursor:"not-allowed",opacity:.5},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"chat"})}),K.correo?a.jsx("a",{className:"lv4-icon-btn",href:`mailto:${K.correo}`,title:`Enviar email a ${K.correo}`,style:{color:"var(--ink-3)",textDecoration:"none"},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"mail"})}):a.jsx("span",{className:"lv4-icon-btn",title:"Sin correo cargado",style:{color:"var(--ink-4)",cursor:"not-allowed",opacity:.5},children:a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"mail"})})]})]},K.id)},e[68]=J,e[69]=ne,e[70]=qe):qe=e[70];const We=qe;let Le;e[71]!==r?(Le={label:"Activar PPS",icon:"play_circle",onClick:r},e[71]=r,e[72]=Le):Le=e[72];let He;e[73]!==i?(He=[{label:"Editar datos",icon:"edit",onClick:i}],e[73]=i,e[74]=He):He=e[74],e[75]!==o||e[76]!==Le||e[77]!==He?(me=a.jsx(Xe,{launch:o,uiState:"confirmacion",primaryAction:Le,secondaryActions:He}),e[75]=o,e[76]=Le,e[77]=He,e[78]=me):me=e[78],he=s,se="lv4-canvas-body";let sa;e[79]===Symbol.for("react.memo_cache_sentinel")?(sa={marginBottom:24},e[79]=sa):sa=e[79];let Ue;e[80]!==$?(Ue=a.jsx(de,{label:"Seleccionados",value:$,hint:"estudiantes"}),e[80]=$,e[81]=Ue):Ue=e[81];let Ve;e[82]!==H?(Ve=a.jsx(de,{label:"Consintieron",value:H,hint:"compromiso digital",tone:"ok"}),e[82]=H,e[83]=Ve):Ve=e[83];const va=C>0?"warn":"ok";let Ke;e[84]!==C||e[85]!==va?(Ke=a.jsx(de,{label:"Pendientes",value:C,hint:"sin firmar",tone:va}),e[84]=C,e[85]=va,e[86]=Ke):Ke=e[86],e[87]!==Ue||e[88]!==Ve||e[89]!==Ke?(te=a.jsxs(oa,{style:sa,children:[Ue,Ve,Ke]}),e[87]=Ue,e[88]=Ve,e[89]=Ke,e[90]=te):te=e[90],e[91]!==H||e[92]!==R||e[93]!==$?(re=$>0&&a.jsxs("div",{style:{border:"1px solid var(--rule-2)",borderRadius:12,padding:"14px 18px",marginBottom:24},children:[a.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8},children:[a.jsx("span",{className:"lv4-eyebrow",style:{marginBottom:0},children:"Avance de consentimientos"}),a.jsxs("span",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:12,fontWeight:600,color:R===100?"var(--ok)":"var(--warn)"},children:[H,"/",$," · ",R,"%"]})]}),a.jsx("div",{className:"lv4-progress-track",children:a.jsx("div",{className:"lv4-progress-fill",style:{width:`${R}%`,background:R===100?"var(--ok)":"var(--warn)"}})})]}),e[91]=H,e[92]=R,e[93]=$,e[94]=re):re=e[94],e[95]!==H||e[96]!==C||e[97]!==$?(X=$===0?a.jsx(Oe,{tone:"neutral",icon:"group_add",title:"Todavía no hay estudiantes seleccionados",style:{marginBottom:28},action:a.jsxs("button",{className:"lv4-btn lv4-btn-primary",style:{flexShrink:0},onClick:()=>f(!0),children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"person_add"}),"Seleccionar estudiantes"]}),children:"Elegí estudiantes de la lista de inscriptos para empezar la sala de consentimientos."}):C>0?a.jsxs(Oe,{tone:"warn",icon:"pending_actions",title:`${C} de ${$} sin firmar el compromiso`,style:{marginBottom:28},children:["Seleccionaste ",$," estudiante",$!==1?"s":""," y ",H," firmaron. Revisá abajo quiénes faltan y contactalos directo por WhatsApp o email."]}):a.jsx(Oe,{tone:"ok",icon:"check_circle",title:"Todos los compromisos aceptados",style:{marginBottom:28},children:"Podés proceder a generar los seguros y actas."}),e[95]=H,e[96]=C,e[97]=$,e[98]=X):X=e[98],ee=Z.length>0&&a.jsxs("div",{style:{marginBottom:28},children:[a.jsxs("div",{style:{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12},children:[a.jsxs("div",{children:[a.jsx("div",{className:"lv4-eyebrow",style:{color:"var(--warn)"},children:"Acción requerida"}),a.jsxs("div",{className:"lv4-section-title",children:["Faltan firmar (",Z.length,")"]})]}),a.jsxs("button",{className:"lv4-btn",onClick:()=>f(Ro),children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"manage_accounts"}),"Gestionar"]})]}),a.jsxs("div",{style:{fontSize:12.5,color:"var(--ink-3)",margin:"0 0 12px",maxWidth:640,lineHeight:1.5},children:["Estudiantes que no aceptaron el compromiso digital. Los marcados como"," ",a.jsx("b",{style:{color:"#A12D2D"},children:"baja"})," ya fueron dados de baja automática por no firmar en 24 h; los ",a.jsx("b",{style:{color:"var(--warn)"},children:"pendientes"})," siguen en plazo. Contactalos directo por WhatsApp (el mensaje ya viene escrito) o por email."]}),ra.length>0&&a.jsxs("div",{style:{border:"1px solid var(--rule-2)",borderRadius:10,padding:"12px 14px",marginBottom:14,background:"var(--paper)"},children:[a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",color:"var(--ink-3)",marginBottom:10},children:[a.jsx("span",{className:"material-icons",style:{fontSize:15,color:"var(--warn)"},children:"schedule"}),"Horarios a cubrir"]}),a.jsx("div",{style:{display:"flex",flexWrap:"wrap",gap:8},children:ra.map($o)}),a.jsx("div",{style:{fontSize:11.5,color:"var(--ink-4)",marginTop:10},children:"Al seleccionar reemplazos, priorizá estas franjas para no dejar vacantes."})]}),a.jsx("div",{style:{border:"1px solid var(--warn)",borderRadius:12,overflow:"hidden",background:"var(--warn-s)"},children:Z.map(We)})]}),ae=ge.length>0&&a.jsxs("div",{style:{marginBottom:28},children:[a.jsxs("button",{className:"lv4-group-head",style:{width:"100%"},onClick:()=>l(Bo),children:[a.jsxs("span",{className:"lv4-group-label",children:[a.jsx("span",{className:"material-icons",style:{fontSize:16,transition:"transform .15s",transform:u?"rotate(0)":"rotate(-90deg)",color:"var(--ink-4)"},children:"expand_more"}),a.jsx("span",{className:"material-icons",style:{fontSize:15,color:"var(--ok)"},children:"verified"}),ge.length," ya firmaron"]}),a.jsx("span",{className:"lv4-group-count",children:u?"ocultar":"ver"})]}),u&&a.jsx("div",{style:{border:"1px solid var(--rule-2)",borderRadius:12,overflow:"hidden",marginTop:12},children:ge.map(We)})]}),e[47]=J,e[48]=H,e[49]=R,e[50]=T,e[51]=s,e[52]=u,e[53]=o,e[54]=r,e[55]=i,e[56]=C,e[57]=ne,e[58]=$,e[59]=se,e[60]=te,e[61]=re,e[62]=X,e[63]=ee,e[64]=ae,e[65]=me,e[66]=he}else se=e[59],te=e[60],re=e[61],X=e[62],ee=e[63],ae=e[64],me=e[65],he=e[66];let ke;e[99]===Symbol.for("react.memo_cache_sentinel")?(ke={marginBottom:28},e[99]=ke):ke=e[99];let _e,Ce;e[100]===Symbol.for("react.memo_cache_sentinel")?(_e={width:"100%"},Ce=()=>f(Mo),e[100]=_e,e[101]=Ce):(_e=e[100],Ce=e[101]);const ze=c?"rotate(0)":"rotate(-90deg)";let je;e[102]!==ze?(je=a.jsxs("span",{className:"lv4-group-label",children:[a.jsx("span",{className:"material-icons",style:{fontSize:16,transition:"transform .15s",transform:ze,color:"var(--ink-4)"},children:"expand_more"}),"Agregar o cambiar seleccionados"]}),e[102]=ze,e[103]=je):je=e[103];let Ae;e[104]===Symbol.for("react.memo_cache_sentinel")?(Ae=a.jsx("span",{className:"lv4-group-count",children:"desde inscriptos"}),e[104]=Ae):Ae=e[104];let Se;e[105]!==je?(Se=a.jsxs("button",{className:"lv4-group-head",style:_e,onClick:Ce,children:[je,Ae]}),e[105]=je,e[106]=Se):Se=e[106];let xe;e[107]!==c||e[108]!==o.id?(xe=c&&a.jsxs("div",{style:{marginTop:14},children:[a.jsx("div",{style:{fontSize:12.5,color:"var(--ink-3)",marginBottom:14,maxWidth:640,lineHeight:1.5},children:"Marcá o desmarcá estudiantes de la lista de inscriptos. Los cambios se reflejan arriba en la lista de seleccionados."}),a.jsx(L.Suspense,{fallback:a.jsx(Je,{}),children:a.jsx(ka,{isTestingMode:!1,preSelectedLaunchId:o.id,hideConfirmed:!0})})]}),e[107]=c,e[108]=o.id,e[109]=xe):xe=e[109];let be;e[110]!==Se||e[111]!==xe?(be=a.jsxs("div",{style:ke,children:[Se,xe]}),e[110]=Se,e[111]=xe,e[112]=be):be=e[112];let we;e[113]!==r||e[114]!==C||e[115]!==n||e[116]!==$?(we=$>0&&a.jsxs(a.Fragment,{children:[a.jsx("div",{className:"lv4-eyebrow",style:{marginBottom:8},children:"Activar la PPS"}),a.jsx(Oe,{tone:"ok",icon:"play_circle",title:C>0?`${C} compromiso${C!==1?"s":""} aún pendiente${C!==1?"s":""}`:"Todos los compromisos aceptados",style:{marginBottom:16},children:C>0?"Podés avanzar igual: la PPS arranca con los confirmados y los pendientes pasan a la lista de reemplazos.":"Activá la PPS para marcar el lanzamiento como en curso. Los estudiantes ya están listos."}),a.jsxs("div",{style:{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:24},children:[a.jsxs("button",{className:"lv4-btn lv4-btn-primary",onClick:r,children:[a.jsx("span",{className:"material-icons",style:{fontSize:16},children:"play_circle"}),"Activar PPS"]}),C>0&&a.jsxs("button",{className:"lv4-btn lv4-btn-ghost",onClick:()=>n("Avanzar con pendientes","Esta acción mueve el lanzamiento a Activa aunque haya compromisos sin firmar. Los pendientes podrán ser reemplazados desde la sala de Confirmación."),children:[a.jsx("span",{className:"material-icons",style:{fontSize:16},children:"warning"}),"¿Por qué hay pendientes?"]})]})]}),e[113]=r,e[114]=C,e[115]=n,e[116]=$,e[117]=we):we=e[117];let Fe;e[118]!==se||e[119]!==te||e[120]!==re||e[121]!==X||e[122]!==ee||e[123]!==ae||e[124]!==be||e[125]!==we?(Fe=a.jsxs("div",{className:se,children:[te,re,X,ee,ae,be,we]}),e[118]=se,e[119]=te,e[120]=re,e[121]=X,e[122]=ee,e[123]=ae,e[124]=be,e[125]=we,e[126]=Fe):Fe=e[126];let Be;return e[127]!==me||e[128]!==he||e[129]!==Fe?(Be=a.jsxs("div",{children:[me,he,Fe]}),e[127]=me,e[128]=he,e[129]=Fe,e[130]=Be):Be=e[130],Be};function Co(t){return oe(t.estado_inscripcion)==="seleccionado"||t.baja_automatica_at!=null}function Ao(t){return t.estudiante_id}function Eo(t,e){const o={pendiente:0,baja:1,firmo:2};return o[t.status]!==o[e.status]?o[t.status]-o[e.status]:(t.nombre||"").localeCompare(e.nombre||"")}function Io(t){return t.status==="firmo"}function zo(t){return t[0]}function Fo(t){return t?t.split(" ").map(zo).filter(Boolean).slice(0,2).join("").toUpperCase():"?"}function To(t){if(!t)return"";const e=new Date(t);return Number.isNaN(e.getTime())?"":e.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})}function Lo(t){return t.status!=="firmo"}function Do(t){return t.status==="firmo"}function Oo(t){const[e,o]=t;return{horario:e,count:o}}function Po(t,e){return e.count-t.count}function Ro(t){return!t}function $o(t){return a.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:999,border:"1px solid var(--warn)",background:"var(--warn-s)",fontSize:12.5,color:"var(--ink-2)"},children:[a.jsx("span",{style:{fontWeight:500},children:t.horario}),a.jsx("span",{style:{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:20,height:20,padding:"0 6px",borderRadius:999,background:"var(--warn)",color:"var(--paper)",fontFamily:"'JetBrains Mono', monospace",fontSize:11,fontWeight:700},children:t.count})]},t.horario)}function Bo(t){return!t}function Mo(t){return!t}const qo=L.lazy(()=>ya(()=>import("./LanzadorConvocatorias-Bmf4v8Gz.js"),__vite__mapDeps([8,1,2,9,10,11,12,5,3,4]),import.meta.url)),Wo=({isTestingMode:t=!1})=>{const{showModal:e}=jt(),o=pa(),[n]=St(),r=wt(),[i,s]=L.useState(()=>{try{return localStorage.getItem("lv4-sidebar-collapsed")==="1"}catch{return!1}}),[c,f]=L.useState(()=>r.state?.launchId||n.get("launchId")||null),[u,l]=L.useState(!1),[h,g]=L.useState(!1),[x,A]=L.useState(null),m=L.useCallback(v=>{l(!1),f(v),g(!1)},[]);L.useEffect(()=>{try{localStorage.setItem("lv4-sidebar-collapsed",i?"1":"0")}catch{}},[i]);const{data:S=[],isLoading:j}=Ne({queryKey:De.history(t),queryFn:async()=>t?[]:pe.lanzamientos.getAll({sort:[{field:$e,direction:"desc"}]})}),y=S.map(v=>v.id),{data:_={}}=Ne({queryKey:De.convCounts(y),queryFn:async()=>{if(y.length===0)return{};const{data:v,error:N}=await fe.rpc("get_convocatoria_counts_by_launch",{p_launch_ids:y});if(N)throw N;return v||{}},enabled:y.length>0}),{data:I={}}=Ne({queryKey:De.consentCounts(y),queryFn:async()=>{if(y.length===0)return{};const{data:v,error:N}=await fe.rpc("get_consent_counts_by_launch",{p_launch_ids:y});if(N)throw N;return v||{}},enabled:y.length>0}),F=L.useMemo(()=>Ht(S,_,I),[S,_,I]),w=L.useMemo(()=>S.find(v=>v.id===c)||null,[S,c]),P=L.useMemo(()=>c?F.find(v=>v.id===c)?.uiState??null:null,[F,c]),B=L.useCallback(()=>{f(null),l(!0),g(!1)},[]),M=L.useCallback(()=>{xa(o)},[o]),O=Ze({mutationFn:async({id:v,estado:N})=>{const p={[ye]:N};if(N!=="Archivado"?p[Ge]="Relanzamiento Confirmado":p[Ge]="Archivado",await pe.lanzamientos.update(v,p),N==="Cerrado"){const E=S.find(T=>T.id===v);E&&Ot(v).then(T=>{if(T.length>0)return Dt(E,T)}).catch(T=>ve.error("[Lanzador] Error notificando seleccionados:",T))}},onMutate:async({id:v,estado:N})=>{const p=De.history(t);await o.cancelQueries({queryKey:p});const E=o.getQueryData(p);return o.setQueryData(p,T=>(T||[]).map($=>$.id===v?{...$,[ye]:N}:$)),{previous:E}},onError:(v,N,p)=>{p?.previous&&o.setQueryData(De.history(t),p.previous),e("No se pudo actualizar",v?.message||"Ocurrió un error al cambiar el estado.")},onSettled:()=>M()}),D=L.useCallback((v,N,p)=>{if(p){A({...p,onConfirm:()=>O.mutate({id:v,estado:N})});return}O.mutate({id:v,estado:N})},[O]),z=Ze({mutationFn:async({id:v,action:N})=>{const p=S.find(T=>T.id===v),E={};switch(N){case"abrir":E[ye]="Abierta",E[Ge]="Relanzamiento Confirmado";break;case"cerrar":E[ye]="Cerrado";break;case"ocultar":E[ye]="Oculto";break;case"archivar":E[Ge]="Archivado";break;case"desarchivar":{E[Ge]="Relanzamiento Confirmado";const T=oe(p?.[ye]||"");if(T==="archivado"||T==="archivada"||T==="oculto"){const $=(_[v]?.seleccionados||0)>0,G=p?.[$e],H=G?new Date(G).getTime()<=new Date().getTime():!1;$&&H?E[ye]="Activa":E[ye]="Cerrado"}break}}await pe.lanzamientos.update(v,E)},onSuccess:()=>M(),onError:v=>e("No se pudo actualizar",v?.message||"Ocurrió un error al cambiar el estado.")}),q=L.useCallback((v,N)=>{if(N==="archivar"){A({title:"¿Archivar convocatoria?",message:"Dejará de verse para los estudiantes y pasará a «Archivadas».",confirmText:"Archivar",type:"warning",onConfirm:()=>z.mutate({id:v,action:N})});return}z.mutate({id:v,action:N})},[z]),d=Ze({mutationFn:async v=>{const N={[le]:`${v[le]||"Convocatoria"} (copia)`,[Me]:v[Me],[Re]:v[Re],[da]:v[da],[Pe]:v[Pe],[ye]:"Oculto"};return pe.lanzamientos.create(N)},onSuccess:v=>{M();const N=v?.id;N&&f(N),e("Borrador creado","Se creó un nuevo borrador con los datos de la convocatoria.")},onError:v=>e("No se pudo duplicar",v?.message||"Ocurrió un error al duplicar la convocatoria.")}),b=()=>{if(j)return a.jsx("div",{className:"lv4-canvas",children:a.jsxs("div",{className:"lv4-empty",children:[a.jsx("span",{className:"material-icons",style:{animation:"lv4-spin 1s linear infinite"},children:"refresh"}),a.jsx("p",{children:"Cargando convocatorias…"})]})});if(!c||!w)return a.jsx("div",{className:"lv4-canvas",children:a.jsx("div",{className:"lv4-empty",children:F.length===0?a.jsxs(a.Fragment,{children:[a.jsx("span",{className:"material-icons",children:"rocket_launch"}),a.jsx("p",{children:"Aún no hay convocatorias. ¡Creá la primera!"}),a.jsxs("button",{className:"lv4-btn lv4-btn-primary",onClick:B,children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"add"}),"Nueva convocatoria"]})]}):a.jsxs(a.Fragment,{children:[a.jsx("span",{className:"material-icons",children:"arrow_back"}),a.jsx("p",{children:"Seleccioná una convocatoria de la lista para ver sus detalles."})]})})});switch(P){case"borrador":return a.jsx("div",{className:"lv4-canvas",children:a.jsx(co,{launch:w,onPublish:()=>D(w.id,"Abierta",{title:"¿Publicar convocatoria?",message:"Pasará a estado «Abierta» y será visible para inscripción de los estudiantes.",confirmText:"Publicar",type:"info"}),onRefresh:M})});case"seleccion":return a.jsx("div",{className:"lv4-canvas",children:a.jsx(mo,{launch:w,onCerrarInscripcion:()=>D(w.id,"Cerrado",{title:"¿Cerrar la mesa de inscripción?",message:"Ya no se podrán anotar más estudiantes ni modificar las selecciones actuales, y se enviarán automáticamente los correos de confirmación a los estudiantes seleccionados.",confirmText:"Cerrar y notificar",type:"warning"})})});case"seguro":return a.jsx("div",{className:"lv4-canvas",children:a.jsx(ho,{launch:w,showModal:e})});case"confirmacion":return a.jsx("div",{className:"lv4-canvas",children:a.jsx(_o,{launch:w,showModal:e,onActivar:()=>D(w.id,"Activa",{title:"¿Activar esta PPS?",message:"Pasará a estado «Activa» (en curso). Los estudiantes con el compromiso aún pendiente quedarán como reemplazos.",confirmText:"Activar PPS",type:"info"})})});case"activa":return a.jsx("div",{className:"lv4-canvas",children:a.jsx(yo,{launch:w,onArchivar:()=>D(w.id,"Archivado",{title:"¿Archivar esta convocatoria?",message:"Quedará como referencia histórica.",confirmText:"Archivar",type:"warning"})})});case"archivada":return a.jsx("div",{className:"lv4-canvas",children:a.jsx(ko,{launch:w,onDuplicar:()=>d.mutate(w),onReabrir:()=>D(w.id,"Abierta",{title:"¿Reabrir la inscripción?",message:"La convocatoria archivada volverá a estado «Abierta» para recibir nuevos postulantes.",confirmText:"Reabrir",type:"info"}),onReactivarActiva:()=>D(w.id,"Activa",{title:"¿Reactivar esta PPS?",message:"La convocatoria volverá al estado «Activa» (en curso) con los alumnos previamente seleccionados.",confirmText:"Reactivar",type:"info"}),onReactivarConfirmacion:()=>D(w.id,"Confirmacion",{title:"¿Reactivar la Sala de Firmas?",message:"La convocatoria volverá al paso «Confirmación» para recolectar compromisos y firmas digitales.",confirmText:"Reactivar firmas",type:"info"})})});default:return null}},k=()=>a.jsxs("div",{className:"lv4-canvas",children:[a.jsxs("div",{className:"lv4-canvas-head",children:[a.jsx("div",{style:{display:"flex",alignItems:"center",gap:12,marginBottom:12},children:a.jsxs("span",{className:"lv4-chip lv4-chip-borrador",children:[a.jsx("span",{className:"lv4-dot lv4-dot-borrador"}),"Nueva"]})}),a.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16},children:[a.jsx("h1",{style:{margin:0,fontSize:33,fontWeight:400,letterSpacing:"-0.015em",fontFamily:"'Instrument Serif', Georgia, serif"},children:"Nueva convocatoria"}),a.jsxs("button",{className:"lv4-btn",onClick:()=>l(!1),children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"arrow_back"}),"Volver"]})]})]}),a.jsx("div",{className:"lv4-canvas-body",children:a.jsx(L.Suspense,{fallback:a.jsx(Je,{}),children:a.jsx(qo,{forcedTab:"new",isTestingMode:t})})})]});return a.jsxs(a.Fragment,{children:[a.jsxs("div",{className:"lv4",children:[a.jsx(Qt,{entries:F,selectedId:c,collapsed:i,onSelect:m,onNew:B,onToggleCollapsed:()=>s(v=>!v),onAction:q,mobileOpen:h}),a.jsx("div",{className:`lv4-aside-backdrop${h?" open":""}`,onClick:()=>g(!1),"aria-hidden":"true"}),a.jsx("main",{style:{flex:1,minWidth:0,overflowY:"auto"},children:u?k():b()})]}),a.jsxs("button",{className:"lv4-mobile-menu-btn",onClick:()=>g(!0),"aria-label":"Abrir lista de convocatorias",children:[a.jsx("span",{className:"material-icons",children:"menu"}),"Convocatorias"]}),a.jsx(Nt,{isOpen:!!x,title:x?.title||"",message:x?.message||"",confirmText:x?.confirmText,type:x?.type,onConfirm:()=>x?.onConfirm(),onClose:()=>A(null)})]})},Jo=Object.freeze(Object.defineProperty({__proto__:null,default:Wo},Symbol.toStringTag,{value:"Module"}));export{Zo as C,Qo as F,qa as L,Go as a,Jo as b,go as u};
