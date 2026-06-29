// ──────────────────────────────────────────────────────────────────────────
// HermesFlow — "Hoy": la ÚNICA bandeja del día del coordinador.
//
// Fusiona dos fuentes que antes vivían separadas:
//   1. El PLAN de Hermes (agent_suggestions tipo "accion_dia" vía /tasks/plan_today):
//      responder correos, reactivar solicitudes estancadas, verificar egresos.
//   2. El CICLO DE VIDA de las instituciones (lanzamientos_pps, derivado en el
//      CRM de Gestión): recontactar, reinsistir, PPS por finalizar, decisiones.
//
// Regla anti-duplicado: el contacto por ciclo de vida lo aportan SIEMPRE los
// lanzamientos (tienen mejor data + flujo de contacto), así que del plan se
// excluyen las acciones de "reinsistir/contactar institución" (se solapaban).
//
// Cada tarjeta es accionable: abre el panel/modal correcto sin salir de Gestión.
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getPlanDelDia,
  regenerarPlanDelDia,
  type AccionDia,
  type AccionTipo,
} from "../../../services/hermesPlan";
import type { GmailHilo } from "../../../hooks/useGmailHilos";
import { isValidWhatsAppFormat } from "../../../utils/formatters";

const META: Record<AccionTipo, { icon: string; label: string; cta: string }> = {
  responder_mail: { icon: "mail", label: "Responder correo", cta: "Responder" },
  mover_solicitud: { icon: "login", label: "Solicitud de ingreso", cta: "Gestionar" },
  verificar_finalizacion: { icon: "verified", label: "Verificar egreso", cta: "Verificar" },
  correccion: { icon: "edit_note", label: "Corrección", cta: "Revisar" },
};

const TONE: Record<string, string> = {
  alta: "var(--warn)",
  media: "var(--accent)",
  baja: "var(--ink-4)",
};

// ── Tipo de tarjeta común para fusionar plan + ciclo de vida ──────────────
export interface CardBadge {
  text: string;
  color: string;
  icon?: string;
}
export interface CardDescriptor {
  id: string;
  /** Menor = más arriba. plan alta=0, lifecycle urgente=1, plan media=2, etc. */
  rank: number;
  tone: string;
  icon: string;
  label: string;
  titulo: string;
  porQue: string;
  cta: string;
  badges: CardBadge[];
  onClick: () => void;
}

interface Props {
  hilos: GmailHilo[];
  isTestingMode?: boolean;
  onOpenMail: (h: GmailHilo) => void;
  /** Abrir el panel derecho de acción para una solicitud estancada. */
  onOpenSolicitud?: (a: AccionDia) => void;
  /** Tarjetas extra (ciclo de vida de instituciones) que arma GestionView. */
  extraCards?: CardDescriptor[];
}

