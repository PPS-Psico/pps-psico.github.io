/* Mock data for Solicitudes — admin review of student-submitted requests.
   Three families:
     · INGRESO       → student proposes an institution to do their PPS
     · EGRESO        → student uploads 3 docs to accredit a finished PPS
     · CORRECCIONES  → student edits an existing PPS / proposes an autogestiva
   Hermes (purple) enriches INGRESO + EGRESO. CORRECCIONES stays simple
   (precarga + docs adjuntos + aprobar/rechazar — sin IA).

   Shapes mirror the production tables (solicitudes_pps, finalizacion,
   solicitudes_modificacion, solicitudes_nueva_pps) so the design plugs into
   the real endpoints without rework. */

// ─── INGRESO — solicitudes de PPS ────────────────────────────────────
// convenioStatus: 'con' | 'sin' | 'no_catalogada'
// estado: Pendiente | En conversaciones | Realizando convenio | Realizada | No se pudo concretar | Archivado
const SOL_INGRESO = [
  {
    id: 'in-01', instId: 'borda',
    alumno: { nombre: 'Camila Sosa', legajo: '78421', email: 'camila.sosa@uflouni.edu.ar' },
    institucion: {
      nombre: 'Hospital Borda', localidad: 'Barracas, CABA',
      direccion: 'Ramón Carrillo 375', referente: 'Dr. Acuña',
      email: 'docencia@borda.gob.ar', telefono: '+54 11 4305-6666', tutor: 'Lic. P. Aguirre',
    },
    convenioStatus: 'con', modalidad: 'Presencial · clínica',
    descripcion: 'Prácticas en el servicio de psicopatología. Observación de admisiones y participación en ateneos clínicos.',
    estado: 'Pendiente', notas: '', daysSinceUpdate: 1, createdLabel: '25 may',
    hermesPrioritized: true,
    activity: { mails: 3, whatsapps: 12 },
    hermes: {
      sugerencia: 'Borda suele responder en 3–5 días los miércoles. La plantilla "continuidad" funcionó las últimas 2 veces con el Dr. Acuña. Ya tenés convenio vigente, así que podés avanzar directo a coordinar fechas.',
      requiereDecision: false,
    },
    historial: [
      { canal: 'whatsapp', fromMe: false, snippet: 'Dale Luis, mandame los nombres y coordinamos', hace: 'hace 2 d', estado: null },
      { canal: 'whatsapp', fromMe: true,  snippet: 'Genial Dr., le confirmo la semana que viene', hace: 'hace 2 d', estado: null },
      { canal: 'mail',     fromMe: true,  snippet: 'Continuidad PPS 2026 — propuesta de cohorte', hace: 'hace 6 d', estado: null },
      { canal: 'mail',     fromMe: false, snippet: 'RE: Acreditación cohorte anterior — recibido', hace: 'hace 21 d', estado: null },
    ],
    ppsAnteriores: [
      { cohorte: '2025-1', orientacion: 'Clínica', cupos: 4, estado: 'Finalizada', fin: 'jul 2025' },
      { cohorte: '2024-2', orientacion: 'Clínica', cupos: 3, estado: 'Finalizada', fin: 'dic 2024' },
    ],
  },
  {
    id: 'in-02', instId: 'manantiales',
    alumno: { nombre: 'Tomás Ferreyra', legajo: '76110', email: 'tomas.ferreyra@uflouni.edu.ar' },
    institucion: {
      nombre: 'Comunidad Terapéutica Manantiales', localidad: 'Belgrano, CABA',
      direccion: 'Av. Cabildo 1234', referente: 'Lic. Soto',
      email: 'admision@manantiales.org', telefono: '+54 11 4787-1100', tutor: 'Lic. M. Duarte',
    },
    convenioStatus: 'con', modalidad: 'Presencial · clínica',
    descripcion: 'Acompañamiento en dispositivos de internación y seguimiento ambulatorio en adicciones.',
    estado: 'En conversaciones', notas: 'Esperando que confirmen cupos para la cohorte de agosto.', daysSinceUpdate: 6, createdLabel: '20 may',
    hermesPrioritized: false,
    activity: { mails: 2, whatsapps: 0 },
    hermes: {
      sugerencia: 'Les escribiste hace 6 días por mail y no respondieron. Históricamente Manantiales contesta mejor por teléfono que por mail. Conviene reinsistir o llamar al Lic. Soto.',
      requiereDecision: false,
    },
    historial: [
      { canal: 'mail', fromMe: true, snippet: 'Consulta de continuidad 2026 — ¿retoman este año?', hace: 'hace 6 d', estado: 'esperando' },
      { canal: 'whatsapp', fromMe: false, snippet: 'Cerramos las 8 acreditaciones, gracias!', hace: 'hace 3 mes', estado: null },
    ],
    ppsAnteriores: [
      { cohorte: '2026-1', orientacion: 'Clínica', cupos: 8, estado: 'Finalizada', fin: 'feb 2026' },
    ],
  },
  {
    id: 'in-03', instId: 'gutierrez',
    alumno: { nombre: 'Valentina Ríos', legajo: '79002', email: 'valentina.rios@uflouni.edu.ar' },
    institucion: {
      nombre: 'Hospital Gutiérrez', localidad: 'Recoleta, CABA',
      direccion: 'Gallo 1330', referente: 'María González',
      email: 'docencia.psico@gutierrez.gob.ar', telefono: '+54 11 4962-9200', tutor: 'Lic. F. Bianchi',
    },
    convenioStatus: 'con', modalidad: 'Presencial · clínica pediátrica',
    descripcion: 'Prácticas en el servicio de salud mental infantojuvenil. Martes y jueves.',
    estado: 'Realizando convenio', notas: 'Convenio en circuito de firma. Falta la contrafirma de rectorado.', daysSinceUpdate: 2, createdLabel: '24 may',
    hermesPrioritized: false,
    activity: { mails: 5, whatsapps: 4 },
    hermes: {
      sugerencia: 'María González confirmó 4 cupos para la cohorte 2026-2 (mar/jue 14h). El convenio ya está en circuito. No hace falta acción tuya hasta que rectorado contrafirme.',
      requiereDecision: false,
    },
    historial: [
      { canal: 'whatsapp', fromMe: false, snippet: 'Confirmado! 4 cupos, mar y jue 14h', hace: 'hace 5 d', estado: null },
      { canal: 'whatsapp', fromMe: true, snippet: 'Buenísimo María, gracias. Te paso la lista', hace: 'hace 5 d', estado: null },
      { canal: 'mail', fromMe: true, snippet: 'Convenio 2026-2 para circuito de firma', hace: 'hace 3 d', estado: null },
    ],
    ppsAnteriores: [
      { cohorte: '2025-2', orientacion: 'Clínica', cupos: 4, estado: 'Finalizada', fin: 'dic 2025' },
    ],
  },
  {
    id: 'in-04', instId: 'cesac8',
    alumno: { nombre: 'Joaquín Medina', legajo: '77530', email: 'joaquin.medina@uflouni.edu.ar' },
    institucion: {
      nombre: 'CESAC Nº 8', localidad: 'La Boca, CABA',
      direccion: 'Olavarría 2842', referente: 'Lic. Verónica P.',
      email: '', telefono: '+54 11 4302-9988', tutor: '',
    },
    convenioStatus: 'sin', modalidad: 'Presencial · comunitaria',
    descripcion: 'Atención primaria en salud mental comunitaria. Lunes y miércoles.',
    estado: 'En conversaciones', notas: '', daysSinceUpdate: 3, createdLabel: '23 may',
    hermesPrioritized: false,
    activity: { mails: 0, whatsapps: 6 },
    hermes: {
      sugerencia: 'El alumno ya viene hablando con la Lic. Verónica por WhatsApp. Falta el mail de contacto institucional para mandar el convenio formal. Conviene pedírselo en el próximo mensaje.',
      requiereDecision: true,
      motivo: 'No hay convenio vigente con CESAC 8 y falta el dato de contacto formal. Definí si avanzás con la gestión del convenio.',
    },
    historial: [
      { canal: 'whatsapp', fromMe: false, snippet: 'Sí, tenemos lugar para 2 practicantes', hace: 'hace 3 d', estado: 'esperando' },
    ],
    ppsAnteriores: [],
  },
  {
    id: 'in-05', instId: 'liens',
    alumno: { nombre: 'Lucía Paz', legajo: '78890', email: 'lucia.paz@uflouni.edu.ar' },
    institucion: {
      nombre: 'Centro Liens', localidad: 'Caballito, CABA',
      direccion: 'Av. Rivadavia 5200', referente: 'Andrea Pereyra',
      email: 'info@liens.com.ar', telefono: '', tutor: 'Lic. Andrea Pereyra',
    },
    convenioStatus: 'sin', modalidad: 'Híbrida · clínica',
    descripcion: 'Atención psicológica en consultorios externos. Posibilidad de modalidad mixta.',
    estado: 'Pendiente', notas: '', daysSinceUpdate: 5, createdLabel: '21 may',
    hermesPrioritized: false,
    activity: { mails: 2, whatsapps: 0 },
    hermes: {
      sugerencia: 'Liens respondió favorable y quiere 4 cupos. Falta cerrar fecha de inicio. Ya redacté un borrador con la franja del año pasado, listo para revisar.',
      requiereDecision: false,
    },
    historial: [
      { canal: 'mail', fromMe: false, snippet: 'Sí queremos seguir! Necesitaríamos 4 cupos', hace: 'hace 5 d', estado: 'esperando' },
      { canal: 'mail', fromMe: true, snippet: 'Continuidad 2026 — ¿les interesa abrir cohorte?', hace: 'hace 10 d', estado: null },
    ],
    ppsAnteriores: [
      { cohorte: '2025-1', orientacion: 'Clínica', cupos: 5, estado: 'Finalizada', fin: 'abr 2025' },
    ],
  },
  {
    id: 'in-06', instId: null,
    alumno: { nombre: 'Martín Quiroga', legajo: '79115', email: 'martin.quiroga@uflouni.edu.ar' },
    institucion: {
      nombre: 'Hospital Joaquín Castellanos', localidad: 'Güemes, Salta',
      direccion: 'Av. San Martín 450', referente: 'Dra. L. Cabrera',
      email: 'rrhh@hjcastellanos.gob.ar', telefono: '+54 387 491-2200', tutor: '',
    },
    convenioStatus: 'no_catalogada', modalidad: 'Presencial · clínica',
    descripcion: 'Servicio de salud mental. El alumno es de Salta y propone hacer la práctica allá.',
    estado: 'Pendiente', notas: '', daysSinceUpdate: 0, createdLabel: 'hoy',
    hermesPrioritized: false,
    activity: { mails: 1, whatsapps: 0 },
    hermes: {
      sugerencia: 'Institución fuera del catálogo. 3 alumnos pidieron esta institución en los últimos 90 días — puede valer la pena catalogarla. No tengo historial de Gmail/WhatsApp porque no está en la lista PPS.',
      requiereDecision: false,
    },
    noCatalogadaInfo: { pedidos90d: 3 },
    historial: [],
    ppsAnteriores: [],
  },
  {
    id: 'in-07', instId: null,
    alumno: { nombre: 'Sofía Lazarte', legajo: '78677', email: 'sofia.lazarte@uflouni.edu.ar' },
    institucion: {
      nombre: 'Fundación Makarios', localidad: 'San Isidro, Bs. As.',
      direccion: 'Belgrano 1500', referente: '',
      email: '', telefono: '+54 11 4747-8080', tutor: '',
    },
    convenioStatus: 'no_catalogada', modalidad: 'Presencial · comunitaria',
    descripcion: 'ONG de acompañamiento social. El alumno hace voluntariado allí y propone formalizar la PPS.',
    estado: 'Pendiente', notas: '', daysSinceUpdate: 2, createdLabel: '24 may',
    hermesPrioritized: false,
    activity: { mails: 0, whatsapps: 0 },
    hermes: {
      sugerencia: 'Institución fuera del catálogo y sin datos de contacto formal (falta referente y mail). 1 alumno la pidió en los últimos 90 días. Conviene pedirle al alumno los datos de contacto antes de evaluar catalogarla.',
      requiereDecision: false,
    },
    noCatalogadaInfo: { pedidos90d: 1 },
    historial: [],
    ppsAnteriores: [],
  },
  // History
  {
    id: 'in-08', instId: 'ineba',
    alumno: { nombre: 'Bruno Vega', legajo: '75002', email: 'bruno.vega@uflouni.edu.ar' },
    institucion: {
      nombre: 'INEBA', localidad: 'Congreso, CABA',
      direccion: 'Guardia Vieja 4435', referente: 'Dr. Fernández',
      email: 'docencia@ineba.net', telefono: '+54 11 5550-1234', tutor: 'Lic. R. Mansilla',
    },
    convenioStatus: 'con', modalidad: 'Presencial · investigación',
    descripcion: 'PPS en el área de neuropsicología e investigación.',
    estado: 'Realizada', notas: 'Convenio firmado y cohorte iniciada.', daysSinceUpdate: 14, createdLabel: '12 may',
    hermesPrioritized: false,
    activity: { mails: 4, whatsapps: 0 },
    hermes: { sugerencia: 'Gestión cerrada con éxito. Cohorte 2026-2 en curso.', requiereDecision: false },
    historial: [
      { canal: 'mail', fromMe: false, snippet: 'Confirmamos 6 cupos. Cierra el 29.', hace: 'hace 14 d', estado: null },
    ],
    ppsAnteriores: [
      { cohorte: '2025-2', orientacion: 'Educacional', cupos: 6, estado: 'Finalizada', fin: 'dic 2025' },
    ],
  },
];

