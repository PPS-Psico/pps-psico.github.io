/**
 * lanzador/stepViews.tsx — Vistas por estado del pipeline del Lanzador.
 *
 * BorradorView, SeleccionView, SeguroView, ConfirmacionView, ActivaView y
 * ArchivadaView. Extraído de `LanzadorView.tsx` (relocalización pura) y consume
 * el núcleo compartido desde `./shared`.
 */
import React, { useState, useMemo, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../../../lib/db";
import { supabase } from "../../../lib/supabaseClient";
import { useModal } from "../../../contexts/ModalContext";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
} from "../../../constants";
import { normalizeStringForComparison, formatDate } from "../../../utils/formatters";
import { parseSchedules, normalizeSchedule } from "../../../utils/scheduleUtils";
import type { LanzamientoPPS } from "../../../types";
import RecordEditModal from "../../../components/admin/RecordEditModal";
import { LAUNCH_TABLE_CONFIG } from "../../../components/admin/LanzadorConvocatorias";
import { logger } from "../../../utils/logger";
import {
  CanvasHeader,
  Loader,
  useLaunchEditor,
  SeleccionadorConvocatorias,
  SeguroGenerator,
  buildWhatsappFromLaunch,
  buildFranjasLibresMessage,
} from "./shared";

interface BorradorViewProps {
  launch: LanzamientoPPS;
  onPublish: () => void;
  onRefresh: () => void;
}

