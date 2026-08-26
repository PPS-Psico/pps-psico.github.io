export { fetchStudentData } from "./estudiantesService";

export { fetchPracticas, deletePractica, updatePracticaFromSchedule } from "./practicasService";

export {
  fetchConvocatoriasData,
  fetchSeleccionados,
  darBajaPpsConPenalizacion,
  toggleStudentSelection,
} from "./convocatoriasService";
export type { BajaPpsInput, BajaPpsResult } from "./convocatoriasService";

export {
  fetchStudentCompromisos,
  submitCompromisoPPS,
  sendCompromisoAcceptanceEmail,
} from "./compromisosService";

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

export {
  notifySelectedStudents,
  sendSelectionEmails,
  sendSelectionPushNotifications,
  fetchSelectedCandidatesForLaunch,
} from "./selectionNotificationService";
export type { SelectionCandidate } from "./selectionNotificationService";

export { closeSelectionAndQueueNotifications } from "./selectionClosingService";
export type {
  CloseSelectionRpcResult,
  QueuedSelectionClose,
  SelectionClosingDependencies,
} from "./selectionClosingService";
