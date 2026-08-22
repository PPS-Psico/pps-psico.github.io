import React, { useEffect, useMemo, useState } from "react";
import { FIELD_ESTUDIANTE_FINALIZACION } from "../../../constants";
import { supabase } from "../../../lib/supabaseClient";
import { runQuery } from "../../../lib/dbQuery";
import {
  describeFinalizationGradeSource,
  indexFinalizationGrades,
  useFinalizationGradeResolution,
} from "../../../hooks/useFinalizationGradeResolution";
import {
  computeTotalHoras,
  resolveFrecuenciaSemanal,
  type DetallePracticas,
} from "../../../utils/acreditacion";
import { Attachment, signStorageAttachment } from "../../../utils/attachmentUtils";
import { formatDate, safeGetId } from "../../../utils/formatters";
import { logger } from "../../../utils/logger";
import { FilePreview } from "../preview";
import { filterEgresoFinalizaciones, isHistoryFinalizacion, normalizeAttachments } from "./helpers";
import { CollapsibleHistory, EmptyState, SearchBar } from "./primitives";
import type { FinalizacionWithStudent } from "./types";
import { getHorarioEfectivo } from "../../../utils/scheduleUtils";

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
  const filtered = useMemo(() => {
    const res = filterEgresoFinalizaciones(list, search);
    return res.sort(
      (a, b) => new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime()
    );
  }, [list, search]);

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

