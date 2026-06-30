import React, { useEffect, useMemo, useState } from "react";
import { FIELD_ESTUDIANTE_FINALIZACION } from "../../../constants";
import { supabase } from "../../../lib/supabaseClient";
import { Attachment, getStoragePath } from "../../../utils/attachmentUtils";
import { formatDate, safeGetId } from "../../../utils/formatters";
import { logger } from "../../../utils/logger";
import { FilePreview } from "../preview";
import { normalizeAttachments, filterEgresoFinalizaciones, isHistoryFinalizacion } from "./helpers";
import { CollapsibleHistory, EmptyState, SearchBar } from "./primitives";
import type { FinalizacionWithStudent } from "./types";

// ─── TABS CONTENT: EGRESO ───────────────────────────────────────────
interface EgresoTabViewProps {
  search: string;
  setSearch: (s: string) => void;
  list: FinalizacionWithStudent[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onUpdateStatus: (id: string, s: string) => void;
  onDelete: (record: any) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
}

const EgresoTabView: React.FC<EgresoTabViewProps> = ({
  search,
  setSearch,
  list,
  expandedId,
  onToggle,
  onUpdateStatus,
  onDelete,
  onToast,
}) => {
  const filtered = useMemo(() => filterEgresoFinalizaciones(list, search), [list, search]);

  const active = filtered.filter((s) => !isHistoryFinalizacion(s));
  const history = filtered.filter(isHistoryFinalizacion);

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por estudiante o legajo…"
        />
        <span className="meta">{filtered.length} finalizaciones</span>
      </div>

      {active.length === 0 && history.length === 0 ? (
        <EmptyState
          icon="task_alt"
          title="Sin solicitudes"
          msg="No hay solicitudes de finalización con los filtros actuales."
        />
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  margin: "4px 0 12px",
                  paddingLeft: 2,
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: 999, background: "var(--warn)" }}
                ></span>
                <span className="label">Pendientes ({active.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {active.map((sol) => (
                  <EgresoCardItem
                    key={sol.id}
                    sol={sol}
                    expanded={expandedId === sol.id}
                    onToggle={() => onToggle(sol.id)}
                    onUpdateStatus={onUpdateStatus}
                    onDelete={onDelete}
                    onToast={onToast}
                  />
                ))}
              </div>
            </>
          )}

          {history.length > 0 && (
            <CollapsibleHistory count={history.length}>
              {history.map((sol) => (
                <EgresoCardItem
                  key={sol.id}
                  sol={sol}
                  expanded={expandedId === sol.id}
                  onToggle={() => onToggle(sol.id)}
                  onUpdateStatus={onUpdateStatus}
                  onDelete={onDelete}
                  onToast={onToast}
                />
              ))}
            </CollapsibleHistory>
          )}
        </>
      )}
    </div>
  );
};

// ─── EGRESO CARD ITEM ───────────────────────────────────────────────
interface EgresoCardItemProps {
  sol: FinalizacionWithStudent;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, s: string) => void;
  onDelete: (record: any) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
}

