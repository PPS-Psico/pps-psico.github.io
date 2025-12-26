
// Table Names
export const TABLE_PPS = 'solicitudes_pps';
export const TABLE_PRACTICAS = 'practicas';
export const TABLE_ESTUDIANTES = 'estudiantes';
export const TABLE_AUTH_USERS = 'auth_users';
export const TABLE_LANZAMIENTOS = 'lanzamientos_pps';
export const TABLE_CONVOCATORIAS = 'convocatorias';
export const TABLE_INSTITUCIONES = 'instituciones';
export const TABLE_FINALIZACION = 'finalizacion_pps';
export const TABLE_PENALIZACIONES = 'penalizaciones';

// Legacy Aliases for Tables
export const TABLE_NAME_PPS = TABLE_PPS;
export const TABLE_NAME_PRACTICAS = TABLE_PRACTICAS;
export const TABLE_NAME_ESTUDIANTES = TABLE_ESTUDIANTES;
export const TABLE_NAME_AUTH_USERS = TABLE_AUTH_USERS;
export const TABLE_NAME_LANZAMIENTOS_PPS = TABLE_LANZAMIENTOS;
export const TABLE_NAME_CONVOCATORIAS = TABLE_CONVOCATORIAS;
export const TABLE_NAME_INSTITUCIONES = TABLE_INSTITUCIONES;
export const TABLE_NAME_FINALIZACION = TABLE_FINALIZACION;
export const TABLE_NAME_PENALIZACIONES = TABLE_PENALIZACIONES;

// --- DB COLUMN NAMES (Clean Version) ---
export const COL_ID = 'id';
export const COL_CREATED_AT = 'created_at';

// Estudiantes
export const COL_LEGAJO = 'legajo';
export const COL_NOMBRE = 'nombre';
export const COL_NOMBRE_SEPARADO = 'nombre_separado';
export const COL_APELLIDO_SEPARADO = 'apellido_separado';
export const COL_DNI = 'dni';
export const COL_CORREO = 'correo';
export const COL_TELEFONO = 'telefono';
export const COL_ORIENTACION_ELEGIDA = 'orientacion_elegida';
export const COL_ESTADO_ALUMNO = 'estado';
export const COL_USER_ID = 'user_id';
export const COL_NOTAS_INTERNAS = 'notas_internas';

// Prácticas
export const COL_ESTUDIANTE_ID = 'estudiante_id';
export const COL_LANZAMIENTO_ID = 'lanzamiento_id';
export const COL_INSTITUCION_ID = 'institucion_id';
export const COL_HORAS = 'horas_realizadas';
export const COL_NOTA = 'nota';
export const COL_ESTADO_PRACTICA = 'estado';
export const COL_FECHA_INICIO = 'fecha_inicio';
export const COL_FECHA_FIN = 'fecha_finalizacion';
export const COL_ESPECIALIDAD = 'especialidad';
export const COL_NOMBRE_INSTITUCION_TXT = 'nombre_institucion'; // Legacy text field

// Lanzamientos
export const COL_NOMBRE_PPS = 'nombre_pps';
export const COL_ESTADO_CONVOCATORIA = 'estado_convocatoria';
export const COL_ESTADO_GESTION = 'estado_gestion';
export const COL_CUPOS = 'cupos_disponibles';
export const COL_ORIENTACION = 'orientacion';
export const COL_FECHA_RELANZAMIENTO = 'fecha_relanzamiento';
export const COL_DIRECCION = 'direccion';
export const COL_REQ_CERTIFICADO = 'req_certificado_trabajo';
export const COL_REQ_CV = 'req_cv';
export const COL_NOTAS_GESTION = 'notas_gestion';
export const COL_CODIGO_CAMPUS_LANZAMIENTOS = 'codigo_tarjeta_campus';

// Convocatorias (Inscripciones)
export const COL_ESTADO_INSCRIPCION = 'estado_inscripcion';
export const COL_INFORME_SUBIDO = 'informe_subido';
export const COL_HORARIO = 'horario_seleccionado';

