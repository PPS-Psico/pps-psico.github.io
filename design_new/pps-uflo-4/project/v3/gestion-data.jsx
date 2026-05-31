/* Mock data for Gestión — institutional management workspace
   Each ITEM is a row in the bandeja: an institution that needs an action,
   along with the action it needs, urgency, and the institution's full ficha.
   Inicio's "qué hacer ahora" is the briefing surface of this same data. */

// ─── CALENDAR EVENTS — operational, not decorative ─────────────────
// Each event ties to an institucion + optionally a PPS cohort. Used by the
// Calendario 2026 view. Dates are ISO yyyy-mm-dd to keep parsing trivial.
// Tipos:
//   porFinalizar       PPS termina (preparar cierre)
//   cierreInscripcion  Inscripción de convocatoria cierra
//   recordatorio       Recordatorio creado por el coordinador
//   relanzamiento      PPS confirmada arranca
//   convenioVencido    Convenio institucional caduca
//   acreditacion       SAC pendiente / fecha límite
const CALENDAR_EVENTS = [
  // ─── Spans (eventos multi-día — se ven como barras horizontales) ───
  // PPS activas (cohortes en curso, mostradas como barras en su tramo final)
  { id: 'span-italiano', date: '2026-05-04', dateEnd: '2026-05-31', tipo: 'ppsActiva',          instId: 'italiano',   titulo: 'PPS Hospital Italiano · cohorte 2026-1', detalle: '4 estudiantes · termina 31 may' },
  { id: 'span-cesac',    date: '2026-05-14', dateEnd: '2026-05-27', tipo: 'inscripcionAbierta', instId: 'cesac8',     titulo: 'Inscripción CESAC 8 abierta',            detalle: '12 inscriptos · cierra 27 may 23:59' },
  { id: 'span-ineba',    date: '2026-05-12', dateEnd: '2026-05-29', tipo: 'inscripcionAbierta', instId: 'ineba',      titulo: 'Inscripción PPS Investigación II',        detalle: '23 inscriptos · cierra 29 may' },
  { id: 'span-pedia',    date: '2026-06-10', dateEnd: '2026-06-25', tipo: 'inscripcionAbierta', instId: 'gutierrez',  titulo: 'Inscripción PPS Pediátrica',             detalle: 'Cohorte 2026-2 · 4 cupos' },
  { id: 'span-gut',      date: '2026-08-01', dateEnd: '2026-12-15', tipo: 'ppsActiva',          instId: 'gutierrez',  titulo: 'PPS Pediátrica · cohorte 2026-2',         detalle: '4 estudiantes' },
  { id: 'span-pensar',   date: '2026-07-15', dateEnd: '2026-12-10', tipo: 'ppsActiva',          instId: 'pensar',     titulo: 'PPS Pensar ASER · cohorte jul 2026',      detalle: '6 estudiantes · laboral' },
  { id: 'span-ineba2',   date: '2026-06-28', dateEnd: '2026-12-15', tipo: 'ppsActiva',          instId: 'ineba',      titulo: 'PPS Investigación II · cohorte 2026-2',   detalle: '6 estudiantes' },

  // ─── Mayo 2026 (la semana en curso) — eventos puntuales ───
  { id: 'ev-1',  date: '2026-05-27', tipo: 'cierreInscripcion', instId: 'cesac8',     titulo: 'Cierra inscripción CESAC 8',             detalle: '12 inscriptos · 8 cupos · hay que seleccionar' },
  { id: 'ev-2',  date: '2026-05-29', tipo: 'cierreInscripcion', instId: 'ineba',      titulo: 'Cierra inscripción PPS Investigación II', detalle: '23 inscriptos · 6 cupos · cierre 23:59' },
  { id: 'ev-3',  date: '2026-05-31', tipo: 'porFinalizar',      instId: 'italiano',   titulo: 'Hospital Italiano · PPS termina',         detalle: 'PPS 2026-1 · 4 estudiantes activos · preparar cierre' },

  // ─── Junio 2026 ───
  { id: 'ev-4',  date: '2026-06-02', tipo: 'recordatorio',       instId: 'manantiales', titulo: 'Reinsistir Manantiales',                detalle: 'Sin respuesta hace 7 días · plantilla "recordatorio cortés"' },
  { id: 'ev-5',  date: '2026-06-05', tipo: 'recordatorio',       instId: 'liens',       titulo: 'Confirmar fechas Liens',                 detalle: 'Respondieron favorable · falta cerrar fecha de inicio' },
  { id: 'ev-6',  date: '2026-06-10', tipo: 'cierreInscripcion',  instId: 'gutierrez',   titulo: 'Abre inscripción PPS Pediátrica',        detalle: 'Cohorte 2026-2 · 4 cupos · plantilla WhatsApp lista' },
  { id: 'ev-7',  date: '2026-06-15', tipo: 'recordatorio',       instId: 'borda',       titulo: 'Confirmar continuidad Borda',            detalle: 'Cohorte 2026 · Hermes sugiere contacto lunes mañana' },
  { id: 'ev-8',  date: '2026-06-20', tipo: 'convenioVencido',    instId: 'austral',     titulo: 'Convenio Austral vence',                 detalle: 'Pendiente renovación · falta referente nuevo' },
  { id: 'ev-9',  date: '2026-06-25', tipo: 'cierreInscripcion',  instId: 'gutierrez',   titulo: 'Cierra inscripción PPS Pediátrica',      detalle: 'Cohorte 2026-2' },
  { id: 'ev-10', date: '2026-06-28', tipo: 'relanzamiento',      instId: 'ineba',       titulo: 'PPS Investigación II · encuentro inicial', detalle: '6 estudiantes seleccionados · 18:00' },

  // ─── Julio 2026 ───
  { id: 'ev-11', date: '2026-07-01', tipo: 'relanzamiento',      instId: 'pensar',      titulo: 'Inicio cohorte Pensar ASER',             detalle: 'Confirmada · 6 cupos acordados · inicia formación' },
  { id: 'ev-12', date: '2026-07-15', tipo: 'relanzamiento',      instId: 'pensar',      titulo: 'Pensar ASER · encuentro inicial',        detalle: '6 estudiantes confirmados' },
  { id: 'ev-13', date: '2026-07-28', tipo: 'recordatorio',       instId: 'gutierrez',   titulo: 'Encuentro inicial PPS Pediátrica',       detalle: '4 estudiantes · 18:00 · Gallo 1330' },

  // ─── Agosto 2026 ───
  { id: 'ev-14', date: '2026-08-01', tipo: 'relanzamiento',      instId: 'gutierrez',   titulo: 'Inicio PPS Pediátrica',                  detalle: 'Cohorte 2026-2 · 4 estudiantes' },
  { id: 'ev-15', date: '2026-08-15', tipo: 'acreditacion',       instId: 'italiano',    titulo: 'Acreditación SAC Hospital Italiano',     detalle: 'Fecha límite · 4 estudiantes activos' },
];

