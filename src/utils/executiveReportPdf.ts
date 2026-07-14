// ──────────────────────────────────────────────────────────────────────────
// GENERADOR DE PDF del reporte ejecutivo (Balance anual / Comparativo /
// Informe de Gestión). Reemplaza al window.print(): compone el documento
// con jsPDF + autotable para lograr paginación real (sin huecos en blanco),
// encabezado institucional, pie con numeración y tablas profesionales.
// ──────────────────────────────────────────────────────────────────────────
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { RowInput, UserOptions } from "jspdf-autotable";
import type {
  AnyReportData,
  ComparativeExecutiveReportData,
  ExecutiveReportData,
  GestionReportData,
  NewAgreementDetail,
  PPSRequestSummary,
  TimelineMonthData,
} from "../types";
import { normalizeStringForComparison } from "./formatters";

// A4 vertical en puntos.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M_LEFT = 48;
const M_RIGHT = 48;
const M_TOP = 56;
const M_BOTTOM = 64;
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT;

type RGB = [number, number, number];
const NAVY: RGB = [15, 23, 42]; // slate-900
const BLUE: RGB = [29, 78, 216]; // blue-700
const BLUE_SOFT: RGB = [219, 234, 254]; // blue-100
const INK: RGB = [30, 41, 59]; // slate-800
const MUTED: RGB = [100, 116, 139]; // slate-500
const BORDER: RGB = [203, 213, 225]; // slate-300
const BG_SOFT: RGB = [241, 245, 249]; // slate-100
const BG_ROW: RGB = [248, 250, 252]; // slate-50
const EMERALD: RGB = [4, 120, 87];
const EMERALD_BG: RGB = [236, 253, 245];
const ROSE: RGB = [190, 18, 60];

const REALIZADA = new Set(["realizada", "finalizada", "aprobada"]);
const NO_CONCRETADA = new Set(["no se pudo concretar", "rechazada", "cancelada"]);

const isRealizada = (status: string) => REALIZADA.has(normalizeStringForComparison(status));
const isEnGestion = (status: string) => {
  const s = normalizeStringForComparison(status);
  return !REALIZADA.has(s) && !NO_CONCRETADA.has(s) && s !== "archivado";
};

/** Cursor de escritura con salto de página automático. */
class PdfWriter {
  doc: jsPDF;
  y: number = M_TOP;

  constructor() {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
  }

  ensure(height: number) {
    if (this.y + height > PAGE_H - M_BOTTOM) {
      this.doc.addPage();
      this.y = M_TOP;
    }
  }

  /** Banda de portada: fondo navy, eyebrow + título + subtítulo + meta. */
  cover(eyebrow: string, title: string, subtitle: string, meta: string) {
    const h = 132;
    this.doc.setFillColor(...NAVY);
    this.doc.rect(0, 0, PAGE_W, h, "F");
    this.doc.setFillColor(...BLUE);
    this.doc.rect(0, h - 4, PAGE_W, 4, "F");

    this.doc.setTextColor(147, 197, 253); // blue-300
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7.5);
    this.doc.text(eyebrow.toUpperCase(), M_LEFT, 40, { charSpace: 1.2 });

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(23);
    this.doc.text(title, M_LEFT, 68);

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(12);
    this.doc.setTextColor(226, 232, 240); // slate-200
    this.doc.text(subtitle, M_LEFT, 90);

    this.doc.setFontSize(8.5);
    this.doc.setTextColor(148, 163, 184); // slate-400
    this.doc.text(meta, M_LEFT, 110);

