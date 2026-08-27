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
export const TABLE_COMPROMISOS_PPS = "compromisos_pps";
export const TABLE_CONVENIOS = "convenios";
export const TABLE_ANALYTICS_HEALTH_CHECKS = "analytics_health_checks";
export const TABLE_LANZAMIENTO_OPCIONES = "lanzamiento_opciones";
export const TABLE_CONVOCATORIA_PREFERENCIAS = "convocatoria_preferencias";

// Tablas que se venian usando como string suelto en los `.from(...)`.
// Verificadas contra `information_schema` el 2026-08-22; las PPS especiales se
// agregaron el 2026-08-27.
export const TABLE_AGENT_SUGGESTIONS = "agent_suggestions";
export const TABLE_AGENT_AUDIT_LOG = "agent_audit_log";
export const TABLE_APP_CONFIG = "app_config";
export const TABLE_AULA_ENTREGAS = "aula_entregas";
export const TABLE_EMAIL_TEMPLATES = "email_templates";
export const TABLE_GMAIL_HILOS = "gmail_hilos";
export const TABLE_INSTITUCION_RESUMEN = "institucion_resumen";
export const TABLE_LANZAMIENTO_MOODLE_TAREAS = "lanzamiento_moodle_tareas";
export const TABLE_LANZAMIENTO_OPCION_HORARIOS = "lanzamiento_opcion_horarios";
export const TABLE_MOODLE_GRADE_REOPEN_EVENTS = "moodle_grade_reopen_events";
export const TABLE_MOODLE_GRADE_SNAPSHOTS = "moodle_grade_snapshots";
export const TABLE_PRACTICA_MOODLE_TAREAS = "practica_moodle_tareas";
export const TABLE_SPECIAL_PPS_ASSIGNMENTS = "special_pps_assignments";
export const TABLE_SPECIAL_PPS_TASK_CATALOG = "special_pps_task_catalog";
export const TABLE_REMINDERS = "reminders";
export const TABLE_WHATSAPP_CONTACTOS = "whatsapp_contactos";
export const TABLE_WHATSAPP_MENSAJES = "whatsapp_mensajes";

// PPS especiales
export const FIELD_ACTIVITY_TYPE_SPECIAL_PPS = "activity_type";
export const FIELD_ACADEMIC_YEAR_SPECIAL_PPS = "academic_year";
export const FIELD_ENABLED_SPECIAL_PPS = "enabled";
export const FIELD_ORIENTATION_KEY_SPECIAL_PPS = "orientation_key";
export const FIELD_STATUS_SPECIAL_PPS = "status";

// Buckets de Storage. NO son tablas: van por `supabase.storage.from(...)`.
// Estaban mezclados con los nombres de tabla porque ambos se escriben igual
// en el codigo, y tratarlos como lo mismo lleva a errores dificiles de ver.
export const BUCKET_DOCUMENTOS_ESTUDIANTES = "documentos_estudiantes";
export const BUCKET_DOCUMENTOS_PPS = "documentos_pps";
export const BUCKET_DOCUMENTOS_SEGUROS = "documentos_seguros";
export const BUCKET_DOCUMENTOS_FINALIZACION = "documentos_finalizacion";
export const BUCKET_DOCUMENTOS_CONVENIOS = "documentos_convenios";

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
export const TABLE_NAME_COMPROMISOS_PPS = TABLE_COMPROMISOS_PPS;
export const TABLE_NAME_ANALYTICS_HEALTH_CHECKS = TABLE_ANALYTICS_HEALTH_CHECKS;

// Analytics health checks
export const FIELD_ID_ANALYTICS_HEALTH = "id";
export const FIELD_CHECKED_AT_ANALYTICS_HEALTH = "checked_at";
export const FIELD_STATUS_ANALYTICS_HEALTH = "status";
export const FIELD_ISSUE_COUNT_ANALYTICS_HEALTH = "issue_count";
export const FIELD_ISSUES_ANALYTICS_HEALTH = "issues";

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
export const FIELD_INFORME_ESTADO_PRACTICAS = "informe_estado";
export const FIELD_NOTA_MOODLE_PRACTICAS = "nota_moodle";
export const FIELD_NOTA_FUENTE_PRACTICAS = "nota_fuente";
export const FIELD_NOTA_ACTUALIZADA_AT_PRACTICAS = "nota_actualizada_at";
export const FIELD_NOTA_MOODLE_CMID_PRACTICAS = "nota_moodle_cmid";
export const FIELD_ESTADO_PRACTICA = "estado";
export const FIELD_FECHA_INICIO_PRACTICAS = "fecha_inicio";
export const FIELD_FECHA_FIN_PRACTICAS = "fecha_finalizacion";
export const FIELD_ESPECIALIDAD_PRACTICAS = "especialidad";
export const FIELD_ES_ONLINE_PRACTICAS = "es_online";
export const FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS = "nombre_institucion";
export const FIELD_NOMBRE_BUSQUEDA_PRACTICAS = "legajo_busqueda"; // Deprecated? Kept for schema
export const FIELD_TIPO_ACTIVIDAD_PRACTICAS = "tipo_actividad";
export const FIELD_DESAPROBACION_FECHA_PRACTICAS = "desaprobacion_fecha";
export const FIELD_DESAPROBACION_CAUSAS_PRACTICAS = "desaprobacion_causas";
export const FIELD_DESAPROBACION_MOTIVO_PUBLICO_PRACTICAS = "desaprobacion_motivo_publico";
export const FIELD_DESAPROBACION_NOTIFICADO_AT_PRACTICAS = "desaprobacion_notificado_at";

