// Mock data — modeled on the structure described in trabajo_pps_panel_web_y_agente_ia.docx
// Coordinator: Luis (Coord. PPS Psicología UFLO)

const TODAY = "Martes, 26 de mayo";
const TIME  = "10:42";
const USER  = "Luis Battaglia";

// Hermes briefing — narrative, written as it would speak
const BRIEFING = {
  greeting: "Buen día, Luis.",
  written_at: "Generado 10:38 · gpt-4o",
  // Use {mark} for accent highlight, {warn} for warning highlight, {em} for italic emphasis
  body: [
    "Hoy hay {warn:11 señales operativas}. Lo primero, sin dudas, es {mark:contactar a 4 instituciones} cuyas PPS terminaron sin gestión inicial — entre ellas {em:Hospital Borda} y {em:Centro Ameghino}, ambas con cohortes 2025.",
    "Te quedaron 3 instituciones {mark:esperando respuesta hace más de 5 días}; te sugiero reinsistir hoy con {em:Fundación Manantiales} antes de las 13:00 — históricamente responden por la mañana.",
    "Dos PPS activas terminan esta semana ({em:Hospital Italiano} cierra el viernes); conviene preparar el cierre académico y abrir conversación de relanzamiento 2026.",
    "Te dejé {mark:3 borradores de correo} listos para revisar abajo, y archivé como ruido la conversación sobre cupos de Posadas que se cerró ayer."
  ],
  metrics: [
    { k: "contactar", n: 4, label: "Contactar" },
    { k: "reinsistir", n: 3, label: "Reinsistir" },
    { k: "finalizar", n: 2, label: "Por finalizar" },
    { k: "solicitudes", n: 7, label: "Solicitudes" },
    { k: "datos", n: 2, label: "Faltan datos" },
  ]
};

// Five priorities from the Centro de Acción
const PRIORITIES = [
  {
    id: "p1", tone: "warn",
    eyebrow: "Contactar ahora",
    title: "Hospital Borda",
    detail: "PPS Acompañamiento finalizó 18 may. Sin contacto registrado.",
    meta: "3 días vencida · sin teléfono",
    cta: "Abrir ficha",
    extra: { phone: false, draftReady: true, lastTouch: null },
    icon: "campaign"
  },
  {
    id: "p2", tone: "warn",
    eyebrow: "Contactar ahora",
    title: "Centro Ameghino",
    detail: "Cohorte 2025 cerró sin acreditación. María Vidal coordina.",
    meta: "5 días vencida · +54 11 4304-5555",
    cta: "Llamar",
    extra: { phone: true, draftReady: true, lastTouch: "12 may · email" },
    icon: "campaign"
  },
  {
    id: "p3", tone: "accent",
    eyebrow: "Reinsistir",
    title: "Fundación Manantiales",
    detail: "Enviado primer contacto. Sin respuesta en 7 días.",
    meta: "Borrador de reinsistencia listo",
    cta: "Revisar borrador",
    extra: { phone: true, draftReady: true, lastTouch: "19 may · borrador" },
    icon: "drafts"
  },
  {
    id: "p4", tone: "accent",
    eyebrow: "Por finalizar",
    title: "Hospital Italiano",
    detail: "PPS Clínica cierra 31 may. 4 estudiantes activos.",
    meta: "5 días para cierre · acreditación SAC pendiente",
    cta: "Preparar cierre",
    extra: { phone: true, draftReady: false, lastTouch: "23 may · llamada" },
    icon: "event_busy"
  },
  {
    id: "p5", tone: "ok",
    eyebrow: "Solicitudes",
    title: "7 solicitudes en bandeja",
    detail: "4 PPS · 2 finalización · 1 corrección de datos",
    meta: "Más antigua: hace 2 días",
    cta: "Revisar bandeja",
    extra: { phone: false, draftReady: false, lastTouch: null },
    icon: "inbox"
  },
];

// Agenda — today + this week
const AGENDA = [
  { when: "10:00", tag: "Vencido", tone: "warn", title: "Llamar a Hospital Borda", who: "Bandeja: contactar", done: false },
  { when: "11:30", tag: "Hoy",     tone: "accent", title: "Reunión con Decanato · revisión cohorte 2026", who: "Cal. UFLO", done: false },
  { when: "14:00", tag: "Hoy",     tone: "accent", title: "Confirmar selección PPS Investigación", who: "5 estudiantes", done: false },
  { when: "Mañana", tag: "Mañana", tone: "mute", title: "Cierre inscripciones PPS Comunitaria", who: "12 inscriptos hasta ahora", done: false },
  { when: "Jue",   tag: "Esta semana", tone: "mute", title: "Generar seguros · cohorte mayo", who: "23 alumnos", done: false },
];

// Operational pulse — small numbers, no big colorful cards
const PULSE = [
  { k: "Activas",            n: 47, delta: "+3", trend: [12,14,15,13,16,18,17,19,20,21,22,23,25,24] },
  { k: "Vencidas s/ gestión", n: 4, delta: "+2", trend: [0,0,1,1,2,2,2,3,3,3,3,4,4,4], warn: true },
  { k: "Demoradas",           n: 6, delta: "−1", trend: [8,8,7,7,7,7,6,6,7,7,6,6,6,6] },
  { k: "Próximas a vencer",   n: 8, delta: "+1", trend: [5,5,5,6,6,6,7,7,7,8,8,8,8,8] },
];

// Activity log — recent events, written sparely
const ACTIVITY = [
  { t: "10:38", who: "Hermes", kind: "ai",       text: "Generó briefing diario y 3 borradores de correo." },
  { t: "10:22", who: "Sofía P.", kind: "student", text: "Subió documentación final — PPS Comunitaria.", link: "Revisar" },
  { t: "09:55", who: "Hospital Italiano", kind: "institution", text: "Respondió a hilo de relanzamiento 2026.", link: "Abrir hilo" },
  { t: "09:14", who: "Sistema", kind: "system",  text: "Convocatoria “Investigación II” cerró inscripciones.", link: "Ver inscriptos" },
  { t: "08:30", who: "Luis", kind: "you",        text: "Marcaste 3 recordatorios como hechos." },
  { t: "Ayer 18:02", who: "Hermes", kind: "ai", text: "Detectó que Centro Ameghino lleva 5 días sin respuesta." },
  { t: "Ayer 17:14", who: "Marcos R.", kind: "student", text: "Solicitó corrección de datos — DNI." },
  { t: "Ayer 16:00", who: "Sistema", kind: "system", text: "Backup automático completado." },
];

// Drafts ready for human review
const DRAFTS = [
  { to: "Hospital Borda", subject: "Cierre PPS 2025 y conversación 2026", lines: 3, confidence: 0.84 },
  { to: "Fundación Manantiales", subject: "Reinsistencia · respuesta pendiente", lines: 2, confidence: 0.91 },
  { to: "Centro Ameghino", subject: "Acreditación SAC pendiente", lines: 4, confidence: 0.72 },
];

Object.assign(window, { BRIEFING, PRIORITIES, AGENDA, PULSE, ACTIVITY, DRAFTS, TODAY, TIME, USER });