// Solicitudes PPS (Autogestión)
export const COL_ESTADO_SEGUIMIENTO = 'estado_seguimiento';
export const COL_NOMBRE_ALUMNO_SOLICITUD = 'nombre_alumno';
export const COL_NOMBRE_INSTITUCION_SOLICITUD = 'nombre_institucion';

// Finalización
export const COL_ESTADO_FINALIZACION = 'estado';

// --- LEGACY ALIASES (Mapping old FIELD_X to new COL_X) ---
// This allows gradual refactoring without breaking the whole app

export const FIELD_LEGAJO_ESTUDIANTES = COL_LEGAJO;
export const FIELD_NOMBRE_ESTUDIANTES = COL_NOMBRE;
export const FIELD_CORREO_ESTUDIANTES = COL_CORREO;
export const FIELD_TELEFONO_ESTUDIANTES = COL_TELEFONO;
export const FIELD_DNI_ESTUDIANTES = COL_DNI;
export const FIELD_ESTADO_ESTUDIANTES = COL_ESTADO_ALUMNO;
export const FIELD_USER_ID_ESTUDIANTES = COL_USER_ID;
export const FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES = COL_ORIENTACION_ELEGIDA;
export const FIELD_NOMBRE_SEPARADO_ESTUDIANTES = COL_NOMBRE_SEPARADO;
export const FIELD_APELLIDO_SEPARADO_ESTUDIANTES = COL_APELLIDO_SEPARADO;
export const FIELD_NOTAS_INTERNAS_ESTUDIANTES = COL_NOTAS_INTERNAS;
export const FIELD_FECHA_NACIMIENTO_ESTUDIANTES = 'fecha_nacimiento';
export const FIELD_GENERO_ESTUDIANTES = 'genero';
export const FIELD_FECHA_FINALIZACION_ESTUDIANTES = 'fecha_finalizacion';
export const FIELD_FINALIZARON_ESTUDIANTES = 'finalizaron';
export const FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES = 'must_change_password';
export const FIELD_ROLE_ESTUDIANTES = 'role';
export const FIELD_TRABAJA_ESTUDIANTES = 'trabaja';
export const FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES = 'certificado_trabajo';

export const FIELD_ESTUDIANTE_LINK_PRACTICAS = COL_ESTUDIANTE_ID;
export const FIELD_LANZAMIENTO_VINCULADO_PRACTICAS = COL_LANZAMIENTO_ID;
export const FIELD_INSTITUCION_LINK_PRACTICAS = COL_INSTITUCION_ID;
export const FIELD_HORAS_PRACTICAS = COL_HORAS;
export const FIELD_NOTA_PRACTICAS = COL_NOTA;
export const FIELD_ESTADO_PRACTICA = COL_ESTADO_PRACTICA;
export const FIELD_FECHA_INICIO_PRACTICAS = COL_FECHA_INICIO;
export const FIELD_FECHA_FIN_PRACTICAS = COL_FECHA_FIN;
export const FIELD_ESPECIALIDAD_PRACTICAS = COL_ESPECIALIDAD;
export const FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS = COL_NOMBRE_INSTITUCION_TXT;
export const FIELD_NOMBRE_BUSQUEDA_PRACTICAS = 'legajo_busqueda'; // Deprecated

