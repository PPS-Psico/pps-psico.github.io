/**
 * InformeCampusLinker — Administrar los espacios de entrega de informes (Moodle)
 * sincronizando de forma bidireccional la tabla aula_entregas y lanzamientos_pps.
 * Permite reutilizar una misma entrega para múltiples lanzamientos de la misma institución.
 */
import React, { useMemo, useState, useEffect } from "react";
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

const formatFecha = (value: unknown): string => {
  if (!value || typeof value !== "string") return "Sin fecha";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
};

const InformeCampusLinker: React.FC<InformeCampusLinkerProps> = ({ isTestingMode = false }) => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "active_spaces" | "pending_launches" | "all_launches" | "inactive_spaces"
  >("active_spaces");

  // Selección
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedLaunchId, setSelectedLaunchId] = useState<string | null>(null);

  // Estados del editor
  const [linkInput, setLinkInput] = useState("");
  const [selectedSpaceIdForLink, setSelectedSpaceIdForLink] = useState("");
  const [editArea, setEditArea] = useState<"clinica" | "laboral" | "educacional" | "comunitaria">(
    "clinica"
  );
  const [editInstitucion, setEditInstitucion] = useState("");
  const [editActivo, setEditActivo] = useState(true);

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

  // 2. Cargar entregas del campus
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

  // Filtrar lanzamientos de este año y deduplicar por (Institución, Área) quedándonos con la primera (más antigua)
  const launchesThisYear = useMemo(() => {
    const list = launches.filter((row) => {
      const dateStr = row[FIELD_FECHA_INICIO_LANZAMIENTOS] as string;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === currentYear;
    });

    // Ordenar de más antiguos a más nuevos
    const sorted = [...list].sort((a, b) => {
      const dA = new Date(a[FIELD_FECHA_INICIO_LANZAMIENTOS] as string).getTime();
      const dB = new Date(b[FIELD_FECHA_INICIO_LANZAMIENTOS] as string).getTime();
      return dA - dB;
    });

    // Conservar sólo la primera aparición de cada Institución
    const seen = new Set<string>();
    const deduplicated: LaunchRow[] = [];

    sorted.forEach((row) => {
      const name = String(row[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
        .split("-")[0]
        .trim()
        .toLowerCase();

      if (!seen.has(name)) {
        seen.add(name);
        deduplicated.push(row);
      }
    });

    // Devolver ordenados por nombre para facilitar búsqueda visual
    return deduplicated.sort((a, b) =>
      String(a[FIELD_NOMBRE_PPS_LANZAMIENTOS]).localeCompare(
        String(b[FIELD_NOMBRE_PPS_LANZAMIENTOS])
      )
    );
  }, [launches, currentYear]);

  // Encontrar el espacio de entrega de campus correspondiente a una PPS
  const getSpaceForLaunch = (launch: LaunchRow) => {
    // 1. Intentar por link explícito
    const link = ((launch[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string) || "").trim();
    if (link) {
      const taskId = getMoodleTaskId(link);
      if (taskId) {
        const match = entregas.find((e) => String(e.moodle_id) === String(taskId) && e.activo);
        if (match) return match;
      }
    }

    // 2. Por coincidencia de nombre de institución y área (case-insensitive)
    const launchName = String(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "").toLowerCase();
    const orient = String(launch[FIELD_ORIENTACION_LANZAMIENTOS] || "").toLowerCase();

    let area: "clinica" | "laboral" | "educacional" | "comunitaria" = "clinica";
    if (orient.includes("clin")) area = "clinica";
    else if (orient.includes("lab") || orient.includes("comun")) {
      area = orient.includes("comun") ? "comunitaria" : "laboral";
    } else if (orient.includes("educ")) area = "educacional";

    const cleanLaunchInst = launchName.split("-")[0].trim();

    return (
      entregas.find((e) => {
        if (!e.activo) return false;
        if (e.area !== area) return false;

        const spaceInst = e.institucion.toLowerCase().trim();
        return (
          cleanLaunchInst.includes(spaceInst) ||
          spaceInst.includes(cleanLaunchInst) ||
          launchName.includes(spaceInst)
        );
      }) || null
    );
  };

  // PPS pendientes de espacio de entrega (de este año, que no están en activas)
  const pendingLaunches = useMemo(() => {
    return launchesThisYear.filter((l) => {
      const space = getSpaceForLaunch(l);
      return !space;
    });
  }, [launchesThisYear, entregas]);

  // Listas filtradas según la pestaña
  const filteredList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (activeTab === "active_spaces" || activeTab === "inactive_spaces") {
      const isActive = activeTab === "active_spaces";
      return entregas.filter((e) => {
        if (e.activo !== isActive) return false;
        if (term) {
          const inst = e.institucion.toLowerCase();
          const area = e.area.toLowerCase();
          if (!inst.includes(term) && !area.includes(term)) return false;
        }
        return true;
      });
    } else {
      const list = activeTab === "pending_launches" ? pendingLaunches : launchesThisYear;
      return list.filter((l) => {
        if (term) {
          const name = String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "").toLowerCase();
          if (!name.includes(term)) return false;
        }
        return true;
      });
    }
  }, [activeTab, entregas, pendingLaunches, launchesThisYear, searchTerm]);

  // Limpiar selección al cambiar de pestaña
  useEffect(() => {
    setSelectedSpaceId(null);
    setSelectedLaunchId(null);
    setLinkInput("");
    setSelectedSpaceIdForLink("");
  }, [activeTab]);

  const handleSelectSpace = (row: EntregaRow) => {
    setSelectedSpaceId(row.id);
    setSelectedLaunchId(null);
    setLinkInput(`${MOODLE_PREFIX}${row.moodle_id}`);
    setEditArea(row.area);
    setEditInstitucion(row.institucion);
    setEditActivo(row.activo);
  };

  const handleSelectLaunch = (row: LaunchRow) => {
    setSelectedLaunchId(row.id);
    setSelectedSpaceId(null);
    const link = ((row[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string) || "").trim();
    setLinkInput(link);
    const taskId = getMoodleTaskId(link);
    if (taskId) {
      setSelectedSpaceIdForLink(taskId);
    } else {
      const autoMatch = getSpaceForLaunch(row);
      if (autoMatch) {
        setSelectedSpaceIdForLink(autoMatch.moodle_id);
        setLinkInput(`${MOODLE_PREFIX}${autoMatch.moodle_id}`);
      } else {
        setSelectedSpaceIdForLink("");
      }
    }
  };

  // Mutación: Guardar vínculo de una PPS (ya sea vinculándola a un espacio existente o creando uno nuevo)
  const saveLaunchLinkMutation = useMutation({
    mutationFn: async ({
      launchId,
      link,
      existingTaskId,
    }: {
      launchId: string;
      link: string | null;
      existingTaskId?: string;
    }) => {
      const cleanLink = link ? link.trim() : null;
      const taskId = existingTaskId || (cleanLink ? getMoodleTaskId(cleanLink) : null);
      const finalLink = existingTaskId ? `${MOODLE_PREFIX}${existingTaskId}` : cleanLink;

      // 1. Actualizar el link en lanzamientos_pps
      await db.lanzamientos.update(launchId, {
        [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: finalLink,
      } as Record<string, unknown>);

      if (isTestingMode) return;

      // 2. Si hay un ID de tarea y no se seleccionó una ya existente, creamos/activamos en aula_entregas
      if (taskId && !existingTaskId) {
        const launchRow = launches.find((l) => l.id === launchId);
        if (!launchRow) return;

        const orient = String(launchRow[FIELD_ORIENTACION_LANZAMIENTOS] || "").toLowerCase();
        let area: "clinica" | "laboral" | "educacional" | "comunitaria" = "clinica";
        if (orient.includes("clin")) area = "clinica";
        else if (orient.includes("lab") || orient.includes("comun")) {
          area = orient.includes("comun") ? "comunitaria" : "laboral";
        } else if (orient.includes("educ")) area = "educacional";

        const name = String(launchRow[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
          .split("-")[0]
          .trim();

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
      }
    },
    onSuccess: () => {
      setToast({ message: "Vínculo guardado y actualizado con éxito.", type: "success" });
      setSelectedLaunchId(null);
      queryClient.invalidateQueries({ queryKey: ["informeCampusLinker"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas_list"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas"] });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    },
    onError: (err: any) =>
      setToast({ message: `Error al vincular: ${err.message}`, type: "error" }),
  });

  // Mutación: Guardar cambios de una entrega (Espacio Campus)
  const updateSpaceMutation = useMutation({
    mutationFn: async ({
      id,
      moodleId,
      area,
      institucion,
      activo,
    }: {
      id: string;
      moodleId: string;
      area: "clinica" | "laboral" | "educacional" | "comunitaria";
      institucion: string;
      activo: boolean;
    }) => {
      // 1. Guardar en aula_entregas
      await db.aula_entregas.update(id, {
        moodle_id: moodleId,
        area,
        institucion,
        activo,
      } as any);

      if (isTestingMode) return;

      // 2. Si se cambia el moodle_id, también debemos propagar ese link en las PPS asociadas
      const oldSpace = entregas.find((e) => e.id === id);
      if (oldSpace && oldSpace.moodle_id !== moodleId) {
        const oldLink = `${MOODLE_PREFIX}${oldSpace.moodle_id}`;
        const newLink = `${MOODLE_PREFIX}${moodleId}`;
        const affected = launches.filter(
          (l) =>
            getMoodleTaskId(String(l[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] || "")) ===
            oldSpace.moodle_id
        );
        for (const l of affected) {
          await db.lanzamientos.update(l.id, {
            [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: newLink,
          } as any);
        }
      }
    },
    onSuccess: () => {
      setToast({
        message: "Espacio de entregas del campus actualizado con éxito.",
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["informeCampusLinker"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas_list"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas"] });
    },
    onError: (err: any) =>
      setToast({ message: `Error al actualizar: ${err.message}`, type: "error" }),
  });

  // Mutación: Desactivar/Ocultar un espacio de entregas del campus
  const deactivateSpaceMutation = useMutation({
    mutationFn: async (id: string) => {
      await db.aula_entregas.update(id, {
        activo: false,
      } as any);
    },
    onSuccess: () => {
      setToast({ message: "Espacio de entregas desactivado en el campus.", type: "success" });
      setSelectedSpaceId(null);
      queryClient.invalidateQueries({ queryKey: ["informeCampusLinker"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas_list"] });
      queryClient.invalidateQueries({ queryKey: ["aula_entregas"] });
    },
    onError: (err: any) =>
      setToast({ message: `Error al desactivar: ${err.message}`, type: "error" }),
  });

  const selectedLaunch = useMemo(
    () => launchesThisYear.find((l) => l.id === selectedLaunchId) || null,
    [launchesThisYear, selectedLaunchId]
  );

  const selectedSpace = useMemo(
    () => entregas.find((e) => e.id === selectedSpaceId) || null,
    [entregas, selectedSpaceId]
  );

  // Convocatorias vinculadas a este espacio de entregas
  const linkedLaunchesToSpace = useMemo(() => {
    if (!selectedSpace) return [];
    return launchesThisYear.filter((l) => {
      const link = ((l[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string) || "").trim();
      const taskId = getMoodleTaskId(link);
      return taskId && String(taskId) === String(selectedSpace.moodle_id);
    });
  }, [selectedSpace, launchesThisYear]);

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

  const moodleTaskId = linkInput ? getMoodleTaskId(linkInput) : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Cabecera */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/50 dark:border-slate-700/40">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="material-icons text-blue-500">dns</span>
          Espacios de Informes en Campus (Moodle)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Los estudiantes entregan su informe en una sola tarea de Moodle por institución. Si volvés
          a lanzar una PPS con una institución que ya tiene espacio activo, vinculala al mismo
          espacio del campus.
        </p>
      </div>

      {/* Buscador e Interruptor de Pestañas */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        {/* Barra de Búsqueda */}
        <div className="relative w-full md:w-80 group">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 group-focus-within:text-blue-500 transition-colors !text-lg">
            search
          </span>
          <input
            type="text"
            placeholder={
              activeTab.includes("spaces")
                ? "Buscar por institución o área..."
                : "Buscar PPS por nombre..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
          />
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex flex-wrap bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800/60 gap-0.5">
          <button
            onClick={() => setActiveTab("active_spaces")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "active_spaces"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Espacios Activos</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 text-[10px] font-bold">
              {entregas.filter((e) => e.activo).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("pending_launches")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "pending_launches"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>PPS Sin Espacio ({currentYear})</span>
            {pendingLaunches.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 text-[10px] font-bold animate-pulse">
                {pendingLaunches.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("all_launches")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "all_launches"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Todas las PPS ({currentYear})</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
              {launchesThisYear.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("inactive_spaces")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "inactive_spaces"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Espacios Ocultos</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
              {entregas.filter((e) => !e.activo).length}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Listado filtrado */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
          <AnimatePresence mode="popLayout">
            {filteredList.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState
                  icon="inventory_2"
                  title="Sin resultados"
                  message="No encontramos registros que coincidan con la búsqueda."
                />
              </motion.div>
            ) : (
              filteredList.map((row) => {
                if (activeTab.includes("spaces")) {
                  // Fila es un espacio de entrega de campus (EntregaRow)
                  const e = row as EntregaRow;
                  const isActive = e.id === selectedSpaceId;
                  const countLinked = launchesThisYear.filter((l) => {
                    const link = ((l[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string) || "").trim();
                    return getMoodleTaskId(link) === e.moodle_id;
                  }).length;

                  return (
                    <motion.button
                      key={e.id}
                      layoutId={`space-card-${e.id}`}
                      onClick={() => handleSelectSpace(e)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                        isActive
                          ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-900/10 shadow-sm"
                          : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-snug truncate">
                            {e.institucion}
                          </p>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-1.5 font-bold uppercase tracking-wide">
                            <span className={`px-2 py-0.5 rounded ${areaColors[e.area]}`}>
                              {areaNames[e.area]}
                            </span>
                            <span className="text-slate-300 dark:text-slate-700 self-center">
                              •
                            </span>
                            <span className="self-center">ID: {e.moodle_id}</span>
                            <span className="text-slate-300 dark:text-slate-700 self-center">
                              •
                            </span>
                            <span className="self-center text-blue-600 dark:text-blue-400">
                              {countLinked} vinculada{countLinked !== 1 && "s"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                } else {
                  // Fila es un lanzamiento (LaunchRow)
                  const l = row as LaunchRow;
                  const isActive = l.id === selectedLaunchId;
                  const space = getSpaceForLaunch(l);

                  return (
                    <motion.button
                      key={l.id}
                      layoutId={`launch-card-${l.id}`}
                      onClick={() => handleSelectLaunch(l)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                        isActive
                          ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-900/10 shadow-sm"
                          : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-snug truncate">
                            {String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre")}
                          </p>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-1 font-medium">
                            <span>{String(l[FIELD_ORIENTACION_LANZAMIENTOS] || "—")}</span>
                            <span className="text-slate-300 dark:text-slate-750">•</span>
                            <span>{formatFecha(l[FIELD_FECHA_INICIO_LANZAMIENTOS])}</span>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            space
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-250/20"
                              : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-250/20"
                          }`}
                        >
                          <span className="material-icons !text-[11px]">
                            {space ? "check" : "link_off"}
                          </span>
                          {space ? "Con espacio" : "Sin espacio"}
                        </span>
                      </div>
                    </motion.button>
                  );
                }
              })
            )}
          </AnimatePresence>
        </div>

        {/* Columna Derecha: Detalle / Editor */}
        <div className="lg:col-span-7 lg:sticky lg:top-4 h-fit">
          {/* EDITOR DE ESPACIO DE CAMPUS */}
          {selectedSpace && (
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                  Espacio del Campus
                </span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-base leading-snug">
                  {selectedSpace.institucion}
                </h3>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    Institución (se muestra en el aula del alumno)
                  </label>
                  <input
                    type="text"
                    value={editInstitucion}
                    onChange={(e) => setEditInstitucion(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                  />
                </div>

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

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    Enlace de Moodle (ID de Tarea)
                  </label>
                  <input
                    type="url"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                  />
                  {moodleTaskId && (
                    <span className="text-[11px] text-slate-400 block mt-1.5">
                      ID de Moodle detectado: <strong>{moodleTaskId}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Lista de Convocatorias del año que usan esta misma tarea */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-xl">
                <p className="text-xs font-bold text-slate-750 dark:text-slate-350 flex items-center gap-1.5 mb-2.5">
                  <span className="material-icons !text-base text-blue-500">layers</span>
                  PPS Vinculadas a este espacio ({currentYear}):
                </p>
                {linkedLaunchesToSpace.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    No hay lanzamientos de este año usando esta tarea de Moodle.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {linkedLaunchesToSpace.map((l) => (
                      <div
                        key={l.id}
                        className="text-xs flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
                      >
                        <span className="font-medium truncate">
                          {String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                        </span>
                        <span className="text-[10px] text-slate-450 uppercase">
                          {String(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]).toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-150 dark:border-slate-800">
                <button
                  onClick={() => {
                    const taskId = getMoodleTaskId(linkInput);
                    if (!taskId || !editInstitucion.trim()) return;
                    updateSpaceMutation.mutate({
                      id: selectedSpace.id,
                      moodleId: taskId,
                      area: editArea,
                      institucion: editInstitucion.trim(),
                      activo: editActivo,
                    });
                  }}
                  disabled={updateSpaceMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition"
                >
                  Guardar cambios
                </button>
                <a
                  href={linkInput}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
                >
                  Ver en Moodle
                </a>
                {editActivo && (
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Seguro de desactivar este espacio del campus? Se ocultará de los alumnos pero no borrará las vinculaciones de las PPS."
                        )
                      ) {
                        deactivateSpaceMutation.mutate(selectedSpace.id);
                      }
                    }}
                    disabled={deactivateSpaceMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition"
                  >
                    Ocultar del Campus
                  </button>
                )}
              </div>
            </div>
          )}

          {/* EDITOR DE VÍNCULO DE PPS */}
          {selectedLaunch && (
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                  Lanzamiento de PPS
                </span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-base leading-snug">
                  {String(selectedLaunch[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">
                  Orientación: {String(selectedLaunch[FIELD_ORIENTACION_LANZAMIENTOS])}
                </p>
              </div>

              {/* Formulario de vínculo */}
              <div className="space-y-4">
                {/* Selector de Espacio Activo Existente */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    Vincular a espacio de entrega existente
                  </label>
                  <select
                    value={selectedSpaceIdForLink}
                    onChange={(e) => {
                      setSelectedSpaceIdForLink(e.target.value);
                      if (e.target.value) {
                        setLinkInput(`${MOODLE_PREFIX}${e.target.value}`);
                      } else {
                        setLinkInput("");
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                  >
                    <option value="">-- Ingresar nueva URL de Moodle en su lugar --</option>
                    {entregas
                      .filter((e) => e.activo)
                      .map((e) => (
                        <option key={e.id} value={e.moodle_id}>
                          [{areaNames[e.area]}] {e.institucion} (ID: {e.moodle_id})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Input URL Directa */}
                {!selectedSpaceIdForLink && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      Ingresar nueva URL de Tarea (Moodle)
                    </label>
                    <input
                      type="url"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder={PLACEHOLDER}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition"
                    />
                    {moodleTaskId && (
                      <span className="text-[11px] text-slate-450 block mt-1.5">
                        ID de Tarea Detectado: <strong>{moodleTaskId}</strong> (Creará un nuevo
                        espacio en el Campus al guardar).
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-150 dark:border-slate-800">
                <button
                  onClick={() => {
                    const trimmed = linkInput.trim();
                    if (!trimmed) {
                      setToast({
                        message: "Ingresá o seleccioná un link de Moodle.",
                        type: "error",
                      });
                      return;
                    }
                    if (!isValidHttpUrl(trimmed)) {
                      setToast({ message: "El link no es una URL válida.", type: "error" });
                      return;
                    }
                    saveLaunchLinkMutation.mutate({
                      launchId: selectedLaunch.id,
                      link: trimmed,
                      existingTaskId: selectedSpaceIdForLink || undefined,
                    });
                  }}
                  disabled={saveLaunchLinkMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition"
                >
                  Guardar vínculo
                </button>

                {String(selectedLaunch[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] || "").trim() && (
                  <button
                    onClick={() => {
                      if (window.confirm("¿Desvincular esta PPS del espacio del campus?")) {
                        saveLaunchLinkMutation.mutate({
                          launchId: selectedLaunch.id,
                          link: null,
                        });
                        setLinkInput("");
                        setSelectedSpaceIdForLink("");
                      }
                    }}
                    disabled={saveLaunchLinkMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition"
                  >
                    Desvincular PPS
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VISTA VACÍA */}
          {!selectedSpace && !selectedLaunch && (
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/20 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
                <span className="material-icons !text-2xl">ads_click</span>
              </div>
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                Seleccioná un elemento
              </h3>
              <p className="mt-1 text-xs max-w-xs mx-auto leading-relaxed">
                {activeTab.includes("spaces")
                  ? "Elegí una entrega de la lista para editarla o desactivarla."
                  : "Elegí un lanzamiento de la lista para vincularlo a un espacio existente o crearle un buzón nuevo en Moodle."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InformeCampusLinker;
