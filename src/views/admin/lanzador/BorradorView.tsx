/**
 * lanzador/BorradorView.tsx — Vista del estado "borrador" del pipeline.
 * State "borrador" = DB 'Oculto'. Edición de datos y completitud antes de lanzar.
 */
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "../../../lib/db";
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
import { formatDate } from "../../../utils/formatters";
import type { LanzamientoPPS } from "../../../types";
import RecordEditModal from "../../../components/admin/RecordEditModal";
import { LAUNCH_TABLE_CONFIG } from "../../../components/admin/LanzadorConvocatorias";
import { logger } from "../../../utils/logger";
import { CanvasHeader, buildWhatsappFromLaunch } from "./shared";

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

export default BorradorView;
