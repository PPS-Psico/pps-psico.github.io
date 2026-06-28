import React from "react";
import { AreaBadge, getAreaColor } from "../ds";
import { normalizeStringForComparison } from "../../../utils/formatters";

export interface StudentSolicitudItemData {
  id: string;
  name: string;
  area: string;
  sub: string;
  status: string;
}

interface StudentSolicitudItemProps {
  data: StudentSolicitudItemData;
}

const TONE = {
  wait: { bg: "rgba(183,119,11,.14)", fg: "#B7770B" },
  info: { bg: "rgba(122,63,158,.14)", fg: "#7A3F9E" },
  ok: { bg: "rgba(60,184,141,.16)", fg: "#2F9C76" },
  done: { bg: "rgba(32,59,115,.12)", fg: "#203B73" },
  warn: { bg: "rgba(180,80,30,.14)", fg: "#B4501E" },
};

function toneFor(status: string): keyof typeof TONE {
  const s = normalizeStringForComparison(status);
  if (s.includes("curso")) return "ok";
  if (s.includes("entrev")) return "info";
  if (s.includes("espera")) return "wait";
  if (s.includes("selecc") || s.includes("adjud")) return "done";
  if (s.includes("rech") || s.includes("no ")) return "warn";
  return "done";
}

export const StudentSolicitudItem: React.FC<StudentSolicitudItemProps> = ({ data }) => {
  const color = getAreaColor(data.area);
  const tone = toneFor(data.status);
  const t = TONE[tone];
  return (
    <div className="relative flex items-center gap-3 border-b border-student-hairline py-3 last:border-b-0">
      <div
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1 pl-3">
        <div className="font-bricolage text-[14px] font-medium leading-[1.25] tracking-[-0.01em] text-student-ink truncate">
          {data.name}
        </div>
        <div className="font-mono text-[10.5px] text-student-ink-subtle mt-0.5 tracking-[.02em]">
          {data.sub}
        </div>
      </div>
      <span
        className="shrink-0 inline-flex items-center rounded-pill px-2.5 py-1 text-[10.5px] font-semibold whitespace-nowrap"
        style={{ background: t.bg, color: t.fg }}
      >
        {data.status}
      </span>
    </div>
  );
};

export default StudentSolicitudItem;
