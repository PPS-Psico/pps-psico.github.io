// ──────────────────────────────────────────────────────────────────────────
// InstitucionActionPanel — panel DERECHO para contactar / reinsistir a una
// institución desde la bandeja "Hoy". Reemplaza al ContactModal flotante: vive
// en la columna derecha como el resto de las acciones (correos, solicitudes),
// con la conversación previa visible y el borrador editable.
//
//   · Muestra el chat real (WhatsApp + mail) vía useInstitucionContexto.
//   · Borrador editable con reescritura de Hermes (formal/breve/cálido/reinsistir).
//   · Acciones: abrir WhatsApp (envío manual, shadow mode) + marcar "esperando".
// ──────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from "react";
import type { InstitutionVM } from "../../../views/admin/gestion/gestionTypes";
import { WA_BASE, HERMES_STYLES, hermesRewrite } from "../../../views/admin/gestion/modals";
import { fetchHermesDraft, hermesWebhookConfigured } from "../../../services/hermesDraft";
import { useInstitucionContexto } from "../../../hooks/useInstitucionContexto";

interface Props {
  vm: InstitutionVM;
  isTestingMode?: boolean;
  onClose: () => void;
  onSend: (vm: InstitutionVM, text: string) => void;
  onMarkWaiting: (vm: InstitutionVM) => void;
}

