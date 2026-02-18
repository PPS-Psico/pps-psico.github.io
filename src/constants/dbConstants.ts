// Table Names
export const TABLE_PPS = "solicitudes_pps";
export const TABLE_PRACTICAS = "practicas";
export const TABLE_ESTUDIANTES = "estudiantes";
export const TABLE_AUTH_USERS = "auth_users";
export const TABLE_LANZAMIENTOS = "lanzamientos_pps";
export const TABLE_CONVOCATORIAS = "convocatorias";
export const TABLE_INSTITUCIONES = "instituciones";
export const TABLE_FINALIZACION = "finalizacion_pps";
export const TABLE_PENALIZACIONES = "penalizaciones";
export const TABLE_SOLICITUDES_MODIFICACION = "solicitudes_modificacion_pps";
export const TABLE_SOLICITUDES_NUEVA = "solicitudes_nueva_pps";

// Legacy Aliases for Tables (Kept for compatibility)
export const TABLE_NAME_PPS = TABLE_PPS;
export const TABLE_NAME_PRACTICAS = TABLE_PRACTICAS;
export const TABLE_NAME_ESTUDIANTES = TABLE_ESTUDIANTES;
export const TABLE_NAME_AUTH_USERS = TABLE_AUTH_USERS;
export const TABLE_NAME_LANZAMIENTOS_PPS = TABLE_LANZAMIENTOS;
export const TABLE_NAME_CONVOCATORIAS = TABLE_CONVOCATORIAS;
export const TABLE_NAME_INSTITUCIONES = TABLE_INSTITUCIONES;
export const TABLE_NAME_FINALIZACION = TABLE_FINALIZACION;
export const TABLE_NAME_PENALIZACIONES = TABLE_PENALIZACIONES;
export const TABLE_NAME_SOLICITUDES_MODIFICACION = TABLE_SOLICITUDES_MODIFICACION;
export const TABLE_NAME_SOLICITUDES_NUEVA = TABLE_SOLICITUDES_NUEVA;

// --- DB COLUMN NAMES (Mapped to FIELD_ constants for app compatibility) ---

// Estudiantes
export const FIELD_LEGAJO_ESTUDIANTES = "legajo";
export const FIELD_NOMBRE_ESTUDIANTES = "nombre";
export const FIELD_NOMBRE_SEPARADO_ESTUDIANTES = "nombre_separado";
export const FIELD_APELLIDO_SEPARADO_ESTUDIANTES = "apellido_separado";
export const FIELD_DNI_ESTUDIANTES = "dni";
export const FIELD_CORREO_ESTUDIANTES = "correo";
export const FIELD_TELEFONO_ESTUDIANTES = "telefono";
export const FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES = "orientacion_elegida";
export const FIELD_ESTADO_ESTUDIANTES = "estado";
export const FIELD_USER_ID_ESTUDIANTES = "user_id";
export const FIELD_NOTAS_INTERNAS_ESTUDIANTES = "notas_internas";
export const FIELD_FECHA_NACIMIENTO_ESTUDIANTES = "fecha_nacimiento";
export const FIELD_GENERO_ESTUDIANTES = "genero";
export const FIELD_FECHA_FINALIZACION_ESTUDIANTES = "fecha_finalizacion";
export const FIELD_FINALIZARON_ESTUDIANTES = "finalizaron"; // Boolean in legacy, check usage
export const FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES = "must_change_password";
export const FIELD_ROLE_ESTUDIANTES = "role";
export const FIELD_TRABAJA_ESTUDIANTES = "trabaja";
export const FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES = "certificado_trabajo";

// Prácticas
export const FIELD_ESTUDIANTE_LINK_PRACTICAS = "estudiante_id";
export const FIELD_LANZAMIENTO_VINCULADO_PRACTICAS = "lanzamiento_id";
export const FIELD_INSTITUCION_LINK_PRACTICAS = "institucion_id";
export const FIELD_HORAS_PRACTICAS = "horas_realizadas";
export const FIELD_NOTA_PRACTICAS = "nota";
export const FIELD_ESTADO_PRACTICA = "estado";
export const FIELD_FECHA_INICIO_PRACTICAS = "fecha_inicio";
export const FIELD_FECHA_FIN_PRACTICAS = "fecha_finalizacion";
export const FIELD_ESPECIALIDAD_PRACTICAS = "especialidad";
export const FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS = "nombre_institucion";
export const FIELD_NOMBRE_BUSQUEDA_PRACTICAS = "legajo_busqueda"; // Deprecated? Kept for schema

