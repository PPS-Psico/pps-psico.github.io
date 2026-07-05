import{c as f,b7 as h,j as a}from"./index-Bf63COEH.js";import{i as u}from"./injectScopedStyles-B_yJaYqk.js";import{i as z}from"./premiumMotion-DiBIURyU.js";const g=`
.pz {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .pz {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --ok:#88BD96; --ok-s:#88BD961A;
}
.pz .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.pz .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

.pz-head{ margin-bottom:6px; }
.pz-head h2{ font-family:'Instrument Serif', serif; font-size:26px; font-weight:700; letter-spacing:-0.025em; margin:5px 0 0; }
.pz-head p{ font-size:13.5px; color:var(--ink-3); margin:6px 0 0; max-width:560px; }

.pz-group{ margin-top:28px; }
.pz-group-title{ margin-bottom:12px; }
.pz-rows{ display:flex; flex-direction:column; gap:8px; }

.pz-row{ display:flex; align-items:center; justify-content:space-between; gap:16px; width:100%; text-align:left; cursor:pointer; border:1px solid var(--rule-2); border-radius:12px; background:var(--paper); padding:14px 16px; font-family:inherit; transition:border-color .12s, background .12s; }
.pz-row:hover{ background:var(--paper-2); }
.pz-row[data-on="1"]{ border-color:var(--rule-3); }
.pz-row:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
.pz-row-main{ display:flex; align-items:center; gap:13px; min-width:0; }
.pz-ico{ width:38px; height:38px; flex-shrink:0; border-radius:10px; display:flex; align-items:center; justify-content:center; background:var(--paper-3); color:var(--ink-3); transition:background .12s, color .12s; }
.pz-row[data-on="1"] .pz-ico{ background:var(--accent-s); color:var(--accent); }
.pz-ico .material-icons{ font-size:20px; }
.pz-row-label{ font-size:14px; font-weight:600; color:var(--ink); }
.pz-row-desc{ font-size:12px; color:var(--ink-3); margin-top:2px; line-height:1.45; }

.pz-switch{ position:relative; width:42px; height:23px; flex-shrink:0; border-radius:999px; background:var(--rule-3); transition:background .15s; }
.pz-row[data-on="1"] .pz-switch{ background:var(--ok); }
.pz-switch span{ position:absolute; top:2.5px; left:2.5px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .15s; }
.pz-row[data-on="1"] .pz-switch span{ transform:translateX(19px); }

.pz-foot{ margin-top:28px; padding-top:20px; border-top:1px solid var(--rule-2); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
.pz-note{ display:inline-flex; align-items:center; gap:7px; font-size:11.5px; color:var(--ink-3); }
.pz-note .material-icons{ font-size:14px; color:var(--ink-4); }
.pz-reset{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; color:var(--ink-3); background:none; border:none; cursor:pointer; font-family:inherit; transition:color .12s; }
.pz-reset:hover{ color:var(--ink); }
.pz-reset .material-icons{ font-size:16px; }
`;u("pz-styles",g);z();const k=[{title:"Experiencia principal",items:[{key:"showAiInsights",label:"Briefing de Hermes",description:"Muestra el resumen inteligente y las alertas en Inicio.",icon:"auto_awesome"},{key:"showManagementTab",label:"Gestión y planificación",description:"Habilita la planificación futura y la gestión de relanzamientos.",icon:"rocket_launch"},{key:"showLaunchHistory",label:"Historial de lanzamientos",description:"Muestra la pestaña de historial en el Lanzador.",icon:"history"}]},{title:"Herramientas del taller",items:[{key:"showPenalizations",label:"Penalizaciones",description:"Aplicar y visualizar sanciones a los alumnos.",icon:"gavel"},{key:"showAutomation",label:"Automatizaciones",description:"Editor de plantillas de mail y push.",icon:"mark_email_read"},{key:"showNewAgreements",label:"Convenios nuevos",description:"Confirmar los convenios institucionales del ciclo.",icon:"handshake"},{key:"showAgreementGenerator",label:"Generador de convenios",description:"Redacción de convenios marco y específicos con IA.",icon:"auto_awesome"},{key:"showReports",label:"Reportes",description:"Balances anuales y comparativos para Métricas.",icon:"summarize"},{key:"showBackups",label:"Backups",description:"Respaldos automáticos y manuales de la base.",icon:"backup"}]}],v=()=>{const e=f.c(11),{preferences:c,toggleModule:p,resetPreferences:d}=h();let r;e[0]===Symbol.for("react.memo_cache_sentinel")?(r=a.jsxs("div",{className:"pz-head",children:[a.jsx("span",{className:"eyebrow",children:"Sistema · preferencias"}),a.jsx("h2",{className:"serif",children:"Personalización"}),a.jsx("p",{children:"Prendé o apagá los módulos del panel según tu flujo. Es una preferencia de este navegador: no cambia la experiencia de otros administradores."})]}),e[0]=r):r=e[0];let s;e[1]!==c||e[2]!==p?(s=k.map(m=>a.jsxs("section",{className:"pz-group",children:[a.jsx("div",{className:"pz-group-title",children:a.jsx("span",{className:"eyebrow",children:m.title})}),a.jsx("div",{className:"pz-rows",children:m.items.map(n=>{const x=c[n.key];return a.jsxs("button",{className:"pz-row","data-on":x?"1":"0",onClick:()=>p(n.key),role:"switch","aria-checked":x,children:[a.jsxs("span",{className:"pz-row-main",children:[a.jsx("span",{className:"pz-ico",children:a.jsx("span",{className:"material-icons",children:n.icon})}),a.jsxs("span",{style:{minWidth:0},children:[a.jsx("span",{className:"pz-row-label",children:n.label}),a.jsx("span",{className:"pz-row-desc",style:{display:"block"},children:n.description})]})]}),a.jsx("span",{className:"pz-switch","aria-hidden":"true",children:a.jsx("span",{})})]},n.key)})})]},m.title)),e[1]=c,e[2]=p,e[3]=s):s=e[3];let o;e[4]===Symbol.for("react.memo_cache_sentinel")?(o=a.jsxs("span",{className:"pz-note",children:[a.jsx("span",{className:"material-icons",children:"devices"}),"Estos ajustes se guardan solo en este navegador."]}),e[4]=o):o=e[4];let t;e[5]===Symbol.for("react.memo_cache_sentinel")?(t=a.jsx("span",{className:"material-icons",children:"restart_alt"}),e[5]=t):t=e[5];let i;e[6]!==d?(i=a.jsxs("div",{className:"pz-foot",children:[o,a.jsxs("button",{className:"pz-reset",onClick:d,children:[t,"Restaurar valores por defecto"]})]}),e[6]=d,e[7]=i):i=e[7];let l;return e[8]!==s||e[9]!==i?(l=a.jsxs("div",{className:"pz",children:[r,s,i]}),e[8]=s,e[9]=i,e[10]=l):l=e[10],l};export{v as default};
