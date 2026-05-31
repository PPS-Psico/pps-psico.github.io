/* global window */
// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS · datos mock
//
// Las formas (shapes) replican las reales del código:
//   · MetricsKPIs            → src/hooks/useMetricsData.ts
//   · calculateDashboardMetrics → src/utils/metricsCalculations.ts
//
// Cada KPI lleva { value, list } para el drill-down (modal). En producción
// `value`/`list` salen del RPC `get_admin_metrics_kpis` + las listas de
// `metricsLists.ts`. Acá los generamos deterministas para que el modal
// muestre exactamente `value` filas.
// ──────────────────────────────────────────────────────────────────────────

// ── Pools para generar nombres/instituciones realistas ───────────────────
const NOMBRES = [
  'Sofía Pereyra', 'Marcos Rodríguez', 'Lucía Bertinotti', 'Federico Larrea',
  'Camila Ruiz', 'Joaquín Suárez', 'Valentina Gómez', 'Tomás Ferreyra',
  'Martina Acosta', 'Ignacio Sosa', 'Julieta Medina', 'Bruno Cabrera',
  'Agustina Vega', 'Nicolás Páez', 'Florencia Ledesma', 'Mateo Quiroga',
  'Delfina Roldán', 'Santiago Ojeda', 'Carolina Vera', 'Lautaro Benítez',
  'Micaela Núñez', 'Gonzalo Ramírez', 'Antonella Ríos', 'Facundo Molina',
  'Rocío Ibáñez', 'Emiliano Castro', 'Pilar Domínguez', 'Tobías Herrera',
  'Brenda Figueroa', 'Maximiliano Ponce', 'Abril Sandoval', 'Thiago Méndez',
  'Catalina Aguirre', 'Lucas Villalba', 'Renata Coria', 'Bautista Salgado',
  'Morena Escobar', 'Benjamín Cáceres', 'Guadalupe Maidana', 'Ramiro Peralta',
];
const INSTITUCIONES_POOL = [
  'Hospital Borda', 'Hospital Pirovano', 'CESAC N° 8', 'Hospital Tobar García',
  'Hospital Álvarez', 'Centro Liens', 'Hospital Naval', 'Fundación INECO',
  'Hospital Moyano', 'Escuela N° 14 DE 9', 'Hospital Rivadavia', 'CeSAC N° 24',
  'Hospital Argerich', 'Centro Aranguren', 'Hospital Durand', 'EMAC Palermo',
];
const ORIENTACIONES = ['Clínica', 'Educacional', 'Laboral', 'Comunitaria', 'Sin definir'];

function mulberry(seed) { return () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Genera `n` alumnos deterministas. opts.horas → agrega horas; opts.inst → institución
function genStudents(n, seed, opts = {}) {
  const rng = mulberry(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const nombre = NOMBRES[Math.floor(rng() * NOMBRES.length)];
    const legajo = String(20000 + Math.floor(rng() * 9999));
    const row = { nombre, legajo };
    if (opts.inst) row.institucion = INSTITUCIONES_POOL[Math.floor(rng() * INSTITUCIONES_POOL.length)];
    if (opts.horas) row.horas = opts.horasBase + Math.floor(rng() * opts.horasSpread);
    if (opts.anio) row.detalle = opts.anio;
    out.push(row);
  }
  return out;
}

function genInst(n, seed, label) {
  const rng = mulberry(seed);
  const pool = [...INSTITUCIONES_POOL];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push({ nombre: pool.splice(idx, 1)[0], legajo: label, cupos: 2 + Math.floor(rng() * 8) });
  }
  return out;
}