// ─── EGRESO — solicitudes de finalización ────────────────────────────
// hermes.estado: 'aprobado' | 'atencion' | 'critico' | 'procesando'
// estado: Pendiente | En Proceso SAC | Finalizada
const SOL_EGRESO = [
  {
    id: 'eg-01',
    alumno: { nombre: 'Renata Coria', legajo: '74880' }, createdLabel: '24 may',
    institucion: 'Hospital Italiano', estado: 'Pendiente',
    horasDeclaradas: 40, horasLanzamiento: 40,
    docs: {
      planillaHoras: [{ filename: 'planilla_horas_coria.pdf' }],
      informe: [{ filename: 'informe_final_coria.pdf', chars: 4820 }],
      asistencia: [{ filename: 'asistencia_coria.pdf' }],
    },
    sugerenciasAlumno: 'Excelente acompañamiento del tutor. Recomendaría más espacios de supervisión grupal.',
    hermes: {
      estado: 'aprobado',
      checks: [
        { ok: true, label: 'Horas declaradas (40h) coinciden con el lanzamiento original' },
        { ok: true, label: 'El informe final cubre los objetivos del programa' },
        { ok: true, label: 'Fechas de asistencia dentro del rango activo de la PPS' },
        { ok: true, label: 'Sin solapamiento con otras PPS de la alumna' },
      ],
      issues: [],
    },
  },
  {
    id: 'eg-02',
    alumno: { nombre: 'Iván Torres', legajo: '75440' }, createdLabel: '23 may',
    institucion: 'CESAC Nº 8', estado: 'Pendiente',
    horasDeclaradas: 42, horasLanzamiento: 42,
    docs: {
      planillaHoras: [{ filename: 'horas_torres.pdf' }],
      informe: [{ filename: 'informe_torres.pdf', chars: 5210 }],
      asistencia: [{ filename: 'asistencia_torres.pdf' }],
    },
    sugerenciasAlumno: '',
    hermes: {
      estado: 'aprobado',
      checks: [
        { ok: true, label: 'Horas declaradas (42h) coinciden con el lanzamiento' },
        { ok: true, label: 'El informe final cubre los objetivos esperados' },
        { ok: true, label: 'Fechas de asistencia dentro del rango activo' },
        { ok: true, label: 'Sin solapamiento con otras PPS del alumno' },
      ],
      issues: [],
    },
  },
  {
    id: 'eg-03',
    alumno: { nombre: 'Florencia Ledesma', legajo: '76920' }, createdLabel: '22 may',
    institucion: 'Hospital Gutiérrez', estado: 'Pendiente',
    horasDeclaradas: 45, horasLanzamiento: 40,
    docs: {
      planillaHoras: [{ filename: 'horas_ledesma.pdf' }],
      informe: [{ filename: 'informe_ledesma.pdf', chars: 3900 }],
      asistencia: [{ filename: 'asistencia_ledesma.pdf' }],
    },
    sugerenciasAlumno: 'Hice horas extra cubriendo un taller, espero que cuenten.',
    hermes: {
      estado: 'atencion',
      checks: [
        { ok: true, label: 'El informe final cubre los objetivos del programa' },
        { ok: true, label: 'Fechas de asistencia dentro del rango activo' },
        { ok: true, label: 'Sin solapamiento con otras PPS de la alumna' },
      ],
      issues: [
        { sev: 'warn', label: 'Declara 45h pero el lanzamiento son 40h. ¿Reconocemos las 5h extra?', cita: 'Planilla de horas: total 45h (suma de 9 jornadas de 5h).', ref: 'Lanzamiento PPS Gutiérrez 2026-1: 40h previstas.' },
      ],
    },
  },
  {
    id: 'eg-04',
    alumno: { nombre: 'Nahuel Bravo', legajo: '77001' }, createdLabel: '21 may',
    institucion: 'Centro Liens', estado: 'En Proceso SAC',
    horasDeclaradas: 40, horasLanzamiento: 40,
    docs: {
      planillaHoras: [{ filename: 'horas_bravo.pdf' }],
      informe: [{ filename: 'informe_bravo.pdf', chars: 340 }],
      asistencia: [{ filename: 'asistencia_bravo.pdf' }],
    },
    sugerenciasAlumno: '',
    hermes: {
      estado: 'atencion',
      checks: [
        { ok: true, label: 'Horas declaradas (40h) coinciden con el lanzamiento' },
        { ok: true, label: 'Fechas de asistencia dentro del rango activo' },
      ],
      issues: [
        { sev: 'warn', label: 'El informe no menciona el eje "intervención comunitaria" que figura en el programa', cita: 'Informe final: foco exclusivo en atención individual.', ref: 'Programa Liens: incluye eje de intervención comunitaria.' },
        { sev: 'warn', label: 'El informe es breve (340 caracteres) — revisá que esté completo', cita: 'Informe final: 340 caracteres.', ref: 'Promedio de informes aprobados: ~4.000 caracteres.' },
      ],
    },
  },
  {
    id: 'eg-05',
    alumno: { nombre: 'Camilo Ruiz', legajo: '78230' }, createdLabel: '20 may',
    institucion: 'Hospital Borda', estado: 'Pendiente',
    horasDeclaradas: 40, horasLanzamiento: 40,
    docs: {
      planillaHoras: [{ filename: 'horas_ruiz.pdf' }],
      informe: [{ filename: 'informe_ruiz.pdf', chars: 210 }],
      asistencia: [{ filename: 'asistencia_ruiz.pdf' }],
    },
    sugerenciasAlumno: '',
    hermes: {
      estado: 'critico',
      checks: [],
      issues: [
        { sev: 'crit', label: 'Fechas firmadas en la planilla anteriores al inicio del lanzamiento', cita: 'Planilla de asistencia: primera jornada 02/03/2026.', ref: 'Lanzamiento Borda 2026-1: inicio 15/03/2026.' },
        { sev: 'crit', label: 'Informe final con menos de 500 caracteres — probable archivo vacío o incompleto', cita: 'Informe final: 210 caracteres.', ref: 'Mínimo razonable: 500 caracteres.' },
      ],
    },
  },
  {
    id: 'eg-06',
    alumno: { nombre: 'Delfina Aranda', legajo: '79320' }, createdLabel: 'hoy',
    institucion: 'INEBA', estado: 'Pendiente',
    horasDeclaradas: 40, horasLanzamiento: 40,
    docs: {
      planillaHoras: [{ filename: 'horas_aranda.pdf' }],
      informe: [{ filename: 'informe_aranda.pdf', chars: 0 }],
      asistencia: [{ filename: 'asistencia_aranda.pdf' }],
    },
    sugerenciasAlumno: '',
    hermes: { estado: 'procesando', checks: [], issues: [] },
  },
  // History
  {
    id: 'eg-07',
    alumno: { nombre: 'Gael Moreno', legajo: '73110' }, createdLabel: '08 may',
    institucion: 'Manantiales', estado: 'Finalizada',
    horasDeclaradas: 40, horasLanzamiento: 40,
    docs: {
      planillaHoras: [{ filename: 'horas_moreno.pdf' }],
      informe: [{ filename: 'informe_moreno.pdf', chars: 4500 }],
      asistencia: [{ filename: 'asistencia_moreno.pdf' }],
    },
    sugerenciasAlumno: '',
    hermes: {
      estado: 'aprobado',
      checks: [
        { ok: true, label: 'Horas declaradas (40h) coinciden con el lanzamiento' },
        { ok: true, label: 'El informe final cubre los objetivos del programa' },
        { ok: true, label: 'Fechas de asistencia dentro del rango activo' },
        { ok: true, label: 'Sin solapamiento con otras PPS del alumno' },
      ],
      issues: [],
    },
  },
];

