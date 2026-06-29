import React, { useMemo, useState } from "react";
import { FIELD_ESTADO_PPS } from "../../../constants";
import { CollapsibleHistory, DataItem, EmptyState, FilterTabs, SearchBar } from "./primitives";
import type { SolicitudPPSWithStudent } from "./types";
import { filterIngresoSolicitudes, isHistorySolicitud } from "./helpers";
import HermesSolicitudesEditorial from "./HermesSolicitudesEditorial";
import PanelHermesIngreso from "./PanelHermesIngreso";
interface IngresoTabViewProps {
  search: string;
  setSearch: (s: string) => void;
  filter: string;
  setFilter: (f: string) => void;
  list: SolicitudPPSWithStudent[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (params: { recordId: string; fields: Record<string, unknown> }) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
  onContactMail: (sol: SolicitudPPSWithStudent) => void;
  onOpenBorrador: (sol: SolicitudPPSWithStudent) => void;
  gmailHilos: Record<string, unknown>[];
  whatsappMensajes: Record<string, unknown>[];
  whatsappContactos: Record<string, unknown>[];
  onContactWhatsApp: (sol: SolicitudPPSWithStudent) => void;
}

const IngresoTabView: React.FC<IngresoTabViewProps> = ({
  search,
  setSearch,
  filter,
  setFilter,
  list,
  expandedId,
  onToggle,
  onDelete,
  onUpdate,
  onToast,
  onContactMail,
  onOpenBorrador,
  gmailHilos,
  whatsappMensajes,
  whatsappContactos,
  onContactWhatsApp,
}) => {
  const filtered = useMemo(
    () => filterIngresoSolicitudes(list, search, filter),
    [list, search, filter]
  );

  const pendingList = filtered.filter((s) => !isHistorySolicitud(s));
  const historyList = filtered.filter(isHistorySolicitud);

  const opts = [
    { value: "all", label: "Todas", count: list.length },
    {
      value: "priorizo",
      label: "Falta Convenio",
      icon: "auto_awesome",
      tone: "ai" as const,
      count: list.filter((s) => !s.convenio_uflo || s.convenio_uflo.toLowerCase() !== "sí").length,
    },
    {
      value: "sin_mov",
      label: "Sin movimiento +4d",
      icon: "timer",
      tone: "warn" as const,
      count: list.filter(
        (s) =>
          s._daysSinceUpdate > 4 &&
          !["Realizada", "No se pudo concretar", "Archivado"].includes(s.estado_seguimiento || "")
      ).length,
    },
    { value: "Pendiente", label: "Pendiente" },
    { value: "En conversaciones", label: "En conversaciones" },
    { value: "Realizando convenio", label: "Realizando convenio" },
    { value: "Realizada", label: "Realizada" },
  ];

  const goGestion = () => {
    try {
      localStorage.setItem("gestion-view-mode", "instituciones");
    } catch {}
    window.location.href = "#/admin/gestion?view=instituciones";
  };

  return (
    <div>
      {/* Editorial brief panel */}
      <HermesSolicitudesEditorial
        list={list}
        gmailHilos={gmailHilos}
        whatsappMensajes={whatsappMensajes}
        whatsappContactos={whatsappContactos}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por alumno, legajo o institución…"
        />
        <span className="meta">{filtered.length} solicitudes</span>
      </div>
      <div style={{ marginBottom: 20 }}>
        <FilterTabs options={opts} value={filter} onChange={setFilter} />
      </div>

      {pendingList.length === 0 && historyList.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Sin solicitudes"
          msg="No se encontraron registros con los filtros actuales."
        />
      ) : (
        <>
          {pendingList.length > 0 && (
            <>
              {/* Group header */}
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
                  style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }}
                ></span>
                <span className="label">Pendientes de gestión ({pendingList.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingList.map((sol) => (
                  <IngresoCardItem
                    key={sol.id}
                    sol={sol}
                    expanded={expandedId === sol.id}
                    onToggle={() => onToggle(sol.id)}
                    onDelete={onDelete}
                    onUpdate={onUpdate}
                    onToast={onToast}
                    onVerGestion={goGestion}
                    onContactMail={onContactMail}
                    onOpenBorrador={onOpenBorrador}
                    gmailHilos={gmailHilos}
                    whatsappMensajes={whatsappMensajes}
                    onContactWhatsApp={onContactWhatsApp}
                  />
                ))}
              </div>
            </>
          )}

          {historyList.length > 0 && (
            <CollapsibleHistory count={historyList.length}>
              {historyList.map((sol) => (
                <IngresoCardItem
                  key={sol.id}
                  sol={sol}
                  expanded={expandedId === sol.id}
                  onToggle={() => onToggle(sol.id)}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  onToast={onToast}
                  onVerGestion={goGestion}
                  onContactMail={onContactMail}
                  onOpenBorrador={onOpenBorrador}
                  gmailHilos={gmailHilos}
                  whatsappMensajes={whatsappMensajes}
                  onContactWhatsApp={onContactWhatsApp}
                />
              ))}
            </CollapsibleHistory>
          )}
        </>
      )}
    </div>
  );
};

// ─── INGRESO CARD ITEM ──────────────────────────────────────────────
interface IngresoCardItemProps {
  sol: SolicitudPPSWithStudent;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onUpdate: (params: { recordId: string; fields: Record<string, unknown> }) => void;
  onToast: (msg: string, type?: "success" | "error" | "warning") => void;
  onVerGestion: () => void;
  onContactMail: (sol: SolicitudPPSWithStudent) => void;
  onOpenBorrador: (sol: SolicitudPPSWithStudent) => void;
  gmailHilos: Record<string, unknown>[];
  whatsappMensajes: Record<string, unknown>[];
  onContactWhatsApp: (sol: SolicitudPPSWithStudent) => void;
}

const IngresoCardItem: React.FC<IngresoCardItemProps> = ({
  sol,
  expanded,
  onToggle,
  onDelete,
  onUpdate,
  onToast,
  onVerGestion,
  onContactMail,
  onOpenBorrador,
  gmailHilos,
  whatsappMensajes,
  onContactWhatsApp,
}) => {
  const [estado, setEstado] = useState(sol.estado_seguimiento || "Pendiente");
  const [notas, setNotas] = useState(sol.notas || "");

  const hasConvenio =
    sol.convenio_uflo?.toLowerCase() === "sí" || sol.convenio_uflo?.toLowerCase() === "si";
  const hasTutor =
    sol.tutor_disponible?.toLowerCase() === "sí" || sol.tutor_disponible?.toLowerCase() === "si";
  const isNoCatalogada =
    sol.convenio_uflo?.toLowerCase().includes("cat") ||
    sol.convenio_uflo?.toLowerCase() === "no catalogada";

  const isStagnant =
    sol._daysSinceUpdate > 4 &&
    !["Realizada", "No se pudo concretar", "Archivado"].includes(sol.estado_seguimiento || "");

  const dirty = estado !== (sol.estado_seguimiento || "Pendiente") || notas !== (sol.notas || "");

  // Tone color mapper
  const getTone = (est: string) => {
    const e = (est || "").toLowerCase();
    if (e === "pendiente") return { c: "var(--warn)", s: "var(--warn-soft)" };
    if (e === "en conversaciones") return { c: "var(--accent)", s: "var(--accent-soft)" };
    if (e === "realizando convenio") return { c: "var(--ai)", s: "var(--ai-soft)" };
    if (e === "realizada") return { c: "var(--ok)", s: "var(--ok-soft)" };
    return { c: "var(--ink-3)", s: "var(--paper-2)" };
  };
  const tone = getTone(estado);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({
      recordId: sol.id,
      fields: {
        [FIELD_ESTADO_PPS]: estado,
        notas,
      },
    });
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onContactWhatsApp(sol);
  };

  return (
    <div
      data-solicitud-id={sol.id}
      style={{
        border: `1px solid ${expanded ? "var(--ink)" : isStagnant ? "#B4501E44" : "var(--rule-2)"}`,
        borderRadius: 14,
        background: isStagnant && !expanded ? "var(--warn-soft)" : "var(--paper)",
        overflow: "hidden",
        position: "relative",
        transition: "all .12s ease",
      }}
    >
      {/* accent rail */}
      <div
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tone.c }}
      ></div>

      {/* Collapsed header */}
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
            {sol._studentName.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--ink)",
                  letterSpacing: "-0.01em",
                }}
              >
                {sol.nombre_institucion || "Institución propuesta"}
              </h4>
              {/* Convenio badge */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px 2px 6px",
                  borderRadius: 999,
                  background: hasConvenio
                    ? "var(--ok-soft)"
                    : isNoCatalogada
                      ? "var(--crit-soft)"
                      : "var(--warn-soft)",
                  color: hasConvenio ? "var(--ok)" : isNoCatalogada ? "var(--crit)" : "var(--warn)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                <span className="material-icons" style={{ fontSize: 12 }}>
                  {hasConvenio ? "verified" : isNoCatalogada ? "help" : "pending"}
                </span>
                {hasConvenio ? "Con convenio" : isNoCatalogada ? "No catalogada" : "Sin convenio"}
              </span>

              {isStagnant && (
                <span
                  className="dot-live"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--warn-soft)",
                    color: "var(--warn)",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 11 }}>
                    timer
                  </span>
                  {sol._daysSinceUpdate} d sin novedad
                </span>
              )}
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
                className="meta"
                style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}
              >
                {sol._studentName}
              </span>
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
                {sol._studentLegajo}
              </span>
              {!hasConvenio && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "2px 8px 2px 6px",
                    borderRadius: 999,
                    background: "var(--ai-soft)",
                    color: "var(--ai)",
                    fontSize: 10.5,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 12 }}>
                    auto_awesome
                  </span>
                  Prioridad Hermes
                </span>
              )}
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
              background: tone.s,
              color: tone.c,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
            }}
          >
            {estado}
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
          {isNoCatalogada && (
            <div
              style={{
                border: "1px solid var(--crit)",
                borderRadius: 12,
                overflow: "hidden",
                background: "var(--crit-soft)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 16 }}>
                <span
                  className="material-icons"
                  style={{ fontSize: 18, color: "var(--crit)", flexShrink: 0, marginTop: 1 }}
                >
                  error
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                    Esta institución no está en el catálogo
                  </div>
                  <div className="meta" style={{ fontSize: 12, marginTop: 3 }}>
                    El estudiante ingresó la institución de forma manual. Podés agregarla desde el
                    administrador de catálogos.
                  </div>
                </div>
                <button
                  onClick={onVerGestion}
                  className="btn btn-mail btn-sm press"
                  style={{ flexShrink: 0 }}
                >
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    add_business
                  </span>
                  Ir al catálogo
                </button>
              </div>
            </div>
          )}

          {/* Grids */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--rule-2)",
                }}
              >
                <span className="material-icons" style={{ fontSize: 15, color: "var(--ink-4)" }}>
                  business
                </span>
                <span className="label">Datos institucionales</span>
              </div>
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}
              >
                <DataItem label="Localidad" value={sol.localidad} icon="location_on" />
                <DataItem label="Referente" value={sol.referente_institucion} icon="person" />
                <DataItem label="Email" value={sol.email_institucion} icon="mail" />
                <DataItem label="Teléfono" value={sol.telefono_institucion} icon="phone" />
                <DataItem label="Dirección" value={sol.direccion_completa} icon="map" full />
                <DataItem
                  label="Tutor de Psicología"
                  value={sol.contacto_tutor}
                  icon="psychology"
                  full
                />
              </div>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--rule-2)",
                }}
              >
                <span className="material-icons" style={{ fontSize: 15, color: "var(--ink-4)" }}>
                  description
                </span>
                <span className="label">Detalles de la práctica</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 10 }}>
                <DataItem label="Modalidad" value={sol.tipo_practica} icon="group_work" />
                <DataItem
                  label="Descripción de actividades"
                  value={sol.descripcion_institucion}
                  icon="article"
                  full
                />
              </div>
            </div>
          </div>

          {/* Hermes AI criteria panel */}
          <PanelHermesIngreso
            sol={sol}
            onVerGestion={onVerGestion}
            gmailHilos={gmailHilos}
            whatsappMensajes={whatsappMensajes}
          />

          {/* Internal management */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                paddingBottom: 8,
                borderBottom: "1px solid var(--rule-2)",
              }}
            >
              <span className="material-icons" style={{ fontSize: 15, color: "var(--ink-4)" }}>
                tune
              </span>
              <span className="label">Gestión interna</span>
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, marginTop: 10 }}
            >
              <div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                >
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="field"
                  style={{ fontSize: 13, cursor: "pointer" }}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En conversaciones">En conversaciones</option>
                  <option value="Realizando convenio">Realizando convenio</option>
                  <option value="Realizada">Realizada</option>
                  <option value="No se pudo concretar">No se pudo concretar</option>
                  <option value="Archivado">Archivado</option>
                </select>
              </div>
              <div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 6, fontSize: 9.5 }}
                >
                  Notas internas{" "}
                  <span
                    style={{
                      textTransform: "none",
                      letterSpacing: 0,
                      color: "var(--ink-4)",
                      fontWeight: 400,
                    }}
                  >
                    (visible al alumno si falla)
                  </span>
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  className="field"
                  style={{ fontSize: 13, minHeight: 0 }}
                  placeholder="Bitácora de gestión interna…"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Card footer actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              paddingTop: 4,
            }}
          >
            <button onClick={() => onOpenBorrador(sol)} className="btn btn-ai btn-sm press">
              <span className="material-icons" style={{ fontSize: 15 }}>
                auto_awesome
              </span>
              Borrador con Hermes
            </button>
            {sol.email_institucion && (
              <button onClick={() => onContactMail(sol)} className="btn btn-mail btn-sm press">
                <span className="material-icons" style={{ fontSize: 15 }}>
                  send
                </span>
                Enviar email
              </button>
            )}
            {sol.telefono_institucion && (
              <button
                onClick={handleWhatsApp}
                className="btn btn-sm press"
                style={{ background: "#2F8F4314", color: "#2f8f43", borderColor: "transparent" }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  chat
                </span>
                WhatsApp
              </button>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={onToggle} className="btn btn-ghost btn-sm press">
                Cerrar
              </button>
              <button
                onClick={() => onDelete(sol.id)}
                className="btn btn-ghost btn-sm press text-rose-500"
                style={{ color: "var(--crit)" }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  delete
                </span>
              </button>
              <button
                disabled={!dirty}
                onClick={handleSave}
                className="btn btn-primary btn-sm press"
                style={{ opacity: dirty ? 1 : 0.5 }}
              >
                <span className="material-icons" style={{ fontSize: 15 }}>
                  save
                </span>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IngresoTabView;
