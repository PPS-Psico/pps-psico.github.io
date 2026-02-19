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
import { FilterTabs, SearchBar } from "./SearchAndFilter";
import SolicitudesCorreccionManager from "./SolicitudesCorreccionManager";

// Helper to extract nested values safely
const safeVal = (val: any) =>
  val || <span className="text-slate-300 dark:text-slate-600 italic text-xs">No especificado</span>;

// Quick Copy Component
const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded transition-all flex items-center gap-1 ${copied ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"}`}
      title={label || "Copiar"}
    >
      <span className="material-icons !text-[12px]">{copied ? "done" : "content_copy"}</span>
      {copied && <span className="text-[10px] font-bold">¡Copiado!</span>}
    </button>
  );
};

// Grid Item Component
const GridItem: React.FC<{
  label: string;
  value: any;
  icon?: string;
  fullWidth?: boolean;
  action?: React.ReactNode;
}> = ({ label, value, icon, fullWidth, action }) => (
  <div
    className={`${fullWidth ? "col-span-full" : ""} bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center justify-between gap-3`}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="material-icons text-slate-400 !text-sm">{icon}</span>}
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words whitespace-pre-wrap leading-snug">
        {safeVal(value)}
      </p>
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
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
  const daysStagnant = req._daysSinceUpdate;
  const institucion = req.nombre_institucion;
  const instEmail = req.email_institucion;
  const updateTimeDisplay = req.actualizacion || req.created_at;
  const navigate = useLocation(); // Hook used to trigger navigate below
  const globalNavigate = (path: string) =>
    window.open(`${window.location.origin}${window.location.pathname}#${path}`, "_blank");

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
                {isStagnant && (
                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse">
                    <span className="material-icons !text-[10px]">timer</span>
                    {daysStagnant} días sin novedad
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    globalNavigate(`/admin/estudiantes/${req._studentLegajo}`);
                  }}
                  className="font-medium hover:text-blue-600 hover:underline transition-colors flex items-center gap-1"
                >
                  {req._studentName}
                  <span className="material-icons !text-[10px]">open_in_new</span>
                </button>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {req._studentLegajo}
                </span>
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
                <GridItem
                  label="Email Contacto"
                  value={req.email_institucion}
                  icon="email"
                  action={req.email_institucion && <CopyButton text={req.email_institucion} />}
                />
                <GridItem
                  label="Teléfono"
                  value={req.telefono_institucion}
                  icon="phone"
                  action={
                    req.telefono_institucion && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const cleanPhone = String(req.telefono_institucion).replace(/\D/g, "");
                          const message = `Hola, buen día. Soy Blas Rivera, Coordinador de PPS de UFLO Psicología.\n\nMe contactó el estudiante ${req._studentName} comentándome que estuvo conversando con ustedes sobre la posibilidad de realizar sus prácticas profesionales allí. Me pongo a disposición para coordinar los aspectos formales y académicos del convenio si están interesados.\n\n¡Muchas gracias!`;
                          window.open(
                            `https://wa.me/${cleanPhone}/?text=${encodeURIComponent(message)}`,
                            "_blank"
                          );
                        }}
                        className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-800"
                        title="Enviar WhatsApp"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4 fill-current"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </button>
                    )
                  }
                />
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
    else if (tab === "correcciones") setActiveTabId("correcciones");
  }, [location.search]);

  const tabs = [
    { id: "ingreso", label: "Solicitudes de PPS", icon: "login" },
    { id: "egreso", label: "Solicitudes de Finalización", icon: "logout" },
    { id: "correcciones", label: "Solicitudes de Corrección", icon: "edit_note" },
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
      ) : activeTabId === "correcciones" ? (
        <SolicitudesCorreccionManager />
      ) : (
        <div className="animate-fade-in-up space-y-6">
          {/* Barra de búsqueda y filtros mejorada */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar por alumno, legajo o institución..."
                className="w-full md:w-96"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {activeList.length + historyList.length} solicitudes
                </span>
              </div>
            </div>

            {/* Filtros de estado como tabs */}
            <FilterTabs
              options={[
                { value: "all", label: "Todos", count: activeList.length + historyList.length },
                {
                  value: "requieren_atencion",
                  label: "⚠️ Requieren Atención",
                  count: activeList.filter((r) => r._daysSinceUpdate > 4).length,
                },
                {
                  value: "Pendiente",
                  label: "Pendiente",
                  count: activeList.filter(
                    (r) => normalizeStringForComparison(r.estado_seguimiento) === "pendiente"
                  ).length,
                },
                {
                  value: "En conversaciones",
                  label: "En Conversaciones",
                  count: activeList.filter(
                    (r) =>
                      normalizeStringForComparison(r.estado_seguimiento) === "en conversaciones"
                  ).length,
                },
                {
                  value: "Realizando convenio",
                  label: "Realizando Convenio",
                  count: activeList.filter(
                    (r) =>
                      normalizeStringForComparison(r.estado_seguimiento) === "realizando convenio"
                  ).length,
                },
                {
                  value: "Realizada",
                  label: "Realizada",
                  count: historyList.filter(
                    (r) => normalizeStringForComparison(r.estado_seguimiento) === "realizada"
                  ).length,
                },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
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