const fmtFecha = (ts: number): string => {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const InstitucionActionPanel: React.FC<Props> = ({
  vm,
  isTestingMode = false,
  onClose,
  onSend,
  onMarkWaiting,
}) => {
  const realInstId = vm.id !== vm.key ? vm.id : null;
  const { data: contexto } = useInstitucionContexto(realInstId, isTestingMode);

  const [text, setText] = useState(() => WA_BASE(vm));
  const [thinking, setThinking] = useState<string | null>(null);
  const [source, setSource] = useState<"n8n" | "local" | null>(null);

  // Si cambia la institución seleccionada, reseteamos el borrador.
  useEffect(() => {
    setText(WA_BASE(vm));
    setSource(null);
    setThinking(null);
  }, [vm]);

  // Últimos mensajes de la conversación (más viejo → más nuevo para leerla natural).
  const conversacion = useMemo(() => {
    const conv = contexto?.conversacion || [];
    return [...conv].sort((a, b) => a.ts - b.ts).slice(-8);
  }, [contexto]);

  const applyStyle = async (style: "formal" | "breve" | "calido" | "reinsistir") => {
    setThinking(style);
    setSource(null);
    const real = await fetchHermesDraft({
      institucionId: vm.id,
      institucion: vm.nombre,
      referente: vm.referente,
      telefono: vm.phone,
      canal: "whatsapp",
      estilo: style,
      accion: style === "reinsistir" ? "reinsistir" : "contactar",
    });
    if (real) {
      setText(real);
      setSource("n8n");
    } else {
      setText(hermesRewrite(WA_BASE(vm), style, vm));
      setSource("local");
    }
    setThinking(null);
  };

  return (
    <aside
      className="gv3-ficha"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "calc(100vh - 60px)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid var(--rule-2)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--ai)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              campaign
            </span>
            Contactar institución
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--ink-3)",
              padding: 0,
              display: "inline-flex",
            }}
          >
            <span className="material-icons" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>
        <h2
          className="serif"
          style={{ margin: "8px 0 0", fontSize: 19, lineHeight: 1.25, color: "var(--ink)" }}
        >
          {vm.nombre}
        </h2>
        <div className="mono" style={{ marginTop: 4, fontSize: 12, color: "var(--ink-3)" }}>
          {vm.phone ? vm.phone : <span style={{ color: "var(--warn)" }}>Sin teléfono cargado</span>}
          {vm.referente ? ` · ${vm.referente}` : ""}
        </div>
      </div>

      {/* ── Cuerpo scrolleable: conversación + borrador ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px" }}>
        {/* Conversación previa */}
        {conversacion.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span className="material-icons" style={{ fontSize: 13 }}>
                history
              </span>
              Última conversación
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {conversacion.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.fromMe ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "8px 11px",
                    borderRadius: 12,
                    border: "1px solid var(--rule-2)",
                    background: m.fromMe ? "var(--paper-2)" : "var(--paper)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--ink-2)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        className="material-icons"
                        style={{
                          fontSize: 11,
                          color: m.canal === "whatsapp" ? "var(--ok)" : "var(--accent)",
                        }}
                      >
                        {m.canal === "whatsapp" ? "chat" : "mail"}
                      </span>
                      {m.fromMe ? "Vos · Coordinación" : m.autor || "Institución"}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--ink-4)",
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtFecha(m.ts)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--ink-2)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.texto || "(sin contenido)"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 11px",
              borderRadius: 10,
              border: "1px solid color-mix(in oklab, var(--ai) 22%, var(--rule-2))",
              background: "color-mix(in oklab, var(--ai) 6%, var(--paper))",
              marginBottom: 16,
              fontSize: 12,
              color: "var(--ink-2)",
              lineHeight: 1.45,
            }}
          >
            <span className="material-icons" style={{ fontSize: 16, color: "var(--ai)" }}>
              waving_hand
            </span>
            <span>
              <b>Sin conversación previa registrada.</b> Es un buen momento para iniciar el
              contacto.
            </span>
          </div>
        )}

        {/* Reescribir con Hermes */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span className="material-icons" style={{ fontSize: 15, color: "var(--ai)" }}>
            auto_awesome
          </span>
          <span className="label" style={{ color: "var(--ai)" }}>
            Reescribir con Hermes
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {HERMES_STYLES.map((s) => (
            <button
              key={s.id}
              className="btn btn-sm btn-ai press"
              onClick={() => applyStyle(s.id as "formal" | "breve" | "calido" | "reinsistir")}
              disabled={!!thinking}
            >
              <span className="material-icons" style={{ fontSize: 13 }}>
                {s.icon}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        <label
          style={{
            display: "block",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
            marginBottom: 5,
          }}
        >
          Mensaje · editá y enviá
        </label>
        <textarea
          className={thinking ? "shimmer" : ""}
          value={thinking ? "Hermes está reescribiendo…" : text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!thinking}
          rows={7}
          style={{
            width: "100%",
            resize: "vertical",
            padding: 11,
            borderRadius: 10,
            border: "1px solid var(--rule-2)",
            background: "var(--paper-2)",
            color: "var(--ink)",
            fontFamily: "inherit",
            fontSize: 13,
            lineHeight: 1.55,
            minHeight: 120,
          }}
        />
        <div
          className="meta"
          style={{
            fontSize: 11,
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span className="material-icons" style={{ fontSize: 13 }}>
            info
          </span>
          Hermes solo propone el texto. Vos revisás y enviás manualmente.
          {source === "n8n" && (
            <span
              className="chip"
              style={{
                fontSize: 9.5,
                color: "var(--ai)",
                background: "var(--ai-soft)",
                borderColor: "transparent",
              }}
            >
              contexto real
            </span>
          )}
          {source === "local" && (
            <span className="chip" style={{ fontSize: 9.5 }}>
              {hermesWebhookConfigured() ? "Hermes offline · plantilla" : "plantilla local"}
            </span>
          )}
        </div>
      </div>

      {/* ── Footer: acciones ── */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--rule-2)",
          background: "var(--paper)",
          padding: "12px 18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          disabled={!vm.phone || !!thinking}
          onClick={() => onSend(vm, text)}
          className="press"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: vm.phone ? "var(--ok)" : "var(--rule-2)",
            color: vm.phone ? "var(--paper)" : "var(--ink-3)",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: vm.phone && !thinking ? "pointer" : "default",
            opacity: vm.phone && !thinking ? 1 : 0.6,
          }}
        >
          <span className="material-icons" style={{ fontSize: 16 }}>
            {vm.phone ? "send" : "phone_disabled"}
          </span>
          {vm.phone ? "Abrir WhatsApp" : "Sin teléfono cargado"}
        </button>
        <button
          onClick={() => onMarkWaiting(vm)}
          className="press"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 14px",
            borderRadius: 10,
            border: "1px solid var(--rule-2)",
            background: "transparent",
            color: "var(--ink-2)",
            fontFamily: "inherit",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span className="material-icons" style={{ fontSize: 15 }}>
            schedule_send
          </span>
          Marcar “Esperando respuesta”
        </button>
      </div>
    </aside>
  );
};

export default InstitucionActionPanel;
