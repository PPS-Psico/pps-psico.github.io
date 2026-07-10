import React, { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import "../../components/student/home/atlas/atlasHome.css";
import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOTA_PRACTICAS,
} from "../../constants";
import type { CriteriosCalculados, InformeTask, Orientacion, Practica } from "../../types";
import { cleanDbValue, formatDate, normalizeStringForComparison } from "../../utils/formatters";
import NotaSelector from "../../components/NotaSelector";

interface AtlasPracticasViewProps {
  criterios: CriteriosCalculados;
  selectedOrientacion: Orientacion | "";
  handleOrientacionChange: (o: Orientacion | "") => void;
  onRequestFinalization?: () => void;
  informeTasks?: InformeTask[];
  practicas: Practica[];
  handleNotaChange: (practicaId: string, nota: string) => void;
  onRequestModificacion?: (practica: Practica) => void;
  onRequestNuevaPPS?: () => void;
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
  if (a.startsWith("la") || a.startsWith("tr")) return "var(--area-laboral, #b4502a)";
  return "var(--primary-500)";
}

const ROTACION_OBJETIVO = 3;

const AtlasPracticasView: React.FC<AtlasPracticasViewProps> = ({
  criterios,
  selectedOrientacion,
  practicas,
  handleNotaChange,
  onRequestModificacion,
  onRequestNuevaPPS,
}) => {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect; current: string } | null>(null);

  const hoursAcc = Math.round(criterios?.horasTotales || 0);
  const totalTarget = MIN_HOURS_TARGET;
  const pct = totalTarget > 0 ? Math.min(100, Math.round((hoursAcc / totalTarget) * 100)) : 0;
  const restHs = Math.max(0, totalTarget - hoursAcc);
  const excessHs = Math.max(0, hoursAcc - totalTarget);
  const areasCursadas = criterios?.orientacionesCursadasCount ?? 0;

  const segments = useMemo(() => {
    const map = new Map<string, number>();
    (practicas || []).forEach((p) => {
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
  // requisitos de cursada. Comparte la marca de sesión con el panel mobile
  // (CriteriosPanel) para no festejar dos veces. Respeta prefers-reduced-motion.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (reqsCumplidos < reqsTotal || celebratedRef.current) return;
    celebratedRef.current = true;
    try {
      if (window.sessionStorage?.getItem("pps_acreditacion_celebrada") === "1") return;
      window.sessionStorage?.setItem("pps_acreditacion_celebrada", "1");
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

  const onLocalNota = async (id: string, nota: string) => {
    setMenu(null);
    setSavingId(id);
    await handleNotaChange(id, nota);
    setSavingId(null);
    setJustUpdated(id);
    setTimeout(() => setJustUpdated(null), 2000);
  };

  const notaCell = (p: Practica) => {
    const estado = normalizeStringForComparison((p[FIELD_ESTADO_PRACTICA] as string) || "");
    const raw = p[FIELD_NOTA_PRACTICAS];
    const num = raw != null && String(raw).trim() !== "" ? Number(raw) : NaN;
    let text = "Pend.";
    let color = "var(--fg-subtle)";
    if (estado.includes("curso")) {
      text = "en curso";
      color = "var(--info-500)";
    } else if (Number.isFinite(num)) {
      text = String(raw).trim();
      color = num >= 7 ? "var(--area-clinica)" : "var(--grade-caution, #b7791f)";
    }
    if (savingId === p.id) {
      return (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
          style={{ color: "var(--primary-500)" }}
        />
      );
    }
    if (justUpdated === p.id) {
      return (
        <span className="material-icons" style={{ color: "var(--success-500)", fontSize: 20 }}>
          check
        </span>
      );
    }
    const inCurso = estado.includes("curso");
    return inCurso ? (
      <span className="nota" style={{ color, fontSize: 12.5, fontFamily: "var(--font-mono)" }}>
        en curso
      </span>
    ) : (
      <button
        type="button"
        className="ah-nota"
        style={{ color }}
        title="Clic para editar la nota"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMenu({ id: p.id, rect, current: text });
        }}
      >
        {Number.isFinite(num) ? text : <span className="ah-nota__pending">{text}</span>}
      </button>
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
          <p>Historial de PPS y avance hacia la acreditación.</p>
        </div>

        {/* ── Tu acreditación: una sola tarjeta (progreso + requisitos + CTA) ── */}
        <div className="ah-accr-hero">
          <div className="ah-accr-hero__main">
            <div className="ah-accr__headline">
              <h6>Acreditación</h6>
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

            <div className="ah-bar">
              {segments.map((s) => (
                <div
                  key={s.area}
                  className="ah-bar__seg"
                  style={{ flexGrow: s.hs, ["--sc" as string]: areaVar(s.area) }}
                  title={`${s.area}: ${s.hs} hs`}
                >
                  <span className="tip">{s.hs}</span>
                </div>
              ))}
              {restHs > 0 ? (
                <div
                  className="ah-bar__seg rest"
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
              <h6>Requisitos</h6>
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
              Cuando completes todos los criterios y tus informes estén corregidos, vas a poder
              iniciar la acreditación desde <b>Solicitudes</b>.
            </span>
          </p>
        </div>

        {/* ── Mis prácticas: protagonista, ancho completo ── */}
        <div className="ah-practices-section">
          <div>
            <div className="ah-sechead">
              <div className="ah-sechead__title">
                <h6>Mis prácticas</h6>
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
                    <col className="ah-table__col-hours" />
                    <col className="ah-table__col-grade" />
                    <col className="ah-table__col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Institución</th>
                      <th>Área</th>
                      <th>Período</th>
                      <th>Horas</th>
                      <th>Nota</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const area = (p[FIELD_ESPECIALIDAD_PRACTICAS] as string) || "General";
                      return (
                        <tr key={p.id}>
                          <td className="name">
                            {cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) ||
                              "Institución"}
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
                          <td className="mono hours">{Number(p[FIELD_HORAS_PRACTICAS] || 0)} hs</td>
                          <td className="nota">{notaCell(p)}</td>
                          <td
                            className="ah-table__actions"
                            style={{ width: 40, textAlign: "right" }}
                          >
                            {onRequestModificacion ? (
                              <button
                                type="button"
                                className="ah-iconbtn--sm"
                                title="Solicitar corrección"
                                aria-label={`Solicitar corrección de ${
                                  cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) ||
                                  "la práctica"
                                }`}
                                onClick={() => onRequestModificacion(p)}
                              >
                                <span className="material-icons" style={{ fontSize: 17 }}>
                                  edit
                                </span>
                              </button>
                            ) : null}
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
                  Cuando completes tu primera PPS, tu historial y tus horas van a aparecer acá.
                </p>
              </div>
            )}
          </div>
        </div>

        {menu && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setMenu(null)} />
            <NotaSelector
              triggerRect={menu.rect}
              currentValue={menu.current}
              onSelect={(n) => onLocalNota(menu.id, n)}
              onClose={() => setMenu(null)}
            />
          </>
        )}
      </section>
    </div>
  );
};

const Req: React.FC<{ done: boolean; label: string; sub: string }> = ({ done, label, sub }) => (
  <div className="ah-req">
    <span className={"ah-req__mk" + (done ? " on" : "")}>
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
