import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import React, { useMemo, useState } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import {
  approveSolicitudModificacion,
  approveSolicitudNuevaPPS,
  fetchAllSolicitudesModificacion,
  fetchAllSolicitudesNuevaPPS,
  rejectSolicitudModificacion,
  rejectSolicitudNuevaPPS,
} from "../../services/dataService";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import Button from "../ui/Button";

type TabType = "modificaciones" | "nuevas";
type SolicitudStatus = "pendiente" | "aprobada" | "rechazada" | "todas";

interface SolicitudModificacion {
  id: string;
  estudiante_id: string;
  practica_id: string;
  tipo_modificacion: string;
  horas_nuevas: number | null;
  planilla_asistencia_url: string | null;
  estado: string;
  comentario_rechazo: string | null;
  notas_admin: string | null;
  created_at: string;
  estudiante: {
    id: string;
    nombre: string;
    legajo: string;
    correo: string;
  } | null;
  practica: {
    id: string;
    nombre_institucion: string | null;
    horas_realizadas: number | null;
    especialidad: string | null;
  } | null;
}

interface SolicitudNueva {
  id: string;
  estudiante_id: string;
  institucion_id: string | null;
  nombre_institucion_manual: string | null;
  orientacion: string;
  fecha_inicio: string;
  fecha_finalizacion: string;
  horas_estimadas: number;
  planilla_asistencia_url: string | null;
  informe_final_url: string;
  es_online: boolean;
  estado: string;
  comentario_rechazo: string | null;
  notas_admin: string | null;
  created_at: string;
  estudiante: {
    id: string;
    nombre: string;
    legajo: string;
    correo: string;
  } | null;
  institucion: {
    id: string;
    nombre: string;
  } | null;
}

