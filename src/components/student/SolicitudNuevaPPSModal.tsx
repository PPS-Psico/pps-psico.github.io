import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
} from "../../constants/dbConstants";
import { useNotifications } from "../../contexts/NotificationContext";
import { supabase } from "../../lib/supabaseClient";
import { submitSolicitudNuevaPPS, uploadSolicitudFile } from "../../services/dataService";
import type { LanzamientoPPS } from "../../types";
import Button from "../ui/Button";

interface SolicitudNuevaPPSModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  onSuccess?: () => void;
}

const SolicitudNuevaPPSModal: React.FC<SolicitudNuevaPPSModalProps> = ({
  isOpen,
  onClose,
  studentId,
  onSuccess,
}) => {
  const { showToast } = useNotifications();

  // Estados del formulario
  const [nombreInstitucionManual, setNombreInstitucionManual] = useState<string>("");
  const [orientacion, setOrientacion] = useState<string>("");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFinalizacion, setFechaFinalizacion] = useState<string>("");
  const [horasEstimadas, setHorasEstimadas] = useState<string>("");
  const [esOnline, setEsOnline] = useState(false);
  const [planillaFile, setPlanillaFile] = useState<File | null>(null);
  const [informeFile, setInformeFile] = useState<File | null>(null);
  const [institucionSeleccionada, setInstitucionSeleccionada] = useState<Institucion | null>(null);
  const [lanzamientoSeleccionado, setLanzamientoSeleccionado] = useState<LanzamientoPPS | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);

  // Fetch instituciones y lanzamientos
  const { data: instituciones = [] } = useQuery({
    queryKey: ["instituciones"],
    queryFn: async () => {
      const { data } = await supabase
        .from("instituciones")
        .select("id, nombre, orientaciones")
        .order("nombre");
      return data || [];
    },
    enabled: isOpen,
  });

  const { data: lanzamientos = [] } = useQuery({
    queryKey: ["lanzamientos_pps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lanzamientos_pps")
        .select("*")
        .order("created_at", { ascending: false });
      return (data as LanzamientoPPS[]) || [];
    },
    enabled: isOpen,
  });

  // Filtrar lanzamientos que coincidan con el nombre ingresado
  const lanzamientosCoincidentes = useMemo(() => {
    const busquedaNormalizada = searchTerm.toLowerCase().trim();
    if (!busquedaNormalizada) return [];

    return instituciones.filter((inst) => inst.nombre?.toLowerCase().includes(busquedaNormalizada));
  }, [searchTerm, instituciones]);

  // Filtrar lanzamientos que coincidan con la institución seleccionada
  const lanzamientosDeInstitucion = useMemo(() => {
    if (!institucionSeleccionada) return [];
    return lanzamientos.filter((l) => l.institucion_id === institucionSeleccionada.id);
  }, [lanzamientos, institucionSeleccionada]);

  // Auto-completar datos cuando se selecciona institución del listado
  useEffect(() => {
    if (!institucionSeleccionada || !isOpen) return;

    if (lanzamientosDeInstitucion.length > 0) {
      // Ordenar por fecha para obtener el más reciente
      const sortedLanzamientos = [...lanzamientosDeInstitucion].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const ultimoLanzamiento = sortedLanzamientos[0];

      // Autocompletar orientación
      if (ultimoLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS]) {
        setOrientacion(ultimoLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS]);
      }

      // Autocompletar horas
      if (ultimoLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]) {
        setHorasEstimadas(String(ultimoLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]));
      }

      // Verificar si es online (Inteligente)
      const modalidad =
        (ultimoLanzamiento as any).modalidad_online === "Online" ||
        (ultimoLanzamiento as any).modalidad_online === true ||
        ultimoLanzamiento.modalidad === "Online" ||
        (ultimoLanzamiento as any).es_online === true;
      setEsOnline(modalidad);
    }
  }, [institucionSeleccionada, lanzamientosDeInstitucion, isOpen]);

  const resetForm = () => {
    setNombreInstitucionManual("");
    setOrientacion("");
    setFechaInicio("");
    setFechaFinalizacion("");
    setHorasEstimadas("");
    setEsOnline(false);
    setPlanillaFile(null);
    setInformeFile(null);
    setInstitucionSeleccionada(null);
    setLanzamientoSeleccionado(null);
    setDragActive(null);
    setSearchTerm("");
    setShowResults(false);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      resetForm();
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleFileChange = (type: "planilla" | "informe", file: File | null) => {
    if (!file) {
      if (type === "planilla") setPlanillaFile(null);
      else setInformeFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast("El archivo es demasiado grande (máx 10MB)", "error");
      return;
    }

    // Soportar PDF, Word, JPG, PNG, WEBP
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      showToast("Formato no soportado. Soportado: PDF, Word, JPG, PNG, WEBP (máx 10MB)", "error");
      return;
    }

    if (type === "planilla") {
      setPlanillaFile(file);
    } else {
      setInformeFile(file);
    }
  };

  const validateForm = (): boolean => {
    // Validar que se seleccionó una institución
    if (!institucionSeleccionada?.id) {
      showToast("Seleccioná una institución", "error");
      return false;
    }
    if (!orientacion) {
      showToast("Seleccioná una orientación", "error");
      return false;
    }
    if (!fechaInicio) {
      showToast("Ingresá la fecha de inicio", "error");
      return false;
    }
    if (!fechaFinalizacion) {
      showToast("Ingresá la fecha de finalización", "error");
      return false;
    }
    if (!horasEstimadas || parseInt(horasEstimadas) <= 0) {
      showToast("Ingresá las horas estimadas", "error");
      return false;
    }
    if (parseInt(horasEstimadas) > 120) {
      showToast("El máximo permitido es 120 horas", "error");
      return false;
    }
    // Si es online, solo informe es obligatorio
    if (esOnline && !informeFile) {
      showToast("Si es online, el informe es obligatorio", "error");
      return false;
    }
    // Si es presencial, se requiere planilla + informe
    if (!esOnline && !planillaFile) {
      showToast("Si es presencial, la planilla es obligatoria", "error");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!studentId || !validateForm()) return;

    setIsSubmitting(true);
    try {
      let planillaUrl = null;
      let informeUrl = null;

      // Subir planilla (si aplica)
      if (!esOnline && planillaFile) {
        planillaUrl = await uploadSolicitudFile(
          planillaFile,
          studentId,
          "nueva_pps",
          "planilla_asistencia"
        );
      }

      // Subir informe
      if (informeFile) {
        informeUrl = await uploadSolicitudFile(
          informeFile,
          studentId,
          "nueva_pps",
          "informe_final"
        );
      }

      // Crear solicitud
      await submitSolicitudNuevaPPS(studentId, {
        institucionId: institucionSeleccionada?.id || null,
        nombreInstitucionManual: null,
        orientacion,
        fechaInicio,
        fechaFinalizacion,
        horasEstimadas: parseInt(horasEstimadas, 10),
        planillaAsistenciaUrl: planillaUrl,
        informeFinalUrl: informeUrl,
        esOnline,
      });

      showToast("Solicitud enviada correctamente", "success");
      onSuccess?.();
      onClose();
      resetForm();
    } catch (error: any) {
      showToast(error.message || "Error al enviar la solicitud", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFileUpload = (
    type: "planilla" | "informe",
    file: File | null,
    setFile: (f: File | null) => void,
    required: boolean
  ) => (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setDragActive(type);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragActive(null);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(type);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(null);
        const f = e.dataTransfer.files[0];
        handleFileChange(type, f);
      }}
      onClick={() => document.getElementById(`file-${type}`)?.click()}
      className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
        dragActive === type
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : file
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-600"
      }`}
    >
      <input
        id={`file-${type}`}
        type="file"
        accept={
          type === "planilla"
            ? ".pdf"
            : ".pdf,.doc,.docx,.doc,.doc,.docm,.pdf,.jpeg,.jpg,.png,.webp"
        }
        onChange={(e) => {
          const f = e.target.files?.[0];
          handleFileChange(type, f);
        }}
        className="hidden"
      />
      {file ? (
        <div className="flex items-center justify-center gap-2">
          <span className="material-icons text-emerald-600 dark:text-emerald-400">
            check_circle
          </span>
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate max-w-[200px]">
            {file.name}
          </span>
          <button onClick={() => setFile(null)} className="ml-2 text-slate-400 hover:text-rose-500">
            <span className="material-icons text-sm">close</span>
          </button>
        </div>
      ) : (
        <>
          <span className="material-icons text-3xl text-slate-400 dark:text-slate-500 mb-2">
            {type === "planilla" ? "description" : "assignment"}
          </span>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {type === "planilla"
              ? "Arrastrá tu planilla de asistencia o hacé clic para seleccionar"
              : "Arrastrá tu informe final o hacé clic para seleccionar"}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Soportado: PDF, Word, JPG, PNG, WEBP (máx 10MB)
          </p>
        </>
      )}
    </div>
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Solicitar nueva PPS
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Institución */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Institución <span className="text-rose-500">*</span>
              </label>

              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons text-slate-400">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowResults(true);
                        if (!e.target.value) {
                          setInstitucionSeleccionada(null);
                        }
                      }}
                      onFocus={() => setShowResults(true)}
                      placeholder="Escribí para buscar institución..."
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Resultados de búsqueda */}
                {showResults && searchTerm.trim() && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setShowResults(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[101] max-h-60 overflow-y-auto overflow-x-hidden py-2 backdrop-blur-xl">
                      {lanzamientosCoincidentes.length > 0 ? (
                        lanzamientosCoincidentes.map((inst) => (
                          <button
                            key={inst.id}
                            onClick={() => {
                              setInstitucionSeleccionada(inst as any);
                              setSearchTerm(inst.nombre || "");
                              setShowResults(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-between"
                          >
                            <span className="font-medium">{inst.nombre}</span>
                            <span className="material-icons text-blue-500 text-sm">
                              add_circle_outline
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 italic">
                          No se encontraron resultados
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Orientación */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Orientación <span className="text-rose-500">*</span>
              </label>
              <select
                value={orientacion}
                onChange={(e) => setOrientacion(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccioná una orientación</option>
                {["Clinica", "Educacional", "Laboral", "Comunitaria"].map((ori) => (
                  <option key={ori} value={ori}>
                    {ori}
                  </option>
                ))}
              </select>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Fecha inicio <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-sshare-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Fecha fin <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={fechaFinalizacion}
                  onChange={(e) => setFechaFinalizacion(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Horas */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Cantidad de horas <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={horasEstimadas}
                onChange={(e) => setHorasEstimadas(e.target.value)}
                placeholder="Ej: 80"
                min="1"
                max="120"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Máximo 120 horas</p>
            </div>

            {/* Info sobre modalidad online */}
            {esOnline && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20 flex items-start gap-3">
                <span className="material-icons text-blue-500">info</span>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Esta institución es <strong>Online</strong>. Solo necesitás subir el informe
                  final.
                </p>
              </div>
            )}

            {/* Archivos */}
            <div className="space-y-4">
              {!esOnline && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Planilla de asistencia <span className="text-rose-500">*</span>
                  </label>
                  {renderFileUpload("planilla", planillaFile, setPlanillaFile, true)}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Informe final <span className="text-rose-500">*</span>
                </label>
                {renderFileUpload("informe", informeFile, setInformeFile, true)}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="flex-1"
            >
              Enviar solicitud
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default SolicitudNuevaPPSModal;
