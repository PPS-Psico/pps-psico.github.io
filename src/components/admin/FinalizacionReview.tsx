import React, { useState, useEffect } from "react";
import { useFinalizacionLogic } from "../../hooks/useFinalizacionLogic";
import { Attachment, getNormalizationState, getStoragePath } from "../../utils/attachmentUtils";
import Loader from "../Loader";
import EmptyState from "../EmptyState";
import Toast from "../ui/Toast";
import CollapsibleSection from "../CollapsibleSection";
import { formatDate } from "../../utils/formatters";
import { supabase } from "../../lib/supabaseClient";
import {
  FIELD_PLANILLA_HORAS_FINALIZACION,
  FIELD_INFORME_FINAL_FINALIZACION,
  FIELD_PLANILLA_ASISTENCIA_FINALIZACION,
  FIELD_SUGERENCIAS_MEJORAS_FINALIZACION,
} from "../../constants";
import ConfirmModal from "../ConfirmModal";
import { FilePreview } from "./preview";

const normalizeAttachments = (attachment: any): Attachment[] => {
  if (!attachment) return [];
  let data = attachment;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return [{ url: data, filename: "Archivo Adjunto", type: "unknown" }];
    }
  }
  const arr = Array.isArray(data) ? data : [data];
  return arr
    .map((a: any) => {
      if (typeof a === "string") return { url: a, filename: "Archivo Adjunto", type: "unknown" };
      return {
        url: a.url || a.signedUrl || "",
        filename: a.filename || a.name || "Archivo",
        type: a.type,
      };
    })
    .filter((a: Attachment) => !!a.url);
};

