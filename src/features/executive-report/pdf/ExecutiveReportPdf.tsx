import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import manropeRegular from "@fontsource/manrope/files/manrope-latin-400-normal.woff?url";
import manropeMedium from "@fontsource/manrope/files/manrope-latin-500-normal.woff?url";
import manropeSemiBold from "@fontsource/manrope/files/manrope-latin-600-normal.woff?url";
import manropeBold from "@fontsource/manrope/files/manrope-latin-700-normal.woff?url";
import sourceSerifSemiBold from "@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff?url";
import sourceSerifBold from "@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff?url";
import type { ExecutiveReportModel, ReportMetric } from "../executiveReport.types";

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
  blue: "#2337C9",
  teal: "#299E94",
  plum: "#46153D",
  ink: "#151A27",
  muted: "#697386",
  rule: "#DFE3EA",
  pale: "#F7F8FA",
  white: "#FFFFFF",
  tealPale: "#E9F7F2",
};

const ORIENTATION_COLORS: Record<string, string> = {
  clinica: "#3CB88D",
  educacional: "#203B73",
  laboral: "#C23B3F",
  comunitaria: "#7A3F9E",
  juridica: "#697386",
  investigacion: "#697386",
  sindefinir: "#697386",
};

const ORIENTATION_TEXT_COLORS: Record<string, string> = {
  clinica: "#27795D",
  educacional: "#203B73",
  laboral: "#A83237",
  comunitaria: "#673584",
  juridica: "#4F596B",
  investigacion: "#4F596B",
  sindefinir: "#4F596B",
};

