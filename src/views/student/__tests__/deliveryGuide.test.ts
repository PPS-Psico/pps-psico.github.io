import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
} from "../../../constants";
import { FALLBACK_DELIVERY_AREAS } from "../../../hooks/useAulaEntregas";
import type { MoodleTaskLink } from "../../../hooks/useMoodleTaskLinks";
import type { InformeTask, Practica } from "../../../types";
import { buildGuidedDeliveries } from "../deliveryGuide";

const practice = (overrides: Partial<Practica> = {}): Practica =>
  ({
    id: "practice-1",
    [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Relevamiento Prof.",
    [FIELD_ESPECIALIDAD_PRACTICAS]: "Clínica",
    [FIELD_ESTADO_PRACTICA]: "Finalizada",
    [FIELD_FECHA_FIN_PRACTICAS]: "2026-06-30",
    ...overrides,
  }) as Practica;

describe("deliveryGuide", () => {
  it("prioriza el vínculo exacto lanzamiento + orientación sobre el nombre difuso", () => {
    const links: MoodleTaskLink[] = [
      {
        launchId: "launch-1",
        orientationKey: "laboral",
        moodleId: "1162538",
        name: "Ministerio de Trabajo y Desarrollo Laboral",
        area: "laboral",
        academicYear: 2026,
      },
    ];

    const [delivery] = buildGuidedDeliveries(
      [
        practice({
          [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "launch-1",
          [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Nombre que no coincide",
          [FIELD_ESPECIALIDAD_PRACTICAS]: "Laboral",
        }),
      ],
      [],
      FALLBACK_DELIVERY_AREAS,
      new Date("2026-08-05T12:00:00Z"),
      links
    );

    expect(delivery.institution?.moodleId).toBe("1162538");
    expect(delivery.resolutionSource).toBe("exact");
  });

  it("no reutiliza una tarea confirmada de otra orientación", () => {
    const links: MoodleTaskLink[] = [
      {
        launchId: "launch-kano",
        orientationKey: "laboral",
        moodleId: "1179652",
        name: "Fundación Kano",
        area: "laboral",
        academicYear: 2026,
      },
    ];

    const [delivery] = buildGuidedDeliveries(
      [
        practice({
          [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "launch-kano",
          [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Nombre sin coincidencia",
          [FIELD_ESPECIALIDAD_PRACTICAS]: "Clínica",
        }),
      ],
      [],
      FALLBACK_DELIVERY_AREAS,
      new Date("2026-08-05T12:00:00Z"),
      links
    );

    expect(delivery.institution).toBeNull();
    expect(delivery.resolutionSource).toBe("none");
  });

  it("prioriza una excepción directa para una práctica legacy sin lanzamiento", () => {
    const links: MoodleTaskLink[] = [
      {
        practiceId: "practice-1",
        launchId: "",
        orientationKey: "",
        moodleId: "1085736",
        name: "Randstad",
        area: "laboral",
        academicYear: 2026,
      },
    ];

    const [delivery] = buildGuidedDeliveries(
      [practice({ [FIELD_ESPECIALIDAD_PRACTICAS]: "Laboral" })],
      [],
      FALLBACK_DELIVERY_AREAS,
      new Date("2026-08-05T12:00:00Z"),
      links
    );

    expect(delivery.institution?.moodleId).toBe("1085736");
    expect(delivery.resolutionSource).toBe("exact");
  });

  it("usa el único vínculo del lanzamiento cuando la práctica tiene varias orientaciones", () => {
    const links: MoodleTaskLink[] = [
      {
        launchId: "launch-research",
        orientationKey: "clinica",
        moodleId: "614156",
        name: "Prácticas Clínicas Antiguas",
        area: "clinica",
        academicYear: 2024,
      },
    ];

    const [delivery] = buildGuidedDeliveries(
      [
        practice({
          [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "launch-research",
          [FIELD_ESPECIALIDAD_PRACTICAS]: "Laboral, Educacional, Comunitaria, Clínica",
        }),
      ],
      [],
      FALLBACK_DELIVERY_AREAS,
      new Date("2026-08-05T12:00:00Z"),
      links
    );

    expect(delivery.institution?.moodleId).toBe("614156");
    expect(delivery.resolutionSource).toBe("exact");
  });

  it("no abre una tarea por similitud de nombre si falta el vínculo canónico", () => {
    const deliveries = buildGuidedDeliveries(
      [
        practice(),
        practice({
          id: "practice-2",
          [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Randstad",
          [FIELD_ESPECIALIDAD_PRACTICAS]: "Laboral",
          [FIELD_FECHA_FIN_PRACTICAS]: "2026-08-01",
        }),
      ],
      [],
      FALLBACK_DELIVERY_AREAS,
      new Date("2026-08-05T12:00:00Z")
    );

    expect(deliveries[0]).toMatchObject({
      id: "practice-2",
      statusLabel: "Verificar en el Campus",
      statusTone: "neutral",
    });
    expect(deliveries[1]).toMatchObject({
      id: "practice-1",
      deadlineLabel: "30 de jul de 2026",
      statusLabel: "Verificar en el Campus",
      statusTone: "neutral",
    });
    expect(deliveries[0].institution).toBeNull();
    expect(deliveries[0].resolutionSource).toBe("none");
  });

  it("presenta una nota de Mi Panel como dato informado, no como estado del Campus", () => {
    const task: InformeTask = {
      convocatoriaId: "conv-1",
      practicaId: "practice-1",
      ppsName: "PPS Relevamiento Prof.",
      fechaFinalizacion: "2026-06-30",
      informeSubido: true,
      nota: "Aprobado",
    };

    const [delivery] = buildGuidedDeliveries(
      [practice()],
      [task],
      FALLBACK_DELIVERY_AREAS,
      new Date("2026-07-10T12:00:00Z")
    );

    expect(delivery).toMatchObject({
      statusLabel: "Nota informada",
      statusTone: "info",
    });
  });

  it("identifica una confirmación manual sin llamarla entrega verificada", () => {
    const task: InformeTask = {
      convocatoriaId: "conv-1",
      practicaId: "practice-1",
      ppsName: "PPS Relevamiento Prof.",
      fechaFinalizacion: "2026-06-30",
      informeSubido: true,
      nota: "Entregado (sin corregir)",
    };

    const [delivery] = buildGuidedDeliveries(
      [practice()],
      [task],
      FALLBACK_DELIVERY_AREAS,
      new Date("2026-07-10T12:00:00Z")
    );

    expect(delivery).toMatchObject({
      statusLabel: "Marcada en Mi Panel",
      statusTone: "info",
    });
  });

  it("no fabrica un plazo con la fecha sintética de una tarea", () => {
    const task: InformeTask = {
      convocatoriaId: "conv-1",
      practicaId: "practice-1",
      ppsName: "PPS Relevamiento Prof.",
      fechaFinalizacion: "2026-07-26",
      informeSubido: false,
      nota: "Sin calificar",
    };
    const practiceWithoutEnd = practice({
      [FIELD_FECHA_FIN_PRACTICAS]: null,
    });

    const [delivery] = buildGuidedDeliveries(
      [practiceWithoutEnd],
      [task],
      FALLBACK_DELIVERY_AREAS,
      new Date("2026-07-26T12:00:00Z")
    );

    expect(delivery).toMatchObject({
      deadline: null,
      deadlineLabel: "Sin fecha de cierre",
      statusLabel: "Estado no sincronizado",
    });
  });

  it("excluye prácticas desaprobadas de la guía de entregas", () => {
    const deliveries = buildGuidedDeliveries(
      [practice({ [FIELD_ESTADO_PRACTICA]: "Desaprobada" })],
      [],
      FALLBACK_DELIVERY_AREAS
    );

    expect(deliveries).toEqual([]);
  });

  it("presenta las PPS especiales como entrega libre aunque tengan fecha final", () => {
    const [delivery] = buildGuidedDeliveries(
      [
        practice({
          [FIELD_TIPO_ACTIVIDAD_PRACTICAS]: "actividad_especial",
          [FIELD_FECHA_FIN_PRACTICAS]: "2026-06-30",
        }),
      ],
      [],
      FALLBACK_DELIVERY_AREAS
    );

    expect(delivery).toMatchObject({
      isOpenEnded: true,
      deadline: null,
      deadlineLabel: "Sin fecha de cierre",
    });
  });

  it("retira de Entregas una PPS especial cancelada", () => {
    const deliveries = buildGuidedDeliveries(
      [
        practice({
          [FIELD_TIPO_ACTIVIDAD_PRACTICAS]: "actividad_especial",
          [FIELD_ESTADO_PRACTICA]: "No se pudo concretar",
        }),
      ],
      [],
      FALLBACK_DELIVERY_AREAS
    );

    expect(deliveries).toEqual([]);
  });
});