// ── Construye el set de KPIs de un año a partir de los conteos base ───────
function buildYear(year, c) {
  return {
    target_year: year,
    // — Banda matrícula —
    matriculaGenerada: { value: c.matriculaGenerada, list: genStudents(c.matriculaGenerada, year * 11, { anio: `Ingresó en ${year}` }) },
    alumnosFinalizados: { value: c.finalizados, list: genStudents(c.finalizados, year * 13, { inst: true, horas: true, horasBase: 250, horasSpread: 120 }) },
    matriculaActiva: { value: c.activa, list: genStudents(c.activa, year * 17, { inst: true }) },
    // — Banda seguimiento —
    sinPps: { value: c.sinPps, list: genStudents(c.sinPps, year * 19) },
    proximosFinalizar: { value: c.proximos, list: genStudents(c.proximos, year * 23, { inst: true, horas: true, horasBase: 230, horasSpread: 60 }) },
    haciendoPps: { value: c.haciendo, list: genStudents(c.haciendo, year * 29, { inst: true, horas: true, horasBase: 40, horasSpread: 180 }) },
    ingresantes: { value: c.matriculaGenerada, list: genStudents(c.matriculaGenerada, year * 11, { anio: `Ingresó en ${year}` }) },
    // — Banda instituciones —
    ppsLanzadas: { value: c.lanzadas, list: genInst(Math.min(c.lanzadas, INSTITUCIONES_POOL.length), year * 31, 'Lanzada') },
    institucionesActivas: { value: c.instActivas, list: genInst(c.instActivas, year * 37, 'Activa') },
    cuposOfrecidos: { value: c.cupos, list: genInst(Math.min(c.lanzadas, INSTITUCIONES_POOL.length), year * 31, 'Cupos') },
    nuevosConvenios: { value: c.convenios, list: genInst(c.convenios, year * 41, `Convenio ${year}`) },
    // — Series —
    orientation_distribution: c.orient,
    trends: c.trends,
    // — Actividad de Hermes (PLACEHOLDER — enchufar a gestion_log) —
    hermesConversaciones: { value: c.hermesConv, list: [] },
  };
}

// Conteos base por año (derivados a mano para que la narrativa cierre).
const METRICS = {
  2026: buildYear(2026, {
    matriculaGenerada: 150, finalizados: 64, activa: 312,
    sinPps: 41, proximos: 28, haciendo: 187,
    lanzadas: 38, instActivas: 14, cupos: 96, convenios: 5,
    orient: { 'Clínica': 142, 'Educacional': 58, 'Laboral': 31, 'Comunitaria': 47, 'Sin definir': 34 },
    trends: { matricula_generada: 12, acreditados: 18, activos: 9 },
    hermesConv: 342,
  }),
  2025: buildYear(2025, {
    matriculaGenerada: 134, finalizados: 54, activa: 286,
    sinPps: 37, proximos: 24, haciendo: 168,
    lanzadas: 34, instActivas: 12, cupos: 84, convenios: 4,
    orient: { 'Clínica': 128, 'Educacional': 49, 'Laboral': 27, 'Comunitaria': 39, 'Sin definir': 43 },
    trends: { matricula_generada: 54, acreditados: 22, activos: 14 },
    hermesConv: 0, // Hermes entró en operación en 2026
  }),
  2024: buildYear(2024, {
    matriculaGenerada: 87, finalizados: 38, activa: 251,
    sinPps: 44, proximos: 19, haciendo: 141,
    lanzadas: 29, instActivas: 11, cupos: 71, convenios: 6,
    orient: { 'Clínica': 104, 'Educacional': 41, 'Laboral': 22, 'Comunitaria': 28, 'Sin definir': 56 },
    trends: { matricula_generada: 358, acreditados: 31, activos: 19 },
    hermesConv: 0,
  }),
};

// ── Series compartidas (no dependen del año seleccionado) ─────────────────
// enrollment_evolution: mismos valores que metricsCalculations.ts
const ENROLLMENT_EVOLUTION = [
  { year: '2022', value: 19, label: 'Nuevos inscriptos' },
  { year: '2023', value: 87, label: 'Nuevos inscriptos' },
  { year: '2024', value: 87, label: 'Nuevos inscriptos' },
  { year: '2025', value: 134, label: 'Nuevos inscriptos' },
  { year: '2026', value: 150, label: 'Proyección: 0 reales + 150 proyectados', isProjection: true },
];
// trend_data: matrícula activa a fin de cada año (2022→target)
const TREND_DATA = [
  { year: '2022', value: 96, label: 'Matrícula activa a fin de 2022' },
  { year: '2023', value: 164, label: 'Matrícula activa a fin de 2023' },
  { year: '2024', value: 251, label: 'Matrícula activa a fin de 2024' },
  { year: '2025', value: 286, label: 'Matrícula activa a fin de 2025' },
  { year: '2026', value: 312, label: 'Matrícula activa a fin de 2026' },
];

