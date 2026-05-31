// ──────────────────────────────────────────────────────────────────────────
// Dashboard de Inteligencia Hermes (Paper & Ink)
//
// Vista interactiva de TODO lo que el agente acumula en Supabase:
//   · Actividad      → sugerencias generadas, aceptación, tipos
//   · Confiabilidad  → invocaciones, errores, latencia por herramienta
//   · Vínculo        → instituciones frías / con pendientes (institucion_resumen)
//   · Comunicaciones → volumen Gmail + WhatsApp por mes
//
// Solo lectura. Imprimible (window.print) reusando los estilos print de v3.
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import useHermesIntelligence, { tipoLabel, tagLabel } from "../../../hooks/useHermesIntelligence";
import type { HermesIntelligence } from "../../../hooks/useHermesIntelligence";
import { fmt } from "./MetricasPrimitives";
import Loader from "../../Loader";
import EmptyState from "../../EmptyState";

const pct = (v: number | null | undefined): string => (v == null ? "—" : `${Math.round(v * 100)}%`);

const dur = (ms: number | null): string => {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
};

const relTime = (iso: string | null): string => {
  if (!iso) return "sin actividad";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "sin actividad";
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
};

// ── Primitivas locales ──────────────────────────────────────────────────────

const StatCard: React.FC<{
  value: string | number;
  label: string;
  context?: string;
  tone?: "ink" | "ok" | "warn" | "accent" | "ai";
}> = ({ value, label, context, tone = "ink" }) => {
  const colorVar =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "accent"
          ? "var(--accent)"
          : tone === "ai"
            ? "var(--ai)"
            : "var(--ink)";
  return (
    <div className="kpi" style={{ cursor: "default" }}>
      <span className="eyebrow">{label}</span>
      <span className="mono num" style={{ color: colorVar }}>
        {value}
      </span>
      {context && <span className="ctx">{context}</span>}
    </div>
  );
};

// Barra de progreso horizontal simple (para tasas de aceptación por tipo).
const RateBar: React.FC<{ label: string; total: number; rate: number | null; sub: string }> = ({
  label,
  total,
  rate,
  sub,
}) => {
  const widthPct = rate == null ? 0 : Math.round(rate * 100);
  const color =
    rate == null
      ? "var(--ink-4)"
      : rate >= 0.7
        ? "var(--ok)"
        : rate >= 0.4
          ? "var(--accent)"
          : "var(--warn)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
        <span className="mono" style={{ fontSize: 12.5, color, fontWeight: 600 }}>
          {rate == null ? "—" : `${widthPct}%`}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "var(--paper-2)",
          border: "1px solid var(--rule-2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${widthPct}%`,
            background: color,
            borderRadius: 999,
            transition: "width .5s cubic-bezier(.3,.7,.4,1)",
          }}
        />
      </div>
      <span className="meta" style={{ fontSize: 11.5 }}>
        {fmt(total)} en total · {sub}
      </span>
    </div>
  );
};