    this.y = h + 30;
  }

  sectionTitle(text: string) {
    this.ensure(40);
    this.doc.setFillColor(...BLUE);
    this.doc.rect(M_LEFT, this.y - 11, 3.5, 14, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    this.doc.setTextColor(...NAVY);
    this.doc.text(text, M_LEFT + 11, this.y);
    this.y += 8;
    this.doc.setDrawColor(...BORDER);
    this.doc.setLineWidth(0.75);
    this.doc.line(M_LEFT, this.y, M_LEFT + CONTENT_W, this.y);
    this.y += 14;
  }

  paragraph(text: string, opts: { size?: number; color?: RGB; italic?: boolean } = {}) {
    const size = opts.size ?? 9;
    this.doc.setFont("helvetica", opts.italic ? "italic" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...(opts.color ?? INK));
    const lines = this.doc.splitTextToSize(text, CONTENT_W) as string[];
    const lineH = size * 1.45;
    lines.forEach((line) => {
      this.ensure(lineH);
      this.doc.text(line, M_LEFT, this.y);
      this.y += lineH;
    });
    this.y += 4;
  }

  bullets(items: string[], opts: { size?: number; color?: RGB } = {}) {
    const size = opts.size ?? 9;
    const lineH = size * 1.45;
    items.forEach((item) => {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(size);
      this.doc.setTextColor(...(opts.color ?? INK));
      const lines = this.doc.splitTextToSize(item, CONTENT_W - 14) as string[];
      this.ensure(lineH * lines.length + 3);
      this.doc.setFillColor(...BLUE);
      this.doc.circle(M_LEFT + 3, this.y - size * 0.32, 1.6, "F");
      lines.forEach((line) => {
        this.doc.text(line, M_LEFT + 14, this.y);
        this.y += lineH;
      });
      this.y += 3;
    });
    this.y += 4;
  }

  /** Grilla de tarjetas KPI, 4 por fila. */
  kpiGrid(cards: { value: string; label: string }[]) {
    const gap = 10;
    const cardW = (CONTENT_W - gap * 3) / 4;
    const cardH = 62;
    for (let i = 0; i < cards.length; i += 4) {
      this.ensure(cardH + gap);
      const row = cards.slice(i, i + 4);
      row.forEach((card, j) => {
        const x = M_LEFT + j * (cardW + gap);
        this.doc.setFillColor(...BG_SOFT);
        this.doc.setDrawColor(...BORDER);
        this.doc.setLineWidth(0.75);
        this.doc.roundedRect(x, this.y, cardW, cardH, 5, 5, "FD");

        this.doc.setFont("helvetica", "bold");
        this.doc.setTextColor(...NAVY);
        const valueSize = card.value.length > 9 ? 13 : 19;
        this.doc.setFontSize(valueSize);
        this.doc.text(card.value, x + 10, this.y + 26);

        this.doc.setFontSize(6.4);
        this.doc.setTextColor(...MUTED);
        const labelLines = this.doc.splitTextToSize(card.label.toUpperCase(), cardW - 20);
        this.doc.text(labelLines, x + 10, this.y + 40);
      });
      this.y += cardH + gap;
    }
    this.y += 6;
  }

  table(options: UserOptions) {
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: M_LEFT, right: M_RIGHT, top: M_TOP, bottom: M_BOTTOM },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: INK,
        cellPadding: 5,
        lineColor: BORDER,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: NAVY,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      footStyles: { fillColor: BG_SOFT, textColor: NAVY, fontStyle: "bold" },
      alternateRowStyles: { fillColor: BG_ROW },
      ...options,
    });
    const lastTable = (this.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    this.y = (lastTable?.finalY ?? this.y) + 16;
  }

  /** Caja de resaltado (callout) con borde y fondo suaves. */
  callout(title: string, body: string, tone: "emerald" | "blue" = "emerald") {
    const bg = tone === "emerald" ? EMERALD_BG : BLUE_SOFT;
    const fg = tone === "emerald" ? EMERALD : BLUE;
    this.doc.setFontSize(8);
    const bodyLines = this.doc.splitTextToSize(body, CONTENT_W - 28) as string[];
    const h = 30 + bodyLines.length * 11;
    this.ensure(h + 10);
    this.doc.setFillColor(...bg);
    this.doc.setDrawColor(...fg);
    this.doc.setLineWidth(0.75);
    this.doc.roundedRect(M_LEFT, this.y, CONTENT_W, h, 5, 5, "FD");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...fg);
    this.doc.text(title, M_LEFT + 14, this.y + 19);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...INK);
    this.doc.text(bodyLines, M_LEFT + 14, this.y + 33);
    this.y += h + 14;
  }

  /** Barras horizontales simples (cupos por período). */
  barChart(rows: { label: string; value: number }[]) {
    const max = Math.max(...rows.map((r) => r.value), 1);
    const labelW = 96;
    const valueW = 40;
    const barMaxW = CONTENT_W - labelW - valueW;
    rows.forEach((r) => {
      this.ensure(22);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED);
      this.doc.text(r.label, M_LEFT + labelW - 8, this.y + 9, { align: "right" });
      const w = Math.max((r.value / max) * barMaxW, 3);
      this.doc.setFillColor(...BG_SOFT);
      this.doc.roundedRect(M_LEFT + labelW, this.y, barMaxW, 13, 3, 3, "F");
      this.doc.setFillColor(...BLUE);
      this.doc.roundedRect(M_LEFT + labelW, this.y, w, 13, 3, 3, "F");
      this.doc.setTextColor(...NAVY);
      this.doc.text(String(r.value), M_LEFT + labelW + barMaxW + 8, this.y + 9);
      this.y += 22;
    });
    this.y += 8;
  }

  /** Pie de página en todas las páginas (línea, sello y numeración). */
  finalize(footerLeft: string) {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      const fy = PAGE_H - 36;
      this.doc.setDrawColor(...BORDER);
      this.doc.setLineWidth(0.5);
      this.doc.line(M_LEFT, fy, PAGE_W - M_RIGHT, fy);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...MUTED);
      this.doc.text(footerLeft, M_LEFT, fy + 12);
      this.doc.text(`Página ${i} de ${pages}`, PAGE_W - M_RIGHT, fy + 12, { align: "right" });
    }
  }
}

