/**
 * Pure planning/verification helpers for the external Moodle browser agent.
 * They never claim to have written Moodle. The database confirmation RPC is
 * the authoritative verifier and repeats the full comparison under a lease.
 */

import type { MoodleGradeConversionMode, MoodleTaskMode } from "./moodleReportStatus";

export interface DesiredTaskConfig {
  intentId: string;
  launchId: string;
  courseId: number;
  orientationKey: string;
  mode: MoodleTaskMode;
  stableKey: string;
  linkedCmid?: number | null;
  desiredName: string;
  descriptionTemplateVersion: string;
  desiredDescriptionHtml?: string | null;
  desiredOpenAt?: string | null;
  desiredDueAt?: string | null;
  desiredCutoffAt?: string | null;
  desiredGradeMode: MoodleGradeConversionMode;
  desiredGradeMax: number;
  desiredSectionKey?: string | null;
  desiredVisibility: "visible" | "hidden";
}

export interface ObservedMoodleActivity {
  cmid: number;
  courseId: number;
  idNumber: string;
  name: string;
  introHtml?: string | null;
  allowSubmissionsFromDate?: number | null;
  dueDate?: number | null;
  cutoffDate?: number | null;
  gradeMode: MoodleGradeConversionMode;
  gradeMax: number;
  sectionKey?: string | null;
  visible: boolean;
}

export interface ProvisioningPlan {
  action:
    | "no_op"
    | "adopt_confirmed_legacy"
    | "create_from_template"
    | "update_config"
    | "needs_attention";
  intentId: string;
  stableKey: string;
  targetCmid?: number;
  reason: string;
  configHash: string;
  driftDetected: boolean;
  driftDetails: string[];
}

export interface VerificationResult {
  verified: boolean;
  observedHash: string;
  mismatches: string[];
}

type ComparableConfig = {
  stableKey: string;
  name: string;
  descriptionHtml: string;
  openAt: string;
  dueAt: string;
  cutoffAt: string;
  gradeMode: MoodleGradeConversionMode;
  gradeMax: number;
  sectionKey: string;
  visibility: "visible" | "hidden";
  templateVersion: string;
};

const toIso = (value: string | null | undefined): string => {
  if (!value) return "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value.trim();
};

const unixToIso = (value: number | null | undefined): string =>
  typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : "";

const fromDesired = (config: DesiredTaskConfig): ComparableConfig => ({
  stableKey: config.stableKey.trim(),
  name: config.desiredName.trim(),
  descriptionHtml: config.desiredDescriptionHtml ?? "",
  openAt: toIso(config.desiredOpenAt),
  dueAt: toIso(config.desiredDueAt),
  cutoffAt: toIso(config.desiredCutoffAt),
  gradeMode: config.desiredGradeMode,
  gradeMax: config.desiredGradeMax,
  sectionKey: config.desiredSectionKey ?? "",
  visibility: config.desiredVisibility,
  templateVersion: config.descriptionTemplateVersion,
});

const fromObserved = (
  activity: ObservedMoodleActivity,
  templateVersion: string
): ComparableConfig => ({
  stableKey: activity.idNumber.trim(),
  name: activity.name.trim(),
  descriptionHtml: activity.introHtml ?? "",
  openAt: unixToIso(activity.allowSubmissionsFromDate),
  dueAt: unixToIso(activity.dueDate),
  cutoffAt: unixToIso(activity.cutoffDate),
  gradeMode: activity.gradeMode,
  gradeMax: activity.gradeMax,
  sectionKey: activity.sectionKey ?? "",
  visibility: activity.visible ? "visible" : "hidden",
  templateVersion,
});

