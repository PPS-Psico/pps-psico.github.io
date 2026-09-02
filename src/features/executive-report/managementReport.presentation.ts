import type {
  AnalyticsSnapshot,
  ManagementAccess,
  ManagementAgreement,
} from "./executiveReport.types";

const normalizeInstitutionName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const joinSpanish = (parts: string[]): string => {
  if (parts.length < 2) return parts[0] || "ninguno";
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
};

const formatAttemptDistribution = (
  access: ManagementAccess,
  field: "students" | "withoutAnyPps"
): string =>
  joinSpanish(
    access.pendingApplicationDistribution
      .filter((bucket) => bucket[field] > 0)
      .map((bucket) => {
        const students = bucket[field];
        const launches = `${bucket.applications} ${
          bucket.applications === 1 ? "lanzamiento" : "lanzamientos"
        }`;
        return `${students} ${students === 1 ? "estudiante" : "estudiantes"} en ${launches}`;
      })
  );

export const managementCapacityValue = (snapshot: AnalyticsSnapshot): number =>
  snapshot.capacity.operational;

export const visibleManagementAgreements = (
  agreements: ManagementAgreement[]
): ManagementAgreement[] =>
  agreements.filter(
    (agreement) => normalizeInstitutionName(agreement.institution) !== "banco provincia del neuquen"
  );

export const buildManagementAccessPresentation = (
  access: ManagementAccess,
  series: AnalyticsSnapshot[]
) => {
  const totalLaunches = series.find((snapshot) => snapshot.year === access.year)?.capacity.launches;
  const annualLaunches = totalLaunches
    ? ` de los ${totalLaunches} lanzamientos realizados en ${access.year}`
    : ` durante ${access.year}`;

  return {
    overview: `${access.started} de ${access.applicants} estudiantes que se postularon al menos una vez iniciaron una PPS.`,
    pending: `Los ${access.withoutStart} restantes se habían anotado${annualLaunches}: ${formatAttemptDistribution(access, "students")}.`,
    withoutAnyPps:
      access.withoutAnyPps > 0
        ? `Dentro de ese grupo, ${access.withoutAnyPps} no registraban ninguna PPS en su trayectoria: ${formatAttemptDistribution(access, "withoutAnyPps")}.`
        : "Todas las personas de ese grupo registraban al menos una PPS en su trayectoria.",
    scope:
      "El análisis incluye únicamente a quienes se postularon al menos una vez y describe actividad registrada, sin atribuir motivaciones personales.",
    totalLaunches: totalLaunches ?? null,
  };
};