export const FIELD_NOMBRE_PPS_LANZAMIENTOS = COL_NOMBRE_PPS;
export const FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS = COL_ESTADO_CONVOCATORIA;
export const FIELD_ESTADO_GESTION_LANZAMIENTOS = COL_ESTADO_GESTION;
export const FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS = COL_CUPOS;
export const FIELD_ORIENTACION_LANZAMIENTOS = COL_ORIENTACION;
export const FIELD_FECHA_INICIO_LANZAMIENTOS = COL_FECHA_INICIO;
export const FIELD_FECHA_FIN_LANZAMIENTOS = COL_FECHA_FIN;
export const FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS = COL_FECHA_RELANZAMIENTO;
export const FIELD_DIRECCION_LANZAMIENTOS = COL_DIRECCION;
export const FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS = COL_REQ_CERTIFICADO;
export const FIELD_REQ_CV_LANZAMIENTOS = COL_REQ_CV;
export const FIELD_NOTAS_GESTION_LANZAMIENTOS = COL_NOTAS_GESTION;
export const FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS = 'horario_seleccionado';
export const FIELD_HORAS_ACREDITADAS_LANZAMIENTOS = 'horas_acreditadas';
export const FIELD_INFORME_LANZAMIENTOS = 'informe';
export const FIELD_PERMITE_CERTIFICADO_LANZAMIENTOS = 'permite_certificado';
export const FIELD_CODIGO_CAMPUS_LANZAMIENTOS = COL_CODIGO_CAMPUS_LANZAMIENTOS;
export const FIELD_TELEFONO_INSTITUCION_LANZAMIENTOS = 'telefono';
export const FIELD_PLANTILLA_SEGURO_LANZAMIENTOS = 'plantilla_seguro_url';
export const FIELD_DURACION_INSCRIPCION_DIAS_LANZAMIENTOS = 'plazo_inscripcion_dias';
export const FIELD_AIRTABLE_ID = 'airtable_id';

export const FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS = COL_ESTADO_INSCRIPCION;
export const FIELD_INFORME_SUBIDO_CONVOCATORIAS = COL_INFORME_SUBIDO;
export const FIELD_HORARIO_FORMULA_CONVOCATORIAS = COL_HORARIO;
export const FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS = COL_ESTUDIANTE_ID;
export const FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS = COL_LANZAMIENTO_ID;
export const FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS = 'fecha_entrega_informe';
export const FIELD_NOMBRE_PPS_CONVOCATORIAS = 'nombre_pps';
export const FIELD_FECHA_INICIO_CONVOCATORIAS = 'fecha_inicio';
export const FIELD_FECHA_FIN_CONVOCATORIAS = 'fecha_finalizacion';
export const FIELD_DIRECCION_CONVOCATORIAS = 'direccion';
export const FIELD_ORIENTACION_CONVOCATORIAS = 'orientacion';
export const FIELD_HORAS_ACREDITADAS_CONVOCATORIAS = 'horas_acreditadas';
export const FIELD_CUPOS_DISPONIBLES_CONVOCATORIAS = 'cupos_disponibles';
export const FIELD_LEGAJO_CONVOCATORIAS = 'legajo';
export const FIELD_DNI_CONVOCATORIAS = 'dni';
export const FIELD_CORREO_CONVOCATORIAS = 'correo';
export const FIELD_FECHA_NACIMIENTO_CONVOCATORIAS = 'fecha_nacimiento';
export const FIELD_TELEFONO_CONVOCATORIAS = 'telefono';
export const FIELD_TERMINO_CURSAR_CONVOCATORIAS = 'termino_cursar';
export const FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS = 'cursando_electivas';
export const FIELD_FINALES_ADEUDA_CONVOCATORIAS = 'finales_adeuda';
export const FIELD_OTRA_SITUACION_CONVOCATORIAS = 'otra_situacion_academica';
export const FIELD_CERTIFICADO_CONVOCATORIAS = 'certificado_url';
export const FIELD_TRABAJA_CONVOCATORIAS = 'trabaja';
export const FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS = 'certificado_trabajo';
export const FIELD_CV_CONVOCATORIAS = 'cv_url';