const ORIENTATION_PALES: Record<string, string> = {
  clinica: "#E7F6F0",
  educacional: "#E9ECF3",
  laboral: "#F8ECEC",
  comunitaria: "#F1EBF5",
  juridica: "#F0F1F3",
  investigacion: "#F0F1F3",
  sindefinir: "#F0F1F3",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    color: C.ink,
    fontFamily: "Manrope",
    fontSize: 9,
    paddingBottom: 40,
    paddingHorizontal: 48,
    paddingTop: 48,
  },
  cover: {
    borderTopColor: C.navy,
    borderTopWidth: 9,
    justifyContent: "space-between",
    paddingTop: 38,
  },
  managementCover: {
    backgroundColor: C.navy,
    borderTopColor: C.teal,
    color: C.white,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  wordmark: {
    alignItems: "baseline",
    flexDirection: "row",
  },
  wordmarkMain: {
    color: C.navy,
    fontSize: 19,
    fontWeight: 700,
    letterSpacing: -1,
  },
  wordmarkSub: {
    color: C.navy,
    fontSize: 6,
    fontWeight: 700,
    letterSpacing: 1.1,
    marginLeft: 6,
    textTransform: "uppercase",
  },
  inverse: { color: C.white },
  docType: {
    color: C.muted,
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  coverBody: { marginBottom: 20, marginTop: 20, maxWidth: 455 },
  kicker: {
    color: C.muted,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  coverTitle: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 38,
    fontWeight: 600,
    letterSpacing: -1.2,
    lineHeight: 1,
    marginBottom: 8,
    marginTop: 10,
  },
  coverSubtitle: { color: C.muted, fontSize: 11, lineHeight: 1.45 },
  shortRule: { backgroundColor: C.teal, height: 4, marginBottom: 20, marginTop: 25, width: 70 },
  coverHeadline: {
    color: C.ink,
    fontFamily: "Source Serif 4",
    fontSize: 16,
    lineHeight: 1.42,
    maxWidth: 430,
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
    minHeight: 65,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  coverMetricFirst: { paddingLeft: 0 },
  coverMetricLast: { borderRightWidth: 0 },
  coverMetricValue: { color: C.navy, fontSize: 20, fontWeight: 700, letterSpacing: -0.7 },
  coverMetricLabel: { color: C.muted, fontSize: 6.5, lineHeight: 1.4, marginTop: 5 },
  signature: { color: C.muted, fontSize: 7, lineHeight: 1.6 },
  signatureName: { color: C.ink, fontSize: 8, fontWeight: 700 },
  managementTitleBlock: { marginTop: 30 },
  managementOverline: {
    color: "#AEB8DC",
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  managementTitle: {
    color: C.white,
    fontFamily: "Source Serif 4",
    fontSize: 46,
    fontWeight: 600,
    letterSpacing: -1.5,
    lineHeight: 1,
    marginTop: 9,
  },
  managementYears: {
    color: C.teal,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: -1,
    marginTop: 3,
  },
  managementUnit: {
    color: "#AEB8DC",
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1,
    marginTop: 14,
    textTransform: "uppercase",
  },
  arrivalRow: { alignItems: "center", flexDirection: "row", marginVertical: 30 },
  arrivalRule: { backgroundColor: C.teal, height: 2, marginRight: 15, width: 85 },
  arrivalLabel: { color: "#AEB8DC", fontSize: 6.5, letterSpacing: 0.8, textTransform: "uppercase" },
  arrivalDate: { color: C.white, fontFamily: "Source Serif 4", fontSize: 13, marginTop: 3 },
  managementIntro: {
    borderLeftColor: C.teal,
    borderLeftWidth: 3,
    color: C.white,
    fontFamily: "Source Serif 4",
    fontSize: 15,
    lineHeight: 1.45,
    maxWidth: 430,
    paddingLeft: 16,
  },
  managementSignature: {
    borderTopColor: "#394684",
    borderTopWidth: 1,
    color: "#AEB8DC",
    fontSize: 7,
    paddingTop: 12,
  },
  pageHeader: {
    alignItems: "center",
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  sectionLabel: {
    color: C.teal,
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 21,
    fontWeight: 600,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  pageFooter: {
    alignItems: "center",
    borderTopColor: C.rule,
    borderTopWidth: 1,
    bottom: 22,
    color: C.muted,
    flexDirection: "row",
    fontSize: 5.8,
    justifyContent: "space-between",
    left: 48,
    paddingTop: 8,
    position: "absolute",
    right: 48,
  },
  readingGrid: { flexDirection: "row", marginBottom: 30, marginTop: 35 },
  readingLead: { marginRight: 35, width: "43%" },
  readingHeadline: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 15,
    lineHeight: 1.45,
  },
  readingPeriod: {
    color: C.muted,
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.7,
    marginTop: 15,
    textTransform: "uppercase",
  },
  findings: { flex: 1 },
  finding: {
    borderTopColor: C.rule,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingVertical: 9,
  },
  findingNumber: { color: C.teal, fontSize: 6.5, fontWeight: 700, marginRight: 13, width: 15 },
  findingText: { color: "#343B4B", flex: 1, fontSize: 8.5, lineHeight: 1.55 },
  metricBand: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    borderTopColor: C.rule,
    borderTopWidth: 1,
    flexDirection: "row",
  },
  metric: { borderRightColor: C.rule, borderRightWidth: 1, flex: 1, minHeight: 104, padding: 11 },
  metricFirst: { paddingLeft: 0 },
  metricLast: { borderRightWidth: 0 },
  metricLabel: {
    color: C.muted,
    fontSize: 6.2,
    fontWeight: 700,
    letterSpacing: 0.45,
    lineHeight: 1.35,
    minHeight: 18,
    textTransform: "uppercase",
  },
  metricValue: { color: C.navy, fontSize: 19, fontWeight: 700, letterSpacing: -0.6, marginTop: 5 },
  metricDetail: { color: C.muted, fontSize: 6.5, lineHeight: 1.5, marginTop: 7 },
  delta: { color: "#137457", fontSize: 7.8, fontWeight: 700, marginTop: 5 },
  deltaMuted: { color: C.muted },
  deltaNegative: { color: C.plum },
  note: { borderLeftColor: C.teal, borderLeftWidth: 3, marginTop: 28, paddingLeft: 13 },
  noteTitle: { color: C.navy, fontSize: 8, fontWeight: 700 },
  noteText: { color: C.muted, fontSize: 7.5, lineHeight: 1.55, marginTop: 4, maxWidth: 430 },
  comparisonBasis: {
    alignItems: "center",
    backgroundColor: "#F3F7F7",
    borderLeftColor: C.teal,
    borderLeftWidth: 4,
    flexDirection: "row",
    marginTop: 28,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  comparisonPeriods: {
    borderRightColor: C.rule,
    borderRightWidth: 1,
    paddingRight: 18,
    width: "48%",
  },
  comparisonEyebrow: {
    color: C.teal,
    fontSize: 5.8,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  comparisonPeriodRow: { alignItems: "baseline", flexDirection: "row", marginTop: 7 },
  comparisonPeriod: { color: C.navy, fontFamily: "Source Serif 4", fontSize: 11.5 },
  comparisonAgainst: {
    color: C.muted,
    fontSize: 5.5,
    marginHorizontal: 8,
    textTransform: "uppercase",
  },
  comparisonExplanation: { flex: 1, paddingLeft: 18 },
  comparisonTitle: { color: C.ink, fontSize: 7, fontWeight: 700 },
  comparisonText: { color: C.muted, fontSize: 6.4, lineHeight: 1.5, marginTop: 4 },
  twoColumn: { flexDirection: "row", marginTop: 34 },
  column: { flex: 1 },
  columnLeft: { marginRight: 38 },
  h3: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 14,
  },
  stackedMetric: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    paddingBottom: 11,
    paddingTop: 8,
  },
  equation: { alignItems: "center", flexDirection: "row" },
  equationItem: {
    alignSelf: "flex-start",
    borderTopColor: C.rule,
    borderTopWidth: 3,
    flex: 1,
    paddingTop: 10,
  },
  equationTotal: { borderTopColor: C.teal },
  equationSymbol: { color: C.muted, fontSize: 10, marginHorizontal: 8 },
  equationValue: { color: C.navy, fontSize: 17, fontWeight: 700 },
  equationLabel: { color: C.muted, fontSize: 6.2, lineHeight: 1.4, marginTop: 4 },
  equationExplainer: { color: C.muted, fontSize: 6.8, lineHeight: 1.5, marginTop: 14 },
  capacitySource: {
    backgroundColor: "#F2F8F7",
    borderLeftColor: C.teal,
    borderLeftWidth: 3,
    marginTop: 10,
    padding: 8,
  },
  capacitySourceTitle: {
    color: C.navy,
    fontSize: 5.5,
    fontWeight: 700,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  capacitySourceText: { color: "#38534F", fontSize: 6.1, lineHeight: 1.45, marginTop: 3 },
  verifiedNote: {
    backgroundColor: C.tealPale,
    borderLeftColor: C.teal,
    borderLeftWidth: 3,
    color: "#174F3F",
    fontSize: 7,
    lineHeight: 1.5,
    marginTop: 18,
    padding: 10,
  },
  orientationBlock: {
    borderTopColor: C.rule,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 36,
    paddingTop: 22,
  },
  orientationIntro: { marginRight: 35, width: "31%" },
  orientationIntroText: { color: C.muted, fontSize: 7, lineHeight: 1.5 },
  bars: { flex: 1 },
  barRow: { alignItems: "center", flexDirection: "row", marginBottom: 9 },
  barLabel: { fontSize: 6.7, marginRight: 8, width: 68 },
  barTrack: { backgroundColor: "#EDF0F4", height: 7, flex: 1 },
  barFill: { backgroundColor: C.teal, height: 7 },
  barValue: { fontSize: 6.7, fontWeight: 700, marginLeft: 8, textAlign: "right", width: 24 },
  qualityGrid: { flexDirection: "row", marginTop: 35 },
  qualityIntro: { marginRight: 34, width: "34%" },
  qualityIntroText: { color: C.muted, fontSize: 7.5, lineHeight: 1.55 },
  qualityList: { flex: 1 },
  qualityRow: { borderBottomColor: C.rule, borderBottomWidth: 1, paddingVertical: 9 },
  qualityLine: { flexDirection: "row", justifyContent: "space-between" },
  qualityLabel: { fontSize: 7.5, fontWeight: 600, maxWidth: 200 },
  qualityValue: { color: C.navy, fontSize: 10, fontWeight: 700 },
  qualityDetail: { color: C.muted, fontSize: 6.5, lineHeight: 1.5, marginTop: 4 },
  agreementsBlock: { borderTopColor: C.rule, borderTopWidth: 1, marginTop: 28, paddingTop: 20 },
  agreementsHeading: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  agreementsIntro: {
    color: C.muted,
    fontSize: 6.5,
    lineHeight: 1.45,
    textAlign: "right",
    width: 205,
  },
  agreementList: { borderTopColor: C.navy, borderTopWidth: 2.5 },
  agreementRow: {
    alignItems: "center",
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    paddingVertical: 8,
  },
  agreementIndex: { color: C.teal, fontSize: 6, fontWeight: 700, width: 24 },
  agreementIdentity: { flex: 1, paddingRight: 10 },
  agreementName: { color: C.ink, fontFamily: "Source Serif 4", fontSize: 9, lineHeight: 1.25 },
  agreementOrientations: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  agreementOrientationTag: {
    fontSize: 5,
    fontWeight: 700,
    marginRight: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  agreementFact: { borderLeftColor: C.rule, borderLeftWidth: 1, paddingLeft: 10, width: 76 },
  agreementFactValue: { color: C.navy, fontSize: 12, fontWeight: 700 },
  agreementFactLabel: { color: C.muted, fontSize: 5.3, lineHeight: 1.3, marginTop: 2 },
  timeline: { alignItems: "center", flexDirection: "row", marginBottom: 24, marginTop: 34 },
  timelineYear: { fontSize: 7, fontWeight: 700 },
  timelineTrack: {
    backgroundColor: C.rule,
    flex: 1,
    height: 2,
    marginHorizontal: 12,
    position: "relative",
  },
  timelineMarker: {
    backgroundColor: C.teal,
    height: 14,
    left: "66.7%",
    position: "absolute",
    top: -6,
    width: 3,
  },
  timelineMarkerLabel: { color: C.teal, fontSize: 5.5, left: "57%", position: "absolute", top: 11 },
  caveat: { color: C.muted, fontSize: 6.5, lineHeight: 1.4, marginBottom: 18, textAlign: "center" },
  seriesHeader: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    color: C.muted,
    flexDirection: "row",
    fontSize: 5.7,
    fontWeight: 700,
    letterSpacing: 0.5,
    paddingBottom: 8,
    textTransform: "uppercase",
  },
  seriesRow: {
    alignItems: "center",
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 47,
  },
  seriesYear: { width: "21%" },
  seriesSmallCol: { textAlign: "center", width: "13%" },
  seriesCapacityCol: { width: "32%" },
  seriesYearMain: { color: C.navy, fontSize: 10, fontWeight: 700 },
  seriesYearSub: { color: C.muted, fontSize: 5.7, marginTop: 2 },
  seriesNumber: { fontSize: 8, fontWeight: 700 },
  seriesBar: { backgroundColor: "#EDF0F4", height: 11, position: "relative" },
  seriesBarFill: { backgroundColor: C.teal, height: 11 },
  seriesBarValue: { fontSize: 6.5, fontWeight: 700, position: "absolute", right: 4, top: 1.5 },
  methodGrid: { flexDirection: "row", marginTop: 35 },
  methodColumn: { flex: 1 },
  methodColumnLeft: { marginRight: 42 },
  methodItem: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingVertical: 9,
  },
  methodBullet: { color: C.teal, fontSize: 7, fontWeight: 700, marginRight: 8, width: 12 },
  methodText: { color: "#343B4B", flex: 1, fontSize: 7.2, lineHeight: 1.55 },
  dataContract: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    borderTopColor: C.rule,
    borderTopWidth: 1,
    marginTop: 33,
    paddingVertical: 12,
  },
  contractRow: { flexDirection: "row", marginVertical: 3 },
  contractLabel: { color: C.muted, fontSize: 6.5, width: "40%" },
  contractValue: { fontSize: 6.5, fontWeight: 700 },
  finalSignature: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
  },
  annexPage: { paddingBottom: 60, paddingTop: 48 },
  annexHeaderFixed: {
    backgroundColor: C.white,
    left: 48,
    position: "absolute",
    right: 48,
    top: 30,
  },
  table: { marginTop: 18 },
  tableHeader: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    color: C.muted,
    flexDirection: "row",
    fontSize: 5.4,
    fontWeight: 700,
    letterSpacing: 0.5,
    paddingBottom: 6,
    textTransform: "uppercase",
  },
  tableRow: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 25,
    paddingVertical: 5,
  },
  tableCell: { fontSize: 6.2, lineHeight: 1.35, paddingRight: 6 },
  offerCol: { width: "35%" },
  orientationCol: { width: "17%" },
  dateCol: { width: "17%" },
  modeCol: { width: "19%" },
  capacityCol: { textAlign: "right", width: "12%" },
  annexIntro: { color: C.muted, fontSize: 7.5, lineHeight: 1.5, marginBottom: 16, marginTop: 18 },
  monthBlock: { marginBottom: 16 },
  monthHeader: {
    alignItems: "center",
    backgroundColor: C.navy,
    color: C.white,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  monthName: {
    fontFamily: "Source Serif 4",
    fontSize: 11,
    fontWeight: 600,
  },
  monthSummary: { color: "#CBD2ED", fontSize: 6.5, fontWeight: 500 },
  offerGrid: {
    borderLeftColor: C.rule,
    borderLeftWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  offerRow: {
    alignItems: "center",
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    borderRightColor: C.rule,
    borderRightWidth: 1,
    flexDirection: "row",
    minHeight: 56,
    paddingHorizontal: 9,
    paddingVertical: 8,
    width: "50%",
  },
  offerIdentity: { flex: 1, paddingRight: 9 },
  offerName: { color: C.ink, fontSize: 8.5, fontWeight: 600, lineHeight: 1.35 },
  offerOrientation: { fontSize: 6.1, fontWeight: 700, lineHeight: 1.3, marginTop: 3 },
  offerDate: { color: "#4F596B", fontSize: 6.5, fontWeight: 500, textAlign: "center", width: 32 },
  offerCapacity: { borderLeftColor: C.rule, borderLeftWidth: 1, paddingLeft: 8, width: 72 },
  offerCapacityValue: { color: C.navy, fontSize: 10.5, fontWeight: 700 },
  offerCapacityNote: { color: "#4F596B", fontSize: 6, lineHeight: 1.4, marginTop: 3 },
});

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