const stableFingerprint = (value: ComparableConfig): string => {
  const payload = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `cfg_${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const computeConfigHash = (config: DesiredTaskConfig): string =>
  stableFingerprint(fromDesired(config));

export const computeObservedHash = (
  activity: ObservedMoodleActivity,
  templateVersion = "v1"
): string => stableFingerprint(fromObserved(activity, templateVersion));

function collectMismatches(desired: DesiredTaskConfig, observed: ObservedMoodleActivity): string[] {
  const expected = fromDesired(desired);
  const actual = fromObserved(observed, desired.descriptionTemplateVersion);
  const mismatches: string[] = [];

  if (observed.courseId !== desired.courseId) mismatches.push("course_id");
  if (actual.stableKey !== expected.stableKey) mismatches.push("id_number");
  if (actual.name !== expected.name) mismatches.push("name");
  if (actual.descriptionHtml !== expected.descriptionHtml) mismatches.push("description_html");
  if (actual.openAt !== expected.openAt) mismatches.push("open_at");
  if (actual.dueAt !== expected.dueAt) mismatches.push("due_at");
  if (actual.cutoffAt !== expected.cutoffAt) mismatches.push("cutoff_at");
  if (actual.gradeMode !== expected.gradeMode) mismatches.push("grade_mode");
  if (Math.abs(actual.gradeMax - expected.gradeMax) > 0.001) mismatches.push("grade_max");
  if (actual.sectionKey !== expected.sectionKey) mismatches.push("section_key");
  if (actual.visibility !== expected.visibility) mismatches.push("visibility");

  return mismatches;
}

export function planTaskProvisioning(
  desired: DesiredTaskConfig,
  observedActivities: ObservedMoodleActivity[]
): ProvisioningPlan {
  const configHash = computeConfigHash(desired);

  if (desired.mode === "legacy_shared") {
    if (!desired.linkedCmid) {
      return {
        action: "needs_attention",
        intentId: desired.intentId,
        stableKey: desired.stableKey,
        reason:
          "La tarea legacy no tiene un vínculo confirmado; no se adopta por parecido de nombre.",
        configHash,
        driftDetected: true,
        driftDetails: ["missing_confirmed_legacy_link"],
      };
    }

    const linked = observedActivities.filter(
      (activity) => activity.courseId === desired.courseId && activity.cmid === desired.linkedCmid
    );
    if (linked.length !== 1) {
      return {
        action: "needs_attention",
        intentId: desired.intentId,
        stableKey: desired.stableKey,
        targetCmid: desired.linkedCmid,
        reason: "El vínculo legacy confirmado no pudo verificarse de forma unívoca en Moodle.",
        configHash,
        driftDetected: true,
        driftDetails: [linked.length === 0 ? "linked_cmid_not_found" : "duplicate_linked_cmid"],
      };
    }

    return {
      action: "adopt_confirmed_legacy",
      intentId: desired.intentId,
      stableKey: desired.stableKey,
      targetCmid: linked[0].cmid,
      reason: "Se conserva la tarea compartida mediante el vínculo histórico ya confirmado.",
      configHash,
      driftDetected: false,
      driftDetails: [],
    };
  }

  const stableMatches = observedActivities.filter(
    (activity) =>
      activity.courseId === desired.courseId &&
      activity.idNumber.trim() === desired.stableKey.trim()
  );

  if (stableMatches.length > 1) {
    return {
      action: "needs_attention",
      intentId: desired.intentId,
      stableKey: desired.stableKey,
      reason: "Hay más de una actividad con el mismo ID number; la automatización se detiene.",
      configHash,
      driftDetected: true,
      driftDetails: [`duplicate_stable_key:${stableMatches.map(({ cmid }) => cmid).join(",")}`],
    };
  }

  if (stableMatches.length === 0) {
    return {
      action: "create_from_template",
      intentId: desired.intentId,
      stableKey: desired.stableKey,
      reason:
        "No existe una tarea exclusiva con esa clave; corresponde crearla desde la plantilla.",
      configHash,
      driftDetected: false,
      driftDetails: [],
    };
  }

  const observed = stableMatches[0];
  const mismatches = collectMismatches(desired, observed);
  return mismatches.length === 0
    ? {
        action: "no_op",
        intentId: desired.intentId,
        stableKey: desired.stableKey,
        targetCmid: observed.cmid,
        reason: "La actividad existe y toda su configuración coincide.",
        configHash,
        driftDetected: false,
        driftDetails: [],
      }
    : {
        action: "update_config",
        intentId: desired.intentId,
        stableKey: desired.stableKey,
        targetCmid: observed.cmid,
        reason: "La actividad exclusiva existe, pero tiene configuración divergente.",
        configHash,
        driftDetected: true,
        driftDetails: mismatches,
      };
}

export function verifyObservedMoodleActivity(
  desired: DesiredTaskConfig,
  observed: ObservedMoodleActivity
): VerificationResult {
  const mismatches =
    desired.mode === "legacy_shared"
      ? [
          ...(observed.courseId === desired.courseId ? [] : ["course_id"]),
          ...(observed.cmid === desired.linkedCmid ? [] : ["confirmed_legacy_cmid"]),
        ]
      : collectMismatches(desired, observed);

  return {
    verified: mismatches.length === 0,
    observedHash: computeObservedHash(observed, desired.descriptionTemplateVersion),
    mismatches,
  };
}