const evolutionLabel = (current: number, previous: number): string => {
  const evolution = current - previous;
  if (evolution === 0) return "—";
  const pct = previous > 0 ? (evolution / previous) * 100 : evolution > 0 ? 100 : 0;
  return `${evolution > 0 ? "+" : ""}${evolution} (${pct.toFixed(0)}%)`;
};

const cuposLabel = (d: NewAgreementDetail): string =>
  d.cupoIlimitado ? "Ilimitado" : String(d.totalCupos);

const agreementsTable = (w: PdfWriter, details: NewAgreementDetail[]) => {
  if (details.length === 0) {
    w.paragraph("No hay convenios nuevos registrados en el período.", {
      italic: true,
      color: MUTED,
      size: 8.5,
    });
    return;
  }
  w.table({
    head: [["Institución", "Orientación", "Año", "PPS", "Cupos", "Estudiantes"]],
    body: details.map((d) => [
      d.institucion,
      d.orientaciones.length ? d.orientaciones.join(" · ") : "—",
      d.anioConvenio ?? "—",
      d.totalRotaciones,
      cuposLabel(d),
      d.totalEstudiantes,
    ]),
    columnStyles: {
      0: { cellWidth: 150, fontStyle: "bold" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
    },
  });
};

const timelineTable = (w: PdfWriter, months: TimelineMonthData[], year: number) => {
  if (months.length === 0) {
    w.paragraph("No hay lanzamientos registrados para este período.", {
      italic: true,
      color: MUTED,
      size: 8.5,
    });
    return;
  }
  const body: RowInput[] = [];
  months.forEach((m) => {
    body.push([
      {
        content: `${m.monthName} — ${m.ppsCount} instituciones · ${m.cuposTotal} cupos`,
        colSpan: 2,
        styles: { fillColor: BG_SOFT, fontStyle: "bold", textColor: NAVY },
      },
    ]);
    if (year === 2024 && m.monthName === "Agosto") {
      body.push([
        {
          content: "Ingreso del nuevo coordinador",
          colSpan: 2,
          styles: { fillColor: [254, 249, 195], textColor: [133, 77, 14], fontStyle: "italic" },
        },
      ]);
    }
    m.institutions.forEach((inst) => {
      body.push([inst.name, inst.unlimited ? "Ilimitado" : String(inst.cupos)]);
    });
  });
  w.table({
    head: [["Institución", "Cupos"]],
    body,
    columnStyles: { 1: { halign: "center", cellWidth: 70 } },
  });
};

const requestsTable = (w: PdfWriter, title: string, requests: PPSRequestSummary[], tone: RGB) => {
  w.ensure(30);
  w.doc.setFont("helvetica", "bold");
  w.doc.setFontSize(10);
  w.doc.setTextColor(...tone);
  w.doc.text(`${title} (${requests.length})`, M_LEFT, w.y);
  w.y += 10;
  if (requests.length === 0) {
    w.paragraph("No hay registros.", { italic: true, color: MUTED, size: 8.5 });
    return;
  }
  w.table({
    head: [["Alumno", "Legajo", "Institución solicitada"]],
    body: requests.map((r) => [r.studentName, r.studentLegajo, r.institutionName]),
    columnStyles: { 0: { cellWidth: 160 }, 1: { cellWidth: 70 } },
  });
};

// ── Informe de Gestión ──────────────────────────────────────────────────────
const renderGestion = (w: PdfWriter, data: GestionReportData) => {
  w.cover(
    "Coordinación de Prácticas Profesionales Supervisadas · UFLO",
    "Informe General de Gestión",
    data.periodLabel,
    `Balance integral desde el inicio de la coordinación actual · Generado el ${data.generatedAt}`
  );

  w.sectionTitle("La gestión en números");
  w.kpiGrid([
    { value: String(data.totals.cupos), label: "Cupos ofrecidos" },
    { value: String(data.totals.lanzamientos), label: "Rotaciones de PPS lanzadas" },
    { value: String(data.totals.conveniosNuevos), label: "Convenios nuevos firmados" },
    { value: String(data.totals.institucionesActivas), label: "Instituciones activas" },
    { value: String(data.totals.estudiantesColocados), label: "Estudiantes que ocuparon cupo" },
    { value: String(data.totals.finalizados), label: "Estudiantes finalizados" },
    { value: String(data.totals.ingresantes), label: "Ingresantes (cohortes nuevas)" },
    {
      value: `${data.totals.solicitudesConcretadas} de ${data.totals.solicitudes}`,
      label: "Solicitudes concretadas",
    },
  ]);

  w.sectionTitle("Resumen ejecutivo");
  w.bullets(data.highlights);

  w.sectionTitle("Evolución anual de la gestión");
  w.table({
    head: [["Período", "PPS", "Cupos", "Convenios", "Ingresantes", "Finalizados", "Solicitudes"]],
    body: data.yearlyStats.map((y) => [
      y.label,
      y.lanzamientos,
      y.cupos,
      y.conveniosNuevos,
      y.ingresantes,
      y.finalizados,
      `${y.solicitudesConcretadas}/${y.solicitudes}`,
    ]),
    foot: [
      [
        "Total gestión",
        data.totals.lanzamientos,
        data.totals.cupos,
        data.totals.conveniosNuevos,
        data.totals.ingresantes,
        data.totals.finalizados,
        `${data.totals.solicitudesConcretadas}/${data.totals.solicitudes}`,
      ],
    ],
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
    },
  });
  w.paragraph(
    "Los períodos parciales (2024 desde septiembre y el año en curso) no cubren el año calendario completo.",
    { italic: true, color: MUTED, size: 7.5 }
  );

  w.sectionTitle("Crecimiento de la oferta de cupos");
  w.barChart(data.yearlyStats.map((y) => ({ label: y.label, value: y.cupos })));
  const { antes, despues, pctCupos } = data.comparativa12m;
  if (pctCupos !== null) {
    w.callout(
      `${pctCupos >= 0 ? "+" : "−"}${Math.abs(pctCupos).toFixed(0)}% de cupos en los primeros 12 meses de gestión`,
      `Sept. 2023 – Ago. 2024: ${antes.cupos} cupos en ${antes.lanzamientos} lanzamientos  ·  Sept. 2024 – Ago. 2025: ${despues.cupos} cupos en ${despues.lanzamientos} lanzamientos.`
    );
  }

  w.sectionTitle("Relación ingreso / egreso de estudiantes");
  w.table({
    head: [["Período", "Ingresantes", "Finalizados", "Balance neto", "Ratio ingreso/egreso"]],
    body: data.yearlyStats.map((y) => {
      const neto = y.ingresantes - y.finalizados;
      const ratio = y.finalizados > 0 ? (y.ingresantes / y.finalizados).toFixed(1) : "—";
      return [y.label, y.ingresantes, y.finalizados, `${neto > 0 ? "+" : ""}${neto}`, ratio];
    }),
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 3) {
        const raw = String(hook.cell.raw ?? "");
        if (raw.startsWith("+")) hook.cell.styles.textColor = EMERALD;
        else if (raw.startsWith("-") || raw.startsWith("−")) hook.cell.styles.textColor = ROSE;
      }
    },
  });
  w.paragraph(
    "Ingresantes: estudiantes cuya primera PPS corresponde a ese año (cohorte). Finalizados: solicitudes de finalización presentadas en el período. Un ratio mayor a 1 indica que la demanda de prácticas crece más rápido de lo que egresa.",
    { italic: true, color: MUTED, size: 7.5 }
  );

  w.sectionTitle(`Convenios nuevos de la gestión (${data.newAgreementsDetail.length})`);
  w.paragraph(
    "Listado completo de instituciones incorporadas desde el inicio de la gestión, con su orientación, las PPS lanzadas, los cupos ofertados y los estudiantes que ocuparon un cupo.",
    { color: MUTED, size: 8.5 }
  );
  agreementsTable(w, data.newAgreementsDetail);

  w.sectionTitle("Nota metodológica");
  w.bullets(
    [
      "El período de gestión abarca desde el 1 de septiembre de 2024 hasta la fecha de generación del informe.",
      "Los convenios nuevos se registran por año calendario de firma; los de 2024 incluyen todo ese año.",
      "Los estudiantes que ocuparon cupo se cuentan una sola vez aunque hayan participado de varias rotaciones, y solo si fueron seleccionados.",
      'Fundación Tiempo y Ulloa ofrecen cupo prácticamente ilimitado: se muestran como "Ilimitado" y sus cupos se excluyen de los totales y de las estadísticas de presión, que reflejan la competencia real por el resto de las convocatorias.',
    ],
    { size: 7.5, color: MUTED }
  );
};

