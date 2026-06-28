import React, { useEffect, useRef, useState } from "react";
import { injectEditorStyles } from "./editorStyles";

injectEditorStyles();

export interface BulkFieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: readonly string[] | { value: string; label: string }[];
}

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Cantidad de registros que serán afectados. */
  count: number;
  /** Texto descriptivo del alcance (institución / convocatoria). */
  scopeLabel: string;
  fields: BulkFieldConfig[];
  onConfirm: (changes: Record<string, any>) => void;
  isSaving: boolean;
}

/**
 * BulkEditModal — edición masiva de prácticas filtradas.
 *
 * El usuario tilda los campos que quiere sobrescribir y solo esos se aplican a
 * todos los registros del filtro activo (ej.: cambiar la orientación de toda
 * una convocatoria sin editar alumno por alumno).
 */
const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  count,
  scopeLabel,
  fields,
  onConfirm,
  isSaving,
}) => {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, any>>({});
  const mouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEnabled({});
      setValues({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (key: string) => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));

  const setValue = (key: string, value: any) => setValues((prev) => ({ ...prev, [key]: value }));

  const activeKeys = fields.filter((f) => enabled[f.key]).map((f) => f.key);

  const handleApply = () => {
    const changes: Record<string, any> = {};
    activeKeys.forEach((key) => {
      const field = fields.find((f) => f.key === key)!;
      let val = values[key];
      if (field.type === "number") {
        val = val === "" || val === undefined || val === null ? null : Number(val);
      } else if (field.type === "date") {
        val = val === "" || val === undefined ? null : val;
      } else {
        val = val ?? "";
      }
      changes[key] = val;
    });
    onConfirm(changes);
  };

  const renderInput = (field: BulkFieldConfig) => {
    const value = values[field.key] ?? "";
    const disabled = !enabled[field.key];

    if (field.type === "select") {
      return (
        <div className="dbe-sel-icon">
          <select
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(field.key, e.target.value)}
            className="dbe-field sel"
          >
            <option value="">Seleccionar...</option>
            {field.options?.map((opt) => {
              const v = typeof opt === "string" ? opt : opt.value;
              const l = typeof opt === "string" ? opt : opt.label;
              return (
                <option key={v} value={v}>
                  {l}
                </option>
              );
            })}
          </select>
          <span className="material-icons">expand_more</span>
        </div>
      );
    }

    return (
      <input
        type={field.type}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(field.key, e.target.value)}
        className="dbe-field"
      />
    );
  };

  return (
    <div
      className="dbe dbe-modal-bg"
      onMouseDown={(e) => {
        mouseDownTarget.current = e.target;
      }}
      onMouseUp={(e) => {
        if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) {
          onClose();
        }
        mouseDownTarget.current = null;
      }}
    >
      <div
        className="dbe-modal"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="dbe-modal-head">
          <div>
            <span className="eyebrow">Edición masiva · Prácticas</span>
            <h3 className="serif">
              Editar {count} registro{count === 1 ? "" : "s"}
            </h3>
          </div>
          <button onClick={onClose} className="dbe-modal-x" aria-label="Cerrar">
            <span className="material-icons">close</span>
          </button>
        </header>

        <main className="dbe-modal-body">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              marginBottom: 18,
              borderRadius: 10,
              background: "var(--accent-s)",
              border: "1px solid var(--rule-2)",
            }}
          >
            <span className="material-icons" style={{ fontSize: 18, color: "var(--accent)" }}>
              info
            </span>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)", margin: 0 }}>
              Tildá solo los campos que querés sobrescribir. Se aplicarán a{" "}
              <b>todos los {count} registros</b> de {scopeLabel}. Los campos sin tildar quedan
              intactos.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {fields.map((field) => (
              <div
                key={field.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px 160px 1fr",
                  alignItems: "center",
                  gap: 12,
                  opacity: enabled[field.key] ? 1 : 0.62,
                  transition: "opacity .15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!enabled[field.key]}
                  onChange={() => toggle(field.key)}
                  style={{
                    width: 18,
                    height: 18,
                    cursor: "pointer",
                    accentColor: "var(--accent)",
                  }}
                  aria-label={`Aplicar ${field.label}`}
                />
                <label
                  onClick={() => toggle(field.key)}
                  style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}
                >
                  {field.label}
                </label>
                {renderInput(field)}
              </div>
            ))}
          </div>
        </main>

        <footer className="dbe-modal-foot">
          <button onClick={onClose} className="dbe-btn">
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={isSaving || activeKeys.length === 0}
            className="dbe-btn dbe-btn-primary"
          >
            {isSaving ? (
              <>
                <span className="dbe-spin" style={{ borderTopColor: "var(--paper)" }} />
                Aplicando…
              </>
            ) : (
              <>
                <span className="material-icons">done_all</span>
                Aplicar a {count} registro{count === 1 ? "" : "s"}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BulkEditModal;
