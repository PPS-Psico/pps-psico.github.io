/**
 * lanzador/SeleccionView.tsx — Vista del estado "seleccion" (DB 'Abierta').
 * Mesa abierta: stats de inscripción, salud por franja, difusión y mesa de
 * selección. Al cerrar la inscripción pasa al state "seguro".
 */
import React, { useState, useMemo, Suspense } from "react";
import {
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
} from "../../../constants";
import { formatDate } from "../../../utils/formatters";
import type { LanzamientoPPS } from "../../../types";
import { logger } from "../../../utils/logger";
import {
  CanvasHeader,
  Loader,
  Stat,
  StatGrid,
  useLaunchEditor,
  SeleccionadorConvocatorias,
  buildWhatsappFromLaunch,
  buildFranjasLibresMessage,
} from "./shared";
import { useLaunchRoster } from "./useLaunchData";
import { computeHorarioHealth } from "./lanzadorHealth";

const SeleccionView: React.FC<{ launch: LanzamientoPPS; onCerrarInscripcion: () => void }> = ({
  launch,
  onCerrarInscripcion,
}) => {
  const cupos = launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
  const fechaFin = launch[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
  const { openEdit, modal: editModal } = useLaunchEditor(launch);

  const { data: inscriptos = [] } = useLaunchRoster(launch.id);

  const total = inscriptos.length;

  // ── Salud por franja horaria ──────────────────────────────────────────────
  const horarioStr = launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] as string | null;
  // Cuando el lanzamiento tiene horarios fijos, todos comparten el mismo horario:
  // no existe diferenciación por franja, así que no tiene sentido mostrar la
  // "Salud por franja horaria" ni el aviso de franjas libres.
  const horariosFijos = !!launch[FIELD_HORARIOS_FIJOS_LANZAMIENTOS];
  const horarioHealth = useMemo(
    () => computeHorarioHealth({ horarioStr, horariosFijos, cupos, roster: inscriptos }),
    [horarioStr, horariosFijos, cupos, inscriptos]
  );

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
        <StatGrid style={{ marginBottom: 20 }}>
          <Stat label="Inscriptos" value={total} hint="postulados" tone="accent" />
          <Stat label="Cupos" value={cupos ?? "—"} hint="disponibles" />
          <Stat
            label="Ocupación"
            value={cupos ? `${Math.round((total / cupos) * 100)}%` : "—"}
            hint="del total de cupos"
            size="md"
          />
          <Stat
            label="Cierre inscripción"
            value={fechaFin ? formatDate(fechaFin) : "—"}
            hint="fecha límite"
            size="sm"
          />
        </StatGrid>

        {/* Salud por franja horaria — combina inscripción (cuántos postulados
            hay por grupo) con el avance de selección (cuántos ya elegiste vs el
            cupo del grupo). El admin ve de un vistazo dónde falta difundir y
            dónde falta seleccionar. */}
        {horarioHealth.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div className="lv4-eyebrow">Lo importante hoy</div>
            <div className="lv4-section-title">Salud por franja horaria</div>
            <p
              style={{
                fontSize: 12,
                color: "var(--ink-4)",
                margin: "-6px 0 14px",
                maxWidth: 640,
                lineHeight: 1.5,
              }}
            >
              Los cupos por franja son <b>estimados</b> (total ÷ nº de franjas); el sistema no
              define un cupo por franja. Usalos como referencia, no como número exacto.
            </p>
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
                        ? `Faltan ~${h.faltanSeleccion}`
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
                          {h.count === 1 ? "inscripto" : "inscriptos"} · ~{h.cuposLocal} cupos est.
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

export default SeleccionView;