// Tipo meta:
//   kind: 'moment' → chip puntual en una celda
//   kind: 'span'   → barra horizontal a lo largo de varios días (requiere dateEnd)
const CALENDAR_TIPO_META = {
  // Spans (barras)
  ppsActiva:          { label: 'PPS activa',           kind: 'span',   icon: 'autorenew',   soft: 'var(--ok-soft)',     color: 'var(--ok)' },
  inscripcionAbierta: { label: 'Inscripción abierta',  kind: 'span',   icon: 'how_to_reg',  soft: 'var(--accent-soft)', color: 'var(--accent)' },
  // Moments (chips)
  porFinalizar:       { label: 'PPS termina',          kind: 'moment', icon: 'event_busy',  soft: 'var(--accent-soft)', color: 'var(--accent)' },
  cierreInscripcion:  { label: 'Cierre inscripción',   kind: 'moment', icon: 'lock_clock',  soft: 'var(--warn-soft)',   color: 'var(--warn)' },
  recordatorio:       { label: 'Recordatorio',         kind: 'moment', icon: 'alarm',       soft: 'var(--ai-soft)',     color: 'var(--ai)' },
  relanzamiento:      { label: 'Inicio / encuentro',   kind: 'moment', icon: 'play_arrow',  soft: 'var(--ok-soft)',     color: 'var(--ok)' },
  convenioVencido:    { label: 'Convenio vence',       kind: 'moment', icon: 'description', soft: 'var(--warn-soft)',   color: 'var(--warn)' },
  acreditacion:       { label: 'Acreditación',         kind: 'moment', icon: 'verified',    soft: 'var(--ok-soft)',     color: 'var(--ok)' },
};

Object.assign(window, { CALENDAR_EVENTS, CALENDAR_TIPO_META });

// ─── (existing exports below) ─────────────────────────────────────────
const ORIENTACIONES = ['Clínica', 'Educacional', 'Laboral', 'Comunitaria'];

// State spec (matches CSS chip-status data-state values)
const GESTION_STATES = {
  porContactar:       { label: 'Por contactar',         tone: 'porContactar',      tag: 'Vencida sin gestión' },
  reinsistir:         { label: 'Reinsistir',             tone: 'reinsistir',        tag: 'Sin respuesta hace tiempo' },
  esperandoRespuesta: { label: 'Esperando respuesta',    tone: 'esperandoRespuesta', tag: 'Contactada · monitoreando' },
  pendienteDecision:  { label: 'Pendiente de decisión',  tone: 'pendienteDecision', tag: 'Respondieron · hay que definir' },
  confirmada:         { label: 'Confirmada',             tone: 'confirmada',        tag: 'Relanzamiento confirmado' },
  porFinalizar:       { label: 'Por finalizar',          tone: 'porFinalizar',      tag: 'PPS activa terminando' },
  activa:             { label: 'Activa',                 tone: 'activa',            tag: 'PPS en curso' },
  indefinida:         { label: 'Indefinida',             tone: 'indefinida',        tag: 'Sin fechas · falta data' },
  archivada:          { label: 'Archivada',              tone: 'archivada',         tag: 'No se relanza' },
};

// Categories the rail shows (the "qué filtro querés ver" set)
const CATEGORIES = [
  { id: 'hoy',                 label: 'Hoy',                   icon: 'today',              tone: null,           note: 'Lo que conviene hacer primero' },
  // Conversaciones — superficie de WhatsApp/mail como materia prima
  { id: 'esperando5d',         label: 'Esperando +5 días',     icon: 'schedule_send',      tone: 'accent',       note: 'Te deben respuesta hace rato',          group: 'conv' },
  { id: 'requiereDecision',    label: 'Requiere decisión',     icon: 'pan_tool',           tone: 'ai',           note: 'Hermes marcó que tenés que definir',    group: 'conv' },
  { id: 'sinVincular',         label: 'Sin vincular',          icon: 'link_off',           tone: 'warn',         note: 'Chats PPS que no son institución aún',  group: 'conv' },
  // Estado de gestión
  { id: 'porContactar',        label: 'Por contactar',         icon: 'campaign',           tone: 'warn',         note: 'Finalizadas sin gestión',               group: 'estado' },
  { id: 'reinsistir',          label: 'Reinsistir',            icon: 'mark_email_unread',  tone: 'warn',         note: '5+ días esperando',                     group: 'estado' },
  { id: 'porFinalizar',        label: 'Por finalizar',         icon: 'event_busy',         tone: 'accent',       note: 'Activas que terminan ≤30 días',         group: 'estado' },
  { id: 'pendienteDecision',   label: 'Pendiente de decisión', icon: 'how_to_reg',         tone: 'ai',           note: 'Respondieron · falta definir',          group: 'estado' },
  { id: 'faltaDato',           label: 'Falta dato clave',      icon: 'priority_high',      tone: 'warn',         note: 'Sin teléfono, mail o referente',        group: 'estado' },
  { id: 'esperandoRespuesta', label: 'Esperando respuesta',    icon: 'schedule_send',      tone: 'accent',       note: 'Contactadas hace <5 días',              group: 'estado' },
  { id: 'confirmada',          label: 'Confirmadas',           icon: 'check_circle',       tone: 'ok',           note: 'Ya tienen relanzamiento',               group: 'estado' },
  { id: 'archivada',           label: 'Archivadas',            icon: 'inventory_2',        tone: 'mute',         note: 'No se relanzan',                        group: 'estado' },
];

