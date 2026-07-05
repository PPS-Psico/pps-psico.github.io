import{f as Y,r as c,a2 as Z,o as z,_ as p,j as a,b3 as ee,aW as ae,db as te,dc as se,$ as l,W as B}from"./index-Bf63COEH.js";import{i as re}from"./injectScopedStyles-B_yJaYqk.js";import{i as ie}from"./premiumMotion-DiBIURyU.js";const m=[{id:"seleccion",label:"Alumno Seleccionado",description:'Se env?a cuando marcas a un estudiante como "Seleccionado" en una convocatoria.',icon:"how_to_reg",variables:["{{nombre_alumno}}","{{nombre_pps}}","{{encuentro_inicial}}","{{horario}}","{{panel_url}}"],defaultSubject:"Confirmaci?n de Asignaci?n PPS: {{nombre_pps}}",defaultBody:`Hola {{nombre_alumno}},

Nos complace informarte que has sido seleccionado/a para realizar tu Pr?ctica Profesional Supervisada en:

Instituci?n: {{nombre_pps}}
{{encuentro_inicial}}
{{horario}}

**Acci?n requerida** Ingres? a Mi Panel, revis? el acta de compromiso y registr? tu aceptaci?n digital para reservar tu vacante antes del inicio de la PPS.
[[button|Ingresar a Mi Panel|{{panel_url}}]]

Si ten?s dudas o surge alguna dificultad, comunicate con la Coordinaci?n lo antes posible.

Te deseamos un excelente comienzo.

Saludos,

Blas
Coordinador de Pr?cticas Profesionales Supervisadas
Licenciatura en Psicolog?a
UFLO`},{id:"solicitud",label:"Avance de Solicitud (Autogestión)",description:'Se envía cuando actualizas el estado de una solicitud de PPS (ej: a "En conversaciones").',icon:"assignment_turned_in",variables:["{{nombre_alumno}}","{{estado_nuevo}}","{{institucion}}","{{notas}}"],defaultSubject:"Actualización de tu Solicitud de PPS - UFLO",defaultBody:`Hola {{nombre_alumno}},

Hay novedades sobre tu solicitud de PPS en "{{institucion}}".

Nuevo Estado: {{estado_nuevo}}

Comentarios:
{{notas}}

Seguimos gestionando tu solicitud.`},{id:"sac",label:"Carga en SAC / Finalización",description:"Se envía cuando se confirma la carga de horas en el sistema académico.",icon:"school",variables:["{{nombre_alumno}}","{{nombre_pps}}"],defaultSubject:"Acreditación de Prácticas en SAC ✅",defaultBody:`Hola {{nombre_alumno}},

Queremos avisarte que tus horas de la PPS "{{nombre_pps}}" fueron acreditadas correctamente y ya podés visualizarlas en el sistema SAC.

¡Felicitaciones por la finalización de esta etapa!

Saludos,

Blas
Coordinador de Prácticas Profesionales Supervisadas
Licenciatura en Psicología
UFLO`}],I=[{id:"seleccion_push",label:"Alumno Seleccionado (Push)",description:"Notificación push cuando un estudiante es seleccionado en una convocatoria.",icon:"notifications_active",variables:["{{nombre_alumno}}","{{nombre_pps}}"],defaultSubject:"¡Fuiste seleccionado! 🎉",defaultBody:"Hola {{nombre_alumno}}, has sido seleccionado para la PPS: {{nombre_pps}}. Revisá tu correo para más detalles."},{id:"compromiso_push",label:"Recordatorio Consentimiento Digital (Push)",description:"Notificación push que recuerda al estudiante aceptar el compromiso digital apenas queda seleccionado.",icon:"draw",variables:["{{nombre_alumno}}","{{nombre_pps}}"],defaultSubject:"Falta tu consentimiento digital ✍️",defaultBody:"Hola {{nombre_alumno}}, para confirmar tu lugar en {{nombre_pps}} tenés que aceptar el compromiso digital desde Mi Panel. ¡No te quedes afuera!"},{id:"nueva_convocatoria_push",label:"Nueva Convocatoria (Push)",description:"Notificación push a todos los estudiantes cuando se abre una nueva convocatoria.",icon:"campaign",variables:["{{nombre_pps}}"],defaultSubject:"¡Nueva Convocatoria PPS! 📢",defaultBody:"Se abrió una nueva convocatoria: {{nombre_pps}}. Entrá a la app para postularte."}],oe=`
.aut {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  --ai:#5A2D86; --ai-s:#5A2D8612;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .aut {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
  --ai:#C9A4F2; --ai-s:#C9A4F21A;
}
.aut .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.aut .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; }
.aut .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

.aut-head{ margin-bottom:20px; }
.aut-head h2{ font-family:'Instrument Serif', serif; font-size:26px; font-weight:700; letter-spacing:-0.025em; margin:5px 0 0; }
.aut-head p{ font-size:13.5px; color:var(--ink-3); margin:5px 0 0; max-width:560px; }

/* Tabs canal */
.aut-tabs{ display:inline-flex; gap:4px; padding:4px; border:1px solid var(--rule-2); border-radius:11px; background:var(--paper-2); margin-bottom:22px; }
.aut-tab{ display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; border:none; background:transparent; color:var(--ink-3); transition: color .12s, background-color .12s, border-color .12s, box-shadow .12s, transform .12s, opacity .12s, filter .12s; }
.aut-tab[data-on="1"]{ background:var(--paper); color:var(--ink); box-shadow:0 1px 2px rgba(20,19,16,0.06); }
.aut-tab .material-icons{ font-size:16px; }

/* Caja de prueba */
.aut-test{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); padding:18px 20px; margin-bottom:26px; }
.aut-test-grid{ display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-top:14px; }
.aut-label{ display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; font-weight:600; color:var(--ink-3); margin-bottom:6px; }
.aut-field{ width:100%; padding:9px 12px; border:1px solid var(--rule-3); border-radius:9px; background:var(--paper-2); color:var(--ink); font-size:13.5px; font-family:inherit; outline:none; box-sizing:border-box; }
.aut-field:focus{ border-color:var(--accent); }

/* Botones */
.aut-btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; padding:9px 15px; border-radius:9px; border:1px solid var(--rule-3); background:transparent; color:var(--ink); cursor:pointer; font-family:inherit; transition:background .12s; white-space:nowrap; }
.aut-btn:hover{ background:var(--paper-2); }
.aut-btn:disabled{ opacity:.5; cursor:not-allowed; }
.aut-btn-primary{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.aut-btn-primary:hover{ opacity:.9; background:var(--ink); }
.aut-btn .material-icons{ font-size:16px; }

/* Tarjeta de escenario */
.aut-card{ border:1px solid var(--rule-2); border-radius:14px; background:var(--paper); overflow:hidden; transition:border-color .12s; }
.aut-card + .aut-card{ margin-top:12px; }
.aut-card[data-on="1"]{ border-left:3px solid var(--ok); }
.aut-card-top{ display:flex; align-items:center; gap:14px; padding:16px 18px; }
.aut-card-ico{ width:40px; height:40px; flex-shrink:0; border-radius:10px; display:flex; align-items:center; justify-content:center; background:var(--paper-3); color:var(--ink-3); }
.aut-card[data-on="1"] .aut-card-ico{ background:var(--ok-s); color:var(--ok); }
.aut-card-ico .material-icons{ font-size:21px; }
.aut-card-body{ flex:1; min-width:0; }
.aut-card-title{ font-size:15px; font-weight:600; color:var(--ink); }
.aut-card-desc{ font-size:12.5px; color:var(--ink-3); margin-top:2px; line-height:1.45; }
.aut-card-ctrls{ display:flex; align-items:center; gap:14px; flex-shrink:0; }
.aut-state{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
.aut-state[data-on="1"]{ color:var(--ok); }
.aut-state[data-on="0"]{ color:var(--ink-4); }

/* Toggle */
.aut-switch{ position:relative; width:42px; height:23px; border-radius:999px; border:none; cursor:pointer; transition:background .15s; background:var(--rule-3); }
.aut-switch[data-on="1"]{ background:var(--ok); }
.aut-switch span{ position:absolute; top:2.5px; left:2.5px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .15s; }
.aut-switch[data-on="1"] span{ transform:translateX(19px); }
.aut-edit-btn{ width:34px; height:34px; border-radius:8px; border:1px solid var(--rule-3); background:transparent; color:var(--ink-2); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background .12s; }
.aut-edit-btn:hover{ background:var(--paper-2); }
.aut-edit-btn[data-on="1"]{ background:var(--accent-s); color:var(--accent); border-color:transparent; }
.aut-edit-btn .material-icons{ font-size:18px; }

/* Editor */
.aut-editor{ border-top:1px solid var(--rule-2); background:var(--paper-2); padding:18px 20px; }
.aut-var{ font-size:10.5px; font-family:'JetBrains Mono', monospace; background:var(--paper-3); color:var(--ink-2); border:1px solid var(--rule-2); padding:2px 7px; border-radius:6px; cursor:pointer; transition: color .1s, background-color .1s, border-color .1s, box-shadow .1s, transform .1s, opacity .1s, filter .1s; }
.aut-var:hover{ background:var(--accent); color:#fff; border-color:var(--accent); }
.aut-textarea{ width:100%; border:1px solid var(--rule-3); border-radius:10px; background:var(--paper); color:var(--ink); padding:12px; font-size:13px; font-family:'JetBrains Mono', monospace; line-height:1.6; outline:none; resize:vertical; box-sizing:border-box; }
.aut-textarea:focus{ border-color:var(--accent); }
.aut-tip{ display:flex; align-items:flex-start; gap:7px; font-size:11.5px; color:var(--ink-3); line-height:1.5; margin-top:8px; }
.aut-tip .material-icons{ font-size:13px; color:var(--accent); flex-shrink:0; margin-top:1px; }
@keyframes aut-spin{ to{ transform:rotate(360deg); } }
.aut-spin{ width:15px; height:15px; border:2px solid var(--rule-3); border-top-color:currentColor; border-radius:999px; animation:aut-spin .8s linear infinite; }
.aut-section-title{ font-family:'Instrument Serif', serif; font-size:19px; font-weight:700; letter-spacing:-0.02em; margin:0 0 14px; }
`;re("aut-styles",oe);ie();const ue=()=>{const j=Y(),[f,k]=c.useState("emails"),[g,n]=c.useState(null),[h,M]=c.useState(""),[S,D]=c.useState("seleccion"),[N,C]=c.useState(!1),[q,b]=c.useState(null),[w,_]=c.useState(""),[v,x]=c.useState(""),[E,P]=c.useState(!1),{data:H=[],isLoading:L}=Z({queryKey:["emailTemplates"],queryFn:async()=>{const{data:e,error:t}=await p.from("email_templates").select("*");if(t)throw t;return e}}),y=z({mutationFn:async e=>{const{error:t}=await p.from("email_templates").upsert({id:e.id,subject:e.subject,body:e.body,is_active:e.is_active,updated_at:new Date().toISOString()});if(t)throw t},onSuccess:()=>{j.invalidateQueries({queryKey:["emailTemplates"]}),n({message:"Plantilla guardada correctamente.",type:"success"}),b(null)},onError:e=>{n({message:`Error guardando: ${e.message}`,type:"error"})}}),A=z({mutationFn:async e=>{const{error:t}=await p.from("email_templates").upsert({id:e.id,is_active:e.is_active,subject:e.subject,body:e.body});if(t)throw t},onSuccess:()=>{j.invalidateQueries({queryKey:["emailTemplates"]})},onError:e=>n({message:`Error cambiando estado: ${e.message}`,type:"error"})}),d=e=>{const t=H.find(s=>s.id===e),i=[...m,...I].find(s=>s.id===e);return{subject:t?.subject||i?.defaultSubject||"",body:t?.body||i?.defaultBody||"",isActive:t?t.is_active:!1}},$=async()=>{if(!h){n({message:"Ingresa un correo para la prueba.",type:"error"});return}C(!0);try{const e=m.find(u=>u.id===S)||m[0],{subject:t,body:o}=d(e.id),i="Estudiante de Prueba";let s=o.replace("{{nombre_alumno}}",i),r=t;if(e.id==="seleccion"){const u="Encuentro Inicial: Próximo Lunes 10:00 hs",V="Clínica Demo UFLO",X="Lunes de 16:00 a 19:00 hs";r=r.replace("{{nombre_pps}}","Clínica Demo"),s.includes("{{encuentro_inicial}}")||(s.includes("{{nombre_pps}}")?s=s.replace("{{nombre_pps}}",`{{nombre_pps}}
${u}`):s+=`
${u}`),s=s.replace("{{nombre_pps}}",V).replace("{{horario}}",X).replace("{{encuentro_inicial}}",u)}else e.id==="solicitud"?(s=s.replace("{{institucion}}","Hospital Modelo").replace("{{estado_nuevo}}","En conversaciones").replace("{{notas}}","Hemos contactado a la institución y esperamos respuesta."),r=r.replace("{{institucion}}","Hospital Modelo")):e.id==="sac"&&(s=s.replace("{{nombre_pps}}","Práctica Profesional Supervisada"));const G=`Hola, <span style="color: #2563eb;">${i.split(" ")[0]}</span>`,J=te(s,G),K=se(s),{error:T}=await p.functions.invoke("send-email",{body:{to:h,subject:`[PRUEBA] ${r}`,text:K,html:J,name:i}});if(T)throw T;n({message:`Prueba de "${e.label}" enviada.`,type:"success"})}catch(e){l.error("Error sending test:",e),n({message:`Fallo el envío: ${B(e)}`,type:"error"})}finally{C(!1)}},O=async()=>{P(!0),l.info("[FCM Test] Starting test notification...");try{l.info("[FCM Test] Invoking send-fcm-notification function...");const{data:e,error:t}=await p.functions.invoke("send-fcm-notification",{body:{title:"🧪 Prueba de Notificación",body:"Esta es una notificación de prueba para verificar que todo funciona correctamente.",type:"message",send_to_all:!0}});if(l.info("[FCM Test] Response:",{data:e,error:t}),e?.error)throw l.error("[FCM Test] Server returned error:",e.error),new Error(e.error);if(t)throw l.error("[FCM Test] Supabase function error:",t),t;e?.sent===0?n({message:"No hay suscriptores activos. Los usuarios deben activar las notificaciones primero.",type:"warning"}):n({message:`Notificación enviada a ${e?.sent||0} suscriptor(es)${e?.failed>0?` (${e.failed} fallidos)`:""}`,type:"success"})}catch(e){l.error("[FCM Test] Error:",e),n({message:B(e,"Error al enviar notificación"),type:"error"})}finally{P(!1)}},R=e=>{b(e.id);const t=d(e.id);_(t.subject),x(t.body)},U=e=>{const t=d(e.id);y.mutate({id:e.id,subject:w,body:v,is_active:t.isActive??void 0})},Q=e=>{const t=d(e.id);A.mutate({id:e.id,is_active:!t.isActive,subject:t.subject,body:t.body})},W=e=>{const t=document.getElementById("body-editor");if(t){const o=t.selectionStart,i=t.selectionEnd,s=v,r=s.substring(0,o)+e+s.substring(i);x(r),setTimeout(()=>{t.focus(),t.selectionStart=t.selectionEnd=o+e.length},0)}else x(o=>o+e)},F=({scenario:e,channel:t})=>{const o=q===e.id,{isActive:i}=d(e.id),s=t==="email";return a.jsxs("div",{className:"aut-card","data-on":i?"1":"0",children:[a.jsxs("div",{className:"aut-card-top",children:[a.jsx("span",{className:"aut-card-ico",children:a.jsx("span",{className:"material-icons",children:e.icon})}),a.jsxs("div",{className:"aut-card-body",children:[a.jsx("div",{className:"aut-card-title",children:e.label}),a.jsx("div",{className:"aut-card-desc",children:e.description})]}),a.jsxs("div",{className:"aut-card-ctrls",children:[a.jsx("span",{className:"aut-state","data-on":i?"1":"0",children:i?"Activado":"Desactivado"}),a.jsx("button",{className:"aut-switch","data-on":i?"1":"0",onClick:()=>Q(e),disabled:A.isPending,"aria-label":i?"Desactivar":"Activar",children:a.jsx("span",{})}),a.jsx("button",{className:"aut-edit-btn","data-on":o?"1":"0",onClick:()=>o?b(null):R(e),"aria-label":o?"Cerrar editor":"Editar",children:a.jsx("span",{className:"material-icons",children:o?"expand_less":"edit"})})]})]}),o&&a.jsxs("div",{className:"aut-editor",children:[a.jsxs("div",{style:{marginBottom:14},children:[a.jsx("label",{className:"aut-label",children:s?"Asunto del correo":"Título de la notificación"}),a.jsx("input",{className:"aut-field",value:w,onChange:r=>_(r.target.value),placeholder:s?"Asunto…":"Título…"})]}),a.jsxs("div",{children:[a.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8},children:[a.jsx("label",{className:"aut-label",style:{margin:0},children:s?"Cuerpo del mensaje":"Mensaje"}),a.jsx("div",{style:{display:"flex",gap:5,flexWrap:"wrap"},children:e.variables.map(r=>a.jsx("button",{onClick:()=>W(r),className:"aut-var",title:"Insertar variable",children:r},r))})]}),s&&a.jsxs("div",{className:"aut-tip",children:[a.jsx("span",{className:"material-icons",children:"tips_and_updates"}),a.jsxs("span",{children:["Usá ",a.jsx("strong",{children:"**Título:**"})," para cajas de alerta. No incluyas el saludo inicial; el sistema lo agrega solo."]})]}),a.jsx("textarea",{id:"body-editor",className:"aut-textarea",value:v,onChange:r=>x(r.target.value),rows:s?14:6,style:{marginTop:8}})]}),a.jsxs("div",{style:{display:"flex",justifyContent:"flex-end",gap:10,marginTop:14},children:[a.jsx("button",{className:"aut-btn",onClick:()=>b(null),children:"Cancelar"}),a.jsxs("button",{className:"aut-btn aut-btn-primary",onClick:()=>U(e),disabled:y.isPending,children:[y.isPending?a.jsx("span",{className:"aut-spin",style:{borderTopColor:"var(--paper)"}}):a.jsx("span",{className:"material-icons",children:"save"}),"Guardar cambios"]})]})]})]})};return L?a.jsx(ee,{}):a.jsxs("div",{className:"aut",children:[g&&a.jsx(ae,{message:g.message,type:g.type,onClose:()=>n(null)}),a.jsxs("div",{className:"aut-head",children:[a.jsx("span",{className:"eyebrow",children:"Sistema · comunicación"}),a.jsx("h2",{className:"serif",children:"Automatizaciones"}),a.jsx("p",{children:"Editá las plantillas de mail y push, activá los escenarios que querés que se disparen solos, y probá un envío antes de confiarlo."})]}),a.jsxs("div",{className:"aut-tabs",children:[a.jsxs("button",{className:"aut-tab","data-on":f==="emails"?"1":"0",onClick:()=>k("emails"),children:[a.jsx("span",{className:"material-icons",children:"mark_email_read"}),"Correos"]}),a.jsxs("button",{className:"aut-tab","data-on":f==="push"?"1":"0",onClick:()=>k("push"),children:[a.jsx("span",{className:"material-icons",children:"notifications_active"}),"Push"]})]}),f==="emails"?a.jsxs(a.Fragment,{children:[a.jsxs("div",{className:"aut-test",children:[a.jsx("span",{className:"eyebrow",children:"Diagnóstico y pruebas"}),a.jsxs("div",{className:"aut-test-grid",children:[a.jsxs("div",{style:{flex:"1 1 200px"},children:[a.jsx("label",{className:"aut-label",children:"Plantilla a probar"}),a.jsx("select",{className:"aut-field",value:S,onChange:e=>D(e.target.value),children:m.map(e=>a.jsx("option",{value:e.id,children:e.label},e.id))})]}),a.jsxs("div",{style:{flex:"1 1 200px"},children:[a.jsx("label",{className:"aut-label",children:"Enviar a"}),a.jsx("input",{className:"aut-field",value:h,onChange:e=>M(e.target.value),placeholder:"tu_correo@ejemplo.com"})]}),a.jsxs("button",{className:"aut-btn aut-btn-primary",onClick:$,disabled:N,children:[N?a.jsx("span",{className:"aut-spin",style:{borderTopColor:"var(--paper)"}}):a.jsx("span",{className:"material-icons",children:"send"}),"Probar"]})]})]}),a.jsx("h3",{className:"aut-section-title",children:"Plantillas de correo"}),a.jsx("div",{children:m.map(e=>a.jsx(F,{scenario:e,channel:"email"},e.id))})]}):a.jsxs(a.Fragment,{children:[a.jsx("div",{className:"aut-test",children:a.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap"},children:[a.jsxs("div",{children:[a.jsx("span",{className:"eyebrow",children:"Mensaje de prueba"}),a.jsx("p",{style:{fontSize:12.5,color:"var(--ink-3)",margin:"4px 0 0"},children:"Enviar una notificación de prueba a todos los suscriptores activos."})]}),a.jsxs("button",{className:"aut-btn aut-btn-primary",onClick:O,disabled:E,children:[E?a.jsx("span",{className:"aut-spin",style:{borderTopColor:"var(--paper)"}}):a.jsx("span",{className:"material-icons",children:"send"}),"Enviar prueba"]})]})}),a.jsx("h3",{className:"aut-section-title",children:"Notificaciones automáticas"}),a.jsx("div",{children:I.map(e=>a.jsx(F,{scenario:e,channel:"push"},e.id))})]})]})};export{ue as default};
