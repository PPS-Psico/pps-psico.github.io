import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FIELD_ESTADO_PPS, TABLE_PPS } from "../../constants";
import { db } from "../../lib/db";
import { supabase } from "../../lib/supabaseClient";
import { mockDb } from "../../services/mockDb";
import type { SolicitudPPSFields } from "../../types";
import { sendSmartEmail } from "../../utils/emailService";
import { getStatusVisuals, normalizeStringForComparison } from "../../utils/formatters";
import CollapsibleSection from "../CollapsibleSection";
import ConfirmModal from "../ConfirmModal";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import SubTabs from "../SubTabs";
import Toast from "../ui/Toast";
import FinalizacionReview from "./FinalizacionReview";

// Helper to extract nested values safely
const safeVal = (val: any) =>
  val || <span className="text-slate-300 dark:text-slate-600 italic text-xs">No especificado</span>;

// Grid Item Component
const GridItem: React.FC<{ label: string; value: any; icon?: string; fullWidth?: boolean }> = ({
  label,
  value,
  icon,
  fullWidth,
}) => (
  <div
    className={`${fullWidth ? "col-span-full" : ""} bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 shadow-sm`}
  >
    <div className="flex items-center gap-1.5 mb-1">
      {icon && <span className="material-icons text-slate-400 !text-sm">{icon}</span>}
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words whitespace-pre-wrap leading-snug">
      {safeVal(value)}
    </p>
  </div>
);

