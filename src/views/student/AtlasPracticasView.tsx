import React, { useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import "../../components/student/home/atlas/atlasHome.css";
import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
} from "../../constants";
import { useMoodleGradeSync } from "../../contexts/MoodleGradeSyncContext";
import type { CriteriosCalculados, Orientacion, Practica } from "../../types";
import { cleanDbValue, formatDate, normalizeStringForComparison } from "../../utils/formatters";
import { presentMoodleGrade } from "../../utils/moodleGradePresentation";
import { canShowPpsAssignmentSummary } from "../../components/student/PpsAssignmentSummary";
import {
  getPracticePresentationStatus,
  isPracticeActive,
  isPracticeComputable,
  isPracticeDisapproved,
} from "../../logic/studentRules";

interface AtlasPracticasViewProps {
  criterios: CriteriosCalculados;
  selectedOrientacion: Orientacion | "";
  practicas: Practica[];
  onRequestModificacion?: (practica: Practica) => void;
  onRequestNuevaPPS?: () => void;
  onViewAssignmentSummary?: (practica: Practica) => void;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MIN_HOURS_TARGET = 250;
const fmtShort = (raw?: unknown): string => {
  if (!raw) return "";
  const f = formatDate(raw as string);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(f);
  if (!m) return f;
  return `${parseInt(m[1], 10)} ${MESES[parseInt(m[2], 10) - 1] ?? ""}`.trim();
};
function areaVar(area: string): string {
  const a = normalizeStringForComparison(area);
  if (a.startsWith("cl")) return "var(--area-clinica)";
  if (a.startsWith("ed")) return "var(--area-educacional)";
  if (a.startsWith("co") || a.startsWith("so")) return "var(--area-comunitaria)";
  if (a.startsWith("la") || a.startsWith("tr")) return "var(--area-laboral, #c23b3f)";
  return "var(--primary-500)";
}

const ROTACION_OBJETIVO = 3;

const AtlasPracticasView: React.FC<AtlasPracticasViewProps> = ({
  criterios,
  selectedOrientacion,
  practicas,
  onRequestModificacion,
  onRequestNuevaPPS,
  onViewAssignmentSummary,
}) => {
  const { snapshotsByPractice } = useMoodleGradeSync();

  const hoursAcc = Math.round(criterios?.horasTotales || 0);
  const totalTarget = MIN_HOURS_TARGET;
  const pct = totalTarget > 0 ? Math.min(100, Math.round((hoursAcc / totalTarget) * 100)) : 0;
  const restHs = Math.max(0, totalTarget - hoursAcc);
  const excessHs = Math.max(0, hoursAcc - totalTarget);
  const areasCursadas = criterios?.orientacionesCursadasCount ?? 0;

  const segments = useMemo(() => {
    const map = new Map<string, number>();
    (practicas || []).forEach((p) => {
      if (!isPracticeComputable(p)) return;
      const area = (p[FIELD_ESPECIALIDAD_PRACTICAS] as string) || "";
      const hs = Number(p[FIELD_HORAS_PRACTICAS] || 0);
      if (!area || !hs) return;
      map.set(area.trim(), (map.get(area.trim()) || 0) + hs);
    });
    return Array.from(map.entries())
      .map(([area, hs]) => ({ area, hs }))
      .sort((a, b) => b.hs - a.hs);
  }, [practicas]);

  const rows = useMemo(
    () =>
      [...(practicas || [])].sort(
        (a, b) =>
          new Date((b[FIELD_FECHA_INICIO_PRACTICAS] as string) || 0).getTime() -
          new Date((a[FIELD_FECHA_INICIO_PRACTICAS] as string) || 0).getTime()
      ),
    [practicas]
  );

  // Requisitos de cursada (avance). El trámite de acreditación se inicia desde
  // Solicitudes; acá solo mostramos el progreso del estudiante.
  const reqsTotal = 3;
  const reqsCumplidos = [
    criterios.cumpleHorasTotales,
    criterios.cumpleRotacion,
    criterios.cumpleHorasOrientacion,
  ].filter(Boolean).length;

  // Celebración: confetti UFLO una sola vez por sesión cuando se cumplen los 3
  // requisitos cuantitativos de cursada. No implica acreditación final.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (reqsCumplidos < reqsTotal || celebratedRef.current) return;
    celebratedRef.current = true;
    try {
      if (window.sessionStorage?.getItem("pps_requisitos_cursada_celebrados") === "1") return;
      window.sessionStorage?.setItem("pps_requisitos_cursada_celebrados", "1");
    } catch {
      /* sessionStorage bloqueado — celebramos una vez por montaje */
    }
    confetti({
      particleCount: 90,
      spread: 72,
      startVelocity: 38,
      origin: { y: 0.7 },
      colors: ["#46253D", "#203B73", "#3CB88D", "#20C4A8"],
      scalar: 0.9,
      disableForReducedMotion: true,
    });
  }, [reqsCumplidos]);

  const notaCell = (p: Practica) => {
    const estado = normalizeStringForComparison((p[FIELD_ESTADO_PRACTICA] as string) || "");
    if (isPracticeDisapproved(estado)) {
      return <span className="ah-disapproval-grade">Desaprobada</span>;
    }
    const campusGrade = presentMoodleGrade(snapshotsByPractice.get(p.id));
    if (isPracticeActive(estado)) {
      return (
        <span className="nota" style={{ color: "var(--info-500)", fontSize: 12.5 }}>
          en curso
        </span>
      );
    }
    return (
      <span
        className={campusGrade?.hasGrade ? "nota" : "ah-nota__pending"}
        style={{
          color: campusGrade?.hasGrade ? "var(--success-500)" : "var(--fg-subtle)",
          fontSize: 12.5,
          fontFamily: "var(--font-mono)",
        }}
        title={campusGrade?.detail || "Todavía no hay datos sincronizados desde Campus"}
      >
        {campusGrade?.compact || "Pend."}
      </span>
    );
  };

  return (
    <div className="ah-root ah-unified">
      <section className="ah-main" aria-labelledby="student-practicas-title">
        <div className="ah-pagehead">
          <span className="eyebrow">Tu recorrido</span>
          <h1 id="student-practicas-title">
            Tus <em>prácticas</em>.
          </h1>
          <p>Tu avance de cursada y el historial de cada PPS.</p>
        </div>

        {/* ── Requisitos de cursada: progreso cuantitativo, sin inferir acreditación ── */}
        <div className="ah-accr-hero">
          <div className="ah-accr-hero__main">
            <div className="ah-accr__headline">
              <h2 className="ah-section-label">Requisitos de cursada</h2>
              {excessHs > 0 ? (
                <>
                  <span className="ah-accr__pct">Objetivo superado</span>
                  <span className="ah-accr__excess">+{excessHs} hs</span>
                </>
              ) : (
                <span className="ah-accr__pct">{pct}%</span>
              )}
              <span className="ah-accr__big" style={{ marginLeft: "auto", fontSize: 28 }}>
                {hoursAcc} <span className="den">/ {totalTarget} hs</span>
              </span>
            </div>

            <div
              className="ah-bar"
              role="img"
              aria-label={`${hoursAcc} de ${totalTarget} horas de cursada completadas`}
            >
              {segments.map((s) => (
                <div
                  key={s.area}
                  className="ah-bar__seg"
                  aria-hidden="true"
                  style={{ flexGrow: s.hs, ["--sc" as string]: areaVar(s.area) }}
                  title={`${s.area}: ${s.hs} hs`}
                >
                  <span className="tip">{s.hs}</span>
                </div>
              ))}
              {restHs > 0 ? (
                <div
                  className="ah-bar__seg rest"
                  aria-hidden="true"
                  style={{ flexGrow: restHs }}
                  title={`Restante: ${restHs} hs`}
                >
                  <span className="tip">{restHs} hs restantes</span>
                </div>
              ) : null}
            </div>

            <div className="ah-accr__legend">
              {segments.map((s) => (
                <span
                  key={s.area}
                  className="ah-leg"
                  style={{ ["--sc" as string]: areaVar(s.area) }}
                >
                  <span className="sw" />
                  <b>{s.area}</b>
                  {s.hs} hs
                </span>
              ))}
            </div>

            <p className="ah-accr__note" style={{ margin: "16px 0 0", marginLeft: 0 }}>
              {restHs > 0 ? (
                <>
                  Te faltan <b>{restHs} hs</b>
                  {!criterios.cumpleRotacion ? (
                    <>
                      {" "}
                      y completar <b>{Math.max(0, ROTACION_OBJETIVO - areasCursadas)} área</b>
                      {Math.max(0, ROTACION_OBJETIVO - areasCursadas) === 1 ? "" : "s"} de rotación
                    </>
                  ) : null}
                  .
                </>
              ) : (
                <>Alcanzaste las horas mínimas requeridas.</>
              )}
            </p>

            <div
              className="ah-accr-hero__orient"
              style={{ ["--ori" as string]: areaVar(selectedOrientacion || "") }}
            >
              <span className="ah-field__lbl">Tu orientación</span>
              <span className="ah-orient-readonly">
                <span className="ah-orient-readonly__sw" aria-hidden />
                {selectedOrientacion || "Definir en Mi Perfil"}
              </span>
            </div>
          </div>

          <div className="ah-accr-hero__side">
            <div className="ah-accr-hero__sidehead">
              <h2 className="ah-section-label">Resumen</h2>
              <span className={"ah-req__count" + (reqsCumplidos === reqsTotal ? " is-done" : "")}>
                {reqsCumplidos}/{reqsTotal}
              </span>
            </div>
            <Req
              done={criterios.cumpleHorasTotales}
              label={`${totalTarget} hs mínimas`}
              sub={`Llevás ${hoursAcc} hs`}
            />
            <Req
              done={criterios.cumpleRotacion}
              label="3 áreas distintas"
              sub={`${areasCursadas} de ${ROTACION_OBJETIVO} completas`}
            />
            <Req
              done={criterios.cumpleHorasOrientacion}
              label="Horas de tu orientación"
              sub={
                criterios.cumpleHorasOrientacion
                  ? "Cumplido"
                  : `Faltan ${Math.round(criterios.horasFaltantesOrientacion || 0)} hs`
              }
            />
          </div>
          <p className="ah-accr-hero__hint">
            <span className="material-icons" aria-hidden>
              {reqsCumplidos === reqsTotal ? "verified" : "info"}
            </span>
            <span>
              Este bloque resume horas, rotación y orientación. La acreditación final es un trámite
              separado y se gestiona desde <b>Solicitudes</b>.
            </span>
          </p>
        </div>

        {/* ── Mis prácticas: protagonista, ancho completo ── */}
        <div className="ah-practices-section">
          <div>
            <div className="ah-sechead">
              <div className="ah-sechead__title">
                <h2 className="ah-section-label">Mis prácticas</h2>
                <span className="n">{String(rows.length).padStart(2, "0")}</span>
              </div>
              {onRequestNuevaPPS ? (
                <button
                  type="button"
                  className="ah-btn ah-btn--secondary ah-btn--compact"
                  onClick={onRequestNuevaPPS}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>
                    add
                  </span>
                  Cargar una PPS realizada
                </button>
              ) : null}
            </div>
            {rows.length > 0 ? (
              <div className="ah-card ah-practices-table-card">
                <table className="ah-table">
                  <colgroup>
                    <col className="ah-table__col-name" />
                    <col className="ah-table__col-area" />
                    <col className="ah-table__col-period" />
                    <col className="ah-table__col-status" />
                    <col className="ah-table__col-hours" />
                    <col className="ah-table__col-grade" />
                    <col className="ah-table__col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Institución</th>
                      <th>Área</th>
                      <th>Período</th>
                      <th>Estado</th>
                      <th>Horas</th>
                      <th>Campus</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const area = (p[FIELD_ESPECIALIDAD_PRACTICAS] as string) || "General";
                      const desaprobada = isPracticeDisapproved(p[FIELD_ESTADO_PRACTICA]);
                      const presentationStatus = getPracticePresentationStatus(p);
                      const horasReales = Number(p[FIELD_HORAS_PRACTICAS] || 0);
                      // Mientras está en curso, mostramos al menos las horas que
                      // vale la PPS (piso informativo) sin tocar horas_realizadas,
                      // que sigue siendo lo que cuenta para la acreditación.
                      const horasMostradas = isPracticeActive(p[FIELD_ESTADO_PRACTICA])
                        ? Math.max(
                            horasReales,
                            Number((p as { horasObjetivo?: number | null }).horasObjetivo || 0)
                          )
                        : horasReales;
                      return (
                        <tr key={p.id}>
                          <td className="name">
                            <span>
                              {cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) ||
                                "Institución"}
                            </span>
                          </td>
                          <td className="area">
                            <span
                              className="ah-areabadge"
                              style={{ ["--ac" as string]: areaVar(area) }}
                            >
                              <span className="dot" />
                              {area}
                            </span>
                          </td>
                          <td className="mono period">
                            {[
                              fmtShort(p[FIELD_FECHA_INICIO_PRACTICAS]),
                              fmtShort(p[FIELD_FECHA_FIN_PRACTICAS]),
                            ]
                              .filter(Boolean)
                              .join(" - ")}
                          </td>
                          <td>
                            <span className={`ah-practice-status is-${presentationStatus.tone}`}>
                              <span className="dot" aria-hidden="true" />
                              {presentationStatus.label}
                            </span>
                          </td>
                          <td className="mono hours">
                            {desaprobada ? (
                              <span
                                className="ah-hours-not-counted"
                                title={`${horasReales} hs registradas; no computan para la acreditación`}
                              >
                                <b>0 hs</b>
                                <small>no computan</small>
                              </span>
                            ) : (
                              `${horasMostradas} hs`
                            )}
                          </td>
                          <td className="nota">{notaCell(p)}</td>
                          <td className="ah-table__actions" style={{ textAlign: "right" }}>
                            <div className="ah-row-actions">
                              {onViewAssignmentSummary && canShowPpsAssignmentSummary(p) ? (
                                <button
                                  type="button"
                                  className="ah-row-action ah-row-action--summary"
                                  title="Ver el resumen informativo imprimible"
                                  aria-label={`Ver resumen informativo de ${
                                    cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) ||
                                    "la práctica"
                                  }`}
                                  onClick={() => onViewAssignmentSummary(p)}
                                >
                                  <span
                                    className="material-icons"
                                    style={{ fontSize: 17 }}
                                    aria-hidden="true"
                                  >
                                    description
                                  </span>
                                  Resumen
                                </button>
                              ) : null}
                              {onRequestModificacion && !desaprobada ? (
                                <button
                                  type="button"
                                  className="ah-row-action"
                                  title="Solicitar corrección"
                                  aria-label={`Solicitar corrección de ${
                                    cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) ||
                                    "la práctica"
                                  }`}
                                  onClick={() => onRequestModificacion(p)}
                                >
                                  <span
                                    className="material-icons"
                                    style={{ fontSize: 17 }}
                                    aria-hidden="true"
                                  >
                                    edit
                                  </span>
                                  Corregir
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ah-empty">
                <div className="ah-empty__ic">
                  <span className="material-icons" style={{ fontSize: 20 }}>
                    work_history
                  </span>
                </div>
                <div className="ah-empty__t">Sin prácticas registradas</div>
                <p className="ah-empty__s">
                  Tu historial va a aparecer acá cuando ingreses mediante una convocatoria o cargues
                  una PPS que ya realizaste.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const Req: React.FC<{ done: boolean; label: string; sub: string }> = ({ done, label, sub }) => (
  <div className="ah-req" aria-label={`${label}: ${done ? "cumplido" : "pendiente"}. ${sub}`}>
    <span className={"ah-req__mk" + (done ? " on" : "")} aria-hidden="true">
      {done ? (
        <span className="material-icons" style={{ fontSize: 14 }}>
          check
        </span>
      ) : null}
    </span>
    <div>
      <div className="ah-req__lbl">{label}</div>
      <div className="ah-req__sub">{sub}</div>
    </div>
  </div>
);

export default AtlasPracticasView;
