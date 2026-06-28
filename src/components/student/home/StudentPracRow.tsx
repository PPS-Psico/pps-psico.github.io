import React from "react";
import { AreaBadge, getAreaColor } from "../ds";
import { normalizeStringForComparison } from "../../../utils/formatters";

export interface StudentPracRowData {
  id: string;
  area: string;
  status: string;
  name: string;
  dates: string;
  hs: number | string;
  nota: number | string | null;
}

interface StudentPracRowProps {
  data: StudentPracRowData;
}

const TONE = {
  wait: { bg: "rgba(183,119,11,.14)", fg: "#B7770B" },
  info: { bg: "rgba(122,63,158,.14)", fg: "#7A3F9E" },
  ok: { bg: "rgba(60,184,141,.16)", fg: "#2F9C76" },
  done: { bg: "rgba(32,59,115,.14)", fg: "#203B73" },
};

function statusTone(status: string): keyof typeof TONE {
  const s = normalizeStringForComparison(status);
  if (s.includes("curso")) return "ok";
  if (s.includes("selecc") || s.includes("adjud")) return "done";
  if (s.includes("entrev")) return "info";
  if (s.includes("espera")) return "wait";
  return "done";
}

export const StudentPracRow: React.FC<StudentPracRowProps> = ({ data }) => {
  const color = getAreaColor(data.area);
  const tone = statusTone(data.status);
  const notaColor =
    data.nota == null || data.nota === "—" || data.nota === ""
      ? "text-student-ink-subtle"
      : Number(data.nota) >= 7
        ? "text-area-clinica"
        : "text-area-laboral";
  const notaText = data.nota == null || data.nota === "" ? "—" : String(data.nota);

  return (
    <div className="group relative flex items-center gap-4 border-b border-student-hairline py-4 last:border-b-0">
      <div
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full opacity-90"
        style={{ background: color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1 pl-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <AreaBadge area={data.area} size="sm" />
          <span
            className="inline-flex items-center gap-1.5 rounded-pill px-2 py-[2px] text-[10.5px] font-semibold"
            style={{ background: TONE[tone].bg, color: TONE[tone].fg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[tone].fg }} />
            {data.status}
          </span>
        </div>
        <h4 className="font-bricolage text-[15.5px] font-semibold leading-[1.2] tracking-[-0.01em] text-student-ink mt-1.5 truncate">
          {data.name}
        </h4>
        <div className="font-mono text-[11px] text-student-ink-subtle mt-0.5 tracking-[.02em]">
          {data.dates}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-5 pr-1">
        <div className="text-right">
          <div className="font-bricolage text-[20px] font-bold leading-[0.95] tracking-[-0.03em] text-student-ink tabular-nums">
            {data.hs}
            <span className="text-[11px] font-medium text-student-ink-muted ml-0.5">hs</span>
          </div>
        </div>
        <div
          className={`font-bricolage text-[20px] font-bold leading-[0.95] tracking-[-0.03em] tabular-nums ${notaColor}`}
        >
          {notaText}
        </div>
      </div>
    </div>
  );
};

export default StudentPracRow;
