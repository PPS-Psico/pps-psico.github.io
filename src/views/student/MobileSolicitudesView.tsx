import React, { useMemo } from "react";
import {
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTADO_PPS,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_ULTIMA_ACTUALIZACION_PPS,
} from "../../constants";
import type { CriteriosCalculados, FinalizacionPPS, InformeTask, SolicitudPPS } from "../../types";
import { formatDate, normalizeStringForComparison } from "../../utils/formatters";
import FinalizationStatusCard from "../../components/student/FinalizationStatusCard";
import { useTheme } from "../../contexts/ThemeContext";

interface MobileSolicitudesViewProps {
  solicitudes: SolicitudPPS[];
  onCreateSolicitud?: () => void;
  onRequestFinalization?: () => void;
  criterios?: CriteriosCalculados;
  finalizacionRequest?: FinalizacionPPS | null;
  informeTasks?: InformeTask[];
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtShort = (raw?: unknown): string => {
  if (!raw) return "";
  const f = formatDate(raw as string);
  const m = /^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/.exec(f);
  if (!m) return f;
  return `${parseInt(m[1], 10)} ${MESES[parseInt(m[2], 10) - 1] ?? ""}`.trim();
};

type Tone = "wait" | "info" | "ok" | "warn";
function toneFor(status: string): Tone {
  const s = normalizeStringForComparison(status);
  if (s.includes("curso") || s.includes("realizada") || s.includes("aprob")) return "ok";
  if (s.includes("entrev") || s.includes("selecc") || s.includes("revis")) return "info";
  if (
    s.includes("rech") ||
    s.includes("cancel") ||
    s.includes("no se pudo") ||
    s.includes("invalid")
  )
    return "warn";
  return "wait";
}

const TONE_STYLE: Record<Tone, { bg: string; color: string }> = {
  wait: {
    bg: "color-mix(in oklab, var(--area-laboral) 14%, transparent)",
    color: "var(--area-laboral)",
  },
  info: {
    bg: "color-mix(in oklab, var(--area-comunitaria) 14%, transparent)",
    color: "var(--area-comunitaria)",
  },
  ok: {
    bg: "color-mix(in oklab, var(--area-clinica) 16%, transparent)",
    color: "var(--area-clinica)",
  },
  warn: { bg: "color-mix(in oklab, #C0392B 14%, transparent)", color: "#C0392B" },
};

const SolRow: React.FC<{ sol: SolicitudPPS }> = ({ sol }) => {
  const name = (sol[FIELD_EMPRESA_PPS_SOLICITUD] as string) || "Institución";
  const status = (sol[FIELD_ESTADO_PPS] as string) || "Pendiente";
  const sub = sol[FIELD_ULTIMA_ACTUALIZACION_PPS]
    ? `Actualizada ${fmtShort(sol[FIELD_ULTIMA_ACTUALIZACION_PPS])}`
    : "En gestión";
  const st = TONE_STYLE[toneFor(status)];
  return (
    <div className="prow" style={{ alignItems: "center" }}>
      <div className="prow__bar" style={{ background: "var(--accent)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="prow__name">{name}</div>
        <div className="mono prow__dates">{sub}</div>
      </div>
      <span
        style={{
          padding: "5px 11px",
          background: st.bg,
          color: st.color,
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {status}
      </span>
    </div>
  );
};

const ActionRow: React.FC<{
  icon: string;
  title: string;
  desc: string;
  tone?: "accent" | "ok" | "muted";
  onClick?: () => void;
}> = ({ icon, title, desc, tone = "accent", onClick }) => {
  const ic =
    tone === "ok"
      ? {
          bg: "color-mix(in oklab, var(--area-clinica) 14%, transparent)",
          color: "var(--area-clinica)",
        }
      : tone === "muted"
        ? { bg: "var(--bg-sunken)", color: "var(--ink-muted)" }
        : { bg: "color-mix(in oklab, var(--accent) 14%, transparent)", color: "var(--accent)" };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        width: "100%",
        textAlign: "left",
        padding: 15,
        marginBottom: 10,
        borderRadius: 16,
        border: "1px solid var(--line)",
        background: "var(--bg-elevated)",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: ic.bg,
          color: ic.color,
        }}
      >
        <span className="material-icons" style={{ fontSize: 22 }}>
          {icon}
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>
          {desc}
        </span>
      </span>
      <span className="material-icons" style={{ color: "var(--ink-subtle)" }}>
        arrow_forward
      </span>
    </button>
  );
};

const MobileSolicitudesView: React.FC<MobileSolicitudesViewProps> = ({
  solicitudes,
  onCreateSolicitud,
  onRequestFinalization,
  criterios,
  finalizacionRequest,
  informeTasks = [],
}) => {
  const { resolvedTheme } = useTheme();

  const hasPendingCorrections = useMemo(
    () =>
      informeTasks.some(
        (t) =>
          t.informeSubido && (t.nota === "Sin calificar" || t.nota === "Entregado (sin corregir)")
      ),
    [informeTasks]
  );
  const isAccreditationReady = criterios
    ? criterios.cumpleHorasTotales &&
      criterios.cumpleRotacion &&
      criterios.cumpleHorasOrientacion &&
      !criterios.tienePracticasPendientes &&
      !hasPendingCorrections
    : false;

  const { active, history } = useMemo(() => {
    const a: SolicitudPPS[] = [];
    const h: SolicitudPPS[] = [];
    const finished = [
      "finalizada",
      "cancelada",
      "rechazada",
      "no se pudo concretar",
      "pps realizada",
      "solicitud invalida",
      "realizada",
    ];
    (solicitudes || []).forEach((sol) => {
      const status = normalizeStringForComparison(sol[FIELD_ESTADO_PPS] as string);
      if (status === "archivado") return;
      if (finished.some((s) => status.includes(s))) h.push(sol);
      else a.push(sol);
    });
    return { active: a, history: h };
  }, [solicitudes]);

  const isEmpty = active.length === 0 && history.length === 0 && !finalizacionRequest;

  return (
    <div
      className="ed"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{ minHeight: "60vh", background: "transparent" }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 18px 24px" }}>
        {finalizacionRequest ? (
          <FinalizationStatusCard
            status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || "Pendiente"}
            requestDate={
              finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] ||
              finalizacionRequest.created_at ||
              ""
            }
          />
        ) : (
          <>
            <div
              className="display"
              style={{ fontSize: 34, lineHeight: 0.95, letterSpacing: "-.04em", marginBottom: 6 }}
            >
              Solicitudes
            </div>
            <p
              className="mono"
              style={{
                margin: "0 0 22px",
                fontSize: 11.5,
                color: "var(--ink-muted)",
                letterSpacing: ".04em",
                textTransform: "uppercase",
              }}
            >
              {active.length} en proceso · {history.length} en historial
            </p>

            {onCreateSolicitud && (
              <ActionRow
                icon="add_business"
                title="Nueva solicitud de PPS"
                desc="Iniciá un trámite de autogestión"
                tone="accent"
                onClick={onCreateSolicitud}
              />
            )}
            {onRequestFinalization && (
              <ActionRow
                icon={isAccreditationReady ? "verified" : "lock_clock"}
                title="Trámite de acreditación"
                desc={
                  isAccreditationReady
                    ? "Requisitos cumplidos · iniciar cierre"
                    : "Faltan requisitos · ver detalles"
                }
                tone={isAccreditationReady ? "ok" : "muted"}
                onClick={onRequestFinalization}
              />
            )}

            {active.length > 0 && (
              <>
                <div className="eyebrow" style={{ fontSize: 11, marginTop: 22, display: "block" }}>
                  En proceso
                </div>
                <div style={{ marginTop: 6 }}>
                  {active.map((sol) => (
                    <SolRow key={sol.id} sol={sol} />
                  ))}
                </div>
              </>
            )}

            {history.length > 0 && (
              <details style={{ marginTop: 18 }}>
                <summary
                  className="mono"
                  style={{
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    padding: "6px 0",
                  }}
                >
                  Ver historial ({history.length})
                </summary>
                <div style={{ marginTop: 6 }}>
                  {history.map((sol) => (
                    <SolRow key={sol.id} sol={sol} />
                  ))}
                </div>
              </details>
            )}

            {isEmpty && (
              <div
                style={{
                  marginTop: 12,
                  textAlign: "center",
                  padding: "32px 16px",
                  border: "1px solid var(--line)",
                  borderRadius: 18,
                  background: "var(--bg-elevated)",
                }}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: 28, color: "var(--ink-subtle)" }}
                >
                  description
                </span>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginTop: 8 }}>
                  Sin solicitudes
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--ink-muted)",
                    margin: "6px 0 0",
                    lineHeight: 1.5,
                  }}
                >
                  No tenés trámites de PPS registrados. Cuando inicies una autogestión va a aparecer
                  acá con su estado.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MobileSolicitudesView;
