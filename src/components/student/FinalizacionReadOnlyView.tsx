import React, { useMemo } from "react";
import FinalizationStatusCard from "./FinalizationStatusCard";
import "./home/atlas/atlasHome.css";
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

const FinalizacionReadOnlyView: React.FC<FinalizacionReadOnlyViewProps> = ({
  status,
  requestDate,
  studentName,
  practicas,
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
            status: (p[FIELD_ESTADO_PRACTICA] as string) || "-",
            name: cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) || "Institucion",
            dates: [
              fmtShort(p[FIELD_FECHA_INICIO_PRACTICAS]),
              fmtShort(p[FIELD_FECHA_FIN_PRACTICAS]),
            ]
              .filter(Boolean)
              .join(" - "),
            hs: (p[FIELD_HORAS_PRACTICAS] as number) || 0,
            nota: notaClean,
          };
        }),
    [practicas]
  );

  return (
    <div className="ah-root ah-unified ah-finalization-readonly">
      <main className="ah-main">
        <FinalizationStatusCard
          status={status}
          requestDate={requestDate}
          studentName={studentName}
        />

        {pracRows.length > 0 && (
          <section aria-label="Historial de practicas" className="ah-finalization-history">
            <div className="ah-finalization-history__head">
              <h2>Tu historial</h2>
              <span>
                {pracRows.length} {pracRows.length === 1 ? "practica" : "practicas"}
              </span>
            </div>
            <div className="ah-finalization-history__list">
              {pracRows.map((p) => (
                <StudentPracRow key={p.id} data={p} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default FinalizacionReadOnlyView;
