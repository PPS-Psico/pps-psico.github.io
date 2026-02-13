import React, { useState } from "react";
import { useSeleccionadorLogic } from "../../hooks/useSeleccionadorLogic";
import { supabase } from "../../lib/supabaseClient";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
} from "../../constants";
import {
  normalizeStringForComparison,
  getEspecialidadClasses,
  formatDate,
} from "../../utils/formatters";
import type { EnrichedStudent } from "../../types";
import Loader from "../Loader";
import EmptyState from "../EmptyState";
import Toast from "../ui/Toast";
import ConfirmModal from "../ConfirmModal";

// Componente Premium para selección de horarios
interface ScheduleSelectorProps {
  horariosSolicitados: string; // Horarios originales que solicitó el estudiante
  horarioAsignado?: string; // Horario final asignado por el admin
  isEditMode?: boolean; // true cuando se edita desde historial
  onScheduleChange: (newSchedule: string) => void;
  disabled?: boolean;
}

const ScheduleSelector: React.FC<ScheduleSelectorProps> = ({
  horariosSolicitados,
  horarioAsignado,
  isEditMode = false,
  onScheduleChange,
  disabled = false,
}) => {
  const [activeTooltip, setActiveTooltip] = React.useState<number | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  // Parsear horarios solicitados (los originales)
  const allSolicitados = React.useMemo(() => {
    if (!horariosSolicitados) return [];
    return horariosSolicitados
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [horariosSolicitados]);

  const handleRemoveSchedule = (scheduleToRemove: string) => {
    const newSchedules = allSolicitados.filter((s) => s !== scheduleToRemove);
    onScheduleChange(newSchedules.join("; "));
  };

  const handleScheduleClick = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveTooltip(activeTooltip === index ? null : index);
    setTimeout(() => setActiveTooltip(null), 4000);
  };

  // Cerrar tooltip al hacer clic fuera
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setActiveTooltip(null);
      }
    };
    if (activeTooltip !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeTooltip]);

  if (disabled) {
    const displaySchedule = isEditMode
      ? horarioAsignado || allSolicitados[0] || ""
      : horarioAsignado || horariosSolicitados;
    return (
      <div className="flex-grow lg:w-auto min-w-[200px] px-3 py-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {displaySchedule || "Horario predefinido"}
      </div>
    );
  }

  if (allSolicitados.length === 0) {
    return (
      <div className="flex-grow lg:w-auto min-w-[200px] max-w-[320px] px-3 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        Sin horarios solicitados
      </div>
    );
  }

  return (
    <div className="flex-grow lg:w-auto min-w-[200px] max-w-[320px]">
      <div className="flex flex-col gap-2">
        {allSolicitados.map((schedule, index) => {
          const isAsignado = isEditMode && horarioAsignado === schedule;

          return (
            <div
              key={index}
              ref={activeTooltip === index ? tooltipRef : null}
              onClick={(e) => handleScheduleClick(index, e)}
              className={`group relative flex items-center gap-2 pl-3 pr-2 py-2.5 rounded-lg border shadow-sm transition-all duration-200 cursor-pointer ${
                isAsignado
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                  : "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700/50 hover:shadow-md hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/40 dark:hover:to-blue-700/40"
              }`}
            >
              {/* Icono */}
              <span
                className={`material-icons text-[13px] flex-shrink-0 ${
                  isAsignado
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-blue-600 dark:text-blue-400"
                }`}
              >
                {isAsignado ? "check_circle" : "schedule"}
              </span>

              {/* Texto truncado */}
              <span className="flex-1 truncate max-w-[200px]" title="Clic para ver completo">
                {schedule}
              </span>

              {/* Botón eliminar (solo en modo normal) */}
              {!isEditMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSchedule(schedule);
                  }}
                  className="flex-shrink-0 ml-1 p-1 text-blue-500 dark:text-blue-400 hover:text-white hover:bg-red-500 dark:hover:bg-red-600 rounded-md transition-all duration-150"
                  title="Eliminar horario"
                >
                  <span className="material-icons text-[13px]">close</span>
                </button>
              )}

              {/* Tooltip */}
              {activeTooltip === index && (
                <div
                  className="absolute bottom-full mb-2 z-50"
                  style={{ left: "50%", transform: "translateX(-50%)" }}
                >
                  <div
                    className="px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white dark:text-slate-100 text-xs rounded-lg shadow-2xl border border-slate-700 dark:border-slate-600"
                    style={{ maxWidth: "350px", minWidth: "200px" }}
                  >
                    <div
                      className={`font-semibold mb-1 flex items-center gap-1 ${
                        isAsignado
                          ? "text-emerald-300 dark:text-emerald-300"
                          : "text-blue-300 dark:text-blue-300"
                      }`}
                    >
                      <span className="material-icons text-[12px]">info</span>
                      {isAsignado ? "Horario asignado:" : "Horario completo:"}
                    </div>
                    <div className="leading-relaxed break-words whitespace-normal">{schedule}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StudentRow: React.FC<{
  student: EnrichedStudent;
  onToggleSelection: (student: EnrichedStudent) => void;
  onUpdateSchedule: (id: string, newSchedule: string) => void;
  isUpdating: boolean;
  isReviewMode?: boolean;
  isEditMode?: boolean;
  showScheduleSelector?: boolean;
}> = ({
  student,
  onToggleSelection,
  onUpdateSchedule,
  isUpdating,
  isReviewMode = false,
  isEditMode = false,
  showScheduleSelector = true,
}) => {
  const isSelected = normalizeStringForComparison(student.status) === "seleccionado";

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${isSelected ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800 shadow-sm" : "bg-white dark:bg-[#0B1120] border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-800"}`}
    >
      <div className="p-3 sm:p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="flex items-center gap-3 min-w-[200px]">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-base font-black border shadow-sm ${student.puntajeTotal >= 100 ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"}`}
            title="Puntaje Total"
          >
            {student.puntajeTotal}
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate leading-tight"
              title={student.nombre}
            >
              {student.nombre}
            </h4>
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                <span className="material-icons !text-[11px]">schedule</span> {student.totalHoras}{" "}
                hs acumuladas
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full lg:w-auto flex flex-wrap items-center gap-2 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-4 min-h-[32px]">
          {/* ESTADO ACADÉMICO (Excluyente) */}
          {student.terminoCursar ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 whitespace-nowrap">
              Terminó Cursada
            </span>
          ) : student.cursandoElectivas ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800 whitespace-nowrap">
              Cursando Electivas
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 whitespace-nowrap">
              Cursando
            </span>
          )}

          {/* ALERTA: SIN PRÁCTICAS PREVIAS (Para mezclar avanzados con nuevos) */}
          {student.cantPracticas === 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:border-fuchsia-800 whitespace-nowrap shadow-sm">
              <span className="material-icons !text-[10px] mr-1">new_releases</span>
              Sin Prácticas
            </span>
          )}

          {/* Solo mostrar "Adeuda finales" si terminó de cursar, para no ensuciar la vista de los que cursan */}
          {student.terminoCursar && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border whitespace-nowrap ${student.finalesAdeuda ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800" : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700"}`}
            >
              {student.finalesAdeuda ? `Adeuda: ${student.finalesAdeuda}` : "Sin Finales"}
            </span>
          )}

          {student.trabaja && (
            <a
              href={student.certificadoTrabajo || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap hover:bg-blue-100 transition-colors"
              title="Ver certificado de trabajo"
              onClick={(e) => !student.certificadoTrabajo && e.preventDefault()}
            >
              <span className="material-icons !text-[10px] mr-1">work</span>
              Trabaja
            </a>
          )}

          {student.cvUrl && (
            <a
              href={student.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800 whitespace-nowrap hover:bg-cyan-100 transition-colors"
              title="Ver Curriculum Vitae"
            >
              <span className="material-icons !text-[10px] mr-1">description</span>
              CV
            </a>
          )}

          {/* BOTÓN WHATSAPP - Contacto de emergencia */}
          {(() => {
            const telefono = student.telefono || "";
            const numeroLimpio = telefono.replace(/\D/g, "");
            const esValido = numeroLimpio.length >= 10;

            if (!telefono) return null;

            if (!esValido) {
              return (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 whitespace-nowrap cursor-help"
                  title={`Número inválido: ${telefono}`}
                >
                  <span className="material-icons !text-[10px] mr-0.5">error</span>
                  N° mal
                </span>
              );
            }

            return (
              <a
                href={`https://wa.me/${numeroLimpio}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 whitespace-nowrap hover:bg-green-100 transition-colors"
                title={`WhatsApp: ${telefono}`}
              >
                <svg className="w-3 h-3 mr-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            );
          })()}

          {student.penalizacionAcumulada > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800 whitespace-nowrap">
              Penalización Activa
            </span>
          )}

          {student.notasEstudiante && (
            <div className="inline-flex items-start gap-1.5 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/30 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300 w-full break-words mt-1">
              <span className="font-bold text-[10px] uppercase text-yellow-700 dark:text-yellow-500 shrink-0 mt-[1px]">
                Nota:
              </span>
              <span className="italic leading-tight whitespace-pre-wrap">
                "{student.notasEstudiante}"
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
          <ScheduleSelector
            horariosSolicitados={student.horarioSeleccionado || ""}
            horarioAsignado={student.horarioAsignado}
            isEditMode={false}
            onScheduleChange={(newSchedule) => onUpdateSchedule(student.enrollmentId, newSchedule)}
            disabled={!showScheduleSelector}
          />

          <button
            onClick={() => onToggleSelection(student)}
            disabled={isUpdating}
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-sm ${
              isSelected
                ? "bg-emerald-600 text-white hover:bg-rose-600 hover:ring-rose-100 ring-2 ring-emerald-100 dark:ring-emerald-900"
                : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
            }`}
            title={isSelected ? "Dar de Baja (con penalización)" : "Seleccionar Alumno"}
          >
            {isUpdating ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-icons !text-xl">{isSelected ? "check" : "add"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

interface SeleccionadorProps {
  isTestingMode?: boolean;
  onNavigateToInsurance?: (lanzamientoId: string) => void;
  preSelectedLaunchId?: string | null;
}

const SeleccionadorConvocatorias: React.FC<SeleccionadorProps> = ({
  isTestingMode = false,
  onNavigateToInsurance,
  preSelectedLaunchId,
}) => {
  const {
    selectedLanzamiento,
    setSelectedLanzamiento,
    viewMode,
    setViewMode,
    toastInfo,
    setToastInfo,
    updatingId,
    isClosingTable,
    openLaunches,
    isLoadingLaunches,
    candidates,
    isLoadingCandidates,
    selectedCandidates,
    displayedCandidates,
    scheduleInfo,
    isEditMode,
    handleToggle,
    handleUpdateSchedule,
    handleConfirmAndCloseTable,
    closeLaunchMutation,
  } = useSeleccionadorLogic(isTestingMode, onNavigateToInsurance, preSelectedLaunchId);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [studentToBaja, setStudentToBaja] = useState<EnrichedStudent | null>(null);
  const [showPenalizacionModal, setShowPenalizacionModal] = useState(false);
  const [penaltyType, setPenaltyType] = useState("Baja Anticipada");
  const [penaltyNotes, setPenaltyNotes] = useState("");

  // Handler mejorado para toggle con penalización
  const handleToggleWithPenalty = (student: EnrichedStudent) => {
    const isCurrentlySelected = normalizeStringForComparison(student.status) === "seleccionado";

    if (isCurrentlySelected) {
      // Si está seleccionado, guardamos el estudiante y abrimos modal de penalización
      setStudentToBaja(student);
      setShowPenalizacionModal(true);
    } else {
      // Si no está seleccionado, hacemos toggle normal
      handleToggle(student);
    }
  };

  const handleConfirmBajaWithPenalty = async () => {
    if (!studentToBaja || !selectedLanzamiento) return;

    try {
      // 1. Dar de baja (cambiar estado)
      await handleToggle(studentToBaja);

      // 2. Aplicar penalización
      const penaltyData = {
        estudiante_id: studentToBaja.studentId,
        tipo_incumplimiento: penaltyType,
        fecha_incidente: new Date().toISOString().split("T")[0],
        notas: penaltyNotes,
        puntaje_penalizacion: getPenaltyScore(penaltyType),
        convocatoria_afectada: selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS],
      };

      await supabase.from("penalizaciones").insert([penaltyData]);

      setToastInfo({ message: "Estudiante dado de baja y penalizado", type: "success" });
      setShowPenalizacionModal(false);
      setStudentToBaja(null);
      setPenaltyNotes("");
    } catch (error) {
      setToastInfo({ message: "Error al procesar la baja", type: "error" });
    }
  };

  const getPenaltyScore = (type: string) => {
    const scores: Record<string, number> = {
      "Baja Anticipada": 30,
      "Baja sobre la Fecha / Ausencia en Inicio": 50,
      "Abandono durante la PPS": 70,
      "Falta sin Aviso": 40,
    };
    return scores[type] || 30;
  };

  if (isLoadingLaunches) return <Loader />;

  if (!selectedLanzamiento) {
    return (
      <div className="animate-fade-in-up">
        {toastInfo && (
          <Toast
            message={toastInfo.message}
            type={toastInfo.type}
            onClose={() => setToastInfo(null)}
          />
        )}
        <h3 className="text-xl font-bold mb-2 text-slate-800 dark:text-slate-100">
          Seleccionar Convocatoria Abierta
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Elige una convocatoria para gestionar sus postulantes.
        </p>

        {openLaunches.length === 0 ? (
          <EmptyState
            icon="event_busy"
            title="Sin Convocatorias Abiertas"
            message="No hay lanzamientos activos en este momento."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openLaunches.map((lanz) => {
              const visuals = getEspecialidadClasses(lanz[FIELD_ORIENTACION_LANZAMIENTOS]);
              return (
                <button
                  key={lanz.id}
                  onClick={() => setSelectedLanzamiento(lanz)}
                  className="text-left p-5 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0F172A] shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-600 dark:hover:shadow-blue-900/10 transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50 dark:to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <span className={visuals.tag}>{lanz[FIELD_ORIENTACION_LANZAMIENTOS]}</span>
                      <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                        {lanz[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} Cupos
                      </span>
                    </div>
                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 min-h-[3.5rem]">
                      {lanz[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="material-icons !text-base opacity-70">calendar_today</span>
                      Inicio:{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(lanz[FIELD_FECHA_INICIO_LANZAMIENTOS])}
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {selectedLanzamiento && (
        <ConfirmModal
          isOpen={isConfirmOpen}
          title={
            normalizeStringForComparison(
              selectedLanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]
            ) === "cerrado"
              ? "¿Guardar Cambios?"
              : "¿Cerrar Mesa de Inscripción?"
          }
          message={
            normalizeStringForComparison(
              selectedLanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]
            ) === "cerrado"
              ? `Se guardarán los cambios realizados (${selectedCandidates.length} estudiantes seleccionados). No se enviarán correos automáticos porque la convocatoria ya está cerrada. ¿Deseas continuar?`
              : `Se enviarán correos automáticos de confirmación a los ${selectedCandidates.length} alumnos seleccionados. ¿Deseas proceder con el cierre definitivo de esta convocatoria?`
          }
          onConfirm={() => {
            handleConfirmAndCloseTable();
            setIsConfirmOpen(false);
          }}
          onClose={() => setIsConfirmOpen(false)}
          confirmText={
            normalizeStringForComparison(
              selectedLanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]
            ) === "cerrado"
              ? "Guardar Cambios"
              : "Confirmar Cierre"
          }
          type={
            normalizeStringForComparison(
              selectedLanzamiento[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]
            ) === "cerrado"
              ? "warning"
              : "info"
          }
        />
      )}

      <div className="bg-white dark:bg-[#0F172A] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedLanzamiento(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400"
            >
              <span className="material-icons">arrow_back</span>
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cupos: {selectedLanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} | Postulantes:{" "}
                {candidates.length} | Seleccionados: {selectedCandidates.length}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Botón para alternar entre ver todos y ver solo seleccionados */}
            <button
              onClick={() => setViewMode(viewMode === "selection" ? "review" : "selection")}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors border ${
                viewMode === "review"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700"
                  : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title={
                viewMode === "selection" ? "Ver solo seleccionados" : "Ver todos los inscriptos"
              }
            >
              <span className="material-icons !text-base">
                {viewMode === "selection" ? "visibility" : "visibility_off"}
              </span>
              {viewMode === "selection"
                ? `Ver Seleccionados (${selectedCandidates.length})`
                : "Ver Todos"}
            </button>

            <button
              onClick={() => setIsConfirmOpen(true)}
              disabled={isClosingTable || selectedCandidates.length === 0}
              className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-70 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              {isClosingTable ? (
                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-icons !text-base">lock</span>
              )}
              {isClosingTable ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          {viewMode === "review" && (
            <div className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
              <span className="material-icons !text-sm">fact_check</span>
              <span className="font-bold">Modo Revisión:</span> Mostrando solo los{" "}
              {selectedCandidates.length} estudiantes seleccionados
            </div>
          )}
          {viewMode === "selection" && (
            <div className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-2 group relative cursor-help">
              <span className="font-bold">Criterio:</span> Puntaje descendente
              <span className="material-icons !text-sm opacity-70">help</span>
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <p className="font-bold mb-1 border-b border-slate-600 pb-1">Fórmula de Puntaje:</p>
                <ul className="space-y-1 list-disc pl-3">
                  <li>
                    Terminó de cursar: <strong>+100 pts</strong>
                  </li>
                  <li>
                    Cursando electivas: <strong>+50 pts</strong>
                  </li>
                  <li>
                    Trabaja (c/certificado): <strong>+20 pts</strong>
                  </li>
                  <li>
                    Adeuda finales: <strong>+30 pts</strong>
                  </li>
                  <li>
                    Horas acumuladas: <strong>+0.5 pts/hora</strong>
                  </li>
                  <li>
                    Penalizaciones: <strong>- Puntos</strong>
                  </li>
                </ul>
                <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-800 rotate-45"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoadingCandidates ? (
        <Loader />
      ) : (
        <div className="space-y-3">
          {/* Mostrar candidatos según el modo de vista */}
          {displayedCandidates.map((student) => (
            <StudentRow
              key={student.enrollmentId}
              student={student}
              onToggleSelection={handleToggleWithPenalty}
              onUpdateSchedule={handleUpdateSchedule}
              isUpdating={updatingId === student.enrollmentId}
              isReviewMode={viewMode === "review"}
              isEditMode={isEditMode}
              showScheduleSelector={scheduleInfo?.showScheduleSelector ?? true}
            />
          ))}
          {displayedCandidates.length === 0 && (
            <EmptyState
              icon="group_off"
              title="Sin Inscriptos"
              message="No hay estudiantes inscriptos en esta convocatoria."
            />
          )}
        </div>
      )}

      {/* Modal de Penalización */}
      {showPenalizacionModal && studentToBaja && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              Dar de Baja - {studentToBaja.nombre}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Selecciona el tipo de baja y agrega notas si es necesario.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tipo de Baja
                </label>
                <select
                  value={penaltyType}
                  onChange={(e) => setPenaltyType(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 px-4 text-sm"
                >
                  <option value="Baja Anticipada">Baja Anticipada (30 pts)</option>
                  <option value="Baja sobre la Fecha / Ausencia en Inicio">
                    Baja sobre la Fecha (50 pts)
                  </option>
                  <option value="Abandono durante la PPS">Abandono (70 pts)</option>
                  <option value="Falta sin Aviso">Falta sin Aviso (40 pts)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Notas
                </label>
                <textarea
                  value={penaltyNotes}
                  onChange={(e) => setPenaltyNotes(e.target.value)}
                  placeholder="Describe el motivo de la baja..."
                  rows={3}
                  className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 px-4 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPenalizacionModal(false);
                  setStudentToBaja(null);
                  setPenaltyNotes("");
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBajaWithPenalty}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-rose-600 text-white hover:bg-rose-700 transition-colors"
              >
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeleccionadorConvocatorias;
