import React, { useMemo } from "react";
import FinalizationStatusCard from "./FinalizationStatusCard";
import CriteriosPanel from "./CriteriosPanel";
import StudentPracRow, { type StudentPracRowData } from "./home/StudentPracRow";
import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOTA_PRACTICAS,
} from "../../constants";
import { cleanDbValue, formatDate } from "../../utils/formatters";
import type { CriteriosCalculados, InformeTask, Orientacion, Practica } from "../../types";

interface FinalizacionReadOnlyViewProps {
  status: string;
  requestDate: string;
  studentName?: string;
  criterios: CriteriosCalculados;
  selectedOrientacion: Orientacion | "";
  practicas: Practica[];
  informeTasks: InformeTask[];
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const fmtShort = (raw?: unknown): string => {
  if (!raw) return "";
  const f = formatDate(raw as string);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(f);
  if (!m) return f;
  return `${parseInt(m[1], 10)} ${MESES[parseInt(m[2], 10) - 1] ?? ""}`.trim();
};

/**
 * Vista que se muestra mientras hay un trámite de finalización en curso.
 *
 * Antes esto bloqueaba TODO el panel (solo se veía la tarjeta de estado). Ahora
 * el alumno conserva acceso de SOLO LECTURA a su progreso (criterios/horas) y a
 * su historial de prácticas — que es justo lo que quiere mirar mientras espera
 * la resolución. No expone acciones (inscribirse, editar, nueva PPS).
 */
const FinalizacionReadOnlyView: React.FC<FinalizacionReadOnlyViewProps> = ({
  status,
  requestDate,
  studentName,
  criterios,
  selectedOrientacion,
  practicas,
  informeTasks,
}) => {
  const pracRows: StudentPracRowData[] = useMemo(
    () =>
      [...(practicas || [])]
        .sort(
          (a, b) =>
            new Date((b[FIELD_FECHA_INICIO_PRACTICAS] as string) || 0).getTime() -
            new Date((a[FIELD_FECHA_INICIO_PRACTICAS] as string) || 0).getTime()
        )
        .map((p) => {
          const rawNota = p[FIELD_NOTA_PRACTICAS];
          const notaNum = rawNota != null && String(rawNota).trim() !== "" ? Number(rawNota) : NaN;
          const notaClean = Number.isFinite(notaNum) ? String(rawNota).trim() : null;
          return {
            id: p.id,
            area: (p[FIELD_ESPECIALIDAD_PRACTICAS] as string) || "General",
            status: (p[FIELD_ESTADO_PRACTICA] as string) || "—",
            name: cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) || "Institución",
            dates: [
              fmtShort(p[FIELD_FECHA_INICIO_PRACTICAS]),
              fmtShort(p[FIELD_FECHA_FIN_PRACTICAS]),
            ]
              .filter(Boolean)
              .join(" — "),
            hs: (p[FIELD_HORAS_PRACTICAS] as number) || 0,
            nota: notaClean,
          };
        }),
    [practicas]
  );

  const noop = () => {};

  return (
    <div className="py-2 sm:py-6 animate-fade-in w-full max-w-3xl mx-auto space-y-6">
      <FinalizationStatusCard status={status} requestDate={requestDate} studentName={studentName} />

      {/* Progreso (solo lectura): mismo panel que ven en "Prácticas", sin el
          selector de orientación ni el botón de acreditar. */}
      <CriteriosPanel
        criterios={criterios}
        selectedOrientacion={selectedOrientacion}
        handleOrientacionChange={noop}
        showSaveConfirmation={false}
        onRequestFinalization={noop}
        informeTasks={informeTasks}
        showOrientationSelector={false}
      />

      {/* Historial de prácticas (solo lectura). */}
      {pracRows.length > 0 && (
        <section
          aria-label="Historial de prácticas"
          className="rounded-2xl border border-student-line bg-student-bg-elevated px-5 py-1"
        >
          <div className="flex items-baseline justify-between pt-4 pb-1">
            <h3 className="font-mono text-[10.5px] uppercase tracking-[.12em] text-student-ink-muted">
              Tu historial
            </h3>
            <span className="font-mono text-[10.5px] text-student-ink-subtle">
              {pracRows.length} {pracRows.length === 1 ? "práctica" : "prácticas"}
            </span>
          </div>
          {pracRows.map((p) => (
            <StudentPracRow key={p.id} data={p} />
          ))}
        </section>
      )}
    </div>
  );
};

export default FinalizacionReadOnlyView;
