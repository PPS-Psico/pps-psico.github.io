const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./AdminDashboard-GqMU-Dsv.js","./index-Bf63COEH.js","./index-CTZWBAWr.css","./useGmailHilos-CFFWSbJx.js","./LanzadorView-BegFdomH.js","./injectScopedStyles-B_yJaYqk.js","./aseguramientoService-jZuyHPqy.js","./dbSchema-DNJ7jBHR.js","./GestionView-BLohM_qQ.js","./useGestionConvocatorias-NOYwRc_6.js","./SolicitudesManager-CUaCUAO3.js","./tiny-invariant-BCXflckp.js","./SolicitudesManager-Dbl8kTil.css","./TallerView-xvhG1Hlq.js","./MetricsView-C-4m4gBe.js","./metricsLists-DxZzVahf.js","./conveniosService-DcfiPfa0.js"])))=>i.map(i=>d[i]);
import{c as se,d as ce,b as pe,k as me,r as y,j as t,m as xe,aj as he,b7 as be,u as ue,a as ge,ci as ve,ax as Q,bc as re,cj as ye,a3 as le,A as de}from"./index-Bf63COEH.js";import{i as ke}from"./injectScopedStyles-B_yJaYqk.js";const je=`
.admin-topbar {
  position: sticky; top: 0; z-index: 45;
  background: color-mix(in oklab, var(--paper) 90%, transparent);
  backdrop-filter: blur(10px) saturate(1.08);
  -webkit-backdrop-filter: blur(10px) saturate(1.08);
  border-bottom: 1px solid var(--rule-2);
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
}
.admin-topbar-inner {
  display: flex; align-items: center; gap: 20px;
  padding: 0 24px; height: 60px; width: 100%; min-width: 0;
}
.admin-topbar-brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.admin-topbar-glyph {
  width: 26px; height: 26px; border-radius: 7px;
  background: var(--ink); color: var(--paper);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; flex-shrink: 0;
}
.admin-topbar-word { display: flex; align-items: baseline; gap: 8px; }
.admin-topbar-word b { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink); white-space: nowrap; }
.admin-topbar-word span { font-size: 12px; color: var(--ink-3); white-space: nowrap; }
.admin-topbar-nav { flex: 1; display: flex; justify-content: center; min-width: 0; overflow-x: auto; }
.admin-topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* ── Flat v3 nav tabs (texto en tinta + subrayado activo) ── */
.admin-nav { display: flex; gap: 2px; align-items: stretch; }
.admin-nav-tab {
  position: relative;
  display: inline-flex; align-items: center; gap: 7px;
  border: none; background: transparent; cursor: pointer;
  font-family: inherit; font-size: 13.5px; font-weight: 500;
  color: var(--ink-3); padding: 0 13px; height: 60px;
  white-space: nowrap; transition: color .12s ease;
}
.admin-nav-tab:hover { color: var(--ink-2); }
.admin-nav-tab.active { color: var(--ink); font-weight: 600; }
.admin-nav-tab .material-icons { font-size: 17px; opacity: .75; }
.admin-nav-tab.active .material-icons { opacity: 1; }
.admin-nav-tab .admin-nav-underline {
  position: absolute; left: 11px; right: 11px; bottom: 0; height: 2px;
  background: var(--ink); border-radius: 2px 2px 0 0;
}
.admin-nav-badge {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600;
  padding: 1px 5px; border-radius: 4px;
  background: var(--warn-soft); color: var(--warn);
}
.admin-nav-close {
  display: inline-flex; align-items: center; justify-content: center;
  margin-left: 2px; padding: 2px; border-radius: 999px;
  color: var(--ink-4); transition: color .12s ease, background .12s ease;
}
.admin-nav-close:hover { color: var(--crit); background: var(--paper-2); }

.admin-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 600; letter-spacing: 0.01em;
  padding: 5px 11px; border-radius: 999px;
  background: var(--paper-2); color: var(--ink-3);
  border: 1px solid var(--rule-2);
  white-space: nowrap;
}
.admin-pill .material-icons { color: var(--ink-4); }
.admin-icon-btn {
  position: relative;
  width: 36px; height: 36px; border-radius: 999px;
  border: 1px solid var(--rule-2); background: var(--paper);
  color: var(--ink-3); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .12s ease, color .12s ease, border-color .12s ease;
}
.admin-icon-btn:hover { background: var(--paper-2); color: var(--ink); border-color: var(--rule-3); }
.admin-icon-btn.danger:hover { color: var(--crit); border-color: var(--crit); }
.admin-icon-btn .material-icons { font-size: 19px; }
.admin-topbar-divider { width: 1px; height: 18px; background: var(--rule-2); flex-shrink: 0; margin: 0 2px; }

.admin-notif-badge {
  position: absolute; top: -3px; right: -3px;
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  background: var(--crit); color: #fff;
  font-size: 9.5px; font-weight: 700; line-height: 16px;
  display: flex; align-items: center; justify-content: center;
}
.admin-notif-pop {
  position: absolute; right: 0; top: calc(100% + 8px);
  width: 340px; max-width: calc(100vw - 32px);
  background: var(--paper); color: var(--ink);
  border: 1px solid var(--rule-2); border-radius: 14px;
  box-shadow: 0 18px 48px rgba(0,0,0,0.18);
  overflow: hidden; z-index: 1000;
}
.admin-notif-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--rule-2);
}
.admin-notif-list { max-height: 380px; overflow-y: auto; }
.admin-notif-item {
  display: flex; gap: 10px; padding: 13px 16px;
  border-bottom: 1px solid var(--rule-2); cursor: pointer;
  transition: background .12s ease;
}
.admin-notif-item:last-child { border-bottom: none; }
.admin-notif-item:hover { background: var(--paper-2); }
.admin-notif-empty { padding: 28px 16px; text-align: center; color: var(--ink-3); }
.admin-link-btn {
  border: none; background: transparent; cursor: pointer;
  font-family: inherit; font-size: 11.5px; font-weight: 600; color: var(--accent);
}
.admin-link-btn.mute { color: var(--ink-3); }
.admin-link-btn:hover { text-decoration: underline; }

@media (max-width: 1100px) {
  .admin-topbar-word span { display: none; }
}
@media (max-width: 920px) {
  .admin-topbar-pill-label { display: none; }
}
`;ke("admin-topbar-v3",je);const we={solicitud_pps:"assignment_ind",acreditacion:"verified",recordatorio:"alarm"},_e=p=>{const e=se.c(10),{onClose:l}=p,{notifications:i,unreadCount:u,markAsRead:m,markAllAsRead:f,clearNotifications:x}=me(),d=y.useRef(null);let r,h;e[0]!==l?(r=()=>{const a=B=>{d.current&&!d.current.contains(B.target)&&l()};return document.addEventListener("mousedown",a),()=>document.removeEventListener("mousedown",a)},h=[l],e[0]=l,e[1]=r,e[2]=h):(r=e[1],h=e[2]),y.useEffect(r,h);let c;return e[3]!==x||e[4]!==f||e[5]!==m||e[6]!==i||e[7]!==l||e[8]!==u?(c=t.jsx("div",{ref:d,className:"admin-notif-pop animate-fade-in-up",children:i.length===0?t.jsxs("div",{className:"admin-notif-empty",children:[t.jsx("span",{className:"material-icons",style:{fontSize:28,opacity:.4},children:"notifications_none"}),t.jsx("div",{style:{fontSize:13,marginTop:6},children:"No tenés notificaciones nuevas."})]}):t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:"admin-notif-head",children:[t.jsx("span",{style:{fontWeight:700,fontSize:13},children:"Notificaciones"}),t.jsxs("div",{style:{display:"flex",gap:12},children:[u>0&&t.jsx("button",{className:"admin-link-btn",onClick:f,children:"Marcar todo leído"}),t.jsx("button",{className:"admin-link-btn mute",onClick:x,children:"Limpiar"})]})]}),t.jsx("div",{className:"admin-notif-list",children:i.map(a=>t.jsxs("div",{className:"admin-notif-item",onClick:()=>{m(a.id),l()},style:{background:a.isRead?void 0:"var(--accent-soft)"},children:[t.jsx("span",{className:"material-icons",style:{fontSize:18,color:"var(--ink-3)",marginTop:1},children:we[a.type]||"info"}),t.jsxs("div",{style:{flex:1,minWidth:0},children:[t.jsxs("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8},children:[t.jsx("span",{style:{fontSize:13,fontWeight:600,color:"var(--ink)"},children:a.title}),!a.isRead&&t.jsx("span",{className:"dot",style:{background:"var(--accent)",marginTop:5,flexShrink:0}})]}),t.jsx("div",{style:{fontSize:12,color:"var(--ink-3)",marginTop:3,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"},children:a.message}),t.jsxs("div",{className:"mono",style:{fontSize:10,color:"var(--ink-4)",marginTop:5},children:[he(a.timestamp.toISOString())," ",a.timestamp.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})]})]})]},a.id))})]})}),e[3]=x,e[4]=f,e[5]=m,e[6]=i,e[7]=l,e[8]=u,e[9]=c):c=e[9],c},Ne=p=>{const e=se.c(47),{navItems:l,currentTabId:i,onTabChange:u,onTabClose:m}=p,{logout:f,isSuperUserMode:x,isJefeMode:d,isDirectivoMode:r}=ce(),{theme:h,setTheme:c}=pe(),{unreadCount:a,showToast:B}=me(),[X,Y]=y.useState(!1),n=x||d||r;let C;e[0]!==B?(C=()=>{navigator.clipboard.writeText(`<div style="max-width:720px;border:1px solid #ECEAE2;border-radius:18px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B0F19;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#203B73;background:linear-gradient(110deg,#46253D 0%,#203B73 52%,#3CB88D 100%);">
    <tr>
      <td style="padding:20px 24px;color:#ffffff;">
        <div style="font-size:21px;font-weight:700;letter-spacing:-0.3px;">[Nombre de la Institución]</div>
        <div style="font-size:12.5px;color:#ffffff;opacity:0.88;margin-top:3px;">Entrega de informes &middot; Área [Clínica/Educacional/Laboral/Comunitaria]</div>
      </td>
      <td align="right" style="padding:20px 24px;">
        <span style="display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:rgba(255,255,255,0.18);color:#ffffff;padding:6px 11px;border-radius:999px;">PPS 2026</span>
      </td>
    </tr>
  </table>
  <div style="padding:22px 24px;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;margin-bottom:16px;">
      <tr>
        <td width="33%" style="background:#F1F0EA;border:1px solid #E5E3DA;border-radius:12px;padding:11px 14px;">
          <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#A0A4B0;">Desde</div>
          <div style="font-size:15px;font-weight:700;color:#0B0F19;margin-top:2px;">[Fecha Inicio]</div>
        </td>
        <td width="33%" style="background:#F1F0EA;border:1px solid #E5E3DA;border-radius:12px;padding:11px 14px;">
          <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#A0A4B0;">Fecha de entrega</div>
          <div style="font-size:15px;font-weight:700;color:#0B0F19;margin-top:2px;">[Fecha Entrega]</div>
        </td>
        <td width="33%" style="background:#F1F0EA;border:1px solid #E5E3DA;border-radius:12px;padding:11px 14px;">
          <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#A0A4B0;">Fecha límite</div>
          <div style="font-size:15px;font-weight:700;color:#0B0F19;margin-top:2px;">[Fecha Límite]</div>
        </td>
      </tr>
    </table>
    <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6A7081;font-weight:700;margin-bottom:9px;">Documentación a subir</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;">
      <tr>
        <td width="50%" style="background:#F1F0EA;border:1px solid #E5E3DA;border-radius:12px;padding:13px 15px;vertical-align:top;">
          <div style="font-size:14px;font-weight:700;color:#0B0F19;">Planilla de asistencia firmada</div>
          <div style="font-size:12px;color:#6A7081;margin-top:2px;">Firmada por tu referente institucional</div>
        </td>
        <td width="50%" style="background:#F1F0EA;border:1px solid #E5E3DA;border-radius:12px;padding:13px 15px;vertical-align:top;">
          <div style="font-size:14px;font-weight:700;color:#0B0F19;">Informe final</div>
          <div style="font-size:12px;color:#6A7081;margin-top:2px;">PDF &middot; una sola entrega por institución</div>
        </td>
      </tr>
    </table>
    <div style="margin-top:14px;padding:13px 16px;background:#F1F0EA;border:1px solid #E5E3DA;border-left:3px solid #203B73;border-radius:12px;font-size:13px;line-height:1.5;color:#2B3245;">
      <strong style="color:#0B0F19;">Consultas:</strong> solo por correo institucional. El WhatsApp y el chat del campus no son canales de respuesta para consultas individuales.
    </div>
  </div>
</div>`).then(()=>{B("HTML para Moodle copiado al portapapeles","success")}).catch(o=>{console.error("Failed to copy Moodle HTML template",o),B("Error al copiar al portapapeles","error")})},e[0]=B,e[1]=C):C=e[1];const D=C;let M;e[2]===Symbol.for("react.memo_cache_sentinel")?(M=t.jsx("div",{className:"admin-topbar-glyph",children:"ψ"}),e[2]=M):M=e[2];let F;e[3]===Symbol.for("react.memo_cache_sentinel")?(F=t.jsxs("div",{className:"admin-topbar-brand",children:[M,t.jsxs("div",{className:"admin-topbar-word",children:[t.jsx("b",{children:"Mi Panel Académico"}),t.jsx("span",{children:"PPS · UFLO Psicología"})]})]}),e[3]=F):F=e[3];let g;if(e[4]!==i||e[5]!==l||e[6]!==u||e[7]!==m){let o;e[9]!==i||e[10]!==u||e[11]!==m?(o=s=>{const v=i===s.id;return t.jsxs("button",{role:"tab","aria-selected":v,className:`admin-nav-tab${v?" active":""}`,onClick:()=>u(s.id,s.path),children:[s.icon&&t.jsx("span",{className:"material-icons",children:s.icon}),s.label,s.badge!=null&&t.jsx("span",{className:"admin-nav-badge",children:s.badge}),m&&v&&s.id==="student-profile"&&t.jsx("span",{role:"button",className:"admin-nav-close",onClick:V=>m(s.id,V),"aria-label":"Cerrar",children:t.jsx("span",{className:"material-icons",style:{fontSize:14},children:"close"})}),v&&t.jsx(xe.span,{layoutId:"admin-nav-underline",className:"admin-nav-underline",transition:{type:"spring",stiffness:420,damping:34}})]},s.id)},e[9]=i,e[10]=u,e[11]=m,e[12]=o):o=e[12],g=l.map(o),e[4]=i,e[5]=l,e[6]=u,e[7]=m,e[8]=g}else g=e[8];let k;e[13]!==g?(k=t.jsx("nav",{className:"admin-topbar-nav no-scrollbar",children:t.jsx("div",{className:"admin-nav",role:"tablist",children:g})}),e[13]=g,e[14]=k):k=e[14];let _;e[15]!==x?(_=x&&t.jsxs("span",{className:"admin-pill",children:[t.jsx("span",{className:"material-icons",style:{fontSize:14},children:"shield"}),t.jsx("span",{className:"admin-topbar-pill-label",children:"Modo Administrador"})]}),e[15]=x,e[16]=_):_=e[16];let j;e[17]!==X||e[18]!==n||e[19]!==a?(j=n&&t.jsxs("div",{style:{position:"relative"},children:[t.jsxs("button",{className:"admin-icon-btn",onClick:()=>Y(Se),"aria-label":"Notificaciones",title:"Notificaciones",children:[t.jsx("span",{className:"material-icons",children:a>0?"notifications_active":"notifications"}),a>0&&t.jsx("span",{className:"admin-notif-badge",children:a>9?"9+":a})]}),X&&t.jsx(_e,{onClose:()=>Y(!1)})]}),e[17]=X,e[18]=n,e[19]=a,e[20]=j):j=e[20];let I;e[21]===Symbol.for("react.memo_cache_sentinel")?(I=t.jsx("span",{className:"material-icons",children:"school"}),e[21]=I):I=e[21];let P;e[22]!==D?(P=t.jsx("button",{className:"admin-icon-btn",onClick:D,"aria-label":"Copiar encabezado de marca Moodle",title:"Copiar encabezado de marca Moodle",children:I}),e[22]=D,e[23]=P):P=e[23];let L;e[24]!==c||e[25]!==h?(L=()=>c(h==="dark"?"light":"dark"),e[24]=c,e[25]=h,e[26]=L):L=e[26];const O=h==="dark"?"Cambiar a modo claro":"Cambiar a modo oscuro",A=h==="dark"?"Modo claro":"Modo oscuro",R=h==="dark"?"dark_mode":"light_mode";let T;e[27]!==R?(T=t.jsx("span",{className:"material-icons",children:R}),e[27]=R,e[28]=T):T=e[28];let w;e[29]!==L||e[30]!==O||e[31]!==A||e[32]!==T?(w=t.jsx("button",{className:"admin-icon-btn",onClick:L,"aria-label":O,title:A,children:T}),e[29]=L,e[30]=O,e[31]=A,e[32]=T,e[33]=w):w=e[33];let N;e[34]===Symbol.for("react.memo_cache_sentinel")?(N=t.jsx("div",{className:"admin-topbar-divider"}),e[34]=N):N=e[34];let S;e[35]===Symbol.for("react.memo_cache_sentinel")?(S=t.jsx("span",{className:"material-icons",children:"logout"}),e[35]=S):S=e[35];let z;e[36]!==f?(z=t.jsx("button",{className:"admin-icon-btn danger",onClick:f,"aria-label":"Cerrar sesión",title:"Cerrar sesión",children:S}),e[36]=f,e[37]=z):z=e[37];let E;e[38]!==w||e[39]!==z||e[40]!==_||e[41]!==j||e[42]!==P?(E=t.jsxs("div",{className:"admin-topbar-right",children:[_,j,P,w,N,z]}),e[38]=w,e[39]=z,e[40]=_,e[41]=j,e[42]=P,e[43]=E):E=e[43];let b;return e[44]!==E||e[45]!==k?(b=t.jsx("header",{className:"admin-topbar no-print",children:t.jsxs("div",{className:"admin-topbar-inner",children:[F,k,E]})}),e[44]=E,e[45]=k,e[46]=b):b=e[46],b};function Se(p){return!p}const ze=y.lazy(()=>Q(()=>import("./AdminDashboard-GqMU-Dsv.js"),__vite__mapDeps([0,1,2,3]),import.meta.url)),Ee=y.lazy(()=>Q(()=>import("./LanzadorView-BegFdomH.js").then(p=>p.b),__vite__mapDeps([4,1,2,5,6,7]),import.meta.url)),Ae=y.lazy(()=>Q(()=>import("./GestionView-BLohM_qQ.js").then(p=>p.G),__vite__mapDeps([8,1,2,9,3,5]),import.meta.url)),Te=y.lazy(()=>Q(()=>import("./SolicitudesManager-CUaCUAO3.js"),__vite__mapDeps([10,1,2,11,12]),import.meta.url)),Ce=y.lazy(()=>Q(()=>import("./TallerView-xvhG1Hlq.js"),__vite__mapDeps([13,1,2,7,5]),import.meta.url)),Me=y.lazy(()=>Q(()=>import("./MetricsView-C-4m4gBe.js").then(p=>p.M),__vite__mapDeps([14,1,2,15,5,16]),import.meta.url));function Fe(p){const e=se.c(5),l=768;let i;e[0]!==l?(i=()=>window.innerWidth<l,e[0]=l,e[1]=i):i=e[1];const[u,m]=y.useState(i);let f,x;return e[2]!==l?(f=()=>{const d=window.matchMedia(`(max-width: ${l-1}px)`),r=h=>m(h.matches);return d.addEventListener("change",r),m(d.matches),()=>d.removeEventListener("change",r)},x=[l],e[2]=l,e[3]=f,e[4]=x):(f=e[3],x=e[4]),y.useEffect(f,x),u}const fe=new Set(["dashboard","lanzador","gestion"]),Pe=p=>{const e=se.c(85),{isTestingMode:l}=p,i=l===void 0?!1:l,{preferences:u}=be(),{logout:m}=ce(),{theme:f,setTheme:x}=pe(),d=ue(),r=ge(),h=ve(),c=Fe(),[a,B]=y.useState("dashboard"),[X,Y]=y.useState(!1);let n;e[0]!==i||e[1]!==a||e[2]!==r.pathname?(n=i?a:"",i||(r.pathname.includes("/estudiantes/")?n="student-profile":r.pathname.includes("/admin/lanzador")?n="lanzador":r.pathname.includes("/admin/gestion")?n="gestion":r.pathname.includes("/admin/solicitudes")?n="solicitudes":r.pathname.includes("/admin/metrics")?n="metrics":r.pathname.includes("/admin/herramientas")?n="herramientas":n="dashboard"),e[0]=i,e[1]=a,e[2]=r.pathname,e[3]=n):n=e[3];let C;e[4]!==n||e[5]!==c||e[6]!==i||e[7]!==d?(C=()=>{c&&!i&&!fe.has(n)&&n!=="student-profile"&&d("/admin/dashboard",{replace:!0})},e[4]=n,e[5]=c,e[6]=i,e[7]=d,e[8]=C):C=e[8];let D;e[9]!==n||e[10]!==c||e[11]!==i||e[12]!==d?(D=[c,n,i,d],e[9]=n,e[10]=c,e[11]=i,e[12]=d,e[13]=D):D=e[13],y.useEffect(C,D);let M,F;e[14]===Symbol.for("react.memo_cache_sentinel")?(M={id:"dashboard",label:"Inicio",icon:"dashboard",path:"/admin/dashboard"},F={id:"lanzador",label:"Lanzador",icon:"rocket_launch",path:"/admin/lanzador"},e[14]=M,e[15]=F):(M=e[14],F=e[15]);let g;if(e[16]!==n||e[17]!==c||e[18]!==i||e[19]!==r.pathname||e[20]!==h.legajo){g=[M,F];let b;if(e[22]===Symbol.for("react.memo_cache_sentinel")?(b={id:"gestion",label:"Gestión",icon:"tune",path:"/admin/gestion"},e[22]=b):b=e[22],g.push(b),!c){let o,s,v;e[23]===Symbol.for("react.memo_cache_sentinel")?(o={id:"solicitudes",label:"Solicitudes",icon:"list_alt",path:"/admin/solicitudes"},s={id:"metrics",label:"Métricas",icon:"analytics",path:"/admin/metrics"},v={id:"herramientas",label:"Taller",icon:"construction",path:"/admin/herramientas"},e[23]=o,e[24]=s,e[25]=v):(o=e[23],s=e[24],v=e[25]),g.push(o,s,v)}if(!c&&!i&&n==="student-profile"){const o=`Alumno ${h.legajo}`;let s;e[26]!==r.pathname||e[27]!==o?(s={id:"student-profile",label:o,icon:"school",path:r.pathname},e[26]=r.pathname,e[27]=o,e[28]=s):s=e[28],g.push(s)}e[16]=n,e[17]=c,e[18]=i,e[19]=r.pathname,e[20]=h.legajo,e[21]=g}else g=e[21];const k=g;let _;e[29]!==i||e[30]!==d?(_=(b,o)=>{i?B(b):o&&d(o)},e[29]=i,e[30]=d,e[31]=_):_=e[31];const j=_;let I;e[32]!==d?(I=(b,o)=>{o.stopPropagation(),d("/admin/herramientas")},e[32]=d,e[33]=I):I=e[33];const P=I,L=Ie;let O;e[34]!==i||e[35]!==a||e[36]!==u?(O=()=>i?t.jsx(re.Suspense,{fallback:t.jsx(le,{}),children:t.jsxs("div",{className:"animate-fade-in-up",children:[a==="dashboard"&&t.jsx(ze,{}),a==="lanzador"&&t.jsx(Ee,{isTestingMode:!0}),a==="gestion"&&(u.showManagementTab?t.jsx(Ae,{isTestingMode:!0}):t.jsx("div",{className:"p-8 text-center text-slate-500",children:"Módulo desactivado"})),a==="solicitudes"&&t.jsx(Te,{isTestingMode:!0}),a==="metrics"&&t.jsx(Me,{onStudentSelect:L,isTestingMode:!0,onModalOpen:Y}),a==="herramientas"&&t.jsx(Ce,{onStudentSelect:L,isTestingMode:!0})]})}):t.jsx(re.Suspense,{fallback:t.jsx(le,{}),children:t.jsx(ye,{})}),e[34]=i,e[35]=a,e[36]=u,e[37]=O):O=e[37];const A=O;if(c){let b;e[38]===Symbol.for("react.memo_cache_sentinel")?(b={background:"color-mix(in oklab, var(--paper) 90%, transparent)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",borderColor:"var(--rule-2)"},e[38]=b):b=e[38];let o;e[39]===Symbol.for("react.memo_cache_sentinel")?(o=t.jsxs("div",{className:"flex items-center gap-2.5",children:[t.jsx("div",{style:{width:24,height:24,borderRadius:6,background:"var(--ink)",color:"var(--paper)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700},children:"ψ"}),t.jsx("span",{style:{fontSize:14,fontWeight:700,letterSpacing:"-0.02em"},children:"Mi Panel"})]}),e[39]=o):o=e[39];let s;e[40]!==x||e[41]!==f?(s=()=>x(f==="dark"?"light":"dark"),e[40]=x,e[41]=f,e[42]=s):s=e[42];let v;e[43]===Symbol.for("react.memo_cache_sentinel")?(v={color:"var(--ink-3)"},e[43]=v):v=e[43];let V;e[44]===Symbol.for("react.memo_cache_sentinel")?(V={fontSize:19},e[44]=V):V=e[44];const oe=f==="dark"?"dark_mode":"light_mode";let $;e[45]!==oe?($=t.jsx("span",{className:"material-icons",style:V,children:oe}),e[45]=oe,e[46]=$):$=e[46];let W;e[47]!==s||e[48]!==$?(W=t.jsx("button",{onClick:s,className:"w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",style:v,"aria-label":"Cambiar tema",children:$}),e[47]=s,e[48]=$,e[49]=W):W=e[49];let Z;e[50]===Symbol.for("react.memo_cache_sentinel")?(Z={color:"var(--ink-3)"},e[50]=Z):Z=e[50];let ee;e[51]===Symbol.for("react.memo_cache_sentinel")?(ee=t.jsx("span",{className:"material-icons",style:{fontSize:19},children:"logout"}),e[51]=ee):ee=e[51];let H;e[52]!==m?(H=t.jsx("button",{onClick:m,className:"w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",style:Z,"aria-label":"Cerrar sesión",children:ee}),e[52]=m,e[53]=H):H=e[53];let G;e[54]!==W||e[55]!==H?(G=t.jsxs("header",{className:"sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b no-print",style:b,children:[o,t.jsxs("div",{className:"flex items-center gap-1.5",children:[W,H]})]}),e[54]=W,e[55]=H,e[56]=G):G=e[56];let U;e[57]!==A?(U=t.jsx("main",{className:"relative z-10",children:A()}),e[57]=A,e[58]=U):U=e[58];let te;e[59]===Symbol.for("react.memo_cache_sentinel")?(te={paddingBottom:"env(safe-area-inset-bottom, 0px)"},e[59]=te):te=e[59];let J;e[60]!==k?(J=k.filter(Le),e[60]=k,e[61]=J):J=e[61];let q;e[62]!==n||e[63]!==j||e[64]!==J?(q=t.jsx("nav",{className:"fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]",style:te,children:t.jsx("div",{className:"flex justify-around items-stretch",children:J.map(K=>{const ne=n===K.id;return t.jsxs("button",{onClick:()=>j(K.id,K.path),className:`
                    flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition duration-200
                    ${ne?"text-blue-600 dark:text-blue-400":"text-slate-400 dark:text-slate-500 active:text-slate-600"}
                  `,children:[t.jsx("span",{className:`material-icons transition-transform duration-200 ${ne?"!text-[26px] scale-110":"!text-[24px]"}`,children:K.icon}),t.jsx("span",{className:`text-[10px] font-bold tracking-wide ${ne?"opacity-100":"opacity-70"}`,children:K.label}),ne&&t.jsx("span",{className:"absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-b-full bg-blue-600 dark:bg-blue-400"})]},K.id)})})}),e[62]=n,e[63]=j,e[64]=J,e[65]=q):q=e[65];let ie;e[66]===Symbol.for("react.memo_cache_sentinel")?(ie=t.jsx(de,{}),e[66]=ie):ie=e[66];let ae;return e[67]!==G||e[68]!==U||e[69]!==q?(ae=t.jsxs("div",{className:"admin-mobile-shell min-h-screen bg-[var(--paper)] text-[var(--ink)] transition-colors duration-300 pb-[72px]",children:[G,U,q,ie]}),e[67]=G,e[68]=U,e[69]=q,e[70]=ae):ae=e[70],ae}const R=X?"hidden":"",T=n==="student-profile"?P:void 0;let w;e[71]!==n||e[72]!==j||e[73]!==k||e[74]!==T?(w=t.jsx(Ne,{navItems:k,currentTabId:n,onTabChange:j,onTabClose:T}),e[71]=n,e[72]=j,e[73]=k,e[74]=T,e[75]=w):w=e[75];let N;e[76]!==w||e[77]!==R?(N=t.jsx("div",{className:R,children:w}),e[76]=w,e[77]=R,e[78]=N):N=e[78];let S;e[79]!==A?(S=t.jsx("main",{className:"relative z-10 w-full",children:A()}),e[79]=A,e[80]=S):S=e[80];let z;e[81]===Symbol.for("react.memo_cache_sentinel")?(z=t.jsx(de,{}),e[81]=z):z=e[81];let E;return e[82]!==N||e[83]!==S?(E=t.jsxs("div",{className:"min-h-screen bg-[var(--paper)] text-[var(--ink)] relative transition-colors duration-300",children:[N,S,z]}),e[82]=N,e[83]=S,e[84]=E):E=e[84],E};function Ie(p){alert("Navegación simulada al perfil de: "+p.nombre+" ("+p.legajo+")")}function Le(p){return fe.has(p.id)}export{Pe as default};
