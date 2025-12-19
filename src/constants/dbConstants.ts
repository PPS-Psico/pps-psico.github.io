
// Table Names (Mapped to Supabase SQL Tables)
export const TABLE_NAME_PPS = 'solicitudes_pps' as const;
export const TABLE_NAME_PRACTICAS = 'practicas' as const;
export const TABLE_NAME_ESTUDIANTES = 'estudiantes' as const;
export const TABLE_NAME_AUTH_USERS = 'auth_users' as const; // View or Table
export const TABLE_NAME_LANZAMIENTOS_PPS = 'lanzamientos_pps' as const;
export const TABLE_NAME_CONVOCATORIAS = 'convocatorias' as const;
export const TABLE_NAME_INSTITUCIONES = 'instituciones' as const;
export const TABLE_NAME_FINALIZACION = 'finalizacion_pps' as const;
export const TABLE_NAME_PENALIZACIONES = 'penalizaciones' as const;

// --- DB COLUMN NAMES (PostgreSQL Actual Columns) ---
export const COL_ID = 'id';
export const COL_CREATED_AT = 'created_at';

// --- UI FIELD KEYS (Unified with DB Columns) ---

// Estudiantes
export const FIELD_LEGAJO_ESTUDIANTES = 'legajo';
export const FIELD_NOMBRE_ESTUDIANTES = 'nombre';
export const FIELD_NOMBRE_SEPARADO_ESTUDIANTES = 'nombre_separado';
export const FIELD_APELLIDO_SEPARADO_ESTUDIANTES = 'apellido_separado';
export const FIELD_GENERO_ESTUDIANTES = 'genero';
export const FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES = 'orientacion_elegida';
export const FIELD_DNI_ESTUDIANTES = 'dni';
export const FIELD_FECHA_NACIMIENTO_ESTUDIANTES = 'fecha_nacimiento';
export const FIELD_CORREO_ESTUDIANTES = 'correo';
export const FIELD_TELEFONO_ESTUDIANTES = 'telefono';
export const FIELD_NOTAS_INTERNAS_ESTUDIANTES = 'notas_internas';
export const FIELD_FECHA_FINALIZACION_ESTUDIANTES = 'fecha_finalizacion';
export const FIELD_FINALIZARON_ESTUDIANTES = 'finalizaron';
export const FIELD_USER_ID_ESTUDIANTES = 'user_id';
export const FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES = 'must_change_password';
export const FIELD_ROLE_ESTUDIANTES = 'role';
export const FIELD_TRABAJA_ESTUDIANTES = 'trabaja'; // Added
export const FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES = 'certificado_trabajo'; // Added

// Prácticas
export const FIELD_NOMBRE_BUSQUEDA_PRACTICAS = 'legajo_busqueda'; // Optional helper column if needed
export const FIELD_ESTUDIANTE_LINK_PRACTICAS = 'estudiante_id';
export const FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS = 'nombre_institucion'; 
export const FIELD_HORAS_PRACTICAS = 'horas_realizadas';
export const FIELD_FECHA_INICIO_PRACTICAS = 'fecha_inicio';
export const FIELD_FECHA_FIN_PRACTICAS = 'fecha_finalizacion';
export const FIELD_ESTADO_PRACTICA = 'estado';
export const FIELD_ESPECIALIDAD_PRACTICAS = 'especialidad';
export const FIELD_NOTA_PRACTICAS = 'nota';
export const FIELD_LANZAMIENTO_VINCULADO_PRACTICAS = 'lanzamiento_id';
export const FIELD_INSTITUCION_LINK_PRACTICAS = 'institucion_id'; // Optional

// Solicitud de PPS
export const FIELD_EMPRESA_PPS_SOLICITUD = 'nombre_institucion';
export const FIELD_ESTADO_PPS = 'estado_seguimiento';
export const FIELD_ULTIMA_ACTUALIZACION_PPS = 'actualizacion';
export const FIELD_NOTAS_PPS = 'notas';
export const FIELD_LEGAJO_PPS = 'estudiante_id';
export const FIELD_SOLICITUD_LEGAJO_ALUMNO = 'legajo';
export const FIELD_SOLICITUD_NOMBRE_ALUMNO = 'nombre_alumno';
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

// AuthUsers (If view exists)
export const FIELD_LEGAJO_AUTH = 'legajo';
export const FIELD_NOMBRE_AUTH = 'nombre';
export const FIELD_PASSWORD_HASH_AUTH = 'password_hash';
export const FIELD_SALT_AUTH = 'salt';
export const FIELD_ROLE_AUTH = 'role';
export const FIELD_ORIENTACIONES_AUTH = 'orientaciones';

