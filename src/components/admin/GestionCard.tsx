import React, { useMemo, useState } from "react";
import {
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
} from "../../constants";
import { useAuth } from "../../contexts/AuthContext";
import ReminderService from "../../services/reminderService";
import TodoistService from "../../services/todoistDirectService";
import type { LanzamientoPPS } from "../../types";
import { getEspecialidadClasses, parseToUTCDate } from "../../utils/formatters";
import ContactModal from "./ContactModal";

// Opciones Simplificadas
const GESTION_STATUS_OPTIONS = [
  "Pendiente de Gestión",
  "Esperando Respuesta",
  "En Conversación",
  "Relanzamiento Confirmado",
  "No se Relanza",
  "Archivado",
];

interface GestionCardProps {
  pps: LanzamientoPPS;
  onSave: (id: string, updates: Partial<LanzamientoPPS>) => Promise<boolean>;
  isUpdating: boolean;
  cardType: string;
  institution?: { id: string; phone?: string };
  onSavePhone: (institutionId: string, phone: string) => Promise<boolean>;
  daysLeft?: number;
  urgency?: "high" | "normal";
  daysWaiting?: number;
  daysSinceResponse?: number;
}

const GestionCard: React.FC<GestionCardProps> = React.memo(
  ({
    pps,
    onSave,
    isUpdating,
    cardType,
    institution,
    onSavePhone,
    daysLeft,
    urgency,
    daysWaiting,
  }) => {
    const { authenticatedUser } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);
    const [status, setStatus] = useState(
      pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] || "Pendiente de Gestión"
    );
    const [notes, setNotes] = useState(pps[FIELD_NOTAS_GESTION_LANZAMIENTOS] || "");
    const [history, setHistory] = useState(pps.historial_gestion || "");
    const [newLogEntry, setNewLogEntry] = useState("");
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [todoistSuccess, setTodoistSuccess] = useState(false);
    const [reminderSuccess, setReminderSuccess] = useState(false);

    // Initialize date
    const [relaunchDate, setRelaunchDate] = useState(() => {
      const rDate = pps[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS];
      if (rDate) return rDate;
      const sDate = pps[FIELD_FECHA_INICIO_LANZAMIENTOS];
      if (sDate) {
        const d = parseToUTCDate(sDate);
        if (d && d.getUTCFullYear() >= 2026) return sDate;
      }
      return "";
    });

    const [isJustSaved, setIsJustSaved] = useState(false);
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [newPhone, setNewPhone] = useState("");

    const especialidadVisuals = getEspecialidadClasses(pps[FIELD_ORIENTACION_LANZAMIENTOS]);

    // Detectar si la gestión está estancada basándose PRIMERO en el historial manual
    const lastUpdateDate = useMemo(() => {
      if (history) {
        const lines = history.split("\n");
        const lastEntry = lines[0]; // La más reciente
        const dateMatch = lastEntry.match(/^(\d{2})\/(\d{2}):/);
        if (dateMatch) {
          const [_, d, m] = dateMatch;
          const date = new Date();
          // Intentar reconstruir la fecha del historial (asumiendo año actual)
          date.setMonth(parseInt(m, 10) - 1);
          date.setDate(parseInt(d, 10));
          // Si la fecha resultante es futura, probablemente era del año pasado (raro hoy pero por las dudas)
          if (date > new Date()) date.setFullYear(date.getFullYear() - 1);
          return date;
        }
      }
      return pps.updated_at ? new Date(pps.updated_at) : new Date(pps.created_at || Date.now());
    }, [history, pps.updated_at, pps.created_at]);

    const daysSinceLastTouch = Math.floor(
      (Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isActiveManagement = status === "Esperando Respuesta" || status === "En Conversación";
    const isStagnantAlert = isActiveManagement && daysSinceLastTouch >= 2;

    // Detectar cambios
    const hasChanges = useMemo(() => {
      const originalStatus = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] || "Pendiente de Gestión";
      const originalNotes = pps[FIELD_NOTAS_GESTION_LANZAMIENTOS] || "";
      const originalDate = pps[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS] || "";

      const dateChanged =
        status === "Relanzamiento Confirmado" ? relaunchDate !== originalDate : false;

      return (
        status !== originalStatus ||
        notes !== originalNotes ||
        dateChanged ||
        newLogEntry.trim() !== ""
      );
    }, [status, notes, relaunchDate, pps, newLogEntry]);

    // Handle Save con integración a Todoist
    const handleSave = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasChanges) return;

      const originalStatus = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] || "Pendiente de Gestión";
      let logText = newLogEntry.trim();

      // Si cambió el estado y no hay nota, generamos una automática
      if (status !== originalStatus && !logText) {
        logText = `Cambio de estado: ${status}`;
      }

      let updatedHistory = history;
      if (logText) {
        const timestamp = new Date().toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
        });
        const entry = `${timestamp}: ${logText}`;
        updatedHistory = history ? `${entry}\n${history}` : entry;
      }

      const updates: any = {
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: status,
        [FIELD_NOTAS_GESTION_LANZAMIENTOS]: notes,
        historial_gestion: updatedHistory,
      };

      if (status === "Relanzamiento Confirmado") {
        updates[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS] = relaunchDate;

        // Crear recordatorios internos
        if (authenticatedUser?.id) {
          ReminderService.setUserId(authenticatedUser.id);
          try {
            await ReminderService.createLanzamientoReminders(
              pps.id,
              pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "",
              relaunchDate,
              institution?.phone
            );
            setReminderSuccess(true);
            setTimeout(() => setReminderSuccess(false), 3000);
          } catch (error) {
            console.error("Error creando recordatorios:", error);
          }
        }
      }

      setIsJustSaved(true);
      const success = await onSave(pps.id, updates);
      if (success) {
        setHistory(updatedHistory);
        setNewLogEntry("");
        setTimeout(() => setIsJustSaved(false), 2000);
        setIsExpanded(false);
      } else {
        setIsJustSaved(false);
      }
    };

    const handleManualTodoist = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await TodoistService.createLanzamientoTask(
          pps[FIELD_NOMBRE_PPS_LANZAMIENTOS],
          relaunchDate || "Pendiente",
          notes,
          2,
          institution?.phone
        );
        setTodoistSuccess(true);
        setTimeout(() => setTodoistSuccess(false), 3000);
      } catch (error) {
        console.error("Error Todoist:", error);
      }
    };

    const handleWhatsAppClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!institution?.phone) return;
      const phoneStr = institution.phone || "";
      const cleanPhone = phoneStr.replace(/[^0-9]/g, "");

      // Open WhatsApp
      window.open(`https://wa.me/${cleanPhone}`, "_blank", "noopener,noreferrer");

      // AUTOMATION: If it was PENDING, move to WAITING RESPONSE
      if (status === "Pendiente de Gestión") {
        setStatus("Esperando Respuesta");
        await onSave(pps.id, {
          [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Esperando Respuesta",
        });
      }
    };

    const handleSavePhone = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!institution || !newPhone.trim()) return;
      const success = await onSavePhone(institution.id, newPhone.trim());
      if (success) {
        setIsEditingPhone(false);
        setNewPhone("");
      }
    };

    // Handle Quick Contact
    const handleQuickContact = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsContactModalOpen(true);
    };

    // Handle Contact Modal Submit
    const handleContactModalSubmit = async () => {
      setStatus("Esperando Respuesta");
      setIsContactModalOpen(false);

      // AUTOMATION: Save status immediately
      await onSave(pps.id, {
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Esperando Respuesta",
      });
    };

    // Status Color Logic
    const statusColor = useMemo(() => {
      if (status === "Relanzamiento Confirmado")
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
      if (status === "Relanzada")
        return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800";
      if (status === "No se Relanza")
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800";
      if (status === "Esperando Respuesta") {
        return isStagnantAlert
          ? "bg-rose-100 text-rose-900 border-rose-400 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-600 animate-pulse ring-2 ring-rose-500/20"
          : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
      }
      if (status === "En Conversación") {
        return isStagnantAlert
          ? "bg-rose-100 text-rose-900 border-rose-400 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-600 animate-pulse ring-2 ring-rose-500/20"
          : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      }
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    }, [status, isStagnantAlert]);

    // Urgency Badge
    const UrgencyBadge = () => {
      if (daysLeft === undefined) return null;

      // Prioridad: Si hay gestión activa, no mostramos el badge de "Ciclo anterior"
      // para no tapar la información de movimiento
      if (status === "Esperando Respuesta" || status === "En Conversación") return null;

      // Si está por vencer (PPS actual 2026 o tramo final de algo vivo)
      if (daysLeft > 0 && daysLeft <= 7) {
        return (
          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 flex items-center gap-1 animate-pulse">
            <span className="material-icons !text-[10px]">timer</span> Finaliza en {daysLeft} días
          </span>
        );
      }

      // Si ya venció (Es lo normal para todo lo de 2025)
      if (daysLeft <= 0) {
        return (
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/20 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 flex items-center gap-1">
            <span className="material-icons !text-[10px]">history</span> Ciclo anterior finalizado
          </span>
        );
      }

      return null;
    };

    // Days Waiting Badge
    const DaysWaitingBadge = () => {
      // Solo mostramos esto en estados de gestión activa
      if (status !== "Esperando Respuesta" && status !== "En Conversación") return null;

      const dWaiting = daysWaiting || 0;

      const urgencyClass =
        dWaiting > 7
          ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800"
          : dWaiting > 3
            ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
            : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";

      return (
        <span
          className={`text-[10px] font-bold ${urgencyClass} px-2 py-0.5 rounded border flex items-center gap-1 ${dWaiting > 2 ? "animate-pulse" : ""}`}
        >
          <span className="material-icons !text-[10px]">update</span>
          Sin movimiento: {dWaiting === 0 ? "Hoy" : `${dWaiting} d`}
        </span>
      );
    };

    const isEffectivelyConfirmed =
      status === "Relanzamiento Confirmado" ||
      status === "Relanzada" ||
      (relaunchDate && new Date(relaunchDate).getFullYear() >= 2026);

    const cardBorderClass = isJustSaved
      ? "shadow-lg ring-2 ring-emerald-400 border-l-4 border-emerald-500"
      : isStagnantAlert
        ? "shadow-xl ring-2 ring-rose-500 border-l-4 border-rose-600 animate-pulse"
        : hasChanges
          ? `shadow-md hover:shadow-lg border-l-4 ${especialidadVisuals.leftBorder}`
          : `shadow-sm hover:shadow-md border-l-4 ${especialidadVisuals.leftBorder} border-t border-r border-b border-slate-200 dark:border-slate-700`;

    const displayRelaunchDate = () => {
      if (!relaunchDate) return null;
      const d = parseToUTCDate(relaunchDate);
      if (!d) return relaunchDate;
      return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
      <>
        {isContactModalOpen && (
          <ContactModal
            isOpen={isContactModalOpen}
            onClose={() => setIsContactModalOpen(false)}
            pps={pps}
            institution={institution as any}
            onMarkContacted={handleContactModalSubmit}
          />
        )}

        <div
          className={`relative bg-white dark:bg-gray-900 rounded-xl transition-all duration-300 overflow-hidden ${cardBorderClass}`}
          onClick={() => !isEditingPhone && setIsExpanded(!isExpanded)}
        >
          {/* Header Content */}
          <div className="p-3 sm:p-4 pl-3 sm:pl-5 cursor-pointer">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span
                    className={`${especialidadVisuals.tag} text-[9px] sm:text-[10px] py-0.5 px-1.5 sm:px-2 font-bold`}
                  >
                    {pps[FIELD_ORIENTACION_LANZAMIENTOS]}
                  </span>
                  {isEffectivelyConfirmed && relaunchDate && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">
                      <span className="material-icons !text-[9px] sm:!text-[10px]">event</span>
                      {displayRelaunchDate()}
                    </span>
                  )}
                  <UrgencyBadge />
                  <DaysWaitingBadge />
                  {daysSinceLastTouch > 0 && (
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                      <span className="material-icons !text-[10px]">update</span>
                      Visto hace {daysSinceLastTouch} d
                    </span>
                  )}
                </div>
                <h4
                  className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-tight truncate pr-2"
                  title={pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                >
                  {pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                </h4>
              </div>

              <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2">
                {status === "Pendiente de Gestión" && cardType === "porContactar" && (
                  <button
                    onClick={handleQuickContact}
                    className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-0.5 sm:gap-1"
                    title="Contactar para relanzamiento"
                  >
                    <span className="material-icons !text-[12px] sm:!text-sm">send</span>
                    <span className="hidden xs:inline">Contactar</span>
                  </button>
                )}

                {institution?.phone ? (
                  <button
                    onClick={handleWhatsAppClick}
                    className="p-1.5 sm:p-2 rounded-full bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors"
                    title="WhatsApp"
                  >
                    <span className="material-icons !text-base sm:!text-lg">chat</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingPhone(true);
                    }}
                    className="p-1.5 sm:p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Agregar Teléfono"
                  >
                    <span className="material-icons !text-base sm:!text-lg">add_call</span>
                  </button>
                )}
                <div
                  className={`transform transition-transform duration-300 text-slate-400 p-1 ${isExpanded ? "rotate-180" : ""}`}
                >
                  <span className="material-icons text-xl">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Body */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 cursor-default" : "grid-rows-[0fr] opacity-0"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden bg-slate-50/50 dark:bg-slate-800/20 cursor-default">
              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:gap-4 sm:flex-row items-center">
                  <div className="w-full sm:flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Estado Actual
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={`w-full text-sm font-semibold rounded-lg py-2.5 px-3 border outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors appearance-none ${statusColor}`}
                    >
                      {GESTION_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Espacio reservado para acciones futuras */}
                </div>

                {/* Feedback de acciones */}
                {(reminderSuccess || todoistSuccess) && (
                  <div className="flex flex-col gap-2 mt-2">
                    {reminderSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg animate-fade-in">
                        <span className="material-icons !text-purple-600 !text-sm">
                          notifications_active
                        </span>
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          Recordatorios creados
                        </span>
                      </div>
                    )}
                    {todoistSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg animate-fade-in">
                        <span className="material-icons !text-emerald-600 !text-sm">
                          check_circle
                        </span>
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                          Tarea enviada a Todoist
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Notas Actuales */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <span className="material-icons !text-xs">assignment</span>
                        Nota de Estado actual
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Resumen del estado..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <span className="material-icons !text-xs">add_comment</span>
                        Añadir al historial
                      </label>
                      <input
                        type="text"
                        value={newLogEntry}
                        onChange={(e) => setNewLogEntry(e.target.value)}
                        className="w-full text-sm rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Escribe algo que pasó hoy..."
                        onKeyDown={(e) => e.key === "Enter" && hasChanges && (handleSave as any)(e)}
                      />
                    </div>
                  </div>

                  {/* Historial Visual */}
                  <div className="bg-slate-100/50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <span className="material-icons !text-xs">history</span>
                      Línea de Tiempo
                    </label>
                    <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {history ? (
                        history.split("\n").map((line, i) => (
                          <div
                            key={i}
                            className="text-[11px] leading-relaxed border-l-2 border-slate-300 dark:border-slate-600 pl-2 py-1"
                          >
                            <span className="text-slate-400 dark:text-slate-500 font-mono">
                              {line.split(": ")[0]}
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 break-words">
                              {line.split(": ").slice(1).join(": ")}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] italic text-slate-400 py-4 text-center">
                          No hay entradas aún
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {isEffectivelyConfirmed && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="material-icons !text-sm">event</span>
                      Fecha Estimada Inicio 2026
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 15/03/2026..."
                      value={relaunchDate}
                      onChange={(e) => setRelaunchDate(e.target.value)}
                      className="w-full text-sm font-medium rounded-lg py-2 px-3 border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/50 outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={isUpdating || !hasChanges || isJustSaved}
                    className={`flex items-center gap-2 py-2.5 px-8 rounded-xl text-sm font-bold shadow-sm transition-all transform active:scale-95 w-full sm:w-auto justify-center
                                  ${
                                    isJustSaved
                                      ? "bg-emerald-500 text-white cursor-default"
                                      : hasChanges
                                        ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5"
                                        : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                  }
                             `}
                  >
                    {isUpdating ? (
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="material-icons !text-base">
                        {isJustSaved ? "check" : "save"}
                      </span>
                    )}
                    <span>{isJustSaved ? "Guardado" : "Guardar Cambios"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
);

export default GestionCard;
