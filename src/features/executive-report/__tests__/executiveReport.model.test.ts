import { buildExecutiveReportModel, containsPersonalStudentData } from "../executiveReport.model";
import { testingSnapshot } from "../executiveReport.service";

describe("executive report model", () => {
  it("publishes the exact official 2024 result without minimum-language", () => {
    const current = testingSnapshot(2024, "2024-12-31");
    const previous = testingSnapshot(2023, "2023-12-31");
    const model = buildExecutiveReportModel({
      kind: "annual",
      selected: current,
      previous,
      generatedAt: new Date("2026-07-17T12:00:00Z"),
    });

    expect(model.headline).toBe(
      "El ciclo 2024 cerró con 42 ofertas: 36 de cupo finito que totalizan 270 vacantes documentadas y 6 ofertas sin cupo finito."
    );
    expect(JSON.stringify(model).toLowerCase()).not.toContain("mínimo");
    expect(model.primaryMetrics.find((metric) => metric.id === "capacity")?.value).toBe(270);
  });

  it("compares 2025 with the verified historical 2024 closure", () => {
    const current = testingSnapshot(2025, "2025-12-31");
    const historical = testingSnapshot(2024, "2024-12-31");
    const model = buildExecutiveReportModel({
      kind: "annual",
      selected: current,
      previous: historical,
    });
    const offers = model.primaryMetrics.find((metric) => metric.id === "offers")?.delta;
    const capacity = model.primaryMetrics.find((metric) => metric.id === "capacity")?.delta;

    expect(offers).toMatchObject({ comparable: true, absolute: 39, percent: 92.9 });
    expect(capacity).toMatchObject({ comparable: true, absolute: 282, percent: 104.4 });
    expect(model.comparisonContext).toContain("270 vacantes finitas documentadas");
    expect(model.comparisonContext).toContain("6 ofertas sin cupo prefijado");
  });

  it("does not compare a current YTD capacity against a previous full year", () => {
    const model = buildExecutiveReportModel({
      kind: "management",
      selected: testingSnapshot(2026, "2026-07-17"),
      previous: testingSnapshot(2025, "2025-12-31"),
      managementSeries: [
        testingSnapshot(2024, "2024-12-31"),
        testingSnapshot(2025, "2025-12-31"),
        testingSnapshot(2026, "2026-07-17"),
      ],
    });
    const capacity = model.primaryMetrics.find((metric) => metric.id === "capacity");

    expect(capacity?.delta?.comparable).toBe(false);
    expect(capacity?.delta?.percent).toBeNull();
  });

  it("labels a comparable delta with the prior cycle and the same cutoff", () => {
    const model = buildExecutiveReportModel({
      kind: "annual",
      selected: testingSnapshot(2026, "2026-07-17"),
      previous: testingSnapshot(2025, "2025-07-17"),
    });
    const offers = model.primaryMetrics.find((metric) => metric.id === "offers");

    expect(offers?.delta?.comparable).toBe(true);
    expect(offers?.delta?.referenceLabel).toBe("vs. 2025 al 17/07");
    expect(offers?.deltaUnit).toBe("ofertas");
  });

  it("reports first-selection access from application attempts, not elapsed days", () => {
    const model = buildExecutiveReportModel({
      kind: "annual",
      selected: testingSnapshot(2026, "2026-07-17"),
      previous: testingSnapshot(2025, "2025-07-17"),
      selectionEffort: {
        disponible: true,
        cohorteN: 87,
        primerIntentoN: 61,
        primerIntentoPct: 70.1,
        medianaPostulaciones: 1,
        p25Postulaciones: 1,
        p75Postulaciones: 2,
      },
    });
    const access = model.outcomeMetrics.find((metric) => metric.id === "first-selection-effort");

    expect(access?.label).toBe("Acceso en primera postulación");
    expect(access?.value).toBe(70.1);
    expect(access?.detail).toContain("61 de 87");
    expect(JSON.stringify(model)).not.toContain("Mediana hasta selección");
  });

  it("omits first-selection access when the sequence cannot be reconstructed", () => {
    const model = buildExecutiveReportModel({
      kind: "annual",
      selected: testingSnapshot(2024, "2024-12-31"),
      previous: testingSnapshot(2023, "2023-12-31"),
      selectionEffort: {
        disponible: false,
        cohorteN: 0,
        primerIntentoN: 0,
        primerIntentoPct: null,
        medianaPostulaciones: null,
        p25Postulaciones: null,
        p75Postulaciones: null,
      },
    });

    expect(model.outcomeMetrics.some((metric) => metric.id === "first-selection-effort")).toBe(
      false
    );
    expect(JSON.stringify(model)).not.toContain("No disponible");
  });

  it("identifies the institutions behind realized capacity", () => {
    const launches = [
      {
        id: "tiempo",
        nombre: "Fundación Tiempo - Clínica Adultos",
        orient: "clinica" as const,
        cupos: 0,
        modalidadCupo: "realizado" as const,
        capacidadOperativa: 50,
        postulaciones: 50,
        seleccionados: 50,
        fechaInicio: new Date("2026-02-04T00:00:00Z"),
        horas: 20,
        source: "operational_launch" as const,
        dateBasis: "launch_start_date" as const,
        demandAvailable: true,
      },
      {
        id: "ulloa",
        nombre: "Institución Fernando Ulloa - Ateneos",
        orient: "clinica" as const,
        cupos: 0,
        modalidadCupo: "realizado" as const,
        capacidadOperativa: 69,
        postulaciones: 69,
        seleccionados: 69,
        fechaInicio: new Date("2026-03-30T00:00:00Z"),
        horas: 20,
        source: "operational_launch" as const,
        dateBasis: "launch_start_date" as const,
        demandAvailable: true,
      },
    ];
    const model = buildExecutiveReportModel({
      kind: "annual",
      selected: testingSnapshot(2026, "2026-07-17"),
      previous: testingSnapshot(2025, "2025-07-17"),
      launches,
    });

    expect(model.realizedCapacityContext).toContain("Fundación Tiempo");
    expect(model.realizedCapacityContext).toContain("Institución Fernando Ulloa");
    expect(model.realizedCapacityContext).toContain("Ambos convenios");
  });

  it("keeps student personal data out of the report contract", () => {
    const current = testingSnapshot(2026, "2026-07-17");
    const model = buildExecutiveReportModel({
      kind: "management",
      selected: current,
      previous: testingSnapshot(2025, "2025-07-17"),
      managementBaseline: testingSnapshot(2024, "2024-08-31"),
      managementSeries: [testingSnapshot(2024, "2024-12-31"), current],
    });

    expect(containsPersonalStudentData(model)).toBe(false);
    expect(model.author.unit).toBe("Psicología · Sede Comahue");
    expect(JSON.stringify(model)).not.toContain("Buenos Aires");
  });
});