// Lanzamientos
export const FIELD_NOMBRE_PPS_LANZAMIENTOS = "nombre_pps";
export const FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS = "estado_convocatoria";
export const FIELD_ESTADO_GESTION_LANZAMIENTOS = "estado_gestion";
export const FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS = "cupos_disponibles";
export const FIELD_ORIENTACION_LANZAMIENTOS = "orientacion";
export const FIELD_FECHA_INICIO_LANZAMIENTOS = "fecha_inicio";
export const FIELD_FECHA_FIN_LANZAMIENTOS = "fecha_finalizacion";
export const FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS = "fecha_relanzamiento";
export const FIELD_DIRECCION_LANZAMIENTOS = "direccion";
export const FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS = "req_certificado_trabajo";
export const FIELD_REQ_CV_LANZAMIENTOS = "req_cv";
export const FIELD_NOTAS_GESTION_LANZAMIENTOS = "notas_gestion";
export const FIELD_HISTORIAL_GESTION_LANZAMIENTOS = "historial_gestion";
export const FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS = "horario_seleccionado";
export const FIELD_HORAS_ACREDITADAS_LANZAMIENTOS = "horas_acreditadas";
export const FIELD_INFORME_LANZAMIENTOS = "informe";
export const FIELD_PERMITE_CERTIFICADO_LANZAMIENTOS = "permite_certificado";
export const FIELD_CODIGO_CAMPUS_LANZAMIENTOS = "codigo_tarjeta_campus";
export const FIELD_TELEFONO_INSTITUCION_LANZAMIENTOS = "telefono"; // Virtual field often
export const FIELD_PLANTILLA_SEGURO_LANZAMIENTOS = "plantilla_seguro_url";
export const FIELD_DURACION_INSCRIPCION_DIAS_LANZAMIENTOS = "plazo_inscripcion_dias";
export const FIELD_DESCRIPCION_LANZAMIENTOS = "descripcion_larga";
export const FIELD_ACTIVIDADES_LANZAMIENTOS = "actividades_lista";
export const FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS = "requisito_obligatorio";
export const FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS = "actividades_label";
export const FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS = "fecha_inicio_inscripcion";
export const FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS = "fecha_fin_inscripcion";
export const FIELD_FECHA_PUBLICACION_LANZAMIENTOS = "fecha_publicacion";
export const FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS = "mensaje_whatsapp";
export const FIELD_HORARIOS_FIJOS_LANZAMIENTOS = "horarios_fijos";
export const FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS = "fecha_encuentro_inicial";
export const FIELD_AIRTABLE_ID = "airtable_id";

// Convocatorias
export const FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS = "estado_inscripcion";
export const FIELD_INFORME_SUBIDO_CONVOCATORIAS = "informe_subido";
export const FIELD_HORARIO_FORMULA_CONVOCATORIAS = "horario_seleccionado";
export const FIELD_HORARIO_ASIGNADO_CONVOCATORIAS = "horario_asignado";
export const FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS = "estudiante_id";
export const FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS = "lanzamiento_id";
export const FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS = "fecha_entrega_informe";
export const FIELD_NOMBRE_PPS_CONVOCATORIAS = "nombre_pps";
export const FIELD_FECHA_INICIO_CONVOCATORIAS = "fecha_inicio";
export const FIELD_FECHA_FIN_CONVOCATORIAS = "fecha_finalizacion";
export const FIELD_DIRECCION_CONVOCATORIAS = "direccion";
export const FIELD_ORIENTACION_CONVOCATORIAS = "orientacion";
export const FIELD_HORAS_ACREDITADAS_CONVOCATORIAS = "horas_acreditadas";
export const FIELD_CUPOS_DISPONIBLES_CONVOCATORIAS = "cupos_disponibles";
export const FIELD_LEGAJO_CONVOCATORIAS = "legajo";
export const FIELD_DNI_CONVOCATORIAS = "dni";
export const FIELD_CORREO_CONVOCATORIAS = "correo";
export const FIELD_FECHA_NACIMIENTO_CONVOCATORIAS = "fecha_nacimiento";
export const FIELD_TELEFONO_CONVOCATORIAS = "telefono";
export const FIELD_TERMINO_CURSAR_CONVOCATORIAS = "termino_cursar";
export const FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS = "cursando_electivas";
export const FIELD_FINALES_ADEUDA_CONVOCATORIAS = "finales_adeuda";
export const FIELD_OTRA_SITUACION_CONVOCATORIAS = "otra_situacion_academica";
export const FIELD_CERTIFICADO_CONVOCATORIAS = "certificado_url";
export const FIELD_TRABAJA_CONVOCATORIAS = "trabaja";
export const FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS = "certificado_trabajo";
export const FIELD_CV_CONVOCATORIAS = "cv_url";