// ── Balance anual ───────────────────────────────────────────────────────────
const KPI_LABELS: { key: keyof ExecutiveReportData["kpis"]; label: string }[] = [
  { key: "activeStudents", label: "Estudiantes Activos" },
  { key: "studentsWithoutAnyPps", label: "Estudiantes sin Ninguna PPS (Total)" },
  { key: "newStudents", label: "Estudiantes Nuevos (Ingresos)" },
  { key: "finishedStudents", label: "Estudiantes Finalizados (Ciclo)" },
  { key: "newPpsLaunches", label: "PPS Nuevas Lanzadas" },
  { key: "totalOfferedSpots", label: "Cupos Totales Ofrecidos" },
  { key: "newAgreements", label: "Convenios Nuevos Firmados" },
];

const renderSingleYear = (w: PdfWriter, data: ExecutiveReportData) => {
  w.cover(
    "Coordinación de Prácticas Profesionales Supervisadas · UFLO",
    "Balance de Prácticas Profesionales",
    `Resumen Anual del Ciclo ${data.year}`,
    `Período: ${data.period.current.start} – ${data.period.current.end} · Comparado contra el cierre del ciclo anterior (${data.period.previous.end})`
  );

  w.sectionTitle("Panel de indicadores clave");
  w.table({
    head: [["Indicador", `Total ${data.year}`, "Cierre anterior", "Evolución"]],
    body: KPI_LABELS.map(({ key, label }) => {
      const kpi = data.kpis[key];
      return [label, kpi.current, kpi.previous, evolutionLabel(kpi.current, kpi.previous)];
    }),
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center", fontStyle: "bold" },
      2: { halign: "center" },
      3: { halign: "center" },
    },
  });

  w.sectionTitle("Gestión de solicitudes de PPS");
  requestsTable(
    w,
    "Solicitudes realizadas y concretadas",
    data.ppsRequests.filter((r) => isRealizada(r.status)),
    EMERALD
  );
  requestsTable(
    w,
    "En gestión / pendientes",
    data.ppsRequests.filter((r) => isEnGestion(r.status)),
    BLUE
  );

  w.sectionTitle(`Convenios nuevos del ciclo (${data.newAgreementsDetail.length})`);
  w.paragraph(
    "Instituciones con convenio nuevo del año, su orientación, las PPS lanzadas, los cupos ofertados y los estudiantes que ocuparon un cupo (seleccionados).",
    { color: MUTED, size: 8.5 }
  );
  agreementsTable(w, data.newAgreementsDetail);

  w.sectionTitle("Línea de tiempo de PPS lanzadas");
  timelineTable(w, data.launchesByMonth, data.year);
};