const RequestListItem: React.FC<{
  req: any;
  onDeleteRequest: (id: string) => void;
  onUpdate: (id: string, fields: Partial<SolicitudPPSFields>) => Promise<void>;
  isUpdatingParent: boolean;
}> = ({ req, onDeleteRequest, onUpdate, isUpdatingParent }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState(req.estado_seguimiento || "Pendiente");
  const [notes, setNotes] = useState(req.notas || "");
  const [isLocalSaving, setIsLocalSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const statusVisuals = getStatusVisuals(status);
  const normalizedStatus = normalizeStringForComparison(status);
  const isStagnant =
    req._daysSinceUpdate > 4 &&
    ![
      "finalizada",
      "cancelada",
      "rechazada",
      "archivado",
      "realizada",
      "no se pudo concretar",
    ].includes(normalizedStatus);
  const institucion = req.nombre_institucion;
  const instEmail = req.email_institucion;
  const updateTimeDisplay = req.actualizacion || req.created_at;

  useEffect(() => {
    setHasChanges(
      status !== (req.estado_seguimiento || "Pendiente") || notes !== (req.notas || "")
    );
  }, [status, notes, req]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasChanges) return;
    setIsLocalSaving(true);
    // Map UI fields back to DB columns if needed, but constants handle this mostly
    await onUpdate(req.id, { estado_seguimiento: status, notas: notes });
    setIsLocalSaving(false);
    setHasChanges(false);
  };

  const handleDraftEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    const subject = `Propuesta de Convenio PPS - UFLO - Alumno: ${req._studentName}`;
    const body = `Estimados ${institucion},\n\nMe comunico desde la coordinación de Prácticas Profesionales...\n`;
    const mailto = `mailto:${instEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank");
    if (status === "Pendiente") {
      setStatus("En conversaciones");
      setHasChanges(true);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus(req.estado_seguimiento || "Pendiente");
    setNotes(req.notas || "");
    setIsExpanded(false);
  };

  return (
    <div
      className={`group relative bg-white dark:bg-slate-900 rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? "border-blue-400 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-900/30 shadow-lg" : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm"} ${isStagnant && !isExpanded ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10" : ""}`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${isExpanded ? "w-1" : "w-1.5"} ${statusVisuals.accentBg}`}
      ></div>
      <div onClick={() => setIsExpanded(!isExpanded)} className="p-4 pl-5 cursor-pointer">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border transition-colors ${isExpanded ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}
            >
              {req._studentName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">
                  {institucion || "Institución s/n"}
                </h4>
                {isStagnant && !isExpanded && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                    !
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-medium">{req._studentName}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono">{req._studentLegajo}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center pl-14 sm:pl-0">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide ${statusVisuals.labelClass}`}
            >
              {status}
            </span>
            <span
              className={`material-icons text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            >
              expand_more
            </span>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* LEFT COLUMN: INSTITUTIONAL DETAILS */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="material-icons text-slate-400 !text-lg">business</span>
                <h5 className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">
                  Datos Institucionales
                </h5>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GridItem label="Localidad" value={req.localidad} icon="location_on" />
                <GridItem label="Dirección" value={req.direccion_completa} icon="map" />
                <GridItem label="Referente" value={req.referente_institucion} icon="person" />
                <GridItem label="Email Contacto" value={req.email_institucion} icon="email" />
                <GridItem label="Teléfono" value={req.telefono_institucion} icon="phone" />
                <GridItem
                  label="Lic. Psicología (Tutor)"
                  value={req.contacto_tutor}
                  icon="psychology"
                />
              </div>

              <div className="flex gap-4 mt-2">
                <div
                  className={`flex-1 p-3 rounded-lg border flex items-center justify-between ${req.convenio_uflo === "Sí" || req.convenio_uflo === "Si" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-500"}`}
                >
                  <span className="text-xs font-bold uppercase">Convenio UFLO</span>
                  <span className="material-icons !text-lg">
                    {req.convenio_uflo === "Sí" || req.convenio_uflo === "Si"
                      ? "check_circle"
                      : "help_outline"}
                  </span>
                </div>
                <div
                  className={`flex-1 p-3 rounded-lg border flex items-center justify-between ${req.tutor_disponible === "Sí" || req.tutor_disponible === "Si" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}
                >
                  <span className="text-xs font-bold uppercase">Tutor Disponible</span>
                  <span className="material-icons !text-lg">
                    {req.tutor_disponible === "Sí" || req.tutor_disponible === "Si"
                      ? "check_circle"
                      : "cancel"}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PROPOSAL DETAILS & MANAGEMENT */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="material-icons text-slate-400 !text-lg">description</span>
                <h5 className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">
                  Detalles de la Práctica
                </h5>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <GridItem label="Modalidad" value={req.tipo_practica} icon="group_work" />
                <GridItem
                  label="Descripción de Actividades"
                  value={req.descripcion_institucion}
                  icon="article"
                  fullWidth
                />
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-icons text-slate-400 !text-lg">tune</span>
                  <h5 className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">
                    Gestión Interna
                  </h5>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Estado
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En conversaciones">En conversaciones</option>
                      <option value="Realizando convenio">Realizando convenio</option>
                      <option value="Realizada">Realizada</option>
                      <option value="No se pudo concretar">No se pudo concretar</option>
                      <option value="Archivado">Archivado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Notas Internas (Visible al alumno solo si falla)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder:text-slate-400"
                      placeholder="Bitácora de gestión..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-transparent">
                {req.email_institucion && (
                  <button
                    onClick={handleDraftEmail}
                    className="mr-auto px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <span className="material-icons !text-sm">mail</span> Contactar
                  </button>
                )}
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRequest(req.id);
                  }}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center transition-colors border border-transparent hover:border-rose-100"
                  title="Eliminar solicitud"
                >
                  <span className="material-icons !text-lg">delete</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isLocalSaving}
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isLocalSaving ? (
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-icons !text-lg">save</span>
                  )}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SolicitudesManager: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
  const location = useLocation();
  const [activeTabId, setActiveTabId] = useState("ingreso");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab === "egreso") setActiveTabId("egreso");
    else if (tab === "ingreso") setActiveTabId("ingreso");
  }, [location.search]);

  const tabs = [
    { id: "ingreso", label: "Solicitudes de PPS", icon: "login" },
    { id: "egreso", label: "Solicitudes de Finalización", icon: "logout" },
  ];

  const {
    data: requestsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["adminSolicitudes", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        const mockRequests = await mockDb.getAll("solicitudes_pps");
        return mockRequests.map((req: any) => ({
          ...req,
          _studentName: req.nombre_alumno || "Estudiante Mock",
          _studentLegajo: req.legajo || "12345",
          _studentEmail: req.email,
          _daysSinceUpdate: 0,
        }));
      }

      // OPTIMIZED QUERY: Fetch everything (or paginate if too large)
      // Note: We're doing client-side filtering for search/status for responsiveness on moderate datasets
      // For huge datasets, move filtering to .eq() here.
      const { data, error } = await supabase
        .from(TABLE_PPS)
        .select("*, estudiantes!fk_solicitud_estudiante(nombre, legajo, correo)")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return data.map((req: any) => {
        const studentData = req.estudiantes;
        const updatedAt = new Date(req.actualizacion || req.created_at || Date.now());
        return {
          ...req,
          id: String(req.id),
          createdTime: req.created_at,
          _studentName: studentData?.nombre || req.nombre_alumno || "Estudiante",
          _studentLegajo: studentData?.legajo || req.legajo || "---",
          _studentEmail: studentData?.correo || req.email,
          _daysSinceUpdate: Math.floor(
            (new Date().getTime() - updatedAt.getTime()) / (1000 * 3600 * 24)
          ),
        };
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ recordId, fields }: { recordId: string; fields: any }) => {
      if (isTestingMode) return await mockDb.update("solicitudes_pps", recordId, fields);
      const originalRecord = requestsData?.find((r) => r.id === recordId);

      // Email Trigger
      if (
        originalRecord &&
        fields[FIELD_ESTADO_PPS] &&
        fields[FIELD_ESTADO_PPS] !== originalRecord[FIELD_ESTADO_PPS]
      ) {
        await sendSmartEmail("solicitud", {
          studentName: (originalRecord as any)._studentName,
          studentEmail: (originalRecord as any)._studentEmail,
          institution: originalRecord.nombre_institucion,
          newState: fields[FIELD_ESTADO_PPS],
          notes: fields.notas || originalRecord.notas,
        });
      }
      return db.solicitudes.update(recordId, fields);
    },
    onSuccess: () => {
      setToastInfo({ message: "Solicitud actualizada.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["adminSolicitudes", isTestingMode] });
    },
    onError: (err: any) => setToastInfo({ message: `Error: ${err.message}`, type: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isTestingMode) return await mockDb.delete("solicitudes_pps", id);
      await db.solicitudes.delete(id);
    },
    onSuccess: () => {
      setToastInfo({ message: "Solicitud eliminada.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["adminSolicitudes", isTestingMode] });
      setIdToDelete(null);
    },
    onError: (err: any) => {
      setToastInfo({ message: `Error: ${err.message}`, type: "error" });
      setIdToDelete(null);
    },
  });

  const { activeList, historyList } = useMemo(() => {
    if (!requestsData) return { activeList: [], historyList: [] };
    const searchLower = searchTerm.toLowerCase();
    const active: any[] = [],
      history: any[] = [];
    const historyStatuses = [
      "finalizada",
      "cancelada",
      "rechazada",
      "archivado",
      "realizada",
      "no se pudo concretar",
    ];

    requestsData.forEach((req: any) => {
      if (
        searchTerm &&
        !(
          String(req._studentName).toLowerCase().includes(searchLower) ||
          String(req._studentLegajo).toLowerCase().includes(searchLower) ||
          (req.nombre_institucion || "").toLowerCase().includes(searchLower)
        )
      )
        return;

      const status = normalizeStringForComparison(req.estado_seguimiento);

      if (
        statusFilter === "requieren_atencion" &&
        (historyStatuses.includes(status) || req._daysSinceUpdate <= 4)
      )
        return;
      if (
        statusFilter !== "all" &&
        statusFilter !== "requieren_atencion" &&
        normalizeStringForComparison(statusFilter) !== status
      )
        return;

      if (historyStatuses.includes(status)) history.push(req);
      else active.push(req);
    });
    return { activeList: active, historyList: history };
  }, [requestsData, searchTerm, statusFilter]);

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Loader />
      </div>
    );
  if (error) return <EmptyState icon="error" title="Error" message={error.message} />;

  return (
    <div className="space-y-6">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}
      <ConfirmModal
        isOpen={!!idToDelete}
        title="¿Eliminar solicitud?"
        message="Esta acción es permanente y no se puede deshacer."
        confirmText="Eliminar"
        type="danger"
        onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
        onClose={() => setIdToDelete(null)}
      />

      <SubTabs tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />

      {activeTabId === "egreso" ? (
        <FinalizacionReview isTestingMode={isTestingMode} />
      ) : (
        <div className="animate-fade-in-up space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full md:w-96">
              <input
                type="text"
                placeholder="Buscar por alumno o institución..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400">
                search
              </span>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-48 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="all">Estado: Todos</option>
                <option value="requieren_atencion">⚠️ Requieren Atención</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En conversaciones">En conversaciones</option>
                <option value="Realizando convenio">Realizando convenio</option>
                <option value="Realizada">Realizada</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            {activeList.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 pl-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Pendientes de
                  Gestión ({activeList.length})
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {activeList.map((req) => (
                    <RequestListItem
                      key={req.id}
                      req={req}
                      onDeleteRequest={setIdToDelete}
                      onUpdate={async (id, fields) => {
                        await updateMutation.mutateAsync({ recordId: id, fields });
                      }}
                      isUpdatingParent={updateMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
            {historyList.length > 0 && (
              <CollapsibleSection
                title="Historial y Finalizadas"
                count={historyList.length}
                icon="history"
                iconBgColor="bg-slate-100 dark:bg-slate-800"
                iconColor="text-slate-500 dark:text-slate-400"
                borderColor="border-slate-200 dark:border-slate-800"
                defaultOpen={false}
              >
                <div className="grid grid-cols-1 gap-4 mt-4">
                  {historyList.map((req) => (
                    <RequestListItem
                      key={req.id}
                      req={req}
                      onDeleteRequest={setIdToDelete}
                      onUpdate={async (id, fields) => {
                        await updateMutation.mutateAsync({ recordId: id, fields });
                      }}
                      isUpdatingParent={updateMutation.isPending}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            )}
            {activeList.length === 0 && historyList.length === 0 && (
              <div className="py-12">
                <EmptyState
                  icon="inbox"
                  title="Sin Solicitudes"
                  message="No se encontraron registros con los filtros actuales."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitudesManager;