// Lanzamientos
export const FIELD_NOMBRE_PPS_LANZAMIENTOS = "nombre_pps";
export const FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS = "estado_convocatoria";
export const FIELD_ESTADO_GESTION_LANZAMIENTOS = "estado_gestion";
export const FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS = "cupos_disponibles";
export const FIELD_ORIENTACION_LANZAMIENTOS = "orientacion";
export const FIELD_FECHA_INICIO_LANZAMIENTOS = "fecha_inicio";
export const FIELD_FECHA_FIN_LANZAMIENTOS = "fecha_finalizacion";
export const FIELD_FINALIZACION_POR_HORAS_LANZAMIENTOS = "finalizacion_por_horas";
export const FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS = "fecha_relanzamiento";
export const FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS = "proximo_seguimiento";
export const FIELD_DIRECCION_LANZAMIENTOS = "direccion";
export const FIELD_INSTITUCION_LINK_LANZAMIENTOS = "institucion_id";
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
export const FIELD_ARCHIVO_DESCARGABLE_NOMBRE = "archivo_descargable_nombre";
export const FIELD_ARCHIVO_DESCARGABLE_URL = "archivo_descargable_url";
export const FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS = "actividades_label";
export const FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS = "fecha_inicio_inscripcion";
export const FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS = "fecha_fin_inscripcion";
export const FIELD_FECHA_PUBLICACION_LANZAMIENTOS = "fecha_publicacion";
export const FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS = "mensaje_whatsapp";
export const FIELD_HORARIOS_FIJOS_LANZAMIENTOS = "horarios_fijos";
export const FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS = "horarios_obligatorios";
export const FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS = "tipo_actividad";
export const FIELD_MODALIDAD_CUPO_LANZAMIENTOS = "modalidad_cupo";
export const FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS = "fecha_encuentro_inicial";
export const FIELD_SELECTION_CLOSED_AT_LANZAMIENTOS = "selection_closed_at";
export const FIELD_SELECTION_CLOSED_BY_LANZAMIENTOS = "selection_closed_by";
export const FIELD_CONSENTIMIENTO_REQUERIDO_LANZAMIENTOS = "consentimiento_requerido";
// Flujo de aseguramiento: marca persistente de "seguro gestionado" (ver spec flujo-aseguramiento-pps)
export const FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS = "seguro_gestionado_at";
export const FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS = "seguro_gestionado_por";
export const FIELD_LISTA_ESTUDIANTES_ENTREGADA_AT_LANZAMIENTOS = "lista_estudiantes_entregada_at";
export const FIELD_LISTA_ESTUDIANTES_ENTREGADA_POR_LANZAMIENTOS = "lista_estudiantes_entregada_por";
export const FIELD_AIRTABLE_ID = "airtable_id";

// Convocatorias
export const FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS = "estado_inscripcion";
export const FIELD_INFORME_SUBIDO_CONVOCATORIAS = "informe_subido";
export const FIELD_HORARIO_FORMULA_CONVOCATORIAS = "horario_seleccionado";
export const FIELD_HORARIO_ASIGNADO_CONVOCATORIAS = "horario_asignado";
export const FIELD_OPCION_ASIGNADA_CONVOCATORIAS = "opcion_asignada_id";
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
export const FIELD_SELECTED_AT_CONVOCATORIAS = "selected_at";
export const FIELD_SELECTION_DECIDED_AT_CONVOCATORIAS = "selection_decided_at";
export const FIELD_REMINDER_SENT_AT_CONVOCATORIAS = "reminder_sent_at";
export const FIELD_BAJA_AUTOMATICA_AT_CONVOCATORIAS = "baja_automatica_at";
export const FIELD_FINAL_REMINDER_SENT_AT_CONVOCATORIAS = "final_reminder_sent_at";
export const FIELD_FINAL_REMINDER_SENT_BY_CONVOCATORIAS = "final_reminder_sent_by";