// Institutions — full living file
const INSTITUCIONES = [
  {
    id: 'borda',
    nombre: 'Hospital Borda',
    tipo: 'Hospital psiquiátrico',
    localidad: 'Barracas, CABA',
    referente: 'Dr. P. Acuña',
    referenteRol: 'Jefe de servicio Psicología',
    telefono: '+54 11 4304-5555',
    mail: 'pacunia@borda.gov.ar',
    convenio: 'Vigente · firmado 2021',
    orientaciones: ['Clínica'],
    notas: 'Respondió rápido en 2024, lento en 2025. Suele cerrar acuerdos los miércoles.',
    historial: [
      { fecha: '14 may 2026', hora: '09:21', tipo: 'state', titulo: 'PPS 2025 finalizada · pasó a "Pendiente de gestión"', auto: true },
      { fecha: '10 jun 2025', hora: '11:00', tipo: 'state', titulo: 'PPS lanzada · cohorte 2025-2', auto: true },
      { fecha: '05 may 2025', hora: '14:30', tipo: 'whatsapp', titulo: 'Acuerdo de relanzamiento 2025', detalle: 'Confirmaron 4 cupos · jueves 14h', auto: false },
      { fecha: '28 abr 2025', hora: '10:14', tipo: 'mail',     titulo: 'Consulta de continuidad para 2025', detalle: 'Plantilla "continuidad" · respondieron 5 días después', auto: false },
    ],
    ppsHistory: [
      { cohort: '2025-2', orient: 'Clínica', cupos: 4, acreditados: 4, fin: '14 may 2026', estado: 'Finalizada' },
      { cohort: '2024-1', orient: 'Clínica', cupos: 4, acreditados: 3, fin: '12 dic 2024', estado: 'Finalizada' },
      { cohort: '2023-1', orient: 'Clínica', cupos: 3, acreditados: 3, fin: '08 dic 2023', estado: 'Finalizada' },
    ],
    estudiantes: [], // none currently active
    hermesNote: 'Esta institución suele responder en 3-5 días. Conviene contactarla los lunes a la mañana.',
  },
  {
    id: 'manantiales',
    nombre: 'Fundación Manantiales',
    tipo: 'ONG · Adicciones',
    localidad: 'Recoleta, CABA',
    referente: 'Lic. F. Soto',
    referenteRol: 'Coordinador clínico',
    telefono: '+54 11 4801-0099',
    mail: 'fsoto@manantiales.org',
    convenio: 'Vigente · firmado 2023',
    orientaciones: ['Clínica', 'Comunitaria'],
    notas: 'Históricamente acepta el primer contacto. La pauta es agradecerlo antes del lunes.',
    historial: [
      { fecha: '20 may 2026', hora: '16:42', tipo: 'mail',     titulo: 'Consulta de continuidad 2026', detalle: 'Sin respuesta · 7 días', auto: false },
      { fecha: '12 feb 2026', hora: '09:00', tipo: 'state', titulo: 'PPS feb 2026 finalizada · 8 acreditados', auto: true },
    ],
    ppsHistory: [
      { cohort: 'feb 2026', orient: 'Clínica', cupos: 8, acreditados: 8, fin: '12 feb 2026', estado: 'Finalizada' },
      { cohort: '2025-1', orient: 'Clínica', cupos: 6, acreditados: 6, fin: '20 nov 2025', estado: 'Finalizada' },
    ],
    estudiantes: [],
    hermesNote: 'La última respuesta a un mail tardó 5 días. Ya pasaron 7. Pinto reinsistir hoy con plantilla "recordatorio cortés".',
  },
  {
    id: 'gutierrez',
    nombre: 'Hospital de Niños "Dr. R. Gutiérrez"',
    tipo: 'Hospital pediátrico',
    localidad: 'Almagro, CABA',
    referente: 'Lic. María González',
    referenteRol: 'Jefa de servicio',
    telefono: '+54 11 4962-9090',
    mail: 'mgonzalez@gutierrez.org.ar',
    convenio: 'Vigente · firmado 2020',
    orientaciones: ['Clínica'],
    notas: 'Cohortes nuevas se confirman en una sola llamada.',
    historial: [
      { fecha: '24 may 2026', hora: '10:32', tipo: 'state', titulo: 'PPS 2026-2 lanzada · cohorte clínica', auto: true },
      { fecha: '20 may 2026', hora: '14:10', tipo: 'whatsapp', titulo: 'Confirmación de cohorte 2026-2', detalle: 'Acordados 4 cupos · martes y jueves 14h', auto: false },
    ],
    ppsHistory: [
      { cohort: '2026-2', orient: 'Clínica', cupos: 4, acreditados: null, fin: '15 dic 2026', estado: 'Activa' },
      { cohort: '2025-2', orient: 'Clínica', cupos: 4, acreditados: 4, fin: '14 dic 2025', estado: 'Finalizada' },
    ],
    estudiantes: [
      { nombre: 'Sofía Pereyra', year: '5to', horario: 'Mar y Jue · 14h' },
      { nombre: 'Marcos Rodríguez', year: '4to', horario: 'Mar y Jue · 14h' },
    ],
    hermesNote: null,
  },
  {
    id: 'italiano',
    nombre: 'Hospital Italiano',
    tipo: 'Hospital general',
    localidad: 'Almagro, CABA',
    referente: 'Dra. L. Méndez',
    referenteRol: 'Coordinadora SAC',
    telefono: '+54 11 4959-0200',
    mail: '',
    convenio: 'Vigente · firmado 2022',
    orientaciones: ['Clínica'],
    notas: 'PPS activa terminando · falta mail del referente.',
    historial: [
      { fecha: '22 may 2026', hora: '09:00', tipo: 'state', titulo: 'PPS 2026-1 entra en sus últimas 9 jornadas', auto: true },
    ],
    ppsHistory: [
      { cohort: '2026-1', orient: 'Clínica', cupos: 5, acreditados: null, fin: '31 may 2026', estado: 'Por finalizar' },
    ],
    estudiantes: [
      { nombre: 'Lucía Bertinotti', year: '5to', horario: 'Lun y Mié · 10h' },
      { nombre: 'Federico Larrea',  year: '5to', horario: 'Mar y Jue · 14h' },
      { nombre: 'Camila Ruiz',      year: '4to', horario: 'Lun y Mié · 10h' },
      { nombre: 'Joaquín Suárez',   year: '5to', horario: 'Lun y Mié · 10h' },
    ],
    hermesNote: 'Falta el mail del referente. Sugerencia: pedirlo en el próximo WhatsApp.',
  },
  {
    id: 'ineba',
    nombre: 'CONICET · INEBA',
    tipo: 'Centro de investigación',
    localidad: 'Belgrano, CABA',
    referente: 'Dr. R. Fernández',
    referenteRol: 'Director',
    telefono: '+54 11 4523-9988',
    mail: 'rfernandez@ineba.net',
    convenio: 'Vigente · firmado 2019',
    orientaciones: ['Clínica', 'Educacional'],
    notas: 'Buen flujo de respuesta. Suele querer rotación cuatrimestral.',
    historial: [
      { fecha: '19 may 2026', hora: '09:14', tipo: 'state', titulo: 'PPS Investigación II · cohorte 2026-2 lanzada', auto: true },
      { fecha: '14 may 2026', hora: '17:30', tipo: 'mail', titulo: 'Confirmación cohorte 2026-2', detalle: 'Confirmaron 6 cupos · cierra 29 may', auto: false },
    ],
    ppsHistory: [
      { cohort: '2026-2', orient: 'Clínica + Educ.', cupos: 6, acreditados: null, fin: '15 dic 2026', estado: 'Inscripción abierta' },
      { cohort: '2025-2', orient: 'Clínica + Educ.', cupos: 6, acreditados: 6, fin: '14 nov 2025', estado: 'Finalizada' },
    ],
    estudiantes: [],
    hermesNote: null,
  },
  {
    id: 'ameghino',
    nombre: 'Centro Ameghino',
    tipo: 'Centro de salud mental',
    localidad: 'Balvanera, CABA',
    referente: '',
    referenteRol: '',
    telefono: '+54 11 4304-7777',
    mail: '',
    convenio: 'Por renovar',
    orientaciones: ['Clínica'],
    notas: 'PPS 2025 cerró sin acreditación. Hay que decidir si reanudar el contacto.',
    historial: [
      { fecha: '08 may 2026', hora: '11:15', tipo: 'state', titulo: 'PPS 2025 cerrada sin acreditación', auto: true },
      { fecha: '02 abr 2026', hora: '15:00', tipo: 'note',  titulo: 'María Vidal asume coordinación', detalle: 'Cambió el referente · contacto anterior dejó el centro', auto: false },
    ],
    ppsHistory: [
      { cohort: '2025-1', orient: 'Clínica', cupos: 3, acreditados: 1, fin: '08 may 2026', estado: 'Finalizada sin acreditación' },
      { cohort: '2024-1', orient: 'Clínica', cupos: 3, acreditados: 3, fin: '15 dic 2024', estado: 'Finalizada' },
    ],
    estudiantes: [],
    hermesNote: 'Faltan referente y mail. El convenio está por renovar. Sugerencia: archivar y volver a contactar en 2027 si hay interés institucional.',
  },
  {
    id: 'cesac8',
    nombre: 'CESAC nº 8',
    tipo: 'Centro de salud comunitaria',
    localidad: 'Villa Soldati, CABA',
    referente: 'Lic. Verónica Lopez',
    referenteRol: 'Coordinadora PPS',
    telefono: '+54 11 4924-2105',
    mail: 'vlopez@buenosaires.gob.ar',
    convenio: 'Vigente · firmado 2018',
    orientaciones: ['Comunitaria'],
    notas: 'Inscripción abierta · cierra mañana 27 may.',
    historial: [
      { fecha: '14 may 2026', hora: '09:00', tipo: 'state', titulo: 'PPS Comunitaria · cohorte 2026 lanzada', auto: true },
      { fecha: '12 may 2026', hora: '12:00', tipo: 'whatsapp', titulo: 'Confirmación de horarios', detalle: 'Acuerdo de lunes y miércoles · 14h', auto: false },
    ],
    ppsHistory: [
      { cohort: '2026', orient: 'Comunitaria', cupos: 8, acreditados: null, fin: '20 nov 2026', estado: 'Inscripción abierta' },
      { cohort: '2024', orient: 'Comunitaria', cupos: 5, acreditados: 5, fin: '18 nov 2024', estado: 'Finalizada' },
    ],
    estudiantes: [],
    hermesNote: null,
  },
  {
    id: 'liens',
    nombre: 'Instituto Liens',
    tipo: 'Centro educativo especializado',
    localidad: 'Neuquén capital',
    referente: 'Lic. Andrea Pereyra',
    referenteRol: 'Directora',
    telefono: '+54 299 4281417',
    mail: 'apereyra@liens.edu.ar',
    convenio: 'Vigente · firmado 2024',
    orientaciones: ['Educacional'],
    notas: 'Respondieron al primer mail · falta decidir si abrimos cohorte 2026.',
    historial: [
      { fecha: '21 may 2026', hora: '11:30', tipo: 'mail',     titulo: 'Respuesta favorable a continuidad', detalle: 'Quieren 4 cupos · esperan que les digamos cuándo', auto: false },
      { fecha: '16 may 2026', hora: '09:00', tipo: 'mail',     titulo: 'Consulta de continuidad 2026',     detalle: 'Plantilla "continuidad"', auto: false },
      { fecha: '10 abr 2026', hora: '18:00', tipo: 'state',    titulo: 'PPS 2025 finalizada · 5 acreditados', auto: true },
    ],
    ppsHistory: [
      { cohort: '2025', orient: 'Educacional', cupos: 5, acreditados: 5, fin: '10 abr 2026', estado: 'Finalizada' },
    ],
    estudiantes: [],
    hermesNote: 'Respondieron hace 3 días esperando ofrecimiento concreto. Conviene mandarles fecha tentativa.',
  },
  {
    id: 'pensar',
    nombre: 'Asoc. Pensar · Programa ASER',
    tipo: 'ONG · Discapacidad',
    localidad: 'Neuquén capital',
    referente: 'Lic. Pablo Carballo',
    referenteRol: 'Coordinador',
    telefono: '+54 299 3247492',
    mail: 'pcarballo@pensaraser.org',
    convenio: 'Vigente · firmado 2024',
    orientaciones: ['Laboral', 'Comunitaria'],
    notas: 'Relanzamiento confirmado para julio 2026. Sin nada que hacer ahora.',
    historial: [
      { fecha: '15 may 2026', hora: '10:00', tipo: 'state',    titulo: 'Relanzamiento confirmado · cohorte jul 2026', auto: true },
      { fecha: '10 may 2026', hora: '16:30', tipo: 'whatsapp', titulo: 'Acuerdo de fechas',                          detalle: 'Confirmaron 6 cupos · inicia 15 jul', auto: false },
    ],
    ppsHistory: [
      { cohort: 'jul 2026', orient: 'Laboral', cupos: 6, acreditados: null, fin: '10 dic 2026', estado: 'Confirmada · sin lanzar' },
      { cohort: '2025',     orient: 'Laboral', cupos: 4, acreditados: 4, fin: '10 nov 2025', estado: 'Finalizada' },
    ],
    estudiantes: [],
    hermesNote: null,
  },
  {
    id: 'austral',
    nombre: 'Fundación Austral de Salud Integral',
    tipo: 'Fundación · Atención primaria',
    localidad: 'Neuquén capital',
    referente: '',
    referenteRol: '',
    telefono: '',
    mail: '',
    convenio: 'Vencido · falta renovar',
    orientaciones: ['Clínica'],
    notas: 'Sin datos básicos · hace tiempo que no se trabaja con ellos.',
    historial: [
      { fecha: '12 feb 2024', hora: '10:00', tipo: 'state', titulo: 'PPS finalizada · sin acreditaciones recientes', auto: true },
    ],
    ppsHistory: [
      { cohort: '2023', orient: 'Clínica', cupos: 4, acreditados: 2, fin: '12 feb 2024', estado: 'Finalizada' },
    ],
    estudiantes: [],
    hermesNote: 'Faltan teléfono, mail y referente. Convenio vencido. Conviene confirmar si la institución todavía existe antes de invertir tiempo.',
  },
];

