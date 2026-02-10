import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../ui/Button";
import { useNotifications } from "../../contexts/NotificationContext";
import {
  uploadSolicitudFile,
  submitSolicitudModificacion,
  deletePractica,
} from "../../services/dataService";
import type { Practica } from "../../types";
import {
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
} from "../../constants";
import { cleanDbValue } from "../../utils/formatters";

interface SolicitudModificacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  practica: Practica | null;
  studentId: string | null;
  onSuccess?: () => void;
}

type ModificacionType = "horas" | "eliminacion" | null;

const SolicitudModificacionModal: React.FC<SolicitudModificacionModalProps> = ({
  isOpen,
  onClose,
  practica,
  studentId,
  onSuccess,
}) => {
  const { showToast } = useNotifications();
  const [step, setStep] = useState<1 | 2>(1);
  const [tipoModificacion, setTipoModificacion] = useState<ModificacionType>(null);
  const [horasNuevas, setHorasNuevas] = useState<string>("");
  const [planillaFile, setPlanillaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Reset state
      setStep(1);
      setTipoModificacion(null);
      setHorasNuevas("");
      setPlanillaFile(null);
      setShowDeleteConfirm(false);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !practica) return null;

  const institucion =
    cleanDbValue(practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) || "Institución";
  const horasActuales = practica[FIELD_HORAS_PRACTICAS] || 0;
  const orientacion = practica[FIELD_ESPECIALIDAD_PRACTICAS] || "General";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast("El archivo es demasiado grande (máx 10MB)", "error");
        return;
      }
      if (file.type !== "application/pdf") {
        showToast("Solo se permiten archivos PDF", "error");
        return;
      }
      setPlanillaFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast("El archivo es demasiado grande (máx 10MB)", "error");
        return;
      }
      if (file.type !== "application/pdf") {
        showToast("Solo se permiten archivos PDF", "error");
        return;
      }
      setPlanillaFile(file);
    }
  };

  const validateHoras = (value: string): boolean => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      showToast("Ingresá un número válido de horas", "error");
      return false;
    }
    if (num > 120) {
      showToast("El máximo permitido es 120 horas", "error");
      return false;
    }
    return true;
  };

  const handleSubmitHoras = async () => {
    if (!studentId || !practica) return;

    if (!validateHoras(horasNuevas)) return;
    if (!planillaFile) {
      showToast("Tenés que subir la planilla de asistencia", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // Subir archivo
      const planillaUrl = await uploadSolicitudFile(
        planillaFile,
        studentId,
        "modificacion",
        "planilla_asistencia"
      );

      // Crear solicitud
      await submitSolicitudModificacion(
        studentId,
        practica.id,
        "horas",
        parseInt(horasNuevas, 10),
        planillaUrl
      );

      showToast("Solicitud enviada correctamente", "success");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      showToast(error.message || "Error al enviar la solicitud", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePractica = async () => {
    if (!practica) return;

    setIsDeleting(true);
    try {
      await deletePractica(practica.id);
      showToast("PPS eliminada correctamente", "success");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      showToast(error.message || "Error al eliminar la PPS", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold text-slate-900 dark:text-white mb-1">{institucion}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {orientacion} • {horasActuales} horas
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          ¿Qué querés hacer con esta PPS?
        </p>

        <button
          onClick={() => {
            setTipoModificacion("horas");
            setStep(2);
          }}
          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
            tipoModificacion === "horas"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="material-icons text-blue-600 dark:text-blue-400">edit</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Modificar horas</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cambiar la cantidad de horas acreditadas
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-left transition-all hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/10"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <span className="material-icons text-rose-600 dark:text-rose-400">delete</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Eliminar PPS</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Borrar este registro permanentemente
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
      </div>
    </div>
  );

  const renderStep2Horas = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <span className="material-icons text-sm align-text-bottom mr-1">info</span>
          Completá los datos y subí la planilla de asistencia. Tu solicitud será revisada por la
          coordinación.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Horas a acreditar <span className="text-slate-400">(máx 120)</span>
          </label>
          <input
            type="number"
            value={horasNuevas}
            onChange={(e) => setHorasNuevas(e.target.value)}
            placeholder={`Actual: ${horasActuales} horas`}
            min="1"
            max="120"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ingresá el nuevo valor de horas que querés que se acrediten
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Planilla de asistencia <span className="text-rose-500">*</span>
          </label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : planillaFile
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-600"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {planillaFile ? (
              <div className="flex items-center justify-center gap-2">
                <span className="material-icons text-emerald-600 dark:text-emerald-400">
                  check_circle
                </span>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {planillaFile.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlanillaFile(null);
                  }}
                  className="ml-2 text-slate-400 hover:text-rose-500"
                >
                  <span className="material-icons text-sm">close</span>
                </button>
              </div>
            ) : (
              <>
                <span className="material-icons text-3xl text-slate-400 dark:text-slate-500 mb-2">
                  upload_file
                </span>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Arrastrá tu archivo PDF o hacé clic para seleccionar
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Máximo 10MB</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          variant="secondary"
          onClick={() => {
            setStep(1);
            setTipoModificacion(null);
          }}
          className="flex-1"
        >
          Volver
        </Button>
        <Button
          onClick={handleSubmitHoras}
          isLoading={isSubmitting}
          disabled={!horasNuevas || !planillaFile}
          className="flex-1"
        >
          Enviar solicitud
        </Button>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {step === 1 ? "Solicitar modificación" : "Cambiar horas"}
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
          {step === 1 ? renderStep1() : renderStep2Horas()}
        </div>
      </motion.div>

      {/* Modal de confirmación para eliminar */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-md"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
                  <span className="material-icons text-3xl text-rose-600 dark:text-rose-400">
                    warning
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  ¿Eliminar PPS?
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Esta acción no se puede deshacer. Se eliminará permanentemente el registro de{" "}
                  <strong>{institucion}</strong>.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeletePractica}
                  isLoading={isDeleting}
                  className="flex-1"
                >
                  Sí, eliminar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default SolicitudModificacionModal;