// Parsea el snapshot por-PPS (registros nuevos). Devuelve null para registros viejos.
const parseDetalle = (raw: unknown): DetallePracticas | null => {
  if (!raw) return null;
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const obj = data as { items?: unknown };
  if (!Array.isArray(obj.items) || obj.items.length === 0) return null;
  return data as DetallePracticas;
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
  const [horariosPorPractica, setHorariosPorPractica] = useState<Record<string, string>>({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Attachment[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const detalle = useMemo(() => {
    const raw = (sol as any).detalle_practicas;
    return parseDetalle(raw);
  }, [sol]);
  const gradeResolutionQuery = useFinalizationGradeResolution(sol.id, Boolean(detalle));
  const gradesByPractice = useMemo(
    () => indexFinalizationGrades(gradeResolutionQuery.data),
    [gradeResolutionQuery.data]
  );

  const totalHoras = useMemo(() => {
    if (!detalle) return null;
    return detalle.totalHoras ?? computeTotalHoras(detalle.items.map((i) => i.horas));
  }, [detalle]);

  const notaPromedio = useMemo(() => {
    if (!detalle) return null;
    return gradeResolutionQuery.data?.[0]?.nota_promedio ?? null;
  }, [detalle, gradeResolutionQuery.data]);

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

  const allFiles = useMemo(() => {
    if (detalle) {
      const files: Attachment[] = [];
      detalle.items.forEach((item) => {
        if (item.informe) {
          files.push({
            url: item.informe.url,
            filename: item.informe.filename,
            type: "informe",
          });
        }
        if (item.asistencia) {
          files.push({
            url: item.asistencia.url,
            filename: item.asistencia.filename,
            type: "asistencia",
          });
        }
      });
      return files;
    }
    return [...planillaFiles, ...informeFiles, ...asistenciaFiles];
  }, [detalle, planillaFiles, informeFiles, asistenciaFiles]);

  const docCount = allFiles.length;

  useEffect(() => {
    let active = true;
    const fetchPractice = async () => {
      const sId = safeGetId(sol[FIELD_ESTUDIANTE_FINALIZACION]);
      if (!sId || !expanded) return;
      setLoadingPrac(true);
      try {
        // Antes el error se descartaba con `if (!error && data ...)`: la
        // práctica simplemente no aparecía y no quedaba rastro de por qué.
        const data = await runQuery(
          supabase
            .from("practicas")
            .select("*, lanzamientos_pps(nombre_pps, horas_acreditadas, orientacion)")
            .eq("estudiante_id", sId)
            .maybeSingle(),
          { table: "practicas", operation: "practicaDelEgreso" }
        );

        if (data && active) {
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

  // Horario declarado de cada PPS del trámite. No vive en el snapshot de la solicitud
  // (está en la inscripción a la convocatoria), pero es el dato que manda para la
  // frecuencia semanal que pide el SAC: el cálculo horas/semanas es solo el respaldo.
  useEffect(() => {
    let active = true;
    const fetchHorarios = async () => {
      const sId = safeGetId(sol[FIELD_ESTUDIANTE_FINALIZACION]);
      const practicaIds = detalle?.items.map((i) => i.practicaId).filter(Boolean) ?? [];
      if (!sId || !expanded || practicaIds.length === 0) return;

      try {
        const practicas = await runQuery(
          supabase
            .from("practicas")
            .select(
              "id, lanzamiento_id, lanzamiento:lanzamientos_pps!fk_practica_lanzamiento(horario_seleccionado)"
            )
            .in("id", practicaIds),
          { table: "practicas", operation: "horariosDeLasPracticas" }
        );
        if (!practicas || !active) return;

        const lanzamientoIds = practicas
          .map((p) => p.lanzamiento_id)
          .filter((id): id is string => !!id);

        // Horario de la inscripción del alumno: más específico que el del lanzamiento.
        const horarioPorLanzamiento = new Map<string, string>();
        if (lanzamientoIds.length > 0) {
          // El error de esta query ni siquiera se destructuraba antes.
          const inscripciones = await runQuery(
            supabase
              .from("convocatorias")
              .select("lanzamiento_id, horario_asignado, horario_seleccionado")
              .eq("estudiante_id", sId)
              .in("lanzamiento_id", lanzamientoIds),
            { table: "convocatorias", operation: "horarioDeInscripcion" }
          );
          inscripciones?.forEach((ins) => {
            const horario = getHorarioEfectivo(ins);
            if (ins.lanzamiento_id && horario) {
              horarioPorLanzamiento.set(ins.lanzamiento_id, horario);
            }
          });
        }

        const map: Record<string, string> = {};
        practicas.forEach((p) => {
          const deInscripcion = p.lanzamiento_id
            ? horarioPorLanzamiento.get(p.lanzamiento_id)
            : undefined;
          const deLanzamiento = p.lanzamiento?.horario_seleccionado;
          const horario = deInscripcion || deLanzamiento;
          if (horario) map[p.id] = horario;
        });

        if (active) setHorariosPorPractica(map);
      } catch (e) {
        logger.error(e);
      }
    };
    fetchHorarios();
    return () => {
      active = false;
    };
  }, [sol, expanded, detalle]);

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

  const handleCopyExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dateStr = new Date(sol.createdTime).toLocaleDateString("es-AR");
    const legajo = sol.studentLegajo;
    const name = sol.studentName;
    const horasCol = totalHoras != null ? String(totalHoras) : "";
    const notaCol = notaPromedio != null ? String(notaPromedio) : "";
    const text = `${dateStr}\t${legajo}\t${name}\t${horasCol}\t${notaCol}`;
    navigator.clipboard.writeText(text);
    onToast("Copiado fila Excel (Fecha, Legajo, Nombre, Horas, Promedio).");
  };

  const handlePreview = async (files: Attachment[], index: number = 0) => {
    const filesWithSigned = await Promise.all(files.map(signStorageAttachment));
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
          {detalle ? (
            <>
              {/* Summary Row */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "var(--paper)",
                  border: "1px solid var(--rule-2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-icons" style={{ fontSize: 16, color: "var(--accent)" }}>
                    playlist_add_check
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                    {detalle.items.length}{" "}
                    {detalle.items.length === 1 ? "PPS realizada" : "PPS realizadas"}
                  </span>
                </div>
                <span style={{ color: "var(--rule-3)", fontSize: 12 }}>|</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-icons" style={{ fontSize: 16, color: "var(--accent)" }}>
                    schedule
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                    {totalHoras ?? 0} hs totales
                  </span>
                </div>
                <span style={{ color: "var(--rule-3)", fontSize: 12 }}>|</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-icons" style={{ fontSize: 16, color: "var(--accent)" }}>
                    grade
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                    Nota promedio: {notaPromedio != null ? notaPromedio : "—"}
                  </span>
                </div>
              </div>

              {gradeResolutionQuery.isError && (
                <p
                  style={{
                    margin: 0,
                    padding: "9px 11px",
                    border: "1px solid var(--warn)",
                    borderRadius: 8,
                    color: "var(--warn)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  No se pudieron verificar las notas académicas. No uses el promedio para SAC hasta
                  reintentar la consulta.
                </p>
              )}

              {/* Detail List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {detalle.items.map((item, i) => {
                  const informeIdx = allFiles.findIndex(
                    (f) => f.url === item.informe?.url && f.type === "informe"
                  );
                  const asistenciaIdx = allFiles.findIndex(
                    (f) => f.url === item.asistencia?.url && f.type === "asistencia"
                  );
                  // Datos que pide el SAC al cargar la PPS y que hay que tener a mano acá.
                  const horarioDeclarado = horariosPorPractica[item.practicaId];
                  const frecuencia = resolveFrecuenciaSemanal({
                    horas: item.horas,
                    fechaInicio: item.fechaInicio,
                    fechaFinalizacion: item.fechaFinalizacion,
                    horarioDeclarado,
                  });

                  return (
                    <div
                      key={item.practicaId || i}
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "var(--paper)",
                        border: "1px solid var(--rule-2)",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: "var(--ink)",
                          }}
                        >
                          {item.nombre}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--ink-3)" }}>
                          {item.especialidad || "Sin orientación"} · {item.horas || 0} hs
                          {item.esOnline && " · Online"}
                        </p>
                        {describeFinalizationGradeSource(gradesByPractice.get(item.practicaId)) && (
                          <p
                            style={{
                              margin: "3px 0 0",
                              fontSize: 10.5,
                              color: "var(--ok)",
                              fontWeight: 650,
                            }}
                          >
                            {describeFinalizationGradeSource(gradesByPractice.get(item.practicaId))}
                          </p>
                        )}
                        <p
                          style={{
                            margin: "3px 0 0",
                            fontSize: 10.5,
                            color: "var(--ink-4)",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            className="material-icons"
                            style={{ fontSize: 12, color: "var(--ink-4)" }}
                          >
                            date_range
                          </span>
                          {formatDate(item.fechaInicio)} — {formatDate(item.fechaFinalizacion)}
                          <span style={{ color: "var(--rule-3)" }}>·</span>
                          <span
                            title={
                              frecuencia.advertencia ??
                              (frecuencia.origen === "horario"
                                ? `Horario declarado: ${horarioDeclarado}`
                                : "Estimado repartiendo las horas acreditadas entre las semanas del período")
                            }
                            style={{
                              color: frecuencia.advertencia ? "var(--warn)" : undefined,
                              fontWeight: frecuencia.advertencia ? 600 : undefined,
                            }}
                          >
                            {frecuencia.valor != null
                              ? `${frecuencia.valor} hs/sem${frecuencia.origen === "calculo" ? " (est.)" : ""}`
                              : "frecuencia s/d"}
                            {frecuencia.advertencia && " ⚠"}
                          </span>
                          {horarioDeclarado && (
                            <>
                              <span style={{ color: "var(--rule-3)" }}>·</span>
                              <span>{horarioDeclarado}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "3px 7px",
                            borderRadius: 6,
                            background: "var(--paper-2)",
                            color: "var(--ink-2)",
                            border: "1px solid var(--rule-2)",
                          }}
                        >
                          NOTA: {gradesByPractice.get(item.practicaId)?.nota || "—"}
                        </span>

                        {item.informe ? (
                          <button
                            onClick={() => handlePreview(allFiles, informeIdx)}
                            className="press"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--rule-2)",
                              background: "var(--paper)",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--ink-2)",
                            }}
                          >
                            <span
                              className="material-icons"
                              style={{ fontSize: 14, color: "var(--ink-4)" }}
                            >
                              description
                            </span>
                            Informe
                          </button>
                        ) : (
                          <span
                            style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}
                          >
                            Sin informe
                          </span>
                        )}

                        {item.esOnline ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontStyle: "italic",
                              color: "var(--ink-4)",
                              padding: "6px 8px",
                            }}
                          >
                            Sin asistencia (Online)
                          </span>
                        ) : item.asistencia ? (
                          <button
                            onClick={() => handlePreview(allFiles, asistenciaIdx)}
                            className="press"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--rule-2)",
                              background: "var(--paper)",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--ink-2)",
                            }}
                          >
                            <span
                              className="material-icons"
                              style={{ fontSize: 14, color: "var(--ink-4)" }}
                            >
                              assignment_turned_in
                            </span>
                            Asistencia
                          </button>
                        ) : (
                          <span
                            style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}
                          >
                            Sin asistencia
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Files grid (legacy fallback) */}
              <div>
                <div className="label" style={{ marginBottom: 8 }}>
                  Documentos del alumno (Legacy)
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
            </>
          )}

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
