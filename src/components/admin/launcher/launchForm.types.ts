/**
 * launchForm.types — Tipos, estado inicial y datos mock del formulario de
 * "Nuevo Lanzamiento". Extraído de LanzadorConvocatorias para aligerar el
 * componente y poder reutilizar la forma de datos en otros lugares.
 */
import {
  FIELD_CODIGO_CAMPUS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS,
  FIELD_REQ_CV_LANZAMIENTOS,
} from "../../../constants";

export type FormData = {
  [key: string]: string | number | undefined | null | string[] | boolean;
  nombrePPS: string | undefined;
  fechaInicio: string | undefined;
  fechaFin: string | undefined;
  fechaEncuentroInicial: string | undefined;
  fechaInicioInscripcion: string | undefined;
  fechaFinInscripcion: string | undefined;
  orientacion: string[]; // Multiple selections
  horasAcreditadas: number | undefined;
  cuposDisponibles: number | undefined;
  estadoConvocatoria: string | undefined;
  reqCertificadoTrabajo: boolean;
  reqCv: boolean;
  direccion: string | undefined;
  descripcion: string;
  requisitoObligatorio: string;
  archivoDescargableNombre: string;
  archivoDescargableUrl: string;
  programarLanzamiento: boolean;
  fechaPublicacion: string;
  mensajeWhatsApp: string;
  actividadesLabel: string;
  horariosFijos: boolean;
};

export interface ScheduleEntry {
  time: string;
  orientacion: string;
}

export const initialState: FormData = {
  nombrePPS: "",
  fechaInicio: "",
  fechaFin: "",
  fechaEncuentroInicial: "",
  fechaInicioInscripcion: "",
  fechaFinInscripcion: "",
  orientacion: [],
  horasAcreditadas: 0,
  cuposDisponibles: 1,
  estadoConvocatoria: "Abierta",
  reqCertificadoTrabajo: true,
  reqCv: false,
  direccion: "",
  descripcion: "",
  requisitoObligatorio: "",
  archivoDescargableNombre: "",
  archivoDescargableUrl: "",
  programarLanzamiento: false,
  fechaPublicacion: "",
  mensajeWhatsApp: "",
  actividadesLabel: "Actividades",
  horariosFijos: false,
};

export const mockInstitutions = [
  { id: "recInstMock1", [FIELD_NOMBRE_INSTITUCIONES]: "Hospital de Juguete" },
  { id: "recInstMock2", [FIELD_NOMBRE_INSTITUCIONES]: "Escuela de Pruebas" },
  { id: "recInstMock3", [FIELD_NOMBRE_INSTITUCIONES]: "Empresa Ficticia S.A." },
];

export const mockLastLanzamiento = {
  id: "recLanzMock1",
  [FIELD_ORIENTACION_LANZAMIENTOS]: "Clínica",
  [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: 120,
  [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 5,
  [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: "Lunes 9 a 13hs; Miércoles 14 a 18hs",
  [FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS]: true,
  [FIELD_REQ_CV_LANZAMIENTOS]: false,
  [FIELD_DIRECCION_LANZAMIENTOS]: "Calle Falsa 123",
  [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: "<div>Test</div>",
  descripcion: "Mock description",
  actividades: ["Act 1"],
  requisitoObligatorio: "",
  archivoDescargableNombre: "",
  archivoDescargableUrl: "",
};
