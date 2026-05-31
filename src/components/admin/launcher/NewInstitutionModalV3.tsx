/**
 * NewInstitutionModalV3 — Modal de alta de institución en el sistema Paper &
 * Ink. Reemplaza al modal antiguo (Tailwind slate/blue) embebido en
 * LanzadorConvocatorias.
 */
import React, { useState } from "react";
import { ALL_ORIENTACIONES, Orientacion } from "../../../types";

export interface NewInstitutionData {
  nombre: string;
  direccion: string;
  telefono: string;
  tutor: string;
  orientacionSugerida: Orientacion | "";
  logoFile: File | null;
  invertLogo: boolean;
}

interface NewInstitutionModalV3Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: NewInstitutionData) => void;
  isLoading: boolean;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
};

export const NewInstitutionModalV3: React.FC<NewInstitutionModalV3Props> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const [data, setData] = useState<NewInstitutionData>({
    nombre: "",
    direccion: "",
    telefono: "",
    tutor: "",
    orientacionSugerida: "",
    logoFile: null,
    invertLogo: false,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(data);
  };

  return (
    <div
      className="lv4"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        minHeight: 0,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--paper)",
          color: "var(--ink)",
          borderRadius: 14,
          border: "1px solid var(--rule-2)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
          overflow: "hidden",
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--rule-2)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h3 className="serif" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Nueva institución
            </h3>
            <div className="meta" style={{ marginTop: 4 }}>
              Se guardará como convenio nuevo.
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <span className="material-icons" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <span className="label" style={labelStyle}>
              Nombre institución *
            </span>
            <input
              className="field"
              value={data.nombre}
              onChange={(e) => setData({ ...data, nombre: e.target.value })}
              placeholder="Ej: Fundación Crecer"
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <span className="label" style={labelStyle}>
                Dirección
              </span>
              <input
                className="field"
                value={data.direccion}
                onChange={(e) => setData({ ...data, direccion: e.target.value })}
                placeholder="Calle y altura"
              />
            </div>
            <div>
              <span className="label" style={labelStyle}>
                Teléfono
              </span>
              <input
                className="field"
                value={data.telefono}
                onChange={(e) => setData({ ...data, telefono: e.target.value })}
                placeholder="Cód. área + número"
              />
            </div>
          </div>

          <div>
            <span className="label" style={labelStyle}>
              Tutor (Lic. en Psicología)
            </span>
            <input
              className="field"
              value={data.tutor}
              onChange={(e) => setData({ ...data, tutor: e.target.value })}
              placeholder="Nombre y apellido"
            />
          </div>

          <div>
            <span className="label" style={labelStyle}>
              Orientación sugerida
            </span>
            <select
              className="field"
              value={data.orientacionSugerida}
              onChange={(e) =>
                setData({ ...data, orientacionSugerida: e.target.value as Orientacion | "" })
              }
            >
              <option value="">Seleccionar para pre-llenar…</option>
              {ALL_ORIENTACIONES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div style={{ paddingTop: 8, borderTop: "1px solid var(--rule-2)" }}>
            <span className="label" style={labelStyle}>
              Logo institucional (opcional)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label className="btn btn-sm" style={{ cursor: "pointer" }}>
                <span className="material-icons" style={{ fontSize: 16 }}>
                  upload_file
                </span>
                {data.logoFile ? "Cambiar logo" : "Subir logo"}
                <input
                  type="file"
                  style={{ display: "none" }}
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setData({ ...data, logoFile: e.target.files[0] });
                    }
                  }}
                />
              </label>
              {data.logoFile && (
                <span
                  className="meta"
                  style={{
                    color: "var(--ok)",
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {data.logoFile.name}
                </span>
              )}
            </div>
            <label className="lf-check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={data.invertLogo}
                onChange={(e) => setData({ ...data, invertLogo: e.target.checked })}
              />
              <span className="lf-check-label">Invertir colores en modo oscuro</span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!data.nombre || isLoading}>
              {isLoading && (
                <span className="material-icons lf-spin" style={{ fontSize: 14 }}>
                  autorenew
                </span>
              )}
              Guardar institución
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewInstitutionModalV3;