export const HermesFlow: React.FC<Props> = ({
  hilos,
  isTestingMode = false,
  onOpenMail,
  onOpenSolicitud,
  extraCards = [],
}) => {
  const navigate = useNavigate();

  const {
    data: acciones = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["hermesPlanDia", isTestingMode],
    enabled: !isTestingMode,
    staleTime: 60 * 1000,
    queryFn: () => getPlanDelDia(isTestingMode),
  });

  const [regenerating, setRegenerating] = React.useState(false);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const regenerar = async () => {
    setRegenerating(true);
    setAviso(null);
    const res = await regenerarPlanDelDia(20);
    if (res.ok) {
      await refetch();
      if (res.acciones === 0 && extraCards.length === 0) {
        setAviso("Hermes revisó todo y no encontró gestiones urgentes para hoy.");
      }
    } else {
      setAviso(res.motivo);
    }
    setRegenerating(false);
  };

  const onAccion = (a: AccionDia) => {
    if (a.tipo === "responder_mail" && a.threadId) {
      const hilo = hilos.find((h) => h.thread_id === a.threadId);
      if (hilo) {
        onOpenMail(hilo);
        return;
      }
    }
    if (a.tipo === "mover_solicitud" && a.solicitud && onOpenSolicitud) {
      onOpenSolicitud(a);
      return;
    }
    navigate(a.link.replace(/^\/admin/, "/admin"));
  };

  // ── Construir la lista unificada ──────────────────────────────────────────
  const planCards: CardDescriptor[] = React.useMemo(() => {
    return acciones.map((a) => {
      const meta = META[a.tipo] || META.responder_mail;
      const badges: CardBadge[] = [];
      if (a.tieneBorrador) {
        // El canal que propone Hermes puede mentir: el backend usa una
        // heurística débil (regex de formato) y muchas veces marca
        // números como WhatsApp que no lo son. Re-validamos acá con
        // cleanWhatsAppNumber para que el badge NO prometa algo que el
        // panel no pueda abrir. Si el WhatsApp no es válido pero hay
        // email, se ofrece "Correo listo" (el panel hace fallback
        // automático a mail al abrirse).
        const tel = a.solicitud?.telefono || a.solicitud?.destino || "";
        const canalPropuesto = a.solicitud?.canal;
        const waReal = canalPropuesto === "whatsapp" && isValidWhatsAppFormat(tel);
        const hayMail = !!(a.solicitud?.email || a.solicitud?.destino);
        const badgeCanal: "whatsapp" | "email" | "borrador" = waReal
          ? "whatsapp"
          : canalPropuesto === "email" || (canalPropuesto === "whatsapp" && hayMail)
            ? "email"
            : "borrador";
        badges.push({
          text:
            badgeCanal === "whatsapp"
              ? "WhatsApp listo"
              : badgeCanal === "email"
                ? "Correo listo"
                : "Borrador listo",
          color: badgeCanal === "whatsapp" ? "var(--ok)" : "var(--ai)",
          icon:
            badgeCanal === "whatsapp" ? "chat" : badgeCanal === "email" ? "mail" : "auto_awesome",
        });
      }
      if (a.tipo === "mover_solicitud" && a.solicitud && a.solicitud.canal !== "ninguno") {
        badges.push({
          text: a.solicitud.esSeguimiento ? "Seguimiento" : "1er contacto",
          color: "var(--ink-3)",
        });
      }
      return {
        id: a.id,
        rank: a.prioridad === "alta" ? 0 : a.prioridad === "media" ? 2 : 4,
        tone: TONE[a.prioridad] || "var(--accent)",
        icon: meta.icon,
        label: meta.label,
        titulo: a.titulo,
        porQue: a.porQue,
        cta: meta.cta,
        badges,
        onClick: () => onAccion(a),
      };
    });
  }, [acciones, hilos, onAccion]);

  const cards: CardDescriptor[] = React.useMemo(() => {
    return [...planCards, ...extraCards].sort((a, b) => a.rank - b.rank);
  }, [planCards, extraCards]);

  const total = cards.length;
  const conBorrador = cards.filter((c) => c.badges.some((b) => b.text.includes("listo"))).length;

  return (
    <>
      <header style={{ padding: "22px 32px 18px", borderBottom: "1px solid var(--rule-2)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow" style={{ color: "var(--ai)" }}>
              <span
                className="material-icons"
                style={{ fontSize: 13, verticalAlign: "-2px", marginRight: 4 }}
              >
                auto_awesome
              </span>
              Hoy con Hermes
            </span>
            <h2
              className="serif"
              style={{
                margin: "6px 0 0",
                fontSize: 27,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {total === 0 ? "Todo al día" : `${total} ${total === 1 ? "cosa" : "cosas"} para hoy`}
            </h2>
            <div className="meta" style={{ marginTop: 6, fontSize: 13 }}>
              {total === 0
                ? "No hay gestiones pendientes para hoy. Podés regenerar el plan."
                : conBorrador > 0
                  ? `Hermes priorizó tu día. ${conBorrador} ${conBorrador === 1 ? "tarea ya tiene" : "tareas ya tienen"} borrador listo.`
                  : "Correos, solicitudes e instituciones — todo lo de hoy en un solo lugar."}
            </div>
            {aviso && (
              <div
                role="status"
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 7,
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  color: "var(--warn)",
                  background: "color-mix(in oklab, var(--warn) 9%, var(--paper))",
                  border: "1px solid color-mix(in oklab, var(--warn) 30%, var(--rule-2))",
                  borderRadius: 10,
                  padding: "8px 11px",
                  maxWidth: 520,
                }}
              >
                <span className="material-icons" style={{ fontSize: 15, marginTop: 1 }}>
                  info
                </span>
                <span>{aviso}</span>
              </div>
            )}
          </div>
          {!isTestingMode && (
            <button
              onClick={regenerar}
              disabled={regenerating || isFetching}
              className="press"
              title="Hermes revisa correos, solicitudes, egresos e instituciones y arma tu plan del día"
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border: "1px solid color-mix(in oklab, var(--ai) 35%, var(--rule-2))",
                background: "color-mix(in oklab, var(--ai) 8%, var(--paper))",
                color: "var(--ai)",
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: regenerating ? "default" : "pointer",
                opacity: regenerating ? 0.7 : 1,
              }}
            >
              <span
                className={`material-icons${regenerating ? " animate-spin" : ""}`}
                style={{ fontSize: 16 }}
              >
                {regenerating ? "progress_activity" : "auto_awesome"}
              </span>
              {regenerating ? "Pensando…" : "Replanificar día"}
            </button>
          )}
        </div>
      </header>

      <div style={{ padding: "18px 32px 64px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 70, borderRadius: 14, background: "var(--paper-2)" }} />
            ))}
          </div>
        ) : total === 0 ? (
          <div style={{ padding: "70px 0", textAlign: "center", color: "var(--ink-3)" }}>
            <span className="material-icons" style={{ fontSize: 44, color: "var(--ok)" }}>
              task_alt
            </span>
            <div
              className="serif"
              style={{ marginTop: 12, fontSize: 19, fontWeight: 700, color: "var(--ink-2)" }}
            >
              Día despejado
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-3)" }}>
              No hay correos, solicitudes ni instituciones que reclamen tu atención hoy.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cards.map((c, idx) => (
              <button
                key={c.id}
                onClick={c.onClick}
                className="press"
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px 36px 1fr auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  width: "100%",
                  transition: "all .12s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--rule-3)";
                  e.currentTarget.style.background = "var(--paper-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--rule-2)";
                  e.currentTarget.style.background = "var(--paper)";
                }}
              >
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: c.tone }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `color-mix(in oklab, ${c.tone} 13%, var(--paper))`,
                    color: c.tone,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 19 }}>
                    {c.icon}
                  </span>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "var(--ink-4)",
                      }}
                    >
                      {c.label}
                    </span>
                    {c.badges.map((b, bi) => (
                      <span
                        key={bi}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10,
                          fontWeight: 700,
                          color: b.color,
                          background:
                            b.color === "var(--ink-3)"
                              ? "var(--paper-2)"
                              : `color-mix(in oklab, ${b.color} 13%, var(--paper))`,
                          border: b.color === "var(--ink-3)" ? "1px solid var(--rule-2)" : "none",
                          padding: "1px 7px",
                          borderRadius: 999,
                        }}
                      >
                        {b.icon && (
                          <span className="material-icons" style={{ fontSize: 11 }}>
                            {b.icon}
                          </span>
                        )}
                        {b.text}
                      </span>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.titulo}
                  </div>
                  <div className="meta" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
                    {c.porQue}
                  </div>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {c.cta}
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    arrow_forward
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default HermesFlow;
