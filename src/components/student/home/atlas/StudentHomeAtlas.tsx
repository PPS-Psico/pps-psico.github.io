import React, { useMemo } from "react";
import "./atlasHome.css";
import StudentConvCard from "../StudentConvCard";
import type {
  Convocatoria,
  CriteriosCalculados,
  EstudianteFields,
  InformeTask,
  LanzamientoPPS,
  Practica,
  SolicitudPPS,
  TabId,
} from "../../../../types";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_ESTADO_PPS,
  FIELD_ULTIMA_ACTUALIZACION_PPS,
} from "../../../../constants";
import { formatDate, normalizeStringForComparison } from "../../../../utils/formatters";

interface StudentHomeAtlasProps {
  student: EstudianteFields | null;
  studentName: string;
  criterios: CriteriosCalculados;
  openLanzamientos: LanzamientoPPS[];
  practicas: Practica[];
  solicitudes: SolicitudPPS[];
  informeTasks: InformeTask[];
  closedLanzamientos: LanzamientoPPS[];
  enrollmentMap: Map<string, Convocatoria>;
  consent: { ppsName: string } | null;
  upcomingStart: { ppsName: string; startDate: string } | null;
  onStartConsent: () => void;
  onOpenDetalle: (l: LanzamientoPPS) => void;
  onInscribir: (l: LanzamientoPPS, completedOrientaciones?: string[]) => void;
  onVerConvocados: (l: LanzamientoPPS) => void;
  onNavigate: (tab: TabId) => void;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtShort = (raw?: unknown): string => {
  if (!raw) return "";
  const f = formatDate(raw as string);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(f);
  if (!m) return f;
  return `${parseInt(m[1], 10)} ${MESES[parseInt(m[2], 10) - 1] ?? ""}`.trim();
};

const AhIcon: React.FC<{ name: "bell" | "cal" | "clock" | "arrow" | "timer"; size?: number }> = ({
  name,
  size = 18,
}) => {
  const paths: Record<string, React.ReactNode> = {
    bell: (
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </>
    ),
    cal: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
    timer: (
      <>
        <path d="M10 2h4" />
        <path d="M12 14v-4" />
        <circle cx="12" cy="14" r="8" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {paths[name]}
    </svg>
  );
};

// Color CSS de área (refs a tokens; el dark las aclara solo).
function areaVar(area: string): string {
  const a = normalizeStringForComparison(area);
  if (a.startsWith("cl")) return "var(--area-clinica)";
  if (a.startsWith("ed")) return "var(--area-educacional)";
  if (a.startsWith("co") || a.startsWith("so")) return "var(--area-comunitaria)";
  // Laboral: rojo ladrillo, igual que getAreaColor() / la vista mobile (#C0392B).
  if (a.startsWith("la") || a.startsWith("tr")) return "#c0392b";
  return "var(--primary-500)";
}

function daysUntil(raw?: unknown): number | null {
  if (!raw) return null;
  const d = new Date(raw as string);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
function closesLabel(raw?: unknown): { text: string; soft: boolean } {
  const n = daysUntil(raw);
  if (n == null) return { text: "Abierta", soft: true };
  if (n < 0) return { text: "Cerró", soft: true };
  if (n === 0) return { text: "Cierra hoy", soft: false };
  if (n === 1) return { text: "Cierra mañana", soft: false };
  return { text: `Cierra en ${n} días`, soft: n > 4 };
}

const StudentHomeAtlas: React.FC<StudentHomeAtlasProps> = ({
  studentName,
  criterios,
  openLanzamientos,
  solicitudes,
  closedLanzamientos,
  enrollmentMap,
  consent,
  upcomingStart,
  onStartConsent,
  onOpenDetalle,
  onInscribir,
  onVerConvocados,
  onNavigate,
}) => {
  const firstName = (studentName || "Estudiante").split(" ")[0];

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 && hour >= 5
      ? "Buenos días"
      : hour < 20 && hour >= 12
        ? "Buenas tardes"
        : "Buenas noches";
  const dateStr = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const currentDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const totalTarget = (criterios?.horasTotales || 0) + (criterios?.horasFaltantes250 || 0) || 248;
  const hoursAcc = Math.round(criterios?.horasTotales || 0);
  // ── Próximo paso ──────────────────────────────────────────────
  // El "Próximo paso" sigue el onboarding de la PPS: si quedó seleccionado y
  // todavía no firmó, lo lleva al consentimiento (lo resuelve `consent`); si ya
  // firmó y la PPS aún no arranca, recuerda la fecha de inicio (`startStep`);
  // si ya está en curso o no hay nada seleccionado, queda "Al día".
  const startStep = useMemo(() => {
    if (!upcomingStart) return null;
    const d = new Date(upcomingStart.startDate);
    if (isNaN(d.getTime())) return null;
    const n = daysUntil(upcomingStart.startDate);
    const full = formatDate(upcomingStart.startDate);
    const sub =
      n == null
        ? `Comenzás ${full}.`
        : n <= 0
          ? "Comenzás hoy. ¡Mucha suerte!"
          : n === 1
            ? `Comenzás mañana, ${full}.`
            : `Faltan ${n} días — comenzás el ${full}.`;
    return {
      m: (MESES[d.getMonth()] || "").toUpperCase(),
      d: String(d.getDate()),
      sub,
    };
  }, [upcomingStart]);

  // ── Solicitudes ───────────────────────────────────────────────
  // Solo mostramos las que siguen en proceso; las completadas/cerradas
  // no aportan acción y ya viven en la pestaña de Solicitudes.
  const COMPLETED_SOL = [
    "realizada",
    "creada",
    "concretar",
    "aprobada",
    "rechazada",
    "finalizada",
    "cerrada",
    "concretada",
    "baja",
  ];
  const solItems = useMemo(
    () =>
      (solicitudes || [])
        .filter((s) => {
          const norm = normalizeStringForComparison((s[FIELD_ESTADO_PPS] as string) || "pendiente");
          return !COMPLETED_SOL.some((c) => norm.includes(c));
        })
        .slice(0, 4)
        .map((s) => {
          const status = (s[FIELD_ESTADO_PPS] as string) || "Pendiente";
          const norm = normalizeStringForComparison(status);
          const tone: "wait" | "info" | "ok" = norm.includes("curso")
            ? "ok"
            : norm.includes("entrev") || norm.includes("selecc") || norm.includes("adjud")
              ? "info"
              : "wait";
          return {
            id: s.id,
            name: (s[FIELD_EMPRESA_PPS_SOLICITUD] as string) || "Institución",
            sub: s[FIELD_ULTIMA_ACTUALIZACION_PPS]
              ? `Actualizada ${fmtShort(s[FIELD_ULTIMA_ACTUALIZACION_PPS])}`
              : "En gestión",
            status,
            tone,
          };
        }),
    [solicitudes]
  );
  const hasSols = solItems.length > 0;

  const nConvs = openLanzamientos.length;

  return (
    <div className="ah-root">
      <main className="ah-main">
        {/* Hero: saludo + próximo paso */}
        <div className="ah-hero">
          <div>
            <span className="eyebrow ah-hero__date">{currentDate} · PPS</span>
            <h1 className="ah-hero__greet">
              {greeting}, <em>{firstName}.</em>
            </h1>
            {nConvs > 0 ? (
              <p className="ah-hero__line">
                Llevás{" "}
                <b className="ah-mark ah-mark--teal">
                  {hoursAcc} de {totalTarget} hs
                </b>{" "}
                acreditadas. Hay{" "}
                <b className="ah-mark ah-mark--amber">
                  {nConvs} {nConvs === 1 ? "convocatoria abierta" : "convocatorias abiertas"}
                </b>{" "}
                para tu rotación — revisá el detalle y sumate.
              </p>
            ) : (
              <p className="ah-hero__line">
                Llevás{" "}
                <b className="ah-mark ah-mark--teal">
                  {hoursAcc} de {totalTarget} hs
                </b>{" "}
                acreditadas. Hoy no hay convocatorias abiertas — te avisamos ni bien se publique una
                que encaje con tu rotación.
              </p>
            )}
          </div>

          <aside className={"ah-next" + (consent ? " ah-next--alert" : "")}>
            <div className="ah-next__tag">
              <h6>Próximo paso</h6>
              {consent ? (
                <span className="ah-badge ah-badge--warn">
                  <span className="dot" />
                  Acción requerida
                </span>
              ) : startStep ? (
                <span className="ah-badge ah-badge--ok">
                  <span className="dot" />
                  Confirmada
                </span>
              ) : (
                <span className="ah-badge ah-badge--ok">
                  <span className="dot" />
                  Al día
                </span>
              )}
            </div>

            {consent ? (
              <>
                <div className="ah-next__body">
                  <div
                    className="ah-next__date"
                    style={{
                      display: "grid",
                      placeItems: "center",
                      padding: 8,
                      color: "var(--warning-500)",
                      borderColor: "var(--warning-500)",
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 24 }} aria-hidden>
                      draw
                    </span>
                  </div>
                  <div>
                    <div className="ah-next__t">Realizá el consentimiento digital</div>
                    <div className="ah-next__s">
                      Quedaste <b>seleccionado/a</b> en <b>{consent.ppsName}</b>. Firmá el
                      consentimiento para confirmar tu lugar.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="ah-btn ah-btn--primary"
                  style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
                  onClick={onStartConsent}
                >
                  Firmar consentimiento
                  <AhIcon name="arrow" size={15} />
                </button>
              </>
            ) : startStep ? (
              <div className="ah-next__body">
                <div className="ah-next__date">
                  <span className="m">{startStep.m}</span>
                  <span className="d">{startStep.d}</span>
                </div>
                <div>
                  <div className="ah-next__t">Arrancás {upcomingStart?.ppsName}</div>
                  <div className="ah-next__s">{startStep.sub}</div>
                </div>
              </div>
            ) : (
              <div className="ah-next__body">
                <div
                  className="ah-next__date"
                  style={{ display: "grid", placeItems: "center", padding: 8 }}
                >
                  <AhIcon name="clock" size={20} />
                </div>
                <div>
                  <div className="ah-next__t">No tenés pasos pendientes</div>
                  <div className="ah-next__s">
                    Cuando quedes seleccionado/a en una PPS, acá vas a ver el consentimiento y la
                    fecha de inicio.
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Convocatorias */}
        <div className="ah-sechead">
          <h6>Convocatorias abiertas</h6>
          <span className="n">{String(nConvs).padStart(2, "0")}</span>
          <a
            onClick={(e) => {
              e.preventDefault();
              onNavigate("solicitudes");
            }}
          >
            Ver mis solicitudes
          </a>
        </div>
        {nConvs === 0 ? (
          <div className="ah-convs">
            <div
              className={"ah-empty" + (closedLanzamientos.length > 0 ? " ah-empty--compact" : "")}
            >
              <div className="ah-empty__ic">
                <AhIcon name="bell" size={20} />
              </div>
              <div className="ah-empty__t">No hay convocatorias abiertas</div>
              <p className="ah-empty__s">
                Estate atento al grupo de WhatsApp para no perderte novedades.
              </p>
            </div>
          </div>
        ) : nConvs === 1 ? (
          (() => {
            const l = openLanzamientos[0];
            const area = (l[FIELD_ORIENTACION_LANZAMIENTOS] as string) || "General";
            const areaPrimary = area.split(/[,/]/)[0].trim();
            const name = ((l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Convocatoria")
              .split(" - ")[0]
              .trim();
            const desc =
              (l[FIELD_DESCRIPCION_LANZAMIENTOS] as string) ||
              "Práctica profesional supervisada disponible para tu rotación.";
            const hs = Number(l[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] || 0);
            const cupos = Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
            const periodo = [
              fmtShort(l[FIELD_FECHA_INICIO_LANZAMIENTOS]),
              fmtShort(l[FIELD_FECHA_FIN_LANZAMIENTOS]),
            ]
              .filter(Boolean)
              .join(" → ");
            const closes = closesLabel(l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]);
            const direccion = (l[FIELD_DIRECCION_LANZAMIENTOS] as string) || "";
            const esOnline = direccion.trim() === "Modalidad Virtual";
            const horarios = ((l[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] as string) || "")
              .split(/[;\n]/)
              .map((h) => h.trim())
              .filter(Boolean);
            const actsRaw = (l as Record<string, unknown>).actividades_lista;
            const actividades: string[] = Array.isArray(actsRaw)
              ? (actsRaw as string[])
              : actsRaw
                ? [String(actsRaw)]
                : [];
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
            const inicio = fmtShort(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            const fin = fmtShort(l[FIELD_FECHA_FIN_LANZAMIENTOS]);
            const cronograma = [
              {
                k: "Inscripción",
                v: closes.text.replace(/^Cierra /, "").replace(/^en /, "") || "Abierta",
                active: true,
              },
              { k: "Inicio", v: inicio || "A definir", active: false },
              { k: "Cierre", v: fin || "A definir", active: false },
            ];
            return (
              <article className="ah-feat" style={{ ["--ac" as string]: areaVar(areaPrimary) }}>
                {/* ── Columna editorial ── */}
                <div className="ah-feat__main">
                  <div className="ah-feat__head">
                    <span className="ah-areabadge">
                      <span className="dot" />
                      {areaPrimary}
                    </span>
                    <span className={"ah-closes" + (closes.soft ? " ah-closes--soft" : "")}>
                      {closes.soft ? (
                        <AhIcon name="timer" size={13} />
                      ) : (
                        <span className="ah-closes__pulse" aria-hidden />
                      )}
                      {closes.text}
                    </span>
                  </div>
                  <h2 className="ah-feat__name">{name}</h2>
                  <p className="ah-feat__desc">{desc}</p>

                  {horarios.length > 0 || (!esOnline && direccion) ? (
                    <div className="ah-feat__meta">
                      {horarios.length > 0 ? (
                        <div className="ah-feat__block">
                          <span className="eyebrow">Días y horarios</span>
                          <ul className="ah-feat__hlist">
                            {horarios.map((h, idx) => (
                              <li key={idx}>
                                <span className="ah-feat__ic">
                                  <AhIcon name="cal" size={15} />
                                </span>
                                <span>{h}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {!esOnline && direccion ? (
                        <div className="ah-feat__block">
                          <span className="eyebrow">Ubicación</span>
                          <a
                            className="ah-feat__map"
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="ah-feat__ic">
                              <span className="material-icons" aria-hidden>
                                place
                              </span>
                            </span>
                            <span className="ah-feat__map-txt">
                              <span className="ah-feat__map-addr">{direccion}</span>
                              <span className="ah-feat__map-hint">Abrir en Google Maps</span>
                            </span>
                            <AhIcon name="arrow" size={14} />
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {actividades.length > 0 ? (
                    <div className="ah-feat__acts">
                      <span className="eyebrow">Vas a</span>
                      <ul>
                        {actividades.slice(0, 6).map((t, idx) => (
                          <li key={idx}>
                            <span className="ah-feat__bullet" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                {/* ── Panel de acción ── */}
                <aside className="ah-feat__side">
                  <span className="eyebrow ah-feat__sidehead">La propuesta</span>
                  <div className="ah-feat__stats">
                    {[
                      { k: "Acredita", v: hs ? String(hs) : "—", u: hs ? "hs" : "", accent: true },
                      { k: "Cupos", v: cupos ? String(cupos) : "—", u: "", accent: false },
                      {
                        k: "Modalidad",
                        v: esOnline ? "Online" : "Presencial",
                        u: "",
                        accent: false,
                      },
                    ].map((s) => (
                      <div key={s.k} className="ah-feat__stat">
                        <span className="k">{s.k}</span>
                        <span className="v" style={s.accent ? { color: "var(--ac)" } : undefined}>
                          {s.v}
                          {s.u ? <span className="u">{s.u}</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="ah-feat__time">
                    <span className="eyebrow">Cronograma</span>
                    <div className="ah-feat__steps">
                      {cronograma.map((c) => (
                        <div key={c.k} className={"ah-feat__step" + (c.active ? " is-active" : "")}>
                          <span className="ah-feat__node" />
                          <span className="sk">{c.k}</span>
                          <span className="sv">{c.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="ah-btn ah-btn--primary ah-feat__cta"
                    onClick={() => onInscribir(l)}
                  >
                    Inscribirme{cupos ? ` · ${cupos} ${cupos === 1 ? "cupo" : "cupos"}` : ""}
                    <AhIcon name="arrow" size={15} />
                  </button>
                  <p className="ah-feat__note">
                    Te llega un correo de confirmación al inscribirte.
                  </p>
                </aside>
              </article>
            );
          })()
        ) : (
          <div className="ah-convs">
            {openLanzamientos.map((l) => {
              const area = (l[FIELD_ORIENTACION_LANZAMIENTOS] as string) || "General";
              const areaPrimary = area.split(/[,/]/)[0].trim();
              const name = ((l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Convocatoria")
                .split(" - ")[0]
                .trim();
              const rawDesc = (l[FIELD_DESCRIPCION_LANZAMIENTOS] as string) || "";
              const desc = rawDesc
                ? rawDesc.split(/(?<=\.)\s/)[0].slice(0, 120)
                : "Práctica profesional supervisada disponible para tu rotación.";
              const hs = Number(l[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] || 0);
              const cupos = Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
              const periodo = [
                fmtShort(l[FIELD_FECHA_INICIO_LANZAMIENTOS]),
                fmtShort(l[FIELD_FECHA_FIN_LANZAMIENTOS]),
              ]
                .filter(Boolean)
                .join(" → ");
              const closes = closesLabel(l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]);
              return (
                <article
                  key={l.id}
                  className="ah-conv"
                  style={{ ["--ac" as string]: areaVar(areaPrimary) }}
                  onClick={() => onOpenDetalle(l)}
                >
                  <div className="ah-conv__top">
                    <span className="ah-areabadge">
                      <span className="dot" />
                      {areaPrimary}
                    </span>
                    <span className={"ah-closes" + (closes.soft ? " ah-closes--soft" : "")}>
                      <AhIcon name="timer" size={13} />
                      {closes.text}
                    </span>
                  </div>
                  <h2 className="ah-conv__name">{name}</h2>
                  <p className="ah-conv__desc">{desc}</p>
                  <div className="ah-conv__spacer" />
                  <div className="ah-conv__data">
                    <div className="ah-conv__cell">
                      <span className="k">Horas</span>
                      <span className="v">
                        {hs || "—"} <span className="u">hs</span>
                      </span>
                    </div>
                    <div className="ah-conv__cell">
                      <span className="k">Cupos</span>
                      <span className="v">{cupos || "—"}</span>
                    </div>
                    <div className="ah-conv__cell">
                      <span className="k">Período</span>
                      <span className="v">{periodo || "A definir"}</span>
                    </div>
                  </div>
                  <div className="ah-conv__foot">
                    <button
                      type="button"
                      className="ah-btn ah-btn--secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetalle(l);
                      }}
                    >
                      Ver detalle
                      <AhIcon name="arrow" size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Cerradas — el alumno ve acá si quedó seleccionado y los convocados */}
        {closedLanzamientos.length > 0 ? (
          <>
            <div className="ah-sechead">
              <h6>Cerradas · tus resultados</h6>
              <span className="n">{String(closedLanzamientos.length).padStart(2, "0")}</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
                marginBottom: 28,
              }}
            >
              {closedLanzamientos.map((l) => (
                <StudentConvCard
                  key={l.id}
                  lanzamiento={l}
                  enrollment={enrollmentMap.get(l.id) ?? null}
                  isOpen={false}
                  onOpen={() => onOpenDetalle(l)}
                  onVerConvocados={() => onVerConvocados(l)}
                />
              ))}
            </div>
          </>
        ) : null}

        {/* Solicitudes en proceso (solo si hay alguna en gestión) */}
        {hasSols ? (
          <>
            <div className="ah-sechead">
              <h6>Solicitudes en proceso</h6>
              <span className="n">{String(solItems.length).padStart(2, "0")}</span>
            </div>
            <div className="ah-card">
              <div className="ah-sols">
                {solItems.map((s) => (
                  <div key={s.id} className="ah-sol">
                    <div>
                      <div className="ah-sol__name">{s.name}</div>
                      <div className="ah-sol__sub">{s.sub}</div>
                    </div>
                    <span className={`ah-badge ah-badge--${s.tone}`}>
                      <span className="dot" />
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
};

export default StudentHomeAtlas;
