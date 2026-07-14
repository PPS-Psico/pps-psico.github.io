// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · Línea de tiempo + Reporte ejecutivo (Paper & Ink)
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import {
  useMetricsTimeline,
  useReportLaunches,
  useSinPpsDetail,
  useYtdFlows,
  useNewAgreements,
  ytdCutoff,
} from "../../../hooks/useMetricsExtras";
import type {
  TimelineEvent,
  DinamicaCiclo,
  ReportLaunch,
  SinPpsDetail,
  YtdFlows,
  NewAgreement,
  OrientKey,
} from "../../../hooks/useMetricsExtras";
import type { MetricsKPIs } from "../../../hooks/useMetricsData";
import { getGroupName } from "../../../utils/formatters";
import { fmt, ORIENT_VAR } from "./MetricasPrimitives";

const TONE_VAR: Record<string, string> = {
  accent: "var(--accent)",
  warn: "var(--warn)",
  ok: "var(--ok)",
  ai: "var(--ai)",
  ink: "var(--ink)",
};
const ICON: Record<TimelineEvent["tipo"], string> = {
  lanzamiento: "rocket_launch",
  inscripcion: "how_to_reg",
  seleccion: "task_alt",
  inicio: "play_circle",
  cierre: "verified",
  convenio: "handshake",
};

