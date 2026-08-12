import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

interface ParsedRow {
  dni: string;
  cmid: number;
  status: "not_submitted" | "submitted" | "graded";
  gradeValue: number | null;
  gradeMax: number | null;
  gradeDisplay: string | null;
}

interface ImportResult {
  dryRun?: boolean;
  status: "success" | "partial" | "failed";
  accepted: number;
  rejected: Array<{ dni: string; cmid: number; error: string }>;
  observations: number;
  snapshots?: number;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export function parseNormalizedMoodleGradeFile(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error("El archivo no tiene filas de datos.");
  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const headers = splitLine(lines[0], delimiter).map(normalizeHeader);
  const indexOf = (...aliases: string[]) =>
    aliases.map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1;
  const dniIndex = indexOf("dni", "username", "nombre_de_usuario");
  const cmidIndex = indexOf("cmid", "moodle_id", "tarea_id");
  const statusIndex = indexOf("estado", "status");
  const gradeIndex = indexOf("nota", "grade_value", "calificacion");
  const maxIndex = indexOf("maximo", "grade_max", "calificacion_maxima");
  const displayIndex = indexOf("grade_display", "nota_original");
  if (dniIndex < 0 || cmidIndex < 0) {
    throw new Error("Faltan las columnas obligatorias dni y cmid.");
  }

  return lines.slice(1).map((line, lineIndex) => {
    const cells = splitLine(line, delimiter);
    const statusRaw = statusIndex >= 0 ? normalizeHeader(cells[statusIndex] ?? "") : "graded";
    const status =
      statusRaw === "sin_entrega" || statusRaw === "not_submitted"
        ? "not_submitted"
        : statusRaw === "entregado" || statusRaw === "submitted"
          ? "submitted"
          : "graded";
    const gradeRaw = gradeIndex >= 0 ? cells[gradeIndex] : null;
    const maxRaw = maxIndex >= 0 ? cells[maxIndex] : null;
    const gradeValue = gradeRaw ? Number(gradeRaw.replace(",", ".")) : null;
    const gradeMax = maxRaw ? Number(maxRaw.replace(",", ".")) : status === "graded" ? 100 : null;
    const cmid = Number(cells[cmidIndex]);
    if (!Number.isInteger(cmid) || cmid <= 0)
      throw new Error(`CMID inválido en la fila ${lineIndex + 2}.`);
    if (status === "graded" && (!Number.isFinite(gradeValue) || !Number.isFinite(gradeMax))) {
      throw new Error(`Nota o máximo inválido en la fila ${lineIndex + 2}.`);
    }
    return {
      dni: String(cells[dniIndex] ?? "").replace(/\D/g, ""),
      cmid,
      status,
      gradeValue,
      gradeMax,
      gradeDisplay: displayIndex >= 0 ? cells[displayIndex] || null : null,
    };
  });
}

const MoodleGradeImportPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const invoke = async (dryRun: boolean) => {
    if (!file || rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const id = batchId ?? crypto.randomUUID();
      setBatchId(id);
      const { data, error: invokeError } = await supabase.functions.invoke(
        "ingest-moodle-grade-export",
        {
          body: {
            batchId: id,
            fileName: file.name,
            // El momento de observación es la conciliación. file.lastModified no
            // es evidencia confiable: cambia al copiar o volver a descargar.
            observedAt: new Date().toISOString(),
            dryRun,
            rows,
          },
        }
      );
      if (invokeError) throw invokeError;
      setResult(data as ImportResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo validar la exportación.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700">
      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">
        Conciliación masiva desde exportación normalizada
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-700">
        <p className="text-[11px] leading-5 text-slate-500">
          CSV, TSV o TXT con columnas <code>dni</code>, <code>cmid</code>, <code>estado</code>,{" "}
          <code>nota</code> y <code>maximo</code>. Primero se valida sin escribir; Moodle sólo se
          aplica si estudiante, PPS, tarea y escala coinciden.
        </p>
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold"
          onChange={async (event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setResult(null);
            setBatchId(null);
            setError(null);
            if (!selected) return setRows([]);
            try {
              const parsed = parseNormalizedMoodleGradeFile(await selected.text());
              if (parsed.length > 500) throw new Error("El máximo es 500 filas por lote.");
              setRows(parsed);
            } catch (caught) {
              setRows([]);
              setError(caught instanceof Error ? caught.message : "Archivo inválido.");
            }
          }}
        />
        {rows.length > 0 && (
          <p className="text-[11px] text-slate-500">{rows.length} filas preparadas.</p>
        )}
        {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
        {result && (
          <div
            className={`rounded-lg px-3 py-2 text-[11px] ${result.status === "success" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
          >
            {result.dryRun ? "Validación" : "Importación"}: {result.accepted} filas aceptadas,{" "}
            {result.rejected.length} rechazadas, {result.observations} observaciones resueltas.
            {result.rejected.slice(0, 5).map((item, index) => (
              <span key={`${item.dni}-${item.cmid}-${index}`} className="mt-1 block font-mono">
                DNI {item.dni} · tarea {item.cmid}: {item.error}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || rows.length === 0}
            onClick={() => void invoke(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-slate-600"
          >
            {busy ? "Procesando…" : "Validar sin escribir"}
          </button>
          <button
            type="button"
            disabled={busy || !result?.dryRun || result.status === "failed"}
            onClick={() => void invoke(false)}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Aplicar lote validado
          </button>
        </div>
      </div>
    </details>
  );
};

export default MoodleGradeImportPanel;
