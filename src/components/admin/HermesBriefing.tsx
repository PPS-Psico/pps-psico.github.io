import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DailyBrief, DailyBriefMetrics } from "../../hooks/useAgentSuggestions";
import type { SmartInsight, PriorityLevel } from "../../hooks/useSmartAnalysis";

// ─── Sub-component: Metric Pill ───────────────────────────────────────────────

const MetricPill: React.FC<{
  label: string;
  value: number | string;
  icon: string;
  color?: "blue" | "emerald" | "amber" | "rose";
}> = ({ label, value, icon, color = "blue" }) => {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40",
    emerald:
      "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40",
    amber:
      "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40",
    rose: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40",
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${colorMap[color]}`}
    >
      <span className="material-icons !text-sm">{icon}</span>
      <span>{value}</span>
      <span className="font-normal opacity-70">{label}</span>
    </div>
  );
};

// ─── Sub-component: Status Badge ──────────────────────────────────────────────

const StatusBadge: React.FC<{ status: DailyBrief["estado_operativo"] }> = ({ status }) => {
  const cfg = {
    estable: {
      color: "#10b981",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200 dark:border-emerald-800/50",
      text: "text-emerald-700 dark:text-emerald-300",
      icon: "check_circle",
      label: "Operación estable",
    },
    alerta: {
      color: "#f59e0b",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-800/50",
      text: "text-amber-700 dark:text-amber-300",
      icon: "warning_amber",
      label: "Alertas activas",
    },
    critico: {
      color: "#f43f5e",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      border: "border-rose-200 dark:border-rose-800/50",
      text: "text-rose-700 dark:text-rose-300",
      icon: "gavel",
      label: "Acción requerida",
    },
  };

  const c = cfg[status] ?? cfg.estable;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${c.bg} ${c.border}`}
    >
      <span className={`material-icons !text-sm ${c.text}`}>{c.icon}</span>
      <span className={`text-xs font-black uppercase tracking-wide ${c.text}`}>{c.label}</span>
    </div>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface HermesBriefingProps {
  // Hermes data (from useAgentSuggestions)
  dailyBrief: DailyBrief | null | undefined;
  isLoading: boolean;
  // Fallback: existing SmartBriefing props (from useSmartAnalysis)
  fallbackStatus?: PriorityLevel;
  fallbackSummary?: string;
  fallbackInsights?: SmartInsight[];
  fallbackSignals?: string[];
  userName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const HermesBriefing: React.FC<HermesBriefingProps> = ({
  dailyBrief,
  isLoading,
  fallbackStatus = "ok",
  fallbackSummary = "",
  userName,
}) => {
  const [greeting, setGreeting] = React.useState("");
  const [currentDate, setCurrentDate] = React.useState("");

  React.useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting("Buenos días");
    else if (hour >= 12 && hour < 20) setGreeting("Buenas tardes");
    else setGreeting("Buenas noches");

    setCurrentDate(
      new Date().toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  const hasHermesData = !isLoading && !!dailyBrief;
  const status = hasHermesData
    ? dailyBrief!.estado_operativo
    : fallbackStatus === "critical"
      ? "critico"
      : fallbackStatus === "warning"
        ? "alerta"
        : "estable";
  const glowColor = status === "critico" ? "#f43f5e" : status === "alerta" ? "#f59e0b" : "#3b82f6";

  const metricas: DailyBriefMetrics = dailyBrief?.metricas ?? {};

  return (
    <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white border border-slate-200 dark:border-white/5 transition-all duration-500 shadow-sm">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 12, repeat: Infinity }}
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[120px]"
          style={{ backgroundColor: glowColor + "20" }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] dark:opacity-10 mix-blend-overlay" />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 px-8 pt-8 pb-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
            {hasHermesData ? (
              <>
                <span className="material-icons !text-sm text-violet-500">smart_toy</span>
                Hermes · Brief del día
              </>
            ) : (
              "Panel de Control"
            )}
          </p>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {greeting},{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              {userName.split(" ")[0]}
            </span>
            .
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 shadow-sm">
            <span className="material-icons text-slate-400 !text-lg">calendar_today</span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 capitalize">
              {currentDate}
            </span>
          </div>
          {hasHermesData && <StatusBadge status={dailyBrief!.estado_operativo} />}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="relative z-10 p-6 sm:px-8 sm:pb-8 sm:pt-5 space-y-5">
        {/* Summary */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="h-5 w-3/4 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-5 w-1/2 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700"
            >
              <p className="text-lg sm:text-xl text-slate-700 dark:text-slate-200 font-bold leading-tight tracking-tight">
                {hasHermesData
                  ? dailyBrief!.resumen
                  : fallbackSummary || "Cargando análisis del día..."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metrics row (only if Hermes data) */}
        {hasHermesData && Object.keys(metricas).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap gap-2"
          >
            {metricas.emails_procesados !== undefined && (
              <MetricPill
                label="emails procesados"
                value={metricas.emails_procesados}
                icon="mail"
                color="blue"
              />
            )}
            {metricas.instituciones_respondidas !== undefined && (
              <MetricPill
                label="instituciones respondidas"
                value={metricas.instituciones_respondidas}
                icon="business"
                color="emerald"
              />
            )}
            {metricas.borradores_pendientes !== undefined && (
              <MetricPill
                label="borradores para revisar"
                value={metricas.borradores_pendientes}
                icon="edit_note"
                color={metricas.borradores_pendientes > 0 ? "amber" : "emerald"}
              />
            )}
            {metricas.tasa_confianza !== undefined && (
              <MetricPill
                label="confianza IA"
                value={`${Math.round((metricas.tasa_confianza as number) * 100)}%`}
                icon="psychology"
                color="blue"
              />
            )}
          </motion.div>
        )}

        {hasHermesData && dailyBrief!.bullets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid gap-2 md:grid-cols-2"
          >
            {dailyBrief!.bullets.slice(0, 4).map((bullet, index) => {
              const tone =
                bullet.prioridad === "alta"
                  ? "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100"
                  : bullet.prioridad === "media"
                    ? "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
                    : "border-slate-200 bg-slate-50/80 text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100";

              return (
                <div key={`${bullet.titulo}-${index}`} className={`rounded-2xl border p-3 ${tone}`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-[10px] font-black uppercase tracking-wider opacity-60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black leading-snug">{bullet.titulo}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-80">
                        {bullet.accion_sugerida || bullet.por_que}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* No Hermes data message */}
        {!isLoading && !hasHermesData && (
          <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <span className="material-icons !text-sm">info</span>
            Sin brief generado hoy — Hermes actualizará el análisis más tarde.
          </p>
        )}
      </div>
    </div>
  );
};

export default HermesBriefing;
