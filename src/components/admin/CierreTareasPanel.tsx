import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import {
  useMoodleTaskCloseState,
  type MoodleTaskCloseState,
} from "../../hooks/useMoodleTaskCloseState";
import Loader from "../Loader";
import EmptyState from "../EmptyState";
import Toast from "../ui/Toast";

const MOODLE_EDIT = "https://campus.uflo.edu.ar/course/modedit.php?update=";

interface TaskRow extends MoodleTaskCloseState {
  institucion: string;
  area: string;
  academicYear: number | null;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const CierreTareasPanel: React.FC = () => {
  const { closeStateByCmid, isLoading: isCloseStateLoading, refetch } = useMoodleTaskCloseState();
  const [busyCmid, setBusyCmid] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const { data: catalog = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: ["aula-entregas-catalogo-cierre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aula_entregas")
        .select("moodle_id, institucion, area, academic_year")
        .eq("course_id", 3615);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const rows = useMemo<TaskRow[]>(() => {
    return catalog
      .map((task): TaskRow | null => {
        const state = closeStateByCmid.get(String(task.moodle_id));
        if (!state) return null;
        return {
          ...state,
          institucion: task.institucion,
          area: task.area,
          academicYear: task.academic_year,
        };
      })
      .filter((row): row is TaskRow => row !== null);
  }, [catalog, closeStateByCmid]);

  const closable = useMemo(
    () =>
      rows
        .filter((row) => row.isClosable)
        .sort((a, b) => (a.suggestedCutoffAt ?? "").localeCompare(b.suggestedCutoffAt ?? "")),
    [rows]
  );
  const waiting = useMemo(
    () => rows.filter((row) => row.isEligible && !row.isClosable && !row.closedAt),
    [rows]
  );
  const closed = useMemo(
    () =>
      rows
        .filter((row) => row.closedAt)
        .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "")),
    [rows]
  );

  const runClose = async (row: TaskRow) => {
    if (!row.suggestedCutoffAt) return;
    const confirmed = window.confirm(
      `¿Ya cargaste la Fecha límite ${formatDate(row.suggestedCutoffAt)} en Moodle para "${row.institucion}"?\n\n` +
        "Esto solo registra el cierre en el panel. No toca Campus."
    );
    if (!confirmed) return;

    setBusyCmid(row.cmid);
    try {
      const { error } = await supabase.rpc("close_moodle_task_v1", {
        p_cmid: Number(row.cmid),
        p_cutoff_at: row.suggestedCutoffAt,
      });
      if (error) throw error;
      await refetch();
      setToastInfo({ message: `Cierre registrado para ${row.institucion}.`, type: "success" });
    } catch (error) {
      setToastInfo({
        message: error instanceof Error ? error.message : "No se pudo registrar el cierre.",
        type: "error",
      });
    } finally {
      setBusyCmid(null);
    }
  };

  const runReopen = async (row: TaskRow) => {
    if (!window.confirm(`¿Deshacer el registro de cierre de "${row.institucion}"?`)) return;
    setBusyCmid(row.cmid);
    try {
      const { error } = await supabase.rpc("reopen_moodle_task_v1", { p_cmid: Number(row.cmid) });
      if (error) throw error;
      await refetch();
      setToastInfo({ message: `Cierre deshecho para ${row.institucion}.`, type: "warning" });
    } catch (error) {
      setToastInfo({
        message: error instanceof Error ? error.message : "No se pudo reabrir.",
        type: "error",
      });
    } finally {
      setBusyCmid(null);
    }
  };

  if (isCloseStateLoading || isCatalogLoading) return <Loader />;

  return (
    <div className="space-y-6">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-600 dark:text-slate-300">
        <p className="font-semibold text-slate-800 dark:text-slate-100">Cómo se cierra una tarea</p>
        <p className="mt-1">
          Cerrar es poner la <strong>Fecha límite</strong> en Moodle: desde ese día el estudiante ya
          no puede subir el informe. La corrección sigue después, con los 30 días de cada jefe de
          área. El panel no toca Campus — abrí la tarea, cargá la fecha y volvé a registrarlo acá.
        </p>
        <p className="mt-2">
          La fecha sale de la primera entrega observada + 30 días. Solo aplica a las tareas del
          modelo nuevo, donde cada PPS lanzada estrena su propia tarea. Las compartidas entre varias
          cohortes quedan fuera: cerrarlas dejaría afuera a los que todavía no terminaron.
        </p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
          Listas para cerrar <span className="text-slate-400 font-normal">({closable.length})</span>
        </h3>
        {closable.length === 0 ? (
          <EmptyState
            icon="check_circle"
            title="No hay tareas para cerrar"
            message="Cuando una tarea del modelo nuevo cumpla 30 días desde su primera entrega, va a aparecer acá."
          />
        ) : (
          <div className="space-y-2">
            {closable.map((row) => (
              <div
                key={row.cmid}
                className="flex flex-col md:flex-row md:items-center gap-3 justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                    {row.institucion}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {row.area} · {row.academicYear ?? "—"} · Primera entrega{" "}
                    {formatDate(row.firstSubmittedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      Fecha límite a cargar
                    </p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {formatDate(row.suggestedCutoffAt)}
                    </p>
                  </div>
                  <a
                    href={`${MOODLE_EDIT}${row.cmid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    Abrir en Moodle
                  </a>
                  <button
                    type="button"
                    disabled={busyCmid === row.cmid}
                    onClick={() => void runClose(row)}
                    className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {busyCmid === row.cmid ? "Registrando…" : "Registrar cierre"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {waiting.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Del modelo nuevo, todavía abiertas{" "}
            <span className="text-slate-400 font-normal">({waiting.length})</span>
          </h3>
          <div className="space-y-2">
            {waiting.map((row) => (
              <div
                key={row.cmid}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {row.institucion}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {row.area} · {row.academicYear ?? "—"}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  {row.firstSubmittedAt
                    ? `Cierra el ${formatDate(row.suggestedCutoffAt)}`
                    : "Sin entregas todavía"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Ya cerradas <span className="text-slate-400 font-normal">({closed.length})</span>
          </h3>
          <div className="space-y-2">
            {closed.map((row) => (
              <div
                key={row.cmid}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {row.institucion}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Fecha límite {formatDate(row.closeCutoffAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyCmid === row.cmid}
                  onClick={() => void runReopen(row)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline shrink-0 disabled:opacity-50"
                >
                  Deshacer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default React.memo(CierreTareasPanel);
