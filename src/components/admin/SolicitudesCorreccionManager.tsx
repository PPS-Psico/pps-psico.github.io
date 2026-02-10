import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchAllSolicitudesModificacion,
  fetchAllSolicitudesNuevaPPS,
  approveSolicitudModificacion,
  rejectSolicitudModificacion,
  approveSolicitudNuevaPPS,
  rejectSolicitudNuevaPPS,
} from "../../services/dataService";
import { useNotifications } from "../../contexts/NotificationContext";
import Button from "../ui/Button";
import Loader from "../Loader";
import EmptyState from "../EmptyState";
import ConfirmModal from "../ConfirmModal";

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
  const [activeTab, setActiveTab] = useState<TabType>("modificaciones");
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
      if (activeTab === "modificaciones") {
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
      if (activeTab === "modificaciones") {
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
        className={`px-2 py-1 rounded-full text-xs font-bold uppercase border ${
          styles[estado as keyof typeof styles] || styles.pendiente
        }`}
      >
        {estado}
      </span>
    );
  };

  const renderSolicitudModificacionCard = (sol: SolicitudModificacion) => (
    <motion.div
      key={sol.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-slate-900 rounded-xl border p-5 cursor-pointer transition-all ${
        selectedSolicitud?.id === sol.id
          ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700"
      }`}
      onClick={() => {
        setSelectedSolicitud(sol);
        setNotasAdmin(sol.notas_admin || "");
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-slate-900 dark:text-white">
            {sol.estudiante?.nombre || "Estudiante"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Legajo: {sol.estudiante?.legajo}
          </p>
        </div>
        {renderStatusBadge(sol.estado)}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 mb-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {sol.practica?.nombre_institucion || "Institución"}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {sol.tipo_modificacion === "horas" ? (
            <>
              Cambio de horas: {sol.practica?.horas_realizadas} → {sol.horas_nuevas} horas
            </>
          ) : (
            "Solicitud de eliminación"
          )}
        </p>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Solicitado: {new Date(sol.created_at).toLocaleDateString("es-AR")}
      </p>
    </motion.div>
  );

  const renderSolicitudNuevaCard = (sol: SolicitudNueva) => (
    <motion.div
      key={sol.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-slate-900 rounded-xl border p-5 cursor-pointer transition-all ${
        selectedSolicitud?.id === sol.id
          ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700"
      }`}
      onClick={() => {
        setSelectedSolicitud(sol);
        setNotasAdmin(sol.notas_admin || "");
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-slate-900 dark:text-white">
            {sol.estudiante?.nombre || "Estudiante"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Legajo: {sol.estudiante?.legajo}
          </p>
        </div>
        {renderStatusBadge(sol.estado)}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 mb-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {sol.institucion?.nombre || sol.nombre_institucion_manual}
        </p>
        <div className="flex gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{sol.orientacion}</span>
          <span>•</span>
          <span>{sol.horas_estimadas} horas</span>
          {sol.es_online && (
            <>
              <span>•</span>
              <span className="text-blue-600 dark:text-blue-400">Online</span>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Solicitado: {new Date(sol.created_at).toLocaleDateString("es-AR")}
      </p>
    </motion.div>
  );

  const renderDetailPanel = () => {
    if (!selectedSolicitud) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600">
          <p>Seleccioná una solicitud para ver los detalles</p>
        </div>
      );
    }

    const isModificacion = activeTab === "modificaciones";
    const sol = selectedSolicitud as SolicitudModificacion | SolicitudNueva;

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {sol.estudiante?.nombre}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">{sol.estudiante?.correo}</p>
          </div>
          <button
            onClick={() => setSelectedSolicitud(null)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {isModificacion ? (
          <>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">
                Detalles de la práctica
              </h4>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-slate-500">Institución: </span>
                  {Array.isArray((sol as SolicitudModificacion).practica?.nombre_institucion)
                    ? (sol as SolicitudModificacion).practica?.nombre_institucion?.[0]
                    : (sol as SolicitudModificacion).practica?.nombre_institucion}
                </p>
                {(sol as SolicitudModificacion).tipo_modificacion === "horas" ? (
                  <>
                    <p>
                      <span className="text-slate-500">Horas actuales: </span>
                      <span className="font-medium">
                        {(sol as SolicitudModificacion).practica?.horas_realizadas} horas
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-500">Nuevas horas: </span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {(sol as SolicitudModificacion).horas_nuevas} horas
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-rose-600 dark:text-rose-400 font-medium">
                    Solicitud de eliminación
                  </p>
                )}
              </div>
            </div>

            {(sol as SolicitudModificacion).planilla_asistencia_url && (
              <a
                href={(sol as SolicitudModificacion).planilla_asistencia_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <span className="material-icons">description</span>
                <span>Ver planilla de asistencia</span>
                <span className="material-icons text-sm ml-auto">open_in_new</span>
              </a>
            )}
          </>
        ) : (
          <>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">
                Detalles de la nueva PPS
              </h4>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-slate-500">Institución: </span>
                  <span className="font-medium">
                    {(sol as SolicitudNueva).institucion?.nombre ||
                      (sol as SolicitudNueva).nombre_institucion_manual}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">Orientación: </span>
                  {(sol as SolicitudNueva).orientacion}
                </p>
                <p>
                  <span className="text-slate-500">Período: </span>
                  {new Date((sol as SolicitudNueva).fecha_inicio).toLocaleDateString(
                    "es-AR"
                  )} -{" "}
                  {new Date((sol as SolicitudNueva).fecha_finalizacion).toLocaleDateString("es-AR")}
                </p>
                <p>
                  <span className="text-slate-500">Horas: </span>
                  <span className="font-medium">
                    {(sol as SolicitudNueva).horas_estimadas} horas
                  </span>
                </p>
                {(sol as SolicitudNueva).es_online && (
                  <p className="text-blue-600 dark:text-blue-400">Modalidad: Online</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {(sol as SolicitudNueva).planilla_asistencia_url && (
                <a
                  href={(sol as SolicitudNueva).planilla_asistencia_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm"
                >
                  <span className="material-icons">description</span>
                  <span>Planilla</span>
                </a>
              )}
              <a
                href={(sol as SolicitudNueva).informe_final_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm"
              >
                <span className="material-icons">assignment</span>
                <span>Informe final</span>
              </a>
            </div>
          </>
        )}

        {sol.estado === "pendiente" && (
          <>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Notas internas (opcional)
              </label>
              <textarea
                value={notasAdmin}
                onChange={(e) => setNotasAdmin(e.target.value)}
                placeholder="Agregar notas sobre esta solicitud..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setShowRechazoModal(true)}
                className="flex-1"
              >
                Rechazar
              </Button>
              <Button onClick={handleApprove} isLoading={isProcessing} className="flex-1">
                Aprobar
              </Button>
            </div>
          </>
        )}

        {sol.comentario_rechazo && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
            <p className="text-sm font-medium text-rose-800 dark:text-rose-200 mb-1">
              Motivo del rechazo:
            </p>
            <p className="text-sm text-rose-700 dark:text-rose-300">{sol.comentario_rechazo}</p>
          </div>
        )}
      </div>
    );
  };

  const currentSolicitudes =
    activeTab === "modificaciones" ? solicitudesModificacion : solicitudesNuevas;
  const isLoading = activeTab === "modificaciones" ? isLoadingMod : isLoadingNuevas;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Solicitudes de Corrección
        </h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SolicitudStatus)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
        >
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="todas">Todas</option>
        </select>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => {
            setActiveTab("modificaciones");
            setSelectedSolicitud(null);
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
            activeTab === "modificaciones"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          Modificaciones ({solicitudesModificacion.filter((s) => s.estado === "pendiente").length})
        </button>
        <button
          onClick={() => {
            setActiveTab("nuevas");
            setSelectedSolicitud(null);
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
            activeTab === "nuevas"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          Nuevas PPS ({solicitudesNuevas.filter((s) => s.estado === "pendiente").length})
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader />
            </div>
          ) : currentSolicitudes.length === 0 ? (
            <EmptyState
              type="empty"
              title="Sin solicitudes"
              message={`No hay solicitudes ${statusFilter === "todas" ? "" : statusFilter + "s"} para mostrar`}
            />
          ) : (
            <div className="space-y-4">
              {activeTab === "modificaciones"
                ? solicitudesModificacion.map(renderSolicitudModificacionCard)
                : solicitudesNuevas.map(renderSolicitudNuevaCard)}
            </div>
          )}
        </div>

        <div className="w-96 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 overflow-y-auto border border-slate-200 dark:border-slate-700">
          {renderDetailPanel()}
        </div>
      </div>

      <AnimatePresence>
        {showRechazoModal && selectedSolicitud && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                Rechazar solicitud
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                Explicá el motivo del rechazo. Este mensaje será visible para el estudiante.
              </p>
              <textarea
                value={comentarioRechazo}
                onChange={(e) => setComentarioRechazo(e.target.value)}
                placeholder="Ej: La planilla de asistencia no está firmada..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 mb-4 focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowRechazoModal(false);
                    setComentarioRechazo("");
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleReject}
                  isLoading={isProcessing}
                  disabled={!comentarioRechazo.trim()}
                  className="flex-1"
                >
                  Confirmar rechazo
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SolicitudesCorreccionManager;
