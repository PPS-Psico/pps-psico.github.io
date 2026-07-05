/**
 * InformeCampusLinker — Administrar los espacios de entrega de informes (tareas de Moodle)
 * sincronizando de forma bidireccional la tabla aula_entregas y lanzamientos_pps.
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
type EntregaRow = {
  id: string;
  area: "clinica" | "laboral" | "educacional" | "comunitaria";
  institucion: string;
  moodle_id: string;
  orden?: number | null;
  activo: boolean;
};

const PLACEHOLDER = "https://campus.uflo.edu.ar/mod/assign/view.php?id=…";
const MOODLE_PREFIX = "https://campus.uflo.edu.ar/mod/assign/view.php?id=";

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

const areaNames: Record<string, string> = {
  clinica: "Clínica",
  laboral: "Laboral",
  educacional: "Educacional",
  comunitaria: "Comunitaria",
};

const areaColors: Record<string, string> = {
  clinica:
    "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30",
  laboral:
    "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30",
  educacional:
    "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30",
  comunitaria:
    "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30",
};

const InformeCampusLinker: React.FC<InformeCampusLinkerProps> = ({ isTestingMode = false }) => {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "inactive">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Estados del editor / creador
  const [linkInput, setLinkInput] = useState("");
  const [selectedLaunchId, setSelectedLaunchId] = useState("");
  const [editArea, setEditArea] = useState<"clinica" | "laboral" | "educacional" | "comunitaria">(
    "clinica"
  );
  const [editInstitucion, setEditInstitucion] = useState("");
  const [editActivo, setEditActivo] = useState(true);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // 1. Cargar lanzamientos de PPS (para vincular o contrastar)
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
    queryFn: async (): Promise<EntregaRow[]> => {
      if (isTestingMode) return [];
      try {
        const records = await db.aula_entregas.getAll();
        return records as unknown as EntregaRow[];
      } catch (err) {
        console.error("Error al cargar aula_entregas:", err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = isLaunchesLoading || isEntregasLoading;
  const error = launchesError || entregasError;

  // Mapeo: Buscar si un espacio de entrega está vinculado a alguna PPS
  const getLinkedLaunch = (entrega: EntregaRow) => {
    return launches.find((l) => {
      const link = ((l[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string) || "").trim();
      const taskId = getMoodleTaskId(link);
      return taskId && String(taskId) === String(entrega.moodle_id);
    });
  };

  // Listado de lanzamientos activos que no tienen ningún link cargado todavía
  const unlinkedLaunches = useMemo(() => {
    return launches.filter((l) => {
      const link = ((l[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string) || "").trim();
      return !link;
    });
  }, [launches]);

  // Filtrado de la lista de entregas del campus
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return entregas.filter((row) => {
      if (filterType === "active" && !row.activo) return false;
      if (filterType === "inactive" && row.activo) return false;
      if (term) {
        const inst = String(row.institucion || "").toLowerCase();
        const area = String(row.area || "").toLowerCase();
        if (!inst.includes(term) && !area.includes(term)) return false;
      }
      return true;
    });
  }, [entregas, searchTerm, filterType]);

  const activeCount = useMemo(() => entregas.filter((e) => e.activo).length, [entregas]);
  const inactiveCount = useMemo(() => entregas.filter((e) => !e.activo).length, [entregas]);

  const selected = useMemo(
    () => entregas.find((e) => e.id === selectedId) || null,
    [entregas, selectedId]
  );

  const handleSelect = (row: EntregaRow) => {
    setIsCreating(false);
    setSelectedId(row.id);
    setLinkInput(`${MOODLE_PREFIX}${row.moodle_id}`);
    setEditArea(row.area);
    setEditInstitucion(row.institucion);
    setEditActivo(row.activo);
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setLinkInput("");
    setSelectedLaunchId(unlinkedLaunches[0]?.id || "");
  };

  // Mutación: Crear y Vincular nueva entrega al campus
  const createMutation = useMutation({
    mutationFn: async ({ launchId, link }: { launchId: string; link: string }) => {
      const cleanLink = link.trim();
      const taskId = getMoodleTaskId(cleanLink);
      if (!taskId) throw new Error("No se pudo detectar el ID de la tarea Moodle.");

      const launchRow = launches.find((l) => l.id === launchId);
      if (!launchRow) throw new Error("Lanzamiento de PPS no encontrado.");

      // 1. Guardar link en lanzamientos_pps
      await db.lanzamientos.update(launchId, {
        [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: cleanLink,
      } as Record<string, unknown>);

      if (isTestingMode) return;

      // 2. Mapear orientación y nombre de institución
      const orient = String(launchRow[FIELD_ORIENTACION_LANZAMIENTOS] || "").toLowerCase();
      let area: "clinica" | "laboral" | "educacional" | "comunitaria" = "clinica";
      if (orient.includes("clin")) area = "clinica";
      else if (orient.includes("lab") || orient.includes("comun")) {
        area = orient.includes("comun") ? "comunitaria" : "laboral";
      } else if (orient.includes("educ")) area = "educacional";

      const name = String(launchRow[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
        .split("-")[0]
        .trim();

      // 3. Crear o reactivar fila en aula_entregas
      const existing = entregas.find((e) => String(e.moodle_id) === String(taskId));
      if (existing) {
        await db.aula_entregas.update(String(existing.id), {
          activo: true,
          institucion: name,
          area,
        } as any);
      } else {
        await db.aula_entregas.create({
          moodle_id: taskId,
          institucion: name,
          area,
          activo: true,
        } as any);
      }
    },
    onSuccess: () => {
      setToast({
        message: "Espacio de entrega vinculado y habilitado exitosamente.",
        type: "success",
      });
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["informeCampusLinker"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas_list"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas"] });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    },
    onError: (err: any) =>
      setToast({ message: `Error al crear vínculo: ${err.message}`, type: "error" }),
  });

  // Mutación: Guardar cambios de una entrega existente
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      moodleId,
      area,
      institucion,
      activo,
      link,
    }: {
      id: string;
      moodleId: string;
      area: "clinica" | "laboral" | "educacional" | "comunitaria";
      institucion: string;
      activo: boolean;
      link: string;
    }) => {
      // 1. Guardar en aula_entregas
      await db.aula_entregas.update(id, {
        moodle_id: moodleId,
        area,
        institucion,
        activo,
      } as any);

      if (isTestingMode) return;

      // 2. Actualizar el link en la PPS lanzada que esté asociada
      if (selected) {
        const linkedLaunch = getLinkedLaunch(selected);
        if (linkedLaunch) {
          await db.lanzamientos.update(linkedLaunch.id, {
            [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: link.trim() || null,
          } as any);
        }
      }
    },
    onSuccess: () => {
      setToast({
        message: "Cambios en el espacio de entregas guardados con éxito.",
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["informeCampusLinker"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas_list"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas"] });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    },
    onError: (err: any) => setToast({ message: `Error al guardar: ${err.message}`, type: "error" }),
  });

  // Mutación: Quitar (desactivar) entrega del campus
  const deleteMutation = useMutation({
    mutationFn: async (entrega: EntregaRow) => {
      // 1. Poner inactivo en aula_entregas
      await db.aula_entregas.update(entrega.id, {
        activo: false,
      } as any);

      if (isTestingMode) return;

      // 2. Limpiar el link en la PPS asociada
      const linkedLaunch = getLinkedLaunch(entrega);
      if (linkedLaunch) {
        await db.lanzamientos.update(linkedLaunch.id, {
          [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: null,
        } as any);
      }
    },
    onSuccess: () => {
      setToast({
        message: "Espacio de entregas quitado/ocultado del campus virtual.",
        type: "success",
      });
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["informeCampusLinker"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas_list"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas"] });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    },
    onError: (err: any) => setToast({ message: `Error al quitar: ${err.message}`, type: "error" }),
  });

  const handleCreateSubmit = () => {
    if (!selectedLaunchId) {
      setToast({ message: "Elegí una PPS para vincular.", type: "error" });
      return;
    }
    const trimmed = linkInput.trim();
    if (!trimmed) {
      setToast({ message: "Pegá el link de Moodle.", type: "error" });
      return;
    }
    if (!isValidHttpUrl(trimmed)) {
      setToast({ message: "El link no es una URL válida.", type: "error" });
      return;
    }
    createMutation.mutate({ launchId: selectedLaunchId, link: trimmed });
  };

  const handleUpdateSubmit = () => {
    if (!selected) return;
    const cleanLink = linkInput.trim();
    const taskId = getMoodleTaskId(cleanLink);
    if (!taskId) {
      setToast({ message: "No se detectó un ID de tarea válido.", type: "error" });
      return;
    }
    if (!editInstitucion.trim()) {
      setToast({ message: "El nombre de la institución no puede estar vacío.", type: "error" });
      return;
    }
    updateMutation.mutate({
      id: selected.id,
      moodleId: taskId,
      area: editArea,
      institucion: editInstitucion.trim(),
      activo: editActivo,
      link: cleanLink,
    });
  };

  const handleConfirmRemove = () => {
    if (!selected) return;
    if (
      window.confirm(
        "¿Estás seguro de que querés quitar este espacio del campus? Se ocultará de la lista de entregas del estudiante y se limpiará el link en la PPS vinculada."
      )
    ) {
      deleteMutation.mutate(selected);
    }
  };

  const moodleTaskId = linkInput ? getMoodleTaskId(linkInput) : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Cabecera de Sección */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/50 dark:border-slate-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-icons text-blue-500">dns</span>
            Espacios de Informes en Campus (Moodle)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">
            Acá gestionás la lista de entregas que ven los alumnos en el aula. Podés vincular una
            nueva PPS para habilitarle el espacio, modificar los buzones existentes o quitarlos
            fácilmente del campus.
          </p>
        </div>

        <button
          onClick={handleStartCreate}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <span className="material-icons !text-base">add_link</span>
          Vincular nueva PPS
        </button>
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
            placeholder="Buscar por institución o área..."
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
            <span>Todos</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                filterType === "all"
                  ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600"
                  : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {entregas.length}
            </span>
          </button>

          <button
            onClick={() => setFilterType("active")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === "active"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Activos</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                filterType === "active"
                  ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600"
                  : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setFilterType("inactive")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === "inactive"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Ocultos</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                filterType === "inactive"
                  ? "bg-amber-50 dark:bg-amber-900/40 text-amber-600"
                  : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {inactiveCount}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Espacios Campus */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState
                  icon="inventory_2"
                  title="Sin resultados"
                  message="No encontramos espacios de entrega cargados en el campus virtual que coincidan."
                />
              </motion.div>
            ) : (
              filtered.map((row) => {
                const linkedLaunch = getLinkedLaunch(row);
                const isActive = row.id === selectedId;
                return (
                  <motion.button
                    key={row.id}
                    layoutId={`delivery-card-${row.id}`}
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
                          {row.institucion}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-normal">
                          {linkedLaunch ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              Vinculado a: {String(linkedLaunch[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              ⚠️ Espacio de entrega huérfano (sin PPS asociada)
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-1.5 font-bold uppercase tracking-wide">
                          <span className={`px-2 py-0.5 rounded ${areaColors[row.area]}`}>
                            {areaNames[row.area]}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700 self-center">•</span>
                          <span className="self-center">ID: {row.moodle_id}</span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          row.activo
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/30 dark:border-slate-750"
                        }`}
                      >
                        {row.activo ? "Activo" : "Oculto"}
                      </span>
                    </div>
                  </motion.button>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Editor o Creador */}
        <div className="lg:col-span-7 lg:sticky lg:top-4 h-fit">
          {/* CREADOR DE VÍNCULO */}
          {isCreating && (
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6 animate-fade-in">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                  Vincular Nueva PPS
                </span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-base">
                  Habilitar entrega en el campus
                </h3>
              </div>

              {unlinkedLaunches.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950 text-center text-slate-500">
                  <span className="material-icons !text-3xl text-slate-300">task_alt</span>
                  <p className="mt-2 text-xs font-semibold">Todas las PPS ya están vinculadas</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    No quedan lanzamientos activos sin espacio de entregas en el campus virtual.
                  </p>
                  <button
                    onClick={() => setIsCreating(false)}
                    className="mt-4 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cerrar formulario
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selector de PPS sin link */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Seleccionar lanzamiento de PPS
                    </label>
                    <select
                      value={selectedLaunchId}
                      onChange={(e) => setSelectedLaunchId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                    >
                      {unlinkedLaunches.map((l) => (
                        <option key={l.id} value={l.id}>
                          {String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS])} (
                          {String(l[FIELD_ORIENTACION_LANZAMIENTOS])})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Input link Moodle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Enlace de la Tarea (Moodle)
                    </label>
                    <input
                      type="url"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder={PLACEHOLDER}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                    />

                    {moodleTaskId && (
                      <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-lg flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="material-icons !text-base text-orange-500">school</span>
                        <span>
                          ID de Tarea Detectado: <strong>{moodleTaskId}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Botones */}
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-150 dark:border-slate-800">
                    <button
                      onClick={handleCreateSubmit}
                      disabled={createMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold transition"
                    >
                      <span className="material-icons !text-base">save</span>
                      Vincular y habilitar
                    </button>
                    <button
                      onClick={() => setIsCreating(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EDITOR DE VÍNCULO EXISTENTE */}
          {!isCreating && selected && (
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
              {/* Encabezado Editor */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                    Editor de Entrega
                  </span>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-base leading-snug">
                    {selected.institucion}
                  </h3>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${areaColors[editArea]}`}
                >
                  {areaNames[editArea]}
                </span>
              </div>

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
                    className={`h-[2px] w-full border-t-2 border-dashed transition-colors duration-300 ${
                      editActivo ? "border-emerald-500" : "border-slate-350 dark:border-slate-800"
                    }`}
                  />
                  <div
                    className={`absolute w-7 h-7 rounded-full flex items-center justify-center shadow-sm border transition-all duration-300 ${
                      editActivo
                        ? "bg-emerald-500 border-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400"
                    }`}
                  >
                    <span className="material-icons !text-xs">
                      {editActivo ? "link" : "link_off"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border transition-all duration-300 ${
                      editActivo
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
                {/* Institución */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    Institución (se muestra en Campus)
                  </label>
                  <input
                    type="text"
                    value={editInstitucion}
                    onChange={(e) => setEditInstitucion(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                  />
                </div>

                {/* Área y Estado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Área académica
                    </label>
                    <select
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                    >
                      <option value="clinica">Clínica</option>
                      <option value="laboral">Laboral</option>
                      <option value="educacional">Educacional</option>
                      <option value="comunitaria">Comunitaria</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Estado en Campus
                    </label>
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/40 dark:border-slate-800/60 w-fit">
                      <button
                        type="button"
                        onClick={() => setEditActivo(true)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          editActivo
                            ? "bg-white dark:bg-slate-800 text-emerald-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Activo
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditActivo(false)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          !editActivo
                            ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Oculto
                      </button>
                    </div>
                  </div>
                </div>

                {/* Input link Moodle */}
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

                  {moodleTaskId && (
                    <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-lg flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="material-icons !text-base text-orange-500">school</span>
                      <span>
                        ID de Tarea Detectado: <strong>{moodleTaskId}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-150 dark:border-slate-800">
                <button
                  onClick={handleUpdateSubmit}
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition"
                >
                  <span className="material-icons !text-base">
                    {updateMutation.isPending ? "hourglass_top" : "save"}
                  </span>
                  {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
                </button>

                <a
                  href={linkInput}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
                >
                  <span className="material-icons !text-base">open_in_new</span>
                  Ver en Moodle
                </a>

                <button
                  onClick={handleConfirmRemove}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition"
                >
                  <span className="material-icons !text-base">link_off</span>
                  Quitar del Campus
                </button>
              </div>
            </div>
          )}

          {/* VISTA VACÍA INICIAL */}
          {!isCreating && !selected && (
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/20 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
                <span className="material-icons !text-2xl">ads_click</span>
              </div>
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                Ninguna entrega seleccionada
              </h3>
              <p className="mt-1 text-xs max-w-xs mx-auto leading-relaxed">
                Elegí una entrega del campus virtual en la lista de la izquierda para editarla,
                deshabilitarla o desvincularla por completo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InformeCampusLinker;
