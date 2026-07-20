import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { StudentPanelProvider, useStudentPanel } from "../../contexts/StudentPanelContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useModal } from "../../contexts/ModalContext";
import ConfirmModal from "../../components/ConfirmModal";
import AppModals from "../../components/AppModals";
import EmptyState from "../../components/EmptyState";
import { fetchSeleccionados } from "../../services";
import { Icon, getAreaColor } from "../../components/student/ds";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_ARCHIVO_DESCARGABLE_NOMBRE,
  FIELD_ARCHIVO_DESCARGABLE_URL,
} from "../../constants";
import { formatDate, normalizeStringForComparison, parseToUTCDate } from "../../utils/formatters";
import { isEmbedded } from "../../utils/isEmbedded";
import type { LanzamientoPPS } from "../../types";
import { getMandatoryLaunchSchedules } from "../../utils/scheduleRequirements";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtShort = (raw?: unknown): string => {
  if (!raw) return "";
  const f = formatDate(raw as string);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(f);
  if (!m) return f;
  return `${parseInt(m[1], 10)} ${MESES[parseInt(m[2], 10) - 1] ?? ""}`.trim();
};

const OPEN_STATES = ["abierta", "abierto"];

interface DetailStatProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
}
const DetailStat: React.FC<DetailStatProps> = ({ label, value, unit }) => (
  <div className="detail-stat">
    <div className="mono detail-stat__lbl">{label}</div>
    <div className="detail-stat__val display">
      {value}
      {unit ? <span className="detail-stat__u">{unit}</span> : null}
    </div>
  </div>
);

interface TimelineStep {
  label: string;
  date: string;
  state: "done" | "active" | "future";
}
const DetailTimeline: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => (
  <div className="dtl">
    {steps.map((s, i) => (
      <div key={i} className={`dtl__step is-${s.state}`}>
        <div className="dtl__node" />
        <div className="mono dtl__lbl">{s.label}</div>
        <div className="dtl__date">{s.date || "—"}</div>
      </div>
    ))}
  </div>
);

const StudentConvocatoriaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { authenticatedUser } = useAuth();
  const { openSeleccionadosModal, showModal } = useModal();
  const {
    lanzamientos,
    allLanzamientos,
    enrollmentMap,
    enrollStudent,
    cancelEnrollment,
    isLoading,
  } = useStudentPanel();
  const [pendingCancel, setPendingCancel] = useState(false);

  const seleccionadosMutation = useMutation({
    mutationFn: async (l: LanzamientoPPS) => {
      if (authenticatedUser?.legajo === "99999") return null;
      return fetchSeleccionados(l);
    },
    onSuccess: (data, l) => {
      const title = (l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Convocatoria";
      openSeleccionadosModal(data, title);
    },
    onError: (error: any) => showModal("Error", error.message),
  });

  const lanzamiento: LanzamientoPPS | undefined = useMemo(() => {
    const pools = [lanzamientos ?? [], allLanzamientos ?? []];
    for (const pool of pools) {
      const found = pool.find((l) => l.id === id);
      if (found) return found;
    }
    return undefined;
  }, [id, lanzamientos, allLanzamientos]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/student");
  };

  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
      className="ed"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{
        minHeight: "100vh",
        background: isEmbedded() ? "transparent" : resolvedTheme === "dark" ? "#0a0e1a" : "#fafaf7",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{
          background: "color-mix(in oklab, var(--bg) 86%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <button
          type="button"
          onClick={goBack}
          aria-label="Volver"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-sunken)]"
          style={{ color: "var(--ink)" }}
        >
          <Icon name="arrowback" size={18} />
        </button>
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-muted)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Convocatoria
        </span>
        <span className="h-9 w-9" aria-hidden />
      </header>
      <div className="mx-auto w-full max-w-[560px] md:max-w-[1180px] lg:max-w-[1280px] flex-1">
        {children}
      </div>
    </div>
  );

  if (!lanzamiento) {
    return (
      <Shell>
        <div className="px-5 py-16">
          {isLoading ? (
            <div
              className="flex flex-col items-center gap-3 py-10"
              style={{ color: "var(--ink-muted)" }}
            >
              <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span className="mono" style={{ fontSize: 12 }}>
                Cargando convocatoria…
              </span>
            </div>
          ) : (
            <EmptyState
              type="no-convocatorias"
              title="Convocatoria no encontrada"
              message="Es posible que ya no esté disponible o que el enlace haya cambiado."
              size="lg"
              action={
                <button
                  type="button"
                  onClick={() => navigate("/student")}
                  className="rounded-pill px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  Ver convocatorias
                </button>
              }
            />
          )}
        </div>
      </Shell>
    );
  }

  const area = (lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] as string) || "General";
  const areaPrimary = area.split(/[,/]/)[0].trim();
  const color = getAreaColor(areaPrimary);
  const fullName = (lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Convocatoria";
  const shortName = fullName.split(" - ")[0].trim() || fullName;

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const status = normalizeStringForComparison(
    (lanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] as string) || ""
  );
  const isOpen = OPEN_STATES.includes(status);
  const ppsStartDate = parseToUTCDate(lanzamiento[FIELD_FECHA_INICIO_LANZAMIENTOS] as string);
  const isStarted = !!ppsStartDate && ppsStartDate <= today;

  const horas = Number(lanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] || 0);
  const cupos = Number(lanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
  const encuentroRaw =
    lanzamiento[FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS] ||
    lanzamiento[FIELD_FECHA_INICIO_LANZAMIENTOS];
  const encuentro = fmtShort(encuentroRaw);
  const horarios = ((lanzamiento[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] as string) || "")
    .split(/[;\n]/)
    .map((h) => h.trim())
    .filter(Boolean);
  const horariosObligatorios = getMandatoryLaunchSchedules(lanzamiento, horarios);
  const horariosObligatoriosSet = new Set(horariosObligatorios);
  const direccion = (lanzamiento[FIELD_DIRECCION_LANZAMIENTOS] as string) || "";
  const descripcion =
    (lanzamiento[FIELD_DESCRIPCION_LANZAMIENTOS] as string) ||
    "Descripción de la propuesta no disponible.";
  const requisito = String(lanzamiento[FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS] || "").trim();
  const archivoUrl = (lanzamiento[FIELD_ARCHIVO_DESCARGABLE_URL] as string) || "";

  const actividadesRaw = (lanzamiento as Record<string, unknown>).actividades_lista;
  const actividades: string[] = Array.isArray(actividadesRaw)
    ? (actividadesRaw as string[])
    : actividadesRaw
      ? [String(actividadesRaw)]
      : [];

  const inscStart = lanzamiento[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS];
  const inscEnd = lanzamiento[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS];
  const inscDate = inscStart && inscEnd ? `${fmtShort(inscStart)}–${fmtShort(inscEnd)}` : "Abierta";
  const timeline: TimelineStep[] = [
    { label: "Inscripción", date: inscDate, state: isOpen ? "active" : "done" },
    {
      label: "Inicio",
      date: fmtShort(lanzamiento[FIELD_FECHA_INICIO_LANZAMIENTOS]),
      state: isStarted ? "done" : "future",
    },
    { label: "Fin", date: fmtShort(lanzamiento[FIELD_FECHA_FIN_LANZAMIENTOS]), state: "future" },
  ];

  const enrollment = enrollmentMap.get(lanzamiento.id);
  const enrollmentStatus = enrollment
    ? normalizeStringForComparison(
        (enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] as string) || ""
      )
    : null;
  const isSelected =
    enrollmentStatus === "seleccionado" ||
    enrollmentStatus === "adjudicado" ||
    enrollmentStatus === "en curso";
  const isEnrolled = !!enrollment;

  // El CTA refleja el estado de forma reactiva: al inscribirse, enrollmentMap
  // se actualiza y el botón pasa a "Cancelar inscripción" sin salir de la página.
  const handleInscribir = () => {
    enrollStudent.mutate(lanzamiento);
  };
  const confirmCancel = () => {
    if (enrollment) cancelEnrollment.mutate(enrollment.id);
    setPendingCancel(false);
  };

  // Botón secundario "Ver convocados" — disponible cuando la inscripción ya
  // cerró (la lista de seleccionados solo existe a partir de ese momento).
  const verConvocadosBtn = (
    <button
      type="button"
      onClick={() => seleccionadosMutation.mutate(lanzamiento)}
      disabled={seleccionadosMutation.isPending}
      className="feat__cta"
      style={{
        margin: 0,
        background: "transparent",
        color: "var(--ink-soft)",
        border: "1px solid var(--line-strong)",
        boxShadow: "none",
        opacity: seleccionadosMutation.isPending ? 0.7 : 1,
      }}
    >
      {seleccionadosMutation.isPending ? "Cargando…" : "Ver convocados"}
      <Icon name="arrow" size={16} strokeWidth={2.4} />
    </button>
  );

  // CTA reutilizable: barra fija (mobile) + tarjeta de acción (escritorio).
  const renderCta = () => {
    const primary = isSelected ? (
      <button
        type="button"
        disabled
        className="feat__cta"
        style={{ margin: 0, opacity: 0.7, cursor: "default" }}
      >
        Ya estás seleccionado
        <Icon name="check" size={16} strokeWidth={2.4} />
      </button>
    ) : isEnrolled ? (
      <button
        type="button"
        onClick={() => setPendingCancel(true)}
        className="feat__cta"
        style={{ margin: 0, background: "var(--bg-sunken)", color: "var(--ink)" }}
      >
        Cancelar inscripción
        <Icon name="x" size={16} strokeWidth={2.4} />
      </button>
    ) : isOpen ? (
      <button
        type="button"
        onClick={handleInscribir}
        disabled={enrollStudent.isPending}
        className="feat__cta"
        style={{
          margin: 0,
          background: color,
          color: "#fff",
          opacity: enrollStudent.isPending ? 0.75 : 1,
        }}
      >
        {enrollStudent.isPending
          ? "Inscribiendo…"
          : `Inscribirme${cupos ? ` · ${cupos} ${cupos === 1 ? "cupo" : "cupos"}` : ""}`}
        <Icon name="arrow" size={16} strokeWidth={2.4} />
      </button>
    ) : (
      <button
        type="button"
        disabled
        className="feat__cta"
        style={{ margin: 0, opacity: 0.6, cursor: "default" }}
      >
        Inscripción cerrada
      </button>
    );

    // Si la inscripción cerró (o el estudiante ya está seleccionado), ofrecemos
    // también "Ver convocados" — la lista de seleccionados ya existe.
    if (!isOpen || isSelected)
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {primary}
          {verConvocadosBtn}
        </div>
      );
    return primary;
  };

  return (
    <>
      <Shell>
        <div className="px-5 pt-1 pb-4 md:px-8 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-12 md:items-start">
          {/* ── Columna editorial ── */}
          <div className="min-w-0">
            {/* Título editorial */}
            <span className="prow__area" style={{ color, fontSize: 12 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: color,
                  display: "inline-block",
                  marginRight: 6,
                }}
              />
              {area.toUpperCase()} · {isOpen ? "ABIERTA" : "CERRADA"}
            </span>
            <h1
              className="display"
              style={{
                fontSize: "clamp(34px, 4.5vw, 50px)",
                lineHeight: 0.96,
                letterSpacing: "-.04em",
                margin: "10px 0 18px",
              }}
            >
              {shortName}
            </h1>

            {/* Stats — solo mobile (en escritorio van en la tarjeta de acción) */}
            <div className="detail-stats md:hidden">
              <DetailStat
                label="Acredita"
                value={horas === 0 ? "Según recorrido" : horas || "—"}
                unit={horas > 0 ? "hs" : undefined}
              />
              <DetailStat label="Cupos" value={cupos || "—"} />
              <DetailStat label="Encuentro" value={encuentro || "—"} />
              <DetailStat label="Modalidad" value="Pres." />
            </div>

            {/* Descripción */}
            <div className="detail-block">
              <span className="eyebrow" style={{ fontSize: 10.5 }}>
                Descripción
              </span>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--ink-soft)",
                }}
              >
                {descripcion}
              </p>
            </div>

            {requisito ? (
              <div className="detail-block">
                <div
                  role="note"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    padding: "13px 15px",
                    borderRadius: 14,
                    border: "1px solid color-mix(in oklab, #c58a1b 34%, var(--line))",
                    borderLeftWidth: 3,
                    background: "color-mix(in oklab, #c58a1b 7%, var(--bg-elevated))",
                  }}
                >
                  <Icon name="alert" size={18} color="#b7791f" strokeWidth={2.2} />
                  <div>
                    <span className="eyebrow" style={{ color: "#9a6518", fontSize: 10.5 }}>
                      Requisito excluyente
                    </span>
                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "var(--ink)",
                        fontSize: 14,
                        fontWeight: 600,
                        lineHeight: 1.45,
                      }}
                    >
                      {requisito}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Días y horarios */}
            <div className="detail-block">
              <span className="eyebrow" style={{ fontSize: 10.5 }}>
                Días y horarios
              </span>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                }}
              >
                {(horarios.length > 0 ? horarios : ["A definir"]).map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flexShrink: 0, marginTop: 1, lineHeight: 0 }}>
                      <Icon name="cal" size={16} color={color} />
                    </span>
                    <span
                      style={{
                        fontSize: 14.5,
                        fontWeight: 500,
                        color: "var(--ink)",
                        lineHeight: 1.4,
                      }}
                    >
                      {h}
                    </span>
                    {horariosObligatoriosSet.has(h) ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          marginLeft: "auto",
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "color-mix(in oklab, #c58a1b 10%, var(--bg-elevated))",
                          color: "#9a6518",
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: ".04em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Icon name="lock" size={11} strokeWidth={2.4} />
                        Obligatorio
                      </span>
                    ) : horariosObligatorios.length > 0 ? (
                      <span
                        style={{
                          marginLeft: "auto",
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "var(--bg-sunken)",
                          color: "var(--ink-muted)",
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: ".04em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        A elección
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Ubicación + Archivo adjunto — tarjetas emparejadas con alto igualado
                en escritorio. Solo van lado a lado cuando existen ambas; si hay una
                sola, ocupa el ancho completo (así nunca queda una columna a medias). */}
            {direccion || archivoUrl ? (
              <div
                className={
                  direccion && archivoUrl
                    ? "md:grid md:grid-cols-2 md:gap-x-10 md:items-stretch"
                    : undefined
                }
              >
                {/* Ubicación — clickeable a Google Maps */}
                {direccion ? (
                  <div className="detail-block md:flex md:flex-col">
                    <span className="eyebrow" style={{ fontSize: 10.5 }}>
                      Ubicación
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 10,
                        flex: "1 1 auto",
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: "1px solid var(--line)",
                        background: "var(--bg-elevated)",
                        textDecoration: "none",
                      }}
                    >
                      <span
                        className="material-icons"
                        style={{ color, fontSize: 22, flexShrink: 0 }}
                        aria-hidden
                      >
                        place
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--ink)",
                            lineHeight: 1.35,
                          }}
                        >
                          {direccion}
                        </span>
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        Ver mapa
                        <Icon name="arrow" size={13} strokeWidth={2.4} />
                      </span>
                    </a>
                  </div>
                ) : null}

                {/* Archivo adjunto — documento descargable del lanzamiento */}
                {archivoUrl ? (
                  <div className="detail-block md:flex md:flex-col">
                    <span className="eyebrow" style={{ fontSize: 10.5 }}>
                      Archivo adjunto
                    </span>
                    <a
                      href={archivoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 10,
                        flex: "1 1 auto",
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: "1px solid var(--line)",
                        background: "var(--bg-elevated)",
                        textDecoration: "none",
                      }}
                    >
                      <span
                        className="material-icons"
                        style={{ color, fontSize: 22, flexShrink: 0 }}
                        aria-hidden
                      >
                        description
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--ink)",
                            lineHeight: 1.35,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          Documento de la convocatoria
                        </span>
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        Descargar
                        <Icon name="arrow" size={13} strokeWidth={2.4} />
                      </span>
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Vas a */}
            {actividades.length > 0 ? (
              <div className="detail-block">
                <span className="eyebrow" style={{ fontSize: 10.5 }}>
                  Vas a
                </span>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  {actividades.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: color,
                          marginTop: 7,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--ink-soft)" }}>
                        {t}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Cronograma */}
            <div className="detail-block" style={{ borderBottom: 0 }}>
              <span className="eyebrow" style={{ fontSize: 10.5 }}>
                Cronograma
              </span>
              <DetailTimeline steps={timeline} />
            </div>
          </div>
          {/* ── Tarjeta de acción — escritorio (sticky) ── */}
          <aside className="hidden md:block md:sticky md:top-[88px]">
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 18,
                background: "var(--bg-elevated)",
                padding: 20,
                boxShadow: "var(--sh-md)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 18,
                }}
              >
                {[
                  {
                    l: "Acredita",
                    v: horas === 0 ? "Según recorrido" : horas || "—",
                    u: horas > 0 ? "hs" : "",
                  },
                  { l: "Cupos", v: cupos || "—", u: "" },
                  { l: "Encuentro", v: encuentro || "—", u: "" },
                  { l: "Modalidad", v: "Pres.", u: "" },
                ].map((s) => (
                  <div key={s.l}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: ".07em",
                        textTransform: "uppercase",
                        color: "var(--ink-muted)",
                        marginBottom: 5,
                      }}
                    >
                      {s.l}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        letterSpacing: "-.03em",
                        color: "var(--ink)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {s.v}
                      {s.u ? (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--ink-muted)",
                            fontWeight: 500,
                            marginLeft: 2,
                          }}
                        >
                          {s.u}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {renderCta()}
              <p
                className="mono"
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: "var(--ink-subtle)",
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                Te avisamos por correo si quedás seleccionado/a.
              </p>
            </div>
          </aside>
        </div>

        {/* CTA fija — solo mobile */}
        <div className="cta-bar sticky bottom-0 z-20 md:hidden">{renderCta()}</div>

        <ConfirmModal
          isOpen={pendingCancel}
          title="Cancelar inscripción"
          message={`¿Estás seguro que deseas cancelar tu inscripción a "${shortName}"?\n\nEsta acción no se puede deshacer.`}
          confirmText="Sí, cancelar inscripción"
          cancelText="Volver"
          type="danger"
          onConfirm={confirmCancel}
          onClose={() => setPendingCancel(false)}
        />
      </Shell>
      {/* Modales globales (incluye el formulario de inscripción) montados en
          esta pantalla enfocada, ya que el AppModals del layout no está aquí. */}
      <AppModals />
    </>
  );
};

const StudentConvocatoriaDetailView: React.FC = () => {
  const { authenticatedUser } = useAuth();
  if (!authenticatedUser) return null;
  return (
    <StudentPanelProvider legajo={authenticatedUser.legajo}>
      <StudentConvocatoriaDetail />
    </StudentPanelProvider>
  );
};

export default StudentConvocatoriaDetailView;