const comparisonPeriod = (year: number, cutoffISO: string): string => {
  if (cutoffISO.endsWith("-12-31")) return `Cierre ${year}`;
  const [, month, day] = cutoffISO.split("-");
  return `${year} · al ${day}/${month}`;
};

const formatMetric = (metric: ReportMetric): string => {
  if (metric.value == null) return "No disponible";
  const formatted = Number.isInteger(metric.value)
    ? integer.format(metric.value)
    : decimal.format(metric.value);
  return metric.unit === "%"
    ? `${formatted}%`
    : metric.unit
      ? `${formatted} ${metric.unit}`
      : formatted;
};

const Wordmark = ({ inverse = false }: { inverse?: boolean }) => (
  <View style={styles.wordmark}>
    <Text style={[styles.wordmarkMain, inverse ? styles.inverse : {}]}>UFLO</Text>
    <Text style={[styles.wordmarkSub, inverse ? styles.inverse : {}]}>Universidad</Text>
  </View>
);

const Footer = ({ model }: { model: ExecutiveReportModel }) => (
  <View style={styles.pageFooter} fixed>
    <Text>Fuente: Mi Panel Académico · {model.current.metricVersion}</Text>
    <Text
      render={({ pageNumber, totalPages }) =>
        `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
      }
    />
  </View>
);

const Header = ({ title, label }: { title: string; label: string }) => (
  <View style={styles.pageHeader}>
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <Wordmark />
  </View>
);

const Metric = ({
  metric,
  index,
  total,
}: {
  metric: ReportMetric;
  index: number;
  total: number;
}) => {
  const delta = metric.delta;
  const sign = delta && delta.absolute > 0 ? "+" : "";
  return (
    <View
      style={[
        styles.metric,
        index === 0 ? styles.metricFirst : {},
        index === total - 1 ? styles.metricLast : {},
      ]}
    >
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricValue}>{formatMetric(metric)}</Text>
      {delta?.comparable && (
        <Text style={[styles.delta, delta.absolute < 0 ? styles.deltaNegative : {}]}>
          {`${sign}${integer.format(delta.absolute)} ${metric.deltaUnit || ""}${delta.percent == null ? "" : ` · ${sign}${decimal.format(delta.percent)}%`}`}
        </Text>
      )}
      <Text style={styles.metricDetail}>{metric.detail}</Text>
    </View>
  );
};

const AnnualCover = ({ model }: { model: ExecutiveReportModel }) => (
  <Page size="A4" style={[styles.page, styles.cover]}>
    <View style={styles.rowBetween}>
      <Wordmark />
      <Text style={styles.docType}>Documento para autoridades</Text>
    </View>
    <View style={styles.coverBody}>
      <Text style={styles.kicker}>Psicología · Sede Comahue</Text>
      <Text style={styles.coverTitle}>{model.title}</Text>
      <Text style={styles.coverSubtitle}>{model.subtitle}</Text>
      <View style={styles.shortRule} />
      <Text style={styles.coverHeadline}>{model.headline}</Text>
    </View>
    <View style={styles.coverMetrics}>
      {model.primaryMetrics.slice(0, 4).map((metric, index) => (
        <View
          key={metric.id}
          style={[
            styles.coverMetric,
            index === 0 ? styles.coverMetricFirst : {},
            index === 3 ? styles.coverMetricLast : {},
          ]}
        >
          <Text style={styles.coverMetricValue}>{formatMetric(metric)}</Text>
          <Text style={styles.coverMetricLabel}>{metric.label}</Text>
        </View>
      ))}
    </View>
    <View style={styles.rowBetween}>
      <View style={styles.signature}>
        <Text style={styles.signatureName}>{model.author.name}</Text>
        <Text>{model.author.role}</Text>
        <Text>{model.author.unit}</Text>
      </View>
      <View style={[styles.signature, { textAlign: "right" }]}>
        <Text>{model.periodLabel}</Text>
        <Text>{model.author.email}</Text>
      </View>
    </View>
  </Page>
);

const ManagementCover = ({ model }: { model: ExecutiveReportModel }) => (
  <Page size="A4" style={[styles.page, styles.cover, styles.managementCover]}>
    <View style={styles.rowBetween}>
      <Wordmark inverse />
      <Text style={[styles.docType, { color: "#AEB8DC" }]}>Rendición institucional</Text>
    </View>
    <View style={styles.managementTitleBlock}>
      <Text style={styles.managementOverline}>Coordinación General de PPS</Text>
      <Text style={styles.managementTitle}>Informe de gestión</Text>
      <Text style={styles.managementYears}>2024—{model.year}</Text>
      <Text style={styles.managementUnit}>Psicología · Sede Comahue</Text>
    </View>
    <View style={styles.arrivalRow}>
      <View style={styles.arrivalRule} />
      <View>
        <Text style={styles.arrivalLabel}>Inicio de gestión</Text>
        <Text style={styles.arrivalDate}>1 de septiembre de 2024</Text>
      </View>
    </View>
    <Text style={styles.managementIntro}>{model.headline}</Text>
    <View style={[styles.managementSignature, styles.rowBetween]}>
      <Text>
        {model.author.name} · {model.author.role}
      </Text>
      <Text>{model.author.email}</Text>
    </View>
  </Page>
);

const ExecutiveReading = ({ model }: { model: ExecutiveReportModel }) => (
  <Page size="A4" style={styles.page}>
    <Header title="Lectura ejecutiva" label="Síntesis del período" />
    <View style={styles.readingGrid}>
      <View style={styles.readingLead}>
        <Text style={styles.readingHeadline}>{model.headline}</Text>
        <Text style={styles.readingPeriod}>{model.periodLabel}</Text>
      </View>
      <View style={styles.findings}>
        {model.executiveSummary.map((finding, index) => (
          <View style={styles.finding} key={finding}>
            <Text style={styles.findingNumber}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={styles.findingText}>{finding}</Text>
          </View>
        ))}
      </View>
    </View>
    <View style={styles.metricBand}>
      {model.primaryMetrics.map((metric, index) => (
        <Metric key={metric.id} metric={metric} index={index} total={model.primaryMetrics.length} />
      ))}
    </View>
    {model.previous &&
      [...model.primaryMetrics, ...model.demandMetrics].some(
        (metric) => metric.delta?.comparable
      ) && (
        <View style={styles.comparisonBasis}>
          <View style={styles.comparisonPeriods}>
            <Text style={styles.comparisonEyebrow}>Base de comparación</Text>
            <View style={styles.comparisonPeriodRow}>
              <Text style={styles.comparisonPeriod}>
                {comparisonPeriod(model.current.year, model.current.cutoffISO)}
              </Text>
              <Text style={styles.comparisonAgainst}>contra</Text>
              <Text style={styles.comparisonPeriod}>
                {comparisonPeriod(model.previous.year, model.previous.cutoffISO)}
              </Text>
            </View>
          </View>
          <View style={styles.comparisonExplanation}>
            <Text style={styles.comparisonTitle}>Cómo leer los valores verdes</Text>
            <Text style={styles.comparisonText}>
              Muestran cuánto cambió cada indicador frente al ciclo anterior al mismo corte: primero
              la diferencia absoluta y luego la variación porcentual.
              {model.comparisonContext ? ` ${model.comparisonContext}` : ""}
            </Text>
          </View>
        </View>
      )}
    <Footer model={model} />
  </Page>
);

const AnnualEvidence = ({ model }: { model: ExecutiveReportModel }) => {
  const maxCapacity = Math.max(1, ...model.orientations.map((item) => item.capacity));
  return (
    <Page size="A4" style={styles.page}>
      <Header title="Acceso, demanda y oferta" label="Evidencia del ciclo" />
      <View style={styles.twoColumn}>
        <View style={[styles.column, styles.columnLeft]}>
          <Text style={styles.h3}>Demanda registrada</Text>
          {model.demandMetrics.map((metric) => (
            <View style={styles.stackedMetric} key={metric.id}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{formatMetric(metric)}</Text>
              <Text style={styles.metricDetail}>{metric.detail}</Text>
            </View>
          ))}
        </View>
        <View style={styles.column}>
          <Text style={styles.h3}>Cómo se construye la capacidad registrada</Text>
          <View style={styles.equation}>
            <View style={styles.equationItem}>
              <Text style={styles.equationValue}>{model.current.capacity.fixedOffered}</Text>
              <Text style={styles.equationLabel}>cupos publicados con límite</Text>
            </View>
            <Text style={styles.equationSymbol}>+</Text>
            <View style={styles.equationItem}>
              <Text style={styles.equationValue}>{model.current.capacity.realized}</Text>
              <Text style={styles.equationLabel}>participantes sin límite prefijado</Text>
            </View>
            <Text style={styles.equationSymbol}>=</Text>
            <View style={[styles.equationItem, styles.equationTotal]}>
              <Text style={styles.equationValue}>{model.current.capacity.operational}</Text>
              <Text style={styles.equationLabel}>lugares registrados</Text>
            </View>
          </View>
          {model.year !== 2024 && (
            <>
              <Text style={styles.equationExplainer}>
                En ofertas con cupo se cuenta lo publicado. Cuando no existe un límite prefijado, se
                cuentan los estudiantes efectivamente incorporados.
              </Text>
              {model.realizedCapacityContext && (
                <View style={styles.capacitySource}>
                  <Text style={styles.capacitySourceTitle}>Procedencia de los participantes</Text>
                  <Text style={styles.capacitySourceText}>{model.realizedCapacityContext}</Text>
                </View>
              )}
            </>
          )}
          {model.year === 2024 && (
            <Text style={styles.verifiedNote}>
              Resultado oficial: 42 ofertas; 36 finitas por 270 vacantes y 6 sin cupo finito.
            </Text>
          )}
        </View>
      </View>
      <View style={styles.orientationBlock}>
        <View style={styles.orientationIntro}>
          <Text style={styles.h3}>Distribución por orientación</Text>
          <Text style={styles.orientationIntroText}>
            Lugares registrados, atribuidos a la orientación de cada oferta.
          </Text>
        </View>
        <View style={styles.bars}>
          {model.orientations.length ? (
            model.orientations.map((item) => (
              <View style={styles.barRow} key={item.key}>
                <Text style={styles.barLabel}>{item.label}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: ORIENTATION_COLORS[item.key] || C.teal,
                        width: `${(item.capacity / maxCapacity) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{item.capacity}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.orientationIntroText}>
              El detalle no está disponible para este corte; el total oficial se conserva en la
              síntesis.
            </Text>
          )}
        </View>
      </View>
      <Footer model={model} />
    </Page>
  );
};

