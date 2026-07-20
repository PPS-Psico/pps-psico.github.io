// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · Línea de tiempo + Reporte ejecutivo (Paper & Ink)
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useMetricsTimeline,
  useReportLaunches,
  useSinPpsDetail,
  useYtdFlows,
  useNewAgreements,
  useTrayectoriaFinalizados,
  useTiempoSeleccion,
  ytdCutoff,
} from "../../../hooks/useMetricsExtras";
import { fetchConveniosKpis } from "../../../services/conveniosService";
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

// Cifra del reporte con referencia al año anterior. El chip de variación se
// colorea según su lectura (goodWhenDown la invierte; neutralDelta lo deja sin
// juicio, para stocks sin corte pareja) y prevLabel explicita la base de
// comparación ("2025 al 17 de julio:", "cierre 2025:").
function ExecStat({
  value,
  display,
  label,
  ctx,
  prev,
  prevYear,
  prevLabel,
  goodWhenDown,
  neutralDelta,
  big,
}: {
  value: number;
  /** Texto ya formateado para mostrar en lugar de fmt(value) (ej. "78%" o "3,4"). */
  display?: string;
  label: string;
  ctx?: string;
  prev?: number | null;
  prevYear?: number;
  /** Texto de la base de referencia; por defecto `${prevYear}:`. */
  prevLabel?: string;
  /** La baja es buena noticia (ej. "Sin ninguna PPS"): invierte el color. */
  goodWhenDown?: boolean;
  /** Referencia sin corte pareja (stocks): chip sin color. */
  neutralDelta?: boolean;
  big?: boolean;
}) {
  const diff = prev != null ? value - prev : null;
  const toneClass =
    diff == null || diff === 0
      ? " flat"
      : neutralDelta
        ? ""
        : diff > 0 !== !!goodWhenDown
          ? " ok"
          : " warn";
  return (
    <div className="exec-stat">
      <div className={`mono exec-num${big ? " big" : ""}`}>{display ?? fmt(value)}</div>
      <div className="exec-stat-label">{label}</div>
      {ctx && <div className="exec-stat-ctx">{ctx}</div>}
      {prev != null && (prevYear != null || prevLabel) && diff != null && (
        <div className="exec-delta-row">
          <span className={`exec-delta mono${toneClass}`}>
            {diff === 0 ? "=" : diff > 0 ? `↑ ${fmt(diff)}` : `↓ ${fmt(Math.abs(diff))}`}
          </span>
          <span className="exec-delta-ref mono">
            {prevLabel ?? `${prevYear}:`} {fmt(prev)}
          </span>
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
        Foto al día de emisión: estudiantes activos sin prácticas y con al menos una postulación PPS
        en {year}. «Seleccionado» indica que ya tiene cupo asignado y la práctica aún no se cargó.
      </p>
    </div>
  );
}

// Distribución de la oferta por orientación: barra apilada + leyenda con
// etiqueta y cifras (la identidad nunca depende solo del color).
function OrientBar({ launches }: { launches: ReportLaunch[] }) {
  const total = launches.length;
  if (!total) return null;
  // Solo composición (n y %): los cupos se informan en la tabla de presión por
  // orientación, que excluye ilimitadas — acá inflarían (Ulloa 200, FT 107).
  const dist = ORIENT_ORDER.map((k) => {
    const of = launches.filter((l) => l.orient === k);
    return {
      key: k,
      label: ORIENT_LABEL[k],
      n: of.length,
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
              {fmt(d.n)} · {Math.round((d.n / total) * 100)}%
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
      cupos: a.cupos + l.capacidadOperativa,
      post: a.post + l.postulaciones,
      sel: a.sel + l.seleccionados,
    }),
    { cupos: 0, post: 0, sel: 0 }
  );
  const historicalOfferSource = launches.some((l) => l.source === "historical_documented_offer");
  const demandAvailable = launches.every((l) => l.demandAvailable);
  const hayCapacidadRealizada = launches.some(
    (l) => l.source === "operational_launch" && l.modalidadCupo === "realizado"
  );

  return (
    <div className="exec-table-wrap">
      <table className="exec-table">
        <thead>
          <tr>
            <th>{historicalOfferSource ? "Oferta PPS" : "Convocatoria"}</th>
            <th>Orientación</th>
            <th className="num">{historicalOfferSource ? "Publicación" : "Inicio"}</th>
            <th className="num">Horas</th>
            <th className="num">Capacidad</th>
            <th className="num">Postulaciones</th>
            <th className="num">Seleccionados</th>
          </tr>
        </thead>
        <tbody>
          {months.map(([m, rows]) => {
            const sub = rows.reduce(
              (a, l) => ({
                cupos: a.cupos + l.capacidadOperativa,
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
                  <td className="num mono">{demandAvailable ? fmt(sub.post) : "—"}</td>
                  <td className="num mono">{demandAvailable ? fmt(sub.sel) : "—"}</td>
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
                    <td className="num mono">
                      {l.source === "historical_documented_offer" && l.modalidadCupo !== "fijo"
                        ? "—"
                        : fmt(l.capacidadOperativa)}
                      {l.modalidadCupo === "realizado" && (
                        <span title="Capacidad realizada: estudiantes seleccionados"> †</span>
                      )}
                    </td>
                    <td className="num mono">{l.demandAvailable ? fmt(l.postulaciones) : "—"}</td>
                    <td className="num mono">
                      {l.demandAvailable && l.seleccionados ? fmt(l.seleccionados) : "—"}
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
              {historicalOfferSource
                ? launches.length === 1
                  ? "oferta documentada"
                  : "ofertas documentadas"
                : launches.length === 1
                  ? "convocatoria"
                  : "convocatorias"}
            </td>
            <td className="num mono">{fmt(tot.cupos)}</td>
            <td className="num mono">{demandAvailable ? fmt(tot.post) : "—"}</td>
            <td className="num mono">{demandAvailable ? fmt(tot.sel) : "—"}</td>
          </tr>
        </tfoot>
      </table>
      {(historicalOfferSource || hayCapacidadRealizada || excluded > 0) && (
        <p className="exec-footnote">
          {historicalOfferSource && (
            <>
              Fuente histórica documental: una fila por oferta publicada y fecha de publicación. La
              capacidad suma únicamente vacantes finitas; la demanda y los seleccionados por oferta
              no están disponibles de forma confiable.
            </>
          )}
          {historicalOfferSource && (hayCapacidadRealizada || excluded > 0) && <br />}
          {hayCapacidadRealizada && (
            <>
              † Capacidad realizada: se informa la cantidad de estudiantes efectivamente
              seleccionados, no el cupo técnico almacenado.
            </>
          )}
          {hayCapacidadRealizada && excluded > 0 && <br />}
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
            <th className="num">Capacidad operativa</th>
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
              <td className="num mono">{a.cupos ? fmt(a.cupos) : "—"}</td>
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
  rows: { label: string; a: number; b: number; comparable?: boolean }[];
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
          const color =
            r.comparable === false
              ? "var(--ink-4)"
              : diff > 0
                ? "var(--ok)"
                : diff < 0
                  ? "var(--warn)"
                  : "var(--ink-3)";
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
                {r.comparable === false
                  ? "n/c"
                  : diff === 0
                    ? "—"
                    : `${sign}${fmt(diff)}${pct !== null ? ` (${sign}${pct}%)` : ""}`}
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
  const selectionComparable =
    launchesA.every((launch) => launch.demandAvailable) &&
    launchesB.every((launch) => launch.demandAvailable);
  const offerCountComparable =
    launchesA.some((launch) => launch.source === "historical_documented_offer") ===
    launchesB.some((launch) => launch.source === "historical_documented_offer");

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
              {offerCountComparable ? (
                <DeltaCell a={A[m].pps} b={B[m].pps} />
              ) : (
                <td className="num mono">n/c</td>
              )}
              <td className="num mono sep">
                {selectionComparable && A[m].sel ? fmt(A[m].sel) : "—"}
              </td>
              <td className="num mono">{selectionComparable && B[m].sel ? fmt(B[m].sel) : "—"}</td>
              {selectionComparable ? (
                <DeltaCell a={A[m].sel} b={B[m].sel} />
              ) : (
                <td className="num mono">—</td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="exec-total">
            <td>{bInProgress ? "Acumulado a la fecha" : "Total del año"}</td>
            <td className="num mono">{fmt(totals.ppsA)}</td>
            <td className="num mono">{fmt(totals.ppsB)}</td>
            {offerCountComparable ? (
              <DeltaCell a={totals.ppsA} b={totals.ppsB} />
            ) : (
              <td className="num mono">n/c</td>
            )}
            <td className="num mono sep">{selectionComparable ? fmt(totals.selA) : "—"}</td>
            <td className="num mono">{selectionComparable ? fmt(totals.selB) : "—"}</td>
            {selectionComparable ? (
              <DeltaCell a={totals.selA} b={totals.selB} />
            ) : (
              <td className="num mono">—</td>
            )}
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

  // Anexo: detalle de convocatorias del año principal (solo balance anual).
  const { data: launches = [], isLoading: launchesLoading } = useReportLaunches({
    year,
    isTestingMode,
  });
  // La oferta incluye toda PPS clasificada del ciclo, aun si no recibió demanda.
  const realLaunches = launches;
  const excludedLaunches = 0;
  const mainUsesHistoricalOfferSource = realLaunches.some(
    (launch) => launch.source === "historical_documented_offer"
  );

  // Comparativo: lanzamientos del OTRO año (mes a mes + oferta acumulada YTD).
  const { data: launchesCmp = [] } = useReportLaunches({
    year: compareYear ?? year,
    isTestingMode: isTestingMode || !comparing,
  });
  const realLaunchesCmp = launchesCmp;
  // Orden cronológico A (más antiguo) / B (más reciente), igual que las métricas.
  const olderIsMain = comparing && year < (compareYear as number);
  const launchesA = olderIsMain ? realLaunches : realLaunchesCmp;
  const launchesB = olderIsMain ? realLaunchesCmp : realLaunches;

  // Flujos acumulados al mismo día. En el comparativo alimentan la tabla
  // "al mismo día"; en el balance de un año EN CURSO, el ciclo anterior cortado
  // al mismo día es la base justa de los chips de variación (contra el año
  // completo, un ciclo a medio andar siempre daría a la baja).
  const yearInProgress = year === now.getFullYear();
  const { data: ytdMain } = useYtdFlows({
    year,
    fullYear: !comparing && !yearInProgress,
    isTestingMode,
  });
  const { data: ytdCmp } = useYtdFlows({
    year: compareYear ?? year,
    isTestingMode: isTestingMode || !comparing,
  });
  const { data: ytdPrevYear } = useYtdFlows({
    year: year - 1,
    fullYear: !yearInProgress,
    isTestingMode: isTestingMode || comparing,
  });
  const ytdFlowsA: YtdFlows | undefined = olderIsMain ? ytdMain : ytdCmp;
  const ytdFlowsB: YtdFlows | undefined = olderIsMain ? ytdCmp : ytdMain;

  // Lanzamientos del año anterior, para cortar la oferta al mismo día en el
  // balance anual (solo se piden con el ciclo en curso).
  const { data: launchesPrevRaw = [] } = useReportLaunches({
    year: year - 1,
    isTestingMode: isTestingMode || comparing || !yearInProgress,
  });

  // Oferta acumulada al mismo día del calendario en cada año. La capacidad
  // operativa suma cupos fijos y seleccionados reales en modalidad realizada.
  const cutA = launchesA.filter((l) => l.fechaInicio && l.fechaInicio < ytdCutoff(yA, now));
  const cutB = launchesB.filter((l) => l.fechaInicio && l.fechaInicio < ytdCutoff(yB, now));
  const instCount = (arr: ReportLaunch[]) => new Set(arr.map((l) => getGroupName(l.nombre))).size;
  const cuposSum = (arr: ReportLaunch[]) => arr.reduce((s, l) => s + l.capacidadOperativa, 0);
  const capacidadMain = ytdMain?.capacity.operational ?? cuposSum(realLaunches);
  const institucionesMain = instCount(realLaunches);
  const iniciaronMain = ytdMain?.enPps ?? metrics.estudiantes_en_pps;
  const finalizadosMain = ytdMain?.finalizados ?? metrics.alumnos_finalizados;
  const historicalCapacityInComparison =
    ytdFlowsA?.capacity.source === "historical_documented_offers" ||
    ytdFlowsB?.capacity.source === "historical_documented_offers";
  const offerComparisonIsComparable =
    ytdFlowsA?.capacity.comparable !== false && ytdFlowsB?.capacity.comparable !== false;
  const ytdRows: { label: string; a: number; b: number; comparable?: boolean }[] = [
    {
      label: historicalCapacityInComparison ? "Ofertas PPS publicadas" : "PPS lanzadas",
      a: ytdFlowsA?.capacity.launches ?? cutA.length,
      b: ytdFlowsB?.capacity.launches ?? cutB.length,
      comparable: offerComparisonIsComparable,
    },
    {
      label: historicalCapacityInComparison
        ? "Capacidad documentada mínima"
        : "Capacidad operativa",
      a: ytdFlowsA?.capacity.operational ?? cuposSum(cutA),
      b: ytdFlowsB?.capacity.operational ?? cuposSum(cutB),
      comparable: offerComparisonIsComparable,
    },
    { label: "Instituciones activas", a: instCount(cutA), b: instCount(cutB) },
    ...(ytdFlowsA && ytdFlowsB
      ? [
          ...(ytdFlowsA.demandaDisponible && ytdFlowsB.demandaDisponible
            ? [
                {
                  label: "Alumnos que se postularon",
                  a: ytdFlowsA.postulados,
                  b: ytdFlowsB.postulados,
                },
                {
                  label: "Postulaciones totales",
                  a: ytdFlowsA.postulaciones,
                  b: ytdFlowsB.postulaciones,
                },
              ]
            : []),
          {
            label: "Estudiantes con práctica iniciada",
            a: ytdFlowsA.enPps,
            b: ytdFlowsB.enPps,
          },
          { label: "Finalizados", a: ytdFlowsA.finalizados, b: ytdFlowsB.finalizados },
        ]
      : []),
  ];

  // Base "al mismo día del año anterior" para los chips del balance anual.
  const prevCut = launchesPrevRaw.filter(
    (l) => l.fechaInicio && l.fechaInicio < ytdCutoff(year - 1, now)
  );
  const sameDay =
    !comparing && yearInProgress
      ? {
          ppsLanzadas: ytdPrevYear?.capacity.launches ?? prevCut.length,
          cupos: ytdPrevYear?.capacity.operational ?? cuposSum(prevCut),
          instituciones: instCount(prevCut),
          enPps: ytdPrevYear ? ytdPrevYear.enPps : null,
          finalizados: ytdPrevYear ? ytdPrevYear.finalizados : null,
        }
      : null;
  // Etiquetas de la base de comparación: mismo día para flujos, cierre para
  // stocks sin corte diario. Con año cerrado, año completo contra año completo.
  const sameDayRef = `${year - 1} al ${todayShort}:`;

  // Foco: detalle de los estudiantes sin ninguna PPS.
  const { data: sinPpsStudents = [], isLoading: sinPpsLoading } = useSinPpsDetail({
    year,
    isTestingMode,
  });

  // Trayectoria de los finalizados del año (sección 02).
  const { data: trayectoria } = useTrayectoriaFinalizados({ year, isTestingMode });
  const maxDist = trayectoria ? Math.max(...trayectoria.dist.map((b) => b.n), 1) : 1;
  const dec = (n: number | null) => (n == null ? "—" : String(n).replace(".", ","));

  // Espera postulación → selección (Dinámica del ciclo).
  const { data: tiempoSel } = useTiempoSeleccion({ year, isTestingMode });

  // Convenios: nuevas firmas vs renovaciones (tabla convenios, RPC del dashboard).
  const { data: conveniosKpis } = useQuery({
    queryKey: ["conveniosKpisReporte", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    queryFn: () => fetchConveniosKpis(year),
  });

  // Presión por orientación: demanda vs capacidad operativa.
  const presionOrient = ORIENT_ORDER.map((k) => {
    const of = realLaunches.filter((l) => l.orient === k);
    const cupos = of.reduce((a, l) => a + l.capacidadOperativa, 0);
    const post = of.reduce((a, l) => a + l.postulaciones, 0);
    return { key: k, label: ORIENT_LABEL[k], n: of.length, cupos, post };
  }).filter((d) => d.n > 0);

  // Dinámica: % de postulantes que ya consiguió lugar (para la barra de resultado).
  const pctConLugar =
    dinamica && dinamica.postulados > 0
      ? Math.round((dinamica.conLugar / dinamica.postulados) * 100)
      : 0;

  // Las convocatorias con más demanda del año (Dinámica del ciclo).
  const masDemandadas = realLaunches
    .filter((l) => l.postulaciones > 0)
    .sort((a, b) => b.postulaciones - a.postulaciones)
    .slice(0, 5);

  // Imprimir con nombre de archivo prolijo: el PDF hereda document.title, así
  // que lo fijamos durante la impresión y lo restauramos al cerrar el diálogo.
  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = comparing
      ? `Reporte comparativo PPS ${yA} vs ${yB} · UFLO`
      : `Reporte ejecutivo PPS ${year} · UFLO`;
    window.addEventListener(
      "afterprint",
      () => {
        document.title = prevTitle;
      },
      { once: true }
    );
    window.print();
  };

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
        <button className="btn btn-primary press" onClick={handlePrint} type="button">
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
              Comparación de los ciclos <strong>{yA}</strong> y <strong>{yB}</strong> con flujos
              acumulados al <strong>mismo día ({todayShort})</strong>. Los stocks no se comparan
              hasta disponer de snapshots históricos equivalentes.
            </p>
            <section className="exec-sec exec-keep">
              <SecHead
                num="01"
                title="Indicadores comparables · al mismo día"
                meta={`al ${todayShort}`}
              />
              <ComparativeTable rows={ytdRows} yearA={yA} yearB={yB} />
              <p className="exec-footnote">
                Acumulado hasta el {todayShort} de cada año. Matrícula activa y haciendo PPS son
                stocks actuales: sin snapshots históricos no existe una comparación retrospectiva
                válida.
                {historicalCapacityInComparison ? (
                  <>
                    {" "}
                    En el ciclo reconstruido, ofertas y capacidad provienen de publicaciones
                    documentadas; la capacidad es un mínimo de vacantes finitas. Se informa “n/c”
                    porque no es equivalente a las filas operativas de otros ciclos.
                  </>
                ) : (
                  <> La capacidad combina cupos fijos y plazas realizadas.</>
                )}
                {(!ytdFlowsA?.demandaDisponible || !ytdFlowsB?.demandaDisponible) && (
                  <> La demanda no se muestra cuando el ciclo antecede a la migración confiable.</>
                )}
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
                {historicalCapacityInComparison
                  ? "Para el ciclo reconstruido se usa el mes de publicación; para los demás, el mes de inicio. "
                  : "PPS por mes de inicio. "}
                «Seleccionados» usa estados y prácticas vinculadas; no se imputan selecciones
                faltantes a partir del cupo.
                {offerComparisonIsComparable
                  ? ` Δ = ${yB} menos ${yA}.`
                  : " La variación de ofertas figura como n/c por cambio de fuente y unidad de conteo."}
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
                orientación, PPS lanzadas y capacidad operativa.
              </p>
            </section>
          </>
        ) : (
          <>
            <p className="exec-deck">
              Durante el ciclo {year}, <strong>{fmt(iniciaronMain)} estudiantes</strong> iniciaron
              al menos una práctica profesional supervisada. Se lanzaron{" "}
              <strong>{fmt(realLaunches.length)} convocatorias</strong> en{" "}
              <strong>{fmt(institucionesMain)} instituciones</strong>, con{" "}
              <strong>{fmt(capacidadMain)} plazas de capacidad operativa</strong> y{" "}
              <strong>{fmt(metrics.nuevos_convenios)} convenios nuevos</strong> incorporados a la
              red.
            </p>

            <section className="exec-sec exec-keep">
              <SecHead num="01" title="Matrícula" meta={`snapshot al ${todayShort}`} />
              <div className="exec-stats exec-stats-3">
                <ExecStat
                  big
                  value={iniciaronMain}
                  label="Iniciaron PPS"
                  ctx="Personas distintas con práctica iniciada"
                  prev={ytdPrevYear?.enPps ?? null}
                  prevYear={year - 1}
                  prevLabel={sameDay ? sameDayRef : `total ${year - 1}:`}
                />
                <ExecStat
                  big
                  value={finalizadosMain}
                  label="Finalizados"
                  ctx="Finalizaciones efectivas registradas"
                  prev={ytdPrevYear?.finalizados ?? null}
                  prevYear={year - 1}
                  prevLabel={sameDay ? sameDayRef : `total ${year - 1}:`}
                />
                <ExecStat
                  big
                  value={metrics.matricula_activa}
                  label="Matrícula activa"
                  ctx="Foto operativa actual; no se reconstruye hacia atrás"
                />
              </div>
              {sameDay && (
                <p className="exec-footnote">
                  Las variaciones (↑ ↓) comparan contra {year - 1} cortado al mismo día (
                  {todayShort}), no contra el año completo: es la única lectura pareja para un ciclo
                  en curso. Los stocks operativos actuales se muestran aparte y no se comparan como
                  si fueran flujos anuales.
                </p>
              )}
              {ytdMain && (
                <p className="exec-footnote">
                  Contrato {ytdMain.metricVersion}. Vínculos lanzamiento–institución:{" "}
                  {ytdMain.quality.launchInstitutionLinkCoveragePct == null
                    ? "sin base"
                    : `${dec(ytdMain.quality.launchInstitutionLinkCoveragePct)}%`}
                  ; práctica–lanzamiento:{" "}
                  {ytdMain.quality.practiceLaunchLinkCoveragePct == null
                    ? "sin base"
                    : `${dec(ytdMain.quality.practiceLaunchLinkCoveragePct)}%`}
                  .{" "}
                  {ytdMain.capacity.fixedOverCapacityAvailable ? (
                    <>
                      {fmt(ytdMain.capacity.fixedOverCapacityLaunches)} lanzamientos fijos superan
                      el cupo registrado y requieren revisión.
                    </>
                  ) : (
                    <>
                      Capacidad histórica documentada: {fmt(ytdMain.capacity.fixedOffered)} vacantes
                      finitas en {fmt(ytdMain.capacity.documentedFiniteOffers ?? 0)} ofertas;{" "}
                      {fmt(ytdMain.capacity.unknownOrRealizedOffers)} ofertas no tienen un total
                      finito verificable.
                    </>
                  )}
                </p>
              )}
            </section>

            {trayectoria && trayectoria.n > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead
                  num="02"
                  title="Trayectoria hasta la finalización"
                  meta={`${fmt(trayectoria.n)} de ${fmt(trayectoria.totalFinalizados)} finalizaciones con trayectoria calculable`}
                />
                <p className="exec-note">
                  Cuánto tarda un estudiante en completar su recorrido de prácticas: desde el inicio
                  de la primera hasta la finalización efectiva, sobre los finalizados de {year}. La
                  cifra principal es la <strong>mediana</strong>, robusta frente a casos extremos.
                </p>
                <div className="exec-stats exec-stats-4">
                  <ExecStat
                    big
                    value={trayectoria.medianaMeses ?? 0}
                    display={dec(trayectoria.medianaMeses)}
                    label="Mediana de meses"
                    ctx="La mitad finaliza en este tiempo o menos"
                  />
                  <ExecStat
                    value={trayectoria.promedioMeses ?? 0}
                    display={dec(trayectoria.promedioMeses)}
                    label="Promedio de meses"
                    ctx="Sensible a las trayectorias largas"
                  />
                  <ExecStat
                    value={trayectoria.promedioRegistrosPractica ?? 0}
                    display={dec(trayectoria.promedioRegistrosPractica)}
                    label="Registros promedio"
                    ctx="Filas de práctica por estudiante finalizado"
                  />
                  <ExecStat
                    value={trayectoria.promedioHorasCargadas ?? 0}
                    display={
                      trayectoria.promedioHorasCargadas == null
                        ? "—"
                        : fmt(trayectoria.promedioHorasCargadas)
                    }
                    label="Horas cargadas promedio"
                    ctx="Suma de horas registradas al finalizar"
                  />
                </div>
                {trayectoria.p25Meses != null && trayectoria.p75Meses != null && (
                  <p className="exec-note" style={{ margin: "18px 0 0" }}>
                    El 50% central de las trayectorias tarda entre{" "}
                    <strong>{dec(trayectoria.p25Meses)}</strong> y{" "}
                    <strong>{dec(trayectoria.p75Meses)} meses</strong>.
                  </p>
                )}
                <div className="exec-hist">
                  {trayectoria.dist.map((b, i) => (
                    <div key={b.label} className="exec-hist-row">
                      <span className="exec-hist-label">{b.label}</span>
                      <span className="exec-hist-track">
                        <span
                          className="exec-hist-fill"
                          style={{
                            width: `${Math.max((b.n / maxDist) * 100, b.n ? 4 : 0)}%`,
                            background: `color-mix(in oklab, var(--accent) ${45 + i * 18}%, var(--paper))`,
                          }}
                        />
                      </span>
                      <span className="exec-hist-n mono">
                        {b.n ? `${fmt(b.n)} · ${Math.round((b.n / trayectoria.n) * 100)}%` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="exec-footnote">
                  Duración medida del inicio de la primera PPS a la fecha de finalización efectiva.
                  Cobertura: {fmt(trayectoria.n)} de {fmt(trayectoria.totalFinalizados)} casos.
                  {trayectoria.duracionesInvalidas > 0 && (
                    <>
                      {" "}
                      Se excluyeron {fmt(trayectoria.duracionesInvalidas)} duraciones fuera del
                      rango publicable y se informan como incidencia de calidad.
                    </>
                  )}
                </p>
              </section>
            )}

            <section className="exec-sec exec-keep">
              <SecHead num="03" title="Seguimiento de estudiantes" />
              <div className="exec-stats exec-stats-3">
                <ExecStat
                  value={metrics.sin_pps}
                  label="Sin PPS · demanda activa"
                  ctx={`Sin prácticas y con postulaciones en ${year}`}
                />
                <ExecStat
                  value={metrics.proximos_finalizar}
                  label="Próximos a finalizar"
                  ctx="Cohorte accionable sin Relevamiento/Entrevista previa"
                />
                <ExecStat
                  value={metrics.en_acreditacion}
                  label="En acreditación"
                  ctx="Solicitud de finalización actualmente en trámite"
                />
              </div>
            </section>

            {metrics.sin_pps > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead
                  num="04"
                  title="Foco · Sin PPS con demanda activa"
                  meta={`${fmt(metrics.sin_pps)} ${metrics.sin_pps === 1 ? "estudiante" : "estudiantes"}`}
                />
                <SinPpsFocus students={sinPpsStudents} isLoading={sinPpsLoading} year={year} />
              </section>
            )}

            <section className="exec-sec exec-keep">
              <SecHead num="05" title="Red de instituciones" />
              <div className="exec-stats exec-stats-4">
                <ExecStat
                  value={realLaunches.length}
                  label={
                    mainUsesHistoricalOfferSource ? "Ofertas PPS documentadas" : "PPS lanzadas"
                  }
                  ctx={
                    mainUsesHistoricalOfferSource
                      ? "Publicaciones canónicas del ciclo"
                      : "Convocatorias del ciclo"
                  }
                  prev={
                    mainUsesHistoricalOfferSource
                      ? null
                      : sameDay
                        ? sameDay.ppsLanzadas
                        : prev("pps_lanzadas")
                  }
                  prevYear={year - 1}
                  prevLabel={sameDay ? sameDayRef : undefined}
                />
                <ExecStat
                  value={institucionesMain}
                  label="Instituciones activas"
                  ctx="Con convocatorias este año"
                  prev={sameDay ? sameDay.instituciones : prev("instituciones_activas")}
                  prevYear={year - 1}
                  prevLabel={sameDay ? sameDayRef : undefined}
                />
                <ExecStat
                  value={capacidadMain}
                  label={
                    mainUsesHistoricalOfferSource ? "Capacidad documentada" : "Capacidad operativa"
                  }
                  ctx={
                    mainUsesHistoricalOfferSource
                      ? "Mínimo de vacantes finitas"
                      : "Cupos fijos + plazas realizadas"
                  }
                  prev={mainUsesHistoricalOfferSource ? null : sameDay ? sameDay.cupos : null}
                  prevYear={year - 1}
                  prevLabel={sameDay ? sameDayRef : undefined}
                />
                <ExecStat
                  value={metrics.nuevos_convenios}
                  label="Nuevos convenios"
                  ctx="Instituciones incorporadas"
                  prev={prev("nuevos_convenios")}
                  prevYear={year - 1}
                  prevLabel={yearInProgress && !comparing ? `total ${year - 1}:` : undefined}
                  neutralDelta
                />
              </div>
              {sameDay && (
                <p className="exec-footnote">
                  PPS, instituciones y cupos de {year - 1} contados hasta el {todayShort} de ese
                  año. Las firmas de convenios previas a jul 2026 tienen fecha estimada (backfill),
                  así que se referencia el total anual de {year - 1}.
                </p>
              )}
            </section>

            {metrics.nuevos_convenios > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead
                  num="06"
                  title="Convenios nuevos · ficha por institución"
                  meta={
                    conveniosKpis && conveniosKpis.renovaciones > 0
                      ? `${fmt(conveniosKpis.nuevos_convenios)} ${conveniosKpis.nuevos_convenios === 1 ? "nueva" : "nuevas"} · ${fmt(conveniosKpis.renovaciones)} ${conveniosKpis.renovaciones === 1 ? "renovación" : "renovaciones"}`
                      : `${fmt(metrics.nuevos_convenios)} ${metrics.nuevos_convenios === 1 ? "institución" : "instituciones"}`
                  }
                />
                <NewAgreementsTable
                  agreements={agreementsMain}
                  isLoading={agreementsLoading}
                  year={year}
                />
                {(conveniosKpis?.renovaciones ?? 0) > 0 && (
                  <p className="exec-footnote">
                    {conveniosKpis && conveniosKpis.renovaciones > 0 && (
                      <>
                        «Nuevas» = instituciones cuya primera firma cae en {year};{" "}
                        {conveniosKpis.renovaciones === 1
                          ? "1 renovación de vínculo existente"
                          : `${fmt(conveniosKpis.renovaciones)} renovaciones de vínculos existentes`}{" "}
                        no figuran en esta ficha.{" "}
                      </>
                    )}
                  </p>
                )}
              </section>
            )}

            {realLaunches.length > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead
                  num="07"
                  title="Orientación de la oferta"
                  meta={`${fmt(realLaunches.length)} convocatorias efectivas`}
                />
                <OrientBar launches={realLaunches} />
                {presionOrient.length > 0 && (
                  <>
                    <p className="label" style={{ margin: "22px 0 8px" }}>
                      Presión de la demanda por orientación
                    </p>
                    <div className="exec-table-wrap">
                      <table className="exec-table">
                        <thead>
                          <tr>
                            <th>Orientación</th>
                            <th className="num">Convocatorias</th>
                            <th className="num">Capacidad</th>
                            <th className="num">Postulaciones</th>
                            <th className="num">Postulantes por plaza</th>
                          </tr>
                        </thead>
                        <tbody>
                          {presionOrient.map((d) => (
                            <tr key={d.key}>
                              <td>
                                <span className="exec-t-orient">
                                  <span
                                    className="exec-dot"
                                    style={{ background: ORIENT_VAR[d.key] }}
                                  />
                                  {d.label}
                                </span>
                              </td>
                              <td className="num mono">{fmt(d.n)}</td>
                              <td className="num mono">{fmt(d.cupos)}</td>
                              <td className="num mono">{fmt(d.post)}</td>
                              <td className="num mono">
                                {d.cupos > 0
                                  ? (d.post / d.cupos).toFixed(1).replace(".", ",")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="exec-footnote">
                      La capacidad combina cupos fijos con plazas efectivamente realizadas. Un valor
                      alto de «postulantes por plaza» señala una orientación sobredemandada.
                    </p>
                  </>
                )}
              </section>
            )}

            {dinamica && dinamica.postulados > 0 && (
              <section className="exec-sec exec-keep">
                <SecHead
                  num="08"
                  title="Dinámica del ciclo"
                  meta={`${fmt(dinamica.postulados)} ${dinamica.postulados === 1 ? "postulante" : "postulantes"}`}
                />
                <p className="exec-note">
                  Mide la <strong>búsqueda de lugar</strong> durante {year}: cuántos estudiantes
                  salieron a buscar práctica, cuánto esfuerzo les llevó y qué parte ya consiguió
                  lugar. Incluye todas las PPS del ciclo, sin exclusiones por institución.
                </p>
                <div className="exec-stats exec-stats-4">
                  <ExecStat
                    value={dinamica.postulados}
                    label="Alumnos que se postularon"
                    ctx="Personas distintas que buscaron lugar en el año"
                  />
                  <ExecStat
                    value={dinamica.postulaciones}
                    label="Postulaciones enviadas"
                    ctx="Total de inscripciones a convocatorias"
                  />
                  <ExecStat
                    value={dinamica.postulacionesPorAlumno}
                    display={String(dinamica.postulacionesPorAlumno).replace(".", ",")}
                    label="Postulaciones por alumno"
                    ctx="A cuántas convocatorias se anota cada uno para conseguir lugar"
                  />
                  <ExecStat
                    value={dinamica.concrecionPct ?? 0}
                    display={dinamica.concrecionPct == null ? "—" : `${dinamica.concrecionPct}%`}
                    label="Concreción"
                    ctx={`${fmt(dinamica.conLugar)} de ${fmt(dinamica.postulados)} postulantes ya tienen lugar`}
                  />
                </div>
                <div className="exec-dyn">
                  <div
                    className="exec-bar"
                    role="img"
                    aria-label={`De ${fmt(dinamica.postulados)} postulantes, ${fmt(dinamica.conLugar)} con lugar y ${fmt(dinamica.sinLugar)} sin lugar todavía`}
                  >
                    <span
                      style={{
                        flexGrow: Math.max(dinamica.conLugar, 0.01),
                        background: "var(--ok)",
                      }}
                    />
                    <span
                      style={{
                        flexGrow: Math.max(dinamica.sinLugar, 0.01),
                        background: "var(--warn)",
                      }}
                    />
                  </div>
                  <div className="exec-legend">
                    <span className="exec-legend-item">
                      <span className="exec-dot" style={{ background: "var(--ok)" }} />
                      <span>Con lugar</span>
                      <span className="mono exec-legend-n">
                        {fmt(dinamica.conLugar)} · {pctConLugar}%
                      </span>
                    </span>
                    <span className="exec-legend-item">
                      <span className="exec-dot" style={{ background: "var(--warn)" }} />
                      <span>Sin lugar todavía</span>
                      <span className="mono exec-legend-n">
                        {fmt(dinamica.sinLugar)} · {100 - pctConLugar}%
                      </span>
                    </span>
                  </div>
                </div>
                {tiempoSel && tiempoSel.n >= 5 && tiempoSel.medianaDias != null && (
                  <p className="exec-note" style={{ margin: "16px 0 0" }}>
                    <strong>Experimental · espera hasta la selección:</strong> la mitad de los casos
                    medibles se resolvió en <strong>{dec(tiempoSel.medianaDias)} días</strong> o
                    menos
                    {tiempoSel.p25Dias != null && tiempoSel.p75Dias != null && (
                      <>
                        {" "}
                        (50% central entre {dec(tiempoSel.p25Dias)} y {dec(tiempoSel.p75Dias)} días)
                      </>
                    )}
                    . Cobertura: {fmt(tiempoSel.n)} de {fmt(tiempoSel.seleccionados)} selecciones (
                    {tiempoSel.coberturaPct == null ? "—" : `${dec(tiempoSel.coberturaPct)}%`}). No
                    se usa para comparaciones interanuales hasta alcanzar 90% durante un ciclo
                    completo.
                  </p>
                )}
                {masDemandadas.length > 0 && (
                  <>
                    <p className="label" style={{ margin: "22px 0 8px" }}>
                      Las convocatorias más demandadas del ciclo
                    </p>
                    <div className="exec-table-wrap">
                      <table className="exec-table">
                        <thead>
                          <tr>
                            <th>Convocatoria</th>
                            <th className="num">Inicio</th>
                            <th className="num">Capacidad</th>
                            <th className="num">Postulaciones</th>
                            <th className="num">Postulantes por plaza</th>
                          </tr>
                        </thead>
                        <tbody>
                          {masDemandadas.map((l) => (
                            <tr key={l.id}>
                              <td className="exec-t-name">{l.nombre}</td>
                              <td className="num mono">
                                {l.fechaInicio ? diaMes(l.fechaInicio) : "—"}
                              </td>
                              <td className="num mono">{fmt(l.capacidadOperativa)}</td>
                              <td className="num mono">{fmt(l.postulaciones)}</td>
                              <td className="num mono">
                                {l.capacidadOperativa > 0
                                  ? (l.postulaciones / l.capacidadOperativa)
                                      .toFixed(1)
                                      .replace(".", ",")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <p className="exec-footnote">
                  «Con lugar» = postulantes del año con selección asignada o práctica iniciada. «Sin
                  lugar todavía» incluye alumnos que ya hicieron PPS en ciclos anteriores, por eso
                  no coincide con «Sin ninguna PPS» (sección 04). «Postulantes por plaza» aproxima
                  la competencia usando capacidad fija o realizada según el lanzamiento.
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
                        realLaunches.reduce((a, l) => a + l.capacidadOperativa, 0)
                      )} plazas operativas`
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
