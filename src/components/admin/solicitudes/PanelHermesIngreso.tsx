import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { cleanWhatsAppNumber } from "../../../utils/formatters";
import { logger } from "../../../utils/logger";
import { timeAgo } from "./helpers";
import type { SolicitudPPSWithStudent } from "./types";
const PanelHermesIngreso: React.FC<{
  sol: SolicitudPPSWithStudent;
  onVerGestion: () => void;
  gmailHilos: any[];
  whatsappMensajes: any[];
}> = ({ sol, onVerGestion, gmailHilos, whatsappMensajes }) => {
  const [ppsAnteriores, setPpsAnteriores] = useState<any[]>([]);
  const [loadingPps, setLoadingPps] = useState(false);

  const hasConvenio =
    sol.convenio_uflo?.toLowerCase() === "sí" || sol.convenio_uflo?.toLowerCase() === "si";
  const hasTutor =
    sol.tutor_disponible?.toLowerCase() === "sí" || sol.tutor_disponible?.toLowerCase() === "si";
  const isNoCatalogada =
    sol.convenio_uflo?.toLowerCase().includes("cat") ||
    sol.convenio_uflo?.toLowerCase() === "no catalogada";

  useEffect(() => {
    let active = true;
    const fetchPrevious = async () => {
      if (!sol.nombre_institucion) return;
      setLoadingPps(true);
      try {
        const { data, error } = await supabase
          .from("practicas")
          .select("estado, especialidad, fecha_inicio, fecha_finalizacion")
          .eq("nombre_institucion", sol.nombre_institucion)
          .limit(3);

        if (!error && data && active) {
          setPpsAnteriores(data);
        }
      } catch (e) {
        logger.error(e);
      } finally {
        if (active) setLoadingPps(false);
      }
    };
    fetchPrevious();
    return () => {
      active = false;
    };
  }, [sol.nombre_institucion]);

  // Generate dynamic recent history from Supabase threads and messages
  const recentHistory = useMemo(() => {
    const list: any[] = [];
    const { number: cleanPhone } = cleanWhatsAppNumber(sol.telefono_institucion);

    // Find matching WhatsApp messages
    if (cleanPhone) {
      const msgs = whatsappMensajes.filter((m) => {
        if (!m.chat_jid) return false;
        const { number: msgPhone } = cleanWhatsAppNumber(m.chat_jid.split("@")[0]);
        return msgPhone === cleanPhone;
      });
      msgs.forEach((m) => {
        list.push({
          canal: "whatsapp" as const,
          fromMe: m.from_me,
          snippet: m.texto || "Mensaje de WhatsApp",
          timestamp: new Date(m.timestamp),
          hace: timeAgo(m.timestamp),
          estado: null,
        });
      });
    }

    // Find matching Gmail threads
    if (sol.email_institucion) {
      const email = sol.email_institucion.toLowerCase().trim();
      const threads = gmailHilos.filter((t) => {
        const matchesEmail =
          t.participantes && JSON.stringify(t.participantes).toLowerCase().includes(email);
        const matchesDirect =
          t.email_institucion && t.email_institucion.toLowerCase().includes(email);
        return matchesEmail || matchesDirect;
      });

      threads.forEach((t) => {
        list.push({
          canal: "mail" as const,
          fromMe: t.ultimo_mensaje_de === "nos",
          snippet: t.asunto || "Correo sin asunto",
          timestamp: new Date(t.ultimo_mensaje_at || t.primer_mensaje_at || Date.now()),
          hace: timeAgo(t.ultimo_mensaje_at),
          estado: t.estado === "esperando_respuesta" ? ("esperando" as const) : null,
        });
      });
    }

    // Sort descending by date
    list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return list;
  }, [sol.email_institucion, sol.telefono_institucion, gmailHilos, whatsappMensajes]);

  // Generate dynamic recommendation based on recent history or convenio status
  const recommendation = useMemo(() => {
    if (recentHistory.length > 0) {
      const latest = recentHistory[0];
      const canalStr = latest.canal === "mail" ? "email" : "WhatsApp";
      const snippetStr =
        latest.snippet && latest.snippet.length > 60
          ? latest.snippet.substring(0, 57) + "..."
          : latest.snippet;

      if (latest.fromMe) {
        // Last message was from us
        return {
          sugerencia: `Le enviaste un ${canalStr} hace ${latest.hace} ("${snippetStr}"). Estamos esperando respuesta de ${sol.referente_institucion || "la institución"} para formalizar el convenio de prácticas.`,
          requiereDecision: false,
          motivoDecision: undefined,
        };
      } else {
        // Last message was from them (incoming)
        return {
          sugerencia: `La institución envió un ${canalStr} hace ${latest.hace}: "${snippetStr}". Está esperando tu respuesta. Hacé clic en ${latest.canal === "mail" ? "Enviar email" : "WhatsApp"} para contestar y avanzar.`,
          requiereDecision: true,
          motivoDecision: `Responder al referente institucional por ${canalStr}.`,
        };
      }
    }

    // No contact history yet
    if (hasConvenio) {
      if (hasTutor) {
        return {
          sugerencia: `Convenio formal vigente con "${sol.nombre_institucion}" y tutor disponible (${sol.contacto_tutor || "tutor"}). Podés proceder a aprobar la solicitud.`,
          requiereDecision: false,
          motivoDecision: undefined,
        };
      } else {
        return {
          sugerencia: `Existe convenio formal con "${sol.nombre_institucion}", pero falta registrar el psicólogo tutor matriculado para firmar el compromiso. Coordiná con la institución.`,
          requiereDecision: true,
          motivoDecision: "Falta tutor de psicología matriculado en la institución.",
        };
      }
    } else {
      if (isNoCatalogada) {
        return {
          sugerencia: `La institución "${sol.nombre_institucion}" no está en el catálogo. Verificá los datos e iniciá la firma del convenio formal si es viable.`,
          requiereDecision: true,
          motivoDecision: "Institución no catalogada. Requiere alta y convenio nuevo.",
        };
      } else {
        return {
          sugerencia: `Falta convenio formal con "${sol.nombre_institucion}" y no se ha iniciado contacto. Enviá la propuesta usando "Borrador con Hermes" o contactalos por WhatsApp.`,
          requiereDecision: true,
          motivoDecision: "Falta formalizar convenio de prácticas con la institución.",
        };
      }
    }
  }, [
    sol.convenio_uflo,
    sol.tutor_disponible,
    sol.nombre_institucion,
    sol.contacto_tutor,
    sol.referente_institucion,
    recentHistory,
    hasConvenio,
    hasTutor,
    isNoCatalogada,
  ]);

  const { sugerencia, requiereDecision, motivoDecision } = recommendation;

  return (
    <div
      style={{
        border: "1px solid #5A2D8626",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--paper)",
        marginTop: 14,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid var(--rule-2)",
          background: "var(--ai-soft)",
        }}
      >
        <span className="material-icons" style={{ fontSize: 16, color: "var(--ai)" }}>
          auto_awesome
        </span>
        <span className="label" style={{ color: "var(--ai)", letterSpacing: "0.08em" }}>
          Panel Hermes
        </span>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Sugiere */}
        <div>
          <div className="label" style={{ marginBottom: 8 }}>
            Hermes sugiere
          </div>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--ai-soft)",
              border: "1px solid #5A2D8622",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--ink-2)",
            }}
          >
            {sugerencia}
            {requiereDecision && (
              <div
                style={{
                  display: "flex",
                  gap: 7,
                  alignItems: "flex-start",
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid #5A2D8622",
                }}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: 15, color: "var(--ai)", flexShrink: 0, marginTop: 1 }}
                >
                  pan_tool
                </span>
                <span style={{ fontSize: 12, color: "var(--ai)", fontWeight: 600 }}>
                  Hermes detectó una decisión requerida:{" "}
                  <span style={{ fontWeight: 500, color: "var(--ink-2)" }}>{motivoDecision}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Historial reciente */}
        {recentHistory.length > 0 && (
          <div>
            <div
              className="label"
              style={{ marginBottom: 8, fontSize: 9.5, letterSpacing: "0.06em" }}
            >
              HISTORIAL RECIENTE · GMAIL + WHATSAPP
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentHistory.map((h, i) => {
                const color = h.canal === "mail" ? "var(--accent)" : "#2F8F43";
                const isIncoming = !h.fromMe;
                const isEsperando = h.estado === "esperando" || isIncoming;
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "18px 1fr auto",
                      gap: 9,
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: isEsperando
                        ? "var(--warn-soft)"
                        : h.fromMe
                          ? "var(--ok-soft)"
                          : "transparent",
                      border: isEsperando ? "1px solid #B4501E1A" : "1px solid transparent",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 15, color }}>
                      {h.canal === "mail" ? "mail" : "chat"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h.fromMe && (
                          <span style={{ color: "var(--ink-4)", fontWeight: 600 }}>→ </span>
                        )}
                        {h.snippet}
                      </div>
                      {isEsperando && (
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "var(--warn)",
                            marginTop: 2,
                          }}
                        >
                          Esperando tu respuesta
                        </div>
                      )}
                    </div>
                    <span
                      className="mono meta"
                      style={{
                        fontSize: 11,
                        whiteSpace: "nowrap",
                        alignSelf: "start",
                        marginTop: 2,
                      }}
                    >
                      {h.hace}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PPS anteriores */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span className="label">PPS anteriores con esta institución</span>
            <button
              onClick={onVerGestion}
              className="btn btn-ghost btn-sm press"
              style={{ fontSize: 11, color: "var(--ai)", padding: 4 }}
            >
              Ver en Gestión
              <span className="material-icons" style={{ fontSize: 13, marginLeft: 3 }}>
                open_in_new
              </span>
            </button>
          </div>
          {loadingPps ? (
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>
              Buscando antecedente...
            </div>
          ) : ppsAnteriores.length > 0 ? (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {ppsAnteriores.map((p, i) => {
                const year = p.fecha_inicio ? new Date(p.fecha_inicio).getFullYear() : "—";
                const cohorte =
                  p.fecha_inicio && new Date(p.fecha_inicio).getMonth() > 5
                    ? `${year}-2`
                    : `${year}-1`;
                return (
                  <div
                    key={i}
                    style={{
                      flexShrink: 0,
                      width: 150,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--rule-2)",
                      background: "var(--paper-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        className="mono"
                        style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}
                      >
                        {cohorte}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: p.estado === "Finalizado" ? "var(--ok)" : "var(--warn)",
                        }}
                      >
                        {p.estado}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.4 }}>
                      {p.especialidad || "General"}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic" }}>
              No se registran PPS previas con esta institución.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PanelHermesIngreso;