// Compromisos PPS
export const FIELD_COMPROMISO_ESTUDIANTE = "estudiante_id";
export const FIELD_COMPROMISO_CONVOCATORIA = "convocatoria_id";
export const FIELD_COMPROMISO_LANZAMIENTO = "lanzamiento_id";
export const FIELD_COMPROMISO_VERSION = "version";
export const FIELD_COMPROMISO_ESTADO = "estado";
export const FIELD_COMPROMISO_TEXTO_ACTA = "texto_acta";
export const FIELD_COMPROMISO_ACEPTA_LECTURA = "acepta_lectura";
export const FIELD_COMPROMISO_ACEPTA_COMPROMISO = "acepta_compromiso";
export const FIELD_COMPROMISO_NOMBRE = "nombre_completo";
export const FIELD_COMPROMISO_DNI = "dni";
export const FIELD_COMPROMISO_LEGAJO = "legajo";
export const FIELD_COMPROMISO_FIRMA = "firma_texto";
export const FIELD_COMPROMISO_FECHA_ACEPTACION = "accepted_at";

// Solicitudes PPS
export const FIELD_ESTADO_PPS = "estado_seguimiento";
export const FIELD_MOTIVO_NO_CONCRECION_PPS = "motivo_no_concrecion";
export const FIELD_MOTIVO_NO_CONCRECION_DETALLE_PPS = "motivo_no_concrecion_detalle";
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

// Solicitudes de modificación / baja de PPS
export const FIELD_SOLICITUD_MODIFICACION_TIPO = "tipo_modificacion";
export const FIELD_SOLICITUD_MODIFICACION_ESTADO = "estado";
export const FIELD_SOLICITUD_MODIFICACION_PRACTICA = "practica_id";
export const FIELD_SOLICITUD_MODIFICACION_MOTIVO_BAJA = "motivo_baja";
export const FIELD_SOLICITUD_MODIFICACION_MOTIVO_BAJA_DETALLE = "motivo_baja_detalle";
export const FIELD_SOLICITUD_MODIFICACION_FECHA_INICIO = "fecha_inicio_snapshot";
export const FIELD_SOLICITUD_MODIFICACION_NOMBRE_PPS = "nombre_pps_snapshot";
export const FIELD_SOLICITUD_MODIFICACION_RESUELTA_AT = "resuelta_at";
export const FIELD_SOLICITUD_MODIFICACION_PENALIZACION = "penalizacion_id";
export const FIELD_SOLICITUD_MODIFICACION_TIPO_PENALIZACION = "tipo_penalizacion_aplicada";
export const FIELD_SOLICITUD_MODIFICACION_PUNTAJE = "puntaje_penalizacion_aplicado";

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

// Convenios
export const FIELD_INSTITUCION_ID_CONVENIOS = "institucion_id";
export const FIELD_TIPO_CONVENIOS = "tipo";
export const FIELD_FECHA_FIRMA_CONVENIOS = "fecha_firma";
export const FIELD_FECHA_VENCIMIENTO_CONVENIOS = "fecha_vencimiento";
export const FIELD_ES_RENOVACION_CONVENIOS = "es_renovacion";
export const FIELD_ARCHIVO_URL_CONVENIOS = "archivo_url";
export const FIELD_NOTAS_CONVENIOS = "notas";

// Finalizacion
export const FIELD_ESTUDIANTE_FINALIZACION = "estudiante_id";
export const FIELD_FECHA_SOLICITUD_FINALIZACION = "fecha_solicitud";
export const FIELD_ESTADO_FINALIZACION = "estado";
export const FIELD_INFORME_FINAL_FINALIZACION = "informe_final_url";
export const FIELD_PLANILLA_HORAS_FINALIZACION = "planilla_horas_url";
export const FIELD_PLANILLA_ASISTENCIA_FINALIZACION = "planilla_asistencia_url";
export const FIELD_SUGERENCIAS_MEJORAS_FINALIZACION = "sugerencias_mejoras";
export const FIELD_DETALLE_PRACTICAS_FINALIZACION = "detalle_practicas";

// Penalizaciones
export const FIELD_PENALIZACION_ESTUDIANTE_LINK = "estudiante_id";
export const FIELD_PENALIZACION_TIPO = "tipo_incumplimiento";
export const FIELD_PENALIZACION_FECHA = "fecha_incidente";
export const FIELD_PENALIZACION_NOTAS = "notas";
export const FIELD_PENALIZACION_PUNTAJE = "puntaje_penalizacion";
export const FIELD_PENALIZACION_CONVOCATORIA_LINK = "convocatoria_afectada";
export const FIELD_PENALIZACION_ESTADO = "estado";
export const FIELD_PENALIZACION_PRACTICA_ID = "practica_id";
export const FIELD_PENALIZACION_CONVOCATORIA_ID = "convocatoria_id";
export const FIELD_PENALIZACION_LANZAMIENTO_ID = "lanzamiento_id";
export const FIELD_PENALIZACION_ANULADA_AT = "anulada_at";
export const FIELD_PENALIZACION_ANULACION_MOTIVO = "anulacion_motivo";

// Orientaciones
export const ALL_ORIENTACIONES = ["Clínica", "Educacional", "Laboral", "Comunitaria"] as const;
