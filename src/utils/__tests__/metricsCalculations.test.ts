import { describe, it, expect } from "@jest/globals";
import { calculateDashboardMetrics } from "../metricsCalculations";

/**
 * Tests de la función maestra de métricas del dashboard.
 *
 * Cubre específicamente los dos fixes recientes:
 *  - convenio_nuevo se guarda como número (smallint), no como texto.
 *  - el estado de inscripción se compara normalizado (case-insensitive),
 *    de modo que "Seleccionado" (como lo guarda la DB) cuente igual que
 *    "seleccionado".
 */

const TARGET_YEAR = 2025;

// Estudiantes con cuenta creada (user_id + user_created_at) en el año objetivo.
const estudiantes = [
  {
    id: "est1",
    nombre: "Ana Clínica",
    legajo: "1001",
    correo: "ana@test.com",
    estado: "Activo",
    user_id: "u1",
    user_created_at: `${TARGET_YEAR}-03-01T10:00:00.000Z`,
  },
  {
    id: "est2",
    nombre: "Beto Laboral",
    legajo: "1002",
    correo: "beto@test.com",
    estado: "Activo",
    user_id: "u2",
    user_created_at: `${TARGET_YEAR}-04-01T10:00:00.000Z`,
  },
  {
    id: "est3",
    nombre: "Caro Finalizada",
    legajo: "1003",
    correo: "caro@test.com",
    estado: "Finalizado",
    user_id: "u3",
    user_created_at: `${TARGET_YEAR - 1}-05-01T10:00:00.000Z`,
    fecha_finalizacion: `${TARGET_YEAR}-06-01`,
  },
];

const lanzamientos = [
  {
    id: "lanz1",
    nombre_pps: "Hospital Italiano",
    orientacion: "Clínica",
    cupos_disponibles: 5,
    fecha_inicio: `${TARGET_YEAR}-03-01`,
  },
  {
    id: "lanz2",
    nombre_pps: "Fábrica RRHH",
    orientacion: "Laboral",
    cupos_disponibles: 3,
    fecha_inicio: `${TARGET_YEAR}-03-15`,
  },
];

// Convocatorias: el estado viene capitalizado como en la DB real.
const convocatorias = [
  {
    id: "conv1",
    estudiante_id: "est1",
    lanzamiento_id: "lanz1",
    estado_inscripcion: "Seleccionado", // <-- caso clave: capitalizado
    created_at: `${TARGET_YEAR}-03-05T10:00:00.000Z`,
  },
  {
    id: "conv2",
    estudiante_id: "est2",
    lanzamiento_id: "lanz2",
    estado_inscripcion: "Inscripto",
    created_at: `${TARGET_YEAR}-03-20T10:00:00.000Z`,
  },
];

const practicas = [
  {
    id: "prac1",
    estudiante_id: "est1",
    horas_realizadas: 120,
    estado: "En curso",
    fecha_inicio: `${TARGET_YEAR}-03-10`,
  },
];

const instituciones = [
  {
    id: "inst1",
    nombre: "Hospital Italiano",
    convenio_nuevo: TARGET_YEAR, // <-- número, no string
  },
  {
    id: "inst2",
    nombre: "Vieja Institución",
    convenio_nuevo: TARGET_YEAR - 2,
  },
];

const finalizaciones = [
  {
    id: "fin1",
    estudiante_id: "est3",
    fecha_solicitud: `${TARGET_YEAR}-06-01`,
    estado: "Pendiente",
  },
];

const solicitudes = [
  {
    id: "sol1",
    estado_seguimiento: "En conversaciones",
    actualizacion: `${TARGET_YEAR}-06-01`,
    created_at: `${TARGET_YEAR}-06-01`,
  },
];

// Clon profundo simple (los datos son planos y serializables).
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const buildData = () => ({
  estudiantes: clone(estudiantes),
  lanzamientos: clone(lanzamientos),
  convocatorias: clone(convocatorias),
  practicas: clone(practicas),
  instituciones: clone(instituciones),
  finalizaciones: clone(finalizaciones),
  solicitudes: clone(solicitudes),
});

describe("calculateDashboardMetrics", () => {
  it("no explota con datasets válidos y devuelve la estructura esperada", () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    expect(metrics).toBeDefined();
    expect(metrics.occupancyDistribution).toBeDefined();
    expect(Array.isArray(metrics.enrollmentEvolution)).toBe(true);
  });

  it("cuenta los ingresantes del año por user_created_at", () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    // est1 y est2 crearon cuenta en TARGET_YEAR; est3 en el año previo
    expect(metrics.nuevosIngresantes.value).toBe(2);
    expect(metrics.matriculaGenerada.value).toBe(2);
  });

  it('cuenta a un alumno "Seleccionado" (capitalizado) en la distribución por área', () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    // est1 está Seleccionado en una convocatoria de orientación Clínica
    expect(metrics.occupancyDistribution["Clínica"].length).toBe(1);
    expect(metrics.occupancyDistribution["Clínica"][0].legajo).toBe("1001");
  });

  it("incluye inscriptos en la distribución (estado válido normalizado)", () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    // est2 está Inscripto en una convocatoria Laboral
    expect(metrics.occupancyDistribution["Laboral"].length).toBe(1);
  });

  it("cuenta convenios nuevos comparando convenio_nuevo numérico con el año", () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    // Solo inst1 tiene convenio_nuevo === TARGET_YEAR
    expect(metrics.conveniosNuevos.value).toBe(1);
  });

  it("suma los cupos ofrecidos de los lanzamientos del año", () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    expect(metrics.cuposOfrecidos.value).toBe(8); // 5 + 3
    expect(metrics.ppsLanzadas.value).toBe(2);
  });

  it("detecta alumnos haciendo PPS en curso", () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    // est1 tiene una práctica En curso
    expect(metrics.haciendoPPS.value).toBeGreaterThanOrEqual(1);
  });

  it("marca acreditaciones pendientes desde la tabla de finalizaciones", () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    expect(metrics.acreditacionesPendientes.value).toBe(1);
  });

  it("cuenta solicitudes de gestión en curso (no terminales)", () => {
    const metrics = calculateDashboardMetrics(buildData(), TARGET_YEAR);
    expect(metrics.solicitudesGestion.value).toBe(1);
  });

  it("NO cuenta convenios si convenio_nuevo es de otro año", () => {
    const data = buildData();
    data.instituciones = [{ id: "x", nombre: "Otra", convenio_nuevo: 1999 }];
    const metrics = calculateDashboardMetrics(data, TARGET_YEAR);
    expect(metrics.conveniosNuevos.value).toBe(0);
  });
});
