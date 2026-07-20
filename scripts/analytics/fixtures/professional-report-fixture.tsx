import React from "react";
import { createRoot } from "react-dom/client";
import { pdf } from "@react-pdf/renderer";
import { testingDirectorSnapshot } from "../../../src/features/executive-report/directorReport.service";
import { buildExecutiveReportModel } from "../../../src/features/executive-report/executiveReport.model";
import { testingSnapshot } from "../../../src/features/executive-report/executiveReport.service";
import type { DirectorReportModel } from "../../../src/features/executive-report/directorReport.types";
import { DirectorReportPdf } from "../../../src/features/executive-report/pdf/DirectorReportPdf";
import { ExecutiveReportPdf } from "../../../src/features/executive-report/pdf/ExecutiveReportPdf";
import type { NewAgreement, ReportLaunch } from "../../../src/hooks/useMetricsExtras";

const fixtureLaunches: ReportLaunch[] = Array.from({ length: 42 }, (_, index) => {
  const finite = index < 36;
  const capacities = [5, 6, 7, 8, 9, 10];
  return {
    id: `fixture-${index + 1}`,
    nombre: `Oferta documentada ${String(index + 1).padStart(2, "0")}`,
    orient: ["clinica", "comunitaria", "educacional", "laboral", "juridica"][
      index % 5
    ] as ReportLaunch["orient"],
    cupos: finite ? capacities[index % capacities.length] : 0,
    modalidadCupo: finite ? "fijo" : "desconocido",
    capacidadOperativa: finite ? capacities[index % capacities.length] : 0,
    postulaciones: 0,
    seleccionados: 0,
    fechaInicio: new Date(Date.UTC(2024, Math.floor(index / 4) % 12, (index % 24) + 1)),
    horas: 20,
    source: "historical_documented_offer",
    dateBasis: "announcement_at",
    demandAvailable: false,
  };
});

const realizedCapacity = [50, 51, 69, 32, 47];
const fixtureLaunches2026: ReportLaunch[] = Array.from({ length: 41 }, (_, index) => {
  const realized = index < realizedCapacity.length;
  const capacity = realized ? realizedCapacity[index] : index < 25 ? 7 : 6;
  const realizedNames = [
    "Fundación Tiempo — Clínica Adultos",
    "Fundación Tiempo — Clínica Niños",
    "Institución Fernando Ulloa — Ateneos",
    "Fundación Tiempo — Clínica Adultos",
    "Fundación Tiempo — Clínica Niños",
  ];
  return {
    id: `fixture-2026-${index + 1}`,
    nombre: realized
      ? realizedNames[index]
      : [
          "Ministerio de Juventud, Deportes y Cultura",
          "Refugio Gabriel Brochero",
          "Subsecretaría de Emergencias y Gestión de Riesgos",
          "Instituto Liens",
          "Asociación Civil Pensar — Barriletes",
        ][index % 5],
    orient: ["educacional", "clinica", "comunitaria", "laboral"][
      index % 4
    ] as ReportLaunch["orient"],
    cupos: realized ? 0 : capacity,
    modalidadCupo: realized ? "realizado" : "fijo",
    capacidadOperativa: capacity,
    postulaciones: 12 + index,
    seleccionados: realized ? capacity : Math.min(capacity, 4),
    fechaInicio: new Date(Date.UTC(2026, Math.min(6, Math.floor(index / 6)), (index % 24) + 1)),
    horas: 20,
    source: "operational_launch",
    dateBasis: "launch_start_date",
    demandAvailable: true,
  };
});

const fixtureAgreements: NewAgreement[] = [
  {
    institucion: "Ministerio de Juventud, Deportes y Cultura",
    orientaciones: ["educacional", "comunitaria"],
    pps: 3,
    cupos: 50,
  },
  {
    institucion: "Subsecretaría de Emergencias y Gestión de Riesgos",
    orientaciones: ["laboral"],
    pps: 1,
    cupos: 6,
  },
  {
    institucion: "Refugio Gabriel Brochero",
    orientaciones: ["comunitaria"],
    pps: 1,
    cupos: 6,
  },
  {
    institucion: "Human Res",
    orientaciones: ["laboral"],
    pps: 1,
    cupos: 2,
  },
];