const BorradorView: React.FC<BorradorViewProps> = ({ launch, onPublish, onRefresh }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waCopied, setWaCopied] = useState(false);
  const queryClient = useQueryClient();

  const nombre = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;
  const orientacion = launch[FIELD_ORIENTACION_LANZAMIENTOS] as string | null;
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const fechaInicio = launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const fechaFin = launch[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;
  const fechaInicioInsc = launch[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS] as string | null;
  const fechaFinInsc = launch[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
  const descripcion = launch[FIELD_DESCRIPCION_LANZAMIENTOS] as string | null;
  const horario = launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] as string | null;
  const mensajeWa =
    (launch[FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS] as string | null) ||
    buildWhatsappFromLaunch(launch);

  const campos = [
    { label: "Nombre PPS", value: nombre, icon: "label", required: true },
    { label: "Orientación", value: orientacion, icon: "school", required: true },
    {
      label: "Cupos disponibles",
      value: cupos !== null ? String(cupos) : null,
      icon: "group",
      required: true,
    },
    {
      label: "Fecha inicio PPS",
      value: fechaInicio ? formatDate(fechaInicio) : null,
      icon: "event",
      required: true,
    },
    {
      label: "Fecha fin PPS",
      value: fechaFin ? formatDate(fechaFin) : null,
      icon: "event_available",
      required: true,
    },
    {
      label: "Inicio inscripción",
      value: fechaInicioInsc ? formatDate(fechaInicioInsc) : null,
      icon: "calendar_today",
    },
    {
      label: "Cierre inscripción",
      value: fechaFinInsc ? formatDate(fechaFinInsc) : null,
      icon: "calendar_month",
    },
    { label: "Horario", value: horario, icon: "schedule" },
    { label: "Descripción", value: descripcion ? "Definida" : null, icon: "description" },
  ];

  const requiredFilled = [nombre, orientacion, cupos, fechaInicio, fechaFin].filter(Boolean).length;
  const totalRequired = 5;
  const pct = Math.round((requiredFilled / totalRequired) * 100);
  const isReady = pct >= 80;

  const handleSave = async (recordId: string | null, fields: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (recordId) {
        await db.lanzamientos.update(recordId, fields);
        await queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setSaving(false);
      setEditOpen(false);
      onRefresh();
    }
  };

  const copyWa = async () => {
    try {
      await navigator.clipboard.writeText(mensajeWa);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 1800);
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="borrador"
        primaryAction={{
          label: "Lanzar ahora",
          icon: "rocket_launch",
          onClick: onPublish,
          disabled: !isReady,
        }}
        secondaryActions={[
          {
            label: saved ? "¡Guardado!" : "Editar datos",
            icon: "edit",
            onClick: () => setEditOpen(true),
          },
        ]}
      />
      <div className="lv4-canvas-body">
        {/* Completitud banner */}
        <div
          className="lv4-banner"
          style={{
            borderColor: isReady ? "var(--ok)" : "var(--rule-3)",
            background: isReady ? "var(--ok-s)" : "var(--paper-2)",
          }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: isReady ? "var(--ok)" : "var(--ink-4)", marginTop: 1 }}
          >
            {isReady ? "check_circle" : "edit_note"}
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: isReady ? "var(--ok)" : "var(--ink-2)",
                marginBottom: 6,
              }}
            >
              {isReady ? "Listo para lanzar" : "Borrador en preparación"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="lv4-progress-track">
                <div
                  className="lv4-progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: isReady ? "var(--ok)" : "var(--accent)",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "var(--ink-3)",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {pct}%
              </span>
            </div>
            {!isReady && (
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>
                Faltan:{" "}
                {campos
                  .filter((c) => c.required && !c.value)
                  .map((c) => c.label)
                  .join(", ")}
              </div>
            )}
          </div>
          <button className="lv4-btn" onClick={() => setEditOpen(true)} style={{ flexShrink: 0 }}>
            <span className="material-icons" style={{ fontSize: 14 }}>
              edit
            </span>
            Editar
          </button>
        </div>

        {/* Campo cards */}
        <div className="lv4-eyebrow" style={{ marginBottom: 10 }}>
          Datos del borrador
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {campos.map((c) => (
            <div
              key={c.label}
              className="lv4-field-card"
              style={{
                borderColor: !c.value && c.required ? "var(--warn)" : "var(--rule-2)",
              }}
            >
              <div className="lv4-field-label">
                <span className="material-icons" style={{ fontSize: 12 }}>
                  {c.icon}
                </span>
                {c.label}
              </div>
              <div
                className="lv4-field-val"
                style={{
                  color: c.value ? "var(--ink-2)" : "var(--ink-4)",
                  fontStyle: c.value ? "normal" : "italic",
                }}
              >
                {c.value ||
                  (c.required ? (
                    <span
                      style={{
                        color: "var(--warn)",
                        fontStyle: "normal",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      ⚠ Sin completar
                    </span>
                  ) : (
                    "—"
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* WhatsApp preview */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div>
              <div className="lv4-eyebrow">Difusión</div>
              <div className="lv4-section-title" style={{ marginBottom: 0 }}>
                Mensaje WhatsApp
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="lv4-btn" onClick={() => setWaOpen((o) => !o)}>
                <span className="material-icons" style={{ fontSize: 14 }}>
                  {waOpen ? "visibility_off" : "visibility"}
                </span>
                {waOpen ? "Ocultar" : "Ver"}
              </button>
              {waOpen && (
                <button className="lv4-btn" onClick={copyWa}>
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    content_copy
                  </span>
                  {waCopied ? "¡Copiado!" : "Copiar"}
                </button>
              )}
            </div>
          </div>
          {waOpen && <div className="lv4-wa-bubble">{mensajeWa}</div>}
          {!waOpen && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--rule-2)",
                background: "var(--paper-2)",
                fontSize: 13,
                color: "var(--ink-3)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span className="material-icons" style={{ fontSize: 18, color: "#25D366" }}>
                chat
              </span>
              Generá el mensaje WhatsApp listo para compartir con los estudiantes.
            </div>
          )}
        </div>
      </div>

      <RecordEditModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        record={launch as Record<string, unknown>}
        tableConfig={LAUNCH_TABLE_CONFIG}
        onSave={handleSave}
        isSaving={saving}
      />
    </div>
  );
};

// ─── SeleccionView ──────────────────────────────────────────────────────────────
// State "seleccion" = DB 'Abierta' (mesa abierta). Muestra estadísticas de
// inscripción, tendencia y botón "Cerrar inscripción". Cuando el admin cierra la
// mesa, el lanzamiento pasa al state "seguro" (SeguroView).

const SeleccionView: React.FC<{ launch: LanzamientoPPS; onCerrarInscripcion: () => void }> = ({
  launch,
  onCerrarInscripcion,
}) => {
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const fechaFin = launch[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
  const { openEdit, modal: editModal } = useLaunchEditor(launch);

  const { data: inscriptos = [] } = useQuery({
    queryKey: ["inscriptosForLaunch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select(
          "id, estado_inscripcion, estudiante_id, horario_asignado, horario_seleccionado, created_at"
        )
        .eq("lanzamiento_id", launch.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const total = inscriptos.length;
  const seleccionados = inscriptos.filter(
    (i) => normalizeStringForComparison(i.estado_inscripcion) === "seleccionado"
  ).length;

  // ── Salud por franja horaria ──────────────────────────────────────────────
  // Parseamos las franjas declaradas en el lanzamiento y contamos inscriptos por
  // franja (matcheando su horario_asignado). Se muestra en la grilla visual
  // más abajo; ya no disparamos un banner de "Falta gente" porque confundía al
  // coordinador cuando los cupos totales ya estaban cubiertos.
  const horarioStr = launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] as string | null;
  const horarioHealth = useMemo(() => {
    const slots = parseSchedules(horarioStr);
    if (slots.length === 0) return [];
    const cuposPorSlot = cupos ? Math.max(1, Math.round(cupos / slots.length)) : null;
    return slots.map((slot) => {
      const norm = normalizeSchedule(slot);
      // Inscriptos cuya franja (la que eligieron o la que el admin les asignó)
      // coincide con este grupo. El estudiante elige su franja al inscribirse →
      // horario_seleccionado; horario_asignado lo completa el admin recién en la
      // selección, por eso el fallback (sin él, el conteo quedaba siempre en 0).
      const matching = inscriptos.filter((i) => {
        const conv = i as {
          horario_asignado?: string | null;
          horario_seleccionado?: string | null;
        };
        const h = conv.horario_asignado || conv.horario_seleccionado;
        return h && normalizeSchedule(h) === norm;
      });
      const count = matching.length;
      const seleccionados = matching.filter(
        (i) =>
          normalizeStringForComparison(
            (i as { estado_inscripcion?: string | null }).estado_inscripcion
          ) === "seleccionado"
      ).length;
      const pct = cuposPorSlot ? count / cuposPorSlot : 0;
      const status: "low" | "ok" | "full" =
        cuposPorSlot && count === 0 ? "low" : pct >= 1 ? "full" : pct >= 0.5 ? "ok" : "low";
      // Estado de la *selección* respecto al cupo del grupo: cuántos hay que
      // elegir vs cuántos ya marcó el admin.
      const libres = cuposPorSlot != null ? Math.max(0, cuposPorSlot - count) : null;
      const faltanSeleccion =
        cuposPorSlot != null ? Math.max(0, cuposPorSlot - seleccionados) : null;
      const selStatus: "completo" | "falta" | "excedido" | "indef" =
        cuposPorSlot == null
          ? "indef"
          : seleccionados > cuposPorSlot
            ? "excedido"
            : seleccionados === cuposPorSlot
              ? "completo"
              : "falta";
      return {
        label: slot,
        count,
        seleccionados,
        cuposLocal: cuposPorSlot,
        pct,
        status,
        libres,
        faltanSeleccion,
        selStatus,
      };
    });
  }, [horarioStr, inscriptos, cupos]);

  // Franjas que todavía no llenaron sus cupos con inscriptos → candidatas a un
  // empujón de difusión dirigido ("avisar que quedan lugares en este día").
  const franjasLibres = horarioHealth.filter((h) => h.libres != null && h.libres > 0);

  // ── Difusión: mensaje general + aviso de franjas libres ───────────────────
  const waMessage =
    (launch[FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS] as string | null) ||
    buildWhatsappFromLaunch(launch);
  const waFranjasMessage = useMemo(
    () => buildFranjasLibresMessage(launch, franjasLibres),
    [launch, franjasLibres]
  );
  const [copiedKey, setCopiedKey] = useState<"wa" | "franjas" | null>(null);
  const copyText = async (text: string, which: "wa" | "franjas") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(which);
      setTimeout(() => setCopiedKey((k) => (k === which ? null : k)), 1800);
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="seleccion"
        primaryAction={{ label: "Cerrar inscripción", icon: "lock", onClick: onCerrarInscripcion }}
        secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
      />
      {editModal}
      <div className="lv4-canvas-body">
        {/* Stats */}
        <div className="lv4-stats" style={{ marginBottom: 20 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Inscriptos</div>
            <div className="lv4-stat-val" style={{ color: "var(--accent)" }}>
              {total}
            </div>
            <div className="lv4-stat-hint">postulados</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Cupos</div>
            <div className="lv4-stat-val">{cupos ?? "—"}</div>
            <div className="lv4-stat-hint">disponibles</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Ocupación</div>
            <div className="lv4-stat-val" style={{ fontSize: 20, paddingTop: 4 }}>
              {cupos ? `${Math.round((total / cupos) * 100)}%` : "—"}
            </div>
            <div className="lv4-stat-hint">del total de cupos</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Cierre inscripción</div>
            <div className="lv4-stat-val" style={{ fontSize: 16, paddingTop: 6 }}>
              {fechaFin ? formatDate(fechaFin) : "—"}
            </div>
            <div className="lv4-stat-hint">fecha límite</div>
          </div>
        </div>

        {/* Acción principal — el orden recomendado es revisar la mesa primero
           y cerrar al final. El banner avisa cuántos cupos quedan por cubrir
           y ofrece un atajo para bajar a la mesa. */}
        <div
          className="lv4-banner"
          style={{ borderColor: "var(--rule-2)", background: "var(--paper-2)" }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: "var(--ink-3)", marginTop: 2 }}
          >
            lock
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {total} candidato{total !== 1 ? "s" : ""} para {cupos ?? "?"} cupos
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              RevIsá la mesa de selección abajo y, cuando termines de elegir, cerrá la inscripción
              para enviar los consentimientos.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              className="lv4-btn"
              onClick={() => {
                document
                  .getElementById("mesa-seleccion")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                arrow_downward
              </span>
              Ir a la mesa
            </button>
            <button className="lv4-btn lv4-btn-primary" onClick={onCerrarInscripcion}>
              <span className="material-icons" style={{ fontSize: 14 }}>
                lock
              </span>
              Cerrar inscripción
            </button>
          </div>
        </div>

        {/* Salud por franja horaria — combina inscripción (cuántos postulados
            hay por grupo) con el avance de selección (cuántos ya elegiste vs el
            cupo del grupo). El admin ve de un vistazo dónde falta difundir y
            dónde falta seleccionar. */}
        {horarioHealth.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div className="lv4-eyebrow">Lo importante hoy</div>
            <div className="lv4-section-title">Salud por franja horaria</div>
            <div className="lv4-horario-grid">
              {horarioHealth.map((h, idx) => {
                const toneColor =
                  h.status === "low"
                    ? "var(--warn)"
                    : h.status === "full"
                      ? "var(--ok)"
                      : "var(--accent)";
                const selColor =
                  h.selStatus === "completo"
                    ? "var(--ok)"
                    : h.selStatus === "excedido"
                      ? "var(--danger, #c0392b)"
                      : "var(--warn)";
                const selLabel =
                  h.selStatus === "completo"
                    ? "Completo"
                    : h.selStatus === "excedido"
                      ? `${h.seleccionados - (h.cuposLocal ?? 0)} de más`
                      : h.cuposLocal != null
                        ? `Faltan ${h.faltanSeleccion}`
                        : `${h.seleccionados} elegidos`;
                const selIcon =
                  h.selStatus === "completo"
                    ? "check_circle"
                    : h.selStatus === "excedido"
                      ? "error"
                      : "radio_button_unchecked";
                return (
                  <div key={idx} className={`lv4-horario-card${h.status === "low" ? " low" : ""}`}>
                    <div className="lv4-horario-head">
                      <span className="lv4-horario-label">{h.label}</span>
                      {h.status === "low" && (
                        <span
                          className="material-icons"
                          style={{ fontSize: 18, color: "var(--warn)" }}
                        >
                          warning
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 24,
                          fontWeight: 400,
                          color: toneColor,
                          lineHeight: 1,
                        }}
                      >
                        {h.count}
                      </span>
                      {h.cuposLocal && (
                        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
                          {h.count === 1 ? "inscripto" : "inscriptos"} · {h.cuposLocal} cupos
                        </span>
                      )}
                    </div>
                    <div className="lv4-horario-track">
                      <div
                        className="lv4-horario-fill"
                        style={{
                          width: `${Math.min(100, h.pct * 100)}%`,
                          background: toneColor,
                        }}
                      />
                    </div>
                    {/* Estado de selección del grupo */}
                    {h.cuposLocal != null && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 10,
                          fontSize: 12,
                          color: selColor,
                          fontWeight: 600,
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: 15 }}>
                          {selIcon}
                        </span>
                        <span>
                          {selLabel}
                          <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>
                            {" "}
                            — {h.seleccionados}/{h.cuposLocal} seleccionados
                          </span>
                        </span>
                      </div>
                    )}
                    {h.status === "low" && (
                      <div className="lv4-horario-foot">
                        Probablemente quede vacía si no se difunde con foco en este día.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Difusión: mensaje general + aviso inteligente de franjas libres */}
        <div style={{ marginTop: 28 }}>
          <div className="lv4-eyebrow">Difusión</div>
          <div className="lv4-section-title">Compartir la convocatoria</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: franjasLibres.length > 0 ? "1fr 1fr" : "1fr",
              gap: 12,
            }}
          >
            <div className="lv4-linkbox">
              <span
                className="lv4-stat-label"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span className="material-icons" style={{ fontSize: 14, color: "#25D366" }}>
                  chat
                </span>
                Mensaje de convocatoria
              </span>
              <div className="lv4-link-url" style={{ maxHeight: 48, overflow: "hidden" }}>
                {waMessage.split("\n")[0]}…
              </div>
              <button
                className="lv4-btn"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => copyText(waMessage, "wa")}
              >
                <span className="material-icons" style={{ fontSize: 14 }}>
                  {copiedKey === "wa" ? "check" : "content_copy"}
                </span>
                {copiedKey === "wa" ? "¡Copiado!" : "Copiar mensaje"}
              </button>
            </div>
            {franjasLibres.length > 0 && (
              <div className="lv4-linkbox" style={{ borderColor: "var(--warn)" }}>
                <span
                  className="lv4-stat-label"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span className="material-icons" style={{ fontSize: 14, color: "var(--warn)" }}>
                    campaign
                  </span>
                  Avisar cupos libres
                </span>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-3)",
                    lineHeight: 1.5,
                    margin: "2px 0 8px",
                  }}
                >
                  {franjasLibres.length === 1
                    ? "Queda lugar en 1 franja: "
                    : `Quedan lugares en ${franjasLibres.length} franjas: `}
                  <b style={{ color: "var(--ink)" }}>
                    {franjasLibres
                      .map((f) => `${f.label.split(" de ")[0]} (${f.libres})`)
                      .join(" · ")}
                  </b>
                </div>
                <button
                  className="lv4-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => copyText(waFranjasMessage, "franjas")}
                >
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    {copiedKey === "franjas" ? "check" : "content_copy"}
                  </span>
                  {copiedKey === "franjas" ? "¡Copiado!" : "Copiar aviso"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mesa de selección (SeleccionadorConvocatorias)
           Ya no hace falta cerrar la inscripción para ver / marcar estudiantes:
           el admin puede elegir acá mismo y, cuando termine, recién cerrar
           la inscripción desde el botón del header. La PPS sigue en `Abierta`
           en la DB hasta ese cierre formal (los `seleccionado` crean la
           práctica vía trigger pero NO disparan emails hasta el cierre). */}
        <div id="mesa-seleccion" style={{ marginTop: 32, scrollMarginTop: 80 }}>
          <div className="lv4-eyebrow">Mesa de selección</div>
          <div className="lv4-section-title">Elegí los estudiantes</div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-3)",
              margin: "0 0 14px",
              maxWidth: 640,
              lineHeight: 1.5,
            }}
          >
            Marcá los estudiantes que van a cursar la PPS. Podés hacerlo ahora y revisar antes de
            cerrar la inscripción. Cuando termines, usá <b>Cerrar inscripción</b> arriba para
            confirmar y enviar los consentimientos.
          </div>
          <Suspense fallback={<Loader />}>
            <SeleccionadorConvocatorias isTestingMode={false} preSelectedLaunchId={launch.id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

// ─── SeguroView ────────────────────────────────────────────────────────────────
// State "seguro" = DB 'Cerrado' (mesa cerrada) + sin marca de seguro. Es la
// etapa donde se eligen los candidatos y se gestiona el seguro antes de pasar
// a la sala de consentimientos.

const SeguroView: React.FC<{
  launch: LanzamientoPPS;
  onNavigateToInsurance: (id: string) => void;
  showModal: ReturnType<typeof useModal>["showModal"];
}> = ({ launch, onNavigateToInsurance, showModal }) => {
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const { openEdit, modal: editModal } = useLaunchEditor(launch);

  const { data: inscriptos = [] } = useQuery({
    queryKey: ["inscriptos-seguro", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select("id, estado_inscripcion")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  const total = inscriptos.length;
  const seleccionados = inscriptos.filter(
    (i) => normalizeStringForComparison(i.estado_inscripcion) === "seleccionado"
  ).length;

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="seguro"
        secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
      />
      {editModal}
      <div className="lv4-canvas-body">
        {/* Stats */}
        <div className="lv4-stats" style={{ marginBottom: 24 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Candidatos</div>
            <div className="lv4-stat-val" style={{ color: "var(--warn)" }}>
              {total}
            </div>
            <div className="lv4-stat-hint">inscriptos</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Cupos</div>
            <div className="lv4-stat-val">{cupos ?? "—"}</div>
            <div className="lv4-stat-hint">disponibles</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Seleccionados</div>
            <div
              className="lv4-stat-val"
              style={{ color: seleccionados > 0 ? "var(--ok)" : "var(--ink-4)" }}
            >
              {seleccionados}
            </div>
            <div className="lv4-stat-hint">hasta ahora</div>
          </div>
        </div>

        {/* Banner informativo */}
        <div
          className="lv4-banner"
          style={{ borderColor: "var(--warn)", background: "var(--warn-s)", marginBottom: 28 }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: "var(--warn)", marginTop: 2 }}
          >
            how_to_reg
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--warn)", marginBottom: 3 }}>
              Mesa de selección abierta
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Seleccioná los estudiantes y confirmá para enviar las notificaciones. Son {total}{" "}
              candidatos para {cupos ?? "?"} cupos.
            </div>
          </div>
        </div>

        <Suspense fallback={<Loader />}>
          <SeleccionadorConvocatorias
            isTestingMode={false}
            preSelectedLaunchId={launch.id}
            onNavigateToInsurance={onNavigateToInsurance}
          />
        </Suspense>

        {seleccionados > 0 && (
          <>
            <div className="lv4-eyebrow" style={{ marginBottom: 8 }}>
              Seguros y actas
            </div>
            <Suspense fallback={<Loader />}>
              <SeguroGenerator
                showModal={showModal}
                isTestingMode={false}
                preSelectedLanzamientoId={launch.id}
              />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
};

// ─── ConfirmacionView ─────────────────────────────────────────────────────────
// State "confirmacion" = DB 'Confirmacion' (o 'Cerrado' + marca de seguro).
// Sala de consentimientos: muestra avance de compromisos por estudiante, banner
// de pendientes, y al final un botón "Activar PPS" para transicionar a 'Activa'.
// Reemplaza al viejo SeleccionadaView (que renderizaba también el
// SeguroGenerator — eso ahora vive en SeguroView).

const ActivaView: React.FC<{ launch: LanzamientoPPS; onArchivar: () => void }> = ({
  launch,
  onArchivar,
}) => {
  const { openEdit, modal: editModal } = useLaunchEditor(launch);
  const fechaInicio = launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const fechaFin = launch[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;

  const { data: practicas = [] } = useQuery({
    queryKey: ["practicasForLaunch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("practicas")
        .select("id, estado, horas_realizadas")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  const totalHoras = practicas.reduce((sum, p) => sum + ((p.horas_realizadas as number) || 0), 0);
  const activas = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "activa"
  ).length;
  const finalizadas = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "finalizada"
  ).length;

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="activa"
        primaryAction={{ label: "Archivar convocatoria", icon: "archive", onClick: onArchivar }}
        secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
      />
      {editModal}
      <div className="lv4-canvas-body">
        {/* Stats */}
        <div className="lv4-stats" style={{ marginBottom: 28 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Prácticas activas</div>
            <div className="lv4-stat-val" style={{ color: "var(--ok)" }}>
              {activas}
            </div>
            <div className="lv4-stat-hint">en curso</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Finalizadas</div>
            <div className="lv4-stat-val">{finalizadas}</div>
            <div className="lv4-stat-hint">completadas</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Horas totales</div>
            <div className="lv4-stat-val">{totalHoras}</div>
            <div className="lv4-stat-hint">realizadas</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Período</div>
            <div className="lv4-stat-val" style={{ fontSize: 14, paddingTop: 8 }}>
              {fechaInicio ? formatDate(fechaInicio) : "—"}
            </div>
            <div className="lv4-stat-hint">
              {fechaFin ? `hasta ${formatDate(fechaFin)}` : "sin fecha fin"}
            </div>
          </div>
        </div>

        {/* Estado visual */}
        <div
          className="lv4-banner"
          style={{ borderColor: "var(--ok)", background: "var(--ok-s)", marginBottom: 0 }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 22, color: "var(--ok)", marginTop: 2 }}
          >
            trending_up
          </span>
          <div>
            <div style={{ fontWeight: 600, color: "var(--ok)", marginBottom: 4 }}>
              Prácticas en curso
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {activas} estudiante{activas !== 1 ? "s" : ""} realizando horas actualmente.
              {finalizadas > 0 && ` ${finalizadas} ya completaron.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ArchivadaView ────────────────────────────────────────────────────────────

const ArchivadaView: React.FC<{
  launch: LanzamientoPPS;
  onDuplicar: () => void;
  onReabrir: () => void;
}> = ({ launch, onDuplicar, onReabrir }) => {
  const { data: practicas = [] } = useQuery({
    queryKey: ["practicasForLaunch-arch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("practicas")
        .select("id, estado, horas_realizadas")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  const { data: convocatorias = [] } = useQuery({
    queryKey: ["convocatoriasForLaunch-arch", launch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocatorias")
        .select("id, estado_inscripcion")
        .eq("lanzamiento_id", launch.id);
      return data || [];
    },
  });

  const inscriptos = convocatorias.length;
  const seleccionados = convocatorias.filter(
    (c) => normalizeStringForComparison(c.estado_inscripcion) === "seleccionado"
  ).length;
  const acreditados = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "finalizada"
  ).length;
  const taxa = seleccionados > 0 ? Math.round((acreditados / seleccionados) * 100) : null;

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="archivada"
        primaryAction={{ label: "Duplicar como base", icon: "content_copy", onClick: onDuplicar }}
      />
      <div className="lv4-canvas-body">
        {/* Banner histórico */}
        <div
          className="lv4-banner"
          style={{ borderColor: "var(--rule-2)", background: "var(--paper-2)", marginBottom: 28 }}
        >
          <span
            className="material-icons"
            style={{ fontSize: 20, color: "var(--ink-3)", marginTop: 2 }}
          >
            archive
          </span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Convocatoria archivada</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Este ciclo ha concluido. Los datos quedan como referencia histórica.
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="lv4-stats" style={{ marginBottom: 28 }}>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Inscriptos</div>
            <div className="lv4-stat-val">{inscriptos}</div>
            <div className="lv4-stat-hint">se postularon</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Seleccionados</div>
            <div className="lv4-stat-val">{seleccionados}</div>
            <div className="lv4-stat-hint">comenzaron</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Acreditados</div>
            <div className="lv4-stat-val" style={{ color: "var(--ok)" }}>
              {acreditados}
            </div>
            <div className="lv4-stat-hint">finalizaron</div>
          </div>
          <div className="lv4-stat">
            <div className="lv4-stat-label">Tasa éxito</div>
            <div className="lv4-stat-val">{taxa !== null ? `${taxa}%` : "—"}</div>
            <div className="lv4-stat-hint">acred./selecc.</div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            {
              icon: "content_copy",
              title: "Duplicar como base",
              desc: "Crea un nuevo borrador con los datos de esta convocatoria.",
              cta: "Crear borrador",
              onClick: onDuplicar,
            },
            {
              icon: "restart_alt",
              title: "Reabrir inscripción",
              desc: "Vuelve a abrir para recibir nuevos postulantes.",
              cta: "Reabrir",
              onClick: onReabrir,
            },
          ].map((a) => (
            <div key={a.title} className="lv4-action-card">
              <span
                className="material-icons"
                style={{ fontSize: 20, color: "var(--ink-3)", marginBottom: 10, display: "block" }}
              >
                {a.icon}
              </span>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>{a.desc}</div>
              <button className="lv4-btn" onClick={a.onClick}>
                {a.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export { BorradorView, SeleccionView, SeguroView, ActivaView, ArchivadaView };
export { default as ConfirmacionView } from "./ConfirmacionView";
