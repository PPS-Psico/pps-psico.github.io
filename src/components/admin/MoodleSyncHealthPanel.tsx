import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { MOODLE_ASSIGN } from "../../hooks/useAulaEntregas";
import MoodleGradeImportPanel from "./MoodleGradeImportPanel";
import MoodleEvidenceInbox from "./MoodleEvidenceInbox";

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

interface DiscrepancyRow {
  practica_id: string;
  estudiante_nombre: string | null;
  estudiante_dni: number | string | null;
  institucion: string | null;
  especialidad: string | null;
  legacy_nota: string | null;
  moodle_status: string | null;
  moodle_grade_display: string | null;
  moodle_suggested_10_scale: number | null;
  observed_at: string;
  comparison_state: string;
  cmid: number | null;
  academic_year: number | null;
}

type DiscrepancyFilterId = "problemas" | "sin_nota" | "difiere" | "texto" | "ok";

const DISCREPANCY_FILTERS: { id: DiscrepancyFilterId; label: string }[] = [
  { id: "problemas", label: "A revisar" },
  { id: "sin_nota", label: "Sin nota" },
  { id: "difiere", label: "Difieren" },
  { id: "texto", label: "Texto" },
  { id: "ok", label: "Coinciden" },
];

const discrepancyStateMeta: Record<string, { label: string; className: string }> = {
  legacy_missing: {
    label: "Sin nota en el panel",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  different_from_moodle: {
    label: "Difiere de Campus",
    className: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },
  legacy_text: {
    label: "Texto no numérico",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  matches_moodle: {
    label: "Coincide",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  not_graded: {
    label: "Sin calificar en Campus",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

const isProblemState = (state: string) =>
  state === "legacy_missing" || state === "different_from_moodle" || state === "legacy_text";

const reasonLabels: Record<string, string> = {
  without_launch: "Sin lanzamiento vinculado",
  unrecognized_orientation: "Orientación no reconocida",
  launch_without_confirmed_task: "Lanzamiento sin tarea confirmada",
  orientation_without_active_task: "Orientación sin tarea activa",
};

const MoodleSyncHealthPanel: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
  const [showBacklog, setShowBacklog] = useState(false);
  const [showDiscrepancies, setShowDiscrepancies] = useState(false);
  const [discrepancyFilter, setDiscrepancyFilter] = useState<DiscrepancyFilterId>("problemas");
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
  const discrepanciesQuery = useQuery({
    queryKey: ["moodle-grade-discrepancies"],
    enabled: enabled && showDiscrepancies,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_moodle_grade_discrepancies");
      if (error) throw error;
      return (data ?? []) as unknown as DiscrepancyRow[];
    },
    staleTime: 60_000,
  });

  const discrepancyRows = useMemo(() => discrepanciesQuery.data ?? [], [discrepanciesQuery.data]);
  const discrepancyCounts = useMemo(() => {
    const counts = { sin_nota: 0, difiere: 0, texto: 0, ok: 0 };
    for (const row of discrepancyRows) {
      if (row.comparison_state === "legacy_missing") counts.sin_nota += 1;
      else if (row.comparison_state === "different_from_moodle") counts.difiere += 1;
      else if (row.comparison_state === "legacy_text") counts.texto += 1;
      else if (row.comparison_state === "matches_moodle") counts.ok += 1;
    }
    return counts;
  }, [discrepancyRows]);
  const filteredDiscrepancies = useMemo(() => {
    if (discrepancyFilter === "ok")
      return discrepancyRows.filter((row) => row.comparison_state === "matches_moodle");
    if (discrepancyFilter === "sin_nota")
      return discrepancyRows.filter((row) => row.comparison_state === "legacy_missing");
    if (discrepancyFilter === "difiere")
      return discrepancyRows.filter((row) => row.comparison_state === "different_from_moodle");
    if (discrepancyFilter === "texto")
      return discrepancyRows.filter((row) => row.comparison_state === "legacy_text");
    return discrepancyRows.filter((row) => isProblemState(row.comparison_state));
  }, [discrepancyFilter, discrepancyRows]);
  const problemCount =
    discrepancyCounts.sin_nota + discrepancyCounts.difiere + discrepancyCounts.texto;

  if (!enabled) return null;
  if (healthQuery.isError) {
    return (
      <>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          No se pudo leer el diagnóstico de sincronización.
        </div>
        <MoodleEvidenceInbox enabled={enabled} />
      </>
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowDiscrepancies((value) => !value)}
            className={`relative rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              showDiscrepancies
                ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                : "border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            Discrepancias de notas
            {!showDiscrepancies && (
              <span className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                {problemCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowBacklog((value) => !value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300"
          >
            {showBacklog ? "Ocultar pendientes" : "Ver pendientes de vínculo"}
          </button>
        </div>
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
      {showDiscrepancies && (
        <div className="mt-4">
          {discrepanciesQuery.isLoading ? (
            <p className="p-4 text-xs text-slate-500">Comparando notas del panel contra Campus…</p>
          ) : discrepanciesQuery.isError ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              No se pudieron leer las discrepancias.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {DISCREPANCY_FILTERS.map((filter) => {
                  const count =
                    filter.id === "problemas"
                      ? problemCount
                      : discrepancyCounts[filter.id as keyof typeof discrepancyCounts];
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setDiscrepancyFilter(filter.id)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                        discrepancyFilter === filter.id
                          ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {filter.label} · {count}
                    </button>
                  );
                })}
              </div>

              {problemCount === 0 ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Todas las notas calificadas coinciden con Campus.
                </p>
              ) : (
                <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Estudiante</th>
                        <th className="px-3 py-2 font-semibold">PPS / Institución</th>
                        <th className="px-3 py-2 font-semibold">Campus</th>
                        <th className="px-3 py-2 font-semibold">Panel</th>
                        <th className="px-3 py-2 font-semibold">Estado</th>
                        <th className="px-3 py-2 font-semibold">Leído</th>
                        <th className="px-3 py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDiscrepancies.map((row) => {
                        const meta = discrepancyStateMeta[row.comparison_state];
                        return (
                          <tr
                            key={`${row.practica_id}-${row.cmid ?? "sincmid"}`}
                            className="text-slate-700 dark:text-slate-200"
                          >
                            <td className="px-3 py-2">
                              <span className="font-semibold">
                                {row.estudiante_nombre || "Estudiante"}
                              </span>
                              {row.estudiante_dni != null && (
                                <span className="ml-1.5 text-[10px] text-slate-400">
                                  DNI {String(row.estudiante_dni)}
                                </span>
                              )}
                            </td>
                            <td className="max-w-[220px] truncate px-3 py-2">
                              {row.institucion || "Sin institución"}
                              <span className="block text-[10px] text-slate-400">
                                {row.especialidad || "Sin orientación"}
                                {row.academic_year ? ` · ${row.academic_year}` : ""}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">
                              {row.moodle_grade_display ?? "—"}
                              {row.moodle_suggested_10_scale != null && (
                                <span className="ml-1 font-sans text-[10px] text-emerald-600">
                                  → {row.moodle_suggested_10_scale}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">
                              {row.legacy_nota?.trim() || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  meta?.className ??
                                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {meta?.label ?? row.comparison_state}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-[10px] text-slate-500">
                              {new Date(row.observed_at).toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {row.cmid != null && (
                                <a
                                  href={`${MOODLE_ASSIGN}${row.cmid}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                                >
                                  Campus ↗
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredDiscrepancies.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                            Nada en esta categoría.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <MoodleGradeImportPanel />
      <MoodleEvidenceInbox enabled={enabled} />
    </section>
  );
};

export default MoodleSyncHealthPanel;