// ── Comparativo ─────────────────────────────────────────────────────────────
const COMPARATIVE_KPI_LABELS: {
  key: keyof ComparativeExecutiveReportData["kpis"];
  label: string;
}[] = [
  { key: "activeStudents", label: "Estudiantes Activos" },
  { key: "finishedStudents", label: "Estudiantes Finalizados (Ciclo)" },
  { key: "newPpsLaunches", label: "PPS Nuevas Lanzadas" },
  { key: "totalOfferedSpots", label: "Cupos Totales Ofrecidos" },
  { key: "newAgreements", label: "Convenios Nuevos Firmados" },
];

const renderComparative = (w: PdfWriter, data: ComparativeExecutiveReportData) => {
  w.cover(
    "Coordinación de Prácticas Profesionales Supervisadas · UFLO",
    "Reporte Comparativo de PPS",
    `Análisis comparativo anual: ${data.yearA} vs. ${data.yearB}`,
    `Generado el ${new Date().toLocaleDateString("es-ES")}`
  );

  w.sectionTitle("Panel comparativo de KPIs");
  w.table({
    head: [["Indicador", `Balance ${data.yearA}`, `Balance ${data.yearB}`, "Evolución"]],
    body: COMPARATIVE_KPI_LABELS.map(({ key, label }) => {
      const kpi = data.kpis[key];
      return [label, kpi.yearA, kpi.yearB, evolutionLabel(kpi.yearB, kpi.yearA)];
    }),
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "center", fontStyle: "bold" },
      3: { halign: "center" },
    },
  });

  w.sectionTitle(`Convenios nuevos ${data.yearA} (${data.newAgreementsDetail.yearA.length})`);
  agreementsTable(w, data.newAgreementsDetail.yearA);
  w.sectionTitle(`Convenios nuevos ${data.yearB} (${data.newAgreementsDetail.yearB.length})`);
  agreementsTable(w, data.newAgreementsDetail.yearB);

  w.sectionTitle(`Gestión de solicitudes de PPS · Ciclo ${data.yearB}`);
  requestsTable(
    w,
    "Solicitudes realizadas y concretadas",
    data.ppsRequests.yearB.filter((r) => isRealizada(r.status)),
    EMERALD
  );
  requestsTable(
    w,
    "En gestión / pendientes",
    data.ppsRequests.yearB.filter((r) => isEnGestion(r.status)),
    BLUE
  );

  w.sectionTitle(`Línea de tiempo ${data.yearA}`);
  timelineTable(w, data.launchesByMonth.yearA, data.yearA);
  w.sectionTitle(`Línea de tiempo ${data.yearB}`);
  timelineTable(w, data.launchesByMonth.yearB, data.yearB);
};

export const generateExecutiveReportPdf = (data: AnyReportData) => {
  const w = new PdfWriter();

  let filename: string;
  let docTitle: string;
  if (data.reportType === "gestion") {
    renderGestion(w, data);
    filename = "informe-gestion-pps-uflo.pdf";
    docTitle = "Informe General de Gestión · PPS UFLO";
  } else if (data.reportType === "comparative") {
    renderComparative(w, data);
    filename = `comparativo-pps-${data.yearA}-vs-${data.yearB}.pdf`;
    docTitle = `Reporte Comparativo PPS ${data.yearA} vs ${data.yearB}`;
  } else {
    renderSingleYear(w, data);
    filename = `balance-pps-${data.year}.pdf`;
    docTitle = `Balance de PPS ${data.year}`;
  }

  w.doc.setProperties({
    title: docTitle,
    subject: "Prácticas Profesionales Supervisadas · UFLO",
    author: "Coordinación de PPS · UFLO",
    creator: "Mi Panel Académico",
  });

  w.finalize(
    `Coordinación de PPS · UFLO — Generado el ${new Date().toLocaleDateString("es-ES")} desde Mi Panel Académico`
  );
  w.doc.save(filename);
};

export default generateExecutiveReportPdf;
