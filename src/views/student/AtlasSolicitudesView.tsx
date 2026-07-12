import React, { useMemo } from "react";
import "../../components/student/home/atlas/atlasHome.css";
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

interface AtlasSolicitudesViewProps {
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
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(f);
  if (!m) return f;
  return `${parseInt(m[1], 10)} ${MESES[parseInt(m[2], 10) - 1] ?? ""}`.trim();
};

function toneFor(status: string): "wait" | "info" | "ok" | "warn" {
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

const SolRow: React.FC<{ sol: SolicitudPPS }> = ({ sol }) => {
  const name = (sol[FIELD_EMPRESA_PPS_SOLICITUD] as string) || "Institución";
  const status = (sol[FIELD_ESTADO_PPS] as string) || "Pendiente";
  const sub = sol[FIELD_ULTIMA_ACTUALIZACION_PPS]
    ? `Actualizada ${fmtShort(sol[FIELD_ULTIMA_ACTUALIZACION_PPS])}`
    : "En gestión";
  return (
    <div className="ah-sol">
      <div>
        <div className="ah-sol__name">{name}</div>
        <div className="ah-sol__sub">{sub}</div>
      </div>
      <span className={`ah-badge ah-badge--${toneFor(status)}`}>
        <span className="dot" />
        {status}
      </span>
    </div>
  );
};

const AtlasSolicitudesView: React.FC<AtlasSolicitudesViewProps> = ({
  solicitudes,
  onCreateSolicitud,
  onRequestFinalization,
  criterios,
  finalizacionRequest,
  informeTasks = [],
}) => {
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
  const missingAccreditationItems = criterios
    ? [
        !criterios.cumpleHorasTotales,
        !criterios.cumpleRotacion,
        !criterios.cumpleHorasOrientacion,
        criterios.tienePracticasPendientes,
        hasPendingCorrections,
      ].filter(Boolean).length
    : 0;

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
    <div className="ah-root ah-unified">
      <section className="ah-main" aria-labelledby="student-solicitudes-title">
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
            <div className="ah-pagehead">
              <span className="eyebrow">Trámites y autogestión</span>
              <h1 id="student-solicitudes-title">
                Tus <em>solicitudes</em>.
              </h1>
              <p>Acá seguís el estado de cada trámite a medida que avanza con coordinación.</p>
            </div>

            {(onCreateSolicitud || onRequestFinalization) && (
              <div className="ah-actions">
                {onCreateSolicitud && (
                  <button
                    type="button"
                    className="ah-action ah-action--primary"
                    onClick={onCreateSolicitud}
                  >
                    <span
                      className="ah-action__ic"
                      style={{ background: "var(--primary-50)", color: "var(--primary-700)" }}
                    >
                      <span className="material-icons" style={{ fontSize: 22 }}>
                        add_business
                      </span>
                    </span>
                    <div>
                      <div className="ah-action__t">Nueva solicitud de PPS</div>
                      <div className="ah-action__d">
                        Proponé una institución nueva con 3 cupos o más
                      </div>
                    </div>
                    <span className="ah-action__arrow material-icons">arrow_forward</span>
                  </button>
                )}
                {onRequestFinalization && (
                  <button
                    type="button"
                    className={
                      "ah-action ah-action--secondary" +
                      (isAccreditationReady ? " is-ready" : " is-locked")
                    }
                    onClick={() => onRequestFinalization && onRequestFinalization()}
                  >
                    <span
                      className="ah-action__ic"
                      style={{
                        background: isAccreditationReady ? "var(--success-50)" : "var(--bg-sunken)",
                        color: isAccreditationReady ? "var(--success-500)" : "var(--fg-muted)",
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 22 }}>
                        {isAccreditationReady ? "verified" : "lock_clock"}
                      </span>
                    </span>
                    <div>
                      <div className="ah-action__top">
                        <div className="ah-action__t">Trámite de acreditación</div>
                        <span
                          className={
                            "ah-action__status" +
                            (isAccreditationReady ? " ah-action__status--ok" : "")
                          }
                        >
                          {isAccreditationReady
                            ? "Listo para iniciar"
                            : missingAccreditationItems > 0
                              ? `${missingAccreditationItems} pendiente${
                                  missingAccreditationItems === 1 ? "" : "s"
                                }`
                              : "Faltan requisitos"}
                        </span>
                      </div>
                      <div className="ah-action__d">
                        {isAccreditationReady
                          ? "Requisitos cumplidos. Iniciar cierre"
                          : "Faltan requisitos. Ver detalles"}
                      </div>
                    </div>
                    <span className="ah-action__arrow material-icons">arrow_forward</span>
                  </button>
                )}
              </div>
            )}

            {active.length > 0 && (
              <>
                <div className="ah-sechead">
                  <h6>Gestiones en curso</h6>
                  <span className="n">{String(active.length).padStart(2, "0")}</span>
                </div>
                <div className="ah-card">
                  <div className="ah-sols">
                    {active.map((sol) => (
                      <SolRow key={sol.id} sol={sol} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {history.length > 0 && (
              <details className="ah-details ah-details--solicitudes" open>
                <summary>
                  <span className="material-icons">chevron_right</span>
                  Historial ({history.length})
                </summary>
                <div className="ah-card" style={{ marginTop: 12 }}>
                  <div className="ah-sols">
                    {history.map((sol) => (
                      <SolRow key={sol.id} sol={sol} />
                    ))}
                  </div>
                </div>
              </details>
            )}

            {isEmpty && (
              <div className="ah-empty ah-empty--solicitudes" style={{ marginTop: 8 }}>
                <div className="ah-empty__ic">
                  <span className="material-icons" style={{ fontSize: 20 }}>
                    description
                  </span>
                </div>
                <div className="ah-empty__t">¿Querés proponer una institución nueva?</div>
                <p className="ah-empty__s">
                  La autogestión es únicamente para instituciones nuevas que no tengan convenio
                  activo con UFLO.
                </p>
                <ul className="ah-empty__requirements">
                  <li>Debe ofrecer al menos 3 cupos para estudiantes.</li>
                  <li>Debe contar con un/a profesional de Psicología que supervise la práctica.</li>
                </ul>
                <p className="ah-empty__hint">
                  Si cumple estas condiciones, usá “Nueva solicitud de PPS”. El trámite y sus
                  avances van a aparecer acá.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default AtlasSolicitudesView;