const SolicitudesCorreccionManager: React.FC = () => {
  const { showToast } = useNotifications();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<SolicitudStatus>("pendiente");
  const [selectedSolicitud, setSelectedSolicitud] = useState<
    SolicitudModificacion | SolicitudNueva | null
  >(null);
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [comentarioRechazo, setComentarioRechazo] = useState("");
  const [notasAdmin, setNotasAdmin] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch solicitudes de modificación
  const { data: solicitudesModificacion = [], isLoading: isLoadingMod } = useQuery({
    queryKey: ["solicitudes_modificacion", statusFilter],
    queryFn: () =>
      fetchAllSolicitudesModificacion(statusFilter === "todas" ? undefined : statusFilter),
  });

  // Fetch solicitudes de nueva PPS
  const { data: solicitudesNuevas = [], isLoading: isLoadingNuevas } = useQuery({
    queryKey: ["solicitudes_nueva_pps", statusFilter],
    queryFn: () => fetchAllSolicitudesNuevaPPS(statusFilter === "todas" ? undefined : statusFilter),
  });

  // Combinar y ordenar todas las solicitudes
  const allSolicitudes = useMemo(() => {
    const combined = [
      ...solicitudesModificacion.map((s) => ({ ...s, tipo_solicitud: "modificacion" as const })),
      ...solicitudesNuevas.map((s) => ({ ...s, tipo_solicitud: "nueva" as const })),
    ];
    // Ordenar por fecha (creación) descendente
    return combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [solicitudesModificacion, solicitudesNuevas]);

  // Mutations
  const approveModMutation = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      approveSolicitudModificacion(id, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitudes_modificacion"] });
      showToast("Solicitud aprobada correctamente", "success");
      setSelectedSolicitud(null);
    },
    onError: (error: any) => {
      showToast(error.message || "Error al aprobar la solicitud", "error");
    },
  });

  const rejectModMutation = useMutation({
    mutationFn: ({ id, comentario, notas }: { id: string; comentario: string; notas?: string }) =>
      rejectSolicitudModificacion(id, comentario, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitudes_modificacion"] });
      showToast("Solicitud rechazada", "success");
      setShowRechazoModal(false);
      setComentarioRechazo("");
      setSelectedSolicitud(null);
    },
    onError: (error: any) => {
      showToast(error.message || "Error al rechazar la solicitud", "error");
    },
  });

  const approveNuevaMutation = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      approveSolicitudNuevaPPS(id, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitudes_nueva_pps"] });
      queryClient.invalidateQueries({ queryKey: ["practicas"] });
      showToast("Solicitud aprobada y PPS creada", "success");
      setSelectedSolicitud(null);
    },
    onError: (error: any) => {
      showToast(error.message || "Error al aprobar la solicitud", "error");
    },
  });

  const rejectNuevaMutation = useMutation({
    mutationFn: ({ id, comentario, notas }: { id: string; comentario: string; notas?: string }) =>
      rejectSolicitudNuevaPPS(id, comentario, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitudes_nueva_pps"] });
      showToast("Solicitud rechazada", "success");
      setShowRechazoModal(false);
      setComentarioRechazo("");
      setSelectedSolicitud(null);
    },
    onError: (error: any) => {
      showToast(error.message || "Error al rechazar la solicitud", "error");
    },
  });

  const handleApprove = async () => {
    if (!selectedSolicitud) return;
    setIsProcessing(true);
    try {
      if ("practica" in selectedSolicitud) {
        await approveModMutation.mutateAsync({ id: selectedSolicitud.id, notas: notasAdmin });
      } else {
        await approveNuevaMutation.mutateAsync({ id: selectedSolicitud.id, notas: notasAdmin });
      }
    } finally {
      setIsProcessing(false);
      setNotasAdmin("");
    }
  };

  const handleReject = async () => {
    if (!selectedSolicitud || !comentarioRechazo.trim()) return;
    setIsProcessing(true);
    try {
      if ("practica" in selectedSolicitud) {
        await rejectModMutation.mutateAsync({
          id: selectedSolicitud.id,
          comentario: comentarioRechazo,
          notas: notasAdmin,
        });
      } else {
        await rejectNuevaMutation.mutateAsync({
          id: selectedSolicitud.id,
          comentario: comentarioRechazo,
          notas: notasAdmin,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStatusBadge = (estado: string) => {
    const styles = {
      pendiente: "bg-amber-100 text-amber-800 border-amber-200",
      aprobada: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rechazada: "bg-rose-100 text-rose-800 border-rose-200",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
          styles[estado as keyof typeof styles] || styles.pendiente
        }`}
      >
        {estado}
      </span>
    );
  };

  const renderSolicitudCard = (sol: any) => {
    const isMod = sol.tipo_solicitud === "modificacion";
    return (
      <motion.div
        key={sol.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white dark:bg-slate-900 rounded-xl border p-4 cursor-pointer transition-all ${
          selectedSolicitud?.id === sol.id
            ? "border-blue-500 ring-2 ring-blue-500/10 shadow-lg"
            : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md"
        }`}
        onClick={() => {
          setSelectedSolicitud(sol);
          setNotasAdmin(sol.notas_admin || "");
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${
                  isMod
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {isMod ? "Modificación" : "Nueva PPS"}
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {sol.estudiante?.nombre || "Estudiante"}
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Legajo: {sol.estudiante?.legajo}
            </p>
          </div>
          {renderStatusBadge(sol.estado)}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-2.5 mb-2.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
            {isMod
              ? sol.practica?.nombre_institucion || "Institución"
              : sol.institucion?.nombre || sol.nombre_institucion_manual}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
            {isMod
              ? sol.tipo_modificacion === "horas"
                ? `Cambio de horas: ${sol.practica?.horas_realizadas} → ${sol.horas_nuevas}`
                : "Solicitud de eliminación"
              : `${sol.orientacion} • ${sol.horas_estimadas} horas`}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {new Date(sol.created_at).toLocaleDateString("es-AR")}
          </p>
          <span className="material-icons text-slate-300 dark:text-slate-700 text-sm">
            chevron_right
          </span>
        </div>
      </motion.div>
    );
  };

  const renderDetailPanel = () => {
    if (!selectedSolicitud) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="material-icons text-slate-400 dark:text-slate-600 text-3xl">
              touch_app
            </span>
          </div>
          <div>
            <p className="font-bold text-slate-600 dark:text-slate-400">Sin selección</p>
            <p className="text-sm text-slate-400 dark:text-slate-600">
              Seleccioná una solicitud de la lista para gestionar su aprobación.
            </p>
          </div>
        </div>
      );
    }

    const sol = selectedSolicitud as any;
    const isModificacion = "practica" in sol;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 inline-block ${
                isModificacion
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}
            >
              {isModificacion ? "Solicitud de Modificación" : "Nueva PPS Autogestiva"}
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {sol.estudiante?.nombre}
            </h3>
            <p className="text-slate-500 dark:text-slate-500 text-sm">{sol.estudiante?.correo}</p>
          </div>
          <button
            onClick={() => setSelectedSolicitud(null)}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-4">
              Información de la Solicitud
            </h4>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Institución</p>
                <p className="font-bold text-slate-900 dark:text-white">
                  {isModificacion
                    ? sol.practica?.nombre_institucion
                    : sol.institucion?.nombre || sol.nombre_institucion_manual}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {isModificacion ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Horas Actuales</p>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {sol.practica?.horas_realizadas || 0} hs
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Horas Solicitadas</p>
                      <p className="font-bold text-blue-600 dark:text-blue-400">
                        {sol.horas_nuevas || "N/A"} hs
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Horas Estimadas</p>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {sol.horas_estimadas} hs
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Orientación</p>
                      <p className="font-bold text-slate-900 dark:text-white">{sol.orientacion}</p>
                    </div>
                  </>
                )}
              </div>

              {!isModificacion && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Período Declarado</p>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">
                    {new Date(sol.fecha_inicio).toLocaleDateString("es-AR")} al{" "}
                    {new Date(sol.fecha_finalizacion).toLocaleDateString("es-AR")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {sol.planilla_asistencia_url && (
              <a
                href={sol.planilla_asistencia_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <span className="material-icons">description</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Planilla de Asistencia
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">Ver documento adjunto</p>
                </div>
                <span className="material-icons text-slate-300 text-sm">open_in_new</span>
              </a>
            )}

            {!isModificacion && sol.informe_final_url && (
              <a
                href={sol.informe_final_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <span className="material-icons">assignment</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Informe Final</p>
                  <p className="text-[10px] text-slate-500 truncate">Ver reporte del alumno</p>
                </div>
                <span className="material-icons text-slate-300 text-sm">open_in_new</span>
              </a>
            )}
          </div>
        </div>

        {sol.estado === "pendiente" && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Notas del Administrador (Privadas)
              </label>
              <textarea
                value={notasAdmin}
                onChange={(e) => setNotasAdmin(e.target.value)}
                placeholder="Obs internas sobre esta corrección..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowRechazoModal(true)}
                className="flex-1 rounded-xl h-12"
              >
                Rechazar
              </Button>
              <Button
                onClick={handleApprove}
                isLoading={isProcessing}
                className="flex-1 rounded-xl h-12 shadow-md shadow-blue-500/20"
              >
                Aprobar
              </Button>
            </div>
          </div>
        )}

        {sol.estado !== "pendiente" && sol.comentario_rechazo && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-rose-800 dark:text-rose-400">
              <span className="material-icons text-sm">error_outline</span>
              <p className="text-xs font-black uppercase tracking-widest">Motivo de Rechazo</p>
            </div>
            <p className="text-sm text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
              {sol.comentario_rechazo}
            </p>
          </div>
        )}
      </div>
    );
  };

  const isLoading = isLoadingMod || isLoadingNuevas;

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-fade-in">
      {/* Header unificado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Solicitudes de Correcion
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-500 font-medium">
            Gestioná modificaciones y nuevas PPS autogestivas de los alumnos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {(["pendiente", "aprobada", "rechazada"] as SolicitudStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                  statusFilter === st
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {st}
              </button>
            ))}
            <button
              onClick={() => setStatusFilter("todas")}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                statusFilter === "todas"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Cerradas
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Listado Unificado */}
        <div className="w-[450px] flex flex-col gap-4 overflow-y-auto pr-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader />
              <p className="text-xs text-slate-400 animate-pulse font-bold tracking-widest uppercase">
                Sincronizando solicitudes...
              </p>
            </div>
          ) : allSolicitudes.length === 0 ? (
            <div className="h-full">
              <EmptyState
                type="empty"
                title="Lista vacía"
                message={`No encontramos solicitudes en estado "${statusFilter}"`}
              />
            </div>
          ) : (
            <div className="space-y-4">{allSolicitudes.map(renderSolicitudCard)}</div>
          )}
        </div>

        {/* Panel de Detalles */}
        <div className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">{renderDetailPanel()}</div>
        </div>
      </div>

      <AnimatePresence>
        {showRechazoModal && selectedSolicitud && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-500 mb-6">
                  <span className="material-icons">feedback</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                  Rechazar Solicitud
                </h3>
                <p className="text-slate-500 dark:text-slate-500 text-sm mb-6 leading-relaxed">
                  Por favor, indica detalladamente la razón del rechazo. El alumno recibirá este
                  mensaje para su corrección.
                </p>

                <textarea
                  value={comentarioRechazo}
                  onChange={(e) => setComentarioRechazo(e.target.value)}
                  placeholder="Ej: El informe final no cumple con el formato requerido o faltan firmas..."
                  rows={4}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none mb-6"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRechazoModal(false);
                      setComentarioRechazo("");
                    }}
                    className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Volver
                  </button>
                  <Button
                    variant="danger"
                    onClick={handleReject}
                    isLoading={isProcessing}
                    disabled={!comentarioRechazo.trim()}
                    className="flex-1 h-12 rounded-xl"
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SolicitudesCorreccionManager;
