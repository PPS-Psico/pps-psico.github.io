/**
 * lanzador/ConfirmacionView.tsx — Step 4 del pipeline: sala de confirmación de
 * consentimientos previa a activar la PPS. Extraído de stepViews.tsx.
 */
import React, { useState, useMemo, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabaseClient";
import { useModal } from "../../../contexts/ModalContext";
import { FIELD_NOMBRE_PPS_LANZAMIENTOS } from "../../../constants";
import { normalizeStringForComparison, getWhatsAppUrl } from "../../../utils/formatters";
import type { LanzamientoPPS } from "../../../types";
import {
  CanvasHeader,
  Loader,
  Stat,
  StatGrid,
  Banner,
  useLaunchEditor,
  SeleccionadorConvocatorias,
} from "./shared";
import { useLaunchRoster } from "./useLaunchData";
import { launchKeys } from "../../../lib/launchQueryKeys";
const ConfirmacionView: React.FC<{
  launch: LanzamientoPPS;
  showModal: ReturnType<typeof useModal>["showModal"];
  onActivar: () => void;
}> = ({ launch, showModal, onActivar }) => {
  const { openEdit, modal: editModal } = useLaunchEditor(launch);
  const [gestionOpen, setGestionOpen] = useState(false);
  const [firmadosOpen, setFirmadosOpen] = useState(false);

  const instNombre = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;

  // Roster de la confirmación. OJO con dos sutilezas del flujo:
  //  1. La DB guarda "Seleccionado" (mayúscula) → comparamos normalizado.
  //  2. Hay BAJA AUTOMÁTICA: si un seleccionado no firma en 24h, un cron
  //     revierte su estado a "Inscripto" y marca baja_automatica_at. Esos
  //     estudiantes "desaparecían" del conteo de seleccionados, por eso el
  //     coordinador veía 9 en vez de 12. Los recuperamos incluyendo a los que
  //     tienen baja_automatica_at (= fueron seleccionados pero no firmaron).
  // Usa el roster compartido (`useLaunchRoster`) — misma fuente que el resto
  // del Lanzador, así sidebar/canvas/seleccionador nunca divergen.
  const { data: roster = [] } = useLaunchRoster(launch.id);
  const seleccionados = useMemo(
    () =>
      roster.filter(
        (r) =>
          normalizeStringForComparison(r.estado_inscripcion) === "seleccionado" ||
          r.baja_automatica_at != null
      ),
    [roster]
  );

  const { data: compromisos = [] } = useQuery({
    queryKey: launchKeys.compromisos(launch.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("compromisos_pps")
        .select("estado, convocatoria_id, accepted_at")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  // Datos de contacto de los seleccionados (query aparte para evitar
  // ambigüedad de FK). Traemos nombre + teléfono + correo para los botones.
  const selEstudianteIds = seleccionados
    .map((s) => (s as { estudiante_id?: string | null }).estudiante_id)
    .filter(Boolean) as string[];
  const { data: selInfoMap = {} } = useQuery<
    Record<string, { nombre: string | null; telefono: string | null; correo: string | null }>
  >({
    queryKey: ["seleccionadosInfo", selEstudianteIds.join(",")],
    queryFn: async () => {
      if (selEstudianteIds.length === 0) return {};
      const { data } = await supabase
        .from("estudiantes")
        .select("id, nombre, telefono, correo")
        .in("id", selEstudianteIds);
      const map: Record<
        string,
        { nombre: string | null; telefono: string | null; correo: string | null }
      > = {};
      (data || []).forEach(
        (e: {
          id: string;
          nombre: string | null;
          telefono: string | null;
          correo: string | null;
        }) => {
          map[e.id] = { nombre: e.nombre, telefono: e.telefono, correo: e.correo };
        }
      );
      return map;
    },
    enabled: selEstudianteIds.length > 0,
  });

  // Mapa convocatoria_id → compromiso (estado + fecha) para el tracker por alumno
  const compromisoByConv = useMemo(() => {
    const map: Record<string, { estado: string | null; accepted_at: string | null }> = {};
    compromisos.forEach((c) => {
      const cid = (c as { convocatoria_id?: string | null }).convocatoria_id;
      if (cid)
        map[cid] = {
          estado: (c as { estado?: string | null }).estado ?? null,
          accepted_at: (c as { accepted_at?: string | null }).accepted_at ?? null,
        };
    });
    return map;
  }, [compromisos]);

  // Lista por alumno con su sub-estado: firmó / pendiente / baja automática.
  const consentRows = useMemo(() => {
    return seleccionados
      .map((s) => {
        const conv = s as {
          id: string;
          estudiante_id?: string | null;
          horario_asignado?: string | null;
          horario_seleccionado?: string | null;
          estado_inscripcion?: string | null;
          baja_automatica_at?: string | null;
        };
        // Horario: preferimos el asignado; si está vacío, caemos al que el
        // estudiante eligió al inscribirse (horario_seleccionado).
        const horario =
          (conv.horario_asignado && String(conv.horario_asignado).trim()) ||
          (conv.horario_seleccionado && String(conv.horario_seleccionado).trim()) ||
          null;
        const comp = compromisoByConv[conv.id];
        const accepted = comp ? normalizeStringForComparison(comp.estado) === "aceptado" : false;
        // Estado actual manda: si sigue "Seleccionado" está pendiente (en plazo),
        // aunque tenga un baja_automatica_at viejo de un ciclo anterior. Si ya
        // no está seleccionado y no firmó, es una baja efectiva.
        const sigueSeleccionado =
          normalizeStringForComparison(conv.estado_inscripcion) === "seleccionado";
        const info = conv.estudiante_id ? selInfoMap[conv.estudiante_id] : undefined;
        // status: "firmo" | "pendiente" | "baja"
        const status: "firmo" | "pendiente" | "baja" = accepted
          ? "firmo"
          : sigueSeleccionado
            ? "pendiente"
            : "baja";
        return {
          id: conv.id,
          nombre: info?.nombre ?? null,
          telefono: info?.telefono ?? null,
          correo: info?.correo ?? null,
          horario,
          accepted,
          acceptedAt: comp?.accepted_at ?? null,
          bajaAt: conv.baja_automatica_at ?? null,
          status,
        };
      })
      .sort((a, b) => {
        // Orden: pendientes (en ventana) → bajas → firmados
        const rank = { pendiente: 0, baja: 1, firmo: 2 } as const;
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return (a.nombre || "").localeCompare(b.nombre || "");
      });
  }, [seleccionados, compromisoByConv, selInfoMap]);

  // Contadores derivados de la lista real (consistentes entre sí).
  // "total" = todos los que alguna vez fueron seleccionados (incluye bajas).
  const total = consentRows.length;
  const confirmados = consentRows.filter((r) => r.status === "firmo").length;
  const pendientes = total - confirmados; // pendientes en ventana + bajas
  const consentPct = total > 0 ? Math.round((confirmados / total) * 100) : 0;

  const iniciales = (nombre: string | null) =>
    !nombre
      ? "?"
      : nombre
          .split(" ")
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();

  const fmtAccepted = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  // Mensajes de WhatsApp prellenados según el estado del estudiante.
  const reminderMsg = (nombre: string | null) =>
    `Hola ${nombre || ""}! 👋 Te recordamos que tenés pendiente aceptar el *compromiso digital* ` +
    `para la PPS${instNombre ? ` en ${instNombre}` : ""}. Ingresá a tu panel y confirmá: ` +
    `pps.psico.uflo.edu.ar`;
  const bajaMsg = (nombre: string | null) =>
    `Hola ${nombre || ""}! Te escribo de la Coordinación de PPS por la práctica` +
    `${instNombre ? ` en ${instNombre}` : ""}. Vi que no llegaste a confirmar el compromiso digital ` +
    `a tiempo y el sistema te dio de baja. ¿Seguís interesado/a? Avisame y lo resolvemos.`;

  // Separamos por estado: los que faltan firmar (pendientes + bajas) son la
  // prioridad operativa; los que firmaron quedan colapsados aparte.
  const faltanRows = consentRows.filter((r) => r.status !== "firmo");
  const firmadosRows = consentRows.filter((r) => r.status === "firmo");

  // Resumen de horarios a cubrir: agrupa a los que NO firmaron por su franja
  // horaria, para saber qué horarios hay que reponer al seleccionar reemplazos.
  const horariosACubrir = (() => {
    const map = new Map<string, number>();
    faltanRows.forEach((r) => {
      const h = (r.horario || "").trim() || "Sin horario asignado";
      map.set(h, (map.get(h) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([horario, count]) => ({ horario, count }))
      .sort((a, b) => b.count - a.count);
  })();

  // Metadatos visuales por estado.
  const statusMetaFor = (row: (typeof consentRows)[number]) => {
    if (row.status === "firmo")
      return {
        color: "var(--ok)",
        bg: "var(--ok-s)",
        icon: "verified",
        label: `Firmó${row.acceptedAt ? ` · ${fmtAccepted(row.acceptedAt)}` : ""}`,
      };
    if (row.status === "baja")
      return {
        color: "#A12D2D",
        bg: "rgba(161,45,45,.10)",
        icon: "person_off",
        label: `Baja${row.bajaAt ? ` · ${fmtAccepted(row.bajaAt)}` : ""}`,
      };
    return {
      color: "var(--warn)",
      bg: "var(--warn-s)",
      icon: "hourglass_empty",
      label: "Pendiente",
    };
  };

  // Fila reutilizable (misma en ambas listas).
  const renderRow = (row: (typeof consentRows)[number]) => {
    const meta = statusMetaFor(row);
    const waMessage =
      row.status === "pendiente"
        ? reminderMsg(row.nombre)
        : row.status === "baja"
          ? bajaMsg(row.nombre)
          : undefined;
    const waUrl = getWhatsAppUrl(row.telefono, waMessage);
    return (
      <div key={row.id} className="lv4-insc-row" style={{ gap: 12 }}>
        <div
          className="lv4-avatar"
          style={{ background: meta.bg, color: meta.color, borderColor: "transparent" }}
        >
          {iniciales(row.nombre)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
            {row.nombre ?? (
              <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Sin nombre</span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 2,
              fontSize: 11.5,
              color: "var(--ink-3)",
            }}
          >
            {row.horario && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span className="material-icons" style={{ fontSize: 12 }}>
                  schedule
                </span>
                {row.horario}
              </span>
            )}
            {row.telefono && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span className="material-icons" style={{ fontSize: 12 }}>
                  call
                </span>
                {row.telefono}
              </span>
            )}
            {row.correo && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                <span className="material-icons" style={{ fontSize: 12 }}>
                  mail
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 180,
                  }}
                >
                  {row.correo}
                </span>
              </span>
            )}
          </div>
          {row.status === "baja" && (
            <div style={{ fontSize: 11, color: "#A12D2D", marginTop: 4, lineHeight: 1.4 }}>
              Dado de baja automática por no firmar a tiempo. Volvé a seleccionarlo desde «Agregar o
              cambiar seleccionados» si corresponde.
            </div>
          )}
        </div>

        {/* Estado */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            whiteSpace: "nowrap",
          }}
        >
          <span className="material-icons" style={{ fontSize: 13 }}>
            {meta.icon}
          </span>
          {meta.label}
        </span>

        {/* Contacto */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {waUrl ? (
            <a
              className="lv4-icon-btn"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={
                row.status === "firmo"
                  ? "Escribir por WhatsApp"
                  : row.status === "baja"
                    ? "Contactar (dado de baja)"
                    : "Enviar recordatorio por WhatsApp"
              }
              style={{ color: "#25D366", textDecoration: "none" }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                chat
              </span>
            </a>
          ) : (
            <span
              className="lv4-icon-btn"
              title="Sin teléfono cargado"
              style={{ color: "var(--ink-4)", cursor: "not-allowed", opacity: 0.5 }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                chat
              </span>
            </span>
          )}
          {row.correo ? (
            <a
              className="lv4-icon-btn"
              href={`mailto:${row.correo}`}
              title={`Enviar email a ${row.correo}`}
              style={{ color: "var(--ink-3)", textDecoration: "none" }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                mail
              </span>
            </a>
          ) : (
            <span
              className="lv4-icon-btn"
              title="Sin correo cargado"
              style={{ color: "var(--ink-4)", cursor: "not-allowed", opacity: 0.5 }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                mail
              </span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="confirmacion"
        primaryAction={{ label: "Activar PPS", icon: "play_circle", onClick: onActivar }}
        secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
      />
      {editModal}
      <div className="lv4-canvas-body">
        {/* Stats compromisos */}
        <StatGrid style={{ marginBottom: 24 }}>
          <Stat label="Seleccionados" value={total} hint="estudiantes" />
          <Stat label="Consintieron" value={confirmados} hint="compromiso digital" tone="ok" />
          <Stat
            label="Pendientes"
            value={pendientes}
            hint="sin firmar"
            tone={pendientes > 0 ? "warn" : "ok"}
          />
        </StatGrid>

        {/* Progreso de consentimientos */}
        {total > 0 && (
          <div
            style={{
              border: "1px solid var(--rule-2)",
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span className="lv4-eyebrow" style={{ marginBottom: 0 }}>
                Avance de consentimientos
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  fontWeight: 600,
                  color: consentPct === 100 ? "var(--ok)" : "var(--warn)",
                }}
              >
                {confirmados}/{total} · {consentPct}%
              </span>
            </div>
            <div className="lv4-progress-track">
              <div
                className="lv4-progress-fill"
                style={{
                  width: `${consentPct}%`,
                  background: consentPct === 100 ? "var(--ok)" : "var(--warn)",
                }}
              />
            </div>
          </div>
        )}

        {/* Banner estado */}
        {total === 0 ? (
          <Banner
            tone="neutral"
            icon="group_add"
            title="Todavía no hay estudiantes seleccionados"
            style={{ marginBottom: 28 }}
            action={
              <button
                className="lv4-btn lv4-btn-primary"
                style={{ flexShrink: 0 }}
                onClick={() => setGestionOpen(true)}
              >
                <span className="material-icons" style={{ fontSize: 14 }}>
                  person_add
                </span>
                Seleccionar estudiantes
              </button>
            }
          >
            Elegí estudiantes de la lista de inscriptos para empezar la sala de consentimientos.
          </Banner>
        ) : pendientes > 0 ? (
          <Banner
            tone="warn"
            icon="pending_actions"
            title={`${pendientes} de ${total} sin firmar el compromiso`}
            style={{ marginBottom: 28 }}
          >
            Seleccionaste {total} estudiante{total !== 1 ? "s" : ""} y {confirmados} firmaron.
            Revisá abajo quiénes faltan y contactalos directo por WhatsApp o email.
          </Banner>
        ) : (
          <Banner
            tone="ok"
            icon="check_circle"
            title="Todos los compromisos aceptados"
            style={{ marginBottom: 28 }}
          >
            Podés proceder a generar los seguros y actas.
          </Banner>
        )}

        {/* Faltan firmar — prioridad operativa (pendientes + bajas) */}
        {faltanRows.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div className="lv4-eyebrow" style={{ color: "var(--warn)" }}>
                  Acción requerida
                </div>
                <div className="lv4-section-title">Faltan firmar ({faltanRows.length})</div>
              </div>
              <button className="lv4-btn" onClick={() => setGestionOpen((o) => !o)}>
                <span className="material-icons" style={{ fontSize: 14 }}>
                  manage_accounts
                </span>
                Gestionar
              </button>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-3)",
                margin: "0 0 12px",
                maxWidth: 640,
                lineHeight: 1.5,
              }}
            >
              Estudiantes que no aceptaron el compromiso digital. Los marcados como{" "}
              <b style={{ color: "#A12D2D" }}>baja</b> ya fueron dados de baja automática por no
              firmar en 24 h; los <b style={{ color: "var(--warn)" }}>pendientes</b> siguen en
              plazo. Contactalos directo por WhatsApp (el mensaje ya viene escrito) o por email.
            </div>

            {/* Horarios a cubrir — qué franjas quedaron con vacante */}
            {horariosACubrir.length > 0 && (
              <div
                style={{
                  border: "1px solid var(--rule-2)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 14,
                  background: "var(--paper)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: "var(--ink-3)",
                    marginBottom: 10,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 15, color: "var(--warn)" }}>
                    schedule
                  </span>
                  Horarios a cubrir
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {horariosACubrir.map((h) => (
                    <span
                      key={h.horario}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid var(--warn)",
                        background: "var(--warn-s)",
                        fontSize: 12.5,
                        color: "var(--ink-2)",
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{h.horario}</span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 20,
                          height: 20,
                          padding: "0 6px",
                          borderRadius: 999,
                          background: "var(--warn)",
                          color: "var(--paper)",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {h.count}
                      </span>
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 10 }}>
                  Al seleccionar reemplazos, priorizá estas franjas para no dejar vacantes.
                </div>
              </div>
            )}

            <div
              style={{
                border: "1px solid var(--warn)",
                borderRadius: 12,
                overflow: "hidden",
                background: "var(--warn-s)",
              }}
            >
              {faltanRows.map(renderRow)}
            </div>
          </div>
        )}

        {/* Ya firmaron — colapsado (secundario) */}
        {firmadosRows.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <button
              className="lv4-group-head"
              style={{ width: "100%" }}
              onClick={() => setFirmadosOpen((o) => !o)}
            >
              <span className="lv4-group-label">
                <span
                  className="material-icons"
                  style={{
                    fontSize: 16,
                    transition: "transform .15s",
                    transform: firmadosOpen ? "rotate(0)" : "rotate(-90deg)",
                    color: "var(--ink-4)",
                  }}
                >
                  expand_more
                </span>
                <span className="material-icons" style={{ fontSize: 15, color: "var(--ok)" }}>
                  verified
                </span>
                {firmadosRows.length} ya firmaron
              </span>
              <span className="lv4-group-count">{firmadosOpen ? "ocultar" : "ver"}</span>
            </button>
            {firmadosOpen && (
              <div
                style={{
                  border: "1px solid var(--rule-2)",
                  borderRadius: 12,
                  overflow: "hidden",
                  marginTop: 12,
                }}
              >
                {firmadosRows.map(renderRow)}
              </div>
            )}
          </div>
        )}

        {/* Gestionar seleccionados — agregar / cambiar desde inscriptos */}
        <div style={{ marginBottom: 28 }}>
          <button
            className="lv4-group-head"
            style={{ width: "100%" }}
            onClick={() => setGestionOpen((o) => !o)}
          >
            <span className="lv4-group-label">
              <span
                className="material-icons"
                style={{
                  fontSize: 16,
                  transition: "transform .15s",
                  transform: gestionOpen ? "rotate(0)" : "rotate(-90deg)",
                  color: "var(--ink-4)",
                }}
              >
                expand_more
              </span>
              Agregar o cambiar seleccionados
            </span>
            <span className="lv4-group-count">desde inscriptos</span>
          </button>
          {gestionOpen && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-3)",
                  marginBottom: 14,
                  maxWidth: 640,
                  lineHeight: 1.5,
                }}
              >
                Marcá o desmarcá estudiantes de la lista de inscriptos. Los cambios se reflejan
                arriba en la lista de seleccionados.
              </div>
              <Suspense fallback={<Loader />}>
                <SeleccionadorConvocatorias
                  isTestingMode={false}
                  preSelectedLaunchId={launch.id}
                  hideConfirmed
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* Activar la PPS */}
        {total > 0 && (
          <>
            <div className="lv4-eyebrow" style={{ marginBottom: 8 }}>
              Activar la PPS
            </div>
            <Banner
              tone="ok"
              icon="play_circle"
              title={
                pendientes > 0
                  ? `${pendientes} compromiso${pendientes !== 1 ? "s" : ""} aún pendiente${
                      pendientes !== 1 ? "s" : ""
                    }`
                  : "Todos los compromisos aceptados"
              }
              style={{ marginBottom: 16 }}
            >
              {pendientes > 0
                ? "Podés avanzar igual: la PPS arranca con los confirmados y los pendientes pasan a la lista de reemplazos."
                : "Activá la PPS para marcar el lanzamiento como en curso. Los estudiantes ya están listos."}
            </Banner>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 24,
              }}
            >
              <button className="lv4-btn lv4-btn-primary" onClick={onActivar}>
                <span className="material-icons" style={{ fontSize: 16 }}>
                  play_circle
                </span>
                Activar PPS
              </button>
              {pendientes > 0 && (
                <button
                  className="lv4-btn lv4-btn-ghost"
                  onClick={() =>
                    showModal(
                      "Avanzar con pendientes",
                      "Esta acción mueve el lanzamiento a Activa aunque haya compromisos sin firmar. Los pendientes podrán ser reemplazados desde la sala de Confirmación."
                    )
                  }
                >
                  <span className="material-icons" style={{ fontSize: 16 }}>
                    warning
                  </span>
                  ¿Por qué hay pendientes?
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── ActivaView ───────────────────────────────────────────────────────────────

export default ConfirmacionView;