// ── EMBUDO de PPS (solicitudes → selección → activas → cierres) ───────────
// El coordinador prioriza ver dónde se cae gente. Por año.
const FUNNEL = {
  2026: [
    { key: 'solicitudes',    label: 'Solicitudes recibidas', value: 248, note: 'Alumnos que pidieron una PPS', tone: 'accent' },
    { key: 'preseleccion',   label: 'Preseleccionados',      value: 196, note: 'Inscriptos en una convocatoria', tone: 'accent' },
    { key: 'seleccionados',  label: 'Seleccionados',         value: 154, note: 'Asignados a un cupo', tone: 'ai' },
    { key: 'activas',        label: 'PPS activas',           value: 132, note: 'Práctica en curso', tone: 'ok' },
    { key: 'finalizadas',    label: 'Finalizadas y acreditadas', value: 64, note: 'Cerradas en el ciclo', tone: 'ok' },
  ],
  2025: [
    { key: 'solicitudes',    label: 'Solicitudes recibidas', value: 214, note: 'Alumnos que pidieron una PPS', tone: 'accent' },
    { key: 'preseleccion',   label: 'Preseleccionados',      value: 171, note: 'Inscriptos en una convocatoria', tone: 'accent' },
    { key: 'seleccionados',  label: 'Seleccionados',         value: 138, note: 'Asignados a un cupo', tone: 'ai' },
    { key: 'activas',        label: 'PPS activas',           value: 119, note: 'Práctica en curso', tone: 'ok' },
    { key: 'finalizadas',    label: 'Finalizadas y acreditadas', value: 54, note: 'Cerradas en el ciclo', tone: 'ok' },
  ],
  2024: [
    { key: 'solicitudes',    label: 'Solicitudes recibidas', value: 168, note: 'Alumnos que pidieron una PPS', tone: 'accent' },
    { key: 'preseleccion',   label: 'Preseleccionados',      value: 131, note: 'Inscriptos en una convocatoria', tone: 'accent' },
    { key: 'seleccionados',  label: 'Seleccionados',         value: 104, note: 'Asignados a un cupo', tone: 'ai' },
    { key: 'activas',        label: 'PPS activas',           value: 88,  note: 'Práctica en curso', tone: 'ok' },
    { key: 'finalizadas',    label: 'Finalizadas y acreditadas', value: 38, note: 'Cerradas en el ciclo', tone: 'ok' },
  ],
};

// ── Ocupación de cupos por área (filas clickeables del dashboard) ─────────
function buildOccupancy(year) {
  const dist = METRICS[year].orientation_distribution;
  const keyMap = { 'Clínica': 'clinica', 'Educacional': 'educacional', 'Laboral': 'laboral', 'Comunitaria': 'comunitaria', 'Sin definir': 'sindefinir' };
  return ORIENTACIONES.map((o, i) => ({
    area: o, orient: keyMap[o], value: dist[o] || 0,
    list: genStudents(dist[o] || 0, year * 7 + i, { inst: true }),
  }));
}