// Missing-data flags per institution — derived but we list explicit for clarity
function missingFlagsFor(inst) {
  const flags = [];
  if (!inst.telefono) flags.push({ k: 'tel',  label: 'sin tel',       icon: 'phone' });
  if (!inst.mail)     flags.push({ k: 'mail', label: 'sin mail',      icon: 'mail' });
  if (!inst.referente)flags.push({ k: 'ref',  label: 'sin referente', icon: 'person' });
  if (inst.convenio && /vencido|renovar/i.test(inst.convenio)) flags.push({ k: 'conv', label: 'convenio venc.', icon: 'description' });
  return flags;
}

// Bandeja items — the actual "qué hacer hoy" stack
// Each row references an institution and carries the action context.
// Mixed urgency, sorted by category importance: porContactar > reinsistir > porFinalizar > pendienteDecision > faltaDato (low pri unless requested)
const ITEMS = [
  // 01 — Vencida sin gestión (urgent)
  {
    id: 'i01',
    institucion: 'borda',
    state: 'porContactar',
    titulo: 'Contactar Borda',
    razon: 'PPS 2025 cerró sin acreditación · 14 días sin gestión',
    detalle: 'María Vidal coordina · estaba lento en 2025',
    daysAgo: 14,
    urgency: 'high',
    suggestedAction: { channel: 'whatsapp', label: 'Llamar o WhatsApp' },
    nextStep: 'Confirmar continuidad cohorte 2026',
  },
  // 02 — Reinsistir (5+ días sin respuesta)
  {
    id: 'i02',
    institucion: 'manantiales',
    state: 'reinsistir',
    titulo: 'Reinsistir Manantiales',
    razon: 'Sin respuesta hace 7 días al mail de continuidad',
    detalle: 'Última respuesta tardó 5 días · ya pasamos esa ventana',
    daysAgo: 7,
    urgency: 'high',
    suggestedAction: { channel: 'mail', label: 'Reenviar consulta' },
    nextStep: 'Pasar a "Esperando respuesta" si responde',
  },
  // 03 — Por finalizar (9 días) + falta dato
  {
    id: 'i03',
    institucion: 'italiano',
    state: 'porFinalizar',
    titulo: 'Hospital Italiano cierra en 9 días',
    razon: 'PPS 2026-1 finaliza 31 may · 4 estudiantes activos',
    detalle: 'Necesita preparar cierre académico y abrir conversación 2026-2',
    daysAgo: -9,
    urgency: 'normal',
    suggestedAction: { channel: 'whatsapp', label: 'Avisar inicio de cierre' },
    nextStep: 'Pedir mail del referente · arrancar relanzamiento',
  },
  // 04 — Pendiente de decisión (respondieron favorable)
  {
    id: 'i04',
    institucion: 'liens',
    state: 'pendienteDecision',
    titulo: 'Decidir continuidad Liens',
    razon: 'Respondieron hace 3 días: quieren 4 cupos · esperan fechas',
    detalle: 'Conviene ofrecer fecha concreta antes que se enfríe',
    daysAgo: 3,
    urgency: 'normal',
    suggestedAction: { channel: 'mail', label: 'Mandar propuesta de fechas' },
    nextStep: 'Confirmar y pasar a "Confirmada"',
  },
  // 05 — Vencida sin datos (institución en mal estado de datos)
  {
    id: 'i05',
    institucion: 'austral',
    state: 'porContactar',
    titulo: 'Definir qué hacer con Austral',
    razon: 'PPS 2023 finalizada · sin contacto desde entonces · sin datos básicos',
    detalle: 'Convenio vencido · no hay tel/mail/referente',
    daysAgo: 730,
    urgency: 'low',
    suggestedAction: { channel: 'ai', label: 'Pedir a Hermes sugerencia' },
    nextStep: 'Confirmar si sigue activa o archivar',
  },
  // 06 — Pendiente decisión Ameghino + falta dato + Hermes opina archivar
  {
    id: 'i06',
    institucion: 'ameghino',
    state: 'pendienteDecision',
    titulo: 'Centro Ameghino · qué hacemos',
    razon: 'PPS 2025 cerró sin acreditación · cambió referente',
    detalle: 'Hermes sugiere archivar · falta mail y referente nuevo',
    daysAgo: 18,
    urgency: 'low',
    suggestedAction: { channel: 'ai', label: 'Ver sugerencia de Hermes' },
    nextStep: 'Archivar o pedir más datos',
  },
  // 07 — Esperando respuesta (CESAC) — todo OK, monitoreando
  {
    id: 'i07',
    institucion: 'cesac8',
    state: 'porFinalizar',
    titulo: 'CESAC 8 cierra inscripción mañana',
    razon: 'Inscripción cierra 27 may · 12 inscriptos para 8 cupos',
    detalle: 'Lista para seleccionar tras el cierre',
    daysAgo: -1,
    urgency: 'normal',
    suggestedAction: { channel: 'lanzador', label: 'Ir al Seleccionador' },
    nextStep: 'Esperar a mañana · seleccionar candidatos',
  },
  // 08 — Confirmada · nothing to do
  {
    id: 'i08',
    institucion: 'pensar',
    state: 'confirmada',
    titulo: 'Pensar ASER · cohorte julio confirmada',
    razon: 'Inicia 15 jul 2026 · 6 cupos acordados',
    detalle: 'Nada que hacer ahora · recordatorio 30 días antes',
    daysAgo: 0,
    urgency: 'low',
    suggestedAction: { channel: 'note', label: 'Sin acción' },
    nextStep: 'Esperar fecha de inicio',
  },
  // 09 — Esperando respuesta (más reciente, sin urgencia aún)
  {
    id: 'i09',
    institucion: 'ineba',
    state: 'esperandoRespuesta',
    titulo: 'INEBA · seguimiento abierto',
    razon: 'Inscripción abierta · cierra en 3 días',
    detalle: '23 inscriptos, falta cobertura en 1 franja horaria',
    daysAgo: 2,
    urgency: 'low',
    suggestedAction: { channel: 'lanzador', label: 'Difundir franja faltante' },
    nextStep: 'Empujar la franja "Mié y Vie · 14-16"',
  },
];

