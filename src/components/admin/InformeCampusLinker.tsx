/**
 * InformeCampusLinker — Vincular el espacio de entrega de informe (Campus / Moodle)
 * a una PPS ya lanzada.
 *
 * Contexto: al lanzar una PPS desde el Lanzador se puede pegar el link de la
 * Tarea de Moodle (mod_assign). Ese link se guarda en la columna
 * `codigo_tarjeta_campus` de `lanzamientos_pps` y el campus genera sola la
 * tarjeta de entrega del informe (ver public/entregas.html).
 *
 * Las PPS lanzadas ANTES de esa función quedaron sin ese campo. Esta herramienta
 * permite, de forma retroactiva, elegir una PPS vieja y pegarle el link de la
 * tarea para habilitarle el espacio de entrega de informe.
 */
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../../lib/db";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_CODIGO_CAMPUS_LANZAMIENTOS,
} from "../../constants";
import Loader from "../Loader";
import EmptyState from "../EmptyState";
import Toast from "../ui/Toast";

interface InformeCampusLinkerProps {
  isTestingMode?: boolean;
}

type LaunchRow = Record<string, unknown> & { id: string };

const PLACEHOLDER = "https://campus.uflo.edu.ar/mod/assign/view.php?id=…";

/** Devuelve true si la URL parece un buzón de Tarea de Moodle (mod/assign). */
const looksLikeMoodleAssign = (url: string): boolean => /\/mod\/assign\//i.test(url);

/** Valida que sea una URL http(s) bien formada. */
const isValidHttpUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const formatFecha = (value: unknown): string => {
  if (!value || typeof value !== "string") return "Sin fecha";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
};

const InformeCampusLinker: React.FC<InformeCampusLinkerProps> = ({ isTestingMode = false }) => {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const {
    data: launches = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["informeCampusLinker", "launches", isTestingMode],
    queryFn: async (): Promise<LaunchRow[]> => {
      if (isTestingMode) return [];
      const records = await db.lanzamientos.getAll({
        sort: [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }],
      });
      return records as unknown as LaunchRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, link }: { id: string; link: string }) => {
      const value = link.trim() || null;
      return db.lanzamientos.update(id, {
        [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: value,
      } as Record<string, unknown>);
    },
    onSuccess: (_data, variables) => {
      setToast({
        message: variables.link.trim()
          ? "Espacio de informe vinculado. El campus generará la tarjeta de entrega."
          : "Se quitó el link de la tarea.",
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["informeCampusLinker"] });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
      queryClient.invalidateQueries({ queryKey: ["correctionPanelData"] });
    },
    onError: (e: any) => setToast({ message: `Error al guardar: ${e.message}`, type: "error" }),
  });

  const getLink = (row: LaunchRow): string =>
    (row[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string | null | undefined)?.toString().trim() || "";

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return launches.filter((row) => {
      const hasLink = !!getLink(row);
      if (onlyMissing && hasLink) return false;
      if (term) {
        const name = String(row[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "").toLowerCase();
        if (!name.includes(term)) return false;
      }
      return true;
    });
  }, [launches, searchTerm, onlyMissing]);

  const missingCount = useMemo(() => launches.filter((row) => !getLink(row)).length, [launches]);

  const selected = useMemo(
    () => launches.find((row) => row.id === selectedId) || null,
    [launches, selectedId]
  );

  const handleSelect = (row: LaunchRow) => {
    setSelectedId(row.id);
    setLinkInput(getLink(row));
  };

  const handleSave = () => {
    if (!selected) return;
    const trimmed = linkInput.trim();
    if (trimmed && !isValidHttpUrl(trimmed)) {
      setToast({
        message: "El link no es una URL válida (debe empezar con https://).",
        type: "error",
      });
      return;
    }
    if (trimmed && !looksLikeMoodleAssign(trimmed)) {
      setToast({
        message: "Ojo: el link no parece una Tarea de Moodle (mod/assign). Se guardó igual.",
        type: "warning",
      });
    }
    saveMutation.mutate({ id: selected.id, link: trimmed });
  };

  if (isLoading) {
    return (
      <div className="py-12">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState icon="error" title="Error" message="No se pudieron cargar las PPS lanzadas." />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Controles */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:w-80 group">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 group-focus-within:text-blue-500 transition-colors !text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar PPS por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition shadow-sm"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Sólo sin espacio de informe
          {missingCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {missingCount}
            </span>
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de PPS */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon="task_alt"
              title={onlyMissing ? "Todo vinculado" : "Sin resultados"}
              message={
                onlyMissing
                  ? "Todas las PPS (según el filtro) ya tienen su espacio de informe."
                  : "No hay PPS que coincidan con la búsqueda."
              }
            />
          ) : (
            filtered.map((row) => {
              const hasLink = !!getLink(row);
              const isActive = row.id === selectedId;
              return (
                <button
                  key={row.id}
                  onClick={() => handleSelect(row)}
                  className={`w-full text-left p-4 rounded-xl border transition ${
                    isActive
                      ? "border-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {String(row[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre")}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {String(row[FIELD_ORIENTACION_LANZAMIENTOS] || "—")} ·{" "}
                        {formatFecha(row[FIELD_FECHA_INICIO_LANZAMIENTOS])} ·{" "}
                        {String(row[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] || "—")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        hasLink
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      <span className="material-icons !text-sm">
                        {hasLink ? "check_circle" : "link_off"}
                      </span>
                      {hasLink ? "Vinculada" : "Sin vincular"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Editor */}
        <div className="lg:sticky lg:top-4 h-fit">
          {!selected ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-center text-slate-500 dark:text-slate-400">
              <span className="material-icons !text-4xl text-slate-300 dark:text-slate-600">
                ads_click
              </span>
              <p className="mt-2 text-sm">Elegí una PPS de la lista para vincular su tarea.</p>
            </div>
          ) : (
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
                  PPS seleccionada
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {String(selected[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  Link de la Tarea (Campus / Moodle)
                </label>
                <input
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder={PLACEHOLDER}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Pegá el enlace de la Tarea (buzón de entrega) que creaste en Moodle. El campus
                  generará sola la tarjeta de entrega de informe en la orientación correspondiente.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  <span className="material-icons !text-base">
                    {saveMutation.isPending ? "hourglass_top" : "save"}
                  </span>
                  {saveMutation.isPending ? "Guardando..." : "Guardar vínculo"}
                </button>

                {getLink(selected) && (
                  <a
                    href={getLink(selected)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors"
                  >
                    <span className="material-icons !text-base">open_in_new</span>
                    Abrir tarea
                  </a>
                )}

                {linkInput.trim() && (
                  <button
                    onClick={() => setLinkInput("")}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-slate-500 hover:text-rose-600 text-sm font-medium transition-colors"
                  >
                    <span className="material-icons !text-base">backspace</span>
                    Vaciar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InformeCampusLinker;
