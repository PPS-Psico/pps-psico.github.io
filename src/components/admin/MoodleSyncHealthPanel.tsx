import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import MoodleGradeImportPanel from "./MoodleGradeImportPanel";

interface HealthSummary {
  linkedStudents?: number;
  syncedStudents?: number;
  graded?: number;
  submitted?: number;
  notSubmitted?: number;
  review?: number;
  staleSevenDays?: number;
  partialRunsSevenDays?: number;
  failedRunsSevenDays?: number;
  unlinkedSince2024?: number;
}

const reasonLabels: Record<string, string> = {
  without_launch: "Sin lanzamiento vinculado",
  unrecognized_orientation: "Orientación no reconocida",
  launch_without_confirmed_task: "Lanzamiento sin tarea confirmada",
  orientation_without_active_task: "Orientación sin tarea activa",
};

const MoodleSyncHealthPanel: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
  const [showBacklog, setShowBacklog] = useState(false);
  const healthQuery = useQuery({
    queryKey: ["moodle-sync-health"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moodle_sync_health");
      if (error) throw error;
      return (data ?? {}) as HealthSummary;
    },
    staleTime: 60_000,
  });
  const backlogQuery = useQuery({
    queryKey: ["moodle-unlinked-practices", 2024],
    enabled: enabled && showBacklog,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moodle_unlinked_practices", {
        p_from_year: 2024,
      });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  if (!enabled) return null;
  if (healthQuery.isError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        No se pudo leer el diagnóstico de sincronización.
      </div>
    );
  }

  const health = healthQuery.data ?? {};
  const coverage = health.linkedStudents
    ? Math.round(((health.syncedStudents ?? 0) / health.linkedStudents) * 100)
    : 0;
  const metrics = [
    ["Cobertura", `${health.syncedStudents ?? 0}/${health.linkedStudents ?? 0} · ${coverage}%`],
    ["Calificadas", health.graded ?? 0],
    ["En corrección", health.submitted ?? 0],
    ["Sin entrega", health.notSubmitted ?? 0],
    ["A revisar", health.review ?? 0],
    ["Sin vínculo 2024+", health.unlinkedSince2024 ?? 0],
  ] as const;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
            Salud de la integración
          </p>
          <h3 className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
            Moodle → notas e informes
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowBacklog((value) => !value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300"
        >
          {showBacklog ? "Ocultar pendientes" : "Ver pendientes de vínculo"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            <strong className="block text-sm text-slate-800 dark:text-slate-100">{value}</strong>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {(health.partialRunsSevenDays || health.failedRunsSevenDays || health.staleSevenDays) && (
        <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-400">
          Últimos 7 días: {health.partialRunsSevenDays ?? 0} corridas parciales,{" "}
          {health.failedRunsSevenDays ?? 0} fallidas y {health.staleSevenDays ?? 0} tareas abiertas
          sin lectura reciente.
        </p>
      )}

      {showBacklog && (
        <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
          {backlogQuery.isLoading ? (
            <p className="p-4 text-xs text-slate-500">Cargando vinculaciones pendientes…</p>
          ) : (backlogQuery.data ?? []).length === 0 ? (
            <p className="p-4 text-xs text-emerald-700">No hay PPS pendientes desde 2024.</p>
          ) : (
            backlogQuery.data?.map((row) => (
              <div
                key={row.practica_id}
                className="border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800"
              >
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {row.institucion || "Institución sin nombre"}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {row.estudiante_nombre} · {row.especialidad || "Sin orientación"} ·{" "}
                  {reasonLabels[row.reason_code] ?? row.reason_code}
                </p>
              </div>
            ))
          )}
        </div>
      )}
      <MoodleGradeImportPanel />
    </section>
  );
};

export default MoodleSyncHealthPanel;
