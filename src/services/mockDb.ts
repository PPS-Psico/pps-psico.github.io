import {
  MOCK_ESTUDIANTES,
  MOCK_INSTITUCIONES,
  MOCK_LANZAMIENTOS,
  MOCK_PRACTICAS,
  MOCK_SOLICITUDES,
  MOCK_CONVOCATORIAS,
  MOCK_PENALIZACIONES,
  MOCK_FINALIZACIONES,
} from "../data/mockData";
import {
  FIELD_ESTADO_PPS,
  FIELD_SOLICITUD_NOMBRE_ALUMNO,
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_LEGAJO_PPS,
  FIELD_SOLICITUD_LEGAJO_ALUMNO,
  FIELD_SOLICITUD_EMAIL_ALUMNO,
  FIELD_SOLICITUD_ORIENTACION_SUGERIDA,
  FIELD_SOLICITUD_LOCALIDAD,
  FIELD_SOLICITUD_DIRECCION,
  FIELD_SOLICITUD_EMAIL_INSTITUCION,
  FIELD_SOLICITUD_TELEFONO_INSTITUCION,
  FIELD_SOLICITUD_REFERENTE,
  FIELD_SOLICITUD_TIENE_CONVENIO,
  FIELD_SOLICITUD_TIENE_TUTOR,
  FIELD_SOLICITUD_CONTACTO_TUTOR,
  FIELD_SOLICITUD_TIPO_PRACTICA,
  FIELD_SOLICITUD_DESCRIPCION,
} from "../constants";

// Augmented list of mock students to match Claude's mockup
const DETAILED_MOCK_ESTUDIANTES = [
  ...MOCK_ESTUDIANTES,
  {
    id: "st_sosa",
    legajo: "78421",
    nombre: "Camila Sosa",
    correo: "camila.sosa@uflouni.edu.ar",
    orientacion_elegida: "Clínica",
    finalizaron: false,
  },
  {
    id: "st_ferreyra",
    legajo: "76110",
    nombre: "Tomás Ferreyra",
    correo: "tomas.ferreyra@uflouni.edu.ar",
    orientacion_elegida: "Clínica",
    finalizaron: false,
  },
  {
    id: "st_rios",
    legajo: "79002",
    nombre: "Valentina Ríos",
    correo: "valentina.rios@uflouni.edu.ar",
    orientacion_elegida: "Clínica",
    finalizaron: false,
  },
  {
    id: "st_medina",
    legajo: "77530",
    nombre: "Joaquín Medina",
    correo: "joaquin.medina@uflouni.edu.ar",
    orientacion_elegida: "Comunitaria",
    finalizaron: false,
  },
  {
    id: "st_paz",
    legajo: "78890",
    nombre: "Lucía Paz",
    correo: "lucia.paz@uflouni.edu.ar",
    orientacion_elegida: "Clínica",
    finalizaron: false,
  },
  {
    id: "st_quiroga",
    legajo: "79115",
    nombre: "Martín Quiroga",
    correo: "martin.quiroga@uflouni.edu.ar",
    orientacion_elegida: "Clínica",
    finalizaron: false,
  },
  {
    id: "st_lazarte",
    legajo: "78677",
    nombre: "Sofía Lazarte",
    correo: "sofia.lazarte@uflouni.edu.ar",
    orientacion_elegida: "Comunitaria",
    finalizaron: false,
  },
];