const OutcomesInstitutions = ({ model }: { model: ExecutiveReportModel }) => (
  <Page size="A4" style={styles.page}>
    <Header title="Resultados e instituciones" label="Trayectorias y vínculos del ciclo" />
    <View style={[styles.metricBand, { marginTop: 34 }]}>
      {model.outcomeMetrics.map((metric, index) => (
        <Metric key={metric.id} metric={metric} index={index} total={model.outcomeMetrics.length} />
      ))}
    </View>
    {model.agreements.length > 0 && (
      <View style={styles.agreementsBlock}>
        <View style={styles.agreementsHeading}>
          <View>
            <Text style={styles.sectionLabel}>Red institucional</Text>
            <Text style={styles.h3}>Convenios incorporados en {model.year}</Text>
          </View>
          <Text style={styles.agreementsIntro}>
            Instituciones dadas de alta en el ciclo, con orientación y aporte registrado.
          </Text>
        </View>
        <View style={styles.agreementList}>
          {model.agreements.map((agreement, index) => (
            <View style={styles.agreementRow} key={agreement.institucion} wrap={false}>
              <Text style={styles.agreementIndex}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={styles.agreementIdentity}>
                <Text style={styles.agreementName}>{agreement.institucion}</Text>
                <View style={styles.agreementOrientations}>
                  {agreement.orientaciones.map((orientation) => (
                    <Text
                      key={orientation}
                      style={[
                        styles.agreementOrientationTag,
                        {
                          backgroundColor: ORIENTATION_PALES[orientation] || "#F0F1F3",
                          color: ORIENTATION_COLORS[orientation] || C.muted,
                        },
                      ]}
                    >
                      {orientationLabels[orientation] || orientation}
                    </Text>
                  ))}
                </View>
              </View>
              <View style={styles.agreementFact}>
                <Text style={styles.agreementFactValue}>{agreement.pps}</Text>
                <Text style={styles.agreementFactLabel}>
                  {agreement.pps === 1 ? "oferta" : "ofertas"}
                </Text>
              </View>
              <View style={styles.agreementFact}>
                <Text style={styles.agreementFactValue}>{agreement.cupos}</Text>
                <Text style={styles.agreementFactLabel}>lugares registrados</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    )}
    <Footer model={model} />
  </Page>
);

const ManagementTimeline = ({ model }: { model: ExecutiveReportModel }) => {
  const series = model.management?.series || [];
  const maxCapacity = Math.max(1, ...series.map((snapshot) => snapshot.capacity.operational));
  return (
    <Page size="A4" style={styles.page}>
      <Header title="Evolución de la gestión" label="Serie 2024 hasta la actualidad" />
      <View style={styles.timeline}>
        <Text style={styles.timelineYear}>2024</Text>
        <View style={styles.timelineTrack}>
          <View style={styles.timelineMarker} />
          <Text style={styles.timelineMarkerLabel}>01.09 · inicio de gestión</Text>
        </View>
        <Text style={styles.timelineYear}>{model.year}</Text>
      </View>
      <Text style={styles.caveat}>{model.management?.caveat}</Text>
      <View style={styles.seriesHeader}>
        <Text style={styles.seriesYear}>Año / corte</Text>
        <Text style={styles.seriesSmallCol}>Ofertas</Text>
        <Text style={styles.seriesCapacityCol}>Capacidad</Text>
        <Text style={styles.seriesSmallCol}>Inicios</Text>
        <Text style={styles.seriesSmallCol}>Finaliz.</Text>
      </View>
      {series.map((snapshot) => (
        <View style={styles.seriesRow} key={`${snapshot.year}-${snapshot.cutoffISO}`}>
          <View style={styles.seriesYear}>
            <Text style={styles.seriesYearMain}>{snapshot.year}</Text>
            <Text style={styles.seriesYearSub}>
              {snapshot.cutoffISO.endsWith("12-31") ? "cierre anual" : `al ${snapshot.cutoffISO}`}
            </Text>
          </View>
          <Text style={[styles.seriesSmallCol, styles.seriesNumber]}>
            {snapshot.capacity.launches}
          </Text>
          <View style={styles.seriesCapacityCol}>
            <View style={styles.seriesBar}>
              <View
                style={[
                  styles.seriesBarFill,
                  { width: `${(snapshot.capacity.operational / maxCapacity) * 100}%` },
                ]}
              />
              <Text style={styles.seriesBarValue}>{snapshot.capacity.operational}</Text>
            </View>
          </View>
          <Text style={[styles.seriesSmallCol, styles.seriesNumber]}>
            {snapshot.flows.ppsStarted}
          </Text>
          <Text style={[styles.seriesSmallCol, styles.seriesNumber]}>
            {snapshot.flows.finalized}
          </Text>
        </View>
      ))}
      <View style={styles.note}>
        <Text style={styles.noteTitle}>Línea de base temporal</Text>
        <Text style={styles.noteText}>
          {model.management?.baseline
            ? `Al 31 de agosto de 2024: ${model.management.baseline.capacity.launches} ofertas, ${model.management.baseline.capacity.operational} vacantes finitas, ${model.management.baseline.flows.ppsStarted} inicios y ${model.management.baseline.flows.finalized} finalizaciones. `
            : "El corte al 31 de agosto de 2024 queda registrado como línea de base. "}
          El cierre completo 2024 fue de 42 ofertas: 36 finitas por 270 vacantes y 6 sin cupo
          finito.
        </Text>
      </View>
      <Footer model={model} />
    </Page>
  );
};

const TechnicalAnnex = ({ model }: { model: ExecutiveReportModel }) => (
  <Page size="A4" style={styles.page}>
    <Header title="Trazabilidad y calidad" label="Anexo técnico · circulación interna" />
    <View style={[styles.qualityGrid, { marginTop: 28 }]}>
      <View style={styles.qualityIntro}>
        <Text style={styles.h3}>Cobertura de medición</Text>
        <Text style={styles.qualityIntroText}>
          Controles internos que respaldan la lectura y quedan disponibles ante una consulta.
        </Text>
      </View>
      <View style={styles.qualityList}>
        {model.qualityMetrics.map((metric) => (
          <View style={styles.qualityRow} key={metric.id}>
            <View style={styles.qualityLine}>
              <Text style={styles.qualityLabel}>{metric.label}</Text>
              <Text style={styles.qualityValue}>{formatMetric(metric)}</Text>
            </View>
            <Text style={styles.qualityDetail}>{metric.detail}</Text>
          </View>
        ))}
      </View>
    </View>
    <View style={[styles.methodGrid, { marginTop: 24 }]}>
      <View style={[styles.methodColumn, styles.methodColumnLeft]}>
        <Text style={styles.h3}>Reglas de construcción</Text>
        {model.methodology.map((item, index) => (
          <View style={styles.methodItem} key={item}>
            <Text style={styles.methodBullet}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={styles.methodText}>{item}</Text>
          </View>
        ))}
      </View>
      <View style={styles.methodColumn}>
        <Text style={styles.h3}>Límites de lectura</Text>
        {model.limitations.map((item) => (
          <View style={styles.methodItem} key={item}>
            <Text style={styles.methodBullet}>—</Text>
            <Text style={styles.methodText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
    <View style={styles.dataContract}>
      <View style={styles.contractRow}>
        <Text style={styles.contractLabel}>Versión de métrica</Text>
        <Text style={styles.contractValue}>{model.current.metricVersion}</Text>
      </View>
      <View style={styles.contractRow}>
        <Text style={styles.contractLabel}>Corte reproducible</Text>
        <Text style={styles.contractValue}>{model.asOfISO}</Text>
      </View>
      <View style={styles.contractRow}>
        <Text style={styles.contractLabel}>Protección de datos</Text>
        <Text style={styles.contractValue}>Sin información personal</Text>
      </View>
    </View>
    <View style={styles.finalSignature}>
      <View style={styles.signature}>
        <Text style={styles.signatureName}>{model.author.name}</Text>
        <Text>{model.author.role}</Text>
        <Text>{model.author.unit}</Text>
      </View>
      <Text style={styles.signature}>{model.author.email}</Text>
    </View>
    <Footer model={model} />
  </Page>
);

const orientationLabels: Record<string, string> = {
  clinica: "Clínica",
  educacional: "Educacional",
  laboral: "Laboral",
  juridica: "Jurídica",
  comunitaria: "Comunitaria",
  investigacion: "Investigación",
  sindefinir: "Sin clasificar",
};

const LaunchAnnex = ({ model }: { model: ExecutiveReportModel }) => {
  if (!model.launches.length) return null;
  const monthFormatter = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const orderedLaunches = [...model.launches].sort((a, b) => {
    const dateA = a.fechaInicio?.getTime() ?? Number.POSITIVE_INFINITY;
    const dateB = b.fechaInicio?.getTime() ?? Number.POSITIVE_INFINITY;
    return dateA - dateB || a.nombre.localeCompare(b.nombre, "es");
  });
  const grouped = orderedLaunches.reduce<
    Array<{ key: string; label: string; launches: typeof model.launches }>
  >((months, launch) => {
    const key = launch.fechaInicio
      ? `${launch.fechaInicio.getUTCFullYear()}-${String(launch.fechaInicio.getUTCMonth() + 1).padStart(2, "0")}`
      : "sin-fecha";
    const current = months.at(-1);
    if (!current || current.key !== key) {
      const rawLabel = launch.fechaInicio ? monthFormatter.format(launch.fechaInicio) : "Sin fecha";
      months.push({
        key,
        label: `${rawLabel.charAt(0).toUpperCase()}${rawLabel.slice(1)}`,
        launches: [launch],
      });
    } else {
      current.launches.push(launch);
    }
    return months;
  }, []);
  const monthPages = grouped.reduce<Array<typeof grouped>>((pages, month) => {
    const currentPage = pages.at(-1);
    const usedUnits = currentPage?.reduce(
      (total, currentMonth) => total + currentMonth.launches.length + 2,
      0
    );
    const monthUnits = month.launches.length + 2;
    if (!currentPage || (currentPage.length > 0 && (usedUnits || 0) + monthUnits > 18)) {
      pages.push([month]);
    } else {
      currentPage.push(month);
    }
    return pages;
  }, []);
  return (
    <>
      {monthPages.map((months, pageIndex) => (
        <Page size="A4" style={[styles.page, styles.annexPage]} key={`annex-page-${pageIndex + 1}`}>
          <Header title="Anexo de ofertas" label={`Detalle documentado · ${model.year}`} />
          {pageIndex === 0 && (
            <Text style={styles.annexIntro}>
              Ofertas ordenadas por mes. “Participantes registrados” identifica las propuestas sin
              cupo prefijado, donde el total corresponde a quienes efectivamente se incorporaron.
            </Text>
          )}
          {months.map((month) => {
            const capacity = month.launches.reduce(
              (total, launch) => total + launch.capacidadOperativa,
              0
            );
            return (
              <View style={styles.monthBlock} key={month.key}>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthName}>{month.label}</Text>
                  <Text style={styles.monthSummary}>
                    {month.launches.length} {month.launches.length === 1 ? "oferta" : "ofertas"} ·{" "}
                    {capacity} lugares registrados
                  </Text>
                </View>
                <View style={styles.offerGrid}>
                  {month.launches.map((launch) => (
                    <View style={styles.offerRow} key={launch.id}>
                      <View style={styles.offerIdentity}>
                        <Text style={styles.offerName}>{launch.nombre}</Text>
                        <Text
                          style={[
                            styles.offerOrientation,
                            { color: ORIENTATION_TEXT_COLORS[launch.orient] || "#4F596B" },
                          ]}
                        >
                          {orientationLabels[launch.orient] || launch.orient}
                        </Text>
                      </View>
                      <Text style={styles.offerDate}>
                        {launch.fechaInicio
                          ? new Intl.DateTimeFormat("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                              timeZone: "UTC",
                            }).format(launch.fechaInicio)
                          : "—"}
                      </Text>
                      <View style={styles.offerCapacity}>
                        <Text style={styles.offerCapacityValue}>
                          {launch.modalidadCupo === "desconocido"
                            ? "—"
                            : integer.format(launch.capacidadOperativa)}
                        </Text>
                        {launch.modalidadCupo === "realizado" && (
                          <Text style={styles.offerCapacityNote}>
                            participantes registrados · sin cupo prefijado
                          </Text>
                        )}
                        {launch.modalidadCupo === "desconocido" && (
                          <Text style={styles.offerCapacityNote}>
                            sin cupo prefijado documentado
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          <Footer model={model} />
        </Page>
      ))}
    </>
  );
};

export const ExecutiveReportPdf = ({
  model,
  includeTechnicalAnnex = false,
}: {
  model: ExecutiveReportModel;
  includeTechnicalAnnex?: boolean;
}) => (
  <Document
    title={model.title}
    author={`${model.author.name} · ${model.author.role}`}
    subject={model.subtitle}
    keywords="UFLO, PPS, Psicología, Sede Comahue, informe ejecutivo"
    language="es-AR"
  >
    {model.kind === "annual" ? <AnnualCover model={model} /> : <ManagementCover model={model} />}
    <ExecutiveReading model={model} />
    {model.kind === "annual" ? (
      <>
        <AnnualEvidence model={model} />
        <OutcomesInstitutions model={model} />
      </>
    ) : (
      <ManagementTimeline model={model} />
    )}
    {includeTechnicalAnnex && <TechnicalAnnex model={model} />}
    {model.kind === "annual" && <LaunchAnnex model={model} />}
  </Document>
);
