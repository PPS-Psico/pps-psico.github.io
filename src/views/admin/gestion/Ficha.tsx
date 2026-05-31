import React from "react";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
} from "../../../constants";
import { formatDate } from "../../../utils/formatters";
import { useInstitucionContexto } from "../../../hooks/useInstitucionContexto";
import type { ConversationEntry, HermesResumen } from "../../../hooks/useInstitucionContexto";
import { STATE_META, dbToUiState, type InstitutionVM, type UiState } from "./gestionTypes";
import { orientSlug } from "./gestionHelpers";

// ─── Ficha (institución seleccionada) ────────────────────────────────────────

const ConversationThread: React.FC<{
  entries: ConversationEntry[];
  markers: { ts: number; label: string }[];
}> = ({ entries, markers }) => {
  // Mezcla mensajes + marcadores de estado, orden cronológico ascendente (viejo→nuevo)
  type Row = { kind: "msg"; e: ConversationEntry } | { kind: "marker"; ts: number; label: string };
  const rows: Row[] = [
    ...entries.map((e) => ({ kind: "msg" as const, e })),
    ...markers.map((m) => ({ kind: "marker" as const, ts: m.ts, label: m.label })),
  ].sort((a, b) => (a.kind === "msg" ? a.e.ts : a.ts) - (b.kind === "msg" ? b.e.ts : b.ts));

  if (rows.length === 0) {
    return (
      <div className="meta" style={{ marginTop: 8 }}>
        Sin conversación registrada todavía.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, i) => {
        if (r.kind === "marker") {
          return (
            <div key={`m-${i}`} className="chat-marker">
              <span className="material-icons" style={{ fontSize: 12 }}>
                flag
              </span>
              {r.label} · {formatDate(new Date(r.ts).toISOString())}
            </div>
          );
        }
        const e = r.e;
        return (
          <div key={e.id} className={`chat-bubble ${e.fromMe ? "chat-out" : "chat-in"}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
              <span
                className="material-icons"
                style={{
                  fontSize: 11,
                  color: e.canal === "whatsapp" ? "#2F8F43" : "var(--accent)",
                }}
              >
                {e.canal === "whatsapp" ? "chat" : "mail"}
              </span>
              <span className="meta" style={{ fontSize: 9.5 }}>
                {e.fromMe
                  ? "Vos"
                  : e.autor || (e.canal === "whatsapp" ? "Institución" : "Remitente")}{" "}
                · {formatDate(new Date(e.ts).toISOString())}
              </span>
            </div>
            {e.asunto && (
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{e.asunto}</div>
            )}
            <div>{e.texto}</div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * ConversationSummary — fallback cuando Hermes no guardó el chat crudo.
 * Da, de un vistazo, en qué quedó la conversación: último canal, cuánto hace,
 * y sobre todo si quedó abierta / pendiente de algo.
 */
const ConversationSummary: React.FC<{ resumen: HermesResumen }> = ({ resumen }) => {
  const canalMail = (resumen.ultimoCanal || "").toLowerCase().includes("mail");
  const canalIcon = canalMail ? "mail" : "chat";
  const canalLabel = resumen.ultimoCanal
    ? canalMail
      ? "Mail"
      : "WhatsApp"
    : "Sin canal registrado";
  const ic = resumen.ultimoContactoAt;
  const days = ic ? Math.floor((Date.now() - new Date(ic).getTime()) / 86400000) : null;
  const haceLabel =
    days == null ? null : days <= 0 ? "hoy" : days === 1 ? "hace 1 día" : `hace ${days} días`;
  const abierta = resumen.pendientes.length > 0;
  const primerPendiente = abierta ? resumen.pendientes[0].accion : null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--paper-2)",
        border: "1px solid var(--rule-2)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="material-icons"
          style={{ fontSize: 15, color: canalMail ? "var(--accent)" : "#2F8F43" }}
        >
          {canalIcon}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          Último contacto por <strong>{canalLabel}</strong>
          {haceLabel && <span className="meta"> · {haceLabel}</span>}
        </span>
      </div>

      <div
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          fontSize: 11.5,
          fontWeight: 600,
          background: abierta ? "var(--warn-soft)" : "var(--ok-soft)",
          color: abierta ? "var(--warn)" : "var(--ok)",
          border: `1px solid ${abierta ? "#B4501E40" : "#2F5F3A40"}`,
        }}
      >
        <span className="material-icons" style={{ fontSize: 13 }}>
          {abierta ? "pending_actions" : "task_alt"}
        </span>
        {abierta ? "Conversación abierta · pendiente" : "Sin pendientes registrados"}
      </div>

      {primerPendiente && (
        <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
          Quedó pendiente: {primerPendiente}
          {resumen.pendientes.length > 1 && (
            <span className="meta"> (+{resumen.pendientes.length - 1} más)</span>
          )}
        </div>
      )}

      <div className="meta" style={{ fontSize: 10, fontStyle: "italic" }}>
        Hermes no guardó el chat completo · resumen del estado
      </div>
    </div>
  );
};

export const Ficha: React.FC<{
  vm: InstitutionVM | null;
  isTestingMode: boolean;
  onChangeState: (vm: InstitutionVM, state: UiState) => void;
  onContact: (vm: InstitutionVM) => void;
  onReminder: (vm: InstitutionVM) => void;
  onEdit: (vm: InstitutionVM) => void;
}> = ({ vm, isTestingMode, onChangeState, onContact, onReminder, onEdit }) => {
  // Solo consultamos contexto si la institución tiene ficha real (id ≠ clave de grupo)
  const realInstId = vm && vm.id !== vm.key ? vm.id : null;
  const { data: contexto } = useInstitucionContexto(realInstId, isTestingMode);

  if (!vm) {
    return (
      <aside className="gv3-ficha">
        <div style={{ padding: "120px 32px", textAlign: "center", color: "var(--ink-3)" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "var(--paper-2)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-icons" style={{ fontSize: 28, color: "var(--ink-4)" }}>
              apartment
            </span>
          </div>
          <div
            className="serif"
            style={{ marginTop: 16, fontSize: 17, fontWeight: 700, color: "var(--ink-2)" }}
          >
            Seleccioná una institución
          </div>
          <div
            className="meta"
            style={{
              marginTop: 8,
              lineHeight: 1.5,
              maxWidth: 240,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Para ver estado, contactos, fechas, historial de PPS y registrar cambios de gestión.
          </div>
        </div>
      </aside>
    );
  }

  const latest = vm.launches[0];
  const fechaInicio = latest?.[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const fechaFin = latest?.[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;
  const estadoDb = latest?.[FIELD_ESTADO_GESTION_LANZAMIENTOS] as string | null;

  // Timeline: historial_gestion (líneas) + ppsHistory derivado de launches
  const historialLines = (vm.historial || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <aside className="gv3-ficha">
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--rule-2)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {vm.localidad || "Institución"}
          </div>
          <button
            className="btn btn-ghost btn-sm press"
            onClick={() => onEdit(vm)}
            title="Editar datos"
          >
            <span className="material-icons" style={{ fontSize: 15, color: "var(--ink-3)" }}>
              edit
            </span>
          </button>
        </div>
        <h2
          className="serif"
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            lineHeight: 1.2,
          }}
        >
          {vm.nombre}
        </h2>
        <div
          style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}
        >
          <span className="chip-status" data-state={vm.state}>
            <span
              className={`dot dot-${STATE_META[vm.state].dot}`}
              style={{ width: 6, height: 6 }}
            />
            {STATE_META[vm.state].label}
          </span>
          {vm.noClasificada && (
            <span
              className="flag-unclassified"
              title="Estado de gestión no reconocido · conviene revisarlo y asignar un estado válido"
            >
              <span className="material-icons">help_outline</span>
              sin clasificar
            </span>
          )}
          {vm.orientaciones.map((o) => (
            <span key={o} className="chip-orient" data-orient={orientSlug(o)}>
              {o}
            </span>
          ))}
          {vm.id === vm.key && (
            <span
              className="chip"
              title="Esta institución existe solo dentro de un lanzamiento, sin ficha propia en el catálogo. Editá sus datos para crearla."
              style={{
                background: "color-mix(in oklab, var(--warn) 12%, var(--paper))",
                color: "var(--warn)",
                border: "1px solid color-mix(in oklab, var(--warn) 30%, var(--rule-2))",
                gap: 4,
              }}
            >
              <span className="material-icons" style={{ fontSize: 12 }}>
                help_outline
              </span>
              Sin ficha propia
            </span>
          )}
        </div>
      </div>

      {contexto?.resumen && (
        <div className="hermes-card">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span className="material-icons" style={{ fontSize: 15, color: "var(--ai)" }}>
              auto_awesome
            </span>
            <span className="label" style={{ color: "var(--ai)" }}>
              Hermes sugiere
            </span>
            {(() => {
              const ic = contexto.resumen.ultimoContactoAt;
              if (!ic) return null;
              const days = Math.floor((Date.now() - new Date(ic).getTime()) / 86400000);
              return (
                <span className="meta" style={{ marginLeft: "auto", fontSize: 10.5 }}>
                  último contacto hace {days} d
                </span>
              );
            })()}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
            {contexto.resumen.resumen}
          </div>
          {contexto.resumen.pendientes.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {contexto.resumen.pendientes.slice(0, 4).map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-icons" style={{ fontSize: 13, color: "var(--ai)" }}>
                    radio_button_unchecked
                  </span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-2)" }}>{p.accion}</span>
                  {p.vencimiento && (
                    <span className="meta mono" style={{ fontSize: 10.5 }}>
                      {formatDate(p.vencimiento)}
                    </span>
                  )}
                  <button
                    className="btn btn-ghost btn-sm press"
                    style={{ padding: "2px 6px" }}
                    title="Crear recordatorio"
                    onClick={() => onReminder(vm)}
                  >
                    <span
                      className="material-icons"
                      style={{ fontSize: 13, color: "var(--ink-3)" }}
                    >
                      alarm_add
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="meta" style={{ fontSize: 10, marginTop: 8, fontStyle: "italic" }}>
            Sugerencia de Hermes · revisá antes de actuar
          </div>
        </div>
      )}

      {vm.flags.length > 0 && (
        <div
          style={{
            margin: "16px 24px 0",
            padding: 12,
            borderRadius: 10,
            border: "1px dashed #B4501E55",
            background: "var(--warn-soft)",
          }}
        >
          <div className="label" style={{ marginBottom: 8, color: "var(--warn)" }}>
            Falta dato clave
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {vm.flags.map((f) => (
              <span key={f.k} className="flag-missing">
                <span className="material-icons">{f.icon}</span>
                {f.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contacto */}
      <div style={{ padding: "20px 24px 12px" }}>
        <span className="label">Contacto</span>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { icon: "person", v: vm.referente, mono: false, copy: false },
            { icon: "place", v: vm.localidad, mono: false, copy: false },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: c.v ? "var(--ink-2)" : "var(--ink-4)",
              }}
            >
              <span className="material-icons" style={{ fontSize: 14, color: "var(--ink-4)" }}>
                {c.icon}
              </span>
              <span style={{ flex: 1, fontSize: 13 }}>{c.v || "—"}</span>
            </div>
          ))}

          {/* WhatsApp — canal principal de contacto con la institución */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: vm.phone ? "var(--ink-2)" : "var(--ink-4)",
            }}
          >
            <span
              className="material-icons"
              style={{ fontSize: 14, color: vm.phone ? "#2F8F43" : "var(--ink-4)" }}
            >
              chat
            </span>
            {vm.phone ? (
              <>
                <span className="mono" style={{ flex: 1, fontSize: 12 }}>
                  {vm.phone}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: 4 }}
                  title="Copiar teléfono"
                  onClick={() => navigator.clipboard?.writeText(vm.phone || "")}
                >
                  <span className="material-icons" style={{ fontSize: 13, color: "var(--ink-3)" }}>
                    content_copy
                  </span>
                </button>
              </>
            ) : (
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Sin teléfono
                <button
                  className="btn btn-ghost btn-sm press"
                  style={{ padding: "0 4px", color: "var(--warn)" }}
                  onClick={() => onEdit(vm)}
                  title="Cargar teléfono de contacto"
                >
                  <span className="material-icons" style={{ fontSize: 13 }}>
                    add
                  </span>
                  cargar
                </button>
              </span>
            )}
          </div>

          {/* Contacto validado en "Contactos" (Hermes) — cierra el loop: si la
              institución no tiene teléfono propio, sugerimos el número que se
              validó en la pestaña Contactos y permite cargarlo de una. */}
          {!vm.phone &&
            (contexto?.contactosValidados?.[0]?.phone ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                  padding: "7px 9px",
                  borderRadius: 8,
                  background: "var(--ok-soft)",
                  border: "1px solid color-mix(in oklab, var(--ok) 28%, var(--rule-2))",
                  fontSize: 12.5,
                }}
              >
                <span className="material-icons" style={{ fontSize: 14, color: "var(--ok)" }}>
                  verified
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {contexto.contactosValidados[0].phone}
                  </span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--ink-3)" }}>
                    Validado en Contactos
                    {contexto.contactosValidados[0].nombre
                      ? ` · ${contexto.contactosValidados[0].nombre}`
                      : ""}
                  </span>
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: 4 }}
                  title="Copiar teléfono validado"
                  onClick={() =>
                    navigator.clipboard?.writeText(contexto!.contactosValidados[0].phone || "")
                  }
                >
                  <span className="material-icons" style={{ fontSize: 13, color: "var(--ink-3)" }}>
                    content_copy
                  </span>
                </button>
              </div>
            ) : null)}
        </div>
        {vm.phone && (
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            <button className="btn btn-sm btn-wa press" onClick={() => onContact(vm)}>
              <span className="material-icons" style={{ fontSize: 14 }}>
                chat
              </span>
              WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Fechas */}
      <div style={{ padding: "16px 24px 12px", borderTop: "1px solid var(--rule-2)" }}>
        <span className="label">Fechas</span>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { l: "Inicio", v: fechaInicio ? formatDate(fechaInicio) : "—" },
            { l: "Fin", v: fechaFin ? formatDate(fechaFin) : "—" },
            { l: "Próximo seguimiento", v: vm.proximo ? formatDate(vm.proximo) : "—" },
          ].map((r) => (
            <div
              key={r.l}
              style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
            >
              <span className="meta">{r.l}</span>
              <span className="mono" style={{ color: "var(--ink-2)", fontSize: 12 }}>
                {r.v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cambiar estado */}
      <div style={{ padding: "16px 24px 12px", borderTop: "1px solid var(--rule-2)" }}>
        <span className="label">Cambiar estado</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {(
            ["esperandoRespuesta", "pendienteDecision", "confirmada", "archivada"] as UiState[]
          ).map((s) => (
            <button
              key={s}
              className="chip-status press"
              data-state={s}
              style={{ cursor: "pointer", border: "1px solid currentColor" }}
              onClick={() => onChangeState(vm, s)}
            >
              {STATE_META[s].label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-sm press"
          style={{ marginTop: 10, padding: "6px 0" }}
          onClick={() => onReminder(vm)}
        >
          <span className="material-icons" style={{ fontSize: 14 }}>
            alarm_add
          </span>
          Crear recordatorio
        </button>
      </div>

      {/* Conversación · WhatsApp + Mail */}
      <div style={{ padding: "16px 24px 12px", borderTop: "1px solid var(--rule-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="label">Conversación · WhatsApp + Mail</span>
          {vm.phone && (
            <button
              className="btn btn-ghost btn-sm press"
              style={{ padding: "2px 6px", color: "var(--accent)" }}
              onClick={() => onContact(vm)}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                reply
              </span>
              Reinsistir
            </button>
          )}
        </div>
        {(() => {
          const conv = contexto?.conversacion || [];
          // Hay chat crudo: lo mostramos con marcadores de finalización intercalados.
          if (conv.length > 0) {
            return (
              <ConversationThread
                entries={conv}
                markers={vm.launches
                  .map((l) => {
                    const fin = l[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;
                    const ts = fin ? new Date(fin).getTime() : 0;
                    return ts > 0 && ts <= Date.now()
                      ? {
                          ts,
                          label: `${(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || vm.nombre} finalizada`,
                        }
                      : null;
                  })
                  .filter((m): m is { ts: number; label: string } => !!m)}
              />
            );
          }
          // Sin chat crudo pero Hermes dejó un resumen: estado de la conversación.
          if (contexto?.resumen) {
            return <ConversationSummary resumen={contexto.resumen} />;
          }
          return (
            <div className="meta" style={{ marginTop: 8 }}>
              Sin conversación registrada todavía.
            </div>
          );
        })()}
      </div>

      {/* Historial de PPS */}
      <div style={{ padding: "16px 24px 12px", borderTop: "1px solid var(--rule-2)" }}>
        <span className="label">Historial de PPS · {vm.launches.length}</span>
        <div style={{ marginTop: 10 }}>
          {vm.launches.slice(0, 8).map((l) => {
            const ini = l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
            const st = dbToUiState(l[FIELD_ESTADO_GESTION_LANZAMIENTOS] as string);
            return (
              <div key={l.id} className="timeline-row" style={{ paddingBottom: 12 }}>
                <span className="timeline-dot" style={{ background: `var(--state-${st})` }} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || vm.nombre}
                  </div>
                  <div className="meta mono" style={{ fontSize: 11, marginTop: 2 }}>
                    {ini ? formatDate(ini) : "sin fecha"} · {STATE_META[st].label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notas / historial textual */}
      <div style={{ padding: "16px 24px 32px", borderTop: "1px solid var(--rule-2)" }}>
        <span className="label">Notas de gestión</span>
        {historialLines.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {historialLines.slice(0, 6).map((line, i) => (
              <div
                key={i}
                className="meta"
                style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}
              >
                · {line}
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            color: "var(--ink-2)",
            lineHeight: 1.5,
            fontStyle: vm.notas ? "italic" : "normal",
          }}
        >
          {vm.notas ? (
            `"${vm.notas}"`
          ) : (
            <span className="meta">Sin notas registradas. Estado en base: {estadoDb || "—"}.</span>
          )}
        </div>
      </div>
    </aside>
  );
};