// Email/WhatsApp templates
const TEMPLATES = {
  whatsapp: {
    contactar: '¡Hola {{referente}}! Soy Luis de la coordinación de PPS de Psicología UFLO. La PPS del año pasado terminó hace algunas semanas y queríamos saber si estaban con ganas de seguir trabajando con nosotros en 2026. ¡Gracias!',
    reinsistir: '¡Hola {{referente}}! Te paso un recordatorio cortés. Te había mandado un mail la semana pasada para coordinar la continuidad 2026. ¡Cualquier respuesta nos sirve, incluso si me decís que no este año! Saludos.',
    porFinalizar: '¡Hola {{referente}}! La PPS actual de los chicos está terminando en {{dias}} días. Quería avisarte para coordinar el cierre académico y, si hay ganas, arrancar a pensar la continuidad para el próximo cuatrimestre.',
  },
  mail: {
    contactar:    { subject: 'Consulta de continuidad PPS · 2026', body: 'Estimado/a {{referente}}, ...' },
    reinsistir:   { subject: 'Recordatorio · consulta continuidad PPS 2026', body: 'Estimado/a {{referente}}, le recuerdo el mail del {{ultimo_contacto}}...' },
    pendienteDec: { subject: 'Próximas fechas PPS · {{institucion}}', body: 'Estimado/a {{referente}}, gracias por su respuesta. Te propongo las siguientes fechas...' },
  },
};

