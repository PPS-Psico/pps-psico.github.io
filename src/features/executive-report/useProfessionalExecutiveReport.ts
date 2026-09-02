import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  useEsfuerzoPrimeraSeleccion,
  useNewAgreements,
  useReportLaunches,
  useTrayectoriaFinalizados,
} from "../../hooks/useMetricsExtras";
import { buildExecutiveReportModel } from "./executiveReport.model";
import {
  equivalentCutoff,
  fetchAnalyticsSnapshot,
  fetchManagementReportData,
  reportCutoff,
  testingManagementReportData,
  testingSnapshot,
} from "./executiveReport.service";
import type {
  AnalyticsSnapshot,
  ExecutiveReportKind,
  ExecutiveReportModel,
} from "./executiveReport.types";

interface UseProfessionalExecutiveReportOptions {
  kind: ExecutiveReportKind;
  year: number;
  managementCutoffISO?: string;
  isTestingMode?: boolean;
}

const snapshotQuery = (year: number, cutoffISO: string, isTestingMode: boolean) => ({
  queryKey: ["professional-executive-report", "snapshot", year, cutoffISO, isTestingMode],
  queryFn: () =>
    isTestingMode
      ? Promise.resolve(testingSnapshot(year, cutoffISO))
      : fetchAnalyticsSnapshot(year, cutoffISO),
  staleTime: 1000 * 60 * 5,
});

export const useProfessionalExecutiveReport = ({
  kind,
  year,
  managementCutoffISO,
  isTestingMode = false,
}: UseProfessionalExecutiveReportOptions): {
  model: ExecutiveReportModel | null;
  isLoading: boolean;
  error: Error | null;
} => {
  const currentYear = new Date().getFullYear();
  const todayISO = new Date().toISOString().slice(0, 10);
  const effectiveManagementCutoff = managementCutoffISO || todayISO;
  const managementYear = Number(effectiveManagementCutoff.slice(0, 4)) || currentYear;
  const selectedCutoff = reportCutoff(year, year < currentYear);
  const previousCutoff = reportCutoff(year - 1, year < currentYear);

  const selectedQuery = useQuery({
    ...snapshotQuery(year, selectedCutoff, isTestingMode),
    enabled: kind === "annual",
  });
  const previousQuery = useQuery({
    ...snapshotQuery(year - 1, previousCutoff, isTestingMode),
    enabled: kind === "annual",
  });
  const managementComparisonQuery = useQuery({
    ...snapshotQuery(
      managementYear - 1,
      equivalentCutoff(managementYear - 1, effectiveManagementCutoff),
      isTestingMode
    ),
    enabled: kind === "management",
  });

  const managementYears = useMemo(
    () =>
      Array.from({ length: Math.max(1, managementYear - 2024 + 1) }, (_, index) => 2024 + index),
    [managementYear]
  );
  const managementQueries = useQueries({
    queries: managementYears.map((seriesYear) => {
      const cutoff =
        seriesYear < managementYear ? `${seriesYear}-12-31` : effectiveManagementCutoff;
      return {
        ...snapshotQuery(seriesYear, cutoff, isTestingMode),
        enabled: kind === "management",
      };
    }),
  });
  const baselineQuery = useQuery({
    ...snapshotQuery(2024, "2024-08-31", isTestingMode),
    enabled: kind === "management",
  });
  const managementDataQuery = useQuery({
    queryKey: [
      "professional-executive-report",
      "management-data",
      effectiveManagementCutoff,
      isTestingMode,
    ],
    queryFn: () =>
      isTestingMode
        ? Promise.resolve(testingManagementReportData(effectiveManagementCutoff))
        : fetchManagementReportData(effectiveManagementCutoff),
    enabled: kind === "management",
    staleTime: 1000 * 60 * 5,
  });

  const detailTestingMode = isTestingMode || kind === "management";
  const launchesQuery = useReportLaunches({ year, isTestingMode: detailTestingMode });
  const agreementsQuery = useNewAgreements({ year, isTestingMode: detailTestingMode });
  const trajectoryQuery = useTrayectoriaFinalizados({ year, isTestingMode: detailTestingMode });
  const selectionEffortQuery = useEsfuerzoPrimeraSeleccion({
    year,
    cutoffISO: selectedCutoff,
    isTestingMode: detailTestingMode,
  });

  const managementSeries = managementQueries
    .map((query) => query.data)
    .filter((snapshot): snapshot is AnalyticsSnapshot => Boolean(snapshot));
  const managementSelected = managementSeries.at(-1) || selectedQuery.data;
  const effectiveSelected = kind === "management" ? managementSelected : selectedQuery.data;
  const effectivePrevious =
    kind === "management" ? managementComparisonQuery.data || null : previousQuery.data || null;

  const model = useMemo(() => {
    if (!effectiveSelected) return null;
    return buildExecutiveReportModel({
      kind,
      selected: effectiveSelected,
      previous: effectivePrevious,
      managementBaseline: baselineQuery.data || null,
      managementSeries,
      launches: kind === "annual" ? launchesQuery.data || [] : [],
      agreements: kind === "annual" ? agreementsQuery.data || [] : [],
      trajectory: kind === "annual" ? trajectoryQuery.data || null : null,
      selectionEffort: kind === "annual" ? selectionEffortQuery.data || null : null,
      managementData: kind === "management" ? managementDataQuery.data || null : null,
    });
  }, [
    agreementsQuery.data,
    baselineQuery.data,
    effectiveSelected,
    effectivePrevious,
    kind,
    launchesQuery.data,
    managementSeries,
    managementDataQuery.data,
    selectionEffortQuery.data,
    trajectoryQuery.data,
  ]);

  const detailLoading =
    kind === "annual" &&
    (launchesQuery.isLoading ||
      agreementsQuery.isLoading ||
      trajectoryQuery.isLoading ||
      selectionEffortQuery.isLoading);
  const managementLoading =
    kind === "management" &&
    (baselineQuery.isLoading ||
      managementComparisonQuery.isLoading ||
      managementDataQuery.isLoading ||
      managementQueries.some((query) => query.isLoading));
  const queryError =
    selectedQuery.error ||
    previousQuery.error ||
    (kind === "management"
      ? baselineQuery.error ||
        managementComparisonQuery.error ||
        managementDataQuery.error ||
        managementQueries.find((query) => query.error)?.error
      : launchesQuery.error ||
        agreementsQuery.error ||
        trajectoryQuery.error ||
        selectionEffortQuery.error);

  return {
    model,
    isLoading:
      selectedQuery.isLoading || previousQuery.isLoading || detailLoading || managementLoading,
    error:
      queryError instanceof Error ? queryError : queryError ? new Error(String(queryError)) : null,
  };
};
