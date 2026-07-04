import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
} from "../../constants/dbConstants";
import { useNotifications } from "../../contexts/NotificationContext";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabaseClient";
import { submitSolicitudNuevaPPS, uploadSolicitudFile } from "../../services";
import type { Institucion, LanzamientoPPS } from "../../types";
import { Icon } from "./ds";
import { getErrorMessage } from "../../utils/getErrorMessage";

/** Proyección parcial de lanzamiento usada por el modal (datos del select + extras opcionales). */
interface LanzamientoLite {
  id: string;
  institucion_id: string | null;
  cupos_disponibles?: number | null;
  created_at?: string;
  [key: string]: unknown;
}

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
  const { resolvedTheme } = useTheme();

  // Estados del formulario
  const [nombreInstitucionManual, setNombreInstitucionManual] = useState<string>("");
  const [orientacion, setOrientacion] = useState<string>("");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFinalizacion, setFechaFinalizacion] = useState<string>("");
  const [horasEstimadas, setHorasEstimadas] = useState<string>("80");
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
  const lastAutocompletedInstId = useRef<string | null>(null);

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

  const { data: lanzamientos = [] } = useQuery<LanzamientoLite[]>({
    queryKey: ["lanzamientos_pps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lanzamientos_pps")
        .select(
          "id, institucion_id, cupos_disponibles, horas_acreditadas, orientacion, es_online, created_at"
        )
        .order("created_at", { ascending: false });
      return (data as unknown as LanzamientoLite[]) || [];
    },
    enabled: isOpen,
  });

  // Agrupar lanzamientos por institucion_id para filtrar por cupos
  const lanzamientosPorInstitucion = useMemo(() => {
    const map = new Map<string, LanzamientoLite[]>();
    for (const l of lanzamientos) {
      const existing = map.get(l.institucion_id || "") || [];
      existing.push(l);
      map.set(l.institucion_id || "", existing);
    }
    return map;
  }, [lanzamientos]);

  // Filtrar instituciones que coincidan con el nombre ingresado (sin restricciones de cupos ni grupos)
  const institucionesCoincidentes = useMemo(() => {
    const busquedaNormalizada = searchTerm.toLowerCase().trim();
    if (!busquedaNormalizada) return [];

    return instituciones
      .filter((inst) => inst.nombre?.toLowerCase().includes(busquedaNormalizada))
      .map((inst) => ({
        ...inst,
        disabled: false,
      }));
  }, [searchTerm, instituciones]);

  // Filtrar lanzamientos que coincidan con la institución seleccionada
  const lanzamientosDeInstitucion = useMemo(() => {
    if (!institucionSeleccionada) return [];
    return lanzamientos.filter((l) => l.institucion_id === institucionSeleccionada.id);
  }, [lanzamientos, institucionSeleccionada]);

  const maxHorasPermitidas = useMemo(() => {
    if (lanzamientosDeInstitucion.length > 0) {
      const sortedLanzamientos = [...lanzamientosDeInstitucion].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      const ultimoLanzamiento = sortedLanzamientos[0];
      if (ultimoLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]) {
        return Number(ultimoLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]) || 80;
      }
    }
    return 80;
  }, [lanzamientosDeInstitucion]);

  // Auto-completar datos cuando se selecciona institución del listado
  useEffect(() => {
    if (!institucionSeleccionada || !isOpen) {
      lastAutocompletedInstId.current = null;
      return;
    }

    if (lastAutocompletedInstId.current === institucionSeleccionada.id) return;
    lastAutocompletedInstId.current = institucionSeleccionada.id;

    let orientacionAutocompletada = "";

    if (lanzamientosDeInstitucion.length > 0) {
      // Ordenar por fecha para obtener el más reciente
      const sortedLanzamientos = [...lanzamientosDeInstitucion].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      const ultimoLanzamiento = sortedLanzamientos[0];

      // Autocompletar orientación
      if (ultimoLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS]) {
        const val = ultimoLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] as string;
        setOrientacion(val);
        orientacionAutocompletada = val;
      }

      // Autocompletar horas
      if (ultimoLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]) {
        setHorasEstimadas(String(ultimoLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]));
      }

      // Verificar si es online (Inteligente)
      const modalidad =
        (ultimoLanzamiento as Record<string, unknown>).modalidad_online === "Online" ||
        (ultimoLanzamiento as Record<string, unknown>).modalidad_online === true ||
        (ultimoLanzamiento as Record<string, unknown>).modalidad === "Online" ||
        (ultimoLanzamiento as Record<string, unknown>).es_online === true;
      setEsOnline(modalidad);
    }

    // Si no se pudo obtener orientación del lanzamiento, intentar desde los metadatos de la institución
    if (!orientacionAutocompletada && institucionSeleccionada.orientaciones) {
      const parsedOri = String(institucionSeleccionada.orientaciones).trim();
      const validOrientations = ["Clínica", "Educacional", "Laboral", "Comunitaria"];

      const exactMatch = validOrientations.find((o) => o.toLowerCase() === parsedOri.toLowerCase());
      if (exactMatch) {
        setOrientacion(exactMatch);
      } else {
        const found = validOrientations.find((o) =>
          parsedOri.toLowerCase().includes(o.toLowerCase())
        );
        if (found) {
          setOrientacion(found);
        }
      }
    }
  }, [institucionSeleccionada, lanzamientosDeInstitucion, isOpen]);

  const resetForm = () => {
    setNombreInstitucionManual("");
    setOrientacion("");
    setFechaInicio("");
    setFechaFinalizacion("");
    setHorasEstimadas("80");
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
    if (parseInt(horasEstimadas) > maxHorasPermitidas) {
      showToast(`El máximo permitido es ${maxHorasPermitidas} horas`, "error");
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
      let planillaUrl: string | null = null;
      let informeUrl: string | null = null;

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
    } catch (error) {
      showToast(getErrorMessage(error, "Error al enviar la solicitud"), "error");
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
      className="relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition"
      style={{
        borderColor: dragActive === type || file ? "var(--accent)" : "var(--line-strong)",
        background: dragActive === type || file ? "var(--tint)" : "var(--bg-sunken)",
      }}
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
          handleFileChange(type, f ?? null);
        }}
        className="hidden"
      />
      {file ? (
        <div className="flex items-center justify-center gap-2">
          <Icon name="check" size={18} color="var(--accent-text)" strokeWidth={2.4} />
          <span
            className="text-sm font-bold truncate max-w-[200px]"
            style={{ color: "var(--accent-text)" }}
          >
            {file.name}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
            }}
            className="ml-1 p-1 rounded-md"
            style={{ color: "var(--ink-muted)" }}
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
            style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}
          >
            <Icon name="upload" size={18} strokeWidth={2} />
          </div>
          <p className="text-sm font-bold" style={{ color: "var(--ink-soft)" }}>
            {type === "planilla"
              ? "Arrastrá tu planilla de asistencia o hacé clic"
              : "Arrastrá tu informe final o hacé clic"}
          </p>
          <p className="text-xs" style={{ color: "var(--ink-subtle)" }}>
            PDF, Word, JPG, PNG, WEBP · máx 10MB
          </p>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  const fieldStyle: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--line-strong)",
    color: "var(--ink)",
  };
  const labelStyle: React.CSSProperties = { color: "var(--ink-muted)" };

  return createPortal(
    <div
      className="ed fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4"
      data-mode={resolvedTheme}
      data-accent="teal"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)" }}
      >
        <div
          className="flex-shrink-0 px-5 py-4 sm:px-7 sm:py-5 flex items-center justify-between safe-area-top"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="min-w-0 pr-4">
            <span className="eyebrow" style={{ color: "var(--accent-text)" }}>
              Carga de PPS
            </span>
            <h2
              style={{
                fontSize: 26,
                marginTop: 2,
                color: "var(--ink)",
                fontFamily: '"Instrument Serif", ui-serif, Georgia, serif',
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
              }}
            >
              Cargar una PPS realizada
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 rounded-full transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: "var(--ink-muted)" }}
            aria-label="Cerrar"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7 custom-scrollbar">
          <div className="space-y-5">
            {/* Institución */}
            <div>
              <label className="block text-sm font-bold mb-2" style={labelStyle}>
                Institución <span style={{ color: "#c0563f" }}>*</span>
              </label>

              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Icon name="search" size={18} color="var(--ink-muted)" />
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
                      className="w-full pl-12 pr-4 py-3 rounded-xl outline-none focus:ring-2 transition"
                      style={fieldStyle}
                    />
                  </div>
                </div>

                {/* Resultados de búsqueda */}
                {showResults && searchTerm.trim() && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setShowResults(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[101] max-h-60 overflow-y-auto overflow-x-hidden py-2 backdrop-blur-xl">
                      {institucionesCoincidentes.length > 0 ? (
                        institucionesCoincidentes.map((inst) => (
                          <button
                            key={inst.id}
                            onClick={() => {
                              if (inst.disabled) return;
                              setInstitucionSeleccionada(inst as unknown as Institucion);
                              setSearchTerm(inst.nombre || "");
                              setShowResults(false);
                            }}
                            className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${
                              inst.disabled
                                ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50"
                                : "hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-200"
                            }`}
                            disabled={inst.disabled}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-medium ${inst.disabled ? "text-slate-400" : ""}`}
                                >
                                  {inst.nombre}
                                </span>
                                {inst.disabled && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                    <span className="material-icons !text-xs">lock</span>
                                    Cupo individual
                                  </span>
                                )}
                              </div>
                              {inst.disabled && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Temporalmente deshabilitado • Solo grupos de 3+ estudiantes
                                </p>
                              )}
                            </div>
                            {!inst.disabled && (
                              <span className="material-icons text-blue-500 text-sm">
                                add_circle_outline
                              </span>
                            )}
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
              <label className="block text-sm font-bold mb-2" style={labelStyle}>
                Orientación <span style={{ color: "#c0563f" }}>*</span>
              </label>
              <select
                value={orientacion}
                onChange={(e) => setOrientacion(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2"
                style={fieldStyle}
              >
                <option value="">Seleccioná una orientación</option>
                {["Clínica", "Educacional", "Laboral", "Comunitaria"].map((ori) => (
                  <option key={ori} value={ori}>
                    {ori}
                  </option>
                ))}
              </select>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2" style={labelStyle}>
                  Fecha inicio <span style={{ color: "#c0563f" }}>*</span>
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2" style={labelStyle}>
                  Fecha fin <span style={{ color: "#c0563f" }}>*</span>
                </label>
                <input
                  type="date"
                  value={fechaFinalizacion}
                  onChange={(e) => setFechaFinalizacion(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2"
                  style={fieldStyle}
                />
              </div>
            </div>

            {/* Horas */}
            <div>
              <label className="block text-sm font-bold mb-2" style={labelStyle}>
                Cantidad de horas <span style={{ color: "#c0563f" }}>*</span>
              </label>
              <input
                type="number"
                value={horasEstimadas}
                onChange={(e) => setHorasEstimadas(e.target.value)}
                placeholder="Ej: 80"
                min="1"
                max={maxHorasPermitidas}
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 transition"
                style={fieldStyle}
              />
              <p className="text-xs mt-1" style={{ color: "var(--ink-subtle)" }}>
                Máximo {maxHorasPermitidas} horas
              </p>
            </div>

            {/* Info sobre modalidad online */}
            {esOnline && (
              <div
                className="p-4 rounded-xl flex items-start gap-3"
                style={{ background: "var(--tint)", border: "1px solid var(--line)" }}
              >
                <Icon name="help" size={18} color="var(--accent-text)" />
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  Esta institución es <strong>Online</strong>. Solo necesitás subir el informe
                  final.
                </p>
              </div>
            )}

            {/* Archivos */}
            <div className="space-y-4">
              {!esOnline && (
                <div>
                  <label className="block text-sm font-bold mb-2" style={labelStyle}>
                    Planilla de asistencia <span style={{ color: "#c0563f" }}>*</span>
                  </label>
                  {renderFileUpload("planilla", planillaFile, setPlanillaFile, true)}
                </div>
              )}
              <div>
                <label className="block text-sm font-bold mb-2" style={labelStyle}>
                  Informe final <span style={{ color: "#c0563f" }}>*</span>
                </label>
                {renderFileUpload("informe", informeFile, setInformeFile, true)}
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex-shrink-0 px-5 py-4 sm:px-7 sm:py-4 flex gap-3 safe-area-bottom"
          style={{ borderTop: "1px solid var(--line)", background: "var(--bg-elevated)" }}
        >
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-40"
            style={{ color: "var(--ink-muted)", border: "1px solid var(--line-strong)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
            style={{ background: "var(--accent)" }}
          >
            {isSubmitting ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default SolicitudNuevaPPSModal;