// Rich, detailed solicitudes matching the Claude designer mockup
const DETAILED_MOCK_SOLICITUDES = [
  {
    id: "in-01",
    created_at: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
    [FIELD_SOLICITUD_NOMBRE_ALUMNO]: "Camila Sosa",
    [FIELD_SOLICITUD_LEGAJO_ALUMNO]: "78421",
    [FIELD_SOLICITUD_EMAIL_ALUMNO]: "camila.sosa@uflouni.edu.ar",
    [FIELD_LEGAJO_PPS]: "st_sosa",
    [FIELD_EMPRESA_PPS_SOLICITUD]: "Hospital Borda",
    [FIELD_SOLICITUD_LOCALIDAD]: "Barracas, CABA",
    [FIELD_SOLICITUD_DIRECCION]: "Ramón Carrillo 375",
    [FIELD_SOLICITUD_REFERENTE]: "Dr. Acuña",
    [FIELD_SOLICITUD_EMAIL_INSTITUCION]: "docencia@borda.gob.ar",
    [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: "+54 11 4305-6666",
    [FIELD_SOLICITUD_CONTACTO_TUTOR]: "Lic. P. Aguirre",
    [FIELD_SOLICITUD_TIENE_TUTOR]: "Sí",
    [FIELD_SOLICITUD_TIENE_CONVENIO]: "Sí",
    [FIELD_SOLICITUD_TIPO_PRACTICA]: "Presencial",
    [FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: "Clínica",
    [FIELD_SOLICITUD_DESCRIPCION]:
      "Prácticas en el servicio de psicopatología. Observación de admisiones y participación en ateneos clínicos.",
    [FIELD_ESTADO_PPS]: "Pendiente",
    notas: "",
  },
  {
    id: "in-02",
    created_at: new Date(Date.now() - 9 * 86400 * 1000).toISOString(),
    [FIELD_SOLICITUD_NOMBRE_ALUMNO]: "Tomás Ferreyra",
    [FIELD_SOLICITUD_LEGAJO_ALUMNO]: "76110",
    [FIELD_SOLICITUD_EMAIL_ALUMNO]: "tomas.ferreyra@uflouni.edu.ar",
    [FIELD_LEGAJO_PPS]: "st_ferreyra",
    [FIELD_EMPRESA_PPS_SOLICITUD]: "Comunidad Terapéutica Manantiales",
    [FIELD_SOLICITUD_LOCALIDAD]: "Belgrano, CABA",
    [FIELD_SOLICITUD_DIRECCION]: "Av. Cabildo 1234",
    [FIELD_SOLICITUD_REFERENTE]: "Lic. Soto",
    [FIELD_SOLICITUD_EMAIL_INSTITUCION]: "admision@manantiales.org",
    [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: "+54 11 4787-1100",
    [FIELD_SOLICITUD_CONTACTO_TUTOR]: "Lic. M. Duarte",
    [FIELD_SOLICITUD_TIENE_TUTOR]: "Sí",
    [FIELD_SOLICITUD_TIENE_CONVENIO]: "Sí",
    [FIELD_SOLICITUD_TIPO_PRACTICA]: "Presencial",
    [FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: "Clínica",
    [FIELD_SOLICITUD_DESCRIPCION]:
      "Acompañamiento en dispositivos de internación y seguimiento ambulatorio en adicciones.",
    [FIELD_ESTADO_PPS]: "En conversaciones",
    notas: "Esperando que confirmen cupos para la cohorte de agosto.",
  },
  {
    id: "in-03",
    created_at: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
    [FIELD_SOLICITUD_NOMBRE_ALUMNO]: "Valentina Ríos",
    [FIELD_SOLICITUD_LEGAJO_ALUMNO]: "79002",
    [FIELD_SOLICITUD_EMAIL_ALUMNO]: "valentina.rios@uflouni.edu.ar",
    [FIELD_LEGAJO_PPS]: "st_rios",
    [FIELD_EMPRESA_PPS_SOLICITUD]: "Hospital Gutiérrez",
    [FIELD_SOLICITUD_LOCALIDAD]: "Recoleta, CABA",
    [FIELD_SOLICITUD_DIRECCION]: "Gallo 1330",
    [FIELD_SOLICITUD_REFERENTE]: "María González",
    [FIELD_SOLICITUD_EMAIL_INSTITUCION]: "docencia.psico@gutierrez.gob.ar",
    [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: "+54 11 4962-9200",
    [FIELD_SOLICITUD_CONTACTO_TUTOR]: "Lic. F. Bianchi",
    [FIELD_SOLICITUD_TIENE_TUTOR]: "Sí",
    [FIELD_SOLICITUD_TIENE_CONVENIO]: "Sí",
    [FIELD_SOLICITUD_TIPO_PRACTICA]: "Presencial",
    [FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: "Clínica",
    [FIELD_SOLICITUD_DESCRIPCION]:
      "Prácticas en el servicio de salud mental infantojuvenil. Martes y jueves.",
    [FIELD_ESTADO_PPS]: "Realizando convenio",
    notas: "Convenio en circuito de firma. Falta la contrafirma de rectorado.",
  },
  {
    id: "in-04",
    created_at: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
    [FIELD_SOLICITUD_NOMBRE_ALUMNO]: "Joaquín Medina",
    [FIELD_SOLICITUD_LEGAJO_ALUMNO]: "77530",
    [FIELD_SOLICITUD_EMAIL_ALUMNO]: "joaquin.medina@uflouni.edu.ar",
    [FIELD_LEGAJO_PPS]: "st_medina",
    [FIELD_EMPRESA_PPS_SOLICITUD]: "CESAC Nº 8",
    [FIELD_SOLICITUD_LOCALIDAD]: "La Boca, CABA",
    [FIELD_SOLICITUD_DIRECCION]: "Olavarría 2842",
    [FIELD_SOLICITUD_REFERENTE]: "Lic. Verónica P.",
    [FIELD_SOLICITUD_EMAIL_INSTITUCION]: "",
    [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: "+54 11 4302-9988",
    [FIELD_SOLICITUD_CONTACTO_TUTOR]: "",
    [FIELD_SOLICITUD_TIENE_TUTOR]: "No",
    [FIELD_SOLICITUD_TIENE_CONVENIO]: "No",
    [FIELD_SOLICITUD_TIPO_PRACTICA]: "Presencial",
    [FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: "Comunitaria",
    [FIELD_SOLICITUD_DESCRIPCION]:
      "Atención primaria en salud mental comunitaria. Lunes y miércoles.",
    [FIELD_ESTADO_PPS]: "En conversaciones",
    notas: "",
  },
  {
    id: "in-05",
    created_at: new Date(Date.now() - 8 * 86400 * 1000).toISOString(),
    [FIELD_SOLICITUD_NOMBRE_ALUMNO]: "Lucía Paz",
    [FIELD_SOLICITUD_LEGAJO_ALUMNO]: "78890",
    [FIELD_SOLICITUD_EMAIL_ALUMNO]: "lucia.paz@uflouni.edu.ar",
    [FIELD_LEGAJO_PPS]: "st_paz",
    [FIELD_EMPRESA_PPS_SOLICITUD]: "Centro Liens",
    [FIELD_SOLICITUD_LOCALIDAD]: "Caballito, CABA",
    [FIELD_SOLICITUD_DIRECCION]: "Av. Rivadavia 5200",
    [FIELD_SOLICITUD_REFERENTE]: "Andrea Pereyra",
    [FIELD_SOLICITUD_EMAIL_INSTITUCION]: "info@liens.com.ar",
    [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: "",
    [FIELD_SOLICITUD_CONTACTO_TUTOR]: "Lic. Andrea Pereyra",
    [FIELD_SOLICITUD_TIENE_TUTOR]: "Sí",
    [FIELD_SOLICITUD_TIENE_CONVENIO]: "No",
    [FIELD_SOLICITUD_TIPO_PRACTICA]: "Híbrida",
    [FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: "Clínica",
    [FIELD_SOLICITUD_DESCRIPCION]:
      "Atención psicológica en consultorios externos. Posibilidad de modalidad mixta.",
    [FIELD_ESTADO_PPS]: "Pendiente",
    notas: "",
  },
  {
    id: "in-06",
    created_at: new Date().toISOString(),
    [FIELD_SOLICITUD_NOMBRE_ALUMNO]: "Martín Quiroga",
    [FIELD_SOLICITUD_LEGAJO_ALUMNO]: "79115",
    [FIELD_SOLICITUD_EMAIL_ALUMNO]: "martin.quiroga@uflouni.edu.ar",
    [FIELD_LEGAJO_PPS]: "st_quiroga",
    [FIELD_EMPRESA_PPS_SOLICITUD]: "Hospital Joaquín Castellanos",
    [FIELD_SOLICITUD_LOCALIDAD]: "Güemes, Salta",
    [FIELD_SOLICITUD_DIRECCION]: "Av. San Martín 450",
    [FIELD_SOLICITUD_REFERENTE]: "Dra. L. Cabrera",
    [FIELD_SOLICITUD_EMAIL_INSTITUCION]: "rrhh@hjcastellanos.gob.ar",
    [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: "+54 387 491-2200",
    [FIELD_SOLICITUD_CONTACTO_TUTOR]: "",
    [FIELD_SOLICITUD_TIENE_TUTOR]: "No",
    [FIELD_SOLICITUD_TIENE_CONVENIO]: "No catalogada",
    [FIELD_SOLICITUD_TIPO_PRACTICA]: "Presencial",
    [FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: "Clínica",
    [FIELD_SOLICITUD_DESCRIPCION]:
      "Servicio de salud mental. El alumno es de Salta y propone hacer la práctica allá.",
    [FIELD_ESTADO_PPS]: "Pendiente",
    notas: "",
  },
  {
    id: "in-07",
    created_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    [FIELD_SOLICITUD_NOMBRE_ALUMNO]: "Sofía Lazarte",
    [FIELD_SOLICITUD_LEGAJO_ALUMNO]: "78677",
    [FIELD_SOLICITUD_EMAIL_ALUMNO]: "sofia.lazarte@uflouni.edu.ar",
    [FIELD_LEGAJO_PPS]: "st_lazarte",
    [FIELD_EMPRESA_PPS_SOLICITUD]: "Fundación Makarios",
    [FIELD_SOLICITUD_LOCALIDAD]: "San Isidro, Bs. As.",
    [FIELD_SOLICITUD_DIRECCION]: "Belgrano 1500",
    [FIELD_SOLICITUD_REFERENTE]: "",
    [FIELD_SOLICITUD_EMAIL_INSTITUCION]: "",
    [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: "+54 11 4747-8080",
    [FIELD_SOLICITUD_CONTACTO_TUTOR]: "",
    [FIELD_SOLICITUD_TIENE_TUTOR]: "No",
    [FIELD_SOLICITUD_TIENE_CONVENIO]: "No catalogada",
    [FIELD_SOLICITUD_TIPO_PRACTICA]: "Presencial",
    [FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: "Comunitaria",
    [FIELD_SOLICITUD_DESCRIPCION]:
      "ONG de acompañamiento social. El alumno hace voluntariado allí y propone formalizar la PPS.",
    [FIELD_ESTADO_PPS]: "Pendiente",
    notas: "",
  },
  {
    id: "in-08",
    created_at: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
    [FIELD_SOLICITUD_NOMBRE_ALUMNO]: "Bruno Vega",
    [FIELD_SOLICITUD_LEGAJO_ALUMNO]: "75002",
    [FIELD_SOLICITUD_EMAIL_ALUMNO]: "bruno.vega@uflouni.edu.ar",
    [FIELD_LEGAJO_PPS]: "st_3",
    [FIELD_EMPRESA_PPS_SOLICITUD]: "INEBA",
    [FIELD_SOLICITUD_LOCALIDAD]: "Congreso, CABA",
    [FIELD_SOLICITUD_DIRECCION]: "Guardia Vieja 4435",
    [FIELD_SOLICITUD_REFERENTE]: "Dr. Fernández",
    [FIELD_SOLICITUD_EMAIL_INSTITUCION]: "docencia@ineba.net",
    [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: "+54 11 5550-1234",
    [FIELD_SOLICITUD_CONTACTO_TUTOR]: "Lic. R. Mansilla",
    [FIELD_SOLICITUD_TIENE_TUTOR]: "Sí",
    [FIELD_SOLICITUD_TIENE_CONVENIO]: "Sí",
    [FIELD_SOLICITUD_TIPO_PRACTICA]: "Presencial",
    [FIELD_SOLICITUD_ORIENTACION_SUGERIDA]: "Clínica",
    [FIELD_SOLICITUD_DESCRIPCION]: "PPS en el área de neuropsicología e investigación.",
    [FIELD_ESTADO_PPS]: "Realizada",
    notas: "Convenio firmado y cohorte iniciada.",
  },
];

// Demo data for Hermes tracking tables
const INITIAL_WHATSAPP_CONTACTOS = [
  {
    chat_jid: "541143029988@s.whatsapp.net",
    phone: "541143029988",
    nombre_contacto: "CESAC Nº 8",
    tipo: "sin_convenio",
    clasificado_por: "Hermes Auto",
    created_at: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
  },
  {
    chat_jid: "541143056666@s.whatsapp.net",
    phone: "541143056666",
    nombre_contacto: "Hospital Borda",
    tipo: "activo",
    clasificado_por: "manual",
    created_at: new Date(Date.now() - 25 * 86400 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
  },
];

const INITIAL_WHATSAPP_MENSAJES = [
  {
    id: "wa_msg_1",
    chat_jid: "541143056666@s.whatsapp.net",
    from_me: false,
    texto: "Dale Luis, mandame los nombres y coordinamos",
    timestamp: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
  },
  {
    id: "wa_msg_2",
    chat_jid: "541143056666@s.whatsapp.net",
    from_me: true,
    texto: "Genial Dr., le confirmo la semana que viene",
    timestamp: new Date(Date.now() - 2.1 * 86400 * 1000).toISOString(),
  },
  {
    id: "wa_msg_3",
    chat_jid: "541143029988@s.whatsapp.net",
    from_me: false,
    texto: "Sí, tenemos lugar para 2 practicantes",
    timestamp: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
  },
];

const INITIAL_GMAIL_HILOS = [
  {
    thread_id: "gmail_thread_1",
    asunto: "Continuidad PPS 2026 — propuesta de cohorte",
    ultimo_mensaje_at: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
    ultimo_mensaje_de: "nos",
    estado: "esperando_respuesta",
    email_institucion: "docencia@borda.gob.ar",
    participantes: ["docencia@borda.gob.ar", "luis.battaglia@uflouni.edu.ar"],
    ingested_at: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
    clasificacion: "contacto_institucion",
  },
  {
    thread_id: "gmail_thread_2",
    asunto: "RE: Acreditación cohorte anterior — recibido",
    ultimo_mensaje_at: new Date(Date.now() - 21 * 86400 * 1000).toISOString(),
    ultimo_mensaje_de: "ellos",
    estado: "leido",
    email_institucion: "docencia@borda.gob.ar",
    participantes: ["docencia@borda.gob.ar", "luis.battaglia@uflouni.edu.ar"],
    ingested_at: new Date(Date.now() - 21 * 86400 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 21 * 86400 * 1000).toISOString(),
    clasificacion: "contacto_institucion",
  },
  {
    thread_id: "gmail_thread_3",
    asunto: "Consulta de continuidad 2026 — ¿retoman este año?",
    ultimo_mensaje_at: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
    ultimo_mensaje_de: "nos",
    estado: "esperando_respuesta",
    email_institucion: "admision@manantiales.org",
    participantes: ["admision@manantiales.org", "luis.battaglia@uflouni.edu.ar"],
    ingested_at: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
    clasificacion: "contacto_institucion",
  },
];

// Propuestas de clasificación de contactos (Hermes) pendientes de validar.
// Alimentan la pestaña "Contactos" de Gestión en modo testing/demo.
const INITIAL_AGENT_SUGGESTIONS = [
  {
    id: "sug_class_1",
    tipo: "clasificacion",
    estado: "pending",
    institucion_id: null,
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    payload: {
      chat_jid: "5491168804455@s.whatsapp.net",
      phone: "5491168804455",
      nombre_contacto: "Fundación Sol Mapu · Agostina",
      tipo: "sin_convenio",
      institucion_id: null,
      confidence: 0.62,
      justificacion:
        "Número nuevo que escribió consultando si tomamos practicantes. No figura en el catálogo ni tiene convenio previo.",
      resumen_patron: "Primer contacto entrante · sin historial previo en la base.",
      evidence_message_ids: ["wa_sug_1a", "wa_sug_1b"],
    },
  },
  {
    id: "sug_class_2",
    tipo: "clasificacion",
    estado: "pending",
    institucion_id: null,
    created_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    payload: {
      chat_jid: "5491159012233@s.whatsapp.net",
      phone: "5491159012233",
      nombre_contacto: "Lic. Soto (Manantiales)",
      tipo: "coordinador_externo",
      institucion_id: null,
      confidence: 0.88,
      justificacion:
        "El mensaje menciona 'coordinación de Manantiales' y coincide con el referente registrado de esa institución.",
      resumen_patron: "Coincide con referente conocido · alta confianza.",
      evidence_message_ids: ["wa_sug_2a"],
    },
  },
  {
    id: "sug_class_3",
    tipo: "clasificacion",
    estado: "pending",
    institucion_id: null,
    created_at: new Date(Date.now() - 50 * 3600 * 1000).toISOString(),
    payload: {
      chat_jid: "5491133224411@s.whatsapp.net",
      phone: "5491133224411",
      nombre_contacto: "Número desconocido",
      tipo: "otro",
      institucion_id: null,
      confidence: 0.34,
      justificacion: "Mensaje breve sin contexto institucional claro. Podría ser personal o spam.",
      resumen_patron: "Sin señales de institución · baja confianza.",
      evidence_message_ids: ["wa_sug_3a"],
    },
  },
];

const INITIAL_WHATSAPP_MENSAJES_CONTEXT = [
  {
    id: "wa_sug_1a",
    chat_jid: "5491168804455@s.whatsapp.net",
    from_me: false,
    texto: "Hola! Somos la Fundación Sol Mapu. ¿Reciben practicantes de psicología este año?",
    timestamp: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
  },
  {
    id: "wa_sug_1b",
    chat_jid: "5491168804455@s.whatsapp.net",
    from_me: true,
    texto: "¡Hola Agostina! Sí, contame un poco de la institución y vemos.",
    timestamp: new Date(Date.now() - 6.5 * 3600 * 1000).toISOString(),
  },
  {
    id: "wa_sug_2a",
    chat_jid: "5491159012233@s.whatsapp.net",
    from_me: false,
    texto: "Buenas, soy Soto de la coordinación de Manantiales. Retomamos la PPS para 2026.",
    timestamp: new Date(Date.now() - 29 * 3600 * 1000).toISOString(),
  },
  {
    id: "wa_sug_3a",
    chat_jid: "5491133224411@s.whatsapp.net",
    from_me: false,
    texto: "hola",
    timestamp: new Date(Date.now() - 51 * 3600 * 1000).toISOString(),
  },
];

// Simulación de base de datos en memoria (Singleton)
class MockDatabase {
  public data: any = {
    estudiantes: [...DETAILED_MOCK_ESTUDIANTES],
    instituciones: [...MOCK_INSTITUCIONES],
    lanzamientos_pps: [...MOCK_LANZAMIENTOS],
    practicas: [...MOCK_PRACTICAS],
    solicitudes_pps: [...DETAILED_MOCK_SOLICITUDES],
    convocatorias: [...MOCK_CONVOCATORIAS],
    penalizaciones: [...MOCK_PENALIZACIONES],
    finalizacion_pps: [...MOCK_FINALIZACIONES],
    whatsapp_contactos: [...INITIAL_WHATSAPP_CONTACTOS],
    whatsapp_mensajes: [...INITIAL_WHATSAPP_MENSAJES, ...INITIAL_WHATSAPP_MENSAJES_CONTEXT],
    gmail_hilos: [...INITIAL_GMAIL_HILOS],
    agent_suggestions: [...INITIAL_AGENT_SUGGESTIONS],
  };

  // Resetear a estado inicial (útil para tests o logout si quisiéramos)
  reset() {
    this.data = {
      estudiantes: [...DETAILED_MOCK_ESTUDIANTES],
      instituciones: [...MOCK_INSTITUCIONES],
      lanzamientos_pps: [...MOCK_LANZAMIENTOS],
      practicas: [...MOCK_PRACTICAS],
      solicitudes_pps: [...DETAILED_MOCK_SOLICITUDES],
      convocatorias: [...MOCK_CONVOCATORIAS],
      penalizaciones: [...MOCK_PENALIZACIONES],
      finalizacion_pps: [...MOCK_FINALIZACIONES],
      whatsapp_contactos: [...INITIAL_WHATSAPP_CONTACTOS],
      whatsapp_mensajes: [...INITIAL_WHATSAPP_MENSAJES, ...INITIAL_WHATSAPP_MENSAJES_CONTEXT],
      gmail_hilos: [...INITIAL_GMAIL_HILOS],
      agent_suggestions: [...INITIAL_AGENT_SUGGESTIONS],
    };
  }

  async getAll(table: string, filters?: Record<string, any>) {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simular latencia de red
    let rows = this.data[table] || [];

    if (filters) {
      rows = rows.filter((row: any) => {
        return Object.entries(filters).every(([key, value]) => {
          // Check array containment
          if (Array.isArray(value)) {
            return value.includes(row[key]);
          }
          // Handle comma-separated values in DB (legacy airtable style simulation)
          if (typeof row[key] === "string" && row[key].includes(",")) {
            return row[key]
              .split(",")
              .map((s: string) => s.trim())
              .includes(value);
          }
          // Normal equality
          return String(row[key]) === String(value);
        });
      });
    }
    return JSON.parse(JSON.stringify(rows)); // Return copy to avoid ref mutation issues
  }

  async create(table: string, fields: any) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const newRecord = {
      id: `mock_${table}_${Date.now()}`,
      created_at: new Date().toISOString(),
      ...fields,
    };
    // Ensure array if it doesn't exist
    if (!this.data[table]) this.data[table] = [];

    this.data[table] = [newRecord, ...this.data[table]];
    return newRecord;
  }

  async update(table: string, id: string, fields: any) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const index = this.data[table].findIndex((r: any) => r.id === id);
    if (index === -1) throw new Error(`Record ${id} not found in mock db table ${table}`);

    this.data[table][index] = { ...this.data[table][index], ...fields };
    return this.data[table][index];
  }

  async delete(table: string, id: string) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.data[table] = this.data[table].filter((r: any) => r.id !== id);
    return { success: true };
  }
}

export const mockDb = new MockDatabase();