// Mini gráfico de barras agrupadas para comunicaciones por mes.
const MonthlyBars: React.FC<{
  data: { mes: string; gmail: number; whatsapp: number }[];
}> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => Math.max(d.gmail, d.whatsapp)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-3)",
          }}
        >
          <span className="dot" style={{ background: "var(--accent)", width: 8, height: 8 }} /> Mail
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-3)",
          }}
        >
          <span className="dot" style={{ background: "var(--ok)", width: 8, height: 8 }} /> WhatsApp
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${data.length}, 1fr)`,
          gap: 12,
          alignItems: "end",
          height: 160,
        }}
      >
        {data.map((d) => (
          <div
            key={d.mes}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <div style={{ display: "flex", alignItems: "end", gap: 4, height: 120 }}>
              <div
                title={`${d.gmail} mails`}
                className="bar"
                style={{
                  width: 14,
                  height: `${(d.gmail / max) * 100}%`,
                  background: "var(--accent)",
                  minHeight: d.gmail > 0 ? 3 : 0,
                }}
              />
              <div
                title={`${d.whatsapp} mensajes`}
                className="bar"
                style={{
                  width: 14,
                  height: `${(d.whatsapp / max) * 100}%`,
                  background: "var(--ok)",
                  minHeight: d.whatsapp > 0 ? 3 : 0,
                }}
              />
            </div>
            <span className="meta mono" style={{ fontSize: 10.5 }}>
              {d.mes}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ eyebrow: string; title: string }> = ({ eyebrow, title }) => (
  <div style={{ marginBottom: 16 }}>
    <span className="eyebrow">{eyebrow}</span>
    <h2
      className="display"
      style={{ margin: "4px 0 0", fontSize: 26, lineHeight: 1, letterSpacing: "-0.01em" }}
    >
      {title}
    </h2>
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  isTestingMode?: boolean;
}

export const HermesIntelligenceDashboard: React.FC<Props> = ({ isTestingMode = false }) => {
  const { data, isLoading, error } = useHermesIntelligence(isTestingMode);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="error"
        title="No pudimos cargar la inteligencia de Hermes"
        message={(error as Error)?.message || "Error desconocido"}
      />
    );
  }

  if (!data) return null;

  const d: HermesIntelligence = data;
  const { activity, audit, vinculo, comunicaciones, aprendizajes } = d;

  const sinDatos =
    activity.totalSuggestions === 0 &&
    audit.totalInvocations === 0 &&
    vinculo.totalConResumen === 0 &&
    comunicaciones.gmailTotal === 0 &&
    comunicaciones.whatsappTotal === 0 &&
    aprendizajes.total === 0;

  if (sinDatos) {
    return (
      <EmptyState
        icon="smart_toy"
        title="Hermes todavía no registró actividad"
        message="Cuando el agente empiece a generar sugerencias, analizar correos o resumir instituciones, este panel se va a poblar solo."
      />
    );
  }

  const emitido = new Date(d.generatedAt).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="hermes-intel" style={{ padding: "32px 0 0" }}>
      {/* — Encabezado — */}
      <div
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
          <span
            className="eyebrow"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span className="material-icons" style={{ fontSize: 14, color: "var(--ai)" }}>
              smart_toy
            </span>
            Inteligencia del agente · uso interno
          </span>
          <h2
            className="display"
            style={{ margin: "6px 0 0", fontSize: 30, letterSpacing: "-0.01em", lineHeight: 1 }}
          >
            Qué viene haciendo Hermes
          </h2>
        </div>
        <button
          className="btn btn-primary press no-print"
          onClick={() => window.print()}
          type="button"
        >
          <span className="material-icons" style={{ fontSize: 17 }}>
            print
          </span>
          Imprimir / PDF
        </button>
      </div>

      {/* — Banda 1: actividad global — */}
      <div className="grid grid-4" style={{ marginTop: 22 }}>
        <StatCard
          value={fmt(activity.totalSuggestions)}
          label="Sugerencias generadas"
          context="Propuestas totales del agente"
          tone="ai"
        />
        <StatCard
          value={pct(activity.globalAcceptance)}
          label="Tasa de aceptación"
          context="Aprobadas o editadas vs. resueltas"
          tone={
            activity.globalAcceptance != null && activity.globalAcceptance >= 0.6 ? "ok" : "accent"
          }
        />
        <StatCard
          value={fmt(activity.estados.pending)}
          label="Pendientes de revisar"
          context="Esperando tu decisión"
          tone={activity.estados.pending > 0 ? "warn" : "ink"}
        />
        <StatCard
          value={relTime(audit.ultimaActividad)}
          label="Última actividad"
          context="Última vez que Hermes corrió"
          tone="ink"
        />
      </div>

      {/* — Banda 2: aceptación por tipo — */}
      {activity.byType.length > 0 && (
        <section className="band top" style={{ paddingBottom: 0 }}>
          <SectionTitle
            eyebrow="Por tipo de propuesta"
            title="Qué tanto le acertás a tu criterio"
          />
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {activity.byType.map((t) => (
                <RateBar
                  key={t.tipo}
                  label={tipoLabel(t.tipo)}
                  total={t.total}
                  rate={t.acceptanceRate}
                  sub={`${t.approved} aprob · ${t.edited} editadas · ${t.discarded} descartadas · ${t.pending} pend`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* — Banda 3: confiabilidad técnica — */}
      <section className="band top">
        <SectionTitle eyebrow="Confiabilidad" title="Salud técnica del agente" />
        <div className="grid grid-4" style={{ marginBottom: 18 }}>
          <StatCard
            value={fmt(audit.totalInvocations)}
            label="Invocaciones"
            context="Llamadas registradas"
            tone="ink"
          />
          <StatCard
            value={pct(audit.errorRate)}
            label="Tasa de error"
            context={`${fmt(audit.errores)} con error`}
            tone={audit.errorRate != null && audit.errorRate > 0.1 ? "warn" : "ok"}
          />
          <StatCard
            value={dur(audit.avgDurationMs)}
            label="Latencia media"
            context="Por invocación"
            tone="ink"
          />
          <StatCard
            value={fmt(audit.porTool.length)}
            label="Herramientas activas"
            context="Tipos de tareas distintas"
            tone="ink"
          />
        </div>
        {audit.porTool.length > 0 && (
          <div className="card">
            <div className="label" style={{ marginBottom: 12 }}>
              Actividad por herramienta
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {audit.porTool.slice(0, 8).map((t, i) => (
                <div
                  key={t.tool}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    gap: 14,
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--rule-2)",
                  }}
                >
                  <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                    {t.tool}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}
                  >
                    {fmt(t.total)}
                  </span>
                  <span
                    className="meta"
                    style={{ fontSize: 11.5, minWidth: 64, textAlign: "right" }}
                  >
                    {t.errores > 0 ? `${t.errores} err` : "sin errores"}
                  </span>
                  <span
                    className="meta mono"
                    style={{ fontSize: 11.5, minWidth: 56, textAlign: "right" }}
                  >
                    {dur(t.avgMs)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* — Banda 4: salud del vínculo institucional — */}
      <section className="band top">
        <SectionTitle eyebrow="CRM de Hermes" title="Salud del vínculo con instituciones" />
        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <StatCard
            value={fmt(vinculo.totalConResumen)}
            label="Instituciones con memoria"
            context="Hermes mantiene un resumen vivo"
            tone="ai"
          />
          <StatCard
            value={fmt(vinculo.frias)}
            label="Vínculos fríos"
            context="Sin contacto hace +30 días"
            tone={vinculo.frias > 0 ? "warn" : "ok"}
          />
          <StatCard
            value={fmt(vinculo.conPendientes)}
            label="Con pendientes abiertos"
            context="Tienen algo concreto sin cerrar"
            tone={vinculo.conPendientes > 0 ? "accent" : "ink"}
          />
        </div>
        {vinculo.destacadas.length > 0 && (
          <div className="card">
            <div className="label" style={{ marginBottom: 4 }}>
              Las que más atención piden
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {vinculo.destacadas.map((inst, i) => (
                <div
                  key={inst.institucion_id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "14px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--rule-2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>
                      {inst.nombre}
                    </span>
                    <span
                      className="meta mono"
                      style={{
                        fontSize: 11.5,
                        whiteSpace: "nowrap",
                        color:
                          inst.diasSinContacto != null && inst.diasSinContacto > 30
                            ? "var(--warn)"
                            : "var(--ink-3)",
                      }}
                    >
                      {inst.diasSinContacto == null
                        ? "sin fecha"
                        : `${inst.diasSinContacto}d · ${inst.ultimo_canal ?? "—"}`}
                    </span>
                  </div>
                  {inst.resumen && (
                    <p className="meta" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                      {inst.resumen.length > 220 ? `${inst.resumen.slice(0, 220)}…` : inst.resumen}
                    </p>
                  )}
                  {inst.pendientes.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {inst.pendientes.slice(0, 4).map((p, j) => (
                        <span
                          key={j}
                          className="tl-chip"
                          style={{ ["--chip" as string]: "var(--warn)", fontSize: 11 }}
                        >
                          {p.length > 60 ? `${p.slice(0, 60)}…` : p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* — Banda 5: comunicaciones — */}
      <section className="band top">
        <SectionTitle eyebrow="Canales" title="Comunicaciones que ve Hermes" />
        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <StatCard
            value={fmt(comunicaciones.gmailTotal)}
            label="Hilos de mail"
            context="En la casilla PPS"
            tone="accent"
          />
          <StatCard
            value={fmt(comunicaciones.gmailEsperando)}
            label="Esperando respuesta"
            context="Hilos sin contestar"
            tone={comunicaciones.gmailEsperando > 0 ? "warn" : "ok"}
          />
          <StatCard
            value={fmt(comunicaciones.whatsappTotal)}
            label="Mensajes WhatsApp"
            context="Lista «Instituciones»"
            tone="ok"
          />
        </div>
        <div className="card">
          <div className="label" style={{ marginBottom: 16 }}>
            Volumen de los últimos 6 meses
          </div>
          <MonthlyBars data={comunicaciones.porMes} />
        </div>
      </section>

      {/* — Banda 6: aprendizajes destilados — */}
      <section className="band top">
        <SectionTitle eyebrow="Loop de mejora" title="Qué fue aprendiendo Hermes" />
        {aprendizajes.total === 0 ? (
          <div className="card">
            <p className="meta" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              Todavía no hay lecciones registradas. Cada vez que apruebes, edites o descartes una
              propuesta de Hermes, el agente destila una lección concreta (sobre tono, criterio o
              contenido) y aparece acá. Es el mecanismo con el que se va afinando a tu forma de
              trabajar.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-4" style={{ marginBottom: 18 }}>
              <StatCard
                value={fmt(aprendizajes.total)}
                label="Lecciones aprendidas"
                context="Ajustes destilados del feedback"
                tone="ai"
              />
              {aprendizajes.porTag.slice(0, 3).map((t) => (
                <StatCard
                  key={t.tag}
                  value={fmt(t.total)}
                  label={tagLabel(t.tag)}
                  context="Lecciones de esta categoría"
                  tone="ink"
                />
              ))}
            </div>
            <div className="card">
              <div className="label" style={{ marginBottom: 4 }}>
                Últimas lecciones
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {aprendizajes.recientes.map((a, i) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      padding: "14px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--rule-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 12,
                      }}
                    >
                      <span
                        className="tl-chip"
                        style={{ ["--chip" as string]: "var(--ai)", fontSize: 11 }}
                      >
                        {tagLabel(a.tag)}
                      </span>
                      <span className="meta mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                        {relTime(a.created_at)}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "var(--ink)",
                        margin: 0,
                        fontWeight: 500,
                      }}
                    >
                      {a.aprendizaje}
                    </p>
                    {a.aplica_cuando && (
                      <p className="meta" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                        <span style={{ fontWeight: 600 }}>Aplica cuando:</span> {a.aplica_cuando}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* — Footer del reporte — */}
      <div
        style={{
          marginTop: 28,
          paddingTop: 14,
          borderTop: "1px solid var(--rule-2)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <span
          className="meta"
          style={{ fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span className="material-icons" style={{ fontSize: 14, color: "var(--ink-3)" }}>
            shield
          </span>
          Datos del registro interno de Hermes. El agente solo detecta y propone; nunca envía ni
          cambia estados.
        </span>
        <span className="meta mono" style={{ fontSize: 11 }}>
          Emitido {emitido}
        </span>
      </div>
    </section>
  );
};

export default HermesIntelligenceDashboard;