const EgresoCardItem: React.FC<EgresoCardItemProps> = ({
  sol,
  expanded,
  onToggle,
  onUpdateStatus,
  onDelete,
  onToast,
}) => {
  const [practice, setPractice] = useState<any>(null);
  const [loadingPrac, setLoadingPrac] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Attachment[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const planillaFiles = useMemo(
    () => normalizeAttachments(sol.planilla_horas_url),
    [sol.planilla_horas_url]
  );
  const informeFiles = useMemo(
    () => normalizeAttachments(sol.informe_final_url),
    [sol.informe_final_url]
  );
  const asistenciaFiles = useMemo(
    () => normalizeAttachments(sol.planilla_asistencia_url),
    [sol.planilla_asistencia_url]
  );
  const allFiles = useMemo(
    () => [...planillaFiles, ...informeFiles, ...asistenciaFiles],
    [planillaFiles, informeFiles, asistenciaFiles]
  );

  const docCount = allFiles.length;

  useEffect(() => {
    let active = true;
    const fetchPractice = async () => {
      const sId = safeGetId(sol[FIELD_ESTUDIANTE_FINALIZACION]);
      if (!sId || !expanded) return;
      setLoadingPrac(true);
      try {
        const { data, error } = await supabase
          .from("practicas")
          .select("*, lanzamientos_pps(nombre_pps, horas_acreditadas, orientacion)")
          .eq("estudiante_id", sId)
          .maybeSingle();

        if (!error && data && active) {
          setPractice(data);
        }
      } catch (e) {
        logger.error(e);
      } finally {
        if (active) setLoadingPrac(false);
      }
    };
    fetchPractice();
    return () => {
      active = false;
    };
  }, [sol, expanded]);

  const isFinalizado =
    sol.estado?.toLowerCase() === "cargado" || sol.estado?.toLowerCase() === "finalizada";
  const isEnProceso = sol.estado?.toLowerCase() === "en proceso";

  let visualStatus = "Pendiente";
  let statusColor = "var(--warn)";
  let statusBg = "var(--warn-soft)";
  if (isFinalizado) {
    visualStatus = "Finalizada";
    statusColor = "var(--ok)";
    statusBg = "var(--ok-soft)";
  } else if (isEnProceso) {
    visualStatus = "En Proceso SAC";
    statusColor = "var(--accent)";
    statusBg = "var(--accent-soft)";
  }

  // Verification checks for Hermes
  const { hermesEstado, checks, issues } = useMemo(() => {
    const checksList: { label: string }[] = [];
    const issuesList: {
      sev: "crit" | "warn";
      label: string;
      cita?: string;
      ref?: string;
    }[] = [];

    // Planilla
    if (planillaFiles.length > 0) {
      checksList.push({ label: "Planilla de horas firmada y adjunta." });
    } else {
      issuesList.push({ sev: "crit" as const, label: "Falta planilla de horas del alumno." });
    }

    // Informe
    if (informeFiles.length > 0) {
      checksList.push({ label: "Informe final cargado y legible." });
      if (sol.sugerencias_mejoras && sol.sugerencias_mejoras.length < 50) {
        issuesList.push({
          sev: "warn" as const,
          label: "Sugerencias de mejora del alumno demasiado breves.",
          cita: `"${sol.sugerencias_mejoras}"`,
          ref: "Conviene indagar opinión del alumno sobre la institución.",
        });
      }
    } else {
      issuesList.push({ sev: "crit" as const, label: "Falta informe final de la práctica." });
    }

    // Asistencia
    if (asistenciaFiles.length > 0) {
      checksList.push({ label: "Constancia de asistencias y firma del tutor confirmada." });
    } else {
      issuesList.push({
        sev: "crit" as const,
        label: "Falta planilla de asistencia institucional.",
      });
    }

    // Hours match
    if (practice) {
      const horasRealizadas = practice.horas_realizadas || 40;
      const horasLanz = practice.lanzamientos_pps?.horas_acreditadas || 40;
      if (horasRealizadas === horasLanz) {
        checksList.push({ label: `Horas totales coinciden con el lanzamiento (${horasLanz}h).` });
      } else {
        issuesList.push({
          sev: "warn" as const,
          label: `Las horas de la práctica (${horasRealizadas}h) no coinciden con el lanzamiento (${horasLanz}h).`,
          ref: `Práctica: ${practice.lanzamientos_pps?.nombre_pps || "Convocatoria"}.`,
        });
      }
    }

    const state: "critico" | "atencion" | "aprobado" = issuesList.some((i) => i.sev === "crit")
      ? "critico"
      : issuesList.some((i) => i.sev === "warn")
        ? "atencion"
        : "aprobado";

    return { hermesEstado: state, checks: checksList, issues: issuesList };
  }, [planillaFiles, informeFiles, asistenciaFiles, sol.sugerencias_mejoras, practice]);

  const hMeta = {
    aprobado: {
      icon: "verified",
      c: "var(--ok)",
      s: "var(--ok-soft)",
      lbl: "Verificado por Hermes",
    },
    atencion: {
      icon: "warning",
      c: "var(--warn)",
      s: "var(--warn-soft)",
      lbl: "Hermes detectó observaciones",
    },
    critico: {
      icon: "error",
      c: "var(--crit)",
      s: "var(--crit-soft)",
      lbl: "Faltan documentos indispensables",
    },
  }[hermesEstado];

  const handleCopyExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dateStr = new Date(sol.createdTime).toLocaleDateString("es-AR");
    const legajo = sol.studentLegajo;
    const name = sol.studentName;
    const text = `${dateStr}\t${legajo}\t${name}`;
    navigator.clipboard.writeText(text);
    onToast("Copiado fila Excel (Fecha, Legajo, Nombre).");
  };

  const handlePreview = async (files: Attachment[], index: number = 0) => {
    const filesWithSigned = await Promise.all(
      files.map(async (f) => {
        const path = getStoragePath(f.url);
        if (!path) return f;
        try {
          const { data, error } = await supabase.storage
            .from("documentos_finalizacion")
            .createSignedUrl(path, 3600);
          if (!error && data) return { ...f, signedUrl: data.signedUrl };
          return f;
        } catch {
          return f;
        }
      })
    );
    setPreviewFiles(filesWithSigned);
    setPreviewIndex(index);
    setIsPreviewOpen(true);
  };

  return (
    <div
      data-solicitud-id={sol.id}
      style={{
        border: `1px solid ${expanded ? "var(--ink)" : "var(--rule-2)"}`,
        borderRadius: 14,
        background: "var(--paper)",
        overflow: "hidden",
        position: "relative",
        transition:
          "border-color .12s ease, background-color .12s ease, box-shadow .12s ease, transform .12s ease, color .12s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: statusColor,
        }}
      ></div>

      {/* Collapsed view */}
      <div
        onClick={onToggle}
        style={{
          padding: "15px 18px 15px 20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              flexShrink: 0,
              background: expanded ? "var(--ink)" : "var(--paper-2)",
              color: expanded ? "var(--paper)" : "var(--ink-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {sol.studentName.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* verification state dot */}
              <span
                title={hMeta.lbl}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: hMeta.s,
                  color: hMeta.c,
                  flexShrink: 0,
                }}
              >
                <span className="material-icons" style={{ fontSize: 13 }}>
                  {hMeta.icon}
                </span>
              </span>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                {sol.studentName}
              </h4>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--paper-2)",
                  color: "var(--ink-3)",
                }}
              >
                {sol.studentLegajo}
              </span>
              {practice && (
                <span className="meta" style={{ fontSize: 11.5 }}>
                  {practice.nombre_institucion || "Institución"}
                </span>
              )}
              <span className="meta" style={{ fontSize: 11 }}>
                · {formatDate(sol.createdTime)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--ink-3)",
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              attach_file
            </span>
            {docCount}
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              background: statusBg,
              color: statusColor,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
            }}
          >
            {visualStatus}
          </span>
          <span
            className="material-icons"
            style={{
              fontSize: 20,
              color: "var(--ink-4)",
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform .2s ease",
            }}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--rule-2)",
            padding: 18,
            background: "var(--paper-2)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Hermes Verification Panel */}
          <div
            style={{
              border: `1px solid ${hMeta.c}33`,
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--paper)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: hMeta.s,
              }}
            >
              <span className="material-icons" style={{ fontSize: 18, color: hMeta.c }}>
                {hMeta.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  {hMeta.lbl}
                </div>
              </div>
              <span className="label" style={{ color: hMeta.c, fontSize: 9 }}>
                Hermes
              </span>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {checks.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span
                    className="material-icons"
                    style={{ fontSize: 16, color: "var(--ok)", flexShrink: 0, marginTop: 1 }}
                  >
                    check_circle
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
                    {c.label}
                  </span>
                </div>
              ))}
              {issues.map((iss, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 10,
                    background: iss.sev === "crit" ? "var(--crit-soft)" : "var(--warn-soft)",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span
                      className="material-icons"
                      style={{
                        fontSize: 16,
                        color: iss.sev === "crit" ? "var(--crit)" : "var(--warn)",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {iss.sev === "crit" ? "cancel" : "warning"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                        {iss.label}
                      </div>
                      {iss.ref && (
                        <div
                          style={{
                            marginTop: 4,
                            display: "flex",
                            gap: 7,
                            padding: "6px 8px",
                            borderRadius: 6,
                            background: "var(--paper)",
                            border: "1px solid var(--rule-2)",
                            fontSize: 11.5,
                            color: "var(--ink-3)",
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: 12, marginTop: 2 }}>
                            link
                          </span>
                          <span>{iss.ref}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Files grid */}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Documentos del alumno
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              {[
                { l: "Planilla de Horas", files: planillaFiles, i: "table_view" },
                { l: "Informe Final", files: informeFiles, i: "description" },
                { l: "Asistencias firmadas", files: asistenciaFiles, i: "fact_check" },
              ].map((sec, idx) => (
                <div key={idx}>
                  <div className="label" style={{ fontSize: 9.5, marginBottom: 6 }}>
                    {sec.l}
                  </div>
                  {sec.files.length > 0 ? (
                    sec.files.map((f, fi) => (
                      <button
                        key={fi}
                        onClick={() => handlePreview(allFiles, allFiles.indexOf(f))}
                        className="press"
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--rule-2)",
                          background: "var(--paper)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span
                          className="material-icons"
                          style={{ fontSize: 16, color: "var(--ink-4)" }}
                        >
                          {sec.i}
                        </span>
                        <span
                          style={{
                            fontSize: 11.5,
                            color: "var(--ink-2)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {f.filename}
                        </span>
                      </button>
                    ))
                  ) : (
                    <span className="meta" style={{ fontSize: 11, fontStyle: "italic" }}>
                      No cargado
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sugerencias del alumno */}
          {sol.sugerencias_mejoras && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--paper)",
                border: "1px solid var(--rule-2)",
              }}
            >
              <div className="label" style={{ fontSize: 9.5, marginBottom: 4 }}>
                Comentarios / Sugerencias del alumno
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-2)",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                "{sol.sugerencias_mejoras}"
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              paddingTop: 4,
            }}
          >
            <button onClick={handleCopyExcel} className="btn btn-sm press">
              <span className="material-icons" style={{ fontSize: 15 }}>
                content_copy
              </span>
              Copiar fila Excel
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {!isFinalizado && (
                <>
                  <button
                    onClick={() => onUpdateStatus(sol.id, "En Proceso")}
                    disabled={isEnProceso}
                    className="btn btn-sm press"
                    style={{ opacity: isEnProceso ? 0.5 : 1 }}
                  >
                    En Proceso SAC
                  </button>
                  <button
                    onClick={() => onUpdateStatus(sol.id, "Cargado")}
                    className="btn btn-sm press"
                    style={{
                      background: "var(--ok)",
                      color: "var(--paper)",
                      borderColor: "var(--ok)",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 15 }}>
                      check_circle
                    </span>
                    Confirmar SAC
                  </button>
                </>
              )}
              <button
                onClick={() => onDelete(sol)}
                className="btn btn-ghost btn-sm press text-rose-500"
                style={{ color: "var(--crit)" }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  delete
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF / File Preview container */}
      {isPreviewOpen && (
        <FilePreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          files={previewFiles}
          initialIndex={previewIndex}
        />
      )}
    </div>
  );
};

export default EgresoTabView;