// Solicitudes PPS
export const FIELD_ESTADO_PPS = "estado_seguimiento";
export const FIELD_SOLICITUD_NOMBRE_ALUMNO = "nombre_alumno";
export const FIELD_EMPRESA_PPS_SOLICITUD = "nombre_institucion";
export const FIELD_LEGAJO_PPS = "estudiante_id"; // Link to Student ID
export const FIELD_ULTIMA_ACTUALIZACION_PPS = "actualizacion";
export const FIELD_NOTAS_PPS = "notas";
export const FIELD_SOLICITUD_LEGAJO_ALUMNO = "legajo";
export const FIELD_SOLICITUD_EMAIL_ALUMNO = "email";
export const FIELD_SOLICITUD_ORIENTACION_SUGERIDA = "orientacion_sugerida";
export const FIELD_SOLICITUD_LOCALIDAD = "localidad";
export const FIELD_SOLICITUD_DIRECCION = "direccion_completa";
export const FIELD_SOLICITUD_EMAIL_INSTITUCION = "email_institucion";
export const FIELD_SOLICITUD_TELEFONO_INSTITUCION = "telefono_institucion";
export const FIELD_SOLICITUD_REFERENTE = "referente_institucion";
export const FIELD_SOLICITUD_TIENE_CONVENIO = "convenio_uflo";
export const FIELD_SOLICITUD_TIENE_TUTOR = "tutor_disponible";
export const FIELD_SOLICITUD_CONTACTO_TUTOR = "contacto_tutor";
export const FIELD_SOLICITUD_TIPO_PRACTICA = "tipo_practica";
export const FIELD_SOLICITUD_DESCRIPCION = "descripcion_institucion";

// Auth
export const FIELD_LEGAJO_AUTH = "legajo";
export const FIELD_NOMBRE_AUTH = "nombre";
export const FIELD_PASSWORD_HASH_AUTH = "password_hash";
export const FIELD_SALT_AUTH = "salt";
export const FIELD_ROLE_AUTH = "role";
export const FIELD_ORIENTACIONES_AUTH = "orientaciones";

// Instituciones
export const FIELD_NOMBRE_INSTITUCIONES = "nombre";
export const FIELD_TELEFONO_INSTITUCIONES = "telefono";
export const FIELD_DIRECCION_INSTITUCIONES = "direccion";
export const FIELD_CONVENIO_NUEVO_INSTITUCIONES = "convenio_nuevo";
export const FIELD_TUTOR_INSTITUCIONES = "tutor";
export const FIELD_CODIGO_CAMPUS_INSTITUCIONES = "codigo_tarjeta_campus";
export const FIELD_ORIENTACIONES_INSTITUCIONES = "orientaciones";
export const FIELD_LOGO_URL_INSTITUCIONES = "logo_url";
export const FIELD_LOGO_INVERT_DARK_INSTITUCIONES = "logo_invert_dark";

// Finalizacion
export const FIELD_ESTUDIANTE_FINALIZACION = "estudiante_id";
export const FIELD_FECHA_SOLICITUD_FINALIZACION = "fecha_solicitud";
export const FIELD_ESTADO_FINALIZACION = "estado";
export const FIELD_INFORME_FINAL_FINALIZACION = "informe_final_url";
export const FIELD_PLANILLA_HORAS_FINALIZACION = "planilla_horas_url";
export const FIELD_PLANILLA_ASISTENCIA_FINALIZACION = "planilla_asistencia_url";
export const FIELD_SUGERENCIAS_MEJORAS_FINALIZACION = "sugerencias_mejoras";

// Penalizaciones
export const FIELD_PENALIZACION_ESTUDIANTE_LINK = "estudiante_id";
export const FIELD_PENALIZACION_TIPO = "tipo_incumplimiento";
export const FIELD_PENALIZACION_FECHA = "fecha_incidente";
export const FIELD_PENALIZACION_NOTAS = "notas";
export const FIELD_PENALIZACION_PUNTAJE = "puntaje_penalizacion";
export const FIELD_PENALIZACION_CONVOCATORIA_LINK = "convocatoria_afectada";

// Orientaciones
export const ALL_ORIENTACIONES = ["Clinica", "Educacional", "Laboral", "Comunitaria"] as const;
