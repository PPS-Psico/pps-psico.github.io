import type { Json, Tables } from "../../types/supabase";

export type AccreditationTransitionEvent = Tables<"accreditation_transition_events">;
export type AccreditationTransitionOutcome =
  | "auto_started"
  | "manual_required"
  | "requirements_pending";

export interface AccreditationEvidenceItem {
  practicaId: string;
  esOnline: boolean;
  cmid: number | null;
  reportEvidence: "graded";
  attendanceEvidence: string;
  attendanceConfidence: number;
  fileCount: number | null;
  logicalFileCount: number | null;
  classifierVersion: string | null;
  automatic: boolean;
}

export interface AccreditationDocumentationSnapshot {
  version: string;
  threshold: number;
  items: AccreditationEvidenceItem[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const finiteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isAccreditationTransitionOutcome = (
  value: string
): value is AccreditationTransitionOutcome =>
  value === "auto_started" || value === "manual_required" || value === "requirements_pending";

/**
 * El snapshot viene de una función SECURITY DEFINER, pero se valida igual al
 * cruzar la frontera JSON para que un registro histórico incompleto no rompa
 * el formulario estudiantil.
 */
export const parseAccreditationDocumentationSnapshot = (
  raw: Json
): AccreditationDocumentationSnapshot | null => {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;

  const items = raw.items.flatMap<AccreditationEvidenceItem>((candidate) => {
    if (!isRecord(candidate) || typeof candidate.practicaId !== "string") return [];
    const confidence = finiteNumber(candidate.attendanceConfidence);
    return [
      {
        practicaId: candidate.practicaId,
        esOnline: candidate.esOnline === true,
        cmid: finiteNumber(candidate.cmid),
        reportEvidence: "graded",
        attendanceEvidence:
          typeof candidate.attendanceEvidence === "string"
            ? candidate.attendanceEvidence
            : "needs_review",
        attendanceConfidence: confidence ?? 0,
        fileCount: finiteNumber(candidate.fileCount),
        logicalFileCount: finiteNumber(candidate.logicalFileCount),
        classifierVersion:
          typeof candidate.classifierVersion === "string" ? candidate.classifierVersion : null,
        automatic: candidate.automatic === true,
      },
    ];
  });

  return {
    version: typeof raw.version === "string" ? raw.version : "unknown",
    threshold: finiteNumber(raw.threshold) ?? 1,
    items,
  };
};
