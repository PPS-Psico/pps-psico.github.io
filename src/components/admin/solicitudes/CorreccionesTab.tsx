import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  approveSolicitudModificacion,
  approveSolicitudNuevaPPS,
  fetchAllSolicitudesModificacion,
  fetchAllSolicitudesNuevaPPS,
} from "../../../services";
import Loader from "../../Loader";
import { DataItem, EmptyState, FilterTabs } from "./primitives";
import { normalizeAttachments, buildCorreccionesList } from "./helpers";
import { getErrorMessage } from "../../../utils/getErrorMessage";

/** Solicitud de corrección (modificación o nueva PPS) normalizada para la UI. */
interface CorreccionItem {
  id: string;
  tipo_solicitud: "modificacion" | "nueva";
  estado: string;
  created_at: string;
  notas_admin?: string | null;
  comentario_rechazo?: string | null;
  tipo_modificacion?: string;
  horas_nuevas?: number | null;
  horas_estimadas?: number | null;
  orientacion?: string | null;
  fecha_inicio?: string | null;
  fecha_finalizacion?: string | null;
  nombre_institucion_manual?: string | null;
  planilla_asistencia_url?: string | null;
  informe_final_url?: string | null;
  estudiante?: { nombre?: string | null; legajo?: string | null } | null;
  practica?: { nombre_institucion?: string | null; horas_realizadas?: number | null } | null;
  institucion?: { nombre?: string | null } | null;
  [key: string]: unknown;
}

// ─── TABS CONTENT: CORRECCIONES ─────────────────────────────────────
interface CorreccionesTabViewProps {
  filter: string;
  setFilter: (f: string) => void;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
  onReject: (sol: CorreccionItem) => void;
  onUpdateCounts: (counts: number) => void;
}

