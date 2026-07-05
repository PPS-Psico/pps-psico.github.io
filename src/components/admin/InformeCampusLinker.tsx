/**
 * InformeCampusLinker — Vincular el espacio de entrega de informe (Campus / Moodle)
 * a una PPS ya lanzada y sincronizarlo con la tabla aula_entregas.
 */
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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

/** Extrae el ID de la tarea de Moodle del enlace si está presente de forma robusta. */
const getMoodleTaskId = (url: string): string | null => {
  if (!url) return null;
  try {
    const cleanUrl = url.includes("://") ? url : `https://${url}`;
    const params = new URL(cleanUrl).searchParams;
    const id = params.get("id");
    if (id && /^\d+$/.test(id)) return id;
  } catch {
    // Fallback regex
  }
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
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
  const [filterType, setFilterType] = useState<"all" | "missing" | "linked">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // 1. Cargar lanzamientos de PPS
  const {
    data: launches = [],
    isLoading: isLaunchesLoading,
    error: launchesError,
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

  // 2. Cargar espacios de entrega abiertos en el campus (tabla aula_entregas)
  const {
    data: entregas = [],
    isLoading: isEntregasLoading,
    error: entregasError,
  } = useQuery({
    queryKey: ["aula_entregas_list", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) return [];
      try {
        return await db.aula_entregas.getAll();
      } catch (err) {
        console.error("Error al cargar aula_entregas:", err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = isLaunchesLoading || isEntregasLoading;
  const error = launchesError || entregasError;

  const getLink = (row: LaunchRow): string =>
    (row[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string | null | undefined)?.toString().trim() || "";

  // Determinar la relación de cada lanzamiento con el campus real (aula_entregas)
  const getCampusStatus = (row: LaunchRow) => {
    const link = getLink(row);
    if (!link) return { hasLink: false, active: false, exists: false, moodleId: null };
    const taskId = getMoodleTaskId(link);
    if (!taskId) return { hasLink: true, active: false, exists: false, moodleId: null };

    const match = entregas.find((e: any) => String(e.moodle_id) === String(taskId));
    return {
      hasLink: true,
      active: match ? !!match.activo : false,
      exists: !!match,
      moodleId: taskId,
    };
  };

  // Mutación para guardar/actualizar el vínculo en lanzamientos_pps Y en aula_entregas
  const saveMutation = useMutation({
    mutationFn: async ({
      id,
      link,
      launchRow,
    }: {
      id: string;
      link: string | null;
      launchRow: LaunchRow;
    }) => {
      const cleanLink = link ? link.trim() : null;
      const taskId = cleanLink ? getMoodleTaskId(cleanLink) : null;
      const oldLink = getLink(launchRow);
      const oldTaskId = oldLink ? getMoodleTaskId(oldLink) : null;

      // A. Actualizar lanzamientos_pps.codigo_tarjeta_campus
      await db.lanzamientos.update(id, {
        [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: cleanLink,
      } as Record<string, unknown>);

      if (isTestingMode) return;

      // B. Sincronizar con la tabla aula_entregas
      if (cleanLink && taskId) {
        // Mapear orientación de la PPS al enum de área de entrega
        const orient = String(launchRow[FIELD_ORIENTACION_LANZAMIENTOS] || "").toLowerCase();
        let area: "clinica" | "laboral" | "educacional" | "comunitaria" = "clinica";
        if (orient.includes("clin")) area = "clinica";
        else if (orient.includes("lab") || orient.includes("comun")) {
          area = orient.includes("comun") ? "comunitaria" : "laboral";
        } else if (orient.includes("educ")) area = "educacional";

        // Limpiar el nombre de la institución (descartar fechas/detalles de cohorte del nombre de lanzamiento)
        const name = String(launchRow[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
          .split("-")[0]
          .trim();

        // Buscar si ya existe este buzón de entrega
        const existing = entregas.find(
          (e: any) =>
            String(e.moodle_id) === String(taskId) ||
            (oldTaskId && String(e.moodle_id) === String(oldTaskId))
        );

        if (existing) {
          // Actualizar el existente
          await db.aula_entregas.update(String(existing.id), {
            moodle_id: taskId,
            institucion: name,
            area,
            activo: true,
          } as any);
        } else {
          // Crear un registro nuevo
          await db.aula_entregas.create({
            moodle_id: taskId,
            institucion: name,
            area,
            activo: true,
          } as any);
        }
      } else {
        // Si se quita el link, desactivar la entrega en el campus virtual
        if (oldTaskId) {
          const existing = entregas.find((e: any) => String(e.moodle_id) === String(oldTaskId));
          if (existing) {
            await db.aula_entregas.update(String(existing.id), {
              activo: false,
            } as any);
          }
        }
      }
    },
    onSuccess: (_data, variables) => {
      setToast({
        message: variables.link
          ? "Vínculo guardado y espacio de entrega habilitado en el campus virtual."
          : "PPS desvinculada y espacio de entrega ocultado en el campus.",
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["informeCampusLinker"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas_list"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas"] }); // Hook de panel estudiantil
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
      queryClient.invalidateQueries({ queryKey: ["correctionPanelData"] });
    },
    onError: (e: any) => setToast({ message: `Error al guardar: ${e.message}`, type: "error" }),
  });

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return launches.filter((row) => {
      const { hasLink } = getCampusStatus(row);
      if (filterType === "missing" && hasLink) return false;
      if (filterType === "linked" && !hasLink) return false;
      if (term) {
        const name = String(row[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "").toLowerCase();
        if (!name.includes(term)) return false;
      }
      return true;
    });
  }, [launches, searchTerm, filterType, entregas]);

  const missingCount = useMemo(() => launches.filter((row) => !getLink(row)).length, [launches]);
  const linkedCount = useMemo(() => launches.filter((row) => getLink(row)).length, [launches]);

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
    saveMutation.mutate({ id: selected.id, link: trimmed, launchRow: selected });
  };

  const handleRemoveLink = () => {
    if (!selected) return;
    if (
      window.confirm(
        "¿Estás seguro de que querés desvincular el espacio del campus? Se eliminará el link de Moodle de esta PPS y se ocultará en el campus."
      )
    ) {
      saveMutation.mutate({ id: selected.id, link: null, launchRow: selected });
      setLinkInput("");
    }
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
      <EmptyState
        icon="error"
        title="Error"
        message="No se pudieron cargar los datos del campus."
      />
    );
  }

  const { hasLink, active, exists, moodleId } = selected
    ? getCampusStatus(selected)
    : { hasLink: false, active: false, exists: false, moodleId: null };

  const moodleTaskId = linkInput ? getMoodleTaskId(linkInput) : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Cabecera de Sección */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/50 dark:border-slate-700/40">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="material-icons text-blue-500">dns</span>
          Espacios de Informes en Campus (Moodle)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Las PPS creadas antes de la integración del campus quedan sin espacio de entrega de
          informe. Vinculá el enlace de la Tarea de Moodle para que el campus genere automáticamente
          el buzón en el perfil de los estudiantes, o desvinculalo cuando sea necesario.
        </p>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        {/* Barra de Búsqueda */}
        <div className="relative w-full md:w-80 group">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 group-focus-within:text-blue-500 transition-colors !text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar PPS por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
          />
        </div>

        {/* Filtros Segmentados */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800/60 self-start md:self-auto">
          <button
            onClick={() => setFilterType("all")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === "all"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Todas</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                filterType === "all"
                  ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600"
                  : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {launches.length}
            </span>
          </button>

          <button
            onClick={() => setFilterType("missing")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === "missing"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Sin vincular</span>
            {missingCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  filterType === "missing"
                    ? "bg-amber-50 dark:bg-amber-900/40 text-amber-600 animate-pulse"
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                }`}
              >
                {missingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterType("linked")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === "linked"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Vinculadas</span>
            {linkedCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  filterType === "linked"
                    ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600"
                    : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                }`}
              >
                {linkedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de PPS */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState
                  icon="task_alt"
                  title={filterType === "missing" ? "Todo vinculado" : "Sin resultados"}
                  message={
                    filterType === "missing"
                      ? "Todas las PPS activas ya tienen su espacio de informe vinculado correctamente."
                      : "No encontramos lanzamientos que coincidan con los filtros seleccionados."
                  }
                />
              </motion.div>
            ) : (
              filtered.map((row) => {
                const status = getCampusStatus(row);
                const isActive = row.id === selectedId;
                return (
                  <motion.button
                    key={row.id}
                    layoutId={`launch-card-${row.id}`}
                    onClick={() => handleSelect(row)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                      isActive
                        ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-900/10 shadow-sm"
                        : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                    }`}
                    whileHover={{ x: isActive ? 0 : 2 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-snug truncate">
                          {String(row[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre")}
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                          <span>{String(row[FIELD_ORIENTACION_LANZAMIENTOS] || "—")}</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>{formatFecha(row[FIELD_FECHA_INICIO_LANZAMIENTOS])}</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="capitalize">
                            {String(
                              row[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] || "—"
                            ).toLowerCase()}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          !status.hasLink
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/30 dark:border-slate-750"
                            : status.active
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30"
                              : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30 animate-pulse"
                        }`}
                      >
                        <span className="material-icons !text-[11px]">
                          {!status.hasLink ? "link_off" : status.active ? "check" : "warning"}
                        </span>
                        {!status.hasLink ? "Sin link" : status.active ? "Abierto" : "Cerrado"}
                      </span>
                    </div>
                  </motion.button>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Editor */}
        <div className="lg:col-span-7 lg:sticky lg:top-4 h-fit">
          {!selected ? (
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/20 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
                <span className="material-icons !text-2xl">ads_click</span>
              </div>
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                Ninguna PPS seleccionada
              </h3>
              <p className="mt-1 text-xs max-w-xs mx-auto leading-relaxed">
                Selecciona un lanzamiento de la lista para ver, vincular o remover su espacio de
                entregas de Moodle.
              </p>
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
              {/* Encabezado Editor */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                  Editor de Vínculo
                </span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-base leading-snug">
                  {String(selected[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre")}
                </h3>
              </div>

              {/* Advertencia Discrepancia del Campus */}
              {getLink(selected) && !active && moodleId && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 leading-normal">
                    <span className="material-icons !text-lg text-amber-600 dark:text-amber-400 shrink-0">
                      warning
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-amber-900 dark:text-amber-200">
                        Buzón de entrega inactivo en el Campus
                      </p>
                      <p>
                        El enlace de Moodle está guardado en la PPS, pero el espacio de entregas no
                        está activo en el campus virtual (los alumnos no podrán entregar sus
                        informes).
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      saveMutation.mutate({
                        id: selected.id,
                        link: getLink(selected),
                        launchRow: selected,
                      });
                    }}
                    disabled={saveMutation.isPending}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-755 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-icons !text-base">autorenew</span>
                    Abrir/Habilitar espacio en campus
                  </button>
                </div>
              )}

              {/* Diagrama de Conexión */}
              <div className="flex items-center justify-center gap-6 py-4 px-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-900/50">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-sm">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                      <rect x="3" y="10" width="4" height="11" rx="1" fill="currentColor" />
                      <rect x="10" y="4" width="4" height="17" rx="1" fill="currentColor" />
                      <rect x="17" y="14" width="4" height="7" rx="1" fill="currentColor" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Mi Panel
                  </span>
                </div>

                <div className="flex-grow flex items-center justify-center relative">
                  <div
                    className={`h-[2px] w-full border-t-2 border-dashed transition-colors duration-350 ${
                      getLink(selected) && active
                        ? "border-emerald-500"
                        : "border-slate-350 dark:border-slate-800"
                    }`}
                  />
                  <div
                    className={`absolute w-7 h-7 rounded-full flex items-center justify-center shadow-sm border transition-all duration-350 ${
                      getLink(selected)
                        ? active
                          ? "bg-emerald-500 border-emerald-600 text-white"
                          : "bg-amber-500 border-amber-600 text-white animate-pulse"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                    }`}
                  >
                    <span className="material-icons !text-xs">
                      {getLink(selected) ? (active ? "link" : "warning") : "link_off"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border transition-all duration-350 ${
                      getLink(selected) && active
                        ? "bg-orange-500 border-orange-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200/60 dark:border-slate-850 text-slate-400"
                    }`}
                  >
                    <span className="material-icons !text-xl">school</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Moodle
                  </span>
                </div>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    Enlace de la Tarea (Moodle)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder={PLACEHOLDER}
                      className="w-full px-3 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                    />
                    {linkInput && (
                      <button
                        onClick={() => setLinkInput("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Limpiar campo"
                      >
                        <span className="material-icons !text-lg">cancel</span>
                      </button>
                    )}
                  </div>

                  {/* Informador de ID de Tarea */}
                  {moodleTaskId && (
                    <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-lg flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="material-icons !text-base text-orange-500">school</span>
                      <span>
                        ID de Tarea Detectado: <strong>{moodleTaskId}</strong>
                      </span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Ingresá la URL del buzón de entrega de Moodle. Los estudiantes de esta PPS verán
                    un botón de entrega directo en su panel.
                  </p>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition"
                >
                  <span className="material-icons !text-base">
                    {saveMutation.isPending ? "hourglass_top" : "save"}
                  </span>
                  {saveMutation.isPending ? "Guardando..." : "Guardar vínculo"}
                </button>

                {getLink(selected) && (
                  <>
                    <a
                      href={getLink(selected)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
                    >
                      <span className="material-icons !text-base">open_in_new</span>
                      Ver en Moodle
                    </a>

                    <button
                      onClick={handleRemoveLink}
                      disabled={saveMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition"
                    >
                      <span className="material-icons !text-base">link_off</span>
                      Quitar vínculo
                    </button>
                  </>
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
