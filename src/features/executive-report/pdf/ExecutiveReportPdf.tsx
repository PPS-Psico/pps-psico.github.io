import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import manropeRegular from "@fontsource/manrope/files/manrope-latin-400-normal.woff?url";
import manropeMedium from "@fontsource/manrope/files/manrope-latin-500-normal.woff?url";
import manropeSemiBold from "@fontsource/manrope/files/manrope-latin-600-normal.woff?url";
import manropeBold from "@fontsource/manrope/files/manrope-latin-700-normal.woff?url";
import sourceSerifSemiBold from "@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff?url";
import sourceSerifBold from "@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff?url";
import type {
  ExecutiveReportModel,
  ManagementAgreement,
  ManagementNetworkInstitution,
  ReportMetric,
} from "../executiveReport.types";
import {
  buildManagementAccessPresentation,
  managementCapacityValue,
  visibleManagementAgreements,
} from "../managementReport.presentation";

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
  constrainedHeaderTitle: { width: "75%" },
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
  summaryIntro: { color: C.muted, fontSize: 7, lineHeight: 1.5, marginBottom: 12, marginTop: 20 },
  managementMatrix: { borderTopColor: C.navy, borderTopWidth: 1.5 },
  matrixRow: { borderBottomColor: C.rule, borderBottomWidth: 1, flexDirection: "row" },
  matrixLabel: {
    color: C.ink,
    fontSize: 6.4,
    fontWeight: 600,
    justifyContent: "center",
    minHeight: 26,
    paddingHorizontal: 6,
    paddingVertical: 6,
    width: "40%",
  },
  matrixCell: {
    borderLeftColor: C.rule,
    borderLeftWidth: 1,
    color: C.navy,
    fontSize: 7.2,
    fontWeight: 700,
    justifyContent: "center",
    minHeight: 26,
    paddingHorizontal: 5,
    paddingVertical: 6,
    textAlign: "center",
  },
  matrixHeaderLabel: { backgroundColor: C.pale, color: C.muted, fontSize: 5.8 },
  matrixYear: { color: C.navy, fontSize: 9, fontWeight: 700 },
  matrixYearNote: { color: C.muted, fontSize: 5.2, marginTop: 2 },
  enrollmentBlock: {
    borderTopColor: C.rule,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 16,
  },
  enrollmentCopy: { paddingRight: 20, width: "42%" },
  enrollmentCopyText: { color: C.muted, fontSize: 6.4, lineHeight: 1.5, marginTop: 5 },
  enrollmentBars: { width: "58%" },
  enrollmentBarRow: { alignItems: "center", flexDirection: "row", marginBottom: 6 },
  enrollmentCycle: { color: C.muted, fontSize: 5.8, width: 38 },
  enrollmentTrack: { backgroundColor: "#EEF1F4", height: 6, width: 150 },
  enrollmentFill: { backgroundColor: C.teal, height: 6 },
  enrollmentValue: { color: C.navy, fontSize: 7, fontWeight: 700, textAlign: "right", width: 28 },
  currentStock: { backgroundColor: C.pale, marginTop: 15, padding: 10 },
  currentStockTitle: { color: C.navy, fontSize: 6.5, fontWeight: 700 },
  currentStockValue: { color: C.ink, fontSize: 7.4, fontWeight: 600, marginTop: 3 },
  currentStockNote: { color: C.muted, fontSize: 5.5, lineHeight: 1.4, marginTop: 3 },
  accessEvidence: {
    borderLeftColor: C.teal,
    borderLeftWidth: 2,
    flexDirection: "row",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  accessMetric: { paddingRight: 10, width: "24%" },
  accessRate: { color: C.navy, fontSize: 14, fontWeight: 700 },
  accessLabel: { color: C.muted, fontSize: 4.8, fontWeight: 700, marginTop: 1 },
  accessCopy: { width: "76%" },
  accessText: { color: C.ink, fontSize: 6.4, fontWeight: 600, lineHeight: 1.45 },
  accessBreakdownTitle: {
    color: C.navy,
    fontSize: 4.7,
    fontWeight: 700,
    marginTop: 4,
  },
  accessBreakdown: { color: C.ink, fontSize: 5.5, lineHeight: 1.4, marginTop: 1 },
  accessCaveat: { color: C.muted, fontSize: 4.8, lineHeight: 1.35, marginTop: 4 },
  detailIntro: { color: C.muted, fontSize: 6.6, lineHeight: 1.5, marginBottom: 12, marginTop: 16 },
  contributionHeader: { borderBottomColor: C.navy, borderBottomWidth: 1, flexDirection: "row" },
  contributionHeaderCell: {
    color: C.muted,
    fontSize: 5,
    fontWeight: 700,
    paddingHorizontal: 4,
    paddingVertical: 6,
    textAlign: "center",
    textTransform: "uppercase",
  },
  contributionRow: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 52,
  },
  contributionIdentity: { justifyContent: "center", paddingHorizontal: 5, paddingVertical: 7 },
  contributionName: { color: C.ink, fontFamily: "Source Serif 4", fontSize: 7.2, lineHeight: 1.25 },
  contributionDate: { color: C.muted, fontSize: 5.2, marginTop: 2 },
  contributionAgreementCount: { color: C.muted, fontSize: 4.8, marginTop: 2 },
  contributionOrientations: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  contributionOrientation: { fontSize: 4.8, fontWeight: 700, marginRight: 3 },
  contributionCell: {
    borderLeftColor: C.rule,
    borderLeftWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 3,
    paddingVertical: 5,
    textAlign: "center",
  },
  contributionValue: { color: C.navy, fontSize: 8.5, fontWeight: 700 },
  contributionLabel: { color: C.muted, fontSize: 4.5, marginTop: 1 },
  contributionRealized: { color: C.teal, fontSize: 4.5, fontWeight: 700, marginTop: 2 },
  contributionLaunches: { color: C.muted, fontSize: 4.5, marginTop: 2 },
  contributionTotal: { backgroundColor: C.pale },
  networkContext: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 16,
  },
  networkContextCopy: { color: C.muted, fontSize: 6.2, lineHeight: 1.5, width: "62%" },
  networkCoverage: { color: C.navy, fontSize: 6.2, fontWeight: 700, lineHeight: 1.5, width: "32%" },
  networkHeader: { borderBottomColor: C.navy, borderBottomWidth: 1, flexDirection: "row" },
  networkHeaderCell: {
    color: C.muted,
    fontSize: 4.8,
    fontWeight: 700,
    padding: 5,
    textTransform: "uppercase",
  },
  networkRow: {
    alignItems: "center",
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 40,
  },
  networkCell: { paddingHorizontal: 5, paddingVertical: 5 },
  networkName: { color: C.ink, fontFamily: "Source Serif 4", fontSize: 6.7, lineHeight: 1.25 },
  networkLast: { color: C.muted, fontSize: 4.8, marginTop: 2 },
  networkOrientations: { flexDirection: "row", flexWrap: "wrap" },
  networkOrientation: {
    fontSize: 4.7,
    fontWeight: 700,
    marginBottom: 2,
    marginRight: 3,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  networkNumber: { color: C.navy, fontSize: 7, fontWeight: 700, textAlign: "center" },
  networkValidity: { fontSize: 5, fontWeight: 700, lineHeight: 1.3 },
  closingStatement: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    marginTop: 24,
    paddingBottom: 22,
  },
  closingHeadline: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 12,
    lineHeight: 1.3,
    marginTop: 14,
    maxWidth: 410,
  },
  generatedLabel: { color: C.teal, fontSize: 5.8, fontWeight: 700 },
  generatedHeadline: {
    color: C.navy,
    fontFamily: "Source Serif 4",
    fontSize: 16,
    lineHeight: 1.2,
    marginTop: 5,
    maxWidth: 390,
  },
  generatedText: { color: C.muted, fontSize: 6.2, lineHeight: 1.45, marginTop: 6 },
  closingCutoff: { color: C.muted, fontSize: 6.3, marginTop: 8 },
  closingBand: {
    borderBottomColor: C.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    marginTop: 24,
  },
  closingMetric: { flex: 1, minHeight: 68, paddingHorizontal: 10, paddingVertical: 13 },
  closingMetricBorder: { borderLeftColor: C.rule, borderLeftWidth: 1 },
  closingMetricValue: { color: C.navy, fontSize: 19, fontWeight: 700 },
  closingMetricLabel: { color: C.muted, fontSize: 5.5, lineHeight: 1.4, marginTop: 3 },
  closingColumns: { flexDirection: "row", marginTop: 28 },
  closingColumn: { flex: 1 },
  closingColumnLeft: { marginRight: 32 },
  closingText: { color: C.muted, fontSize: 7, lineHeight: 1.55 },
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
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const formatISODate = (value: string): string =>
  dateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

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
    <Text>
      {model.kind === "management"
        ? `Fuente: Mi Panel Académico · corte ${formatISODate(model.asOfISO)}`
        : `Fuente: Mi Panel Académico · ${model.current.metricVersion}`}
    </Text>
    <Text
      render={({ pageNumber, totalPages }) =>
        `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
      }
    />
  </View>
);

const Header = ({
  title,
  label,
  constrained = false,
  showWordmark = true,
}: {
  title: string;
  label: string;
  constrained?: boolean;
  showWordmark?: boolean;
}) => (
  <View style={styles.pageHeader}>
    <View style={constrained ? styles.constrainedHeaderTitle : {}}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {showWordmark && <Wordmark />}
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
    <Header
      title="Lectura ejecutiva"
      label="Síntesis del período"
      showWordmark={model.kind !== "management"}
    />
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
      <Header
        title="Evolución de la gestión"
        label="Serie 2024 hasta la actualidad"
        showWordmark={false}
      />
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

const ManagementAnnualSummary = ({ model }: { model: ExecutiveReportModel }) => {
  const data = model.management?.data;
  const series = model.management?.series || [];
  if (!data) return null;
  const cohortByYear = new Map(data.population.accountCohorts.map((row) => [row.year, row]));
  const enrollmentByYear = new Map(
    data.population.administrativeEnrollment.map((row) => [row.year, row])
  );
  const agreementsByYear = new Map<number, number>();
  data.agreements.forEach((agreement) => {
    const year = Number(agreement.signedAt.slice(0, 4));
    agreementsByYear.set(year, (agreementsByYear.get(year) || 0) + agreement.agreementCount);
  });
  const rows = [
    ["PPS lanzadas", (year: number) => series.find((row) => row.year === year)?.capacity.launches],
    [
      "Cupos ofrecidos",
      (year: number) => {
        const snapshot = series.find((row) => row.year === year);
        return snapshot ? managementCapacityValue(snapshot) : undefined;
      },
    ],
    [
      "Estudiantes que iniciaron PPS",
      (year: number) => series.find((row) => row.year === year)?.flows.ppsStarted,
    ],
    [
      "Estudiantes que finalizaron",
      (year: number) => series.find((row) => row.year === year)?.flows.finalized,
    ],
    [
      "Altas de cuenta en Mi Panel",
      (year: number) => {
        const cohort = cohortByYear.get(year);
        return cohort?.available ? (cohort.accountsCreated ?? "ND") : "ND";
      },
    ],
    [
      "De esas altas, actualmente activas",
      (year: number) => {
        const cohort = cohortByYear.get(year);
        return cohort?.available ? (cohort.currentlyActive ?? "ND") : "ND";
      },
    ],
    [
      "Matrícula administrativa PPS",
      (year: number) => enrollmentByYear.get(year)?.students ?? "ND",
    ],
    ["Convenios nuevos", (year: number) => agreementsByYear.get(year) || 0],
  ] as const;
  const maxEnrollment = Math.max(
    1,
    ...data.population.administrativeEnrollment.map((row) => row.students)
  );
  const access = buildManagementAccessPresentation(data.access, series);
  const yearWidth = `${60 / Math.max(series.length, 1)}%`;
  return (
    <Page size="A4" style={styles.page}>
      <Header
        title="Resumen de los años de gestión"
        label="Resultados por año y corte"
        showWordmark={false}
      />
      <Text style={styles.summaryIntro}>
        Los años cerrados se leen al 31 de diciembre. {model.year} se calcula hasta el corte
        elegido:
        {` ${formatISODate(model.asOfISO)}. “Cupos ofrecidos” presenta en una sola cifra la capacidad total registrada por Mi Panel.`}
      </Text>
      <View style={styles.managementMatrix}>
        <View style={styles.matrixRow}>
          <Text style={[styles.matrixLabel, styles.matrixHeaderLabel]}>Indicador</Text>
          {series.map((snapshot) => (
            <View style={[styles.matrixCell, { width: yearWidth }]} key={`head-${snapshot.year}`}>
              <Text style={styles.matrixYear}>{snapshot.year}</Text>
              <Text style={styles.matrixYearNote}>
                {snapshot.cutoffISO.endsWith("12-31") ? "cierre" : "al corte"}
              </Text>
            </View>
          ))}
        </View>
        {rows.map(([label, value]) => (
          <View style={styles.matrixRow} key={label}>
            <Text style={styles.matrixLabel}>{label}</Text>
            {series.map((snapshot) => (
              <Text
                style={[styles.matrixCell, { width: yearWidth }]}
                key={`${label}-${snapshot.year}`}
              >
                {String(value(snapshot.year) ?? 0)}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <View style={styles.enrollmentBlock}>
        <View style={styles.enrollmentCopy}>
          <Text style={styles.h3}>Crecimiento de matrícula administrativa</Text>
          <Text style={styles.enrollmentCopyText}>
            Serie externa informada por la Facultad. No equivale a cuentas creadas, postulantes ni
            estudiantes que iniciaron PPS.
          </Text>
        </View>
        <View style={styles.enrollmentBars}>
          {data.population.administrativeEnrollment.map((row) => (
            <View style={styles.enrollmentBarRow} key={row.cycle}>
              <Text style={styles.enrollmentCycle}>{row.cycle}</Text>
              <View style={styles.enrollmentTrack}>
                <View
                  style={[
                    styles.enrollmentFill,
                    { width: `${(row.students / maxEnrollment) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.enrollmentValue}>{row.students}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.currentStock}>
        <Text style={styles.currentStockTitle}>Estado actual de la población</Text>
        <Text style={styles.currentStockValue}>
          {data.population.currentStock.activeStudents} estudiantes activos;{" "}
          {data.population.currentStock.activeStudentsWithCurrentPps} con PPS en curso al corte.
        </Text>
        <Text style={styles.currentStockNote}>
          Es una fotografía actual. No se presenta como serie histórica porque el estado activo
          previo no puede reconstruirse con el mismo criterio. El historial verificable de cuentas
          de Mi Panel comienza el{" "}
          {data.population.accountHistoryStartISO
            ? formatISODate(data.population.accountHistoryStartISO)
            : "día no disponible"}
          ; por eso los años anteriores se informan como ND. Las altas de cuenta no equivalen a
          ingresantes académicos.
        </Text>
      </View>
      <View style={styles.accessEvidence}>
        <View style={styles.accessMetric}>
          <Text style={styles.accessRate}>
            {data.access.startRatePct == null
              ? "—"
              : `${decimal.format(data.access.startRatePct)}%`}
          </Text>
          <Text style={styles.accessLabel}>ACCESO OBSERVADO EN {data.access.year}</Text>
        </View>
        <View style={styles.accessCopy}>
          <Text style={styles.accessText}>{access.overview}</Text>
          <Text style={styles.accessBreakdownTitle}>QUIENES TODAVÍA NO INICIARON</Text>
          <Text style={styles.accessBreakdown}>{access.pending}</Text>
          <Text style={styles.accessBreakdownTitle}>TRAYECTORIA REGISTRADA</Text>
          <Text style={styles.accessBreakdown}>{access.withoutAnyPps}</Text>
          <Text style={styles.accessCaveat}>{access.scope}</Text>
        </View>
      </View>
      <Footer model={model} />
    </Page>
  );
};

