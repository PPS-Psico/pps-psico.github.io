import{A as u,a as m,j as e,C as b,u as r,b as l,S as x,c as p,d as f}from"./index-ZXlslG1z.js";import{A as h}from"./AppModals-D8FkQV9k.js";import g from"./StudentDashboard-_sgKRHhD.js";import"./types-CzNk-woI.js";import"./proxy-BFxRqQFC.js";import"./Select-DhRNnplj.js";import"./types-Cg8ilULs.js";import"./PreSolicitudCheckModal-J-N_Aj9Q.js";import"./Tabs-3YiwyxBG.js";import"./ProfileView-CEvSVS12.js";import"./ConvocatoriaCardPremium-Cd-vXGWP.js";const j={inicio:{title:"Sobre las Convocatorias",text:"Las convocatorias se abren y cierran según las necesidades de las instituciones. Si no ves una PPS de tu interés, ¡vuelve a consultar pronto! Las fechas y horarios son definidos por cada institución y no pueden modificarse.",icon:"campaign",mailToSubject:"Consulta sobre Convocatorias de PPS - Mi Panel Académico",mailToBody:`Hola,

Tengo una consulta sobre las convocatorias de PPS.

- Nombre Completo: [Escribe tu nombre]
- Legajo: [Escribe tu legajo]
- Mi consulta es: [Describe tu duda]

Gracias.`,buttonText:"Consultar sobre convocatorias"},solicitudes:{title:"Acerca de tus Solicitudes",text:"El estado de tus solicitudes de PPS se actualiza a medida que avanzan las gestiones con las instituciones, lo cual puede tomar tiempo. Te mantendremos informado de cada avance a través de notificaciones por correo electrónico. Si tienes dudas sobre un estado en particular, puedes contactarnos.",icon:"list_alt",mailToSubject:"Consulta sobre Estado de Solicitud de PPS - Mi Panel Académico",mailToBody:`Hola,

Tengo una consulta sobre el estado de mi solicitud de PPS.

- Nombre Completo: [Escribe tu nombre]
- Legajo: [Escribe tu legajo]
- Institución Solicitada: [Escribe el nombre de la institución]

Gracias.`,buttonText:"Consultar sobre una solicitud"},practicas:{title:m,text:u,icon:"gavel",mailToSubject:"Solicitud de Corrección de Datos - Mi Panel Académico",mailToBody:`Hola,

Solicito una corrección en mis datos. Adjunto la documentación respaldatoria (ej. planilla de asistencia).

- Nombre Completo: [Escribe tu nombre]
- Legajo: [Escribe tu legajo]

Gracias.`,buttonText:"Enviar correo para corrección"},profile:{title:"Sobre tus Datos Personales",text:"Mantener tus datos de contacto actualizados es fundamental para que las instituciones puedan contactarse contigo. Ahora tienes el control para editar tu teléfono y correo electrónico directamente desde este panel si detectas algún cambio necesario.",icon:"contact_mail",mailToSubject:"Solicitud de Actualización de Datos - Mi Panel Académico",mailToBody:`Hola,

Tengo una consulta o solicitud sobre mis datos personales.

- Nombre Completo: [Escribe tu nombre]
- Legajo: [Escribe tu legajo]
- Mi consulta es: [Describe tu duda]

Gracias.`,buttonText:"Consultar sobre mis datos"}},v=({activeTab:s})=>{const t=j[s];if(!t)return null;const i=`mailto:blas.rivera@uflouniversidad.edu.ar?subject=${encodeURIComponent(t.mailToSubject)}&body=${encodeURIComponent(t.mailToBody)}`;return e.jsx("footer",{className:"mt-16 mb-8 animate-fade-in-up",children:e.jsx(b,{children:e.jsxs("div",{className:"flex flex-col sm:flex-row items-start gap-6",children:[e.jsx("div",{className:"hidden sm:block flex-shrink-0",children:e.jsx("div",{className:"bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 rounded-2xl h-14 w-14 flex items-center justify-center border border-blue-100 dark:border-blue-800 shadow-sm",children:e.jsx("span",{className:"material-icons !text-3xl","aria-hidden":"true",children:t.icon})})}),e.jsxs("div",{className:"flex-grow pt-2 sm:pt-0",children:[e.jsx("h3",{className:"font-extrabold text-slate-900 dark:text-white text-lg leading-tight mb-3",children:t.title}),e.jsx("p",{className:"text-slate-600 dark:text-slate-300 text-sm leading-relaxed max-w-prose",children:t.text}),e.jsx("div",{className:"mt-6",children:e.jsxs("a",{href:i,target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center gap-2.5 bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 dark:text-white dark:border-transparent dark:hover:from-blue-500 dark:hover:to-indigo-500 font-bold text-sm py-3 px-6 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900",children:[e.jsx("span",{className:"material-icons !text-lg",children:"email"}),e.jsx("span",{children:t.buttonText})]})})]})]})})})},T=({tabs:s,activeTabId:t})=>{const i=r();return e.jsx("nav",{className:"md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.04)] z-50 safe-area-bottom",children:e.jsx("div",{className:"flex justify-around items-center h-[65px] pb-1 relative",children:s.map(o=>{const a=o.id===t;return e.jsxs("button",{onClick:()=>i(o.path),style:{WebkitTapHighlightColor:"transparent"},className:"relative flex flex-col items-center justify-center w-full h-full group focus:outline-none active:bg-transparent",children:[a&&e.jsx("div",{className:"absolute inset-x-3 top-2 bottom-1 bg-blue-50 dark:bg-blue-900/10 rounded-xl -z-10 animate-fade-in"}),e.jsx("div",{className:`transition-all duration-300 ease-out transform ${a?"-translate-y-0.5":""}`,children:e.jsx("div",{className:`
                    p-1 rounded-xl transition-all duration-300 
                    ${a?"text-blue-600 dark:text-blue-400":"text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"}
                `,children:e.jsx("span",{className:`material-icons transition-all duration-300 ${a?"!text-[26px] drop-shadow-sm":"!text-[24px]"}`,children:o.icon})})}),e.jsx("span",{className:`
                  text-[10px] font-bold transition-all duration-300 leading-none mt-0.5
                  ${a?"text-blue-900 dark:text-blue-100 scale-105":"text-slate-500 dark:text-slate-500 scale-100"}
              `,children:o.label})]},o.id)})})})},k=()=>{const{authenticatedUser:s}=l(),{finalizacionRequest:t}=p(),i=f(),o=r();let a="inicio";i.pathname.includes("/practicas")?a="practicas":i.pathname.includes("/solicitudes")?a="solicitudes":i.pathname.includes("/perfil")&&(a="profile");const c=n=>{o(n==="inicio"?"/student":n==="profile"?"/student/perfil":`/student/${n}`)},d=[{id:"inicio",label:"Inicio",icon:"home",path:"/student"},{id:"practicas",label:"Prácticas",icon:"work_history",path:"/student/practicas"},{id:"solicitudes",label:"Solicitudes",icon:"list_alt",path:"/student/solicitudes"},{id:"profile",label:"Perfil",icon:"person",path:"/student/perfil"}];return e.jsxs("div",{className:"pb-24 md:pb-8 min-h-screen flex flex-col",children:[e.jsx("main",{className:"flex-grow",children:e.jsx(g,{user:s,activeTab:a,onTabChange:c})}),!t&&e.jsx(v,{activeTab:a}),e.jsx(h,{}),!t&&e.jsx(T,{tabs:d,activeTabId:a})]})},R=()=>{const{authenticatedUser:s}=l();return s?e.jsx(x,{legajo:s.legajo,children:e.jsx(k,{})}):null};export{R as default};
