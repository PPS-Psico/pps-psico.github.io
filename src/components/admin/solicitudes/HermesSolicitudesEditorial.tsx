import React, { useMemo } from "react";
import { cleanWhatsAppNumber } from "../../../utils/formatters";
import { timeAgo } from "./helpers";
import type { SolicitudPPSWithStudent } from "./types";
const HermesSolicitudesEditorial: React.FC<{
  list: SolicitudPPSWithStudent[];
  gmailHilos: any[];
  whatsappMensajes: any[];
  whatsappContactos: any[];
}> = ({ list, gmailHilos, whatsappMensajes, whatsappContactos }) => {
  const activeSols = useMemo(() => {
    return list.filter(
      (s) =>
        !["Realizada", "No se pudo concretar", "Archivado"].includes(s.estado_seguimiento || "")
    );
  }, [list]);

  const underConv = useMemo(() => {
    return activeSols.filter(
      (s) =>
        s.estado_seguimiento === "En conversaciones" ||
        s.estado_seguimiento === "Realizando convenio"
    ).length;
  }, [activeSols]);

  const stagnantCount = useMemo(() => {
    return activeSols.filter((s) => s._daysSinceUpdate > 4).length;
  }, [activeSols]);

  const noConvenioCount = useMemo(() => {
    return activeSols.filter((s) => !s.convenio_uflo || s.convenio_uflo.toLowerCase() !== "sí")
      .length;
  }, [activeSols]);

  // Take the 3 most recent tracking logs across all active solicitudes
  const recentActions = useMemo(() => {
    const actions: any[] = [];

    activeSols.forEach((sol) => {
      const { number: cleanPhone } = cleanWhatsAppNumber(sol.telefono_institucion);

      // last whatsapp message
      if (cleanPhone) {
        const msgs = whatsappMensajes.filter((m) => {
          if (!m.chat_jid) return false;
          const { number: msgPhone } = cleanWhatsAppNumber(m.chat_jid.split("@")[0]);
          return msgPhone === cleanPhone;
        });
        if (msgs.length > 0) {
          const lastMsg = msgs[0];
          actions.push({
            institucion: sol.nombre_institucion || "Institución",
            alumno: sol._studentName,
            canal: "whatsapp",
            fromMe: lastMsg.from_me,
            texto: lastMsg.texto,
            timestamp: new Date(lastMsg.timestamp),
            hace: timeAgo(lastMsg.timestamp),
          });
        }
      }

      // last email thread
      if (sol.email_institucion) {
        const email = sol.email_institucion.toLowerCase().trim();
        const threads = gmailHilos.filter((t) => {
          const matchesEmail =
            t.participantes && JSON.stringify(t.participantes).toLowerCase().includes(email);
          const matchesDirect =
            t.email_institucion && t.email_institucion.toLowerCase().includes(email);
          return matchesEmail || matchesDirect;
        });
        if (threads.length > 0) {
          const lastThread = threads[0];
          actions.push({
            institucion: sol.nombre_institucion || "Institución",
            alumno: sol._studentName,
            canal: "mail",
            fromMe: lastThread.ultimo_mensaje_de === "nos",
            texto: lastThread.asunto,
            timestamp: new Date(
              lastThread.ultimo_mensaje_at || lastThread.primer_mensaje_at || Date.now()
            ),
            hace: timeAgo(lastThread.ultimo_mensaje_at),
          });
        }
      }
    });

    // Sort descending by timestamp and take top 3
    actions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return actions.slice(0, 3);
  }, [activeSols, gmailHilos, whatsappMensajes]);

  return (
    <div
      style={{
        border: "1px solid #5A2D8626",
        borderRadius: 20,
        overflow: "hidden",
        background: "var(--paper)",
        marginBottom: 20,
        boxShadow: "0 4px 20px rgba(90, 45, 134, 0.05)",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--rule-2)",
          background: "var(--ai-soft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="material-icons" style={{ fontSize: 16, color: "var(--ai)" }}>
            auto_awesome
          </span>
          <span className="label" style={{ color: "var(--ai)", letterSpacing: "0.08em" }}>
            Hermes · Resumen de Seguimiento
          </span>
        </div>
        <span className="meta" style={{ fontSize: 11, color: "var(--ai)", fontWeight: 600 }}>
          MONITOREO ACTIVO
        </span>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Lead Summary */}
        <div style={{ borderLeft: "2px solid var(--ai)", paddingLeft: 12 }}>
          <p
            className="serif"
            style={{
              margin: 0,
              fontSize: 17,
              fontStyle: "normal",
              fontWeight: 700,
              color: "var(--ink-2)",
              lineHeight: 1.4,
            }}
          >
            {activeSols.length === 0
              ? "No tenés solicitudes activas bajo gestión en este momento."
              : `Bajo gestión: ${activeSols.length} solicitudes de ingreso. Hay ${underConv} en conversaciones activas de convenio y ${stagnantCount} estancadas sin movimiento.`}
          </p>
        </div>

        {/* Metrics Row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 12,
              border: "1px solid var(--rule-2)",
              background: "var(--paper-2)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span className="material-icons" style={{ fontSize: 14, color: "var(--accent)" }}>
              chat
            </span>
            <span>{underConv} en conversaciones</span>
          </div>
          {stagnantCount > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 12,
                border: "1px solid #B4501E33",
                background: "var(--warn-soft)",
                color: "var(--warn)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                timer
              </span>
              <span>{stagnantCount} sin movimiento (+4d)</span>
            </div>
          )}
          {noConvenioCount > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 12,
                border: "1px solid #A6293A33",
                background: "var(--crit-soft)",
                color: "var(--crit)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                pending_actions
              </span>
              <span>{noConvenioCount} sin convenio</span>
            </div>
          )}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 12,
              border: "1px solid var(--rule-2)",
              background: "var(--paper-2)",
              fontSize: 12,
              fontWeight: 700,
              marginLeft: "auto",
            }}
          >
            <span className="material-icons" style={{ fontSize: 14, color: "var(--ai)" }}>
              contacts
            </span>
            <span>{whatsappContactos.length} contactos en lista PPS</span>
          </div>
        </div>

        {/* Recent Actions list */}
        {recentActions.length > 0 && (
          <div style={{ borderTop: "1px solid var(--rule-2)", paddingTop: 14 }}>
            <div className="label" style={{ marginBottom: 8, fontSize: 10 }}>
              ÚLTIMAS COMUNICACIONES REGISTRADAS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentActions.map((act, idx) => {
                const color = act.canal === "whatsapp" ? "#2F8F43" : "var(--accent)";
                const icon = act.canal === "whatsapp" ? "chat" : "mail";
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 12,
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: "var(--paper-2)",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 15, color }}>
                      {icon}
                    </span>
                    <span style={{ fontWeight: 600 }}>{act.institucion}</span>
                    <span style={{ color: "var(--ink-3)" }}>({act.alumno})</span>
                    <span style={{ color: "var(--ink-4)", margin: "0 2px" }}>·</span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        color: "var(--ink-2)",
                      }}
                    >
                      {act.fromMe ? "→ " : ""}
                      {act.texto}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-3)",
                        marginLeft: "auto",
                        flexShrink: 0,
                      }}
                    >
                      {act.hace}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HermesSolicitudesEditorial;
