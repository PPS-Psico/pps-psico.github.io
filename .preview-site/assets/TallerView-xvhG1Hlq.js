const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./DatabaseEditor-58869AJ1.js","./index-Bf63COEH.js","./index-CTZWBAWr.css","./dbSchema-DNJ7jBHR.js","./injectScopedStyles-B_yJaYqk.js","./types-D6En6lfa.js","./AdminSearch-XX2yvqpr.js","./PenalizationManager-CxGbE3Bf.js","./premiumMotion-DiBIURyU.js","./EmailAutomationManager-jcxKv18A.js","./NuevosConvenios-DrC3M0na.js","./conveniosService-DcfiPfa0.js","./ConveniosPorVencerPanel-B78bDsCj.js","./BackupManager-CpxAozSx.js","./ConvenioGenerator-KI9VGScJ.js","./_commonjs-dynamic-modules-TDtrdbi3.js","./geminiService-D_f4Akzb.js","./SeguroGenerator-DbpaYdDt.js","./aseguramientoService-jZuyHPqy.js","./PersonalizationPanel-DI_mGkb0.js","./InformeCampusLinker-C6GIcYAj.js"])))=>i.map(i=>d[i]);
import{c as ue,b7 as je,g as Se,f as Ee,r as u,o as Ne,j as a,aW as ye,b8 as j,K as ke,M as we,R as ze,a2 as Ae,ax as S,N as Te,_ as be,b9 as Ce,ba as Pe,bb as Ie,b3 as Oe}from"./index-Bf63COEH.js";import{R as Le,s as Re}from"./dbSchema-DNJ7jBHR.js";import{i as De}from"./injectScopedStyles-B_yJaYqk.js";const Ve=u.lazy(()=>S(()=>import("./DatabaseEditor-58869AJ1.js"),__vite__mapDeps([0,1,2,3,4,5,6]),import.meta.url)),Be=u.lazy(()=>S(()=>import("./PenalizationManager-CxGbE3Bf.js"),__vite__mapDeps([7,1,2,6,4,8]),import.meta.url)),Ge=u.lazy(()=>S(()=>import("./EmailAutomationManager-jcxKv18A.js"),__vite__mapDeps([9,1,2,4,8]),import.meta.url)),Me=u.lazy(()=>S(()=>import("./NuevosConvenios-DrC3M0na.js"),__vite__mapDeps([10,1,2,11,4,8]),import.meta.url)),qe=u.lazy(()=>S(()=>import("./ConveniosPorVencerPanel-B78bDsCj.js"),__vite__mapDeps([12,1,2,11,4,8]),import.meta.url)),Fe=u.lazy(()=>S(()=>import("./BackupManager-CpxAozSx.js"),__vite__mapDeps([13,1,2,3,4]),import.meta.url)),Ke=u.lazy(()=>S(()=>import("./ConvenioGenerator-KI9VGScJ.js"),__vite__mapDeps([14,1,2,15,16,4,8]),import.meta.url)),$e=u.lazy(()=>S(()=>import("./SeguroGenerator-DbpaYdDt.js"),__vite__mapDeps([17,1,2,18,4,8]),import.meta.url)),Ue=u.lazy(()=>S(()=>import("./PersonalizationPanel-DI_mGkb0.js"),__vite__mapDeps([19,1,2,4,8]),import.meta.url)),He=u.lazy(()=>S(()=>import("./AdminSearch-XX2yvqpr.js"),__vite__mapDeps([6,1,2]),import.meta.url)),We=u.lazy(()=>S(()=>import("./InformeCampusLinker-C6GIcYAj.js"),__vite__mapDeps([20,1,2]),import.meta.url)),Qe=`
.taller {
  min-height: calc(100vh - 60px);
  background: var(--paper);
  color: var(--ink);
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
}
.taller-main { max-width: 1280px; margin: 0 auto; padding: 0 48px 72px; }

/* Head */
.taller-head { padding: 40px 0 24px; border-bottom: 1px solid var(--rule-2); }
.taller-title {
  margin: 8px 0 0; font-size: 46px; font-weight: 400;
  letter-spacing: -0.015em; line-height: 1.0;
  font-family: 'Instrument Serif', Georgia, serif;
}
.taller-sub { margin: 10px 0 0; font-size: 15px; color: var(--ink-3); line-height: 1.6; max-width: 560px; }

/* Family section */
.taller-family { padding: 30px 0 4px; }
.taller-family-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px; margin-bottom: 14px;
}
.taller-family-note { font-size: 12px; color: var(--ink-4); }

/* Grid of tool cards */
.taller-grid {
  display: grid; gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 720px) { .taller-grid { grid-template-columns: 1fr; } }

/* Tool card */
.taller-card {
  display: flex; flex-direction: column; gap: 10px;
  padding: 18px 20px; border-radius: 14px;
  border: 1px solid var(--rule-2); background: var(--paper);
  cursor: pointer; text-align: left; width: 100%; font-family: inherit;
  transition: background .12s ease, border-color .12s ease, transform .12s ease;
  position: relative;
}
.taller-card:hover { background: var(--paper-2); border-color: var(--rule-3); }
.taller-card:active { transform: translateY(0.5px); }
.taller-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.taller-card.adv { background: transparent; border-style: dashed; }
.taller-card.adv:hover { background: var(--warn-soft); border-color: var(--warn); }

.taller-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.taller-card-icon {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--paper-2); color: var(--ink-2); border: 1px solid var(--rule-2);
}
.taller-card.adv .taller-card-icon { background: var(--warn-soft); color: var(--warn); border-color: transparent; }
.taller-card-name {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 17px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink);
}
.taller-card-desc { font-size: 13px; line-height: 1.5; color: var(--ink-3); }

/* Badge (dato vivo) */
.taller-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums;
  background: var(--paper-2); color: var(--ink-3); border: 1px solid var(--rule-2);
  white-space: nowrap;
}
.taller-badge.warn { background: var(--warn-soft); color: var(--warn); border-color: transparent; }
.taller-badge.ok { background: var(--ok-soft); color: var(--ok); border-color: transparent; }
.taller-badge.ai { background: var(--ai-soft); color: var(--ai); border-color: transparent; }
.taller-badge .dot { width: 6px; height: 6px; }

.taller-arrow {
  position: absolute; right: 18px; bottom: 16px;
  color: var(--ink-4); opacity: 0; transform: translateX(-4px);
  transition: opacity .12s ease, transform .12s ease;
}
.taller-card:hover .taller-arrow { opacity: 1; transform: translateX(0); }

/* Advanced banner */
.taller-adv-head {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  font-weight: 600; color: var(--warn);
}

/* Workspace */
.taller-ws-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 28px 0 20px; border-bottom: 1px solid var(--rule-2);
  margin-bottom: 28px; flex-wrap: wrap;
}
.taller-crumb {
  display: inline-flex; align-items: center; gap: 8px;
  background: none; border: none; cursor: pointer; font-family: inherit;
  font-size: 13px; color: var(--ink-3); padding: 0;
}
.taller-crumb:hover { color: var(--ink); }
.taller-crumb b { color: var(--ink); font-weight: 600; }
.taller-ws-title {
  margin: 10px 0 0; font-size: 30px; font-weight: 700; letter-spacing: -0.03em;
  font-family: 'Hanken Grotesk', system-ui, sans-serif; line-height: 1.1;
}
.taller-ws-sub { margin: 8px 0 0; font-size: 14px; color: var(--ink-3); max-width: 600px; line-height: 1.5; }

/* Confirm modal (guarda zona avanzada) */
.taller-modal-bg {
  position: fixed; inset: 0; background: rgba(20,19,16,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px;
  animation: taller-fade .15s ease;
}
@keyframes taller-fade { from { opacity: 0; } to { opacity: 1; } }
.taller-modal {
  background: var(--paper); border-radius: 16px; max-width: 440px; width: 100%;
  border: 1px solid var(--rule-2); box-shadow: 0 24px 80px rgba(20,19,16,0.2);
  padding: 26px 28px;
}

/* Footer */
.taller-foot {
  margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--rule-2);
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
}
`;De("taller-styles",Qe);const Je=[{id:"personas",label:"Personas y datos",note:"Lo que usás a diario",tools:[{id:"search",name:"Buscar alumno",desc:"Encontrá un legajo, abrí su panel o dá de alta uno nuevo.",icon:"person_search"}]},{id:"documentos",label:"Convenios y documentos",note:"Generación de documentación",tools:[{id:"convenios-gen",name:"Generador de convenios",desc:"Redactá el convenio marco o específico de una institución con IA.",icon:"draft",prefKey:"showAgreementGenerator"},{id:"seguros",name:"Generador de seguros",desc:"Armá la planilla de seguro ART con los alumnos seleccionados.",icon:"shield"},{id:"convenios-nuevos",name:"Convenios nuevos",desc:"Confirmá las instituciones que se incorporan este ciclo.",icon:"handshake",prefKey:"showNewAgreements"},{id:"convenios-vencer",name:"Vencimientos de convenios",desc:"Registrá convenios/renovaciones y revisá los próximos a vencer.",icon:"event_busy"},{id:"informe-campus",name:"Espacio de informe (Campus)",desc:"Vinculá la Tarea de Moodle a una PPS ya lanzada para habilitar la entrega de informe.",icon:"assignment_turned_in"}]},{id:"disciplina",label:"Disciplina",note:"Seguimiento de incumplimientos",tools:[{id:"penalizaciones",name:"Penalizaciones",desc:"Aplicá y seguí las sanciones por bajas, ausencias y abandonos.",icon:"gavel",prefKey:"showPenalizations"}]},{id:"sistema",label:"Sistema y ajustes",note:"Configuración del panel",tools:[{id:"automation",name:"Automatizaciones",desc:"Plantillas de mail y push: editá, activá y probá los envíos.",icon:"mark_email_read",prefKey:"showAutomation"},{id:"personalization",name:"Personalización",desc:"Prendé o apagá módulos del panel. Es preferencia de este navegador.",icon:"tune"}]}],Xe=[{id:"editor-db",name:"Editor de base de datos",desc:"Edición directa de todas las tablas. Sin red de seguridad.",icon:"database",advanced:!0},{id:"backups",name:"Backups",desc:"Respaldos y restauración. Restaurar reemplaza datos actuales.",icon:"settings_backup_restore",advanced:!0,prefKey:"showBackups"}],Ye={search:{title:"Buscar alumno",sub:"Buscá por nombre o legajo para abrir el panel del estudiante, o registrá uno nuevo.",crumb:"Buscar alumno"},"editor-db":{title:"Editor de base de datos",sub:"Edición directa de los registros. Cada cambio impacta la base al instante.",crumb:"Editor DB"},"convenios-gen":{title:"Generador de convenios",sub:"Subí la información de la institución y la IA redacta el convenio marco o específico.",crumb:"Generador de convenios"},seguros:{title:"Generador de seguros",sub:"Elegí las convocatorias con alumnos seleccionados y armá la planilla de seguro ART.",crumb:"Generador de seguros"},"convenios-nuevos":{title:"Convenios nuevos",sub:"Confirmá las instituciones que firman convenio este ciclo.",crumb:"Convenios nuevos"},"convenios-vencer":{title:"Vencimientos de convenios",sub:"Registrá convenios y renovaciones, y revisá los que están próximos a vencer.",crumb:"Vencimientos"},"informe-campus":{title:"Espacio de informe (Campus)",sub:"Pegá el link de la Tarea de Moodle en una PPS ya lanzada y el campus generará sola la tarjeta de entrega de informe. Pensado para PPS viejas que se lanzaron antes de esta función.",crumb:"Espacio de informe"},penalizaciones:{title:"Penalizaciones",sub:"Aplicá sanciones y revisá el historial y el puntaje acumulado de cada alumno.",crumb:"Penalizaciones"},automation:{title:"Automatizaciones",sub:"Editá las plantillas de correo y push, activá los envíos y mandá pruebas.",crumb:"Automatizaciones"},backups:{title:"Backups",sub:"Respaldos automáticos y manuales. La restauración reemplaza los datos actuales.",crumb:"Backups"},personalization:{title:"Personalización",sub:"Activá o desactivá módulos del panel. Sólo afecta a este navegador.",crumb:"Personalización"}};function Ze(p){return Ae({queryKey:["tallerBadges",p],enabled:!p,staleTime:1e3*60*5,queryFn:async()=>{const e={};try{const{data:n}=await be.from(Ce).select("estudiante_id");if(n&&n.length){const i=new Set(n.map(s=>s.estudiante_id).filter(Boolean));i.size>0&&(e.penalizaciones={text:`${i.size} con sanciones`,tone:"warn"})}}catch{}try{const n=new Date().getFullYear(),{count:i}=await be.from(Pe).select("id",{count:"exact",head:!0}).eq(Ie,n);i&&i>0&&(e["convenios-nuevos"]={text:`${i} este ciclo`,tone:"ok"})}catch{}try{const{count:n}=await be.from("email_templates").select("id",{count:"exact",head:!0}).eq("is_active",!0);n&&n>0&&(e.automation={text:`${n} activas`,tone:"neutral"})}catch{}return e}})}const _e=p=>{const e=ue.c(24),{tool:n,badge:i,onOpen:s}=p,l=`taller-card ${n.advanced?"adv":""}`;let f;e[0]!==s||e[1]!==n?(f=()=>s(n),e[0]=s,e[1]=n,e[2]=f):f=e[2];let h;e[3]===Symbol.for("react.memo_cache_sentinel")?(h={fontSize:20},e[3]=h):h=e[3];let t;e[4]!==n.icon?(t=a.jsx("span",{className:"taller-card-icon",children:a.jsx("span",{className:"material-icons",style:h,children:n.icon})}),e[4]=n.icon,e[5]=t):t=e[5];let m;e[6]!==i?(m=i&&a.jsxs("span",{className:`taller-badge ${i.tone}`,children:[i.dot&&a.jsx("span",{className:"dot dot-ai"}),i.text]}),e[6]=i,e[7]=m):m=e[7];let o;e[8]!==t||e[9]!==m?(o=a.jsxs("div",{className:"taller-card-top",children:[t,m]}),e[8]=t,e[9]=m,e[10]=o):o=e[10];let b;e[11]!==n.name?(b=a.jsx("div",{className:"taller-card-name",children:n.name}),e[11]=n.name,e[12]=b):b=e[12];let d;e[13]!==n.desc?(d=a.jsx("div",{className:"taller-card-desc",children:n.desc}),e[13]=n.desc,e[14]=d):d=e[14];let x;e[15]!==b||e[16]!==d?(x=a.jsxs("div",{children:[b,d]}),e[15]=b,e[16]=d,e[17]=x):x=e[17];let r;e[18]===Symbol.for("react.memo_cache_sentinel")?(r=a.jsx("span",{className:"material-icons taller-arrow",style:{fontSize:18},children:"arrow_forward"}),e[18]=r):r=e[18];let g;return e[19]!==l||e[20]!==f||e[21]!==o||e[22]!==x?(g=a.jsxs("button",{className:l,onClick:f,children:[o,x,r]}),e[19]=l,e[20]=f,e[21]=o,e[22]=x,e[23]=g):g=e[23],g},ea=p=>{const e=ue.c(25),{tool:n,onConfirm:i,onCancel:s}=p;let l;e[0]===Symbol.for("react.memo_cache_sentinel")?(l={display:"inline-flex",alignItems:"center",gap:8,color:"var(--warn)",marginBottom:10},e[0]=l):l=e[0];let f;e[1]===Symbol.for("react.memo_cache_sentinel")?(f=a.jsx("span",{className:"material-icons",style:{fontSize:18},children:"warning_amber"}),e[1]=f):f=e[1];let h;e[2]===Symbol.for("react.memo_cache_sentinel")?(h=a.jsxs("div",{style:l,children:[f,a.jsx("span",{className:"eyebrow",style:{color:"var(--warn)"},children:"Zona avanzada"})]}),e[2]=h):h=e[2];let t;e[3]===Symbol.for("react.memo_cache_sentinel")?(t={margin:"0 0 8px",fontSize:21,fontWeight:700,letterSpacing:"-0.02em"},e[3]=t):t=e[3];let m;e[4]!==n.name?(m=a.jsxs("h3",{className:"serif",style:t,children:["Vas a abrir ",n.name]}),e[4]=n.name,e[5]=m):m=e[5];let o;e[6]===Symbol.for("react.memo_cache_sentinel")?(o={margin:0,fontSize:14,lineHeight:1.55,color:"var(--ink-2)"},e[6]=o):o=e[6];const b=n.id==="backups"?"Esta herramienta crea y restaura respaldos. Restaurar un backup reemplaza los datos actuales y no se puede deshacer.":"Esta herramienta edita los registros directamente en la base. Cada cambio impacta al instante, sin confirmación previa por registro.";let d;e[7]!==b?(d=a.jsx("p",{style:o,children:b}),e[7]=b,e[8]=d):d=e[8];let x;e[9]===Symbol.for("react.memo_cache_sentinel")?(x={display:"flex",gap:8,justifyContent:"flex-end",marginTop:22},e[9]=x):x=e[9];let r;e[10]!==s?(r=a.jsx("button",{className:"btn press",onClick:s,children:"Cancelar"}),e[10]=s,e[11]=r):r=e[11];let g;e[12]===Symbol.for("react.memo_cache_sentinel")?(g=a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"check"}),e[12]=g):g=e[12];let v;e[13]!==i?(v=a.jsxs("button",{className:"btn btn-primary press",onClick:i,children:[g,"Entiendo, continuar"]}),e[13]=i,e[14]=v):v=e[14];let y;e[15]!==r||e[16]!==v?(y=a.jsxs("div",{style:x,children:[r,v]}),e[15]=r,e[16]=v,e[17]=y):y=e[17];let _;e[18]!==y||e[19]!==m||e[20]!==d?(_=a.jsxs("div",{className:"taller-modal",onClick:sa,children:[h,m,d,y]}),e[18]=y,e[19]=m,e[20]=d,e[21]=_):_=e[21];let N;return e[22]!==s||e[23]!==_?(N=a.jsx("div",{className:"taller-modal-bg",onClick:s,children:_}),e[22]=s,e[23]=_,e[24]=N):N=e[24],N},aa=()=>{const p=ue.c(1);let e;return p[0]===Symbol.for("react.memo_cache_sentinel")?(e=a.jsx("div",{style:{display:"flex",justifyContent:"center",padding:64},children:a.jsx(Oe,{})}),p[0]=e):e=p[0],e},ta={label:"Estudiante",schema:Re.estudiantes,fieldConfig:[{key:ke,label:"Nombre Completo",type:"text"},{key:we,label:"Legajo",type:"text"},{key:ze,label:"Notas (Opcional)",type:"textarea"}]},oa=p=>{const e=ue.c(117),{onStudentSelect:n,isTestingMode:i}=p,s=i===void 0?!1:i,{preferences:l}=je(),{showModal:f}=Se(),h=Ee(),[t,m]=u.useState(null),[o,b]=u.useState(null),[d,x]=u.useState(!1),[r,g]=u.useState(null),{data:v}=Ze(s);let y;e[0]!==s?(y=c=>s?new Promise(na):Te.estudiantes.create(c),e[0]=s,e[1]=y):y=e[1];let _;e[2]!==h?(_=()=>{g({message:"Estudiante registrado correctamente.",type:"success"}),x(!1),h.invalidateQueries({queryKey:["databaseEditor","estudiantes"]})},e[2]=h,e[3]=_):_=e[3];let N;e[4]===Symbol.for("react.memo_cache_sentinel")?(N=c=>g({message:`Error al crear: ${c.message}`,type:"error"}),e[4]=N):N=e[4];let Z;e[5]!==y||e[6]!==_?(Z={mutationFn:y,onSuccess:_,onError:N},e[5]=y,e[6]=_,e[7]=Z):Z=e[7];const ee=Ne(Z);let ae;e[8]!==l?(ae=c=>!c.prefKey||l[c.prefKey],e[8]=l,e[9]=ae):ae=e[9];const A=ae;let te;e[10]===Symbol.for("react.memo_cache_sentinel")?(te=c=>{if(c.advanced){b(c);return}m(c.id)},e[10]=te):te=e[10];const ge=te;let se;e[11]!==o?(se=()=>{o&&m(o.id),b(null)},e[11]=o,e[12]=se):se=e[12];const fe=se;if(!t){let c,E,W,Q,w,J;if(e[13]!==v||e[14]!==A||e[15]!==r){const he=Xe.filter(A);Q="taller",e[22]!==r?(w=r&&a.jsx(ye,{message:r.message,type:r.type,onClose:()=>g(null)}),e[22]=r,e[23]=w):w=e[23],J="taller-main",e[24]===Symbol.for("react.memo_cache_sentinel")?(c=a.jsxs("header",{className:"taller-head",children:[a.jsx("span",{className:"eyebrow",children:"Taller · administración PPS"}),a.jsx("h1",{className:"taller-title",children:"Taller"}),a.jsx("p",{className:"taller-sub",children:"Herramientas para mantener el sistema al día: personas, documentos, disciplina y ajustes del panel."})]}),e[24]=c):c=e[24],e[25]!==v||e[26]!==A?(E=Je.map(z=>{const ve=z.tools.filter(A);return ve.length===0?null:a.jsxs("section",{className:"taller-family",children:[a.jsxs("div",{className:"taller-family-head",children:[a.jsx("span",{className:"eyebrow",children:z.label}),a.jsx("span",{className:"taller-family-note",children:z.note})]}),a.jsx("div",{className:"taller-grid",children:ve.map(xe=>a.jsx(_e,{tool:xe,badge:v?.[xe.id],onOpen:ge},xe.id))})]},z.id)}),e[25]=v,e[26]=A,e[27]=E):E=e[27],W=he.length>0&&a.jsxs("section",{className:"taller-family",children:[a.jsxs("div",{className:"taller-family-head",children:[a.jsxs("span",{className:"taller-adv-head",children:[a.jsx("span",{className:"material-icons",style:{fontSize:14},children:"warning_amber"}),"Avanzado"]}),a.jsx("span",{className:"taller-family-note",children:"Acciones que modifican datos directamente"})]}),a.jsx("div",{className:"taller-grid",children:he.map(z=>a.jsx(_e,{tool:z,badge:v?.[z.id],onOpen:ge},z.id))})]}),e[13]=v,e[14]=A,e[15]=r,e[16]=c,e[17]=E,e[18]=W,e[19]=Q,e[20]=w,e[21]=J}else c=e[16],E=e[17],W=e[18],Q=e[19],w=e[20],J=e[21];let de;e[28]===Symbol.for("react.memo_cache_sentinel")?(de=a.jsx("div",{className:"meta",children:"Mi Panel Académico · PPS · UFLO Psicología"}),e[28]=de):de=e[28];let me;e[29]===Symbol.for("react.memo_cache_sentinel")?(me=a.jsxs("footer",{className:"taller-foot",children:[de,a.jsx("div",{className:"meta mono",style:{display:"flex",gap:16,alignItems:"center",fontSize:11},children:a.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:6,color:"var(--ok)"},children:[a.jsx("span",{className:"dot dot-ok dot-live"})," Hermes online"]})})]}),e[29]=me):me=e[29];let X;e[30]!==c||e[31]!==E||e[32]!==W||e[33]!==J?(X=a.jsxs("div",{className:J,children:[c,E,W,me]}),e[30]=c,e[31]=E,e[32]=W,e[33]=J,e[34]=X):X=e[34];let Y;e[35]!==fe||e[36]!==o?(Y=o&&a.jsx(ea,{tool:o,onConfirm:fe,onCancel:()=>b(null)}),e[35]=fe,e[36]=o,e[37]=Y):Y=e[37];let pe;return e[38]!==Q||e[39]!==w||e[40]!==X||e[41]!==Y?(pe=a.jsxs("div",{className:Q,children:[w,X,Y]}),e[38]=Q,e[39]=w,e[40]=X,e[41]=Y,e[42]=pe):pe=e[42],pe}const k=Ye[t];let T;e[43]!==r?(T=r&&a.jsx(ye,{message:r.message,type:r.type,onClose:()=>g(null)}),e[43]=r,e[44]=T):T=e[44];let ne;e[45]===Symbol.for("react.memo_cache_sentinel")?(ne={minWidth:0},e[45]=ne):ne=e[45];let le;e[46]===Symbol.for("react.memo_cache_sentinel")?(le=()=>m(null),e[46]=le):le=e[46];let re;e[47]===Symbol.for("react.memo_cache_sentinel")?(re=a.jsx("span",{className:"material-icons",style:{fontSize:16},children:"arrow_back"}),e[47]=re):re=e[47];let ie;e[48]===Symbol.for("react.memo_cache_sentinel")?(ie=a.jsx("span",{style:{color:"var(--ink-4)"},children:"/"}),e[48]=ie):ie=e[48];let C;e[49]!==k.crumb?(C=a.jsxs("button",{className:"taller-crumb",onClick:le,children:[re,"Taller ",ie," ",a.jsx("b",{children:k.crumb})]}),e[49]=k.crumb,e[50]=C):C=e[50];let P;e[51]!==k.title?(P=a.jsx("h1",{className:"taller-ws-title",children:k.title}),e[51]=k.title,e[52]=P):P=e[52];let I;e[53]!==k.sub?(I=a.jsx("p",{className:"taller-ws-sub",children:k.sub}),e[53]=k.sub,e[54]=I):I=e[54];let O;e[55]!==C||e[56]!==P||e[57]!==I?(O=a.jsx("div",{className:"taller-ws-head",children:a.jsxs("div",{style:ne,children:[C,P,I]})}),e[55]=C,e[56]=P,e[57]=I,e[58]=O):O=e[58];let oe;e[59]===Symbol.for("react.memo_cache_sentinel")?(oe=a.jsx(aa,{}),e[59]=oe):oe=e[59];let L;e[60]!==t||e[61]!==ee||e[62]!==d||e[63]!==s||e[64]!==n?(L=t==="search"&&a.jsx(j,{children:a.jsxs("div",{style:{maxWidth:640,margin:"0 auto"},children:[a.jsx("div",{className:"field",style:{padding:0,display:"flex",alignItems:"center",height:48},children:a.jsx(He,{onStudentSelect:n,isTestingMode:s})}),a.jsxs("div",{style:{marginTop:28,paddingTop:24,borderTop:"1px solid var(--rule-2)",textAlign:"center"},children:[a.jsx("p",{style:{fontSize:13,color:"var(--ink-3)",margin:"0 0 14px"},children:"¿No encontrás al estudiante? Agregalo con nombre y legajo."}),a.jsxs("button",{className:"btn btn-primary press",onClick:()=>x(!0),children:[a.jsx("span",{className:"material-icons",style:{fontSize:16},children:"person_add"}),"Alta rápida de estudiante"]})]}),d&&a.jsx(Le,{isOpen:d,onClose:()=>x(!1),record:null,tableConfig:ta,onSave:(c,E)=>ee.mutate(E),isSaving:ee.isPending})]})}),e[60]=t,e[61]=ee,e[62]=d,e[63]=s,e[64]=n,e[65]=L):L=e[65];let R;e[66]!==t||e[67]!==s?(R=t==="editor-db"&&a.jsx(j,{children:a.jsx(Ve,{isTestingMode:s})}),e[66]=t,e[67]=s,e[68]=R):R=e[68];let D;e[69]!==t||e[70]!==s||e[71]!==l?(D=t==="convenios-gen"&&l.showAgreementGenerator&&a.jsx(j,{children:a.jsx(Ke,{isTestingMode:s})}),e[69]=t,e[70]=s,e[71]=l,e[72]=D):D=e[72];let V;e[73]!==t||e[74]!==s||e[75]!==f?(V=t==="seguros"&&a.jsx(j,{children:a.jsx($e,{showModal:f,isTestingMode:s})}),e[73]=t,e[74]=s,e[75]=f,e[76]=V):V=e[76];let B;e[77]!==t||e[78]!==s||e[79]!==l?(B=t==="convenios-nuevos"&&l.showNewAgreements&&a.jsx(j,{children:a.jsx(Me,{isTestingMode:s})}),e[77]=t,e[78]=s,e[79]=l,e[80]=B):B=e[80];let G;e[81]!==t||e[82]!==s?(G=t==="convenios-vencer"&&a.jsx(j,{children:a.jsx(qe,{isTestingMode:s})}),e[81]=t,e[82]=s,e[83]=G):G=e[83];let M;e[84]!==t||e[85]!==s?(M=t==="informe-campus"&&a.jsx(j,{children:a.jsx(We,{isTestingMode:s})}),e[84]=t,e[85]=s,e[86]=M):M=e[86];let q;e[87]!==t||e[88]!==s||e[89]!==l?(q=t==="penalizaciones"&&l.showPenalizations&&a.jsx(j,{children:a.jsx(Be,{isTestingMode:s})}),e[87]=t,e[88]=s,e[89]=l,e[90]=q):q=e[90];let F;e[91]!==t||e[92]!==l?(F=t==="automation"&&l.showAutomation&&a.jsx(j,{children:a.jsx(Ge,{})}),e[91]=t,e[92]=l,e[93]=F):F=e[93];let K;e[94]!==t||e[95]!==l?(K=t==="backups"&&l.showBackups&&a.jsx(j,{children:a.jsx(Fe,{})}),e[94]=t,e[95]=l,e[96]=K):K=e[96];let $;e[97]!==t?($=t==="personalization"&&a.jsx(j,{children:a.jsx(Ue,{})}),e[97]=t,e[98]=$):$=e[98];let U;e[99]!==L||e[100]!==R||e[101]!==D||e[102]!==V||e[103]!==B||e[104]!==G||e[105]!==M||e[106]!==q||e[107]!==F||e[108]!==K||e[109]!==$?(U=a.jsxs(u.Suspense,{fallback:oe,children:[L,R,D,V,B,G,M,q,F,K,$]}),e[99]=L,e[100]=R,e[101]=D,e[102]=V,e[103]=B,e[104]=G,e[105]=M,e[106]=q,e[107]=F,e[108]=K,e[109]=$,e[110]=U):U=e[110];let H;e[111]!==O||e[112]!==U?(H=a.jsxs("div",{className:"taller-main",children:[O,U]}),e[111]=O,e[112]=U,e[113]=H):H=e[113];let ce;return e[114]!==H||e[115]!==T?(ce=a.jsxs("div",{className:"taller",children:[T,H]}),e[114]=H,e[115]=T,e[116]=ce):ce=e[116],ce};function sa(p){return p.stopPropagation()}function na(p){return setTimeout(()=>p(null),400)}export{oa as default};
