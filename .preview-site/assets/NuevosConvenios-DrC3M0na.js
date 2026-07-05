import{c as W,f as Z,r as J,a2 as X,o as ee,bM as K,bb as U,n as G,p as O,l as f,F as R,a$ as ne,j as n,b6 as te,aW as se,aj as ie,N as V,$ as oe,b3 as ae}from"./index-Bf63COEH.js";import{c as re}from"./conveniosService-DcfiPfa0.js";import{i as ce}from"./injectScopedStyles-B_yJaYqk.js";import{i as le}from"./premiumMotion-DiBIURyU.js";const me=`
.nco {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .nco {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
}
.nco .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.nco .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; }
.nco .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

.nco-section + .nco-section{ margin-top:30px; }
.nco-section-head{ margin-bottom:14px; }
.nco-section-head h3{ font-family:'Instrument Serif', serif; font-size:22px; font-weight:700; letter-spacing:-0.02em; margin:5px 0 0; }
.nco-section-head p{ font-size:13px; color:var(--ink-3); margin:4px 0 0; max-width:560px; }

/* Confirmados */
.nco-confirmed{ display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:8px; }
.nco-conf-item{ display:flex; align-items:center; gap:9px; padding:11px 14px; border:1px solid var(--rule-2); border-radius:10px; background:var(--paper); }
.nco-conf-item .material-icons{ font-size:17px; color:var(--ok); }
.nco-conf-name{ font-size:13.5px; color:var(--ink-2); font-weight:500; }

/* Potenciales */
.nco-pot{ border:1px solid var(--rule-2); border-left:3px solid var(--warn); border-radius:12px; background:var(--paper); padding:16px 18px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.nco-pot + .nco-pot{ margin-top:10px; }
.nco-pot-name{ font-size:15px; font-weight:600; color:var(--ink); }
.nco-pot-launches{ margin-top:8px; display:flex; flex-direction:column; gap:3px; }
.nco-pot-launch{ font-size:12px; color:var(--ink-3); }
.nco-pot-launch .mono{ color:var(--ink-4); }
.nco-btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; padding:9px 15px; border-radius:9px; border:1px solid var(--ink); background:var(--ink); color:var(--paper); cursor:pointer; font-family:inherit; transition:opacity .12s; white-space:nowrap; flex-shrink:0; }
.nco-btn:hover{ opacity:.9; }
.nco-btn:disabled{ opacity:.5; cursor:not-allowed; }
.nco-btn .material-icons{ font-size:16px; }
@keyframes nco-spin{ to{ transform:rotate(360deg); } }
.nco-spin{ width:14px; height:14px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:999px; animation:nco-spin .8s linear infinite; }
.nco-empty{ display:flex; align-items:center; gap:9px; padding:14px 16px; border:1px dashed var(--rule-3); border-radius:10px; color:var(--ink-3); font-size:13px; }
.nco-empty .material-icons{ font-size:17px; color:var(--ok); }
`;ce("nco-styles",me);le();const Fe=s=>{const e=W.c(40),{isTestingMode:u}=s,i=u===void 0?!1:u,x=Z(),[j,q]=J.useState(null);let k;e[0]===Symbol.for("react.memo_cache_sentinel")?(k=new Date().getFullYear(),e[0]=k):k=e[0];const $=k;let w;e[1]!==i?(w={queryKey:["conveniosData",i],queryFn:async()=>{if(i)return{instituciones:[{id:"inst_test_1",createdTime:"",[K]:"Inst Test Nueva",[U]:2024},{id:"inst_test_2",createdTime:"",[K]:"Inst Test Potencial"}],lanzamientos:[{id:"lanz_test_1",createdTime:"",[R]:"Inst Test Nueva - Sede A",[f]:`${new Date().getFullYear()}-03-01`},{id:"lanz_test_2",createdTime:"",[R]:"Inst Test Potencial - Taller B",[f]:`${new Date().getFullYear()}-04-01`}]};const[t,r]=await Promise.all([V.instituciones.getAll(),V.lanzamientos.getAll()]);return{instituciones:t,lanzamientos:r}}},e[1]=i,e[2]=w):w=e[2];const{data:m,isLoading:H,error:I}=X(w);let h;e[3]!==i?(h=t=>{const r=new Date().getFullYear();return i?(oe.info("TEST MODE: Confirming agreement for",t),new Promise(pe)):re({institucionId:t,fechaFirma:`${r}-01-01`,tipo:"marco",esRenovacion:!1})},e[3]=i,e[4]=h):h=e[4];let g;e[5]!==i||e[6]!==x?(g=()=>{q({message:"Convenio confirmado con éxito.",type:"success"}),x.invalidateQueries({queryKey:["conveniosData",i]}),x.invalidateQueries({queryKey:["metricsData"]}),x.invalidateQueries({queryKey:["metricsKPIs"]}),x.invalidateQueries({queryKey:["conveniosKpis"]})},e[5]=i,e[6]=x,e[7]=g):g=e[7];let T;e[8]===Symbol.for("react.memo_cache_sentinel")?(T=t=>{q({message:`Error al confirmar: ${t.message}`,type:"error"})},e[8]=T):T=e[8];let A;e[9]!==h||e[10]!==g?(A={mutationFn:h,onSuccess:g,onError:T},e[9]=h,e[10]=g,e[11]=A):A=e[11];const p=ee(A);let Y;e:{if(!m){let d;e[12]===Symbol.for("react.memo_cache_sentinel")?(d=[],e[12]=d):d=e[12];let E;e[13]===Symbol.for("react.memo_cache_sentinel")?(E=[],e[13]=E):E=e[13];let c;e[14]===Symbol.for("react.memo_cache_sentinel")?(c={confirmed:d,potentials:E},e[14]=c):c=e[14],Y=c;break e}let t;e[15]===Symbol.for("react.memo_cache_sentinel")?(t=new Date().getFullYear(),e[15]=t):t=e[15];const r=t;let b,_;if(e[16]!==r||e[17]!==m.instituciones||e[18]!==m.lanzamientos){const d=new Map;m.instituciones.forEach(o=>{const a=o[K];if(a){const l=Number(o[U]),L=!isNaN(l)&&l>=r-1;d.set(G(a),{id:o.id,isNew:L,year:l})}});const E=m.lanzamientos.filter(o=>{const a=O(o[f]);return a&&a.getUTCFullYear()===r}).sort(de),c=new Map,B=new Map;E.forEach(o=>{const a=o[R];if(!a)return;const l=ne(a),L=G(l),F=d.get(L);if(F)if(F.isNew){if(!c.has(l)){const Q=O(o[f]);Q&&c.set(l,Q)}}else B.has(F.id)||B.set(F.id,{institutionId:F.id,institutionName:l,launches:[]}),B.get(F.id).launches.push({id:o.id,name:a,date:o[f]||"N/A"})}),b=Array.from(c.entries()).map(fe).sort(ue).map(xe),_=Array.from(B.values()).sort(he),e[16]=r,e[17]=m.instituciones,e[18]=m.lanzamientos,e[19]=b,e[20]=_}else b=e[19],_=e[20];let P;e[21]!==b||e[22]!==_?(P={confirmed:b,potentials:_},e[21]=b,e[22]=_,e[23]=P):P=e[23],Y=P}const{confirmed:C,potentials:S}=Y;if(H){let t;return e[24]===Symbol.for("react.memo_cache_sentinel")?(t=n.jsx("div",{className:"nco",style:{display:"flex",justifyContent:"center",padding:32},children:n.jsx(ae,{})}),e[24]=t):t=e[24],t}if(I){let t;return e[25]!==I.message?(t=n.jsx(te,{icon:"error",title:"Error",message:I.message}),e[25]=I.message,e[26]=t):t=e[26],t}let y;e[27]!==j?(y=j&&n.jsx(se,{message:j.message,type:j.type,onClose:()=>q(null)}),e[27]=j,e[28]=y):y=e[28];let z;e[29]===Symbol.for("react.memo_cache_sentinel")?(z=n.jsxs("div",{className:"nco-section-head",children:[n.jsxs("span",{className:"eyebrow",children:["Confirmados · ",$]}),n.jsx("h3",{className:"serif",children:"Convenios nuevos confirmados"}),n.jsx("p",{children:'Instituciones marcadas como "convenio nuevo" que tuvieron lanzamientos este año.'})]}),e[29]=z):z=e[29];let v;e[30]!==C?(v=n.jsxs("section",{className:"nco-section",children:[z,C.length>0?n.jsx("div",{className:"nco-confirmed",children:C.map(ge)}):n.jsxs("div",{className:"nco-empty",children:[n.jsx("span",{className:"material-icons",style:{color:"var(--ink-4)"},children:"info"}),"No se han confirmado convenios nuevos este año."]})]}),e[30]=C,e[31]=v):v=e[31];let D;e[32]===Symbol.for("react.memo_cache_sentinel")?(D=n.jsxs("div",{className:"nco-section-head",children:[n.jsx("span",{className:"eyebrow",children:"Por revisar"}),n.jsx("h3",{className:"serif",children:"Posibles convenios a confirmar"}),n.jsx("p",{children:"Instituciones con lanzamientos este año que todavía no tienen el año de convenio marcado."})]}),e[32]=D):D=e[32];let N;e[33]!==p||e[34]!==S?(N=n.jsxs("section",{className:"nco-section",children:[D,S.length>0?n.jsx("div",{children:S.map(t=>n.jsxs("div",{className:"nco-pot",children:[n.jsxs("div",{style:{minWidth:0},children:[n.jsx("div",{className:"nco-pot-name",children:t.institutionName}),n.jsx("div",{className:"nco-pot-launches",children:t.launches.map(ye)})]}),n.jsxs("button",{className:"nco-btn",onClick:()=>p.mutate(t.institutionId),disabled:p.isPending&&p.variables===t.institutionId,children:[p.isPending&&p.variables===t.institutionId?n.jsx("span",{className:"nco-spin"}):n.jsx("span",{className:"material-icons",children:"add_task"}),"Confirmar ",$]})]},t.institutionId))}):n.jsxs("div",{className:"nco-empty",children:[n.jsx("span",{className:"material-icons",children:"check_circle"}),"Todas las instituciones con lanzamientos este año están correctamente marcadas."]})]}),e[33]=p,e[34]=S,e[35]=N):N=e[35];let M;return e[36]!==v||e[37]!==N||e[38]!==y?(M=n.jsxs("div",{className:"nco",children:[y,v,N]}),e[36]=v,e[37]=N,e[38]=y,e[39]=M):M=e[39],M};function pe(s){return setTimeout(s,500)}function de(s,e){const u=O(s[f])?.getTime()||0,i=O(e[f])?.getTime()||0;return u-i}function fe(s){const[e,u]=s;return{name:e,date:u}}function ue(s,e){return s.date.getTime()-e.date.getTime()}function xe(s){return s.name}function he(s,e){return s.institutionName.localeCompare(e.institutionName)}function ge(s){return n.jsxs("div",{className:"nco-conf-item",children:[n.jsx("span",{className:"material-icons",children:"check_circle"}),n.jsx("span",{className:"nco-conf-name",children:s})]},s)}function ye(s){return n.jsxs("div",{className:"nco-pot-launch",children:[s.name," ",n.jsxs("span",{className:"mono",children:["· ",ie(s.date)]})]},s.id)}export{Fe as default};
