import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Button from "../ui/Button";
import { useNotifications } from "../../contexts/NotificationContext";
import { uploadSolicitudFile, submitSolicitudNuevaPPS } from "../../services/dataService";
import { supabase } from "../../lib/supabaseClient";
import type { Institucion, LanzamientoPPS } from "../../types";
import {
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_ORIENTACIONES_INSTITUCIONES,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  ALL_ORIENTACIONES,
} from "../../constants";
import { formatDate } from "../../utils/formatters";

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
  const [selectedInstitucionId, setSelectedInstitucionId] = useState<string>("");
  const [nombreInstitucionManual, setNombreInstitucionManual] = useState<string>("");
  const [orientacion, setOrientacion] = useState<string>("");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFinalizacion, setFechaFinalizacion] = useState<string>("");
  const [horasEstimadas, setHorasEstimadas] = useState<string>("");
  const [esOnline, setEsOnline] = useState(false);
  const [planillaFile, setPlanillaFile] = useState<File | null>(null);
  const [informeFile, setInformeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState<string | null>(null);
  const [showManualInstitucion, setShowManualInstitucion] = useState(false);

  // Fetch instituciones
  const { data: instituciones = [] } = useQuery({
    queryKey: ["instituciones"],
    queryFn: async () => {
      const { data } = await supabase
        .from("instituciones")
        .select("*")
        .order(FIELD_NOMBRE_INSTITUCIONES);
      return data || [];
    },
    enabled: isOpen,
  });

  // Fetch lanzamientos para obtener datos por defecto
  const { data: lanzamientos = [] } = useQuery({
    queryKey: ["lanzamientos_pps"],
    queryFn: async () => {
      const { data } = await supabase.from("lanzamientos_pps").select("*");
      return data || [];
    },
    enabled: isOpen,
  });

  // Autocompletar datos cuando se selecciona institución
  useEffect(() => {
    if (selectedInstitucionId && !showManualInstitucion) {
      const institucion = instituciones.find((i) => i.id === selectedInstitucionId);
      if (institucion) {
        // Buscar lanzamientos de esta institución para obtener orientación y horas por defecto
        const lanzamientosInst = lanzamientos.filter(
          (l) => l.institucion_id === selectedInstitucionId
        );

        if (lanzamientosInst.length > 0) {
          const ultimoLanzamiento = lanzamientosInst[lanzamientosInst.length - 1];

          // Sugerir orientación (editable)
          if (ultimoLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] && !orientacion) {
            setOrientacion(ultimoLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS]);
          }

          // Sugerir horas (editable)
          if (ultimoLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] && !horasEstimadas) {
            setHorasEstimadas(String(ultimoLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]));
          }
        } else if (institucion[FIELD_ORIENTACIONES_INSTITUCIONES] && !orientacion) {
          // Si no hay lanzamientos, usar orientaciones de la institución
          const orientaciones = institucion[FIELD_ORIENTACIONES_INSTITUCIONES]?.split(",") || [];
          if (orientaciones.length > 0) {
            setOrientacion(orientaciones[0].trim());
          }
        }
      }
    }
  }, [selectedInstitucionId, instituciones, lanzamientos, showManualInstitucion]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      // Reset form
      resetForm();
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const resetForm = () => {
    setSelectedInstitucionId("");
    setNombreInstitucionManual("");
    setOrientacion("");
    setFechaInicio("");
    setFechaFinalizacion("");
    setHorasEstimadas("");
    setEsOnline(false);
    setPlanillaFile(null);
    setInformeFile(null);
    setShowManualInstitucion(false);
  };

  const handleFileChange = (type: "planilla" | "informe", file: File | null) => {
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast("El archivo es demasiado grande (máx 10MB)", "error");
        return;
      }
      if (file.type !== "application/pdf") {
        showToast("Solo se permiten archivos PDF", "error");
        return;
      }
      if (type === "planilla") {
        setPlanillaFile(file);
      } else {
        setInformeFile(file);
      }
    }
  };

  const validateForm = (): boolean => {
    if (!showManualInstitucion && !selectedInstitucionId) {
      showToast("Seleccioná una institución", "error");
      return false;
    }
    if (showManualInstitucion && !nombreInstitucionManual.trim()) {
      showToast("Ingresá el nombre de la institución", "error");
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
    if (new Date(fechaFinalizacion) <= new Date(fechaInicio)) {
      showToast("La fecha de finalización debe ser posterior a la de inicio", "error");
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
    if (!esOnline && !planillaFile) {
      showToast("Tenés que subir la planilla de asistencia (o marcar como online)", "error");
      return false;
    }
    if (!informeFile) {
      showToast("Tenés que subir el informe final", "error");
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

      // Subir planilla si no es online
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
        institucionId: showManualInstitucion ? null : selectedInstitucionId,
        nombreInstitucionManual: showManualInstitucion ? nombreInstitucionManual : null,
        orientacion,
        fechaInicio,
        fechaFinalizacion,
        horasEstimadas: parseInt(horasEstimadas, 10),
        planillaAsistenciaUrl: planillaUrl,
        informeFinalUrl: informeUrl || "",
        esOnline,
      });

      showToast("Solicitud enviada correctamente", "success");
      onSuccess?.();
      onClose();
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
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
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
        accept=".pdf"
        onChange={(e) => handleFileChange(type, e.target.files?.[0] || null)}
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
            }}
            className="ml-2 text-slate-400 hover:text-rose-500"
          >
            <span className="material-icons text-sm">close</span>
          </button>
        </div>
      ) : (
        <>
          <span className="material-icons text-2xl text-slate-400 dark:text-slate-500 mb-1">
            upload_file
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {type === "planilla" ? "Planilla de asistencia" : "Informe final"}
            {required && <span className="text-rose-500">*</span>}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">PDF, máx 10MB</p>
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
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Solicitar nueva PPS
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Completá los datos de tu práctica para que sea revisada
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-6">
            {/* Institución */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Institución <span className="text-rose-500">*</span>
              </label>

              {!showManualInstitucion ? (
                <>
                  <select
                    value={selectedInstitucionId}
                    onChange={(e) => setSelectedInstitucionId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccioná una institución</option>
                    {instituciones.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst[FIELD_NOMBRE_INSTITUCIONES]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setShowManualInstitucion(true);
                      setSelectedInstitucionId("");
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
                  >
                    La institución no está en la lista
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={nombreInstitucionManual}
                    onChange={(e) => setNombreInstitucionManual(e.target.value)}
                    placeholder="Nombre de la institución"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => {
                      setShowManualInstitucion(false);
                      setNombreInstitucionManual("");
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
                  >
                    Volver a la lista
                  </button>
                </>
              )}
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
                {ALL_ORIENTACIONES.map((ori) => (
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
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                Horas a acreditar <span className="text-slate-400">(máx 120)</span>{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={horasEstimadas}
                onChange={(e) => setHorasEstimadas(e.target.value)}
                placeholder="Ej: 80"
                min="1"
                max="120"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Es online? */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                id="es-online"
                checked={esOnline}
                onChange={(e) => {
                  setEsOnline(e.target.checked);
                  if (e.target.checked) {
                    setPlanillaFile(null);
                  }
                }}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="es-online" className="text-sm text-slate-700 dark:text-slate-300">
                Esta PPS fue realizada en modalidad online
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  (No se requiere planilla de asistencia)
                </span>
              </label>
            </div>

            {/* Archivos */}
            <div className="grid grid-cols-2 gap-4">
              {!esOnline && renderFileUpload("planilla", planillaFile, setPlanillaFile, true)}
              {renderFileUpload("informe", informeFile, setInformeFile, true)}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={
                  (!showManualInstitucion && !selectedInstitucionId) ||
                  (showManualInstitucion && !nombreInstitucionManual.trim()) ||
                  !orientacion ||
                  !fechaInicio ||
                  !fechaFinalizacion ||
                  !horasEstimadas ||
                  (!esOnline && !planillaFile) ||
                  !informeFile
                }
                className="flex-1"
              >
                Enviar solicitud
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default SolicitudNuevaPPSModal;
