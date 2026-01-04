
import { z } from 'zod';
import * as C from './constants';

export const ALL_ORIENTACIONES = ['Clinica', 'Educacional', 'Laboral', 'Comunitaria'] as const;
export const ALL_ESTADOS_ESTUDIANTE = ['Activo', 'Finalizado', 'Inactivo', 'Nuevo (Sin cuenta)'] as const;

const baseRecordSchema = z.object({
    id: z.string(),
    createdTime: z.string().optional(),
    created_at: z.string().optional(),
});

export const estudianteFieldsSchema = z.object({
    [C.FIELD_LEGAJO_ESTUDIANTES]: z.string().or(z.number()).optional().nullable(),
    [C.FIELD_NOMBRE_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_NOMBRE_SEPARADO_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_APELLIDO_SEPARADO_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_GENERO_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_DNI_ESTUDIANTES]: z.number().optional().nullable(),
    [C.FIELD_FECHA_NACIMIENTO_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_CORREO_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_TELEFONO_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_NOTAS_INTERNAS_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_FECHA_FINALIZACION_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_ESTADO_ESTUDIANTES]: z.enum(ALL_ESTADOS_ESTUDIANTE).optional().nullable(),
    [C.FIELD_USER_ID_ESTUDIANTES]: z.string().uuid().optional().nullable(),
    [C.FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES]: z.boolean().optional().nullable(),
    [C.FIELD_ROLE_ESTUDIANTES]: z.string().optional().nullable(),
    [C.FIELD_TRABAJA_ESTUDIANTES]: z.boolean().optional().nullable(),
    [C.FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES]: z.string().optional().nullable(),
});

export const practicaFieldsSchema = z.object({
    [C.FIELD_NOMBRE_BUSQUEDA_PRACTICAS]: z.array(z.string().or(z.number())).optional().nullable(),
    [C.FIELD_ESTUDIANTE_LINK_PRACTICAS]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_HORAS_PRACTICAS]: z.number().optional().nullable(),
    [C.FIELD_FECHA_INICIO_PRACTICAS]: z.string().optional().nullable(),
    [C.FIELD_FECHA_FIN_PRACTICAS]: z.string().optional().nullable(),
    [C.FIELD_ESTADO_PRACTICA]: z.string().optional().nullable(),
    [C.FIELD_ESPECIALIDAD_PRACTICAS]: z.string().optional().nullable(),
    [C.FIELD_NOTA_PRACTICAS]: z.string().optional().nullable(),
    [C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_INSTITUCION_LINK_PRACTICAS]: z.string().or(z.array(z.string())).optional().nullable(),
});

export const solicitudPPSFieldsSchema = z.object({
    [C.FIELD_EMPRESA_PPS_SOLICITUD]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_ESTADO_PPS]: z.string().optional().nullable(),
    [C.FIELD_ULTIMA_ACTUALIZACION_PPS]: z.string().optional().nullable(),
    [C.FIELD_NOTAS_PPS]: z.string().optional().nullable(),
    [C.FIELD_LEGAJO_PPS]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_SOLICITUD_LEGAJO_ALUMNO]: z.string().or(z.number()).optional().nullable(),
    [C.FIELD_SOLICITUD_NOMBRE_ALUMNO]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_EMAIL_ALUMNO]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_LOCALIDAD]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_DIRECCION]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_EMAIL_INSTITUCION]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_TELEFONO_INSTITUCION]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_REFERENTE]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_TIENE_CONVENIO]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_TIENE_TUTOR]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_CONTACTO_TUTOR]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_TIPO_PRACTICA]: z.string().optional().nullable(),
    [C.FIELD_SOLICITUD_DESCRIPCION]: z.string().optional().nullable(),
});

