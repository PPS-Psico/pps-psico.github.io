/**
 * Clasificador conservador de los archivos que Moodle muestra en una entrega.
 *
 * Recibe nombres solamente durante la lectura. El resultado no conserva nombres:
 * persiste conteos, tipos y códigos de evidencia para no duplicar documentos ni
 * datos personales fuera de Campus.
 */

export const MOODLE_SUBMISSION_CLASSIFIER_VERSION = "submission-files/v1";

export type AttendanceEvidenceState =
  | "not_required"
  | "missing"
  | "single_file"
  | "duplicate_only"
  | "needs_review"
  | "assumed"
  | "detected";

export interface SubmissionFileTypeCounts {
  image: number;
  pdf: number;
  word: number;
  other: number;
}

export interface MoodleSubmissionEvidence {
  fileCount: number | null;
  logicalFileCount: number | null;
  fileTypeCounts: SubmissionFileTypeCounts | null;
  attendanceEvidence: AttendanceEvidenceState;
  attendanceConfidence: number;
  reasons: string[];
  classifierVersion: string;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "webp", "tif", "tiff"]);
const WORD_EXTENSIONS = new Set(["doc", "docx", "odt", "rtf"]);
const ATTENDANCE_HINT =
  /(?:^|[\s_-])(asistencia|asistencias|presentismo|planilla|firma|firmas|firmada|horas|registro)(?:$|[\s_-])/i;
const REPORT_HINT = /(?:^|[\s_-])(informe|reporte|trabajo[\s_-]*final)(?:$|[\s_-])/i;

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const cleanFilename = (value: string): string => {
  const withoutQuery = value.split(/[?#]/, 1)[0];
  const parts = withoutQuery.split(/[\\/]/);
  return (parts[parts.length - 1] ?? "").trim().slice(0, 180);
};

const extensionOf = (filename: string): string => {
  const match = filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1] ?? "";
};

/**
 * Agrupa sólo copias obvias: mismo nombre en otro formato o sufijos que agrega
 * el navegador ("(1)", "copia"). No elimina v2/final/firmado porque podrían ser
 * documentos materialmente distintos.
 */
const logicalKeyOf = (filename: string): string => {
  const extension = extensionOf(filename);
  const stem = extension ? filename.slice(0, -(extension.length + 1)) : filename;
  const withoutBrowserCounter = stem.replace(/\s*[\[(]\d+[\])]\s*$/i, "");
  const withoutNumberedCopy = withoutBrowserCounter.replace(
    /[\s_-]+(?:copia|copy)[\s_-]+\d+\s*$/i,
    ""
  );
  const withoutCopySuffix = withoutNumberedCopy.replace(/[\s_-]+(?:copia|copy)\s*$/i, "");
  return normalizeText(withoutCopySuffix);
};

const emptyTypeCounts = (): SubmissionFileTypeCounts => ({
  image: 0,
  pdf: 0,
  word: 0,
  other: 0,
});

const classifyExtension = (extension: string): keyof SubmissionFileTypeCounts => {
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (extension === "pdf") return "pdf";
  if (WORD_EXTENSIONS.has(extension)) return "word";
  return "other";
};

const result = (
  attendanceEvidence: AttendanceEvidenceState,
  attendanceConfidence: number,
  reasons: string[],
  fileCount: number | null,
  logicalFileCount: number | null,
  fileTypeCounts: SubmissionFileTypeCounts | null
): MoodleSubmissionEvidence => ({
  fileCount,
  logicalFileCount,
  fileTypeCounts,
  attendanceEvidence,
  attendanceConfidence,
  reasons,
  classifierVersion: MOODLE_SUBMISSION_CLASSIFIER_VERSION,
});

export function classifyMoodleSubmissionFiles(params: {
  filenames: readonly string[] | null;
  isOnline: boolean;
}): MoodleSubmissionEvidence {
  const { filenames, isOnline } = params;

  if (filenames === null) {
    return result(
      isOnline ? "not_required" : "needs_review",
      isOnline ? 1 : 0,
      [isOnline ? "online_attendance_not_required" : "file_list_not_observed"],
      null,
      null,
      null
    );
  }

  const files = filenames.map(cleanFilename).filter(Boolean).slice(0, 20);
  const fileTypeCounts = emptyTypeCounts();
  const logicalKeys = new Set<string>();
  let attendanceHints = 0;
  let reportHints = 0;

  for (const filename of files) {
    const extension = extensionOf(filename);
    fileTypeCounts[classifyExtension(extension)] += 1;
    logicalKeys.add(logicalKeyOf(filename) || normalizeText(filename));
    const normalized = normalizeText(filename);
    if (ATTENDANCE_HINT.test(` ${normalized} `)) attendanceHints += 1;
    if (REPORT_HINT.test(` ${normalized} `)) reportHints += 1;
  }

  const fileCount = files.length;
  const logicalFileCount = logicalKeys.size;
  const imageCount = fileTypeCounts.image;
  const documentCount = fileTypeCounts.pdf + fileTypeCounts.word;

  if (isOnline) {
    return result(
      "not_required",
      1,
      ["online_attendance_not_required"],
      fileCount,
      logicalFileCount,
      fileTypeCounts
    );
  }

  if (fileCount === 0) {
    return result("missing", 0, ["no_files_observed"], 0, 0, fileTypeCounts);
  }

  if (logicalFileCount === 1 && fileCount > 1) {
    return result(
      "duplicate_only",
      0.1,
      ["obvious_copies_collapsed", "only_one_logical_file"],
      fileCount,
      logicalFileCount,
      fileTypeCounts
    );
  }

  if (logicalFileCount === 1) {
    return result(
      attendanceHints > 0 ? "needs_review" : "single_file",
      attendanceHints > 0 ? 0.2 : 0,
      [attendanceHints > 0 ? "attendance_named_but_report_not_observed" : "only_one_logical_file"],
      fileCount,
      logicalFileCount,
      fileTypeCounts
    );
  }

  if (attendanceHints > 0) {
    return result(
      "detected",
      0.99,
      ["attendance_filename_hint", "multiple_logical_files"],
      fileCount,
      logicalFileCount,
      fileTypeCounts
    );
  }

  if (reportHints >= logicalFileCount && imageCount === 0) {
    return result(
      "needs_review",
      0.25,
      ["all_files_look_like_reports", "multiple_logical_files"],
      fileCount,
      logicalFileCount,
      fileTypeCounts
    );
  }

  if (documentCount > 0 && imageCount > 0) {
    return result(
      "assumed",
      0.92,
      ["document_plus_image_cluster", "multiple_logical_files"],
      fileCount,
      logicalFileCount,
      fileTypeCounts
    );
  }

  if (imageCount >= 2) {
    return result(
      "assumed",
      0.85,
      ["multiple_image_pages", "multiple_logical_files"],
      fileCount,
      logicalFileCount,
      fileTypeCounts
    );
  }

  return result(
    "assumed",
    0.65,
    ["multiple_logical_files", "generic_file_mix"],
    fileCount,
    logicalFileCount,
    fileTypeCounts
  );
}
