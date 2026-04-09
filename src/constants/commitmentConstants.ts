export const COMPROMISO_PPS_VERSION = "2026-04-08-v2";

export const COMPROMISO_PPS_TITLE =
  "Compromiso de Ética y Responsabilidad Profesional del Estudiante";

export const COMPROMISO_PPS_SUBTITLE = "Facultad de Psicología y Ciencias Sociales - UFLO Comahue";

export const COMPROMISO_PPS_INTRO =
  'La aceptación de una vacante en una Práctica Profesional Supervisada (PPS) implica la conformidad total con los siguientes tres bloques de condiciones académicas y éticas, cuya aceptación debe ser ratificada a través de "Mi Panel" antes del inicio de las actividades:';

export const COMPROMISO_PPS_BLOCKS = [
  {
    title: "BLOQUE 1: Régimen de Acreditación y Motivos de Desaprobación",
    intro:
      "Este bloque establece los requisitos mínimos para que la práctica sea válida. Su cumplimiento es obligatorio y no está sujeto a negociación:",
    clauses: [
      {
        label: "Cláusula de Asistencia (80%)",
        text: "Se requiere un mínimo del 80% de asistencia a todas las actividades. Esta es una cláusula de ejecución instantánea: si al finalizar el dispositivo no se alcanza este porcentaje, la PPS se desaprueba automáticamente.",
      },
      {
        label: "Inasistencia sin Aviso",
        text: "Una sola inasistencia sin aviso previo a la institución y a la Coordinación es motivo suficiente para la desaprobación inmediata, independientemente de la justificación de la falta.",
      },
      {
        label: "Doble Instancia de Evaluación",
        text: "La acreditación final está sujeta a dos evaluaciones:",
      },
      {
        label: "Aval Institucional",
        text: "El visto bueno de los tutores (Licenciados en Psicología) es requisito necesario pero no suficiente. La Facultad no cuestiona sus observaciones técnicas ni actitudinales.",
      },
      {
        label: "Evaluación de la Coordinación",
        text: "Auditoría final del ajuste ético y cumplimiento normativo.",
      },
      {
        label: "Seguimiento y Baja Anticipada",
        text: "La Facultad puede dar de baja la PPS en cualquier momento si los informes intermedios indican que el estudiante no se ajusta al encuadre.",
      },
    ],
  },
  {
    title: "BLOQUE 2: Ética Profesional y Representación Institucional",
    intro: "",
    clauses: [
      {
        label: "Representación UFLO",
        text: "El estudiante actúa como representante de la Universidad y debe adecuarse a sus estándares de responsabilidad.",
      },
      {
        label: "Confidencialidad",
        text: "Es obligatorio guardar secreto profesional sobre toda información clínica o institucional.",
      },
      {
        label: "Actitud y Proactividad",
        text: "Se evalúa la iniciativa. Posturas confrontativas o de resistencia serán informadas y afectarán la calificación final.",
      },
    ],
  },
  {
    title: "BLOQUE 3: Compromiso Operativo y Comunicación Responsable",
    intro: "",
    clauses: [
      {
        label: "Comunicación Permanente con la Institución",
        text: "El contacto ante eventualidades debe ser inmediato con los referentes del centro de práctica.",
      },
      {
        label: "Responsabilidad de Documentación",
        text: "El estudiante debe garantizar que sus horas estén firmadas (en prácticas presenciales) y entregar el informe técnico final en un plazo máximo de 30 días corridos.",
      },
      {
        label: "Comunicación con el Coordinador",
        text: "Existe un canal abierto permanente para transmitir disconformidades o dificultades. Informar cualquier complicación de manera temprana es una responsabilidad evaluable del estudiante.",
      },
    ],
  },
] as const;

export const COMPROMISO_PPS_DECLARACION =
  'He leído, comprendo y acepto los términos de estos tres bloques. La confirmación digital de este documento a través de "Mi Panel" dejará constancia formal de mi lectura, aceptación y conformidad con las condiciones establecidas para la PPS.';

export const COMPROMISO_PPS_CHECK_LECTURA =
  "He leído y comprendo íntegramente el contenido de este compromiso institucional.";

export const COMPROMISO_PPS_CHECK_COMPROMISO =
  "Acepto estas condiciones y me comprometo a desempeñarme de acuerdo con estos criterios durante toda la PPS.";

export const COMPROMISO_PPS_FULL_TEXT = [
  COMPROMISO_PPS_TITLE,
  "",
  COMPROMISO_PPS_SUBTITLE,
  "",
  COMPROMISO_PPS_INTRO,
  "",
  ...COMPROMISO_PPS_BLOCKS.flatMap((block) => [
    block.title,
    ...(block.intro ? [block.intro] : []),
    ...block.clauses.map((clause) => `${clause.label}: ${clause.text}`),
    "",
  ]),
  COMPROMISO_PPS_DECLARACION,
  "",
  `1. ${COMPROMISO_PPS_CHECK_LECTURA}`,
  `2. ${COMPROMISO_PPS_CHECK_COMPROMISO}`,
].join("\n");