const AgreementContributionCell = ({
  agreement,
  year,
  width,
}: {
  agreement: ManagementAgreement;
  year: number;
  width: string;
}) => {
  if (year < Number(agreement.signedAt.slice(0, 4))) {
    return <View style={[styles.contributionCell, { width }]} />;
  }
  const contribution = agreement.contributions.find((row) => row.year === year);
  return (
    <View style={[styles.contributionCell, { width }]}>
      <Text style={styles.contributionValue}>{contribution?.practiceStudents || 0}</Text>
      <Text style={styles.contributionLabel}>estudiantes</Text>
    </View>
  );
};

const ManagementAgreementPages = ({ model }: { model: ExecutiveReportModel }) => {
  const data = model.management?.data;
  if (!data?.agreements.length) return null;
  const years = model.management?.series.map((snapshot) => snapshot.year) || [];
  const visibleAgreements = visibleManagementAgreements(data.agreements);
  const pages = chunk(visibleAgreements, 9);
  const yearWidth = `${42 / Math.max(years.length, 1)}%`;
  return (
    <>
      {pages.map((agreements, pageIndex) => (
        <Page size="A4" style={styles.page} key={`agreement-${pageIndex + 1}`}>
          <Header
            title="Nuevas instituciones incorporadas por esta gestión"
            label={`Gestión 2024—${model.year} · parte ${pageIndex + 1} de ${pages.length}`}
            constrained
            showWordmark={false}
          />
          {pageIndex === 0 && (
            <Text style={styles.detailIntro}>
              Incorporar cada institución requirió múltiples reuniones y el diseño y la tramitación
              de los convenios marco y específicos necesarios. La tabla muestra únicamente cuántos
              estudiantes realizaron una PPS en cada año. El total vuelve a contar a cada estudiante
              una sola vez entre años.
            </Text>
          )}
          <View style={styles.contributionHeader}>
            <Text style={[styles.contributionHeaderCell, { textAlign: "left", width: "40%" }]}>
              Institución
            </Text>
            {years.map((year) => (
              <Text style={[styles.contributionHeaderCell, { width: yearWidth }]} key={year}>
                {year}
              </Text>
            ))}
            <Text style={[styles.contributionHeaderCell, { width: "18%" }]}>Total</Text>
          </View>
          {agreements.map((agreement) => (
            <View style={styles.contributionRow} key={agreement.id} wrap={false}>
              <View style={[styles.contributionIdentity, { width: "40%" }]}>
                <Text style={styles.contributionName}>{agreement.institution}</Text>
                <Text style={styles.contributionDate}>
                  Desde{" "}
                  {agreement.datePrecision === "year"
                    ? agreement.signedAt.slice(0, 4)
                    : formatISODate(agreement.signedAt)}
                  {agreement.datePrecision === "year" ? " · fecha anual registrada" : ""}
                </Text>
                {agreement.agreementCount > 1 && (
                  <Text style={styles.contributionAgreementCount}>
                    {agreement.agreementCount} registros de convenio consolidados
                  </Text>
                )}
                <View style={styles.contributionOrientations}>
                  {agreement.orientations.length ? (
                    agreement.orientations.map((orientation) => (
                      <Text
                        style={[
                          styles.contributionOrientation,
                          { color: ORIENTATION_TEXT_COLORS[orientation] || C.muted },
                        ]}
                        key={orientation}
                      >
                        {orientationLabels[orientation] || orientation}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.contributionDate}>Sin orientación atribuida</Text>
                  )}
                </View>
              </View>
              {years.map((year) => (
                <AgreementContributionCell
                  agreement={agreement}
                  year={year}
                  width={yearWidth}
                  key={year}
                />
              ))}
              <View style={[styles.contributionCell, styles.contributionTotal, { width: "18%" }]}>
                <Text style={styles.contributionValue}>{agreement.totalPracticeStudents}</Text>
                <Text style={styles.contributionLabel}>estudiantes distintos</Text>
              </View>
            </View>
          ))}
          <Footer model={model} />
        </Page>
      ))}
    </>
  );
};

const ManagementNetworkPages = ({ model }: { model: ExecutiveReportModel }) => {
  const data = model.management?.data;
  if (!data?.recentNetwork.length) return null;
  const years = Array.from(
    new Set(data.recentNetwork.flatMap((row) => Object.keys(row.launchesByYear).map(Number)))
  ).sort((a, b) => a - b);
  const pages = chunk(data.recentNetwork, 10);
  return (
    <>
      {pages.map((institutions, pageIndex) => (
        <Page size="A4" style={styles.page} key={`network-${pageIndex + 1}`}>
          <Header
            title="Red institucional con actividad reciente"
            label={`${years.join("–")} · parte ${pageIndex + 1} de ${pages.length}`}
            showWordmark={false}
          />
          {pageIndex === 0 && (
            <View style={styles.networkContext}>
              <Text style={styles.networkContextCopy}>
                Instituciones y espacios con al menos una PPS lanzada durante los dos años
                calendario más recientes hasta el corte.
              </Text>
            </View>
          )}
          <View style={styles.networkHeader}>
            <Text style={[styles.networkHeaderCell, { width: "42%" }]}>Institución / espacio</Text>
            <Text style={[styles.networkHeaderCell, { width: `${50 - years.length * 8}%` }]}>
              Orientaciones
            </Text>
            {years.map((year) => (
              <Text
                style={[styles.networkHeaderCell, { textAlign: "center", width: "8%" }]}
                key={year}
              >
                {year}
              </Text>
            ))}
            <Text style={[styles.networkHeaderCell, { textAlign: "center", width: "8%" }]}>
              Total
            </Text>
          </View>
          {institutions.map((institution: ManagementNetworkInstitution) => (
            <View style={styles.networkRow} key={institution.key} wrap={false}>
              <View style={[styles.networkCell, { width: "42%" }]}>
                <Text style={styles.networkName}>{institution.institution}</Text>
                <Text style={styles.networkLast}>
                  Última actividad: {formatISODate(institution.lastActivity)}
                </Text>
              </View>
              <View
                style={[
                  styles.networkCell,
                  styles.networkOrientations,
                  { width: `${50 - years.length * 8}%` },
                ]}
              >
                {institution.orientations.length ? (
                  institution.orientations.map((orientation) => (
                    <Text
                      style={[
                        styles.networkOrientation,
                        {
                          backgroundColor: ORIENTATION_PALES[orientation] || C.pale,
                          color: ORIENTATION_TEXT_COLORS[orientation] || C.muted,
                        },
                      ]}
                      key={orientation}
                    >
                      {orientationLabels[orientation] || orientation}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.networkLast}>Sin orientación atribuida</Text>
                )}
              </View>
              {years.map((year) => (
                <Text
                  style={[styles.networkCell, styles.networkNumber, { width: "8%" }]}
                  key={year}
                >
                  {institution.launchesByYear[String(year)] || 0}
                </Text>
              ))}
              <Text style={[styles.networkCell, styles.networkNumber, { width: "8%" }]}>
                {institution.totalLaunches}
              </Text>
            </View>
          ))}
          <Footer model={model} />
        </Page>
      ))}
    </>
  );
};

const ManagementClosing = ({ model }: { model: ExecutiveReportModel }) => {
  const data = model.management?.data;
  if (!data) return null;
  const totalFixed = data.agreements.reduce((total, row) => total + row.totalFixedOffered, 0);
  const totalRealized = data.agreements.reduce((total, row) => total + row.totalRealized, 0);
  const totalCapacity = totalFixed + totalRealized;
  return (
    <Page size="A4" style={styles.page}>
      <Header
        title="Estado al corte y documentación adjunta"
        label="Cierre ejecutivo"
        constrained
        showWordmark={false}
      />
      <View style={styles.closingStatement}>
        <Text style={styles.generatedLabel}>GENERADO AUTOMÁTICAMENTE POR MI PANEL</Text>
        <Text style={styles.generatedHeadline}>
          Este documento demuestra la capacidad de Mi Panel para producir información de gestión
          actualizada.
        </Text>
        <Text style={styles.generatedText}>
          La fecha de corte, los indicadores, la serie anual y el detalle institucional se
          recalculan cada vez que se genera el informe.
        </Text>
        <Text style={styles.closingHeadline}>{model.headline}</Text>
        <Text style={styles.closingCutoff}>Corte reproducible: {formatISODate(model.asOfISO)}</Text>
      </View>
      <View style={styles.closingBand}>
        {[
          [
            data.institutionCount,
            `instituciones o espacios incorporados · ${data.agreementCount} registros de convenio`,
          ],
          [totalCapacity, "cupos ofrecidos acumulados desde esas instituciones"],
        ].map(([value, label], index) => (
          <View style={[styles.closingMetric, index ? styles.closingMetricBorder : {}]} key={label}>
            <Text style={styles.closingMetricValue}>{value}</Text>
            <Text style={styles.closingMetricLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.closingColumns}>
        <View style={[styles.closingColumn, styles.closingColumnLeft]}>
          <Text style={styles.h3}>Actualización al corte</Text>
          <Text style={styles.closingText}>
            Mi Panel consolida la actividad de las PPS, las trayectorias estudiantiles y la red
            institucional con la información disponible al momento de emisión.
          </Text>
        </View>
        <View style={styles.closingColumn}>
          <Text style={styles.h3}>Documento que acompaña este informe</Text>
          <Text style={styles.closingText}>
            Se adjunta por separado el Informe anual detallado de PPS {model.year}, generado en
            forma separada para el año del corte. Ese documento conserva el desarrollo operativo del
            año en curso y no forma parte de este rediseño.
          </Text>
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
      <>
        <ManagementAnnualSummary model={model} />
        <ManagementTimeline model={model} />
        <ManagementAgreementPages model={model} />
        <ManagementNetworkPages model={model} />
        <ManagementClosing model={model} />
      </>
    )}
    {includeTechnicalAnnex && <TechnicalAnnex model={model} />}
    {model.kind === "annual" && <LaunchAnnex model={model} />}
  </Document>
);