// ── LÍNEA DE TIEMPO ─────────────────────────────────────────────────────────
export function TimelineView({ year, isTestingMode }: { year: number; isTestingMode?: boolean }) {
  const { data: events = [], isLoading } = useMetricsTimeline({ year, isTestingMode });

  return (
    <section style={{ padding: "32px 0 0" }}>
      <div style={{ marginBottom: 8 }}>
        <span className="eyebrow">Cómo se movió el ciclo {year}</span>
        <h2
          className="display"
          style={{ margin: "6px 0 0", fontSize: 30, letterSpacing: "-0.01em", lineHeight: 1 }}
        >
          Línea de tiempo del programa
        </h2>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 28 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="sk" style={{ height: 56 }} />
          ))}
        </div>
      )}

      {!isLoading && events.length === 0 && (
        <p className="meta" style={{ marginTop: 28, padding: "40px 0", textAlign: "center" }}>
          Sin hitos registrados para el ciclo {year}.
        </p>
      )}

      {!isLoading && events.length > 0 && (
        <div style={{ position: "relative", marginTop: 28, paddingLeft: 4 }}>
          <div
            style={{
              position: "absolute",
              left: 19,
              top: 6,
              bottom: 6,
              width: 1,
              background: "var(--rule-2)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {events.map((e, i) => {
              const c = TONE_VAR[e.tone] || "var(--ink)";
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr",
                    gap: 18,
                    alignItems: "flex-start",
                    padding: "12px 0",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      justifyContent: "center",
                      paddingTop: 2,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: `color-mix(in oklab, ${c} 13%, var(--paper))`,
                        color: c,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--paper)",
                        zIndex: 1,
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>
                        {ICON[e.tipo] || "circle"}
                      </span>
                    </span>
                  </div>
                  <div style={{ minWidth: 0, paddingBottom: 4 }}>
                    <div
                      style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}
                    >
                      <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: c }}>
                        {e.fecha}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                        {e.titulo}
                      </span>
                    </div>
                    <div className="meta" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.45 }}>
                      {e.detalle}
                    </div>
                    {e.items && e.items.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 10,
                        }}
                      >
                        {e.items.map((it, j) => (
                          <span
                            key={j}
                            className="tl-chip"
                            style={{
                              ["--chip" as string]: c,
                            }}
                          >
                            {it}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── REPORTE EJECUTIVO · documento imprimible ────────────────────────────────

const ORIENT_LABEL: Record<OrientKey, string> = {
  clinica: "Clínica",
  educacional: "Educacional",
  laboral: "Laboral",
  comunitaria: "Comunitaria",
  sindefinir: "Sin definir",
};
// Orden categórico fijo: la misma orientación conserva siempre el mismo color
// y la misma posición, no se recicla según qué haya en el año.
const ORIENT_ORDER: OrientKey[] = [
  "clinica",
  "educacional",
  "laboral",
  "comunitaria",
  "sindefinir",
];
const MESES_LARGOS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];
const diaMes = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")} ${MESES_CORTOS[d.getUTCMonth()]}`;

// Cabecera de sección numerada, estilo editorial.
function SecHead({ num, title, meta }: { num: string; title: string; meta?: string }) {
  return (
    <div className="exec-sec-head">
      <span className="exec-sec-num mono">{num}</span>
      <span className="exec-sec-title">{title}</span>
      {meta && <span className="exec-sec-meta mono">{meta}</span>}
    </div>
  );
}

// Cifra del reporte con referencia al año anterior (factual, sin juicio de valor).
function ExecStat({
  value,
  label,
  ctx,
  prev,
  prevYear,
  big,
}: {
  value: number;
  label: string;
  ctx?: string;
  prev?: number | null;
  prevYear?: number;
  big?: boolean;
}) {
  const diff = prev != null ? value - prev : null;
  return (
    <div className="exec-stat">
      <div className={`mono exec-num${big ? " big" : ""}`}>{fmt(value)}</div>
      <div className="exec-stat-label">{label}</div>
      {ctx && <div className="exec-stat-ctx">{ctx}</div>}
      {prev != null && prevYear != null && (
        <div className="exec-prev mono">
          {prevYear}: {fmt(prev)}
          {diff != null && diff !== 0 && (
            <>
              {" "}
              · {diff > 0 ? "+" : "−"}
              {fmt(Math.abs(diff))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Foco: análisis de los estudiantes sin ninguna PPS — a cuántas convocatorias
// se anotaron y a cuáles, para distinguir "no consigue lugar" de "no se postula".
function SinPpsFocus({
  students,
  isLoading,
  year,
}: {
  students: SinPpsDetail[];
  isLoading: boolean;
  year: number;
}) {
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1].map((i) => (
          <div key={i} className="sk" style={{ height: 40 }} />
        ))}
      </div>
    );
  }
  if (!students.length) {
    return (
      <p className="meta" style={{ fontStyle: "italic" }}>
        No hay estudiantes sin práctica registrada.
      </p>
    );
  }

  // Lectura rápida generada a partir de los datos.
  const sinPost = students.filter((s) => s.postulacionesYear === 0).length;
  const pocas = students.filter((s) => s.postulacionesYear > 0 && s.postulacionesYear <= 3).length;
  const yaSel = students.filter((s) => s.seleccionado).length;
  const partes: string[] = [];
  if (sinPost > 0)
    partes.push(
      `${fmt(sinPost)} no se ${sinPost === 1 ? "postuló" : "postularon"} a ninguna convocatoria en ${year}`
    );
  if (pocas > 0)
    partes.push(`${fmt(pocas)} se ${pocas === 1 ? "postuló" : "postularon"} a 3 o menos`);
  if (yaSel > 0)
    partes.push(
      `${fmt(yaSel)} ya ${yaSel === 1 ? "quedó seleccionado" : "quedaron seleccionados"}, con práctica por iniciar`
    );

  return (
    <div>
      {partes.length > 0 && (
        <p className="exec-note">
          <span style={{ fontWeight: 700, color: "var(--ink-2)" }}>Lectura rápida:</span>{" "}
          {partes.join(" · ")}.
        </p>
      )}
      <div className="exec-table-wrap">
        <table className="exec-table exec-table-sinpps">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th className="num">Postulaciones {year}</th>
              <th className="num">Históricas</th>
              <th>Convocatorias a las que se anotó</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.legajo}>
                <td className="exec-t-name">
                  {s.nombre}
                  <span className="exec-t-legajo mono"> {s.legajo}</span>
                </td>
                <td className="num mono">
                  {s.postulacionesYear === 0 ? (
                    <span style={{ color: "var(--warn)", fontWeight: 600 }}>0</span>
                  ) : (
                    fmt(s.postulacionesYear)
                  )}
                </td>
                <td className="num mono">{fmt(s.postulacionesTotal)}</td>
                <td className="exec-t-list">
                  {s.seleccionado && <span className="exec-sel-chip">Seleccionado</span>}
                  {s.convocatorias.length ? s.convocatorias.join(" · ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="exec-footnote">
        Snapshot al día de emisión: alumnos activos del sistema sin ninguna práctica registrada.
        «Seleccionado» indica que ya tiene cupo asignado y la práctica aún no se cargó.
      </p>
    </div>
  );
}

// Distribución de la oferta por orientación: barra apilada + leyenda con
// etiqueta y cifras (la identidad nunca depende solo del color).
function OrientBar({ launches }: { launches: ReportLaunch[] }) {
  const total = launches.length;
  if (!total) return null;
  const dist = ORIENT_ORDER.map((k) => {
    const of = launches.filter((l) => l.orient === k);
    return {
      key: k,
      label: ORIENT_LABEL[k],
      n: of.length,
      cupos: of.reduce((a, l) => a + l.cupos, 0),
    };
  }).filter((d) => d.n > 0);

  return (
    <div>
      <div
        className="exec-bar"
        role="img"
        aria-label={`Distribución de ${total} convocatorias por orientación: ${dist
          .map((d) => `${d.label} ${d.n}`)
          .join(", ")}`}
      >
        {dist.map((d) => (
          <span key={d.key} style={{ flexGrow: d.n, background: ORIENT_VAR[d.key] }} />
        ))}
      </div>
      <div className="exec-legend">
        {dist.map((d) => (
          <span key={d.key} className="exec-legend-item">
            <span className="exec-dot" style={{ background: ORIENT_VAR[d.key] }} />
            <span>{d.label}</span>
            <span className="mono exec-legend-n">
              {fmt(d.n)} · {Math.round((d.n / total) * 100)}% · {fmt(d.cupos)} cupos
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Anexo: convocatorias efectivas del año, agrupadas por mes de inicio, con
// subtotales por mes y totales del ciclo. Los lanzamientos sin postulaciones
// (cargas de prueba) se excluyen y se informan en la nota al pie.
function LaunchAnnex({
  launches,
  excluded,
  isLoading,
  year,
}: {
  launches: ReportLaunch[];
  excluded: number;
  isLoading: boolean;
  year: number;
}) {
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk" style={{ height: 44 }} />
        ))}
      </div>
    );
  }
  if (!launches.length) {
    return (
      <p className="meta" style={{ fontStyle: "italic" }}>
        Sin convocatorias registradas para el ciclo {year}.
      </p>
    );
  }

  const groups = new Map<number, ReportLaunch[]>();
  launches.forEach((l) => {
    const m = l.fechaInicio ? l.fechaInicio.getUTCMonth() : 12;
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m)!.push(l);
  });
  const months = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  const tot = launches.reduce(
    (a, l) => ({
      cupos: a.cupos + l.cupos,
      post: a.post + l.postulaciones,
      sel: a.sel + l.seleccionados,
    }),
    { cupos: 0, post: 0, sel: 0 }
  );
  const hayEstimados = launches.some((l) => l.selEstimado);

  return (
    <div className="exec-table-wrap">
      <table className="exec-table">
        <thead>
          <tr>
            <th>Convocatoria</th>
            <th>Orientación</th>
            <th className="num">Inicio</th>
            <th className="num">Horas</th>
            <th className="num">Cupos</th>
            <th className="num">Postulaciones</th>
            <th className="num">Seleccionados</th>
          </tr>
        </thead>
        <tbody>
          {months.map(([m, rows]) => {
            const sub = rows.reduce(
              (a, l) => ({
                cupos: a.cupos + l.cupos,
                post: a.post + l.postulaciones,
                sel: a.sel + l.seleccionados,
              }),
              { cupos: 0, post: 0, sel: 0 }
            );
            return (
              <React.Fragment key={m}>
                <tr className="exec-mes">
                  <td colSpan={4}>
                    {m === 12 ? "Sin fecha de inicio" : MESES_LARGOS[m]}
                    <span className="exec-mes-n">
                      {" "}
                      · {rows.length} {rows.length === 1 ? "convocatoria" : "convocatorias"}
                    </span>
                  </td>
                  <td className="num mono">{fmt(sub.cupos)}</td>
                  <td className="num mono">{fmt(sub.post)}</td>
                  <td className="num mono">{fmt(sub.sel)}</td>
                </tr>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="exec-t-name">{l.nombre}</td>
                    <td>
                      <span className="exec-t-orient">
                        <span className="exec-dot" style={{ background: ORIENT_VAR[l.orient] }} />
                        {ORIENT_LABEL[l.orient]}
                      </span>
                    </td>
                    <td className="num mono">{l.fechaInicio ? diaMes(l.fechaInicio) : "—"}</td>
                    <td className="num mono">{l.horas != null ? fmt(l.horas) : "—"}</td>
                    <td className="num mono">{fmt(l.cupos)}</td>
                    <td className="num mono">{fmt(l.postulaciones)}</td>
                    <td className="num mono">
                      {l.seleccionados ? (
                        <>
                          {fmt(l.seleccionados)}
                          {l.selEstimado && <span title="Estimado por cupos ofrecidos">*</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="exec-total">
            <td colSpan={4}>
              Total del ciclo · {launches.length}{" "}
              {launches.length === 1 ? "convocatoria" : "convocatorias"}
            </td>
            <td className="num mono">{fmt(tot.cupos)}</td>
            <td className="num mono">{fmt(tot.post)}</td>
            <td className="num mono">{fmt(tot.sel)}</td>
          </tr>
        </tfoot>
      </table>
      {(hayEstimados || excluded > 0) && (
        <p className="exec-footnote">
          {hayEstimados && (
            <>
              * Convocatorias ya iniciadas sin estado de selección asentado en el sistema: se estima
              por los cupos ofrecidos (nunca más que las postulaciones).
            </>
          )}
          {hayEstimados && excluded > 0 && <br />}
          {excluded > 0 && (
            <>
              Se {excluded === 1 ? "excluyó" : "excluyeron"} {fmt(excluded)}{" "}
              {excluded === 1 ? "lanzamiento" : "lanzamientos"} sin postulaciones (cargas de prueba
              o internas).
            </>
          )}
        </p>
      )}
    </div>
  );
}

// Lista de orientaciones con punto de color + etiqueta (la identidad no depende
// sólo del color).
function OrientList({ orientaciones }: { orientaciones: OrientKey[] }) {
  if (!orientaciones.length) return <span className="exec-stat-ctx">—</span>;
  return (
    <span
      style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "2px 10px" }}
    >
      {orientaciones.map((o) => (
        <span key={o} className="exec-t-orient">
          <span className="exec-dot" style={{ background: ORIENT_VAR[o] }} />
          {ORIENT_LABEL[o]}
        </span>
      ))}
    </span>
  );
}

// Ficha de convenios nuevos: institución, orientación, PPS lanzadas y cupos
// ofrecidos. Dato para las gestiones (qué instituciones nuevas suman capacidad).
function NewAgreementsTable({
  agreements,
  isLoading,
  year,
}: {
  agreements: NewAgreement[];
  isLoading: boolean;
  year: number;
}) {
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1].map((i) => (
          <div key={i} className="sk" style={{ height: 40 }} />
        ))}
      </div>
    );
  }
  if (!agreements.length) {
    return (
      <p className="meta" style={{ fontStyle: "italic" }}>
        Sin convenios nuevos registrados en {year}.
      </p>
    );
  }
  const totalPps = agreements.reduce((s, a) => s + a.pps, 0);
  const totalCupos = agreements.reduce((s, a) => s + a.cupos, 0);

  return (
    <div className="exec-table-wrap">
      <table className="exec-table">
        <thead>
          <tr>
            <th>Institución</th>
            <th>Orientación</th>
            <th className="num">PPS lanzadas</th>
            <th className="num">Cupos ofrecidos</th>
          </tr>
        </thead>
        <tbody>
          {agreements.map((a) => (
            <tr key={a.institucion}>
              <td className="exec-t-name">{a.institucion}</td>
              <td>
                <OrientList orientaciones={a.orientaciones} />
              </td>
              <td className="num mono">{a.pps ? fmt(a.pps) : "—"}</td>
              <td className="num mono">
                {a.cupoIlimitado ? "Ilimitado" : a.cupos ? fmt(a.cupos) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="exec-total">
            <td colSpan={2}>
              Total · {agreements.length}{" "}
              {agreements.length === 1 ? "institución" : "instituciones"}
            </td>
            <td className="num mono">{fmt(totalPps)}</td>
            <td className="num mono">{fmt(totalCupos)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Tabla comparativa entre dos años (A = más antiguo, B = más reciente).
function ComparativeTable({
  rows,
  yearA,
  yearB,
}: {
  rows: { label: string; a: number; b: number }[];
  yearA: number;
  yearB: number;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr 1fr 1.1fr",
          borderTop: "1px solid var(--rule-2)",
        }}
      >
        {/* Header */}
        <div className="label" style={{ padding: "10px 8px" }}>
          Indicador
        </div>
        <div className="label mono" style={{ padding: "10px 8px", textAlign: "right" }}>
          {yearA}
        </div>
        <div className="label mono" style={{ padding: "10px 8px", textAlign: "right" }}>
          {yearB}
        </div>
        <div className="label" style={{ padding: "10px 8px", textAlign: "right" }}>
          Variación
        </div>

        {rows.map((r) => {
          const diff = r.b - r.a;
          const pct = r.a > 0 ? Math.round((diff / r.a) * 100) : null;
          const color = diff > 0 ? "var(--ok)" : diff < 0 ? "var(--warn)" : "var(--ink-3)";
          const sign = diff > 0 ? "+" : "";
          return (
            <React.Fragment key={r.label}>
              <div
                style={{
                  padding: "12px 8px",
                  borderTop: "1px solid var(--rule-2)",
                  fontSize: 13.5,
                  color: "var(--ink)",
                }}
              >
                {r.label}
              </div>
              <div
                className="mono"
                style={{
                  padding: "12px 8px",
                  borderTop: "1px solid var(--rule-2)",
                  textAlign: "right",
                  fontSize: 15,
                  color: "var(--ink-2)",
                }}
              >
                {fmt(r.a)}
              </div>
              <div
                className="mono"
                style={{
                  padding: "12px 8px",
                  borderTop: "1px solid var(--rule-2)",
                  textAlign: "right",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                {fmt(r.b)}
              </div>
              <div
                className="mono"
                style={{
                  padding: "12px 8px",
                  borderTop: "1px solid var(--rule-2)",
                  textAlign: "right",
                  fontSize: 13,
                  color,
                }}
              >
                {diff === 0 ? "—" : `${sign}${fmt(diff)}${pct !== null ? ` (${sign}${pct}%)` : ""}`}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// Celda de variación (Δ) con color: verde sube, ámbar baja, guion si igual.
function DeltaCell({ a, b }: { a: number; b: number }) {
  const d = b - a;
  const color = d > 0 ? "var(--ok)" : d < 0 ? "var(--warn)" : "var(--ink-4)";
  const txt = d === 0 ? "—" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}`;
  return (
    <td className="num mono" style={{ color }}>
      {txt}
    </td>
  );
}

// Detalle mes a mes de PPS lanzadas y estudiantes seleccionados, comparando dos
// años. Usamos seleccionados (no cupos ofrecidos) para reflejar cuántos
// estudiantes realmente ocuparon un lugar mes a mes. Si el año B está en curso
// se corta en el mes actual (comparación pareja); si ambos ya cerraron, se
// muestran los 12 meses. En ambos casos se recortan meses vacíos al inicio/fin.
function MonthByMonth({
  launchesA,
  launchesB,
  yearA,
  yearB,
  bInProgress,
  cutoffMonth,
}: {
  launchesA: ReportLaunch[];
  launchesB: ReportLaunch[];
  yearA: number;
  yearB: number;
  bInProgress: boolean;
  cutoffMonth: number;
}) {
  const accByMonth = (arr: ReportLaunch[]) => {
    const m = Array.from({ length: 12 }, () => ({ pps: 0, sel: 0 }));
    arr.forEach((l) => {
      if (!l.fechaInicio) return;
      const mo = l.fechaInicio.getUTCMonth();
      m[mo].pps += 1;
      m[mo].sel += l.seleccionados;
    });
    return m;
  };
  const A = accByMonth(launchesA);
  const B = accByMonth(launchesB);

  let lo = 0;
  let hi = bInProgress ? Math.min(cutoffMonth, 11) : 11;
  while (lo < hi && A[lo].pps === 0 && B[lo].pps === 0) lo++;
  while (hi > lo && A[hi].pps === 0 && B[hi].pps === 0) hi--;

  const rowMonths: number[] = [];
  for (let m = lo; m <= hi; m++) rowMonths.push(m);

  const sum = (arr: { pps: number; sel: number }[], key: "pps" | "sel") =>
    rowMonths.reduce((s, m) => s + arr[m][key], 0);
  const totals = {
    ppsA: sum(A, "pps"),
    ppsB: sum(B, "pps"),
    selA: sum(A, "sel"),
    selB: sum(B, "sel"),
  };

  if (rowMonths.length === 0) {
    return (
      <p className="meta" style={{ fontStyle: "italic" }}>
        Sin convocatorias registradas en ninguno de los dos ciclos.
      </p>
    );
  }

  return (
    <div className="exec-table-wrap">
      <table className="exec-table exec-monthly">
        <thead>
          <tr>
            <th>Mes</th>
            <th className="num">PPS {yearA}</th>
            <th className="num">PPS {yearB}</th>
            <th className="num">Δ</th>
            <th className="num sep">Seleccionados {yearA}</th>
            <th className="num">Seleccionados {yearB}</th>
            <th className="num">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rowMonths.map((m) => (
            <tr key={m}>
              <td className="exec-t-name">{MESES_LARGOS[m]}</td>
              <td className="num mono">{A[m].pps ? fmt(A[m].pps) : "—"}</td>
              <td className="num mono">{B[m].pps ? fmt(B[m].pps) : "—"}</td>
              <DeltaCell a={A[m].pps} b={B[m].pps} />
              <td className="num mono sep">{A[m].sel ? fmt(A[m].sel) : "—"}</td>
              <td className="num mono">{B[m].sel ? fmt(B[m].sel) : "—"}</td>
              <DeltaCell a={A[m].sel} b={B[m].sel} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="exec-total">
            <td>{bInProgress ? "Acumulado a la fecha" : "Total del año"}</td>
            <td className="num mono">{fmt(totals.ppsA)}</td>
            <td className="num mono">{fmt(totals.ppsB)}</td>
            <DeltaCell a={totals.ppsA} b={totals.ppsB} />
            <td className="num mono sep">{fmt(totals.selA)}</td>
            <td className="num mono">{fmt(totals.selB)}</td>
            <DeltaCell a={totals.selA} b={totals.selB} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ExecutiveReport({
  year,
  metrics,
  prevMetrics = null,
  dinamica,
  isTestingMode = false,
  compareEnabled = false,
  compareYear,
  yearOptions = [],
  metricsB = null,
  dinamicaB = null,
  onToggleCompare,
  onCompareYearChange,
}: {
  year: number;
  metrics: MetricsKPIs;
  prevMetrics?: MetricsKPIs | null;
  dinamica?: DinamicaCiclo | null;
  isTestingMode?: boolean;
  compareEnabled?: boolean;
  compareYear?: number;
  yearOptions?: number[];
  metricsB?: MetricsKPIs | null;
  dinamicaB?: DinamicaCiclo | null;
  onToggleCompare?: (v: boolean) => void;
  onCompareYearChange?: (y: number) => void;
}) {
  const now = new Date();
  const today = now.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const todayShort = now.toLocaleDateString("es-AR", { day: "2-digit", month: "long" });
  // Comparativo activo: hay segundo año elegido, distinto, y datos cargados.
  const comparing =
    compareEnabled && !!metricsB && compareYear !== undefined && compareYear !== year;
  // En el comparativo ordenamos cronológicamente: A = más antiguo, B = más reciente.
  const yA = comparing ? Math.min(year, compareYear as number) : year;
  const yB = comparing ? Math.max(year, compareYear as number) : year;
  const mA = comparing ? (year < (compareYear as number) ? metrics : metricsB!) : metrics;
  const mB = comparing ? (year < (compareYear as number) ? metricsB! : metrics) : metrics;
  const dA = comparing ? (year < (compareYear as number) ? dinamica : dinamicaB) : dinamica;
  const dB = comparing ? (year < (compareYear as number) ? dinamicaB : dinamica) : dinamica;

  // Anexo: detalle de convocatorias del año principal (solo balance anual).
  const { data: launches = [], isLoading: launchesLoading } = useReportLaunches({
    year,
    isTestingMode,
  });
  // Convocatorias efectivas: excluimos lanzamientos sin ninguna postulación ni
  // selección (cargas de prueba o internas). El anexo lo aclara al pie.
  const realLaunches = launches.filter((l) => l.postulaciones > 0 || l.seleccionados > 0);
  const excludedLaunches = launches.length - realLaunches.length;

  // Comparativo: lanzamientos del OTRO año (mes a mes + oferta acumulada YTD).
  const { data: launchesCmp = [] } = useReportLaunches({
    year: compareYear ?? year,
    isTestingMode: isTestingMode || !comparing,
  });
  const realLaunchesCmp = launchesCmp.filter((l) => l.postulaciones > 0 || l.seleccionados > 0);
  // Orden cronológico A (más antiguo) / B (más reciente), igual que las métricas.
  const olderIsMain = comparing && year < (compareYear as number);
  const launchesA = olderIsMain ? realLaunches : realLaunchesCmp;
  const launchesB = olderIsMain ? realLaunchesCmp : realLaunches;

  // Flujos acumulados al mismo día (se piden siempre que hay comparación).
  const ytdEnabled = comparing;
  const { data: ytdMain } = useYtdFlows({ year, isTestingMode: isTestingMode || !ytdEnabled });
  const { data: ytdCmp } = useYtdFlows({
    year: compareYear ?? year,
    isTestingMode: isTestingMode || !ytdEnabled,
  });
  const ytdFlowsA: YtdFlows | undefined = olderIsMain ? ytdMain : ytdCmp;
  const ytdFlowsB: YtdFlows | undefined = olderIsMain ? ytdCmp : ytdMain;

  // Oferta acumulada al mismo día del calendario en cada año.
  const cutA = launchesA.filter((l) => l.fechaInicio && l.fechaInicio < ytdCutoff(yA, now));
  const cutB = launchesB.filter((l) => l.fechaInicio && l.fechaInicio < ytdCutoff(yB, now));
  const instCount = (arr: ReportLaunch[]) => new Set(arr.map((l) => getGroupName(l.nombre))).size;
  const cuposSum = (arr: ReportLaunch[]) => arr.reduce((s, l) => s + l.cupos, 0);
  const ytdRows: { label: string; a: number; b: number }[] = [
    { label: "PPS lanzadas", a: cutA.length, b: cutB.length },
    { label: "Cupos ofrecidos", a: cuposSum(cutA), b: cuposSum(cutB) },
    { label: "Instituciones activas", a: instCount(cutA), b: instCount(cutB) },
    ...(ytdFlowsA && ytdFlowsB
      ? [
          { label: "Alumnos que se postularon", a: ytdFlowsA.postulados, b: ytdFlowsB.postulados },
          {
            label: "Postulaciones totales",
            a: ytdFlowsA.postulaciones,
            b: ytdFlowsB.postulaciones,
          },
          { label: "Finalizados", a: ytdFlowsA.finalizados, b: ytdFlowsB.finalizados },
        ]
      : []),
  ];

  // Foco: detalle de los estudiantes sin ninguna PPS.
  const { data: sinPpsStudents = [], isLoading: sinPpsLoading } = useSinPpsDetail({
    year,
    isTestingMode,
  });

  // Convenios nuevos con su oferta (orientación + cupos), para ambos años.
  const { data: agreementsMain = [], isLoading: agreementsLoading } = useNewAgreements({
    year,
    isTestingMode,
  });
  const { data: agreementsCmp = [], isLoading: agreementsCmpLoading } = useNewAgreements({
    year: compareYear ?? year,
    isTestingMode: isTestingMode || !comparing,
  });
  const agreementsA = olderIsMain ? agreementsMain : agreementsCmp;
  const agreementsB = olderIsMain ? agreementsCmp : agreementsMain;
  const agreementsALoading = olderIsMain ? agreementsLoading : agreementsCmpLoading;
  const agreementsBLoading = olderIsMain ? agreementsCmpLoading : agreementsLoading;

  // Referencia al año anterior: solo si hay datos reales de ese ciclo.
  const prevOk =
    !comparing &&
    !!prevMetrics &&
    (prevMetrics.matricula_activa > 0 ||
      prevMetrics.pps_lanzadas > 0 ||
      prevMetrics.alumnos_finalizados > 0);
  const prev = (k: keyof MetricsKPIs): number | null =>
    prevOk ? (prevMetrics![k] as number) : null;

  // Filas para la tabla comparativa (todas las métricas duras comparables).
  const compareRows: { label: string; a: number; b: number }[] = comparing
    ? [
        { label: "Estudiantes en PPS", a: mA.estudiantes_en_pps, b: mB.estudiantes_en_pps },
        { label: "Ingresantes (cohorte)", a: mA.matricula_generada, b: mB.matricula_generada },
        { label: "Finalizados", a: mA.alumnos_finalizados, b: mB.alumnos_finalizados },
        { label: "Matrícula activa", a: mA.matricula_activa, b: mB.matricula_activa },
        { label: "Haciendo PPS", a: mA.haciendo_pps, b: mB.haciendo_pps },
        { label: "PPS lanzadas", a: mA.pps_lanzadas, b: mB.pps_lanzadas },
        {
          label: "Instituciones activas",
          a: mA.instituciones_activas,
          b: mB.instituciones_activas,
        },
        { label: "Cupos ofrecidos", a: mA.cupos_ofrecidos, b: mB.cupos_ofrecidos },
        { label: "Nuevos convenios", a: mA.nuevos_convenios, b: mB.nuevos_convenios },
        ...(dA && dB
          ? [
              { label: "Alumnos que se postularon", a: dA.postulados, b: dB.postulados },
              { label: "Postulaciones totales", a: dA.postulaciones, b: dB.postulaciones },
            ]
          : []),
      ]
    : [];

  return (
    <section className="exec-report" style={{ padding: "32px 0 0" }}>
      {/* — Control de comparación (no se imprime) — */}
      {onToggleCompare && (
        <div
          className="no-print"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "12px 16px",
            marginBottom: 18,
            border: "1px solid var(--rule-2)",
            borderRadius: 12,
            background: "var(--paper-2)",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => onToggleCompare(e.target.checked)}
            />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
              Comparar dos años
            </span>
          </label>
          {compareEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="meta" style={{ fontSize: 12.5 }}>
                {year} vs.
              </span>
              <select
                value={compareYear}
                onChange={(e) => onCompareYearChange?.(Number(e.target.value))}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              >
                {yearOptions
                  .filter((y) => y !== year)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div>
          <span className="eyebrow">Para imprimir o llevar a reunión</span>
          <h2
            className="display"
            style={{ margin: "6px 0 0", fontSize: 30, letterSpacing: "-0.01em", lineHeight: 1 }}
          >
            {comparing ? `Reporte comparativo · ${yA} vs ${yB}` : `Reporte ejecutivo · ${year}`}
          </h2>
        </div>
        <button className="btn btn-primary press" onClick={() => window.print()} type="button">
          <span className="material-icons" style={{ fontSize: 17 }}>
            print
          </span>
          Imprimir / PDF
        </button>
      </div>

      {/* — La hoja — */}
      <div className="exec-sheet">
        <header className="exec-head">
          <div className="exec-head-row">
            <span className="exec-kicker">Coordinación de PPS · UFLO Psicología</span>
            <span className="exec-kicker">
              {comparing ? "Reporte comparativo" : "Reporte ejecutivo"}
            </span>
          </div>
          <h3 className="display exec-title">Estado del programa de PPS</h3>
          <div className="exec-head-meta mono">
            <span>{comparing ? `Ciclos lectivos ${yA} · ${yB}` : `Ciclo lectivo ${year}`}</span>
            <span>Emitido el {today}</span>
          </div>
        </header>

        {comparing ? (
          <>
            <p className="exec-deck">
              Comparación de los ciclos <strong>{yA}</strong> y <strong>{yB}</strong>: primero el
              balance de <strong>año completo</strong> y, debajo, el acumulado{" "}
              <strong>al mismo día ({todayShort})</strong>, para una referencia pareja cuando un
              ciclo todavía está en curso.
            </p>
            <section className="exec-sec exec-keep">
              <SecHead num="01" title="Indicadores · año completo" meta={`${yA} → ${yB}`} />
              <ComparativeTable rows={compareRows} yearA={yA} yearB={yB} />
            </section>
            <section className="exec-sec exec-keep">
              <SecHead num="02" title="Indicadores · al mismo día" meta={`al ${todayShort}`} />
              <ComparativeTable rows={ytdRows} yearA={yA} yearB={yB} />
              <p className="exec-footnote">
                Acumulado hasta el {todayShort} de cada año. Sólo se incluyen métricas de flujo (se
                acumulan con el tiempo); las de stock —matrícula activa, estudiantes en PPS,
                haciendo PPS— no admiten un corte al mismo día y sólo figuran en el balance de año
                completo (arriba).
              </p>
            </section>
            <section className="exec-sec">
              <SecHead num="03" title="Estudiantes en PPS, mes a mes" meta={`${yA} vs ${yB}`} />
              <MonthByMonth
                launchesA={launchesA}
                launchesB={launchesB}
                yearA={yA}
                yearB={yB}
                bInProgress={yB === now.getFullYear()}
                cutoffMonth={now.getMonth()}
              />
              <p className="exec-footnote">
                Convocatorias efectivas por mes de inicio (excluye lanzamientos sin postulaciones).
                «Seleccionados» = estudiantes que ocuparon un cupo (no los cupos ofrecidos; dato
                real o, si falta, estimado por postulaciones). Δ = {yB} menos {yA}.
              </p>
            </section>
            <section className="exec-sec">
              <SecHead
                num="04"
                title="Convenios nuevos · ficha por institución"
                meta={`${yA} · ${yB}`}
              />
              <p
                className="label"
                style={{ margin: "10px 0 6px" }}
              >{`${yA} — ${agreementsA.length} ${agreementsA.length === 1 ? "institución" : "instituciones"}`}</p>
              <NewAgreementsTable
                agreements={agreementsA}
                isLoading={agreementsALoading}
                year={yA}
              />
              <p
                className="label"
                style={{ margin: "20px 0 6px" }}
              >{`${yB} — ${agreementsB.length} ${agreementsB.length === 1 ? "institución" : "instituciones"}`}</p>
              <NewAgreementsTable
                agreements={agreementsB}
                isLoading={agreementsBLoading}
                year={yB}
              />
              <p className="exec-footnote">
                Instituciones con convenio firmado en cada ciclo y la oferta que trajeron:
                orientación, PPS lanzadas y cupos ofrecidos.
                {[...agreementsA, ...agreementsB].some((a) => a.cupoIlimitado) &&
                  " Fundación Tiempo y Ulloa ofrecen cupo casi ilimitado: figuran como «Ilimitado» y no suman al total de cupos."}
              </p>
            </section>
          </>
        ) : (
          <>
            <p className="exec-deck">
              Durante el ciclo {year},{" "}
              <strong>{fmt(metrics.estudiantes_en_pps)} estudiantes</strong> transitaron su práctica
              profesional supervisada. Se lanzaron{" "}
              <strong>{fmt(metrics.pps_lanzadas)} convocatorias</strong> en{" "}
              <strong>{fmt(metrics.instituciones_activas)} instituciones</strong>, con{" "}
              <strong>{fmt(metrics.cupos_ofrecidos)} cupos ofrecidos</strong> y{" "}
              <strong>{fmt(metrics.nuevos_convenios)} convenios nuevos</strong> incorporados a la
              red.
            </p>

            <section className="exec-sec exec-keep">
              <SecHead num="01" title="Matrícula" />
              <div className="exec-stats exec-stats-3">
                <ExecStat
                  big
                  value={metrics.estudiantes_en_pps}
                  label="Estudiantes en PPS"
                  ctx="Con práctica este año"
                  prev={prev("estudiantes_en_pps")}
                  prevYear={year - 1}
                />
                <ExecStat
                  big
                  value={metrics.alumnos_finalizados}
                  label="Finalizados"
                  ctx="Acreditaciones cerradas"
                  prev={prev("alumnos_finalizados")}
                  prevYear={year - 1}
                />
                <ExecStat
                  big
                  value={metrics.matricula_activa}
                  label="Matrícula activa"
                  ctx="Alumnos en el sistema"
                  prev={prev("matricula_activa")}
                  prevYear={year - 1}
                />
              </div>
            </section>

            <section className="exec-sec exec-keep">
              <SecHead num="02" title="Seguimiento de estudiantes" />
              <div className="exec-stats exec-stats-3">
                <ExecStat
                  value={metrics.sin_pps}
                  label="Sin ninguna PPS"
                  ctx="Todavía sin práctica registrada"
                  prev={prev("sin_pps")}
                  prevYear={year - 1}
                />
                <ExecStat
                  value={metrics.proximos_finalizar}
                  label="Próximos a finalizar"
                  ctx="Cerca de acreditar"
                  prev={prev("proximos_finalizar")}
                  prevYear={year - 1}
                />
                <ExecStat
                  value={metrics.haciendo_pps}
                  label="Haciendo PPS"
                  ctx="Con práctica en curso"
                  prev={prev("haciendo_pps")}
                  prevYear={year - 1}
                />
              </div>
            </section>

            {metrics.sin_pps > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead
                  num="03"
                  title="Foco · Estudiantes sin ninguna PPS"
                  meta={`${fmt(metrics.sin_pps)} ${metrics.sin_pps === 1 ? "estudiante" : "estudiantes"}`}
                />
                <SinPpsFocus students={sinPpsStudents} isLoading={sinPpsLoading} year={year} />
              </section>
            )}

            <section className="exec-sec exec-keep">
              <SecHead num="04" title="Red de instituciones" />
              <div className="exec-stats exec-stats-4">
                <ExecStat
                  value={metrics.pps_lanzadas}
                  label="PPS lanzadas"
                  ctx="Convocatorias del ciclo"
                  prev={prev("pps_lanzadas")}
                  prevYear={year - 1}
                />
                <ExecStat
                  value={metrics.instituciones_activas}
                  label="Instituciones activas"
                  ctx="Con convocatorias este año"
                  prev={prev("instituciones_activas")}
                  prevYear={year - 1}
                />
                <ExecStat
                  value={metrics.cupos_ofrecidos}
                  label="Cupos ofrecidos"
                  ctx="Plazas publicadas"
                  prev={prev("cupos_ofrecidos")}
                  prevYear={year - 1}
                />
                <ExecStat
                  value={metrics.nuevos_convenios}
                  label="Nuevos convenios"
                  ctx="Instituciones incorporadas"
                  prev={prev("nuevos_convenios")}
                  prevYear={year - 1}
                />
              </div>
            </section>

            {metrics.nuevos_convenios > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead
                  num="05"
                  title="Convenios nuevos · ficha por institución"
                  meta={`${fmt(metrics.nuevos_convenios)} ${metrics.nuevos_convenios === 1 ? "institución" : "instituciones"}`}
                />
                <NewAgreementsTable
                  agreements={agreementsMain}
                  isLoading={agreementsLoading}
                  year={year}
                />
                {agreementsMain.some((a) => a.cupoIlimitado) && (
                  <p className="exec-footnote">
                    Fundación Tiempo y Ulloa ofrecen cupo casi ilimitado: figuran como «Ilimitado» y
                    no suman al total de cupos.
                  </p>
                )}
              </section>
            )}

            {realLaunches.length > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead
                  num="06"
                  title="Orientación de la oferta"
                  meta={`${fmt(realLaunches.length)} convocatorias efectivas`}
                />
                <OrientBar launches={realLaunches} />
              </section>
            )}

            {dinamica && dinamica.postulados > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead num="07" title="Dinámica del ciclo" />
                <div className="exec-strip">
                  {[
                    {
                      v: `${dinamica.postulacionesPorAlumno}`,
                      label: `Postulaciones por alumno (${fmt(dinamica.postulaciones)} / ${fmt(dinamica.postulados)})`,
                    },
                    { v: fmt(dinamica.sinLugar), label: "Postulados sin lugar todavía" },
                    {
                      v: dinamica.concrecionPct == null ? "—" : `${dinamica.concrecionPct}%`,
                      label: `Concreción (${fmt(dinamica.conLugar)} de ${fmt(dinamica.postulados)} con lugar)`,
                    },
                  ].map((s, i) => (
                    <div key={i}>
                      <div className="mono exec-num" style={{ fontSize: 24 }}>
                        {s.v}
                      </div>
                      <div className="exec-stat-ctx" style={{ marginTop: 5 }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="exec-footnote">
                  «Sin lugar todavía» cuenta postulantes del año sin selección ni práctica iniciada;
                  incluye alumnos que ya hicieron PPS en ciclos anteriores, por eso no coincide con
                  «Sin ninguna PPS» (sección 03).
                </p>
              </section>
            )}

            <section className="exec-sec exec-annex">
              <SecHead
                num="A"
                title={`Anexo · Detalle de PPS lanzadas en ${year}`}
                meta={
                  realLaunches.length
                    ? `${fmt(realLaunches.length)} convocatorias · ${fmt(
                        realLaunches.reduce((a, l) => a + l.cupos, 0)
                      )} cupos`
                    : undefined
                }
              />
              <LaunchAnnex
                launches={realLaunches}
                excluded={excludedLaunches}
                isLoading={launchesLoading}
                year={year}
              />
            </section>
          </>
        )}

        <footer className="exec-foot">
          <span className="material-icons" style={{ fontSize: 14, color: "var(--ink-3)" }}>
            shield
          </span>
          <span className="exec-foot-note">
            Datos del sistema de gestión de PPS al {today}. Documento de circulación interna.
          </span>
          <span className="mono exec-foot-brand">Mi Panel Académico</span>
        </footer>
      </div>
    </section>
  );
}
