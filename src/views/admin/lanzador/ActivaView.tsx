/**
 * lanzador/ActivaView.tsx — Vista del estado "activa" (DB 'Activa').
 * PPS en curso: Roster de estudiantes en curso (bajas y reemplazos) y estadísticas.
 */
import React, { useState, useMemo } from "react";
import {
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
} from "../../../constants";
import {
  normalizeStringForComparison,
  formatDate,
  getWhatsAppUrl,
} from "../../../utils/formatters";
import type { LanzamientoPPS, EnrichedStudent } from "../../../types";
import { CanvasHeader, Stat, StatGrid, Banner, useLaunchEditor, Loader } from "./shared";
import { useLaunchPracticas } from "./useLaunchData";
import { useSeleccionadorLogic } from "../../../hooks/useSeleccionadorLogic";
import Toast from "../../../components/ui/Toast";
import { supabase } from "../../../lib/supabaseClient";

const ActivaView: React.FC<{ launch: LanzamientoPPS; onArchivar: () => void }> = ({
  launch,
  onArchivar,
}) => {
  const { openEdit, modal: editModal } = useLaunchEditor(launch);
  const fechaInicio = launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
  const fechaFin = launch[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;

  // 1. Estadísticas de prácticas reales
  const { data: practicas = [] } = useLaunchPracticas(launch.id);

  const totalHoras = practicas.reduce((sum, p) => sum + ((p.horas_realizadas as number) || 0), 0);
  const activas = practicas.filter(
    (p) =>
      normalizeStringForComparison(p.estado) === "activa" ||
      normalizeStringForComparison(p.estado) === "en curso"
  ).length;
  const finalizadas = practicas.filter(
    (p) => normalizeStringForComparison(p.estado) === "finalizada"
  ).length;

  // 2. Hook de lógica compartida para la mesa de selección / reemplazos
  const {
    candidates,
    selectedCandidates,
    availableStudents,
    enrollNewStudent,
    handleToggle,
    isLoadingCandidates,
    toastInfo,
    setToastInfo,
  } = useSeleccionadorLogic(false, launch.id);

  // 3. Estados locales para el modal de baja y búsqueda de reemplazos
  const [studentToBaja, setStudentToBaja] = useState<EnrichedStudent | null>(null);
  const [penaltyType, setPenaltyType] = useState("Ausencia en Inicio / No se presentó");
  const [penaltyNotes, setPenaltyNotes] = useState("");
  const [isSubmittingBaja, setIsSubmittingBaja] = useState(false);
  const [showReplacementSearch, setShowReplacementSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 4. Filtrar candidatos no seleccionados (lista de inscriptos restantes)
  const unselectedCandidates = useMemo(() => {
    return candidates.filter((c) => normalizeStringForComparison(c.status) === "inscripto");
  }, [candidates]);

  // 5. Filtrar estudiantes activos en el sistema para búsqueda manual
  const filteredAvailable = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return availableStudents
      .filter(
        (s) =>
          s.nombre?.toLowerCase().includes(query) ||
          String(s.legajo || "")
            .toLowerCase()
            .includes(query)
      )
      .slice(0, 5);
  }, [availableStudents, searchQuery]);

  // 6. Valores de penalización por motivo
  const getPenaltyScore = (type: string) => {
    const scores: Record<string, number> = {
      "Ausencia en Inicio / No se presentó": 50,
      "Baja Anticipada": 30,
      "Abandono durante la PPS": 70,
      "Falta sin Aviso": 40,
      "Baja Administrativa / Sin Penalización": 0,
    };
    return scores[type] || 0;
  };

  // 7. Acción de dar de baja con justificación y registro de penalización automático
  const handleConfirmBaja = async () => {
    if (!studentToBaja) return;
    setIsSubmittingBaja(true);
    try {
      // Deseleccionar al estudiante (lo que borra la práctica activa)
      await handleToggle(studentToBaja);

      const penaltyScore = getPenaltyScore(penaltyType);
      const penaltyData = {
        estudiante_id: studentToBaja.studentId,
        tipo_incumplimiento: penaltyType,
        fecha_incidente: new Date().toISOString().split("T")[0],
        notas: penaltyNotes.trim() || null,
        puntaje_penalizacion: penaltyScore,
        convocatoria_afectada: launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "PPS",
      };

      const { error } = await supabase.from("penalizaciones").insert([penaltyData]);
      if (error) throw error;

      setToastInfo({
        message: "Estudiante dado de baja y penalización registrada.",
        type: "success",
      });
      setStudentToBaja(null);
      setPenaltyNotes("");
    } catch (e) {
      console.error("Error al procesar la baja:", e);
      setToastInfo({ message: "Error al registrar la baja del estudiante.", type: "error" });
    } finally {
      setIsSubmittingBaja(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div>
      <CanvasHeader
        launch={launch}
        uiState="activa"
        primaryAction={{ label: "Archivar convocatoria", icon: "archive", onClick: onArchivar }}
        secondaryActions={[{ label: "Editar datos", icon: "edit", onClick: openEdit }]}
      />
      {editModal}

      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      <div className="lv4-canvas-body">
        {/* Stats */}
        <StatGrid style={{ marginBottom: 28 }}>
          <Stat label="Prácticas activas" value={activas} hint="en curso" tone="ok" />
          <Stat label="Finalizadas" value={finalizadas} hint="completadas" />
          <Stat label="Horas totales" value={totalHoras} hint="realizadas" />
          <Stat
            label="Período"
            value={fechaInicio ? formatDate(fechaInicio) : "—"}
            hint={fechaFin ? `hasta ${formatDate(fechaFin)}` : "sin fecha fin"}
            size="sm"
          />
        </StatGrid>

        {isLoadingCandidates ? (
          <Loader />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Columna Principal - Estudiantes seleccionados */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="lv4-eyebrow">Alumnos en curso</span>
                <span className="lv4-badge-ok-strong" style={{ fontSize: 11, borderRadius: 99 }}>
                  {selectedCandidates.length} seleccionados
                </span>
              </div>

              {selectedCandidates.length === 0 ? (
                <Banner
                  tone="neutral"
                  icon="group"
                  title="No hay estudiantes en curso"
                  style={{ marginBottom: 0 }}
                >
                  Todos los estudiantes seleccionados han sido dados de baja o no hay selecciones en
                  esta convocatoria.
                </Banner>
              ) : (
                <div
                  style={{
                    border: "1px solid var(--rule-2)",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--paper)",
                  }}
                >
                  {selectedCandidates.map((student, idx) => {
                    const waMsg = `Hola ${student.nombre}, te contactamos de la coordinación de PPS de UFLO con respecto a tu práctica en ${launch[FIELD_NOMBRE_PPS_LANZAMIENTOS]}.`;
                    const waUrl = getWhatsAppUrl(student.telefono, waMsg);
                    return (
                      <div
                        key={student.enrollmentId}
                        className="lv4-insc-row"
                        style={{
                          gap: 12,
                          padding: "12px 16px",
                          borderBottom:
                            idx === selectedCandidates.length - 1
                              ? "none"
                              : "1px solid var(--rule-2)",
                        }}
                      >
                        <div
                          className="lv4-avatar"
                          style={{
                            background: "var(--paper-3)",
                            color: "var(--ink)",
                            borderColor: "transparent",
                          }}
                        >
                          {getInitials(student.nombre)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                            {student.nombre}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 10,
                              marginTop: 2,
                              fontSize: 11.5,
                              color: "var(--ink-3)",
                            }}
                          >
                            <span>Legajo: {student.legajo}</span>
                            {student.horarioAsignado && (
                              <span
                                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <span className="material-icons" style={{ fontSize: 12 }}>
                                  schedule
                                </span>
                                {student.horarioAsignado}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Acciones del Estudiante */}
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {waUrl ? (
                            <a
                              className="lv4-icon-btn"
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Contactar por WhatsApp"
                              style={{ color: "#25D366" }}
                            >
                              <span className="material-icons" style={{ fontSize: 18 }}>
                                chat
                              </span>
                            </a>
                          ) : (
                            <span
                              className="lv4-icon-btn"
                              title="Sin teléfono"
                              style={{ color: "var(--ink-4)", cursor: "not-allowed", opacity: 0.5 }}
                            >
                              <span className="material-icons" style={{ fontSize: 18 }}>
                                chat
                              </span>
                            </span>
                          )}
                          {student.correo ? (
                            <a
                              className="lv4-icon-btn"
                              href={`mailto:${student.correo}`}
                              title="Enviar Email"
                              style={{ color: "var(--ink-3)" }}
                            >
                              <span className="material-icons" style={{ fontSize: 18 }}>
                                mail
                              </span>
                            </a>
                          ) : (
                            <span
                              className="lv4-icon-btn"
                              title="Sin correo"
                              style={{ color: "var(--ink-4)", cursor: "not-allowed", opacity: 0.5 }}
                            >
                              <span className="material-icons" style={{ fontSize: 18 }}>
                                mail
                              </span>
                            </span>
                          )}
                          <button
                            className="lv4-btn"
                            style={{
                              background: "var(--danger-s, #fde8e8)",
                              color: "var(--warn)",
                              borderColor: "transparent",
                              padding: "4px 8px",
                              fontSize: 12,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            onClick={() => {
                              setStudentToBaja(student);
                              setPenaltyType("Ausencia en Inicio / No se presentó");
                              setPenaltyNotes("");
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: 14 }}>
                              person_remove
                            </span>
                            Dar de baja
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Columna Derecha - Mesa de reemplazos y candidatos */}
            <div className="lg:col-span-5 space-y-4">
              <span className="lv4-eyebrow">Candidatos a reemplazo</span>

              {unselectedCandidates.length === 0 ? (
                <Banner
                  tone="neutral"
                  icon="info"
                  title="Sin candidatos en espera"
                  style={{ marginBottom: 0 }}
                >
                  No quedan inscriptos en lista de espera. Podés inscribir y seleccionar un
                  estudiante de reemplazo usando el buscador.
                </Banner>
              ) : (
                <div
                  style={{
                    border: "1px solid var(--rule-2)",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--paper)",
                  }}
                >
                  {unselectedCandidates.map((candidate, idx) => (
                    <div
                      key={candidate.enrollmentId}
                      className="lv4-insc-row"
                      style={{
                        gap: 10,
                        padding: "12px 14px",
                        borderBottom:
                          idx === unselectedCandidates.length - 1
                            ? "none"
                            : "1px solid var(--rule-2)",
                      }}
                    >
                      <div
                        className="lv4-avatar"
                        style={{
                          background: "var(--paper-2)",
                          color: "var(--ink-3)",
                          borderColor: "transparent",
                        }}
                      >
                        {getInitials(candidate.nombre)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--ink)",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span className="truncate">{candidate.nombre}</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "'JetBrains Mono', monospace",
                              padding: "2px 5px",
                              borderRadius: 4,
                              background: "var(--paper-3)",
                              color: "var(--accent)",
                              flexShrink: 0,
                            }}
                          >
                            {candidate.puntajeTotal} pts
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            marginTop: 2,
                            fontSize: 11,
                            color: "var(--ink-3)",
                          }}
                        >
                          <span>Legajo: {candidate.legajo}</span>
                          {candidate.horarioSeleccionado && (
                            <span className="truncate">Pref: {candidate.horarioSeleccionado}</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="lv4-btn"
                        style={{ padding: "4px 8px", fontSize: 12, flexShrink: 0 }}
                        onClick={() => handleToggle(candidate)}
                      >
                        Seleccionar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Buscador de otros estudiantes no inscriptos */}
              <div style={{ marginTop: 14 }}>
                <button
                  className="lv4-group-head"
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onClick={() => setShowReplacementSearch((prev) => !prev)}
                >
                  <span
                    className="lv4-group-label"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      className="material-icons"
                      style={{
                        fontSize: 18,
                        transition: "transform .15s",
                        transform: showReplacementSearch ? "rotate(0)" : "rotate(-90deg)",
                        color: "var(--ink-3)",
                      }}
                    >
                      expand_more
                    </span>
                    Buscar otro estudiante activo
                  </span>
                  <span className="lv4-group-count">no postulados</span>
                </button>

                {showReplacementSearch && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 14,
                      border: "1px solid var(--rule-2)",
                      borderRadius: 12,
                      background: "var(--paper-2)",
                    }}
                  >
                    <div className="lv4-search-wrap" style={{ marginBottom: 10 }}>
                      <span
                        className="material-icons lv4-search-icon"
                        style={{
                          position: "absolute",
                          left: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--ink-4)",
                          fontSize: 16,
                        }}
                      >
                        search
                      </span>
                      <input
                        type="text"
                        className="lv4-search"
                        style={{ width: "100%", paddingLeft: 34, fontSize: 12.5 }}
                        placeholder="Buscar por nombre o legajo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    {filteredAvailable.length > 0 ? (
                      <div
                        style={{
                          border: "1px solid var(--rule-2)",
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "var(--paper)",
                        }}
                      >
                        {filteredAvailable.map((student, idx) => (
                          <div
                            key={student.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              borderBottom:
                                idx === filteredAvailable.length - 1
                                  ? "none"
                                  : "1px solid var(--rule-2)",
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: "var(--ink)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {student.nombre}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
                                Legajo: {student.legajo}
                              </div>
                            </div>
                            <button
                              className="lv4-btn"
                              style={{ padding: "4px 8px", fontSize: 11.5, flexShrink: 0 }}
                              onClick={() => {
                                enrollNewStudent(student.id);
                                setSearchQuery("");
                                setShowReplacementSearch(false);
                              }}
                            >
                              Seleccionar
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : searchQuery.trim() ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: 10,
                          color: "var(--ink-4)",
                          fontSize: 12,
                        }}
                      >
                        No se encontraron estudiantes activos.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Baja y Penalización */}
      {studentToBaja && (
        <div className="lv4-modal-overlay">
          <div className="lv4-modal-shell" style={{ maxWidth: "32rem" }}>
            <div className="lv4-modal-head">
              <div className="lv4-modal-head-glow-a" />
              <div className="lv4-modal-head-glow-b" />
              <div className="lv4-modal-head-row">
                <div className="lv4-modal-head-info">
                  <div
                    className="lv4-modal-head-icon"
                    style={{ background: "var(--warn-s)", color: "var(--warn)" }}
                  >
                    <span className="material-icons">gavel</span>
                  </div>
                  <div>
                    <h4 className="lv4-modal-head-title">Dar de baja estudiante</h4>
                    <span className="lv4-modal-head-meta" style={{ color: "var(--ink-4)" }}>
                      PPS: {launch[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                    </span>
                  </div>
                </div>
                <button className="lv4-modal-close" onClick={() => setStudentToBaja(null)}>
                  <span className="material-icons">close</span>
                </button>
              </div>
            </div>
            <div className="lv4-modal-body">
              <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 18, lineHeight: 1.5 }}>
                Se removerá a <b>{studentToBaja.nombre}</b> (Legajo: {studentToBaja.legajo}) de esta
                práctica activa.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label
                  className="lv4-label"
                  style={{ display: "block", marginBottom: 6, fontWeight: 600 }}
                >
                  Motivo de la baja
                </label>
                <select
                  className="lv4-select"
                  style={{ width: "100%" }}
                  value={penaltyType}
                  onChange={(e) => setPenaltyType(e.target.value)}
                >
                  <option value="Ausencia en Inicio / No se presentó">
                    Ausencia en Inicio / No se presentó (50 pts)
                  </option>
                  <option value="Baja Anticipada">Baja Anticipada (30 pts)</option>
                  <option value="Abandono durante la PPS">Abandono durante la PPS (70 pts)</option>
                  <option value="Falta sin Aviso">Falta sin Aviso (40 pts)</option>
                  <option value="Baja Administrativa / Sin Penalización">
                    Baja Administrativa / Sin Penalización (0 pts)
                  </option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  className="lv4-label"
                  style={{ display: "block", marginBottom: 6, fontWeight: 600 }}
                >
                  Comentarios / Notas del incidente
                </label>
                <textarea
                  className="lv4-textarea"
                  style={{ width: "100%" }}
                  placeholder="Ingresá detalles de la baja si corresponde..."
                  value={penaltyNotes}
                  onChange={(e) => setPenaltyNotes(e.target.value)}
                />
              </div>

              {getPenaltyScore(penaltyType) > 0 && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "var(--warn-s)",
                    border: "1px solid var(--warn)",
                    color: "var(--ink-2)",
                    fontSize: 12.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span className="material-icons" style={{ color: "var(--warn)", fontSize: 18 }}>
                    warning
                  </span>
                  <span>
                    Esta baja restará <b>{getPenaltyScore(penaltyType)} puntos</b> de la prioridad
                    general del estudiante.
                  </span>
                </div>
              )}
            </div>
            <div
              className="lv4-modal-foot"
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              <button
                className="lv4-btn lv4-btn-ghost"
                onClick={() => setStudentToBaja(null)}
                disabled={isSubmittingBaja}
              >
                Cancelar
              </button>
              <button
                className="lv4-btn lv4-btn-danger"
                onClick={handleConfirmBaja}
                disabled={isSubmittingBaja}
              >
                {isSubmittingBaja ? "Procesando..." : "Confirmar baja"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivaView;