// ─── CORRECCIONES — simple, sin Hermes ───────────────────────────────
// tipo: 'modificacion' | 'nueva'
// estado: 'pendiente' | 'aprobada' | 'rechazada'
const SOL_CORRECCIONES = [
  {
    id: 'co-01', tipo: 'modificacion', tipoModificacion: 'horas',
    alumno: { nombre: 'Pilar Acosta', legajo: '78115' }, estado: 'pendiente', createdLabel: '25 may',
    practica: { institucion: 'Hospital Gutiérrez', cohorte: '2026-1' },
    cambios: [{ campo: 'Horas acreditadas', de: '40 h', a: '44 h' }],
    motivo: 'Cubrí 4 horas adicionales en el taller de juego. Adjunto la constancia firmada por el tutor.',
    docsAdjuntos: [{ filename: 'constancia_horas_extra.pdf' }],
  },
  {
    id: 'co-02', tipo: 'modificacion', tipoModificacion: 'fechas',
    alumno: { nombre: 'Benjamín Coll', legajo: '77640' }, estado: 'pendiente', createdLabel: '24 may',
    practica: { institucion: 'Centro Liens', cohorte: '2026-1' },
    cambios: [
      { campo: 'Fecha de finalización', de: '30 jun 2026', a: '14 jul 2026' },
    ],
    motivo: 'Extendí dos semanas por pedido del tutor para cerrar un seguimiento. Adjunto el aval.',
    docsAdjuntos: [{ filename: 'aval_extension.pdf' }],
  },
  {
    id: 'co-03', tipo: 'modificacion', tipoModificacion: 'institucion',
    alumno: { nombre: 'Mora Giménez', legajo: '78990' }, estado: 'pendiente', createdLabel: '23 may',
    practica: { institucion: 'CESAC Nº 8', cohorte: '2026-1' },
    cambios: [
      { campo: 'Institución', de: 'CESAC Nº 8', a: 'CESAC Nº 15' },
    ],
    motivo: 'Me reasignaron de centro de salud por cercanía a mi domicilio. Adjunto la nota del coordinador.',
    docsAdjuntos: [{ filename: 'nota_reasignacion.pdf' }],
  },
  {
    id: 'co-04', tipo: 'nueva',
    alumno: { nombre: 'Thiago Vera', legajo: '79410' }, estado: 'pendiente', createdLabel: '22 may',
    institucionPropuesta: 'Centro de Día Pasos', modalidad: 'Presencial · comunitaria',
    horasEstimadas: 40, fechaFin: '20 nov 2026',
    informeAdjunto: true,
    docsAdjuntos: [
      { filename: 'propuesta_pps_pasos.pdf' },
      { filename: 'aval_institucion.pdf' },
    ],
    motivo: 'Trabajo en el Centro de Día Pasos y propongo formalizar mi PPS allí. Adjunto propuesta y aval institucional.',
  },
  // History
  {
    id: 'co-05', tipo: 'modificacion', tipoModificacion: 'horas',
    alumno: { nombre: 'Olivia Sanz', legajo: '76330' }, estado: 'aprobada', createdLabel: '18 may',
    practica: { institucion: 'Hospital Borda', cohorte: '2025-2' },
    cambios: [{ campo: 'Horas acreditadas', de: '38 h', a: '40 h' }],
    motivo: 'Faltaban 2 horas de una jornada que no se había cargado.',
    docsAdjuntos: [{ filename: 'planilla_corregida.pdf' }],
    notasAdmin: 'Verificado contra planilla. Aprobado.',
  },
  {
    id: 'co-06', tipo: 'nueva',
    alumno: { nombre: 'Lautaro Méndez', legajo: '77820' }, estado: 'rechazada', createdLabel: '15 may',
    institucionPropuesta: 'Consultorio particular', modalidad: 'Presencial · clínica',
    horasEstimadas: 40, fechaFin: '10 dic 2026',
    informeAdjunto: false,
    docsAdjuntos: [],
    motivo: 'Propongo hacer la PPS en el consultorio de un familiar.',
    comentarioRechazo: 'No se admiten PPS en consultorios particulares de familiares por conflicto de interés. Faltan además aval institucional e informe.',
  },
];

const SOL_PRIVACY = {
  texto: 'Hermes ve historial de Gmail + WhatsApp (lista PPS) para 50 instituciones activas.',
};

Object.assign(window, { SOL_INGRESO, SOL_EGRESO, SOL_CORRECCIONES, SOL_PRIVACY });
