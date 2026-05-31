/**
 * LaunchFormPrimitives — Piezas presentacionales del formulario "Nuevo
 * Lanzamiento" en el sistema visual Paper & Ink (v3). Usan las clases globales
 * (field, label, meta, btn, chip-orient) y los tokens --paper/--ink que provee
 * el contenedor .lv4 del Lanzador.
 */
import React from "react";
import { injectScopedStyles } from "../../../utils/injectScopedStyles";

const CSS = `
.lf-section { margin-bottom: 36px; padding-bottom: 28px; border-bottom: 1px solid var(--rule-2); }
.lf-section:last-child { border-bottom: none; }
.lf-section-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
.lf-section-num {
  font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-4);
  padding-top: 3px; flex-shrink: 0; font-variant-numeric: tabular-nums;
}
.lf-section-title {
  margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink);
  display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.lf-section-sub { font-size: 12px; color: var(--ink-3); margin-top: 4px; }
.lf-pending {
  display: inline-flex; align-items: center; gap: 4px; font-size: 11px;
  color: var(--warn); font-weight: 600;
}
.lf-row { margin-bottom: 18px; }
.lf-row:last-child { margin-bottom: 0; }
.lf-row > .label { display: block; margin-bottom: 7px; }
.lf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.lf-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 720px) { .lf-grid-2, .lf-grid-3 { grid-template-columns: 1fr; } }

.lf-check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; padding: 4px 0; }
.lf-check input { margin-top: 2px; accent-color: var(--ink); width: 15px; height: 15px; cursor: pointer; }
.lf-check-label { font-size: 13px; color: var(--ink); font-weight: 500; }
.lf-check-sub { font-size: 12px; color: var(--ink-3); margin-top: 2px; }

.lf-callout {
  padding: 16px; border-radius: 12px; border: 1px dashed var(--ai);
  background: var(--ai-soft); margin-bottom: 20px;
}
.lf-info-box {
  padding: 14px 16px; border-radius: 10px; border: 1px solid var(--rule-2);
  background: var(--paper-2);
}
.lf-act-num {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-4);
  width: 22px; flex-shrink: 0; text-align: center;
}
@keyframes lf-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.lf-spin { animation: lf-spin 1s linear infinite; }
`;

injectScopedStyles("launcher-form-v3", CSS);

/* ── Section ─────────────────────────────────────────────────────────────── */
export const FormSection: React.FC<{
  number: string;
  title: string;
  subtitle?: string;
  pending?: number;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ number, title, subtitle, pending = 0, right, children }) => (
  <section className="lf-section">
    <div className="lf-section-head" style={{ justifyContent: "space-between" }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
        <span className="lf-section-num">{number}</span>
        <div style={{ minWidth: 0 }}>
          <h3 className="lf-section-title">
            {title}
            {pending > 0 && (
              <span
                className="lf-pending"
                title={`Faltan ${pending} dato${pending === 1 ? "" : "s"} en esta sección`}
              >
                <span className="dot dot-warn" style={{ width: 6, height: 6 }} />
                {pending} pendiente{pending === 1 ? "" : "s"}
              </span>
            )}
          </h3>
          {subtitle && <div className="lf-section-sub">{subtitle}</div>}
        </div>
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
    <div>{children}</div>
  </section>
);

/* ── Field row (label + control) ─────────────────────────────────────────── */
export const FormField: React.FC<{
  label: React.ReactNode;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, hint, className, children }) => (
  <div className={`lf-row ${className || ""}`}>
    <span className="label">{label}</span>
    {children}
    {hint && (
      <div className="meta" style={{ marginTop: 6 }}>
        {hint}
      </div>
    )}
  </div>
);

/* ── Checkbox row ────────────────────────────────────────────────────────── */
export const CheckRow: React.FC<{
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, sublabel, checked, onChange }) => (
  <label className="lf-check">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>
      <span className="lf-check-label">{label}</span>
      {sublabel && (
        <span className="lf-check-sub" style={{ display: "block" }}>
          {sublabel}
        </span>
      )}
    </span>
  </label>
);