const CorreccionesTabView: React.FC<CorreccionesTabViewProps> = ({
  filter,
  setFilter,
  expandedId,
  onToggle,
  onToast,
  onReject,
  onUpdateCounts,
}) => {
  const [subtab, setSubtab] = useState<"modificaciones" | "nuevas">("modificaciones");

  const queryClient = useQueryClient();

  // Fetch modificaciones
  const { data: solicitudesModificacion = [], isLoading: loadingMod } = useQuery<CorreccionItem[]>({
    queryKey: ["solicitudes_modificacion", filter],
    queryFn: async () =>
      (await fetchAllSolicitudesModificacion(
        filter === "all" ? undefined : filter
      )) as unknown as CorreccionItem[],
  });

  // Fetch nuevas pps
  const { data: solicitudesNuevas = [], isLoading: loadingNuevas } = useQuery<CorreccionItem[]>({
    queryKey: ["solicitudes_nueva_pps", filter],
    queryFn: async () =>
      (await fetchAllSolicitudesNuevaPPS(
        filter === "all" ? undefined : filter
      )) as unknown as CorreccionItem[],
  });

  const allList = useMemo(
    () => buildCorreccionesList(solicitudesModificacion, solicitudesNuevas, subtab),
    [solicitudesModificacion, solicitudesNuevas, subtab]
  );

  // Update count bubble in parent tabs
  useEffect(() => {
    const pendingTotal =
      solicitudesModificacion.filter((s) => s.estado === "pendiente").length +
      solicitudesNuevas.filter((s) => s.estado === "pendiente").length;

    onUpdateCounts(pendingTotal);
  }, [solicitudesModificacion, solicitudesNuevas, onUpdateCounts]);

  const approveModMutation = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      approveSolicitudModificacion(id, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitudes_modificacion"] });
      onToast("Solicitud de modificación aprobada.");
    },
    onError: (e) => onToast(getErrorMessage(e, "Error al aprobar"), "error"),
  });

  const approveNuevaMutation = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      approveSolicitudNuevaPPS(id, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitudes_nueva_pps"] });
      queryClient.invalidateQueries({ queryKey: ["practicas"] });
      onToast("Nueva PPS aprobada. Práctica creada exitosamente.");
    },
    onError: (e) => onToast(getErrorMessage(e, "Error al aprobar"), "error"),
  });

  const opts = [
    { value: "all", label: "Todas", count: allList.length },
    {
      value: "pendiente",
      label: "Pendiente",
      count: allList.filter((s) => s.estado === "pendiente").length,
    },
    {
      value: "aprobada",
      label: "Aprobada",
      count: allList.filter((s) => s.estado === "aprobada").length,
    },
    {
      value: "rechazada",
      label: "Rechazada",
      count: allList.filter((s) => s.estado === "rechazada").length,
    },
  ];

  if (loadingMod || loadingNuevas) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Loader />
      </div>
    );
  }

  return (
    <div>
      {/* inner subtabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "modificaciones" as const, lbl: "Modificaciones", ic: "edit" },
          { id: "nuevas" as const, lbl: "Nuevas PPS", ic: "add_circle" },
        ].map((item) => {
          const on = subtab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setSubtab(item.id);
                setFilter("all");
              }}
              className="press"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 9,
                border: `1px solid ${on ? "var(--ink)" : "var(--rule-2)"}`,
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--paper)" : "var(--ink-2)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span className="material-icons" style={{ fontSize: 15 }}>
                {item.ic}
              </span>
              {item.lbl}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 20 }}>
        <FilterTabs options={opts} value={filter} onChange={setFilter} />
      </div>

      {allList.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Sin solicitudes"
          msg="No hay solicitudes con los filtros aplicados."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {allList.map((sol) => (
            <CorreccionCardItem
              key={sol.id}
              sol={sol}
              expanded={expandedId === sol.id}
              onToggle={() => onToggle(sol.id)}
              onToast={onToast}
              onReject={onReject}
              onApprove={async (id, notas) => {
                if (sol.tipo_solicitud === "modificacion") {
                  approveModMutation.mutate({ id, notas });
                } else {
                  approveNuevaMutation.mutate({ id, notas });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── CORRECCION CARD ITEM ───────────────────────────────────────────
interface CorreccionCardItemProps {
  sol: CorreccionItem;
  expanded: boolean;
  onToggle: () => void;
  onToast: (msg: string) => void;
  onReject: (sol: CorreccionItem) => void;
  onApprove: (id: string, notas?: string) => Promise<void>;
}

const CorreccionCardItem: React.FC<CorreccionCardItemProps> = ({
  sol,
  expanded,
  onToggle,
  onToast: _onToast,
  onReject,
  onApprove,
}) => {
  const isMod = sol.tipo_solicitud === "modificacion";
  const [adminNotes, setAdminNotes] = useState(sol.notas_admin || "");
  const [loading, setLoading] = useState(false);

  const getVisuals = (est: string) => {
    const e = (est || "").toLowerCase();
    if (e === "aprobada") return { label: "Aprobada", c: "var(--ok)", s: "var(--ok-soft)" };
    if (e === "rechazada") return { label: "Rechazada", c: "var(--crit)", s: "var(--crit-soft)" };
    return { label: "Pendiente", c: "var(--warn)", s: "var(--warn-soft)" };
  };

  const est = getVisuals(sol.estado);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(sol.id, adminNotes);
    } finally {
      setLoading(false);
    }
  };

  const getTipoModTitle = () => {
    if (!isMod) return "Nueva PPS";
    const mapping: Record<string, string> = {
      horas: "Horas de la práctica",
      fechas: "Período y cronograma",
      institucion: "Reasignación institucional",
    };
    return `Modificación · ${mapping[sol.tipo_modificacion ?? ""] || "Práctica"}`;
  };

  const docsList = useMemo(
    () => normalizeAttachments(sol.planilla_asistencia_url || sol.informe_final_url),
    [sol.planilla_asistencia_url, sol.informe_final_url]
  );

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
          "border-color .14s ease, background-color .14s ease, box-shadow .14s ease, transform .14s ease, color .14s ease",
      }}
    >
      <div
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: est.c }}
      ></div>

      {/* Header collapsed */}
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
              borderRadius: 10,
              flexShrink: 0,
              background: "var(--paper-2)",
              color: "var(--ink-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-icons" style={{ fontSize: 19 }}>
              {isMod
                ? sol.tipo_modificacion === "horas"
                  ? "schedule"
                  : sol.tipo_modificacion === "fechas"
                    ? "event"
                    : "business"
                : "note_add"}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>
                {sol.estudiante?.nombre || "Estudiante"}
              </h4>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "var(--paper-2)",
                  color: "var(--ink-2)",
                }}
              >
                {getTipoModTitle()}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
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
                {sol.estudiante?.legajo || "—"}
              </span>
              <span className="meta" style={{ fontSize: 11.5 }}>
                {isMod
                  ? sol.practica?.nombre_institucion
                  : sol.institucion?.nombre || sol.nombre_institucion_manual}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              background: est.s,
              color: est.c,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {est.label}
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

      {/* Expanded body */}
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
          {/* Info grid */}
          <div>
            <div className="label" style={{ marginBottom: 10 }}>
              {isMod ? "PPS a modificar" : "PPS propuesta"}
            </div>
            {isMod ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <DataItem label="Institución" value={sol.practica?.nombre_institucion} />
                  <DataItem
                    label="Horas realizadas"
                    value={`${sol.practica?.horas_realizadas || 0} hs`}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "var(--paper)",
                    border: "1px solid var(--rule-2)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      className="label"
                      style={{ fontSize: 9.5, display: "block", marginBottom: 4 }}
                    >
                      Cambio propuesto en horas
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 14,
                          color: "var(--ink-3)",
                          textDecoration: "line-through",
                        }}
                      >
                        {sol.practica?.horas_realizadas || 0} hs
                      </span>
                      <span
                        className="material-icons"
                        style={{ fontSize: 16, color: "var(--ink-4)" }}
                      >
                        arrow_forward
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {sol.horas_nuevas} hs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <DataItem
                  label="Institución propuesta"
                  value={sol.nombre_institucion_manual || sol.institucion?.nombre}
                />
                <DataItem label="Orientación" value={sol.orientacion} />
                <DataItem label="Horas estimadas" value={`${sol.horas_estimadas} hs`} />
                <DataItem
                  label="Período"
                  value={
                    sol.fecha_inicio && sol.fecha_finalizacion
                      ? `${new Date(sol.fecha_inicio).toLocaleDateString("es-AR")} al ${new Date(sol.fecha_finalizacion).toLocaleDateString("es-AR")}`
                      : "—"
                  }
                />
              </div>
            )}
          </div>

          {/* Attached docs */}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Documentos de respaldo adjuntos
            </div>
            {docsList.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {docsList.map((d, i) => (
                  <a
                    key={i}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "8px 11px",
                      borderRadius: 8,
                      border: "1px solid var(--rule-2)",
                      background: "var(--paper)",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      className="material-icons"
                      style={{ fontSize: 15, color: "var(--ink-4)" }}
                    >
                      description
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{d.filename}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--crit-soft)",
                  color: "var(--crit)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  error
                </span>
                El alumno no adjuntó documentación de respaldo en esta corrección.
              </div>
            )}
          </div>

          {/* Rejection comments */}
          {sol.estado === "rechazada" && sol.comentario_rechazo && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--crit-soft)",
                border: "1px solid var(--crit)",
              }}
            >
              <div
                className="label"
                style={{ fontSize: 9.5, color: "var(--crit)", marginBottom: 4 }}
              >
                Motivo de rechazo
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {sol.comentario_rechazo}
              </div>
            </div>
          )}

          {sol.notas_admin && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--paper)",
                border: "1px solid var(--rule-2)",
              }}
            >
              <div className="label" style={{ fontSize: 9.5, marginBottom: 4 }}>
                Notas del administrador
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {sol.notas_admin}
              </div>
            </div>
          )}

          {/* Actions - pending only */}
          {sol.estado === "pendiente" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
              <div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                >
                  Notas del administrador (Privadas)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Observaciones de la corrección..."
                  rows={2}
                  className="field"
                  style={{ fontSize: 13, minHeight: 0 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => onReject(sol)}
                  className="btn btn-sm press"
                  style={{ color: "var(--crit)", borderColor: "#B23A4833" }}
                >
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    close
                  </span>
                  Rechazar
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="btn btn-sm press"
                  style={{
                    background: "var(--ok)",
                    color: "var(--paper)",
                    borderColor: "var(--ok)",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    check_circle
                  </span>
                  {isMod ? "Aprobar cambio" : "Aprobar y crear PPS"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CorreccionesTabView;
