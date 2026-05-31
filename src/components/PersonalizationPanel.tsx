/**
 * PersonalizationPanel — Rediseño v1 (Paper & Ink editorial)
 *
 * Solo cambia la capa visual. La lógica se preserva: cada switch togglea un
 * módulo del panel vía AdminPreferencesContext (preferencia local del navegador).
 */
import React from "react";
import { useAdminPreferences, AdminModuleConfig } from "../contexts/AdminPreferencesContext";
import { injectScopedStyles } from "../utils/injectScopedStyles";
import { injectPremiumMotion } from "./admin/premiumMotion";

const CSS = `
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
`;

injectScopedStyles("pz-styles", CSS);
injectPremiumMotion();

interface SwitchDef {
  key: keyof AdminModuleConfig;
  label: string;
  description: string;
  icon: string;
}

interface SwitchGroup {
  title: string;
  items: SwitchDef[];
}

const GROUPS: SwitchGroup[] = [
  {
    title: "Experiencia principal",
    items: [
      {
        key: "showAiInsights",
        label: "Briefing de Hermes",
        description: "Muestra el resumen inteligente y las alertas en Inicio.",
        icon: "auto_awesome",
      },
      {
        key: "showManagementTab",
        label: "Gestión y planificación",
        description: "Habilita la planificación futura y la gestión de relanzamientos.",
        icon: "rocket_launch",
      },
      {
        key: "showLaunchHistory",
        label: "Historial de lanzamientos",
        description: "Muestra la pestaña de historial en el Lanzador.",
        icon: "history",
      },
    ],
  },
  {
    title: "Herramientas del taller",
    items: [
      {
        key: "showPenalizations",
        label: "Penalizaciones",
        description: "Aplicar y visualizar sanciones a los alumnos.",
        icon: "gavel",
      },
      {
        key: "showAutomation",
        label: "Automatizaciones",
        description: "Editor de plantillas de mail y push.",
        icon: "mark_email_read",
      },
      {
        key: "showNewAgreements",
        label: "Convenios nuevos",
        description: "Confirmar los convenios institucionales del ciclo.",
        icon: "handshake",
      },
      {
        key: "showAgreementGenerator",
        label: "Generador de convenios",
        description: "Redacción de convenios marco y específicos con IA.",
        icon: "auto_awesome",
      },
      {
        key: "showReports",
        label: "Reportes",
        description: "Balances anuales y comparativos para Métricas.",
        icon: "summarize",
      },
      {
        key: "showBackups",
        label: "Backups",
        description: "Respaldos automáticos y manuales de la base.",
        icon: "backup",
      },
    ],
  },
];

const PersonalizationPanel: React.FC = () => {
  const { preferences, toggleModule, resetPreferences } = useAdminPreferences();

  return (
    <div className="pz">
      <div className="pz-head">
        <span className="eyebrow">Sistema · preferencias</span>
        <h2 className="serif">Personalización</h2>
        <p>
          Prendé o apagá los módulos del panel según tu flujo. Es una preferencia de este navegador:
          no cambia la experiencia de otros administradores.
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title} className="pz-group">
          <div className="pz-group-title">
            <span className="eyebrow">{group.title}</span>
          </div>
          <div className="pz-rows">
            {group.items.map((item) => {
              const on = preferences[item.key];
              return (
                <button
                  key={item.key}
                  className="pz-row"
                  data-on={on ? "1" : "0"}
                  onClick={() => toggleModule(item.key)}
                  role="switch"
                  aria-checked={on}
                >
                  <span className="pz-row-main">
                    <span className="pz-ico">
                      <span className="material-icons">{item.icon}</span>
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="pz-row-label">{item.label}</span>
                      <span className="pz-row-desc" style={{ display: "block" }}>
                        {item.description}
                      </span>
                    </span>
                  </span>
                  <span className="pz-switch" aria-hidden="true">
                    <span />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="pz-foot">
        <span className="pz-note">
          <span className="material-icons">devices</span>
          Estos ajustes se guardan solo en este navegador.
        </span>
        <button className="pz-reset" onClick={resetPreferences}>
          <span className="material-icons">restart_alt</span>
          Restaurar valores por defecto
        </button>
      </div>
    </div>
  );
};

export default PersonalizationPanel;
