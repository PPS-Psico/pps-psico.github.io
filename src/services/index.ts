export { fetchStudentData } from "./estudiantesService";

export { fetchPracticas, deletePractica, updatePracticaFromSchedule } from "./practicasService";

export {
  fetchConvocatoriasData,
  fetchSeleccionados,
  darBajaPpsConPenalizacion,
  toggleStudentSelection,
  eliminarLanzamiento,
} from "./convocatoriasService";
export type { BajaPpsInput, BajaPpsResult } from "./convocatoriasService";

export {
  fetchStudentCompromisos,
  submitCompromisoPPS,
  sendCompromisoAcceptanceEmail,
} from "./compromisosService";

export {
  eximirConsentimiento,
  revertirExencionConsentimiento,
} from "./consentimientoExencionService";

export {
  fetchSolicitudes,
  uploadSolicitudFile,
  submitSolicitudModificacion,
  submitSolicitudBajaPps,
  submitSolicitudNuevaPPS,
  fetchSolicitudesModificacionByStudent,
  fetchSolicitudesNuevaPPSByStudent,
  fetchAllSolicitudesModificacion,
  fetchAllSolicitudesNuevaPPS,
  approveSolicitudModificacion,
  rejectSolicitudModificacion,
  resolveSolicitudBajaPps,
  approveSolicitudNuevaPPS,
  rejectSolicitudNuevaPPS,
  archiveSolicitudCorreccion,
  unarchiveSolicitudCorreccion,
} from "./solicitudesService";
export type { ResolveSolicitudBajaInput } from "./solicitudesService";

export {
  fetchFinalizacionRequest,
  uploadFinalizationFile,
  submitFinalizationRequest,
  deleteFinalizationRequest,
} from "./finalizacionService";

export { fetchCorrectionPanelData } from "./correccionService";

export { uploadInstitutionLogo } from "./storageService";

export {
  deriveBucket,
  isSeguroGestionado,
  marcarAseguramiento,
  revertirAseguramiento,
  buildClipboardText,
  buildHeader,
} from "./aseguramientoService";
export type {
  UIState,
  SidebarBucket,
  BucketInput,
  ClipboardStudent,
  SeguroHeader,
} from "./aseguramientoService";

export {
  fetchConveniosKpis,
  fetchConveniosPorVencer,
  fetchConveniosDeInstitucion,
  crearConvenio,
} from "./conveniosService";
export type { ConvenioPorVencer, ConveniosKpis } from "./conveniosService";

// El envío de avisos de selección ya no vive en el navegador: lo hace la Edge
// Function `notify-selection-closed`, que registra a quién le escribió y puede
// reintentarse sin duplicar correos. `selectionNotificationService` se eliminó
// junto con ese camino.
export {
  closeSelectionAndQueueNotifications,
  notifySelectedStudentsForLaunch,
} from "./selectionClosingService";
export type {
  CloseSelectionRpcResult,
  NotifySelectionResult,
  QueuedSelectionClose,
  SelectionClosingDependencies,
} from "./selectionClosingService";
