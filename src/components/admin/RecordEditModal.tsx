import React, { useEffect, useRef, useState } from "react";
import {
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
} from "../../constants";
import type { AirtableRecord } from "../../types";
import { cleanDbValue } from "../../utils/formatters";
import { supabase } from "../../lib/supabaseClient";
import { logger } from "../../utils/logger";

interface FieldConfig {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "email"
    | "tel"
    | "select"
    | "checkbox"
    | "file"
    | "section";
  options?: readonly string[] | { value: string; label: string }[];
  isFullWidth?: boolean;
  description?: string;
  fileBucket?: string;
  filePath?: string;
  required?: boolean;
  minLength?: number;
}

interface TableConfig {
  label: string;
  schema: any;
  fieldConfig: FieldConfig[];
}

interface RecordEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AirtableRecord<any> | null; // Null for creation mode
  initialData?: any; // Data to pre-fill when in creation mode (e.g. duplicating)
  tableConfig: TableConfig;
  onSave: (recordId: string | null, fields: any) => void;
  isSaving: boolean;
}

const RecordEditModal: React.FC<RecordEditModalProps> = ({
  isOpen,
  onClose,
  record,
  initialData,
  tableConfig,
  onSave,
  isSaving,
}) => {
  const [formData, setFormData] = useState<any>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const isCreateMode = !record;

  const mouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    const data: { [key: string]: any } = {};

    tableConfig.fieldConfig.forEach((field) => {
      let rawVal;
      if (isCreateMode) {
        if (initialData && initialData[field.key] !== undefined) {
          rawVal = initialData[field.key];
        } else {
          rawVal = field.type === "checkbox" ? false : "";
        }
      } else {
        // If the key is mapped in schema, use the mapped key, otherwise assume flat structure
        // But generally RecordEditModal is used with mapped objects already.
        const keyToCheck = field.key;
        rawVal = record ? record[keyToCheck] : "";
      }

      // CLEAN ON INIT: Ensure the form starts with clean string values
      if (typeof rawVal === "string" || Array.isArray(rawVal)) {
        data[field.key] = cleanDbValue(rawVal);
      } else {
        data[field.key] = rawVal;
      }
    });
    setFormData(data);
    setValidationErrors({});
  }, [record, tableConfig, isCreateMode, initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === "checkbox";
    const checkedValue = (e.target as HTMLInputElement).checked;
    setFormData((prev: any) => ({
      ...prev,
      [name]: isCheckbox ? checkedValue : value,
    }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSave = () => {
    const errors: Record<string, string> = {};

    tableConfig.fieldConfig.forEach((field) => {
      if (field.type === "section" || field.type === "file") return;
      const val = formData[field.key];

      if (field.required) {
        if (val === null || val === undefined || String(val).trim() === "") {
          errors[field.key] = `${field.label} es obligatorio`;
        }
      }

      if (
        !errors[field.key] &&
        field.minLength &&
        typeof val === "string" &&
        val.trim().length > 0 &&
        val.trim().length < field.minLength
      ) {
        errors[field.key] = `Mínimo ${field.minLength} caracteres`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    const cleanedData = { ...formData };

    tableConfig.fieldConfig.forEach((field) => {
      const val = cleanedData[field.key];

      if (field.type === "number") {
        if (val === "" || val === null || val === undefined) {
          cleanedData[field.key] = null;
        } else {
          cleanedData[field.key] = Number(val);
        }
      } else if (field.type === "date") {
        // Una fecha vacía debe persistirse como null, no como "" (rompe columnas date).
        if (val === "" || val === null || val === undefined) {
          cleanedData[field.key] = null;
        }
      } else if (field.type === "text" || field.type === "textarea" || field.type === "select") {
        cleanedData[field.key] = cleanDbValue(val);
      }
    });

    onSave(record ? record.id : null, cleanedData);
  };

  if (!isOpen) return null;

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key] ?? "";
    const isCheckbox = field.type === "checkbox";
    const isTextarea = field.type === "textarea";

    const inputClasses = `dbe-field${validationErrors[field.key] ? " err" : ""}`;

    const errorMsg = validationErrors[field.key];

    if (!isCreateMode && record) {
      let displayValue = null;
      let icon = "link";

      if (
        field.key === FIELD_ESTUDIANTE_LINK_PRACTICAS ||
        field.key === FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS
      ) {
        displayValue = (record as any).__studentName;
        icon = "person";
      } else if (
        field.key === FIELD_LANZAMIENTO_VINCULADO_PRACTICAS ||
        field.key === FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS
      ) {
        displayValue = (record as any).__lanzamientoName;
        icon = "rocket_launch";
      }

      if (displayValue) {
        return (
          <div className="dbe-col-full">
            <label className="dbe-flabel">{field.label}</label>
            <div className="dbe-linked">
              <div className="dbe-linked-ico">
                <span className="material-icons">{icon}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <b>{displayValue}</b>
                <small>ID: {value}</small>
              </div>
            </div>
            <input type="hidden" name={field.key} value={value} />
          </div>
        );
      }
    }

    if (field.type === "section") {
      return (
        <div className="dbe-section-div">
          <div className="ln" />
          <span>{field.label}</span>
          <div className="ln" />
        </div>
      );
    }

    const wrapperClasses = field.isFullWidth || isTextarea ? "dbe-col-full" : "";

    if (isTextarea) {
      return (
        <div className={wrapperClasses}>
          <label className="dbe-flabel">
            <span>
              {field.label}
              {field.required && <span className="req"> ●</span>}
            </span>
            {field.description && <span className="hint">{field.description}</span>}
          </label>
          <textarea
            name={field.key}
            value={value}
            onChange={handleChange}
            rows={3}
            className={inputClasses}
          />
          {errorMsg && <p className="dbe-errmsg">{errorMsg}</p>}
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div className={wrapperClasses}>
          <label className="dbe-flabel">
            <span>
              {field.label}
              {field.required && <span className="req"> ●</span>}
            </span>
          </label>
          <div className="dbe-sel-icon">
            <select
              name={field.key}
              value={value}
              onChange={handleChange}
              className={`${inputClasses} sel`}
            >
              <option value="">Seleccionar...</option>
              {field.options?.map((opt) => {
                if (typeof opt === "string") {
                  return (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  );
                }
                return (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                );
              })}
            </select>
            <span className="material-icons">expand_more</span>
          </div>
          {errorMsg && <p className="dbe-errmsg">{errorMsg}</p>}
        </div>
      );
    }

    if (isCheckbox) {
      return (
        <div
          className={wrapperClasses}
          style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 8 }}
        >
          <input
            type="checkbox"
            id={field.key}
            name={field.key}
            checked={!!value}
            onChange={handleChange}
            style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--accent)" }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label
              htmlFor={field.key}
              style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}
            >
              {field.label}
            </label>
            {field.description && <span className="dbe-fdesc">{field.description}</span>}
          </div>
        </div>
      );
    }

    let inputValue = value;
    if (field.type === "date" && typeof value === "string") {
      inputValue = value.split("T")[0];
    }

    if (field.type === "file") {
      const bucket = field.fileBucket || "documentos_pps";
      const basePath = field.filePath || "convocatorias";
      const isUploading = uploadingField === field.key;

      return (
        <div className={wrapperClasses}>
          <label className="dbe-flabel">{field.label}</label>
          {value ? (
            <div className="dbe-file-ok">
              <span className="material-icons">check_circle</span>
              <span>Archivo cargado</span>
              <a href={value} target="_blank" rel="noopener noreferrer" title="Abrir">
                <span className="material-icons">open_in_new</span>
              </a>
              <button
                type="button"
                onClick={() => setFormData((prev: any) => ({ ...prev, [field.key]: "" }))}
                title="Quitar"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
          ) : (
            <label className="dbe-file">
              <span className="material-icons">
                {isUploading ? "hourglass_top" : "cloud_upload"}
              </span>
              <p>{isUploading ? "Subiendo…" : "Arrastrá o elegí un archivo"}</p>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setUploadingField(field.key);
                    const fileExt = file.name.split(".").pop();
                    const fileName = `${basePath}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage
                      .from(bucket)
                      .upload(fileName, file, { upsert: true });
                    if (uploadError) throw uploadError;
                    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
                    setFormData((prev: any) => ({ ...prev, [field.key]: urlData.publicUrl }));
                  } catch (err: any) {
                    logger.error("Error uploading file:", err);
                    alert("Error al subir archivo: " + err.message);
                  } finally {
                    setUploadingField(null);
                  }
                }}
              />
            </label>
          )}
          {field.description && <p className="dbe-fdesc">{field.description}</p>}
        </div>
      );
    }

    return (
      <div className={wrapperClasses}>
        <label className="dbe-flabel">
          <span>
            {field.label}
            {field.required && <span className="req"> ●</span>}
          </span>
        </label>
        <input
          type={field.type}
          name={field.key}
          value={inputValue}
          onChange={handleChange}
          className={inputClasses}
        />
        {errorMsg && <p className="dbe-errmsg">{errorMsg}</p>}
        {field.description && !errorMsg && <p className="dbe-fdesc">{field.description}</p>}
      </div>
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
            <span className="eyebrow">
              {isCreateMode ? (initialData ? "Duplicar" : "Nuevo") : "Editar"} · {tableConfig.label}
            </span>
            <h3 className="serif">
              {isCreateMode
                ? initialData
                  ? "Duplicar registro"
                  : "Nuevo registro"
                : "Editar registro"}
            </h3>
          </div>
          <button onClick={onClose} className="dbe-modal-x" aria-label="Cerrar">
            <span className="material-icons">close</span>
          </button>
        </header>

        <main className="dbe-modal-body">
          <div className="dbe-grid">
            {tableConfig.fieldConfig.map((field) => (
              <React.Fragment key={field.key}>{renderField(field)}</React.Fragment>
            ))}
          </div>
        </main>

        <footer className="dbe-modal-foot">
          <button onClick={onClose} className="dbe-btn">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isSaving} className="dbe-btn dbe-btn-primary">
            {isSaving ? (
              <>
                <span className="dbe-spin" style={{ borderTopColor: "var(--paper)" }} />
                Guardando…
              </>
            ) : (
              <>
                <span className="material-icons">save</span>
                {isCreateMode ? "Crear" : "Guardar"}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default RecordEditModal;
