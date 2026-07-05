import{i as t}from"./injectScopedStyles-B_yJaYqk.js";const o=[".pen",".conv",".aut",".seg",".nco",".pz"],a=e=>o.map(r=>`${r}${e}`).join(", "),n=`
${o.join(", ")} {
  --pm-ease:cubic-bezier(.21,.66,.34,1);
  --pm-ease-out:cubic-bezier(.16,1,.3,1);
  --pm-shadow:0 1px 2px rgba(20,19,16,.04), 0 8px 24px -12px rgba(20,19,16,.18);
}
html.dark ${o.join(", html.dark ")} {
  --pm-shadow:0 1px 2px rgba(0,0,0,.3), 0 10px 30px -12px rgba(0,0,0,.6);
}

@keyframes pm-rise{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
@keyframes pm-pop{ from{ opacity:0; transform:translateY(8px) scale(.985); } to{ opacity:1; transform:translateY(0) scale(1); } }

/* Entrada de las tarjetas / paneles principales de cada herramienta */
${a(" .pen-card")},
${a(" .nco-pot")},
${a(" .nco-conf-item")},
${a(" .aut-card")},
${a(" .seg-inst")},
${a(" .pz-row")},
${a(" .conv-panel")} {
  animation:pm-rise .4s var(--pm-ease-out) both;
}

/* Lift sutil + sombra whisper-soft en hover de tarjetas accionables */
${a(" .pen-card")},
${a(" .aut-card")} {
  transition:background .2s var(--pm-ease), border-color .2s var(--pm-ease),
    box-shadow .25s var(--pm-ease), transform .25s var(--pm-ease);
}
${a(" .pen-card:hover")},
${a(" .aut-card:hover")} {
  box-shadow:var(--pm-shadow); transform:translateY(-2px);
}

/* Filas de institución (potenciales convenios) levantan apenas */
${a(" .nco-pot")} {
  transition:border-color .2s var(--pm-ease), box-shadow .25s var(--pm-ease), transform .25s var(--pm-ease);
}
${a(" .nco-pot:hover")} {
  box-shadow:var(--pm-shadow); transform:translateY(-2px);
}

/* Press táctil en botones primarios/acciones */
${a(" .pen-btn-primary:active")},
${a(" .conv-btn-primary:active")},
${a(" .aut-btn-primary:active")},
${a(" .seg-btn-primary:active")},
${a(" .nco-btn:active")} {
  transform:scale(.97);
}

/* Inputs: anillo de foco suave con el acento */
${a(" .pen-field:focus")},
${a(" .aut-field:focus")} {
  box-shadow:0 0 0 3px var(--accent-s);
}

@media (prefers-reduced-motion: reduce){
  ${o.map(e=>`${e} *, ${e} *::after, ${e} *::before`).join(", ")} {
    animation-duration:.001ms !important; animation-delay:0ms !important;
    transition-duration:.001ms !important;
  }
  ${a(" .pen-card:hover")},
  ${a(" .aut-card:hover")},
  ${a(" .nco-pot:hover")} { transform:none; }
}
`;function i(){t("premium-motion-styles",n)}export{i};
