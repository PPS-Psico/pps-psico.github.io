/**
 * premiumMotion — capa de movimiento compartida para las herramientas del Taller.
 *
 * Inyecta una sola vez tokens de easing + animaciones de entrada para todos los
 * namespaces scoped del Taller (.pen, .conv, .aut, .seg, .nco, .pz). Mantiene la
 * estética editorial: motion con propósito, sin bounce, y SIEMPRE respetando
 * prefers-reduced-motion.
 *
 * Llamar a nivel de módulo en cada herramienta (idempotente).
 */
import { injectScopedStyles } from "../../utils/injectScopedStyles";

const SCOPES = [".pen", ".conv", ".aut", ".seg", ".nco", ".pz"];
const sel = (suffix: string) => SCOPES.map((s) => `${s}${suffix}`).join(", ");

const CSS = `
${SCOPES.join(", ")} {
  --pm-ease:cubic-bezier(.21,.66,.34,1);
  --pm-ease-out:cubic-bezier(.16,1,.3,1);
  --pm-shadow:0 1px 2px rgba(20,19,16,.04), 0 8px 24px -12px rgba(20,19,16,.18);
}
html.dark ${SCOPES.join(", html.dark ")} {
  --pm-shadow:0 1px 2px rgba(0,0,0,.3), 0 10px 30px -12px rgba(0,0,0,.6);
}

@keyframes pm-rise{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
@keyframes pm-pop{ from{ opacity:0; transform:translateY(8px) scale(.985); } to{ opacity:1; transform:translateY(0) scale(1); } }

/* Entrada de las tarjetas / paneles principales de cada herramienta */
${sel(" .pen-card")},
${sel(" .nco-pot")},
${sel(" .nco-conf-item")},
${sel(" .aut-card")},
${sel(" .seg-inst")},
${sel(" .pz-row")},
${sel(" .conv-panel")} {
  animation:pm-rise .4s var(--pm-ease-out) both;
}

/* Lift sutil + sombra whisper-soft en hover de tarjetas accionables */
${sel(" .pen-card")},
${sel(" .aut-card")} {
  transition:background .2s var(--pm-ease), border-color .2s var(--pm-ease),
    box-shadow .25s var(--pm-ease), transform .25s var(--pm-ease);
}
${sel(" .pen-card:hover")},
${sel(" .aut-card:hover")} {
  box-shadow:var(--pm-shadow); transform:translateY(-2px);
}

/* Filas de institución (potenciales convenios) levantan apenas */
${sel(" .nco-pot")} {
  transition:border-color .2s var(--pm-ease), box-shadow .25s var(--pm-ease), transform .25s var(--pm-ease);
}
${sel(" .nco-pot:hover")} {
  box-shadow:var(--pm-shadow); transform:translateY(-2px);
}

/* Press táctil en botones primarios/acciones */
${sel(" .pen-btn-primary:active")},
${sel(" .conv-btn-primary:active")},
${sel(" .aut-btn-primary:active")},
${sel(" .seg-btn-primary:active")},
${sel(" .nco-btn:active")} {
  transform:scale(.97);
}

/* Inputs: anillo de foco suave con el acento */
${sel(" .pen-field:focus")},
${sel(" .aut-field:focus")} {
  box-shadow:0 0 0 3px var(--accent-s);
}

@media (prefers-reduced-motion: reduce){
  ${SCOPES.map((s) => `${s} *, ${s} *::after, ${s} *::before`).join(", ")} {
    animation-duration:.001ms !important; animation-delay:0ms !important;
    transition-duration:.001ms !important;
  }
  ${sel(" .pen-card:hover")},
  ${sel(" .aut-card:hover")},
  ${sel(" .nco-pot:hover")} { transform:none; }
}
`;

export function injectPremiumMotion(): void {
  injectScopedStyles("premium-motion-styles", CSS);
}
