/**
 * launchTableConfig — Configuración de tabla para RecordEditModal del Lanzador.
 * Extraído de LanzadorConvocatorias para reducir el tamaño del componente.
 */
import {
  FIELD_ARCHIVO_DESCARGABLE_NOMBRE,
  FIELD_ARCHIVO_DESCARGABLE_URL,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_PUBLICACION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS,
  FIELD_REQ_CV_LANZAMIENTOS,
} from "../../../constants";
import { schema } from "../../../lib/dbSchema";

export const LAUNCH_TABLE_CONFIG = {
  label: "Lanzamientos",
  schema: schema.lanzamientos,
  fieldConfig: [
    { key: "sec_info", label: "Información General", type: "section" as const },
    {
      key: FIELD_NOMBRE_PPS_LANZAMIENTOS,
      label: "Nombre PPS",
      type: "text" as const,
      isFullWidth: true,
      required: true,
    },
    {
      key: FIELD_DIRECCION_LANZAMIENTOS,
      label: "Ubicación / Dirección",
      type: "text" as const,
      isFullWidth: true,
    },
    {
      key: FIELD_ORIENTACION_LANZAMIENTOS,
      label: "Orientaciones",
      type: "text" as const,
      description: "Ej: Clínica, Laboral, Educacional",
    },
    {
      key: FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
      label: "Estado",
      type: "select" as const,
      options: ["Abierta", "Cerrado", "Oculto", "Programada"],
    },
    { key: FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS, label: "Cupos", type: "number" as const },
    {
      key: FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
      label: "Horas Acreditadas",
      type: "number" as const,
    },

    { key: "sec_req", label: "Requisitos y Horarios", type: "section" as const },
    {
      key: FIELD_REQ_CV_LANZAMIENTOS,
      label: "Solicitar CV",
      type: "checkbox" as const,
    },
    {
      key: FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS,
      label: "Solicitar Certificado",
      type: "checkbox" as const,
    },
    {
      key: FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
      label: "Horarios Fijos",
      type: "checkbox" as const,
      description: "El alumno no podrá proponer otros horarios",
    },
    {
      key: FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
      label: "Horarios Disponibles",
      type: "textarea" as const,
      isFullWidth: true,
      description: "Separados por punto y coma (;)",
    },

    { key: "sec_dates", label: "Fechas y Cronograma", type: "section" as const },
    { key: FIELD_FECHA_INICIO_LANZAMIENTOS, label: "Fecha Inicio PPS", type: "date" as const },
    { key: FIELD_FECHA_FIN_LANZAMIENTOS, label: "Fecha Fin PPS", type: "date" as const },
    {
      key: FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
      label: "Inicio Inscripción",
      type: "date" as const,
    },
    {
      key: FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
      label: "Fin Inscripción",
      type: "date" as const,
    },
    {
      key: FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS,
      label: "Encuentro Inicial",
      type: "date" as const,
    },
    {
      key: FIELD_FECHA_PUBLICACION_LANZAMIENTOS,
      label: "Fecha Publicación",
      type: "date" as const,
      description: "Para lanzamientos programados",
    },

    { key: "sec_internal", label: "Notas e Internos", type: "section" as const },

    { key: "sec_file", label: "Archivo Descargable", type: "section" as const },
    {
      key: FIELD_ARCHIVO_DESCARGABLE_NOMBRE,
      label: "Descripción del archivo",
      type: "text" as const,
      isFullWidth: true,
      description: "Ej: Descargá la fundamentación completa de la PPS",
    },
    {
      key: FIELD_ARCHIVO_DESCARGABLE_URL,
      label: "Archivo",
      type: "file" as const,
      isFullWidth: true,
      fileBucket: "documentos_pps",
      filePath: "convocatorias",
    },

    { key: "sec_notes", label: "Notas de Gestión", type: "section" as const },
    {
      key: FIELD_NOTAS_GESTION_LANZAMIENTOS,
      label: "Notas de Gestión",
      type: "textarea" as const,
      isFullWidth: true,
      description: "Uso interno para coordinadores",
    },
    {
      key: FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
      label: "Mensaje WhatsApp",
      type: "textarea" as const,
      isFullWidth: true,
      description: "Cuerpo del mensaje que se envía a los grupos",
    },
  ],
};
