import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  useEsfuerzoPrimeraSeleccion,
  useNewAgreements,
  useReportLaunches,
  useTrayectoriaFinalizados,
} from "../../hooks/useMetricsExtras";
import { buildExecutiveReportModel } from "./executiveReport.model";
import { fetchAnalyticsSnapshot, reportCutoff, testingSnapshot } from "./executiveReport.service";
import type {
  AnalyticsSnapshot,
  ExecutiveReportKind,
  ExecutiveReportModel,
} from "./executiveReport.types";

interface UseProfessionalExecutiveReportOptions {
  kind: ExecutiveReportKind;
  year: number;
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
  isTestingMode = false,
}: UseProfessionalExecutiveReportOptions): {
  model: ExecutiveReportModel | null;
  isLoading: boolean;
  error: Error | null;
} => {
  const currentYear = new Date().getFullYear();
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
    ...snapshotQuery(currentYear - 1, reportCutoff(currentYear - 1, false), isTestingMode),
    enabled: kind === "management",
  });

  const managementYears = useMemo(
    () => Array.from({ length: Math.max(1, currentYear - 2024 + 1) }, (_, index) => 2024 + index),
    [currentYear]
  );
  const managementQueries = useQueries({
    queries: managementYears.map((seriesYear) => {
      const cutoff = reportCutoff(seriesYear, seriesYear < currentYear);
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
    });
  }, [
    agreementsQuery.data,
    baselineQuery.data,
    effectiveSelected,
    effectivePrevious,
    kind,
    launchesQuery.data,
    managementSeries,
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
      managementQueries.some((query) => query.isLoading));
  const queryError =
    selectedQuery.error ||
    previousQuery.error ||
    (kind === "management"
      ? baselineQuery.error ||
        managementComparisonQuery.error ||
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
