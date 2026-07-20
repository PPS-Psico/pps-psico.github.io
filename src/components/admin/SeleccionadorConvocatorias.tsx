import React, { useState } from "react";
import {
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  getPenaltyScore,
} from "../../constants";
import { useSeleccionadorLogic } from "../../hooks/useSeleccionadorLogic";
import { supabase } from "../../lib/supabaseClient";
import type { EnrichedStudent } from "../../types";
import {
  formatDate,
  getEspecialidadClasses,
  getWhatsAppUrl,
  isValidWhatsAppFormat,
  normalizeStringForComparison,
} from "../../utils/formatters";
import { parseSchedules } from "../../utils/scheduleUtils";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import { logger } from "../../utils/logger";
import DisapprovalBadge from "./DisapprovalBadge";
import { calculateTotalHours, isPracticeDisapproved } from "../../logic/studentRules";

const isCommitmentAccepted = (status?: string | null) =>
  normalizeStringForComparison(status) === "aceptado";

const formatCommitmentDate = (dateStr?: string | null) => {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CommitmentStatusChip: React.FC<{
  status?: string | null;
  acceptedAt?: string | null;
  compact?: boolean;
}> = ({ status, acceptedAt, compact = false }) => {
  const accepted = isCommitmentAccepted(status);

  if (compact) {
    return (
      <span
        className={`lv4-badge ${accepted ? "lv4-badge-ok" : "lv4-badge-warn"}`}
        title={
          accepted && acceptedAt
            ? `Confirmado el ${formatCommitmentDate(acceptedAt)}`
            : "Pendiente de confirmación"
        }
      >
        {accepted ? "Confirmado" : "Pendiente"}
      </span>
    );
  }

  return (
    <div
      className={`lv4-commit-block ${accepted ? "confirmed" : "pending"}`}
      title={
        accepted && acceptedAt
          ? `Aceptado el ${formatCommitmentDate(acceptedAt)}`
          : "Aún no confirmó desde Mi Panel"
      }
    >
      <span className="material-icons">{accepted ? "verified" : "pending_actions"}</span>
      <div>
        <span className="lv4-commit-block-title">
          {accepted ? "Compromiso confirmado" : "Compromiso pendiente"}
        </span>
        <span className="lv4-commit-block-sub">
          {accepted && acceptedAt
            ? `Aceptado el ${formatCommitmentDate(acceptedAt)}`
            : "Aún no confirmó desde Mi Panel"}
        </span>
      </div>
    </div>
  );
};

// Componente Premium para selección de horarios
interface ScheduleSelectorProps {
  horariosSolicitados: string;
  horarioAsignado?: string;
  isEditMode?: boolean;
  onScheduleChange: (newSchedule: string) => void;
  disabled?: boolean;
  horariosDisponibles?: string[];
}

const ScheduleSelector: React.FC<ScheduleSelectorProps> = ({
  horariosSolicitados,
  horarioAsignado,
  isEditMode = false,
  onScheduleChange,
  disabled = false,
  horariosDisponibles = [],
}) => {
  const [activeTooltip, setActiveTooltip] = React.useState<number | null>(null);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const allSolicitados = React.useMemo(
    () => parseSchedules(horariosSolicitados),
    [horariosSolicitados]
  );
  const parsedAsignado = React.useMemo(() => parseSchedules(horarioAsignado), [horarioAsignado]);

  const displaySchedules = React.useMemo(() => {
    if (isEditMode) {
      if (parsedAsignado.length > 0) return parsedAsignado;
      if (horarioAsignado === null || horarioAsignado === undefined) {
        return allSolicitados;
      }
      return [];
    }
    if (parsedAsignado.length > 0) return parsedAsignado;
    return allSolicitados;
  }, [isEditMode, parsedAsignado, allSolicitados, horarioAsignado]);

  const handleRemoveSchedule = (scheduleToRemove: string) => {
    const newSchedules = displaySchedules.filter((s) => s !== scheduleToRemove);
    onScheduleChange(newSchedules.join("; "));
  };

  const handleAddSchedule = (schedule: string) => {
    if (!displaySchedules.includes(schedule)) {
      onScheduleChange([...displaySchedules, schedule].join("; "));
    }
    setShowDropdown(false);
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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (activeTooltip !== null || showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeTooltip, showDropdown]);

  if (disabled) {
    const displaySchedule = isEditMode
      ? parsedAsignado.length > 0
        ? displaySchedules[0]
        : allSolicitados[0]
      : horarioAsignado || horariosSolicitados;
    return (
      <div className="lv4-schedule-empty muted">{displaySchedule || "Horario predefinido"}</div>
    );
  }

  if (displaySchedules.length === 0) {
    if (horariosDisponibles.length > 0) {
      return (
        <div className="lv4-schedule-list" ref={dropdownRef}>
          {!showDropdown ? (
            <button className="lv4-schedule-add" onClick={() => setShowDropdown(true)}>
              <span className="material-icons">add_circle</span>
              Asignar horario
            </button>
          ) : (
            <div className="lv4-schedule-dropdown">
              <div className="lv4-schedule-dropdown-head">Seleccionar horario</div>
              <div className="lv4-schedule-dropdown-list">
                {horariosDisponibles.map((horario, idx) => (
                  <button key={idx} onClick={() => handleAddSchedule(horario)}>
                    <span className="material-icons">schedule</span>
                    <span className="lv4-schedule-chip-text">{horario}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return <div className="lv4-schedule-empty muted">Sin horarios asignados</div>;
  }

  return (
    <div className="lv4-schedule-list">
      {displaySchedules.map((schedule, index) => {
        const isAsignado = isEditMode && horarioAsignado === schedule;

        return (
          <div
            key={index}
            ref={activeTooltip === index ? tooltipRef : null}
            className={`lv4-schedule-chip ${isAsignado ? "assigned" : ""}`}
            onClick={(e) => handleScheduleClick(index, e)}
          >
            <span className="material-icons">{isAsignado ? "check_circle" : "schedule"}</span>
            <span className="lv4-schedule-chip-text" title="Clic para ver completo">
              {schedule}
            </span>

            {(isEditMode || displaySchedules.length > 1) && (
              <button
                className="lv4-schedule-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveSchedule(schedule);
                }}
                title="Eliminar horario"
              >
                <span className="material-icons">close</span>
              </button>
            )}

            {activeTooltip === index && (
              <div className="lv4-tooltip" style={{ pointerEvents: "auto" }}>
                <div className="lv4-tooltip-title">
                  <span className="material-icons" style={{ fontSize: 12 }}>
                    info
                  </span>
                  {isAsignado ? "Horario asignado" : "Horario completo"}
                </div>
                <div style={{ wordBreak: "break-word", whiteSpace: "normal" }}>{schedule}</div>
                <span className="lv4-tooltip-arrow" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const StudentRow: React.FC<{
  student: EnrichedStudent;
  onToggleSelection: (student: EnrichedStudent) => void;
  onUpdateSchedule: (student: EnrichedStudent, newSchedule: string) => void;
  isUpdating: boolean;
  isReviewMode?: boolean;
  isEditMode?: boolean;
  showScheduleSelector?: boolean;
  onShowPracticas?: (student: EnrichedStudent) => void;
  horariosDisponibles?: string[];
}> = ({
  student,
  onToggleSelection,
  onUpdateSchedule,
  isUpdating,
  isReviewMode = false,
  isEditMode = false,
  showScheduleSelector = true,
  onShowPracticas,
  horariosDisponibles = [],
}) => {
  const isSelected = normalizeStringForComparison(student.status) === "seleccionado";
  const isCommitmentConfirmed = isSelected && isCommitmentAccepted(student.compromisoEstado);
  const showCommitmentStatus = isSelected && (isReviewMode || isEditMode);

  const cardClass = isCommitmentConfirmed
    ? "lv4-card confirmed"
    : isSelected
      ? "lv4-card selected"
      : "lv4-card";

  return (
    <div className={cardClass}>
      <div className="lv4-card-id">
        <div
          className={`lv4-avatar-score ${student.puntajeTotal >= 100 ? "high" : ""}`}
          title="Ver prácticas del estudiante"
          onClick={() => onShowPracticas?.(student)}
        >
          {student.puntajeTotal}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 className="lv4-card-name" title={student.nombre}>
            {student.nombre}
          </h4>
          <div className="lv4-card-hours">
            <span className="material-icons">schedule</span>
            {student.totalHoras} hs acumuladas
          </div>
        </div>
      </div>

      <div className="lv4-card-badges">
        {/* ESTADO ACADÉMICO (Excluyente) */}
        {student.terminoCursar ? (
          <span className="lv4-badge lv4-badge-ok">Terminó Cursada</span>
        ) : student.cursandoElectivas ? (
          <span className="lv4-badge lv4-badge-accent">Cursando Electivas</span>
        ) : (
          <span className="lv4-badge lv4-badge-muted">Cursando</span>
        )}

        {student.cantPracticas === 0 && (
          <span className="lv4-badge lv4-badge-ai">
            <span className="material-icons">new_releases</span>
            Sin Prácticas
          </span>
        )}

        <DisapprovalBadge disapprovals={student.desaprobaciones} />

        {student.terminoCursar && (
          <span
            className={`lv4-badge ${student.finalesAdeuda ? "lv4-badge-warn" : "lv4-badge-muted"}`}
          >
            {student.finalesAdeuda ? `Adeuda: ${student.finalesAdeuda}` : "Sin Finales"}
          </span>
        )}

        {student.trabaja && (
          <a
            href={student.certificadoTrabajo || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="lv4-badge lv4-badge-accent"
            title="Ver certificado de trabajo"
            onClick={(e) => !student.certificadoTrabajo && e.preventDefault()}
          >
            <span className="material-icons">work</span>
            Trabaja
          </a>
        )}

        {student.cvUrl && (
          <a
            href={student.cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lv4-badge lv4-badge-accent"
            title="Ver Curriculum Vitae"
          >
            <span className="material-icons">description</span>
            CV
          </a>
        )}

        {/* BOTÓN WHATSAPP - Validado contra formato */}
        {(() => {
          if (!student.telefono) return null;

          if (!isValidWhatsAppFormat(student.telefono)) {
            return (
              <span
                className="lv4-badge lv4-badge-danger-strong"
                title={`Número inválido: ${student.telefono}`}
              >
                <span className="material-icons">error</span>
                N° mal
              </span>
            );
          }

          const url = getWhatsAppUrl(student.telefono);
          if (!url) return null;

          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="lv4-badge lv4-badge-ok"
              title={`WhatsApp: ${student.telefono}`}
            >
              <svg
                className="lv4-wa-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ width: 12, height: 12 }}
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
          );
        })()}

        {student.penalizacionAcumulada > 0 && (
          <span className="lv4-badge lv4-badge-danger">
            {student.penalizacionAcumulada} pts de penalización
          </span>
        )}

        {showCommitmentStatus && (
          <CommitmentStatusChip
            status={student.compromisoEstado}
            acceptedAt={student.compromisoFecha}
            compact
          />
        )}

        {student.notasEstudiante && (
          <div className="lv4-card-note" style={{ width: "100%" }}>
            <span className="lv4-card-note-label">Nota:</span>
            <span style={{ fontStyle: "italic", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
              "{student.notasEstudiante}"
            </span>
          </div>
        )}
      </div>

      <div className="lv4-card-actions">
        <ScheduleSelector
          horariosSolicitados={student.horarioSeleccionado || ""}
          horarioAsignado={student.horarioAsignado}
          isEditMode={isEditMode}
          onScheduleChange={(newSchedule) => onUpdateSchedule(student, newSchedule)}
          disabled={!showScheduleSelector}
          horariosDisponibles={horariosDisponibles}
        />

        <button
          className={`lv4-fab ${isCommitmentConfirmed ? "confirmed" : isSelected ? "selected" : ""}`}
          onClick={() => onToggleSelection(student)}
          disabled={isUpdating}
          title={
            isSelected
              ? isEditMode
                ? "Dar de Baja (con penalización)"
                : "Deseleccionar Alumno"
              : "Seleccionar Alumno"
          }
        >
          {isUpdating ? (
            <span className="lv4-spinner" />
          ) : (
            <span className="material-icons">{isSelected ? "check" : "add"}</span>
          )}
        </button>
      </div>
    </div>
  );
};

// Modal para mostrar prácticas del estudiante
interface PracticasModalProps {
  student: EnrichedStudent | null;
  isOpen: boolean;
  onClose: () => void;
}

const PracticasModal: React.FC<PracticasModalProps> = ({ student, isOpen, onClose }) => {
  const [practicas, setPracticas] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && student) {
      fetchPracticas();
    }
    // fetchPracticas solo depende de `student` (ya en deps); el intent es
    // refetchear al abrir el modal o cambiar de estudiante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, student]);

  const fetchPracticas = async () => {
    if (!student) return;
    setIsLoading(true);
    try {
      logger.info("Buscando prácticas para estudiante:", student.studentId);

      const { data, error } = await supabase
        .from("practicas")
        .select("*")
        .eq("estudiante_id", student.studentId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Error en consulta:", error);
        throw error;
      }

      logger.info("Prácticas encontradas:", data);
      setPracticas(data || []);
    } catch (err) {
      logger.error("Error fetching practicas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !student) return null;

  const totalHoras = calculateTotalHours(practicas);

  return (
    <div className="lv4-modal-overlay" onClick={onClose}>
      <div className="lv4-modal-shell wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lv4-modal-head">
          <span className="lv4-modal-head-glow-a" />
          <span className="lv4-modal-head-glow-b" />
          <div className="lv4-modal-head-row">
            <div className="lv4-modal-head-info">
              <div className="lv4-modal-head-icon">
                <span className="material-icons">school</span>
              </div>
              <div>
                <h3 className="lv4-modal-head-title">{student.nombre}</h3>
                <div className="lv4-modal-head-meta">
                  <span className="lv4-pill">Legajo: {student.legajo}</span>
                </div>
              </div>
            </div>
            <button className="lv4-modal-close" onClick={onClose} aria-label="Cerrar">
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="lv4-modal-body">
          {isLoading ? (
            <div className="lv4-modal-loader">
              <span className="lv4-spinner" />
            </div>
          ) : practicas.length === 0 ? (
            <div className="lv4-modal-empty">
              <span className="material-icons">work_off</span>
              <p>No hay prácticas registradas</p>
            </div>
          ) : (
            <>
              <div className="lv4-modal-stats">
                <div className="lv4-modal-stat accent">
                  <div className="lv4-modal-stat-icon">
                    <span className="material-icons">work</span>
                  </div>
                  <div>
                    <div className="lv4-modal-stat-val">{practicas.length}</div>
                    <div className="lv4-modal-stat-label">Prácticas</div>
                  </div>
                </div>

                <div className="lv4-modal-stat success">
                  <div className="lv4-modal-stat-icon">
                    <span className="material-icons">schedule</span>
                  </div>
                  <div>
                    <div className="lv4-modal-stat-val">{totalHoras}</div>
                    <div className="lv4-modal-stat-label">Horas Totales</div>
                  </div>
                </div>

                <div className="lv4-modal-stat warn">
                  <div className="lv4-modal-stat-icon">
                    <span className="material-icons">star</span>
                  </div>
                  <div>
                    <div className="lv4-modal-stat-val">{student.puntajeTotal}</div>
                    <div className="lv4-modal-stat-label">Puntaje</div>
                  </div>
                </div>
              </div>

              <div className="lv4-table-wrap">
                <table className="lv4-table">
                  <thead>
                    <tr>
                      <th>Institución</th>
                      <th className="center">Estado</th>
                      <th className="center">Horas</th>
                      <th className="center">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {practicas.map((practica) => {
                      const desaprobada = isPracticeDisapproved(practica.estado);
                      return (
                        <tr key={practica.id}>
                          <td>
                            <div className="lv4-table-name">
                              {practica.nombre_institucion || "N/A"}
                            </div>
                            <div className="lv4-table-sub">
                              {practica.fecha_inicio &&
                                new Date(practica.fecha_inicio).toLocaleDateString("es-AR")}
                            </div>
                          </td>
                          <td className="center">
                            <span
                              className={`lv4-badge ${
                                desaprobada
                                  ? "lv4-badge-danger-strong"
                                  : practica.estado === "Finalizada"
                                    ? "lv4-badge-ok"
                                    : practica.estado === "En curso"
                                      ? "lv4-badge-accent"
                                      : "lv4-badge-muted"
                              }`}
                            >
                              {desaprobada
                                ? "Desaprobada por la institución"
                                : practica.estado || "N/A"}
                            </span>
                          </td>
                          <td className="center">
                            <span style={{ fontWeight: 600 }}>
                              {desaprobada ? 0 : practica.horas_realizadas || 0}
                            </span>
                            {desaprobada && <div className="lv4-table-sub">no computan</div>}
                          </td>
                          <td className="center">
                            <span style={{ fontWeight: 600 }}>
                              {desaprobada ? "—" : practica.nota || "-"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="lv4-modal-foot">
          <button className="lv4-btn lv4-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

interface SeleccionadorProps {
  isTestingMode?: boolean;
  preSelectedLaunchId?: string | null;
  /**
   * Oculta a los estudiantes que ya confirmaron el compromiso (seleccionados +
   * compromiso aceptado). Útil en la sala de Confirmación: el coordinador solo
   * quiere ver a quiénes le faltan / a quiénes puede seleccionar para cubrir
   * las vacantes, no a los que ya están listos.
   */
  hideConfirmed?: boolean;
}

const SeleccionadorConvocatorias: React.FC<SeleccionadorProps> = ({
  isTestingMode = false,
  preSelectedLaunchId,
  hideConfirmed = false,
}) => {
  const {
    selectedLanzamiento,
    setSelectedLanzamiento,
    viewMode,
    setViewMode,
    toastInfo,
    setToastInfo,
    updatingId,
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
  } = useSeleccionadorLogic(isTestingMode, preSelectedLaunchId);

  const [studentToBaja, setStudentToBaja] = useState<EnrichedStudent | null>(null);
  const [showPenalizacionModal, setShowPenalizacionModal] = useState(false);
  const [penaltyType, setPenaltyType] = useState("Baja Anticipada");
  const [penaltyNotes, setPenaltyNotes] = useState("");

  const [showPracticasModal, setShowPracticasModal] = useState(false);
  const [selectedStudentForPracticas, setSelectedStudentForPracticas] =
    useState<EnrichedStudent | null>(null);

  // Lista efectivamente visible. En la sala de Confirmación (hideConfirmed)
  // ocultamos a los que ya firmaron el compromiso en la lista de la mesa (selection)
  // para que solo aparezcan como reemplazos los pendientes.
  // Pero en la lista de seleccionados (review) mostramos a todos los seleccionados
  // (tanto confirmados como pendientes) para poder auditarlos o dar de baja.
  const visibleCandidates = React.useMemo(() => {
    if (!hideConfirmed || viewMode === "review") return displayedCandidates;
    return displayedCandidates.filter(
      (s) =>
        !(
          normalizeStringForComparison(s.status) === "seleccionado" &&
          isCommitmentAccepted(s.compromisoEstado)
        )
    );
  }, [displayedCandidates, hideConfirmed, viewMode]);

  const commitmentStats = React.useMemo(() => {
    const confirmed = selectedCandidates.filter((student) =>
      isCommitmentAccepted(student.compromisoEstado)
    ).length;

    return {
      confirmed,
      pending: Math.max(selectedCandidates.length - confirmed, 0),
    };
  }, [selectedCandidates]);

  const handleToggleWithPenalty = (student: EnrichedStudent) => {
    const isCurrentlySelected = normalizeStringForComparison(student.status) === "seleccionado";

    // La penalización solo aplica al deseleccionar cuando la inscripción ya está
    // cerrada (modo edición). Mientras la inscripción siga abierta, el coordinador
    // puede deseleccionar libremente sin generar una penalización.
    if (isCurrentlySelected && isEditMode) {
      setStudentToBaja(student);
      setShowPenalizacionModal(true);
    } else {
      handleToggle(student);
    }
  };

  const handleConfirmBajaWithPenalty = async () => {
    if (!studentToBaja || !selectedLanzamiento) return;

    try {
      await handleToggle(studentToBaja);

      const penaltyData = {
        estudiante_id: studentToBaja.studentId,
        tipo_incumplimiento: penaltyType,
        fecha_incidente: new Date().toISOString().split("T")[0],
        notas: penaltyNotes,
        puntaje_penalizacion: getPenaltyScore(penaltyType),
        convocatoria_afectada: selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS],
        convocatoria_id: studentToBaja.enrollmentId,
        lanzamiento_id: selectedLanzamiento.id,
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

  if (isLoadingLaunches) return <Loader />;

  if (!selectedLanzamiento) {
    return (
      <div className="lv4-anim-fade-up">
        {toastInfo && (
          <Toast
            message={toastInfo.message}
            type={toastInfo.type}
            onClose={() => setToastInfo(null)}
          />
        )}
        <div className="lv4-eyebrow">Mesa de selección</div>
        <h3 className="lv4-section-title">Seleccionar Convocatoria Abierta</h3>
        <p style={{ color: "var(--ink-3)", marginBottom: 24, fontSize: 13 }}>
          Elige una convocatoria para gestionar sus postulantes.
        </p>

        {openLaunches.length === 0 ? (
          <EmptyState
            icon="event_busy"
            title="Sin Convocatorias Abiertas"
            message="No hay lanzamientos activos en este momento."
          />
        ) : (
          <div className="lv4-launch-grid">
            {openLaunches.map((lanz) => {
              const visuals = getEspecialidadClasses(lanz[FIELD_ORIENTACION_LANZAMIENTOS]);
              return (
                <button
                  key={lanz.id}
                  className="lv4-launch-card"
                  onClick={() => setSelectedLanzamiento(lanz)}
                >
                  <div className="lv4-launch-card-top">
                    <span className="lv4-orient-chip" style={{ maxWidth: "60%" }}>
                      {lanz[FIELD_ORIENTACION_LANZAMIENTOS]}
                    </span>
                    <span className="lv4-launch-card-cupos">
                      {lanz[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} Cupos
                    </span>
                  </div>
                  <h4 className="lv4-launch-card-title">{lanz[FIELD_NOMBRE_PPS_LANZAMIENTOS]}</h4>
                  <div className="lv4-launch-card-date">
                    <span className="material-icons">calendar_today</span>
                    Inicio: <strong>{formatDate(lanz[FIELD_FECHA_INICIO_LANZAMIENTOS])}</strong>
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
    <div className="lv4-anim-fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      <div>
        <div className="lv4-page-head">
          <button className="lv4-back-btn" onClick={() => setSelectedLanzamiento(null)}>
            <span className="material-icons">arrow_back</span>
          </button>
          <div>
            <h3>{selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]}</h3>
            <div className="lv4-meta">
              Cupos: {selectedLanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} | Postulantes:{" "}
              {candidates.length} | Seleccionados: {selectedCandidates.length}
            </div>
          </div>
        </div>

        {selectedCandidates.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <span className="lv4-stat-pill ok">
              <span className="material-icons">verified</span>
              {commitmentStats.confirmed} confirmados
            </span>
            <span className="lv4-stat-pill pending">
              <span className="material-icons">pending_actions</span>
              {commitmentStats.pending} pendientes
            </span>
            <span
              className={`lv4-stat-pill ${commitmentStats.pending === 0 ? "complete" : "idle"}`}
            >
              <span className="material-icons">
                {commitmentStats.pending === 0 ? "task_alt" : "hourglass_top"}
              </span>
              {commitmentStats.pending === 0
                ? "Todos los compromisos aceptados"
                : "Faltan aceptar compromisos"}
            </span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div className="lv4-tabs">
            <button
              className={`lv4-tab ${viewMode === "selection" ? "active" : ""}`}
              onClick={() => setViewMode("selection")}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                how_to_reg
              </span>
              Mesa
              <span className="lv4-tab-count">{candidates.length}</span>
            </button>
            <button
              className={`lv4-tab ${viewMode === "review" ? "active" : ""}`}
              onClick={() => setViewMode("review")}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                task_alt
              </span>
              Seleccionados
              <span className="lv4-tab-count">{selectedCandidates.length}</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <span className="lv4-tip-trigger">
              <span className="material-icons">help</span>
              <div className="lv4-tooltip">
                <div className="lv4-tooltip-title">Fórmula de Puntaje</div>
                <ul>
                  <li>
                    <span>Terminó de cursar</span>
                    <strong>+100 pts</strong>
                  </li>
                  <li>
                    <span>Cursando electivas</span>
                    <strong>+50 pts</strong>
                  </li>
                  <li>
                    <span>Trabaja (c/cert)</span>
                    <strong>+20 pts</strong>
                  </li>
                  <li>
                    <span>Adeuda finales</span>
                    <strong>+30 pts</strong>
                  </li>
                  <li>
                    <span>Horas acumuladas</span>
                    <strong>+0.5 pts/h</strong>
                  </li>
                  <li>
                    <span>Penalizaciones</span>
                    <strong>- Puntos</strong>
                  </li>
                </ul>
                <span className="lv4-tooltip-arrow" />
              </div>
            </span>
          </div>
        </div>
      </div>

      {isLoadingCandidates ? (
        <Loader />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleCandidates.map((student) => (
            <StudentRow
              key={student.enrollmentId}
              student={student}
              onToggleSelection={handleToggleWithPenalty}
              onUpdateSchedule={handleUpdateSchedule}
              isUpdating={updatingId === student.enrollmentId}
              isReviewMode={viewMode === "review"}
              isEditMode={isEditMode}
              showScheduleSelector={scheduleInfo?.showScheduleSelector ?? true}
              horariosDisponibles={scheduleInfo?.horariosDisponibles ?? []}
              onShowPracticas={(student) => {
                setSelectedStudentForPracticas(student);
                setShowPracticasModal(true);
              }}
            />
          ))}
          {visibleCandidates.length === 0 && (
            <div className="lv4-empty">
              <span className="material-icons">group_off</span>
              <p>
                {viewMode === "review"
                  ? "No hay estudiantes seleccionados en esta convocatoria."
                  : hideConfirmed
                    ? "No hay estudiantes pendientes ni inscriptos disponibles para cubrir vacantes."
                    : "No hay estudiantes inscriptos en esta convocatoria."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Penalización */}
      {showPenalizacionModal && studentToBaja && (
        <div className="lv4-modal-overlay">
          <div className="lv4-modal-shell">
            <div className="lv4-modal-head">
              <span className="lv4-modal-head-glow-a" />
              <span className="lv4-modal-head-glow-b" />
              <div className="lv4-modal-head-row">
                <div className="lv4-modal-head-info">
                  <div className="lv4-modal-head-icon">
                    <span className="material-icons">remove_circle</span>
                  </div>
                  <div>
                    <h3 className="lv4-modal-head-title">Dar de Baja · {studentToBaja.nombre}</h3>
                    <div className="lv4-modal-head-meta">
                      <span className="lv4-pill">Aplicar penalización</span>
                    </div>
                  </div>
                </div>
                <button
                  className="lv4-modal-close"
                  onClick={() => {
                    setShowPenalizacionModal(false);
                    setStudentToBaja(null);
                    setPenaltyNotes("");
                  }}
                  aria-label="Cerrar"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
            </div>

            <div className="lv4-modal-body">
              <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16 }}>
                Selecciona el tipo de baja y agrega notas si es necesario.
              </p>

              <div className="lv4-form-row">
                <label className="lv4-form-label">Tipo de Baja</label>
                <select
                  className="lv4-select"
                  value={penaltyType}
                  onChange={(e) => setPenaltyType(e.target.value)}
                >
                  <option value="Baja Anticipada">Baja Anticipada (30 pts)</option>
                  <option value="Baja sobre la Fecha / Ausencia en Inicio">
                    Baja sobre la Fecha (50 pts)
                  </option>
                  <option value="Abandono durante la PPS">Abandono (70 pts)</option>
                  <option value="Falta sin Aviso">Falta sin Aviso (40 pts)</option>
                </select>
              </div>

              <div className="lv4-form-row">
                <label className="lv4-form-label">Notas</label>
                <textarea
                  className="lv4-textarea"
                  value={penaltyNotes}
                  onChange={(e) => setPenaltyNotes(e.target.value)}
                  placeholder="Describe el motivo de la baja..."
                  rows={3}
                />
              </div>
            </div>

            <div className="lv4-modal-foot">
              <button
                className="lv4-btn lv4-btn-ghost"
                onClick={() => {
                  setShowPenalizacionModal(false);
                  setStudentToBaja(null);
                  setPenaltyNotes("");
                }}
              >
                Cancelar
              </button>
              <button className="lv4-btn lv4-btn-danger" onClick={handleConfirmBajaWithPenalty}>
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Prácticas del Estudiante */}
      <PracticasModal
        student={selectedStudentForPracticas}
        isOpen={showPracticasModal}
        onClose={() => {
          setShowPracticasModal(false);
          setSelectedStudentForPracticas(null);
        }}
      />
    </div>
  );
};

export default SeleccionadorConvocatorias;
