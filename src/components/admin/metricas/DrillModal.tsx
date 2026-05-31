// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · modal de drill-down (Paper & Ink)
// Lista de alumnos/instituciones de una métrica. Reemplaza StudentListModal en
// la vista ejecutiva para mantener el registro editorial. Cierra con Esc/click.
// ──────────────────────────────────────────────────────────────────────────
import React, { useEffect } from "react";
import type { StudentInfo } from "../../../types";

export interface DrillRow extends StudentInfo {
  horas?: number | string;
  cupos?: number | string;
  detalle?: string;
}

export interface DrillState {
  title: string;
  subtitle?: string;
  rows: DrillRow[];
  kind?: "student" | "inst";
  loading?: boolean;
  onRowClick?: (row: DrillRow) => void;
}

export function DrillModal({ state, onClose }: { state: DrillState | null; onClose: () => void }) {
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;
  const { title, subtitle, rows, kind, loading, onRowClick } = state;
  const isInst = kind === "inst";

  return (
    <div
      className="metricas-v3-modal"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: "20px 22px 16px",
            borderBottom: "1px solid var(--rule-2)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3 className="display" style={{ margin: 0, fontSize: 25, lineHeight: 1 }}>
              {title}
            </h3>
            {subtitle && (
              <div className="meta" style={{ fontSize: 12.5, marginTop: 5 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm press"
            aria-label="Cerrar"
            style={{ flexShrink: 0 }}
            type="button"
          >
            <span className="material-icons" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "6px 0", flex: 1 }}>
          {loading && (
            <div className="meta" style={{ padding: "40px 22px", textAlign: "center" }}>
              Cargando registros…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="meta" style={{ padding: "40px 22px", textAlign: "center" }}>
              Sin registros para este año.
            </div>
          )}
          {!loading &&
            rows.map((r, i) => {
              const clickable =
                !!onRowClick &&
                !isInst &&
                r.legajo &&
                !["—", "Activa", "Confirmado", "Lanzada"].includes(String(r.legajo));
              const right =
                r.horas != null && r.horas !== ""
                  ? `${r.horas}${typeof r.horas === "number" ? " hs" : ""}`
                  : isInst && r.cupos != null
                    ? `${r.cupos} cupos`
                    : "";
              return (
                <div
                  key={i}
                  onClick={clickable ? () => onRowClick!(r) : undefined}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "11px 22px",
                    borderBottom: "1px solid var(--rule)",
                    cursor: clickable ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => {
                    if (clickable) e.currentTarget.style.background = "var(--paper-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (clickable) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.nombre}
                    </div>
                    <div className="meta mono" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {isInst ? String(r.legajo) : `legajo ${r.legajo}`}
                      {r.institucion ? ` · ${r.institucion}` : ""}
                      {r.detalle ? ` · ${r.detalle}` : ""}
                    </div>
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      color: "var(--ink-3)",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {right}
                  </div>
                </div>
              );
            })}
        </div>

        <div
          style={{
            padding: "12px 22px",
            borderTop: "1px solid var(--rule-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span className="meta mono" style={{ fontSize: 11.5 }}>
            {loading ? "…" : `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`}
          </span>
          <button onClick={onClose} className="btn btn-primary btn-sm press" type="button">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