// Lanzamientos de PPS
export const FIELD_NOMBRE_PPS_LANZAMIENTOS = 'nombre_pps';
export const FIELD_FECHA_INICIO_LANZAMIENTOS = 'fecha_inicio';
export const FIELD_FECHA_FIN_LANZAMIENTOS = 'fecha_finalizacion';
export const FIELD_DIRECCION_LANZAMIENTOS = 'direccion';
export const FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS = 'horario_seleccionado';
export const FIELD_ORIENTACION_LANZAMIENTOS = 'orientacion';
export const FIELD_HORAS_ACREDITADAS_LANZAMIENTOS = 'horas_acreditadas';
export const FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS = 'cupos_disponibles';
export const FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS = 'estado_convocatoria';
export const FIELD_DURACION_INSCRIPCION_DIAS_LANZAMIENTOS = 'plazo_inscripcion_dias';
export const FIELD_PLANTILLA_SEGURO_LANZAMIENTOS = 'plantilla_seguro_url';
export const FIELD_INFORME_LANZAMIENTOS = 'informe';
export const FIELD_ESTADO_GESTION_LANZAMIENTOS = 'estado_gestion';
export const FIELD_NOTAS_GESTION_LANZAMIENTOS = 'notas_gestion';
export const FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS = 'fecha_relanzamiento';
export const FIELD_TELEFONO_INSTITUCION_LANZAMIENTOS = 'telefono'; 
export const FIELD_PERMITE_CERTIFICADO_LANZAMIENTOS = 'permite_certificado';
export const FIELD_AIRTABLE_ID = 'airtable_id';
export const FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS = 'req_certificado_trabajo'; // Added
export const FIELD_REQ_CV_LANZAMIENTOS = 'req_cv'; // Added
export const FIELD_CODIGO_CAMPUS_LANZAMIENTOS = 'codigo_tarjeta_campus'; // Added

// Instituciones
export const FIELD_NOMBRE_INSTITUCIONES = 'nombre';
export const FIELD_TELEFONO_INSTITUCIONES = 'telefono';
export const FIELD_DIRECCION_INSTITUCIONES = 'direccion';
export const FIELD_CONVENIO_NUEVO_INSTITUCIONES = 'convenio_nuevo';
export const FIELD_TUTOR_INSTITUCIONES = 'tutor';
export const FIELD_CODIGO_CAMPUS_INSTITUCIONES = 'codigo_tarjeta_campus'; // Added

// Convocatorias
export const FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS = 'lanzamiento_id';
export const FIELD_NOMBRE_PPS_CONVOCATORIAS = 'nombre_pps'; // Helper from JOIN
export const FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS = 'estudiante_id';
export const FIELD_FECHA_INICIO_CONVOCATORIAS = 'fecha_inicio'; // Helper
export const FIELD_FECHA_FIN_CONVOCATORIAS = 'fecha_finalizacion'; // Helper
export const FIELD_DIRECCION_CONVOCATORIAS = 'direccion'; // Helper
export const FIELD_HORARIO_FORMULA_CONVOCATORIAS = 'horario_seleccionado';
export const FIELD_HORAS_ACREDITADAS_CONVOCATORIAS = 'horas_acreditadas'; // Helper
export const FIELD_CUPOS_DISPONIBLES_CONVOCATORIAS = 'cupos_disponibles'; // Helper
export const FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS = 'estado_inscripcion';
export const FIELD_ORIENTACION_CONVOCATORIAS = 'orientacion'; // Helper
export const FIELD_TERMINO_CURSAR_CONVOCATORIAS = 'termino_cursar';
export const FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS = 'cursando_electivas';
export const FIELD_FINALES_ADEUDA_CONVOCATORIAS = 'finales_adeuda';
export const FIELD_OTRA_SITUACION_CONVOCATORIAS = 'otra_situacion_academica';
export const FIELD_LEGAJO_CONVOCATORIAS = 'legajo'; // Helper
export const FIELD_DNI_CONVOCATORIAS = 'dni'; // Helper
export const FIELD_CORREO_CONVOCATORIAS = 'correo'; // Helper
export const FIELD_FECHA_NACIMIENTO_CONVOCATORIAS = 'fecha_nacimiento'; // Helper
export const FIELD_TELEFONO_CONVOCATORIAS = 'telefono'; // Helper
export const FIELD_INFORME_SUBIDO_CONVOCATORIAS = 'informe_subido';
export const FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS = 'fecha_entrega_informe';
export const FIELD_CERTIFICADO_CONVOCATORIAS = 'certificado_url';
export const FIELD_TRABAJA_CONVOCATORIAS = 'trabaja'; // Added
export const FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS = 'certificado_trabajo'; // Added
export const FIELD_CV_CONVOCATORIAS = 'cv_url'; // Added

// Finalizacion PPS
export const FIELD_ESTUDIANTE_FINALIZACION = 'estudiante_id';
export const FIELD_FECHA_SOLICITUD_FINALIZACION = 'fecha_solicitud';
export const FIELD_ESTADO_FINALIZACION = 'estado';
export const FIELD_INFORME_FINAL_FINALIZACION = 'informe_final_url';
export const FIELD_PLANILLA_HORAS_FINALIZACION = 'planilla_horas_url';
export const FIELD_PLANILLA_ASISTENCIA_FINALIZACION = 'planilla_asistencia_url';
export const FIELD_SUGERENCIAS_MEJORAS_FINALIZACION = 'sugerencias_mejoras';

// Historial de Penalizaciones
export const FIELD_PENALIZACION_ESTUDIANTE_LINK = 'estudiante_id';
export const FIELD_PENALIZACION_TIPO = 'tipo_incumplimiento';
export const FIELD_PENALIZACION_NOTAS = 'notas';
export const FIELD_PENALIZACION_FECHA = 'fecha_incidente';
export const FIELD_PENALIZACION_PUNTAJE = 'puntaje_penalizacion';
export const FIELD_PENALIZACION_CONVOCATORIA_LINK = 'convocatoria_afectada';