export const lanzamientoPPSFieldsSchema = z.object({
    [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_FECHA_FIN_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_DIRECCION_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_ORIENTACION_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: z.number().optional().nullable(),
    [C.FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: z.number().optional().nullable(),
    [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_DURACION_INSCRIPCION_DIAS_LANZAMIENTOS]: z.number().optional().nullable(),
    [C.FIELD_PLANTILLA_SEGURO_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_INFORME_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_ESTADO_GESTION_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_NOTAS_GESTION_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_TELEFONO_INSTITUCION_LANZAMIENTOS]: z.string().optional().nullable(),
    [C.FIELD_PERMITE_CERTIFICADO_LANZAMIENTOS]: z.boolean().optional().nullable(),

    [C.FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: z.string().optional().nullable(),
});

export const convocatoriaFieldsSchema = z.object({
    [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_NOMBRE_PPS_CONVOCATORIAS]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_FECHA_INICIO_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_FECHA_FIN_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_DIRECCION_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_HORARIO_FORMULA_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_HORAS_ACREDITADAS_CONVOCATORIAS]: z.number().optional().nullable(),
    [C.FIELD_CUPOS_DISPONIBLES_CONVOCATORIAS]: z.number().optional().nullable(),
    [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_ORIENTACION_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_TERMINO_CURSAR_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_FINALES_ADEUDA_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_OTRA_SITUACION_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_LEGAJO_CONVOCATORIAS]: z.string().or(z.number()).optional().nullable(),
    [C.FIELD_DNI_CONVOCATORIAS]: z.number().optional().nullable(),
    [C.FIELD_CORREO_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_FECHA_NACIMIENTO_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_TELEFONO_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_INFORME_SUBIDO_CONVOCATORIAS]: z.boolean().optional().nullable(),
    [C.FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_CERTIFICADO_CONVOCATORIAS]: z.any().optional().nullable(),
    [C.FIELD_TRABAJA_CONVOCATORIAS]: z.boolean().optional().nullable(),
    [C.FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS]: z.string().optional().nullable(),
    [C.FIELD_CV_CONVOCATORIAS]: z.string().optional().nullable(),
});

export const institucionFieldsSchema = z.object({
    [C.FIELD_NOMBRE_INSTITUCIONES]: z.string().optional().nullable(),
    [C.FIELD_TELEFONO_INSTITUCIONES]: z.string().optional().nullable(),
    [C.FIELD_DIRECCION_INSTITUCIONES]: z.string().optional().nullable(),
    [C.FIELD_CONVENIO_NUEVO_INSTITUCIONES]: z.string().or(z.boolean()).optional().nullable(),
    [C.FIELD_TUTOR_INSTITUCIONES]: z.string().optional().nullable(),
    [C.FIELD_CODIGO_CAMPUS_INSTITUCIONES]: z.string().optional().nullable(),
    [C.FIELD_ORIENTACIONES_INSTITUCIONES]: z.string().optional().nullable(),
});

export const penalizacionFieldsSchema = z.object({
    [C.FIELD_PENALIZACION_ESTUDIANTE_LINK]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_PENALIZACION_TIPO]: z.string().optional().nullable(),
    [C.FIELD_PENALIZACION_FECHA]: z.string().optional().nullable(),
    [C.FIELD_PENALIZACION_NOTAS]: z.string().optional().nullable(),
    [C.FIELD_PENALIZACION_PUNTAJE]: z.number().optional().nullable(),
    [C.FIELD_PENALIZACION_CONVOCATORIA_LINK]: z.string().or(z.array(z.string())).optional().nullable(),
});

export const finalizacionPPSFieldsSchema = z.object({
    [C.FIELD_ESTUDIANTE_FINALIZACION]: z.string().or(z.array(z.string())).optional().nullable(),
    [C.FIELD_FECHA_SOLICITUD_FINALIZACION]: z.string().optional().nullable(),
    [C.FIELD_ESTADO_FINALIZACION]: z.string().optional().nullable(),
    [C.FIELD_INFORME_FINAL_FINALIZACION]: z.any().optional().nullable(),
    [C.FIELD_PLANILLA_HORAS_FINALIZACION]: z.any().optional().nullable(),
    [C.FIELD_PLANILLA_ASISTENCIA_FINALIZACION]: z.any().optional().nullable(),
    [C.FIELD_SUGERENCIAS_MEJORAS_FINALIZACION]: z.string().optional().nullable(),
});

export const authUserFieldsSchema = z.object({
    [C.FIELD_LEGAJO_AUTH]: z.string().optional().nullable(),
    [C.FIELD_NOMBRE_AUTH]: z.string().optional().nullable(),
    [C.FIELD_PASSWORD_HASH_AUTH]: z.string().optional().nullable(),
    [C.FIELD_SALT_AUTH]: z.string().optional().nullable(),
    [C.FIELD_ROLE_AUTH]: z.string().optional().nullable(),
    [C.FIELD_ORIENTACIONES_AUTH]: z.array(z.string()).optional().nullable(),
});


// Array schemas for fetching data
export const estudianteArraySchema = z.array(baseRecordSchema.merge(estudianteFieldsSchema));
export const practicaArraySchema = z.array(baseRecordSchema.merge(practicaFieldsSchema));
export const solicitudPPSArraySchema = z.array(baseRecordSchema.merge(solicitudPPSFieldsSchema));
export const lanzamientoPPSArraySchema = z.array(baseRecordSchema.merge(lanzamientoPPSFieldsSchema));
export const convocatoriaArraySchema = z.array(baseRecordSchema.merge(convocatoriaFieldsSchema));
export const institucionArraySchema = z.array(baseRecordSchema.merge(institucionFieldsSchema));
export const penalizacionArraySchema = z.array(baseRecordSchema.merge(penalizacionFieldsSchema));
export const finalizacionPPSArraySchema = z.array(baseRecordSchema.merge(finalizacionPPSFieldsSchema));
export const authUserArraySchema = z.array(baseRecordSchema.merge(authUserFieldsSchema));