// ─── HERMES SUGGESTIONS — la cola de aprobación ──────────────────────
// Lo que Hermes propone tras leer WhatsApp + Gmail. Nada se manda solo:
// todo pasa por tu revisión. Tres familias:
//   · draft        → borrador de respuesta listo para aprobar/editar/enviar
//   · clasificacion → propuesta de tipología / vínculo de un contacto nuevo
//   · decision     → algo que requiere tu criterio (Hermes no decide esto)
const HERMES_SUGGESTIONS = [
  // ── Borradores de respuesta ──
  {
    id: 's-liens', tipo: 'draft', instId: 'liens', canal: 'mail', confidence: 0.92,
    generadoHace: 'hace 12 min',
    enRespuestaA: { from: 'Andrea Pereyra · Liens', fecha: '21 may', texto: 'Hola Luis, sí queremos seguir! Necesitaríamos 4 cupos. Nos dicen ustedes cuándo arrancar?' },
    asunto: 'RE: Continuidad 2026 · fechas propuestas',
    borrador: 'Estimada Andrea,\n\n¡Qué alegría que quieran continuar! Reservamos los 4 cupos.\n\nPara arrancar les propongo la semana del 16 de junio, martes y jueves de 14 a 18h. Si les sirve, coordino con los estudiantes seleccionados y les paso la lista antes de esa fecha.\n\nQuedo atenta a su confirmación.\nSaludos,\nLuis',
    justificacion: 'Respondieron favorable y piden fecha de inicio. Propuse la franja que usaron en 2025 (mar/jue 14-18h) y dejé la confirmación abierta. Tono cordial, coincide con tu estilo habitual con Liens.',
  },
  {
    id: 's-naval', tipo: 'draft', contactId: 'u-hospnaval', canal: 'whatsapp', confidence: 0.81,
    generadoHace: 'hace 1 h',
    enRespuestaA: { from: 'Hospital Naval · Lic. Quiroga', fecha: '23 may', texto: 'Hola Luis! Nos pasaron tu contacto. Estamos interesados en recibir practicantes de psicología clínica. ¿Cómo seguimos?' },
    borrador: '¡Hola Lic. Quiroga! Gracias por escribir, nos encanta el interés. Soy Luis, de la coordinación de PPS de Psicología UFLO.\n\nEl primer paso es una breve charla para conocer el servicio y los cupos que podrían ofrecer. ¿Le viene bien una llamada esta semana? Quedo a disposición.',
    justificacion: 'Institución nueva con interés concreto en clínica. Sugerí una llamada introductoria (tu paso habitual antes de armar convenio). No prometí cupos ni fechas porque todavía no hay convenio.',
    accionLigada: { tipo: 'agregar_catalogo', label: 'Agregar Hospital Naval al catálogo' },
  },
  {
    id: 's-fabiana', tipo: 'draft', contactId: 'u-fabiana', canal: 'whatsapp', confidence: 0.74,
    generadoHace: 'hace 2 h',
    enRespuestaA: { from: 'Fabiana De Col · Vicerrectora', fecha: '24 may', texto: 'Luis, ¿cómo venimos con las prácticas de quinto? Avisame si necesitás que empuje algo desde rectorado.' },
    borrador: 'Hola Fabiana, gracias por preguntar. Venimos bien: tenemos 18 PPS activas y 3 nuevas instituciones en gestión esta semana. El único cuello es la acreditación del Hospital Italiano, que cierra el 31 — si desde rectorado pudieran agilizar la firma del SAC, ayudaría. Te paso el detalle por mail mañana.',
    justificacion: 'Es autoridad interna (Vicerrectora) — tono respetuoso y conciso. Aproveché su ofrecimiento para pedir ayuda concreta con el cuello de botella real (acreditación Italiano). Sugiero revisar el número de PPS activas antes de enviar.',
    revisarAntes: 'Verificá el número “18 PPS activas” antes de mandar.',
  },

  // ── Clasificaciones de WhatsApp ──
  {
    id: 's-cls-pirovano', tipo: 'clasificacion', contactId: 'u-pirovano', confidence: 0.86,
    generadoHace: 'hace 40 min',
    propuesta: 'sin_convenio',
    accion: 'agregar_catalogo',
    justificacion: 'Servicio de psicología de un hospital público, con interés explícito y 3 cupos disponibles. Coincide con el perfil de tus instituciones de práctica. Propongo agregarla al catálogo como institución en gestión.',
  },
  {
    id: 's-cls-diego', tipo: 'clasificacion', contactId: 'u-coord-cesac', confidence: 0.90,
    generadoHace: 'hace 1 h',
    propuesta: 'coordinador_externo',
    accion: 'vincular',
    vincularA: 'cesac8',
    justificacion: 'Habla de logística de aulas de CESAC 8, que ya está en tu catálogo. Es un contacto operativo, no una institución nueva. Propongo vincularlo a CESAC 8 como coordinador externo.',
  },
  {
    id: 's-cls-florencia', tipo: 'clasificacion', contactId: 'u-florencia', confidence: 0.69,
    generadoHace: 'hace 3 h',
    propuesta: null,
    accion: 'descartar',
    justificacion: 'Consulta individual de una egresada sobre inscripciones. No es una institución de práctica ni un contacto operativo. Propongo dejarla fuera del catálogo (no es materia de gestión institucional).',
  },

  // ── Decisiones que requieren tu criterio ──
  {
    id: 's-dec-cesac', tipo: 'decision', instId: 'cesac8', confidence: null,
    generadoHace: 'hace 20 min',
    titulo: 'CESAC 8 · 12 inscriptos para 8 cupos',
    contexto: 'La inscripción cierra el 27 may 23:59. Hay 12 inscriptos y solo 8 cupos. Hay que seleccionar a quiénes entran.',
    justificacion: 'Esto requiere tu criterio académico — no puedo elegir estudiantes por vos. Te dejo el dato a la vista para que decidas antes del cierre.',
    opciones: [
      { label: 'Revisar inscriptos', icon: 'how_to_reg', primary: true },
      { label: 'Ampliar cupos con la institución', icon: 'forum', primary: false },
    ],
  },
  {
    id: 's-dec-italiano', tipo: 'decision', instId: 'italiano', confidence: null,
    generadoHace: 'hace 1 h',
    titulo: 'Hospital Italiano · falta mail del referente',
    contexto: 'La PPS termina el 31 may y hay que mandar la acreditación formal, pero no tenés cargado el mail del referente. Se lo pediste por WhatsApp el 21 y no respondieron (5 días).',
    justificacion: 'Detecté el dato faltante cruzando la ficha con el chat. Conviene reinsistir antes del cierre. Puedo redactar el recordatorio si querés.',
    opciones: [
      { label: 'Reinsistir por WhatsApp', icon: 'chat', primary: true },
      { label: 'Cargar el dato a mano', icon: 'edit', primary: false },
    ],
  },
  {
    id: 's-dec-ameghino', tipo: 'decision', instId: 'ameghino', confidence: null,
    generadoHace: 'hace 4 h',
    titulo: 'Ameghino · cambió la coordinación',
    contexto: 'María Vidal asumió la coordinación; el contacto anterior ya no está. La PPS 2025 cerró sin acreditación. Hay que decidir si se reabre la gestión con la nueva referente.',
    justificacion: 'Cambio de referente detectado en el chat. Actualicé la ficha tentativamente, pero confirmar la continuidad con una persona nueva es decisión tuya.',
    opciones: [
      { label: 'Abrir gestión con María', icon: 'campaign', primary: true },
      { label: 'Archivar por ahora', icon: 'inventory_2', primary: false },
    ],
  },
];