const RequestListItem: React.FC<{
  request: any;
  onUpdateStatus: (id: string, status: string) => void;
  onDeleteRequest: (record: any) => void;
  onCopy: (text: string) => void;
  isUpdating: boolean;
  searchTerm: string;
  onPreview: (files: Attachment[], initialIndex: number) => void;
  isArchived?: boolean;
}> = ({
  request,
  onUpdateStatus,
  onDeleteRequest,
  onCopy,
  isUpdating,
  searchTerm,
  onPreview,
  isArchived = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const status = getNormalizationState(request);
  const isCargado = status === "cargado",
    isEnProceso = status === "en proceso";
  let visualStatus = "Pendiente",
    statusColor = "bg-amber-500";
  if (isCargado) {
    visualStatus = "Finalizada";
    statusColor = "bg-emerald-500";
  } else if (isEnProceso) {
    visualStatus = "En Proceso SAC";
    statusColor = "bg-indigo-500";
  }
  const statusBadgeClass = isCargado
    ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
    : isEnProceso
      ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800"
      : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
  const planillaHoras: Attachment[] = normalizeAttachments(
    request[FIELD_PLANILLA_HORAS_FINALIZACION]
  );
  const informes: Attachment[] = normalizeAttachments(request[FIELD_INFORME_FINAL_FINALIZACION]);
  const asistencias: Attachment[] = normalizeAttachments(
    request[FIELD_PLANILLA_ASISTENCIA_FINALIZACION]
  );
  const allFiles: Attachment[] = [...planillaHoras, ...informes, ...asistencias];

  const handleDownloadZip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allFiles.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const JSZip = (await import("jszip")).default,
        FileSaver = (await import("file-saver")).default,
        zip = new JSZip();
      const folder = zip.folder(`Acreditacion_${request.studentName}_${request.studentLegajo}`);
      await Promise.all(
        allFiles.map(async (file) => {
          try {
            const path = getStoragePath(file.url);
            let blob: Blob | null = null;
            if (path) {
              const { data, error } = await supabase.storage
                .from("documentos_finalizacion")
                .download(path);
              if (!error && data) blob = data;
            } else {
              blob = await fetch(file.url).then((r) => r.blob());
            }
            if (blob) folder?.file(file.filename, blob);
          } catch (err) {}
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      FileSaver.saveAs(content as Blob, `Acreditacion_${request.studentLegajo}.zip`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleCopyExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const legajo = request.studentLegajo || "";
    const nombre = request.studentName || "";
    const textToCopy = `${dateStr}\t${legajo}\t${nombre}`;
    onCopy(textToCopy);
  };

  return (
    <div
      className={`group relative bg-white dark:bg-slate-900 rounded-xl border transition-all duration-300 ${isExpanded ? "border-blue-400 dark:border-indigo-500 ring-1 ring-blue-100 dark:ring-indigo-500/30 shadow-lg" : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-indigo-500 shadow-sm"}`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all ${isExpanded ? "w-1" : "w-1.5"} ${statusColor} rounded-l-xl`}
      ></div>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 pl-6 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${isCargado ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"}`}
          >
            {request.studentName.charAt(0)}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">
              {request.studentName}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono bg-slate-50 dark:bg-slate-800 px-1.5 rounded border border-slate-100 dark:border-slate-700">
                {request.studentLegajo}
              </span>
              <span>•</span>
              <span>Solicitado: {formatDate(request.createdTime)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-center">
          {allFiles.length > 0 && (
            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-800 transition-colors"
            >
              {isDownloadingZip ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-icons !text-sm">download</span>
              )}{" "}
              ZIP
            </button>
          )}
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${statusBadgeClass}`}
          >
            {visualStatus}
          </span>
          <div
            className={`text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
          >
            <span className="material-icons !text-xl">expand_more</span>
          </div>
        </div>
      </div>
      <div
        className={`grid transition-all duration-500 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-800" : "grid-rows-[0fr] opacity-0 h-0 overflow-hidden"}`}
      >
        <div className="overflow-hidden p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { l: "Planilla Horas", f: planillaHoras, i: "table_view" },
              { l: "Informe Final", f: informes, i: "description" },
              { l: "Asistencias", f: asistencias, i: "verified_user" },
            ].map((sec, idx) => (
              <div key={idx} className="space-y-2">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {sec.l}
                </h5>
                {sec.f.length > 0 ? (
                  sec.f.map((file, fidx) => (
                    <button
                      key={fidx}
                      onClick={() => onPreview(allFiles, allFiles.indexOf(file))}
                      className="w-full flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 transition-colors text-left"
                    >
                      <span className="material-icons !text-lg text-slate-400">{sec.i}</span>
                      <span className="text-xs font-medium truncate flex-1 text-slate-600 dark:text-slate-300">
                        {file.filename}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No adjunto</p>
                )}
              </div>
            ))}
          </div>
          {request[FIELD_SUGERENCIAS_MEJORAS_FINALIZACION] && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-lg">
              <h6 className="text-xs font-bold text-amber-700 dark:text-amber-500 mb-1">
                Sugerencias del alumno
              </h6>
              <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                "{request[FIELD_SUGERENCIAS_MEJORAS_FINALIZACION]}"
              </p>
            </div>
          )}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onDeleteRequest(request)}
              disabled={isUpdating}
              className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
            >
              <span className="material-icons !text-sm">delete</span> Eliminar
            </button>
            {!isArchived && (
              <div className="flex gap-3">
                <button
                  onClick={handleCopyExcel}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span className="material-icons !text-sm">content_copy</span> Copiar
                </button>
                <button
                  onClick={() => onUpdateStatus(request.id, "En Proceso")}
                  disabled={isUpdating || isEnProceso || isCargado}
                  className={`px-4 py-2 rounded-lg text-xs font-bold ${isEnProceso ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" : "bg-white border border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300"}`}
                >
                  {isEnProceso ? "En Proceso" : "Marcar en Proceso"}
                </button>
                <button
                  onClick={() => onUpdateStatus(request.id, "Cargado")}
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md flex items-center gap-2"
                >
                  <span className="material-icons !text-sm">check_circle</span> Confirmar SAC
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FinalizacionReview: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
  const {
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    toastInfo,
    setToastInfo,
    updateStatusMutation,
    deleteMutation,
    activeList,
    historyList,
  } = useFinalizacionLogic(isTestingMode);
  const [previewFiles, setPreviewFiles] = useState<Attachment[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  const handleCopyData = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setToastInfo({ message: "Datos copiados para Excel.", type: "success" });
    });
  };

  const handlePreview = async (files: Attachment[]) => {
    // Obtener signed URLs para los archivos
    const filesWithSignedUrls = await Promise.all(
      files.map(async (file) => {
        const path = getStoragePath(file.url);
        if (!path) return file;
        try {
          const { data, error } = await supabase.storage
            .from("documentos_finalizacion")
            .createSignedUrl(path, 3600);
          if (error || !data) return file;
          return { ...file, signedUrl: data.signedUrl };
        } catch (e) {
          return file;
        }
      })
    );
    setPreviewFiles(filesWithSignedUrls);
    setIsPreviewOpen(true);
  };

  if (isLoading) return <Loader />;
  if (error)
    return (
      <EmptyState icon="error" title="Error" message="No se pudieron cargar las solicitudes." />
    );

  return (
    <div className="space-y-8 animate-fade-in-up">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}
      {isPreviewOpen && (
        <FilePreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          files={previewFiles}
          initialIndex={0}
        />
      )}
      <ConfirmModal
        isOpen={!!recordToDelete}
        title="¿Eliminar solicitud de acreditación?"
        message="Se borrarán los archivos y el estado del estudiante volverá a 'Activo'. ¿Continuar?"
        confirmText="Confirmar eliminación"
        type="danger"
        onConfirm={() => recordToDelete && deleteMutation.mutate(recordToDelete)}
        onClose={() => setRecordToDelete(null)}
      />
      <div className="p-4 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Buscar por estudiante o legajo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400">
            search
          </span>
        </div>
      </div>
      {activeList.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Pendientes (
            {activeList.length})
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {activeList.map((req: any) => (
              <RequestListItem
                key={req.id}
                request={req}
                onUpdateStatus={(id, s) => updateStatusMutation.mutate({ id, status: s })}
                onDeleteRequest={setRecordToDelete}
                onCopy={handleCopyData}
                isUpdating={updateStatusMutation.isPending || deleteMutation.isPending}
                searchTerm={searchTerm}
                onPreview={handlePreview}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="py-12 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400">
          <span className="material-icons !text-4xl mb-2 opacity-50">task_alt</span>
          <p className="font-medium">No hay solicitudes pendientes</p>
        </div>
      )}
      {historyList.length > 0 && (
        <CollapsibleSection
          title="Historial"
          count={historyList.length}
          icon="history"
          iconBgColor="bg-slate-100 dark:bg-gray-800"
          iconColor="text-slate-500 dark:text-slate-400"
          borderColor="border-slate-200 dark:border-slate-700"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 gap-4 mt-4">
            {historyList.map((req: any) => (
              <RequestListItem
                key={req.id}
                request={req}
                onUpdateStatus={() => {}}
                onDeleteRequest={setRecordToDelete}
                onCopy={handleCopyData}
                isUpdating={deleteMutation.isPending}
                searchTerm={searchTerm}
                onPreview={handlePreview}
                isArchived={true}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

export default FinalizacionReview;