const kind = new URLSearchParams(window.location.search).get("kind");
const model =
  kind === "management"
    ? buildExecutiveReportModel({
        kind: "management",
        selected: testingSnapshot(2026, "2026-07-18"),
        previous: testingSnapshot(2025, "2025-07-18"),
        managementBaseline: testingSnapshot(2024, "2024-08-31"),
        managementSeries: [
          testingSnapshot(2024, "2024-12-31"),
          testingSnapshot(2025, "2025-12-31"),
          testingSnapshot(2026, "2026-07-18"),
        ],
        generatedAt: new Date("2026-07-18T12:00:00Z"),
      })
    : kind === "annual2025"
      ? buildExecutiveReportModel({
          kind: "annual",
          selected: testingSnapshot(2025, "2025-12-31"),
          previous: testingSnapshot(2024, "2024-12-31"),
          generatedAt: new Date("2026-07-18T12:00:00Z"),
        })
      : kind === "annual2026"
        ? buildExecutiveReportModel({
            kind: "annual",
            selected: testingSnapshot(2026, "2026-07-18"),
            previous: testingSnapshot(2025, "2025-07-18"),
            launches: fixtureLaunches2026,
            agreements: fixtureAgreements,
            trajectory: {
              totalFinalizados: 28,
              n: 28,
              duracionesInvalidas: 0,
              medianaMeses: 15.5,
              promedioMeses: 16.2,
              p25Meses: 10,
              p75Meses: 20,
              promedioRegistrosPractica: 4.2,
              promedioHorasCargadas: 180,
              dist: [],
            },
            selectionEffort: {
              disponible: true,
              cohorteN: 87,
              primerIntentoN: 61,
              primerIntentoPct: 70.1,
              medianaPostulaciones: 1,
              p25Postulaciones: 1,
              p75Postulaciones: 2,
            },
            generatedAt: new Date("2026-07-18T12:00:00Z"),
          })
        : buildExecutiveReportModel({
            kind: "annual",
            selected: testingSnapshot(2024, "2024-12-31"),
            previous: testingSnapshot(2023, "2023-12-31"),
            launches: fixtureLaunches,
            generatedAt: new Date("2026-07-17T12:00:00Z"),
          });

const root = createRoot(document.getElementById("root")!);
root.render(<p>Generando PDF de verificación…</p>);

const directorModel: DirectorReportModel = {
  annual: buildExecutiveReportModel({
    kind: "annual",
    selected: testingSnapshot(2026, "2026-07-18"),
    previous: testingSnapshot(2025, "2025-07-18"),
    launches: fixtureLaunches2026,
    agreements: fixtureAgreements,
    generatedAt: new Date("2026-07-18T12:00:00Z"),
  }),
  snapshot: testingDirectorSnapshot(2026, "2026-07-18"),
  recipient: {
    name: "Agostina Reale Berrueta",
    role: "Directora de la Carrera",
  },
  privacyLabel: "Circulación interna · contiene datos personales",
};

pdf(
  kind === "director" ? (
    <DirectorReportPdf model={directorModel} />
  ) : (
    <ExecutiveReportPdf model={model} />
  )
)
  .toBlob()
  .then((blob) => {
    const link = document.createElement("a");
    link.id = "pdf-ready";
    link.href = URL.createObjectURL(blob);
    link.textContent = `PDF listo · ${blob.size} bytes`;
    document.getElementById("root")!.replaceChildren(link);
  })
  .catch((error) => {
    const pre = document.createElement("pre");
    pre.id = "pdf-error";
    pre.textContent = error instanceof Error ? error.stack || error.message : String(error);
    document.getElementById("root")!.replaceChildren(pre);
  });