const CONTACT_TIPOS = {
  autoridad_uflo: {
    label: 'Autoridad UFLO', short: 'Autoridad',
    icon: 'school', color: 'var(--ai)', soft: 'var(--ai-soft)',
    hint: 'Interno · tono respetuoso · Hermes propone más conservador',
  },
  con_convenio: {
    label: 'Con convenio', short: 'Convenio',
    icon: 'verified', color: 'var(--ok)', soft: 'var(--ok-soft)',
    hint: 'Institución vinculada al panel · convenio vigente',
  },
  sin_convenio: {
    label: 'Sin convenio', short: 'Gestionando',
    icon: 'pending', color: 'var(--warn)', soft: 'var(--warn-soft)',
    hint: 'Nueva o en gestión · el 88% de los chats · prioridad de seguimiento',
  },
  coordinador_externo: {
    label: 'Coordinador externo', short: 'Externo',
    icon: 'support_agent', color: 'var(--ink-3)', soft: 'var(--paper-2)',
    hint: 'Contacto operativo en una institución',
  },
};

// Allowlist meta — visible en la UI: qué ve Hermes y qué NO.
const HERMES_ALLOWLIST = {
  totalChats: 55,
  listaNombre: 'PPS',
  vinculados: 7,      // chats ya atados a una institución del catálogo
  sinVincular: 48,    // el 88% — chats que Hermes ve pero no son institución aún
  ultimaLectura: 'hace 4 min',
};

// Per-institution metadata: tipología, si está vinculada al catálogo, y si
// Hermes marcó que requiere una decisión humana (no un draft automático).
const INST_META = {
  borda:       { contactTipo: 'con_convenio',       vinculada: true,  requiereDecision: true,  waContacto: 'Dr. Acuña (Borda)' },
  manantiales: { contactTipo: 'con_convenio',       vinculada: true,  requiereDecision: false, waContacto: 'Lic. Soto · Manantiales' },
  gutierrez:   { contactTipo: 'con_convenio',       vinculada: true,  requiereDecision: false, waContacto: 'María González · Gutiérrez' },
  italiano:    { contactTipo: 'con_convenio',       vinculada: true,  requiereDecision: true,  waContacto: 'Dra. Méndez SAC' },
  ineba:       { contactTipo: 'con_convenio',       vinculada: true,  requiereDecision: false, waContacto: 'Dr. Fernández · INEBA' },
  ameghino:    { contactTipo: 'sin_convenio',       vinculada: true,  requiereDecision: true,  waContacto: 'María Vidal (nueva coord.)' },
  cesac8:      { contactTipo: 'con_convenio',       vinculada: true,  requiereDecision: true,  waContacto: 'Lic. Verónica · CESAC 8' },
  liens:       { contactTipo: 'sin_convenio',       vinculada: true,  requiereDecision: true,  waContacto: 'Andrea Pereyra · Liens' },
  pensar:      { contactTipo: 'con_convenio',       vinculada: true,  requiereDecision: false, waContacto: 'Pablo Carballo · ASER' },
  austral:     { contactTipo: 'sin_convenio',       vinculada: false, requiereDecision: false, waContacto: null },
};

// ─── CONVERSACIONES — la materia prima ───────────────────────────────
// Timeline unificado: mensajes reales (WhatsApp + mail) + hitos del sistema,
// en orden cronológico. `from_me` marca dirección (lo que escribí yo vs lo que
// me escribieron). `iso` es para ordenar. Burbujas para mensajes, separadores
// para hitos del sistema.
//   kind: 'msg'    → mensaje (canal whatsapp|mail, from_me bool)
//   kind: 'system' → hito automático (lanzamiento, cierre, cambio de referente)
const CONVERSACIONES = {
  borda: [
    { kind: 'system', iso: '2026-05-14T09:21', fecha: '14 may', hora: '09:21', titulo: 'PPS 2025 finalizada · pasó a gestión', detalle: 'Sin acreditación cargada' },
    { kind: 'msg', canal: 'whatsapp', from_me: false, iso: '2025-05-05T14:30', fecha: '05 may 2025', hora: '14:30', texto: 'Hola Luis! Sí, confirmamos los 4 cupos para la cohorte. Jueves 14h les viene bien a los chicos?' },
    { kind: 'msg', canal: 'whatsapp', from_me: true,  iso: '2025-05-05T15:02', fecha: '05 may 2025', hora: '15:02', texto: 'Genial Doctor, jueves 14h perfecto. Les confirmo los nombres la semana que viene. Gracias!' },
    { kind: 'msg', canal: 'mail', from_me: true,  iso: '2025-04-28T10:14', fecha: '28 abr 2025', hora: '10:14', asunto: 'Continuidad PPS 2025', texto: 'Estimado Dr. Acuña, le escribo para coordinar la continuidad de la práctica para 2025…' },
  ],
  manantiales: [
    { kind: 'msg', canal: 'mail', from_me: true, iso: '2026-05-20T16:42', fecha: '20 may', hora: '16:42', asunto: 'Consulta de continuidad 2026', texto: 'Estimado Lic. Soto, ¿estarían con ganas de retomar la PPS este año? Quedamos a disposición.', estado: 'esperando', diasEsperando: 7 },
    { kind: 'system', iso: '2026-02-12T09:00', fecha: '12 feb', hora: '09:00', titulo: 'PPS feb 2026 finalizada · 8 acreditados' },
    { kind: 'msg', canal: 'whatsapp', from_me: false, iso: '2026-02-10T11:20', fecha: '10 feb', hora: '11:20', texto: 'Buenísimo, cerramos las 8 acreditaciones. Gracias por el acompañamiento de siempre!' },
  ],
  liens: [
    { kind: 'msg', canal: 'mail', from_me: false, iso: '2026-05-21T11:30', fecha: '21 may', hora: '11:30', asunto: 'RE: Continuidad 2026', texto: 'Hola Luis, sí queremos seguir! Necesitaríamos 4 cupos. Nos dicen ustedes cuándo arrancar?', estado: 'responder' },
    { kind: 'msg', canal: 'mail', from_me: true, iso: '2026-05-16T09:00', fecha: '16 may', hora: '09:00', asunto: 'Continuidad 2026', texto: 'Estimada Andrea, ¿les interesa abrir una cohorte este año? Saludos.' },
    { kind: 'system', iso: '2026-04-10T18:00', fecha: '10 abr', hora: '18:00', titulo: 'PPS 2025 finalizada · 5 acreditados' },
  ],
  italiano: [
    { kind: 'system', iso: '2026-05-22T09:00', fecha: '22 may', hora: '09:00', titulo: 'PPS 2026-1 entra en sus últimas 9 jornadas' },
    { kind: 'msg', canal: 'whatsapp', from_me: false, iso: '2026-05-21T18:40', fecha: '21 may', hora: '18:40', texto: 'Luis, te confirmo: el cierre lo hacemos el 31. Después coordinamos la cohorte nueva 🙌' },
    { kind: 'msg', canal: 'whatsapp', from_me: true, iso: '2026-05-21T19:10', fecha: '21 may', hora: '19:10', texto: 'Perfecto Dra. Una cosa: ¿me pasás un mail del referente para mandar la acreditación formal? No lo tengo cargado.', estado: 'esperando', diasEsperando: 5 },
  ],
  gutierrez: [
    { kind: 'system', iso: '2026-05-24T10:32', fecha: '24 may', hora: '10:32', titulo: 'PPS 2026-2 lanzada · cohorte clínica' },
    { kind: 'msg', canal: 'whatsapp', from_me: false, iso: '2026-05-20T14:10', fecha: '20 may', hora: '14:10', texto: 'Confirmado! 4 cupos, martes y jueves 14h. Mandame los nombres cuando los tengas.' },
    { kind: 'msg', canal: 'whatsapp', from_me: true, iso: '2026-05-20T14:25', fecha: '20 may', hora: '14:25', texto: 'Buenísimo María, gracias. La semana que viene te paso la lista.' },
  ],
  cesac8: [
    { kind: 'system', iso: '2026-05-14T09:00', fecha: '14 may', hora: '09:00', titulo: 'PPS Comunitaria · cohorte 2026 lanzada' },
    { kind: 'msg', canal: 'whatsapp', from_me: false, iso: '2026-05-12T12:00', fecha: '12 may', hora: '12:00', texto: 'Hola! Confirmamos lunes y miércoles 14h. La inscripción la cerramos el 27 no?' },
    { kind: 'msg', canal: 'whatsapp', from_me: true, iso: '2026-05-12T12:18', fecha: '12 may', hora: '12:18', texto: 'Exacto Verónica, cierra el 27. Tenemos 12 inscriptos para 8 cupos, así que vamos a tener que seleccionar.', estado: 'esperando', diasEsperando: 14 },
  ],
  ineba: [
    { kind: 'system', iso: '2026-05-19T09:14', fecha: '19 may', hora: '09:14', titulo: 'PPS Investigación II · cohorte 2026-2 lanzada' },
    { kind: 'msg', canal: 'mail', from_me: false, iso: '2026-05-14T17:30', fecha: '14 may', hora: '17:30', asunto: 'RE: Cohorte 2026-2', texto: 'Confirmamos 6 cupos. La inscripción cierra el 29, correcto. Saludos, R. Fernández.' },
  ],
  pensar: [
    { kind: 'system', iso: '2026-05-15T10:00', fecha: '15 may', hora: '10:00', titulo: 'Relanzamiento confirmado · cohorte jul 2026' },
    { kind: 'msg', canal: 'whatsapp', from_me: false, iso: '2026-05-10T16:30', fecha: '10 may', hora: '16:30', texto: 'Dale, confirmados los 6 cupos para julio. Arrancamos el 15. Un abrazo!' },
  ],
  ameghino: [
    { kind: 'system', iso: '2026-05-08T11:15', fecha: '08 may', hora: '11:15', titulo: 'PPS 2025 cerrada sin acreditación' },
    { kind: 'msg', canal: 'whatsapp', from_me: false, iso: '2026-04-02T15:00', fecha: '02 abr', hora: '15:00', texto: 'Hola, soy María Vidal, asumí la coordinación. El contacto anterior ya no está. ¿Con quién sigo?' },
  ],
};

