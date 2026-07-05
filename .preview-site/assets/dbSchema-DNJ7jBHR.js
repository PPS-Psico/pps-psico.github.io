import{r as I,aK as L,j as e,bc as G,aL as R,a6 as j,aB as z,a4 as M,_ as w,$ as J,W as q,bd as $,aS as W,aQ as Y,be as K,V as Q,H as X,bf as ee,U as ae,R as re,T as oe,K as ne,M as ie,bg as te,ao as se,bh as le,aw as de,ar as ce,ah as pe,aq as be,as as xe,au as me,at as ue,bi as Ie,bj as he,ay as fe,am as ge,an as Ae,bk as Ee,ag as Ne,al as ve,af as Oe,ap as ke,l as Ce,F as _e,ad as ye,av as Te,ai as Se,bl as Fe,aT as De,aR as Le,aP as we,bm as Re,aU as je,aV as ze,aF as Me,aE as Ue,bn as Ve,bo as Pe,bp as Be,bq as Ze,br as He,bs as Ge,bt as Je,bu as qe,a8 as $e,bv as We,bw as Ye,bx as Ke,by as Qe,a5 as Xe,bz as ea,bA as aa,bB as ra,bC as oa,bD as na,bE as ia,aN as ta,aA as sa,az as la,bF as da,bG as ca,bH as pa,bI as ba,bJ as xa,bb as ma,bK as ua,bL as Ia,bM as ha,ba as fa}from"./index-Bf63COEH.js";import{i as ga}from"./injectScopedStyles-B_yJaYqk.js";const Aa=`
.dbe {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  --ai:#5A2D86; --ai-s:#5A2D8612;
  --ease:cubic-bezier(.21,.66,.34,1);
  --ease-out:cubic-bezier(.16,1,.3,1);
  --shadow-soft:0 1px 2px rgba(20,19,16,.04), 0 8px 24px -12px rgba(20,19,16,.18);
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .dbe {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
  --ai:#C9A4F2; --ai-s:#C9A4F21A;
  --shadow-soft:0 1px 2px rgba(0,0,0,.3), 0 10px 30px -12px rgba(0,0,0,.6);
}
@keyframes dbe-rise{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
@keyframes dbe-pop{ from{ opacity:0; transform:translateY(8px) scale(.98); } to{ opacity:1; transform:translateY(0) scale(1); } }
.dbe .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.dbe .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums; }
.dbe .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

/* ── Wrapper Editor DB ── */
.dbe-head{ margin-bottom:18px; }
.dbe-head h2{ font-family:'Instrument Serif', serif; font-size:26px; font-weight:700; letter-spacing:-0.025em; margin:5px 0 0; }
.dbe-head p{ font-size:13.5px; color:var(--ink-3); margin:5px 0 0; max-width:560px; }
.dbe-warnline{ display:inline-flex; align-items:center; gap:6px; margin-top:10px; font-size:11.5px; color:var(--warn); }
.dbe-warnline .material-icons{ font-size:14px; }

.dbe-tabs{ display:inline-flex; gap:4px; padding:4px; border:1px solid var(--rule-2); border-radius:11px; background:var(--paper-2); margin-bottom:22px; flex-wrap:wrap; }
.dbe-tab{ display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; border:none; background:transparent; color:var(--ink-3); transition: color .22s var, background-color .22s var, border-color .22s var, box-shadow .22s var, transform .22s var, opacity .22s var, filter .22s var(--ease); }
.dbe-tab[data-on="1"]{ background:var(--paper); color:var(--ink); box-shadow:0 1px 2px rgba(20,19,16,0.06); }
.dbe-tab:not([data-on="1"]):hover{ color:var(--ink-2); }
.dbe-tab .material-icons{ font-size:16px; }

/* ── Barra de filtros ── */
.dbe-bar{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); padding:16px 18px; display:flex; gap:14px; align-items:flex-end; flex-wrap:wrap; }
.dbe-bar-grow{ flex:1 1 220px; min-width:0; }
.dbe-label{ display:block; font-size:10px; text-transform:uppercase; letter-spacing:.1em; font-weight:600; color:var(--ink-4); margin-bottom:6px; }
.dbe-search{ position:relative; }
.dbe-search input{ width:100%; height:42px; padding:0 14px 0 38px; border:1px solid var(--rule-3); border-radius:10px; background:var(--paper-2); color:var(--ink); font-size:13.5px; font-weight:500; font-family:inherit; outline:none; box-sizing:border-box; }
.dbe-search input:focus{ border-color:var(--accent); }
.dbe-search input::placeholder{ color:var(--ink-4); font-weight:400; }
.dbe-search .material-icons{ position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--ink-4); pointer-events:none; }
.dbe-select{ width:100%; height:42px; padding:0 36px 0 14px; border:1px solid var(--rule-3); border-radius:10px; background:var(--paper-2); color:var(--ink); font-size:13.5px; font-weight:500; font-family:inherit; outline:none; cursor:pointer; appearance:none; box-sizing:border-box; }
.dbe-select:focus{ border-color:var(--accent); }
.dbe-select-wrap{ position:relative; }
.dbe-select-wrap .material-icons{ position:absolute; right:11px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--ink-4); pointer-events:none; }
.dbe-chip-active{ display:flex; align-items:center; justify-content:space-between; gap:8px; height:42px; padding:0 12px; border-radius:10px; background:var(--accent-s); border:1px solid var(--accent); }
.dbe-chip-active span{ font-size:13px; font-weight:600; color:var(--accent); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dbe-chip-active button{ background:none; border:none; cursor:pointer; color:var(--accent); display:flex; }
.dbe-chip-active button .material-icons{ font-size:16px; }

/* ── Botones ── */
.dbe-btn{ display:inline-flex; align-items:center; gap:7px; height:42px; padding:0 16px; font-size:13px; font-weight:500; border-radius:10px; border:1px solid var(--rule-3); background:transparent; color:var(--ink); cursor:pointer; font-family:inherit; transition:background .2s var(--ease), border-color .2s var(--ease), transform .12s var(--ease); white-space:nowrap; }
.dbe-btn:hover{ background:var(--paper-2); }
.dbe-btn:active{ transform:scale(.97); }
.dbe-btn:disabled{ opacity:.5; cursor:not-allowed; }
.dbe-btn-primary{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.dbe-btn-primary:hover{ opacity:.9; background:var(--ink); }
.dbe-btn .material-icons{ font-size:17px; }
.dbe-btn-danger{ background:var(--warn-s); color:var(--warn); border-color:transparent; height:auto; padding:8px 13px; font-size:12px; font-weight:600; border-radius:8px; }
.dbe-btn-danger:hover{ background:var(--warn); color:#fff; }
@keyframes dbe-spin{ to{ transform:rotate(360deg); } }
.dbe-spin{ width:14px; height:14px; border:2px solid var(--rule-3); border-top-color:currentColor; border-radius:999px; animation:dbe-spin .8s linear infinite; }

.dbe-actionrow{ display:flex; justify-content:flex-end; min-height:34px; margin-top:16px; }

/* ── Tabla ── */
.dbe-table-wrap{ margin-top:16px; border:1px solid var(--rule-2); border-radius:14px; overflow:hidden; background:var(--paper); animation:dbe-rise .4s var(--ease-out) both; }
.dbe-scroll{ overflow-x:auto; }
.dbe-table{ width:100%; border-collapse:collapse; font-size:13.5px; }
.dbe-table thead th{ text-align:left; padding:12px 20px; font-size:10px; text-transform:uppercase; letter-spacing:.1em; font-weight:600; color:var(--ink-3); background:var(--paper-2); border-bottom:1px solid var(--rule-2); white-space:nowrap; }
.dbe-table tbody tr{ border-bottom:1px solid var(--rule-2); cursor:pointer; transition:background .16s var(--ease), box-shadow .16s var(--ease); }
.dbe-table tbody tr:last-child{ border-bottom:none; }
.dbe-table tbody tr:hover{ background:var(--paper-2); }
.dbe-table tbody tr[data-sel="1"]{ background:var(--accent-s); box-shadow:inset 2px 0 0 var(--accent); }
.dbe-table tbody tr{ animation:dbe-rise .35s var(--ease-out) both; }
.dbe-table tbody tr:nth-child(1){ animation-delay:.02s; }
.dbe-table tbody tr:nth-child(2){ animation-delay:.05s; }
.dbe-table tbody tr:nth-child(3){ animation-delay:.08s; }
.dbe-table tbody tr:nth-child(4){ animation-delay:.11s; }
.dbe-table tbody tr:nth-child(5){ animation-delay:.14s; }
.dbe-table tbody tr:nth-child(n+6){ animation-delay:.16s; }
.dbe-table td{ padding:13px 20px; color:var(--ink-2); vertical-align:middle; }
.dbe-cell-strong{ font-weight:600; color:var(--ink); }
.dbe-cell-mono{ font-family:'JetBrains Mono', monospace; font-size:12px; color:var(--ink-3); }
.dbe-cell-sub{ font-size:11px; color:var(--ink-3); margin-top:2px; }
.dbe-num{ font-family:'JetBrains Mono', monospace; font-weight:500; color:var(--ink); }
.dbe-num-u{ font-size:10px; color:var(--ink-4); margin-left:3px; }

.dbe-avatar{ width:34px; height:34px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; background:var(--paper-3); color:var(--ink-3); border:1px solid var(--rule-2); transition:background .16s var(--ease), color .16s var(--ease), border-color .16s var(--ease); }
.dbe-table tbody tr[data-sel="1"] .dbe-avatar{ background:var(--accent); color:#fff; border-color:var(--accent); }

/* ── Pills de estado (genérico por tono) ── */
.dbe-pill{ display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; line-height:1; white-space:nowrap; border:1px solid transparent; }
.dbe-pill[data-tone="ok"]{ background:var(--ok-s); color:var(--ok); }
.dbe-pill[data-tone="accent"]{ background:var(--accent-s); color:var(--accent); }
.dbe-pill[data-tone="warn"]{ background:var(--warn-s); color:var(--warn); }
.dbe-pill[data-tone="ai"]{ background:var(--ai-s); color:var(--ai); }
.dbe-pill[data-tone="mute"]{ background:var(--paper-3); color:var(--ink-3); }
.dbe-pill .material-icons{ font-size:12px; }
.dbe-tag{ display:inline-block; padding:2px 8px; border-radius:6px; font-size:10.5px; font-weight:600; background:var(--paper-3); color:var(--ink-2); border:1px solid var(--rule-2); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dbe-tags{ display:flex; flex-wrap:wrap; gap:5px; max-width:220px; }
.dbe-muted{ color:var(--ink-4); font-size:12px; font-style:italic; }
.dbe-schedule{ display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:8px; background:var(--paper-2); border:1px solid var(--rule-2); font-size:12px; color:var(--ink-2); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dbe-schedule .material-icons{ font-size:13px; color:var(--ink-4); }

.dbe-empty{ padding:48px 20px; }

/* ── Modal de edición ── */
.dbe-modal-bg{ position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(20,19,16,0.5); backdrop-filter:blur(3px); animation:dbe-fade .15s ease; }
@keyframes dbe-fade{ from{ opacity:0; } to{ opacity:1; } }
.dbe-modal{ width:100%; max-width:640px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; background:var(--paper); border:1px solid var(--rule-2); border-radius:16px; box-shadow:0 24px 80px rgba(20,19,16,0.24); animation:dbe-pop .3s var(--ease-out) both; }
.dbe-modal-head{ padding:20px 24px; border-bottom:1px solid var(--rule-2); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.dbe-modal-head .eyebrow{ color:var(--ink-3); }
.dbe-modal-head h3{ font-family:'Instrument Serif', serif; font-size:22px; font-weight:700; letter-spacing:-0.02em; margin:5px 0 0; }
.dbe-modal-x{ width:34px; height:34px; border-radius:8px; border:none; background:transparent; color:var(--ink-3); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .12s; }
.dbe-modal-x:hover{ background:var(--paper-2); }
.dbe-modal-body{ padding:22px 24px; overflow-y:auto; }
.dbe-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:560px){ .dbe-grid{ grid-template-columns:1fr; } }
.dbe-col-full{ grid-column:1 / -1; }
.dbe-flabel{ display:flex; align-items:center; gap:5px; justify-content:space-between; font-size:10px; text-transform:uppercase; letter-spacing:.08em; font-weight:600; color:var(--ink-3); margin-bottom:6px; }
.dbe-flabel .req{ color:var(--warn); font-size:9px; }
.dbe-flabel .hint{ text-transform:none; letter-spacing:0; font-weight:400; font-size:10.5px; color:var(--ink-4); }
.dbe-field{ width:100%; padding:10px 12px; border:1px solid var(--rule-3); border-radius:9px; background:var(--paper-2); color:var(--ink); font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; transition:border-color .16s var(--ease), box-shadow .16s var(--ease); }
.dbe-field:focus{ border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-s); }
.dbe-field.err{ border-color:var(--warn); }
.dbe-field.sel{ appearance:none; padding-right:34px; cursor:pointer; }
textarea.dbe-field{ resize:vertical; min-height:72px; }
.dbe-errmsg{ margin-top:5px; font-size:11px; color:var(--warn); font-weight:500; }
.dbe-fdesc{ margin-top:5px; font-size:10.5px; color:var(--ink-4); }
.dbe-section-div{ grid-column:1 / -1; display:flex; align-items:center; gap:12px; margin-top:6px; }
.dbe-section-div .ln{ flex:1; height:1px; background:var(--rule-2); }
.dbe-section-div span{ font-size:10px; text-transform:uppercase; letter-spacing:.14em; font-weight:600; color:var(--ink-4); white-space:nowrap; }
.dbe-linked{ display:flex; align-items:center; gap:11px; padding:11px 13px; border:1px solid var(--rule-2); border-radius:10px; background:var(--paper-2); }
.dbe-linked-ico{ width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--paper); border:1px solid var(--rule-2); color:var(--ink-3); }
.dbe-linked-ico .material-icons{ font-size:16px; }
.dbe-linked b{ font-size:14px; font-weight:600; color:var(--ink); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dbe-linked small{ font-size:11px; font-family:'JetBrains Mono', monospace; color:var(--ink-4); }
.dbe-modal-foot{ padding:16px 24px; border-top:1px solid var(--rule-2); display:flex; justify-content:flex-end; gap:10px; }
.dbe-sel-icon{ position:relative; }
.dbe-sel-icon > .material-icons{ position:absolute; right:11px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--ink-4); pointer-events:none; }

/* ── Upload de archivo ── */
.dbe-file{ display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; min-height:88px; border:1.5px dashed var(--rule-3); border-radius:10px; background:var(--paper-2); cursor:pointer; transition:border-color .12s, background .12s; gap:5px; padding:12px; }
.dbe-file:hover{ border-color:var(--accent); }
.dbe-file .material-icons{ font-size:24px; color:var(--ink-4); }
.dbe-file p{ font-size:12px; color:var(--ink-3); margin:0; }
.dbe-file-ok{ display:flex; align-items:center; gap:9px; padding:10px 12px; border-radius:9px; background:var(--ok-s); border:1px solid var(--ok); }
.dbe-file-ok .material-icons{ font-size:16px; color:var(--ok); }
.dbe-file-ok span{ flex:1; font-size:13px; color:var(--ok); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dbe-file-ok a, .dbe-file-ok button{ color:var(--ink-3); background:none; border:none; cursor:pointer; display:flex; }
.dbe-file-ok a .material-icons, .dbe-file-ok button .material-icons{ font-size:15px; }

/* ── Context menu (portal) ── */
.dbe-menu{ position:fixed; z-index:9999; min-width:200px; padding:6px; background:var(--paper); border:1px solid var(--rule-2); border-radius:12px; box-shadow:0 18px 50px rgba(20,19,16,0.22); animation:dbe-pop .16s var(--ease-out) both; transform-origin:top left; }
.dbe-menu-item{ width:100%; display:flex; align-items:center; gap:11px; padding:9px 12px; border-radius:8px; border:none; background:transparent; cursor:pointer; font-family:inherit; font-size:13px; font-weight:500; color:var(--ink-2); text-align:left; transition:background .12s var(--ease); }
.dbe-menu-item:hover{ background:var(--paper-2); }
.dbe-menu-item .material-icons{ font-size:17px; color:var(--ink-4); }
.dbe-menu-item[data-variant="danger"]{ color:var(--warn); }
.dbe-menu-item[data-variant="danger"]:hover{ background:var(--warn-s); }
.dbe-menu-item[data-variant="danger"] .material-icons{ color:var(--warn); }

/* Reduced motion: respetar preferencia del sistema */
@media (prefers-reduced-motion: reduce){
  .dbe *, .dbe *::after, .dbe *::before{
    animation-duration:.001ms !important; animation-delay:0ms !important;
    transition-duration:.001ms !important;
  }
  .dbe-btn:active{ transform:none; }
}
`;function Ea(){ga("dbe-styles",Aa)}Ea();const b=h=>h==null?"":String(h),Oa=({isOpen:h,onClose:N,record:t,initialData:d,tableConfig:c,onSave:U,isSaving:y})=>{const[v,f]=I.useState({}),[V,T]=I.useState(null),[O,g]=I.useState({}),p=!t,k=I.useRef(null);I.useEffect(()=>{const a={};c.fieldConfig.forEach(o=>{let r;if(p)d&&d[o.key]!==void 0?r=d[o.key]:r=o.type==="checkbox"?!1:"";else{const n=o.key;r=t?t[n]:""}typeof r=="string"||Array.isArray(r)?a[o.key]=L(r):a[o.key]=r}),f(a),g({})},[t,c,p,d]);const A=a=>{const{name:o,value:r,type:n}=a.target,x=n==="checkbox",s=a.target.checked;f(l=>({...l,[o]:x?s:r})),O[o]&&g(l=>{const m={...l};return delete m[o],m})},P=()=>{const a={};if(c.fieldConfig.forEach(r=>{if(r.type==="section"||r.type==="file")return;const n=v[r.key];r.required&&(n==null||String(n).trim()==="")&&(a[r.key]=`${r.label} es obligatorio`),!a[r.key]&&r.minLength&&typeof n=="string"&&n.trim().length>0&&n.trim().length<r.minLength&&(a[r.key]=`Mínimo ${r.minLength} caracteres`)}),Object.keys(a).length>0){g(a);return}g({});const o={...v};c.fieldConfig.forEach(r=>{const n=o[r.key];r.type==="number"?n===""||n===null||n===void 0?o[r.key]=null:o[r.key]=Number(n):r.type==="date"?(n===""||n===null||n===void 0)&&(o[r.key]=null):(r.type==="text"||r.type==="textarea"||r.type==="select")&&(o[r.key]=L(n))}),U(t?t.id:null,o)};if(!h)return null;const B=a=>{const o=v[a.key]??"",r=a.type==="checkbox",n=a.type==="textarea",x=`dbe-field${O[a.key]?" err":""}`,s=O[a.key];if(!p&&t){let i=null,u="link";if(a.key===R||a.key===j?(i=t.__studentName,u="person"):(a.key===z||a.key===M)&&(i=t.__lanzamientoName,u="rocket_launch"),i)return e.jsxs("div",{className:"dbe-col-full",children:[e.jsx("label",{className:"dbe-flabel",children:a.label}),e.jsxs("div",{className:"dbe-linked",children:[e.jsx("div",{className:"dbe-linked-ico",children:e.jsx("span",{className:"material-icons",children:u})}),e.jsxs("div",{style:{minWidth:0},children:[e.jsx("b",{children:i}),e.jsxs("small",{children:["ID: ",b(o)]})]})]}),e.jsx("input",{type:"hidden",name:a.key,value:b(o)})]})}if(a.type==="section")return e.jsxs("div",{className:"dbe-section-div",children:[e.jsx("div",{className:"ln"}),e.jsx("span",{children:a.label}),e.jsx("div",{className:"ln"})]});const l=a.isFullWidth||n?"dbe-col-full":"";if(n)return e.jsxs("div",{className:l,children:[e.jsxs("label",{className:"dbe-flabel",children:[e.jsxs("span",{children:[a.label,a.required&&e.jsx("span",{className:"req",children:" ●"})]}),a.description&&e.jsx("span",{className:"hint",children:a.description})]}),e.jsx("textarea",{name:a.key,value:b(o),onChange:A,rows:3,className:x}),s&&e.jsx("p",{className:"dbe-errmsg",children:s})]});if(a.type==="select")return e.jsxs("div",{className:l,children:[e.jsx("label",{className:"dbe-flabel",children:e.jsxs("span",{children:[a.label,a.required&&e.jsx("span",{className:"req",children:" ●"})]})}),e.jsxs("div",{className:"dbe-sel-icon",children:[e.jsxs("select",{name:a.key,value:b(o),onChange:A,className:`${x} sel`,children:[e.jsx("option",{value:"",children:"Seleccionar..."}),a.options?.map(i=>typeof i=="string"?e.jsx("option",{value:i,children:i},i):e.jsx("option",{value:i.value,children:i.label},i.value))]}),e.jsx("span",{className:"material-icons",children:"expand_more"})]}),s&&e.jsx("p",{className:"dbe-errmsg",children:s})]});if(r)return e.jsxs("div",{className:l,style:{display:"flex",alignItems:"center",gap:11,marginTop:8},children:[e.jsx("input",{type:"checkbox",id:a.key,name:a.key,checked:!!o,onChange:A,style:{width:18,height:18,cursor:"pointer",accentColor:"var(--accent)"}}),e.jsxs("div",{style:{display:"flex",flexDirection:"column"},children:[e.jsx("label",{htmlFor:a.key,style:{fontSize:14,fontWeight:600,color:"var(--ink)",cursor:"pointer"},children:a.label}),a.description&&e.jsx("span",{className:"dbe-fdesc",children:a.description})]})]});let m=o;if(a.type==="date"&&typeof o=="string"&&(m=o.split("T")[0]),a.type==="file"){const i=a.fileBucket||"documentos_pps",u=a.filePath||"convocatorias",S=V===a.key;return e.jsxs("div",{className:l,children:[e.jsx("label",{className:"dbe-flabel",children:a.label}),o?e.jsxs("div",{className:"dbe-file-ok",children:[e.jsx("span",{className:"material-icons",children:"check_circle"}),e.jsx("span",{children:"Archivo cargado"}),e.jsx("a",{href:b(o),target:"_blank",rel:"noopener noreferrer",title:"Abrir",children:e.jsx("span",{className:"material-icons",children:"open_in_new"})}),e.jsx("button",{type:"button",onClick:()=>f(C=>({...C,[a.key]:""})),title:"Quitar",children:e.jsx("span",{className:"material-icons",children:"close"})})]}):e.jsxs("label",{className:"dbe-file",children:[e.jsx("span",{className:"material-icons",children:S?"hourglass_top":"cloud_upload"}),e.jsx("p",{children:S?"Subiendo…":"Arrastrá o elegí un archivo"}),e.jsx("input",{type:"file",className:"hidden",accept:".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar",onChange:async C=>{const _=C.target.files?.[0];if(_)try{T(a.key);const E=_.name.split(".").pop(),F=`${u}/${Date.now()}_${Math.random().toString(36).substring(7)}.${E}`,{error:D}=await w.storage.from(i).upload(F,_,{upsert:!0});if(D)throw D;const{data:Z}=w.storage.from(i).getPublicUrl(F);f(H=>({...H,[a.key]:Z.publicUrl}))}catch(E){J.error("Error uploading file:",E),alert("Error al subir archivo: "+q(E))}finally{T(null)}}})]}),a.description&&e.jsx("p",{className:"dbe-fdesc",children:a.description})]})}return e.jsxs("div",{className:l,children:[e.jsx("label",{className:"dbe-flabel",children:e.jsxs("span",{children:[a.label,a.required&&e.jsx("span",{className:"req",children:" ●"})]})}),e.jsx("input",{type:a.type,name:a.key,value:b(m),onChange:A,className:x}),s&&e.jsx("p",{className:"dbe-errmsg",children:s}),a.description&&!s&&e.jsx("p",{className:"dbe-fdesc",children:a.description})]})};return e.jsx("div",{className:"dbe dbe-modal-bg",onMouseDown:a=>{k.current=a.target},onMouseUp:a=>{k.current===a.currentTarget&&a.target===a.currentTarget&&N(),k.current=null},children:e.jsxs("div",{className:"dbe-modal",onClick:a=>a.stopPropagation(),onMouseDown:a=>a.stopPropagation(),children:[e.jsxs("header",{className:"dbe-modal-head",children:[e.jsxs("div",{children:[e.jsxs("span",{className:"eyebrow",children:[p?d?"Duplicar":"Nuevo":"Editar"," · ",c.label]}),e.jsx("h3",{className:"serif",children:p?d?"Duplicar registro":"Nuevo registro":"Editar registro"})]}),e.jsx("button",{onClick:N,className:"dbe-modal-x","aria-label":"Cerrar",children:e.jsx("span",{className:"material-icons",children:"close"})})]}),e.jsx("main",{className:"dbe-modal-body",children:e.jsx("div",{className:"dbe-grid",children:c.fieldConfig.map(a=>e.jsx(G.Fragment,{children:B(a)},a.key))})}),e.jsxs("footer",{className:"dbe-modal-foot",children:[e.jsx("button",{onClick:N,className:"dbe-btn",children:"Cancelar"}),e.jsx("button",{onClick:P,disabled:y,className:"dbe-btn dbe-btn-primary",children:y?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"dbe-spin",style:{borderTopColor:"var(--paper)"}}),"Guardando…"]}):e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"material-icons",children:"save"}),p?"Crear":"Guardar"]})})]})]})})},ka={estudiantes:{_tableName:te,legajo:ie,nombre:ne,orientacionElegida:oe,notasInternas:re,dni:ae,fechaNacimiento:ee,correo:X,telefono:Q,fechaFinalizacion:K,trabaja:Y,certificadoTrabajo:W,finalizaron:$},practicas:{_tableName:pa,nota:ca,estudianteLink:R,lanzamientoVinculado:z,especialidad:da,fechaInicio:la,fechaFin:sa,horasRealizadas:ta,estado:ia,institucionLink:na,nombreInstitucion:oa},convocatorias:{_tableName:ra,informeSubido:aa,fechaEntregaInforme:ea,estadoInscripcion:Xe,lanzamientoVinculado:M,estudianteInscripto:j,nombrePPS:Qe,fechaInicio:Ke,fechaFin:Ye,direccion:We,horario:$e,orientacion:qe,horasAcreditadas:Je,cuposDisponibles:Ge,legajo:He,dni:Ze,correo:Be,fechaNacimiento:Pe,telefono:Ve,terminoCursar:Ue,cursandoElectivas:Me,finalesAdeuda:ze,otraSituacion:je,certificado:Re,trabaja:we,certificadoTrabajo:Le,cvUrl:De},lanzamientos:{_tableName:Fe,estadoGestion:Se,notasGestion:Te,estadoConvocatoria:ye,nombrePPS:_e,fechaInicio:Ce,fechaFin:ke,orientacion:Oe,horasAcreditadas:ve,cuposDisponibles:Ne,permiteCertificado:Ee,reqCertificadoTrabajo:Ae,reqCv:ge,descripcion:fe,actividades:he,requisitoObligatorio:Ie,archivoDescargableNombre:ue,archivoDescargableUrl:me,codigoCampus:xe,fechaInicioInscripcion:be,fechaFinInscripcion:pe,fechaPublicacion:ce,mensajeWhatsApp:de,actividadesLabel:le,horariosFijos:se},instituciones:{_tableName:fa,nombre:ha,direccion:Ia,telefono:ua,convenioNuevo:ma,codigoCampus:xa,orientaciones:ba}};export{Oa as R,Ea as i,ka as s};