export const FIELD_ESTADO_PPS = COL_ESTADO_SEGUIMIENTO;
export const FIELD_SOLICITUD_NOMBRE_ALUMNO = COL_NOMBRE_ALUMNO_SOLICITUD;
export const FIELD_EMPRESA_PPS_SOLICITUD = COL_NOMBRE_INSTITUCION_SOLICITUD;
export const FIELD_LEGAJO_PPS = COL_ESTUDIANTE_ID;
export const FIELD_ULTIMA_ACTUALIZACION_PPS = 'actualizacion';
export const FIELD_NOTAS_PPS = 'notas';
export const FIELD_SOLICITUD_LEGAJO_ALUMNO = 'legajo';
export const FIELD_SOLICITUD_EMAIL_ALUMNO = 'email';
export const FIELD_SOLICITUD_ORIENTACION_SUGERIDA = 'orientacion_sugerida';
export const FIELD_SOLICITUD_LOCALIDAD = 'localidad';
export const FIELD_SOLICITUD_DIRECCION = 'direccion_completa';
export const FIELD_SOLICITUD_EMAIL_INSTITUCION = 'email_institucion';
export const FIELD_SOLICITUD_TELEFONO_INSTITUCION = 'telefono_institucion';
export const FIELD_SOLICITUD_REFERENTE = 'referente_institucion';
export const FIELD_SOLICITUD_TIENE_CONVENIO = 'convenio_uflo';
export const FIELD_SOLICITUD_TIENE_TUTOR = 'tutor_disponible';
export const FIELD_SOLICITUD_CONTACTO_TUTOR = 'contacto_tutor';
export const FIELD_SOLICITUD_TIPO_PRACTICA = 'tipo_practica';
export const FIELD_SOLICITUD_DESCRIPCION = 'descripcion_institucion';

// Auth
export const FIELD_LEGAJO_AUTH = 'legajo';
export const FIELD_NOMBRE_AUTH = 'nombre';
export const FIELD_PASSWORD_HASH_AUTH = 'password_hash';
export const FIELD_SALT_AUTH = 'salt';
export const FIELD_ROLE_AUTH = 'role';
export const FIELD_ORIENTACIONES_AUTH = 'orientaciones';

// Instituciones
export const FIELD_NOMBRE_INSTITUCIONES = 'nombre';
export const FIELD_TELEFONO_INSTITUCIONES = 'telefono';
export const FIELD_DIRECCION_INSTITUCIONES = 'direccion';
export const FIELD_CONVENIO_NUEVO_INSTITUCIONES = 'convenio_nuevo';
export const FIELD_TUTOR_INSTITUCIONES = 'tutor';
export const FIELD_CODIGO_CAMPUS_INSTITUCIONES = COL_CODIGO_CAMPUS_LANZAMIENTOS; // Map to same constant if used in institutional templates
export const FIELD_ORIENTACIONES_INSTITUCIONES = 'orientaciones';

// Finalizacion
export const FIELD_ESTUDIANTE_FINALIZACION = 'estudiante_id';
export const FIELD_FECHA_SOLICITUD_FINALIZACION = 'fecha_solicitud';
export const FIELD_ESTADO_FINALIZACION = COL_ESTADO_FINALIZACION;
export const FIELD_INFORME_FINAL_FINALIZACION = 'informe_final_url';
export const FIELD_PLANILLA_HORAS_FINALIZACION = 'planilla_horas_url';
export const FIELD_PLANILLA_ASISTENCIA_FINALIZACION = 'planilla_asistencia_url';
export const FIELD_SUGERENCIAS_MEJORAS_FINALIZACION = 'sugerencias_mejoras';

// Penalizaciones
export const FIELD_PENALIZACION_ESTUDIANTE_LINK = 'estudiante_id';
export const FIELD_PENALIZACION_TIPO = 'tipo_incumplimiento';
export const FIELD_PENALIZACION_FECHA = 'fecha_incidente';
export const FIELD_PENALIZACION_NOTAS = 'notas';
export const FIELD_PENALIZACION_PUNTAJE = 'puntaje_penalizacion';
export const FIELD_PENALIZACION_CONVOCATORIA_LINK = 'convocatoria_afectada';
