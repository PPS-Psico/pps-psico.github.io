import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import manropeRegular from "@fontsource/manrope/files/manrope-latin-400-normal.woff?url";
import manropeMedium from "@fontsource/manrope/files/manrope-latin-500-normal.woff?url";
import manropeSemiBold from "@fontsource/manrope/files/manrope-latin-600-normal.woff?url";
import manropeBold from "@fontsource/manrope/files/manrope-latin-700-normal.woff?url";
import sourceSerifSemiBold from "@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff?url";
import sourceSerifBold from "@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff?url";
import type {
  DirectorNearReasonCode,
  DirectorReportModel,
  DirectorStudentIdentity,
  NearCompletionStudent,
  PressureLevel,
  WithoutPpsStudent,
} from "../directorReport.types";
import type { ReportMetric } from "../executiveReport.types";

Font.register({
  family: "Manrope",
  fonts: [
    { src: manropeRegular, fontWeight: 400 },
    { src: manropeMedium, fontWeight: 500 },
    { src: manropeSemiBold, fontWeight: 600 },
    { src: manropeBold, fontWeight: 700 },
  ],
});
Font.register({
  family: "Source Serif 4",
  fonts: [
    { src: sourceSerifSemiBold, fontWeight: 600 },
    { src: sourceSerifBold, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const C = {
  navy: "#08186B",
  teal: "#299E94",
  tealText: "#176F69",
  plum: "#46153D",
  ink: "#151A27",
  muted: "#697386",
  rule: "#DFE3EA",
  pale: "#F7F8FA",
  sand: "#F4F0E9",
  alert: "#B64B3D",
  amber: "#C98524",
  amberText: "#9A5B00",
  white: "#FFFFFF",
};

const ORIENTATION_COLORS: Record<string, string> = {
  clinica: "#27795D",
  educacional: "#203B73",
  laboral: "#A83237",
  comunitaria: "#673584",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    color: C.ink,
    fontFamily: "Manrope",
    fontSize: 8,
    paddingBottom: 38,
    paddingHorizontal: 46,
    paddingTop: 42,
  },
  cover: {
    borderTopColor: C.plum,
    borderTopWidth: 9,
    justifyContent: "space-between",
    paddingTop: 34,
  },
  rowBetween: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  wordmark: { alignItems: "baseline", flexDirection: "row" },
  wordmarkMain: { color: C.navy, fontSize: 19, fontWeight: 700, letterSpacing: -1 },
  wordmarkSub: {
    color: C.navy,
    fontSize: 6,
    fontWeight: 700,
    letterSpacing: 1.1,
    marginLeft: 6,
    textTransform: "uppercase",
  },
  privacyPill: {
    backgroundColor: C.plum,
    color: C.white,
    fontSize: 5.6,
    fontWeight: 700,
    letterSpacing: 0.6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  coverMain: { maxWidth: 490 },
  kicker: {
    color: C.muted,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  coverTitle: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 39,
    fontWeight: 600,
    letterSpacing: -1.2,
    lineHeight: 1,
    marginBottom: 10,
    marginTop: 11,
  },
  coverSubtitle: { color: C.muted, fontSize: 11, lineHeight: 1.45, maxWidth: 450 },
  shortRule: { backgroundColor: C.teal, height: 4, marginBottom: 20, marginTop: 24, width: 72 },
  coverQuote: {
    color: C.ink,
    fontFamily: "Source Serif 4",
    fontSize: 15.5,
    fontWeight: 600,
    lineHeight: 1.45,
    maxWidth: 460,
  },
  coverMetrics: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    borderTopColor: C.rule,
    borderTopWidth: 1,
    flexDirection: "row",
  },
  coverMetric: {
    borderRightColor: C.rule,
    borderRightWidth: 1,
    flex: 1,
    minHeight: 66,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  coverMetricFirst: { paddingLeft: 0 },
  coverMetricLast: { borderRightWidth: 0 },
  coverMetricLabel: {
    color: C.muted,
    fontSize: 5.8,
    fontWeight: 700,
    lineHeight: 1.35,
    textTransform: "uppercase",
  },
  coverMetricValue: { color: C.navy, fontSize: 21, fontWeight: 700, marginTop: 5 },
  recipientGrid: { flexDirection: "row", justifyContent: "space-between" },
  recipient: { borderLeftColor: C.teal, borderLeftWidth: 2, paddingLeft: 10, width: "31%" },
  recipientLabel: {
    color: C.muted,
    fontSize: 5.5,
    fontWeight: 700,
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  recipientName: {
    color: C.ink,
    fontFamily: "Source Serif 4",
    fontSize: 10,
    fontWeight: 600,
    marginTop: 4,
  },
  recipientMeta: { color: C.muted, fontSize: 5.8, lineHeight: 1.45, marginTop: 2 },
  pageHeader: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    minHeight: 53,
    paddingBottom: 12,
    position: "relative",
  },
  headerTitleBlock: { paddingRight: 18, width: "100%" },
  sectionLabel: {
    color: C.tealText,
    fontSize: 6.4,
    fontWeight: 700,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  footer: {
    borderTopColor: C.rule,
    borderTopWidth: 1,
    bottom: 20,
    color: C.plum,
    fontSize: 5.4,
    fontWeight: 600,
    height: 16,
    left: 46,
    position: "absolute",
    right: 46,
  },
  footerSource: { left: 0, position: "absolute", top: 7, width: 390 },
  footerPage: { position: "absolute", right: 0, textAlign: "right", top: 7, width: 22 },
  miniHeading: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
  },
  miniLabel: {
    color: C.tealText,
    fontSize: 6.4,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  miniMeta: { color: C.muted, fontSize: 6 },
  annualMetrics: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    borderTopColor: C.navy,
    borderTopWidth: 2.5,
    flexDirection: "row",
    marginTop: 8,
  },
  annualMetric: {
    borderRightColor: C.rule,
    borderRightWidth: 1,
    flex: 1,
    minHeight: 108,
    padding: 10,
  },
  annualMetricFirst: { paddingLeft: 0 },
  annualMetricLast: { borderRightWidth: 0 },
  annualMetricLabel: {
    color: C.muted,
    fontSize: 5.7,
    fontWeight: 700,
    lineHeight: 1.35,
    minHeight: 20,
    textTransform: "uppercase",
  },
  annualMetricValue: { color: C.navy, fontSize: 19, fontWeight: 700, marginTop: 3 },
  annualMetricDelta: { color: "#137457", fontSize: 6.4, fontWeight: 700, marginTop: 4 },
  annualMetricDetail: { color: C.muted, fontSize: 6.8, lineHeight: 1.4, marginTop: 6 },
  cutoffNote: {
    backgroundColor: "#F3F7F7",
    borderLeftColor: C.teal,
    borderLeftWidth: 3,
    flexDirection: "row",
    marginTop: 14,
    padding: 9,
  },
  cutoffTitle: { color: C.navy, fontSize: 6.5, fontWeight: 700, width: 105 },
  cutoffText: { color: C.muted, flex: 1, fontSize: 6.8, lineHeight: 1.4 },
  statusGrid: { flexDirection: "row", marginTop: 9 },
  statusCard: {
    backgroundColor: C.pale,
    borderTopColor: C.navy,
    borderTopWidth: 3,
    flex: 1,
    marginRight: 8,
    minHeight: 83,
    padding: 10,
  },
  statusCardLast: { marginRight: 0 },
  statusAlert: { borderTopColor: C.alert },
  statusNear: { borderTopColor: C.amber },
  statusReady: { borderTopColor: C.teal },
  statusLabel: {
    color: C.muted,
    fontSize: 6.1,
    fontWeight: 700,
    lineHeight: 1.35,
    minHeight: 16,
    textTransform: "uppercase",
  },
  statusValue: { color: C.navy, fontSize: 18, fontWeight: 700, marginTop: 3 },
  statusDetail: { color: C.muted, fontSize: 6.7, lineHeight: 1.4, marginTop: 3 },
  criteria: {
    borderTopColor: C.rule,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 15,
  },
  criterion: {
    borderLeftColor: C.teal,
    borderLeftWidth: 2,
    marginRight: 12,
    paddingLeft: 8,
    width: "31.5%",
  },
  criterionLast: { marginRight: 0 },
  criterionNumber: { color: C.tealText, fontSize: 6, fontWeight: 700 },
  criterionTitle: {
    color: C.ink,
    fontFamily: "Source Serif 4",
    fontSize: 8,
    fontWeight: 600,
    lineHeight: 1.35,
    marginTop: 2,
  },
  criterionCount: { color: C.muted, fontSize: 6.3, marginTop: 4 },
  pressureHero: { backgroundColor: C.navy, flexDirection: "row", marginTop: 28, minHeight: 92 },
  pressureMetric: { borderRightColor: "#394684", borderRightWidth: 1, padding: 14, width: "20%" },
  pressureEmphasis: { backgroundColor: C.teal, color: "#0B2820", width: "22%" },
  pressureLabel: {
    color: "#CBD2ED",
    fontSize: 6.1,
    fontWeight: 700,
    lineHeight: 1.35,
    minHeight: 20,
    textTransform: "uppercase",
  },
  pressureEmphasisLabel: { color: "#174F3F" },
  pressureValue: { fontSize: 20, fontWeight: 700, marginTop: 5 },
  pressureExplanation: {
    color: "#DCE2F4",
    flex: 1,
    fontSize: 6.8,
    lineHeight: 1.45,
    padding: 14,
  },
  offerList: { borderTopColor: C.rule, borderTopWidth: 1, marginTop: 24 },
  offerRow: {
    alignItems: "center",
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    borderLeftColor: C.teal,
    borderLeftWidth: 4,
    flexDirection: "row",
    minHeight: 60,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  offerHigh: { borderLeftColor: C.alert },
  offerModerate: { borderLeftColor: C.amber },
  offerIdentity: { flex: 1, paddingRight: 10 },
  offerOrientation: { fontSize: 6, fontWeight: 700, textTransform: "uppercase" },
  offerName: {
    color: C.ink,
    fontFamily: "Source Serif 4",
    fontSize: 9,
    fontWeight: 600,
    lineHeight: 1.3,
    marginTop: 4,
  },
  offerFact: { width: 52 },
  offerFactValue: { color: C.navy, fontSize: 14, fontWeight: 700 },
  offerFactLabel: { color: C.muted, fontSize: 6, marginTop: 2 },
  offerPressure: { borderLeftColor: C.rule, borderLeftWidth: 1, paddingLeft: 10, width: 110 },
  offerPressureLabel: {
    color: C.alert,
    fontSize: 6,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  offerPressureValue: { color: C.navy, fontSize: 7, fontWeight: 700, marginTop: 4 },
  actionStrip: {
    borderTopColor: C.rule,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 25,
    paddingTop: 18,
  },
  actionCard: {
    borderTopColor: C.teal,
    borderTopWidth: 3,
    flex: 1,
    marginRight: 18,
    paddingTop: 9,
  },
  actionCardLast: { marginRight: 0 },
  actionLabel: {
    color: C.tealText,
    fontSize: 6,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  actionTitle: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 9.5,
    fontWeight: 600,
    lineHeight: 1.35,
    marginTop: 4,
  },
  actionText: { color: C.muted, fontSize: 6.8, lineHeight: 1.4, marginTop: 4 },
  listIntro: {
    alignItems: "center",
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    marginTop: 20,
    paddingBottom: 10,
  },
  listIntroText: { color: C.muted, fontSize: 7.2, lineHeight: 1.45, maxWidth: 350 },
  listIntroCount: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 12,
    fontWeight: 600,
  },
  table: { borderLeftColor: C.rule, borderLeftWidth: 1, borderTopColor: C.rule, borderTopWidth: 1 },
  tableRow: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 34,
  },
  tableRowEven: { backgroundColor: "#FAFBFC" },
  tableCell: {
    borderRightColor: C.rule,
    borderRightWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tableIdentity: { flex: 1 },
  tableFacts: { width: 145 },
  studentName: {
    color: C.ink,
    fontFamily: "Source Serif 4",
    fontSize: 9,
    fontWeight: 600,
    lineHeight: 1.25,
  },
  studentNameRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  studentNameNear: { paddingRight: 8, width: "58%" },
  studentMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  studentMetaText: { color: C.muted, fontSize: 6.2, lineHeight: 1.3, marginRight: 7 },
  studentOrientation: {
    fontSize: 6.2,
    fontWeight: 700,
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  studentFacts: { color: C.muted, fontSize: 6.2, lineHeight: 1.4 },
  studentFactsStrong: { color: C.navy, fontWeight: 700 },
  reasonTag: {
    color: C.amberText,
    fontSize: 6,
    fontWeight: 700,
    lineHeight: 1.3,
    textAlign: "right",
    textTransform: "uppercase",
    width: "42%",
  },
  dual: { flexDirection: "row", marginTop: 28 },
  dualColumn: { flex: 1 },
  dualLeft: {
    flexBasis: 180,
    flexGrow: 0,
    flexShrink: 0,
    marginRight: 30,
    width: 180,
  },
  subhead: { borderBottomColor: C.navy, borderBottomWidth: 2.5, minHeight: 58, paddingBottom: 10 },
  subheadLabel: {
    color: C.tealText,
    fontSize: 6,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  subheadTitle: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 12,
    fontWeight: 600,
    marginTop: 4,
  },
  subcopy: {
    color: C.muted,
    fontSize: 6.8,
    lineHeight: 1.4,
    marginBottom: 10,
    marginTop: 9,
    minHeight: 35,
  },
  compactRow: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    minHeight: 42,
    paddingVertical: 7,
  },
  compactName: {
    color: C.ink,
    fontFamily: "Source Serif 4",
    fontSize: 8.8,
    fontWeight: 600,
  },
  compactDetail: { color: C.muted, fontSize: 6.2, lineHeight: 1.4, marginTop: 4 },
  closingNote: {
    backgroundColor: C.sand,
    borderLeftColor: C.plum,
    borderLeftWidth: 4,
    marginTop: 22,
    padding: 13,
  },
  closingTitle: { color: C.plum, fontSize: 6.5, fontWeight: 700 },
  closingText: {
    color: "#514B4A",
    fontSize: 6.8,
    lineHeight: 1.45,
    marginTop: 4,
    maxWidth: 430,
  },
});

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const dateLabel = (iso: string): string =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${iso}T12:00:00`)
  );
const normalizedOrientation = (orientation?: string | null): string =>
  (orientation || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
const orientationColor = (orientation?: string | null): string =>
  ORIENTATION_COLORS[normalizedOrientation(orientation)] || C.muted;
const formatMetric = (metric: ReportMetric): string => {
  if (metric.value == null) return "—";
  const value = Number.isInteger(metric.value)
    ? integer.format(metric.value)
    : decimal.format(metric.value);
  return metric.unit === "%" ? `${value}%` : metric.unit ? `${value} ${metric.unit}` : value;
};
const chunk = <T,>(rows: T[], size: number): T[][] =>
  rows.length
    ? Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
        rows.slice(index * size, (index + 1) * size)
      )
    : [[]];

const Wordmark = () => (
  <View style={styles.wordmark}>
    <Text style={styles.wordmarkMain}>UFLO</Text>
    <Text style={styles.wordmarkSub}>Universidad</Text>
  </View>
);
const PrivacyPill = () => (
  <Text style={styles.privacyPill}>Circulación interna · datos personales</Text>
);
const Header = ({ title, label }: { title: string; label: string }) => (
  <View style={styles.pageHeader}>
    <View style={styles.headerTitleBlock}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  </View>
);
const Footer = ({ model, page }: { model: DirectorReportModel; page: number }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerSource}>
      {model.privacyLabel} · Mi Panel Académico · {model.snapshot.metricVersion}
    </Text>
    <Text style={styles.footerPage}>{String(page).padStart(2, "0")}</Text>
  </View>
);
const StudentMeta = ({ student }: { student: DirectorStudentIdentity }) => (
  <View style={styles.studentMeta}>
    <Text style={styles.studentMetaText}>Legajo {student.legajo || "sin dato"}</Text>
    <Text style={styles.studentMetaText}>Cohorte {student.cohort || "—"}</Text>
    <Text
      style={[styles.studentOrientation, { color: orientationColor(student.selectedOrientation) }]}
    >
      {student.selectedOrientation || "Sin orientación"}
    </Text>
  </View>
);

const Cover = ({ model }: { model: DirectorReportModel }) => {
  const { annual, snapshot, recipient } = model;
  const metrics = [
    ["Estudiantes activos", snapshot.studentSummary.activeStudents],
    ["Sin PPS · con postulaciones", snapshot.studentSummary.withoutPps],
    ["Próximos a finalizar", snapshot.studentSummary.nearCompletion],
    [
      "Presión actual",
      snapshot.pressure.pendingPerRemainingPlace == null
        ? "Saturada"
        : `${decimal.format(snapshot.pressure.pendingPerRemainingPlace)}×`,
    ],
  ] as const;
  return (
    <Page size="A4" style={[styles.page, styles.cover]}>
      <View style={styles.rowBetween}>
        <Wordmark />
        <PrivacyPill />
      </View>
      <View style={styles.coverMain}>
        <Text style={styles.kicker}>Licenciatura en Psicología · Sede Comahue</Text>
        <Text style={styles.coverTitle}>Informe para Dirección de Carrera</Text>
        <Text style={styles.coverSubtitle}>
          Ciclo {annual.year} · panorama institucional y seguimiento nominal de estudiantes
        </Text>
        <View style={styles.shortRule} />
        <Text style={styles.coverQuote}>
          Una lectura ejecutiva del año y una foto operativa para anticipar acompañamientos, cupos y
          trayectorias próximas a completar las PPS.
        </Text>
      </View>
      <View style={styles.coverMetrics}>
        {metrics.map(([label, value], index) => (
          <View
            key={label}
            style={[
              styles.coverMetric,
              index === 0 ? styles.coverMetricFirst : {},
              index === metrics.length - 1 ? styles.coverMetricLast : {},
            ]}
          >
            <Text style={styles.coverMetricLabel}>{label}</Text>
            <Text style={styles.coverMetricValue}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.recipientGrid}>
        <View style={styles.recipient}>
          <Text style={styles.recipientLabel}>Preparado para</Text>
          <Text style={styles.recipientName}>{recipient.name}</Text>
          <Text style={styles.recipientMeta}>{recipient.role}</Text>
        </View>
        <View style={styles.recipient}>
          <Text style={styles.recipientLabel}>Coordinación General</Text>
          <Text style={styles.recipientName}>{annual.author.name}</Text>
          <Text style={styles.recipientMeta}>{annual.author.email}</Text>
        </View>
        <View style={styles.recipient}>
          <Text style={styles.recipientLabel}>Foto operativa</Text>
          <Text style={styles.recipientName}>{dateLabel(snapshot.snapshotDateISO)}</Text>
          <Text style={styles.recipientMeta}>
            Los flujos generales corresponden al ciclo elegido.
          </Text>
        </View>
      </View>
    </Page>
  );
};

const Overview = ({ model }: { model: DirectorReportModel }) => {
  const { annual, snapshot } = model;
  const statuses = [
    [
      "Sin PPS y buscando",
      snapshot.studentSummary.withoutPps,
      `Sin prácticas cargadas y con postulaciones en ${annual.year}.`,
      styles.statusAlert,
    ],
    [
      "Próximos a finalizar",
      snapshot.studentSummary.nearCompletion,
      "Cumplen alguno de los tres criterios acordados.",
      styles.statusNear,
    ],
    [
      "Listos para solicitar",
      snapshot.studentSummary.readyToRequest,
      "Cumplen requisitos y no tienen práctica activa.",
      styles.statusReady,
    ],
    [
      "En acreditación",
      snapshot.studentSummary.inAccreditation,
      "Ya registran una solicitud de finalización.",
      {},
    ],
  ] as const;
  const criteria = [
    ["01", "230–249 horas totales", snapshot.studentSummary.nearByReason.total_hours_230_249],
    [
      "02",
      "250 h o más y sólo 2 orientaciones",
      snapshot.studentSummary.nearByReason.missing_one_orientation,
    ],
    [
      "03",
      "250 h, 3 orientaciones y 50–69 h de especialidad",
      snapshot.studentSummary.nearByReason.specialty_gap_20_or_less,
    ],
  ] as const;
  return (
    <Page size="A4" style={styles.page}>
      <Header title={`El año ${annual.year} y la situación actual`} label="Panorama ejecutivo" />
      <View style={styles.miniHeading}>
        <Text style={styles.miniLabel}>Resultados del ciclo</Text>
        <Text style={styles.miniMeta}>{annual.periodLabel}</Text>
      </View>
      <View style={styles.annualMetrics}>
        {annual.primaryMetrics.map((metric, index) => (
          <View
            key={metric.id}
            style={[
              styles.annualMetric,
              index === 0 ? styles.annualMetricFirst : {},
              index === annual.primaryMetrics.length - 1 ? styles.annualMetricLast : {},
            ]}
          >
            <Text style={styles.annualMetricLabel}>{metric.label}</Text>
            <Text style={styles.annualMetricValue}>{formatMetric(metric)}</Text>
            {metric.delta?.comparable && (
              <Text style={styles.annualMetricDelta}>
                {metric.delta.absolute > 0 ? "+" : ""}
                {integer.format(metric.delta.absolute)} ·{" "}
                {metric.delta.percent == null
                  ? "—"
                  : `${metric.delta.percent > 0 ? "+" : ""}${decimal.format(metric.delta.percent)}%`}
              </Text>
            )}
            <Text style={styles.annualMetricDetail}>{metric.detail}</Text>
          </View>
        ))}
      </View>
      <View style={styles.cutoffNote}>
        <Text style={styles.cutoffTitle}>Comparación anual</Text>
        <Text style={styles.cutoffText}>
          Las variaciones comparan el ciclo con el año anterior al mismo corte. La foto de
          estudiantes que sigue es actual y no se interpreta como un flujo histórico.
        </Text>
      </View>
      <View style={styles.miniHeading}>
        <Text style={styles.miniLabel}>Foto actual de trayectorias</Text>
        <Text style={styles.miniMeta}>Al {dateLabel(snapshot.snapshotDateISO)}</Text>
      </View>
      <View style={styles.statusGrid}>
        {statuses.map(([label, value, detail, accent], index) => (
          <View
            key={label}
            style={[
              styles.statusCard,
              accent,
              index === statuses.length - 1 ? styles.statusCardLast : {},
            ]}
          >
            <Text style={styles.statusLabel}>{label}</Text>
            <Text style={styles.statusValue}>{value}</Text>
            <Text style={styles.statusDetail}>{detail}</Text>
          </View>
        ))}
      </View>
      <View style={styles.criteria}>
        {criteria.map(([number, title, count], index) => (
          <View
            key={number}
            style={[styles.criterion, index === criteria.length - 1 ? styles.criterionLast : {}]}
          >
            <Text style={styles.criterionNumber}>{number}</Text>
            <Text style={styles.criterionTitle}>{title}</Text>
            <Text style={styles.criterionCount}>{count} casos actuales</Text>
          </View>
        ))}
      </View>
      <Footer model={model} page={2} />
    </Page>
  );
};

const PRESSURE_LABELS: Record<PressureLevel, string> = {
  low: "Baja",
  moderate: "Media",
  high: "Alta",
  saturated: "Saturada",
};

const Pressure = ({ model }: { model: DirectorReportModel }) => {
  const { snapshot } = model;
  return (
    <Page size="A4" style={styles.page}>
      <Header title="Presión de convocatorias y prioridades" label="Capacidad actual" />
      <View style={styles.pressureHero}>
        <View style={styles.pressureMetric}>
          <Text style={styles.pressureLabel}>Postulaciones pendientes</Text>
          <Text style={styles.pressureValue}>{snapshot.pressure.pendingApplications}</Text>
        </View>
        <View style={styles.pressureMetric}>
          <Text style={styles.pressureLabel}>Lugares disponibles</Text>
          <Text style={styles.pressureValue}>{snapshot.pressure.remainingPlaces}</Text>
        </View>
        <View style={[styles.pressureMetric, styles.pressureEmphasis]}>
          <Text style={[styles.pressureLabel, styles.pressureEmphasisLabel]}>
            Postulaciones por lugar
          </Text>
          <Text style={styles.pressureValue}>
            {snapshot.pressure.pendingPerRemainingPlace == null
              ? "Saturada"
              : decimal.format(snapshot.pressure.pendingPerRemainingPlace)}
          </Text>
        </View>
        <Text style={styles.pressureExplanation}>
          El indicador divide postulaciones pendientes por lugares todavía disponibles. Expresa
          tensión operativa, no probabilidad individual de selección.
        </Text>
      </View>
      <View style={styles.offerList}>
        {snapshot.pressure.offers.map((offer) => (
          <View
            key={offer.offerId}
            wrap={false}
            style={[
              styles.offerRow,
              offer.pressureLevel === "high" || offer.pressureLevel === "saturated"
                ? styles.offerHigh
                : offer.pressureLevel === "moderate"
                  ? styles.offerModerate
                  : {},
            ]}
          >
            <View style={styles.offerIdentity}>
              <Text
                style={[styles.offerOrientation, { color: orientationColor(offer.orientation) }]}
              >
                {offer.orientation || "Sin orientación"}
              </Text>
              <Text style={styles.offerName}>{offer.offerName}</Text>
            </View>
            <View style={styles.offerFact}>
              <Text style={styles.offerFactValue}>{offer.pendingApplications}</Text>
              <Text style={styles.offerFactLabel}>pendientes</Text>
            </View>
            <View style={styles.offerFact}>
              <Text style={styles.offerFactValue}>{offer.remainingPlaces}</Text>
              <Text style={styles.offerFactLabel}>lugares</Text>
            </View>
            <View style={styles.offerPressure}>
              <Text style={styles.offerPressureLabel}>
                Presión {PRESSURE_LABELS[offer.pressureLevel]}
              </Text>
              <Text style={styles.offerPressureValue}>
                {offer.pressureLevel === "saturated"
                  ? "Sin lugar libre"
                  : `${decimal.format(offer.pendingPerRemainingPlace || 0)} por lugar`}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.actionStrip}>
        {[
          [
            "Acción inmediata",
            `${snapshot.pressure.highPressureOffers} convocatorias exigidas`,
            "Revisar alternativas para ofertas saturadas o con 2 postulaciones por lugar.",
          ],
          [
            "Seguimiento académico",
            `${snapshot.studentSummary.criteriaCompleteActive} trayectorias completas`,
            "Cumplen lo académico, pero conservan alguna práctica activa.",
          ],
          [
            "Trámite posible",
            `${snapshot.studentSummary.readyToRequest} solicitudes a promover`,
            "Cumplen requisitos y no registran solicitud ni práctica activa.",
          ],
        ].map(([label, title, text], index, rows) => (
          <View
            key={label}
            style={[styles.actionCard, index === rows.length - 1 ? styles.actionCardLast : {}]}
          >
            <Text style={styles.actionLabel}>{label}</Text>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionText}>{text}</Text>
          </View>
        ))}
      </View>
      <Footer model={model} page={3} />
    </Page>
  );
};

const WithoutRow = ({ student, index }: { student: WithoutPpsStudent; index: number }) => (
  <View wrap={false} style={[styles.tableRow, index % 2 ? styles.tableRowEven : {}]}>
    <View style={[styles.tableCell, styles.tableIdentity]}>
      <Text style={styles.studentName}>{student.fullName}</Text>
      <StudentMeta student={student} />
    </View>
    <View style={[styles.tableCell, styles.tableFacts]}>
      <Text style={styles.studentFacts}>
        <Text style={styles.studentFactsStrong}>{student.applicationCount}</Text> postulaciones del
        ciclo{"\n"}
        <Text style={styles.studentFactsStrong}>{student.pendingApplications}</Text> pendientes
        ahora
      </Text>
    </View>
  </View>
);

const REASON_LABELS: Record<DirectorNearReasonCode, string> = {
  total_hours_230_249: "A 20 h o menos del total",
  missing_one_orientation: "Falta una orientación",
  specialty_gap_20_or_less: "A 20 h o menos de especialidad",
};

const NearRow = ({ student, index }: { student: NearCompletionStudent; index: number }) => (
  <View wrap={false} style={[styles.tableRow, index % 2 ? styles.tableRowEven : {}]}>
    <View style={[styles.tableCell, styles.tableIdentity]}>
      <View style={styles.studentNameRow}>
        <Text style={[styles.studentName, styles.studentNameNear]}>{student.fullName}</Text>
        <Text style={styles.reasonTag}>{REASON_LABELS[student.reasonCode]}</Text>
      </View>
      <StudentMeta student={student} />
    </View>
    <View style={[styles.tableCell, styles.tableFacts]}>
      <Text style={styles.studentFacts}>
        <Text style={styles.studentFactsStrong}>{integer.format(student.totalHours)}</Text> h
        totales ·{" "}
        <Text style={styles.studentFactsStrong}>{integer.format(student.specialtyHours)}</Text> h
        especialidad{"\n"}
        <Text style={styles.studentFactsStrong}>{student.rotations}</Text> orientaciones
        {student.activePractices > 0 ? ` · ${student.activePractices} PPS activa` : ""}
      </Text>
    </View>
  </View>
);

const NominalPages = ({ model }: { model: DirectorReportModel }) => {
  const withoutPages = chunk(model.snapshot.withoutPpsStudents, 18);
  const nearPages = chunk(model.snapshot.nearCompletionStudents, 18);
  return (
    <>
      {withoutPages.map((rows, index) => (
        <Page key={`without-${index}`} size="A4" style={styles.page}>
          <Header
            title="Sin PPS · demanda activa"
            label={`Seguimiento nominal · ${index + 1} de ${withoutPages.length}`}
          />
          <View style={styles.listIntro}>
            <Text style={styles.listIntroText}>
              Estudiantes activos sin prácticas cargadas que se postularon al menos una vez a una
              PPS durante {model.annual.year}. Se excluyen quienes no muestran actividad de búsqueda
              en el ciclo.
            </Text>
            <Text style={styles.listIntroCount}>
              {model.snapshot.studentSummary.withoutPps} estudiantes
            </Text>
          </View>
          <View style={styles.table}>
            {rows.map((student, rowIndex) => (
              <WithoutRow key={student.studentId} student={student} index={rowIndex} />
            ))}
          </View>
          <Footer model={model} page={4 + index} />
        </Page>
      ))}
      {nearPages.map((rows, index) => (
        <Page key={`near-${index}`} size="A4" style={styles.page}>
          <Header
            title="Próximos a finalizar"
            label={`Seguimiento nominal · ${index + 1} de ${nearPages.length}`}
          />
          <View style={styles.listIntro}>
            <Text style={styles.listIntroText}>
              Listado deduplicado. Cada estudiante aparece bajo un único motivo: tramo de horas,
              rotación faltante o brecha de especialidad. Excluye quienes ya realizaron Relevamiento
              Profesional o Entrevista a Profesionales.
            </Text>
            <Text style={styles.listIntroCount}>
              {model.snapshot.studentSummary.nearCompletion} estudiantes
            </Text>
          </View>
          <View style={styles.table}>
            {rows.map((student, rowIndex) => (
              <NearRow key={student.studentId} student={student} index={rowIndex} />
            ))}
          </View>
          <Footer model={model} page={4 + withoutPages.length + index} />
        </Page>
      ))}
    </>
  );
};

const Actions = ({ model, page }: { model: DirectorReportModel; page: number }) => (
  <Page size="A4" style={styles.page}>
    <Header title="Solicitudes y acreditaciones" label="Próximos pasos" />
    <View style={styles.dual}>
      <View style={[styles.dualColumn, styles.dualLeft]}>
        <View style={styles.subhead}>
          <Text style={styles.subheadLabel}>
            Acción sugerida · {model.snapshot.readyToRequestStudents.length}
          </Text>
          <Text style={styles.subheadTitle}>En condiciones de solicitar</Text>
        </View>
        <Text style={styles.subcopy}>
          Alcanzaron 250 horas, 70 de especialidad y tres orientaciones; no tienen práctica activa
          ni solicitud.
        </Text>
        {model.snapshot.readyToRequestStudents.map((student) => (
          <View key={student.studentId} style={styles.compactRow} wrap={false}>
            <Text style={styles.compactName}>{student.fullName}</Text>
            <StudentMeta student={student} />
            <Text style={styles.compactDetail}>
              {student.totalHours} h · {student.specialtyHours} h especialidad · {student.rotations}{" "}
              orientaciones
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.dualColumn}>
        <View style={styles.subhead}>
          <Text style={styles.subheadLabel}>
            Trámite en curso · {model.snapshot.accreditationStudents.length}
          </Text>
          <Text style={styles.subheadTitle}>Con solicitud de acreditación</Text>
        </View>
        <Text style={styles.subcopy}>
          Estudiantes activos que ya poseen una solicitud de finalización registrada en el sistema.
        </Text>
        {model.snapshot.accreditationStudents.map((student) => (
          <View key={student.studentId} style={styles.compactRow} wrap={false}>
            <Text style={styles.compactName}>{student.fullName}</Text>
            <StudentMeta student={student} />
            <Text style={styles.compactDetail}>{student.status || "Estado sin especificar"}</Text>
          </View>
        ))}
      </View>
    </View>
    <View style={styles.closingNote}>
      <Text style={styles.closingTitle}>Uso previsto</Text>
      <Text style={styles.closingText}>
        Este anexo nominal sirve para priorizar acompañamientos. No reemplaza la revisión individual
        del legajo ni debe circular fuera de las autoridades y equipos autorizados.
      </Text>
    </View>
    <Footer model={model} page={page} />
  </Page>
);

export const DirectorReportPdf = ({ model }: { model: DirectorReportModel }) => {
  const withoutPages = Math.max(1, Math.ceil(model.snapshot.withoutPpsStudents.length / 18));
  const nearPages = Math.max(1, Math.ceil(model.snapshot.nearCompletionStudents.length / 18));
  return (
    <Document
      title={`Informe para Dirección de Carrera · PPS ${model.annual.year}`}
      author={model.annual.author.name}
      subject="Seguimiento institucional y nominal de PPS"
      keywords="PPS, Dirección de Carrera, Sede Comahue, circulación interna"
    >
      <Cover model={model} />
      <Overview model={model} />
      <Pressure model={model} />
      <NominalPages model={model} />
      <Actions model={model} page={4 + withoutPages + nearPages} />
    </Document>
  );
};
