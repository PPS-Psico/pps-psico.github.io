import { useQuery } from "@tanstack/react-query";
import type { ExecutiveReportModel } from "./executiveReport.types";
import type { DirectorReportModel } from "./directorReport.types";
import { fetchDirectorReportSnapshot, testingDirectorSnapshot } from "./directorReport.service";

interface UseDirectorReportOptions {
  annualModel: ExecutiveReportModel | null;
  year: number;
  enabled: boolean;
  isTestingMode?: boolean;
}

export const useDirectorReport = ({
  annualModel,
  year,
  enabled,
  isTestingMode = false,
}: UseDirectorReportOptions): {
  model: DirectorReportModel | null;
  isLoading: boolean;
  error: Error | null;
} => {
  const snapshotDateISO = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
  }).format(new Date());
  const query = useQuery({
    queryKey: ["director-report-v1", year, snapshotDateISO, isTestingMode],
    queryFn: () =>
      isTestingMode
        ? Promise.resolve(testingDirectorSnapshot(year, snapshotDateISO))
        : fetchDirectorReportSnapshot(year, snapshotDateISO),
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  const model: DirectorReportModel | null =
    enabled && annualModel && query.data
      ? {
          annual: annualModel,
          snapshot: query.data,
          recipient: {
            name: "Agostina Reale Berrueta",
            role: "Directora de la Carrera",
          },
          privacyLabel: "Circulación interna · contiene datos personales",
        }
      : null;

  return {
    model,
    isLoading: enabled && query.isLoading,
    error:
      query.error instanceof Error
        ? query.error
        : query.error
          ? new Error(String(query.error))
          : null,
  };
};