// ── LÍNEA DE TIEMPO · hitos del ciclo (mock) ──────────────────────────────
// En producción: actividad agregada de convocatorias/prácticas/finalizaciones.
const TIMELINE = {
  2026: [
    { mes: 'Mar', fecha: '04 mar', tipo: 'lanzamiento', titulo: '12 PPS lanzadas para el 1.º cuatrimestre', detalle: 'Borda, Pirovano, CESAC 8 y 9 más.', n: 12, tone: 'accent' },
    { mes: 'Mar', fecha: '22 mar', tipo: 'inscripcion', titulo: 'Pico de inscripciones', detalle: '94 alumnos se inscribieron en una semana.', n: 94, tone: 'accent' },
    { mes: 'Abr', fecha: '10 abr', tipo: 'seleccion', titulo: 'Selección de la primera tanda', detalle: '78 alumnos asignados a cupos.', n: 78, tone: 'ai' },
    { mes: 'May', fecha: '02 may', tipo: 'inicio', titulo: 'Arranque de prácticas', detalle: '64 prácticas iniciaron en mayo.', n: 64, tone: 'ok' },
    { mes: 'Jun', fecha: '18 jun', tipo: 'cierre', titulo: 'Primeras finalizaciones', detalle: '21 acreditaciones cerradas.', n: 21, tone: 'ok' },
    { mes: 'Ago', fecha: '05 ago', tipo: 'lanzamiento', titulo: '14 PPS lanzadas para el 2.º cuatrimestre', detalle: 'Naval, Tobar García y 12 más.', n: 14, tone: 'accent' },
    { mes: 'Sep', fecha: '20 sep', tipo: 'convenio', titulo: '3 convenios nuevos firmados', detalle: 'INECO, EMAC Palermo y Centro Aranguren.', n: 3, tone: 'ok' },
    { mes: 'Nov', fecha: '12 nov', tipo: 'cierre', titulo: 'Cierre de ciclo', detalle: '43 acreditaciones en el tramo final.', n: 43, tone: 'ok' },
  ],
  2025: [
    { mes: 'Mar', fecha: '06 mar', tipo: 'lanzamiento', titulo: '10 PPS lanzadas', detalle: '1.º cuatrimestre 2025.', n: 10, tone: 'accent' },
    { mes: 'Abr', fecha: '14 abr', tipo: 'seleccion', titulo: 'Selección de tanda', detalle: '66 alumnos asignados.', n: 66, tone: 'ai' },
    { mes: 'May', fecha: '05 may', tipo: 'inicio', titulo: 'Arranque de prácticas', detalle: '57 prácticas iniciaron.', n: 57, tone: 'ok' },
    { mes: 'Oct', fecha: '22 oct', tipo: 'cierre', titulo: 'Cierre de ciclo', detalle: '54 acreditaciones en el año.', n: 54, tone: 'ok' },
  ],
  2024: [
    { mes: 'Mar', fecha: '11 mar', tipo: 'lanzamiento', titulo: '8 PPS lanzadas', detalle: '1.º cuatrimestre 2024.', n: 8, tone: 'accent' },
    { mes: 'May', fecha: '07 may', tipo: 'inicio', titulo: 'Arranque de prácticas', detalle: '44 prácticas iniciaron.', n: 44, tone: 'ok' },
    { mes: 'Nov', fecha: '19 nov', tipo: 'cierre', titulo: 'Cierre de ciclo', detalle: '38 acreditaciones en el año.', n: 38, tone: 'ok' },
  ],
};

const AVAILABLE_YEARS = [2026, 2025, 2024];

// ── Series para sparklines de las hero-métricas (2022→2026) ───────────────
// En producción salen de las mismas RPC anuales; acá las dejamos explícitas.
const HERO_SPARK = {
  matriculaGenerada: [19, 87, 87, 134, 150],
  finalizados:       [22, 29, 38, 54, 64],
  matriculaActiva:   [96, 164, 251, 286, 312],
};
const SPARK_YEARS = [2022, 2023, 2024, 2025, 2026];

// ── TOP instituciones por cupos ocupados (dato distinto a la distribución) ─
// Reemplaza el gráfico redundante. orient = orientación dominante de la inst.
function buildTopInst(year) {
  const rng = mulberry(year * 97);
  const base = [
    { nombre: 'Hospital Borda', orient: 'clinica' },
    { nombre: 'Hospital Pirovano', orient: 'clinica' },
    { nombre: 'CESAC N° 8', orient: 'comunitaria' },
    { nombre: 'Hospital Tobar García', orient: 'clinica' },
    { nombre: 'Escuela N° 14 DE 9', orient: 'educacional' },
    { nombre: 'Fundación INECO', orient: 'clinica' },
    { nombre: 'EMAC Palermo', orient: 'laboral' },
    { nombre: 'Hospital Álvarez', orient: 'clinica' },
  ];
  const scale = year === 2026 ? 1 : year === 2025 ? 0.88 : 0.74;
  return base.map((b, i) => {
    const ofrecidos = Math.round((14 - i + Math.floor(rng() * 4)) * scale);
    const ocupados = Math.max(1, Math.round(ofrecidos * (0.6 + rng() * 0.38)));
    return {
      ...b, ofrecidos: Math.max(ocupados, ofrecidos), ocupados,
      list: genStudents(ocupados, year * 53 + i, { horas: true, horasBase: 60, horasSpread: 200 }),
    };
  }).sort((a, b) => b.ocupados - a.ocupados);
}

Object.assign(window, {
  METRICS, FUNNEL, TIMELINE, ENROLLMENT_EVOLUTION, TREND_DATA,
  AVAILABLE_YEARS, ORIENTACIONES, buildOccupancy,
  HERO_SPARK, SPARK_YEARS, buildTopInst,
});
