export { fetchStudentData } from "./estudiantesService";

export { fetchPracticas, deletePractica, updatePracticaFromSchedule } from "./practicasService";

export {
  fetchConvocatoriasData,
  fetchSeleccionados,
  toggleStudentSelection,
} from "./convocatoriasService";

export {
  fetchStudentCompromisos,
  submitCompromisoPPS,
  sendCompromisoAcceptanceEmail,
} from "./compromisosService";

export {
  fetchSolicitudes,
  uploadSolicitudFile,
  submitSolicitudModificacion,
  submitSolicitudNuevaPPS,
  fetchSolicitudesModificacionByStudent,
  fetchSolicitudesNuevaPPSByStudent,
  fetchAllSolicitudesModificacion,
  fetchAllSolicitudesNuevaPPS,
  approveSolicitudModificacion,
  rejectSolicitudModificacion,
  approveSolicitudNuevaPPS,
  rejectSolicitudNuevaPPS,
} from "./solicitudesService";

export {
  fetchFinalizacionRequest,
  uploadFinalizationFile,
  submitFinalizationRequest,
  deleteFinalizationRequest,
} from "./finalizacionService";

export { fetchCorrectionPanelData } from "./correccionService";

export { uploadInstitutionLogo } from "./storageService";