// ─── CONTACTOS SIN VINCULAR — el 88% ─────────────────────────────────
// Chats de la lista PPS que Hermes ya lee pero que NO son institución del
// catálogo todavía. Ciudadanos de primera: aparecen como filtro propio y
// se pueden "agregar al catálogo". Hermes clasifica un tipo tentativo.
const UNLINKED_CONTACTS = [
  {
    id: 'u-fabiana', nombre: 'Fabiana De Col', rol: 'Vicerrectora UFLO',
    contactTipo: 'autoridad_uflo', canal: 'whatsapp', requiereDecision: false,
    ultimo: { from_me: false, fecha: '24 may', hora: '08:50', texto: 'Luis, ¿cómo venimos con las prácticas de quinto? Avisame si necesitás que empuje algo desde rectorado.', estado: 'responder' },
    hermesHint: 'Autoridad interna. Tono respetuoso. No es institución de práctica — no agregar al catálogo.',
  },
  {
    id: 'u-agostina', nombre: 'Agostina Ruiz', rol: 'Directora de carrera',
    contactTipo: 'autoridad_uflo', canal: 'whatsapp', requiereDecision: false,
    ultimo: { from_me: true, fecha: '23 may', hora: '17:12', texto: 'Agos, te paso el resumen de convenios activos mañana a primera hora.' },
    hermesHint: 'Autoridad interna. No agregar al catálogo.',
  },
  {
    id: 'u-hospnaval', nombre: 'Hospital Naval · Lic. Quiroga', rol: 'Posible nueva institución',
    contactTipo: 'sin_convenio', canal: 'whatsapp', requiereDecision: true,
    ultimo: { from_me: false, fecha: '23 may', hora: '13:05', texto: 'Hola Luis! Nos pasaron tu contacto. Estamos interesados en recibir practicantes de psicología clínica. ¿Cómo seguimos?', estado: 'responder' },
    hermesHint: 'Hermes detecta interés de una institución nueva. Sugerencia: agregar al catálogo y abrir gestión.',
  },
  {
    id: 'u-pirovano', nombre: 'Hospital Pirovano · Servicio Psico', rol: 'Posible nueva institución',
    contactTipo: 'sin_convenio', canal: 'whatsapp', requiereDecision: true,
    ultimo: { from_me: false, fecha: '22 may', hora: '10:40', texto: '¿Siguen tomando instituciones para el segundo cuatri? Tenemos lugar para 3 practicantes.', estado: 'responder' },
    hermesHint: 'Interés concreto con cupos. Sugerencia: agregar al catálogo.',
  },
  {
    id: 'u-coord-cesac', nombre: 'Diego (admin CESAC 8)', rol: 'Coordinador externo',
    contactTipo: 'coordinador_externo', canal: 'whatsapp', requiereDecision: false,
    ultimo: { from_me: false, fecha: '21 may', hora: '16:20', texto: 'Te confirmo que el aula queda disponible los miércoles. Cualquier cosa me escribís.' },
    hermesHint: 'Contacto operativo de CESAC 8 (ya en catálogo). Sugerencia: vincular a esa institución.',
  },
  {
    id: 'u-florencia', nombre: 'Florencia (egresada)', rol: 'Sin clasificar',
    contactTipo: 'coordinador_externo', canal: 'whatsapp', requiereDecision: false,
    ultimo: { from_me: false, fecha: '20 may', hora: '19:30', texto: 'Hola Luis! Te consultaba si abrieron las inscripciones de este año 😊' },
    hermesHint: 'Consulta individual. No parece institución. Sugerencia: dejar fuera del catálogo.',
  },
];

// Merge typology + conversación into each institution
INSTITUCIONES.forEach(inst => {
  const meta = INST_META[inst.id];
  if (meta) Object.assign(inst, meta);
  if (CONVERSACIONES[inst.id]) inst.conversacion = CONVERSACIONES[inst.id];
});

// Lookup by id
const INST_BY_ID = Object.fromEntries(INSTITUCIONES.map(i => [i.id, i]));

Object.assign(window, {
  ORIENTACIONES, GESTION_STATES, CATEGORIES,
  INSTITUCIONES, INST_BY_ID, ITEMS, TEMPLATES,
  missingFlagsFor,
  CONTACT_TIPOS, HERMES_ALLOWLIST, UNLINKED_CONTACTS, HERMES_SUGGESTIONS,
});
