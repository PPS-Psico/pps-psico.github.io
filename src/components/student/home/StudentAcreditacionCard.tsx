import React from "react";

interface StudentAcreditacionCardProps {
  hours: number;
  total: number;
  pct: number;
  areas: number;
  areasTarget?: number;
  hoursShort: number;
}

export const StudentAcreditacionCard: React.FC<StudentAcreditacionCardProps> = ({
  hours,
  total,
  pct,
  areas,
  areasTarget = 3,
  hoursShort,
}) => {
  return (
    <div className="rounded-2xl border border-student-line bg-student-bg-elevated p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h4 className="font-mono text-[10.5px] uppercase tracking-[.12em] text-student-ink-muted">
          Acreditación
        </h4>
        <span className="font-mono text-[10.5px] text-student-ink-subtle">meta · {total} hs</span>
      </div>
      <div className="flex items-baseline gap-3">
        <div className="font-bricolage text-[36px] font-bold leading-[0.9] tracking-[-0.04em] text-student-ink tabular-nums">
          {hours}
          <span className="text-[14px] font-medium text-student-ink-muted">/{total}</span>
        </div>
        <div className="ml-auto font-bricolage text-[18px] font-semibold text-uflo-teal tabular-nums">
          {pct}%
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-student-bg-sunken">
        <span
          className="block h-full rounded-full transition-[width] duration-700 ease-spring"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: "linear-gradient(90deg, #46253D 0%, #203B73 50%, #3CB88D 100%)",
          }}
        />
      </div>
      <p className="mt-4 text-[12.5px] leading-[1.45] text-student-ink-soft">
        Necesitás <span className="text-student-ink font-semibold">{total} hs</span> y al menos{" "}
        <span className="text-student-ink font-semibold">{areasTarget} áreas</span> distintas para
        acreditar la PPS.
        {hoursShort > 0 && (
          <>
            {" "}
            Te faltan <span className="text-area-laboral font-semibold">
              {hoursShort} hs
            </span> y {Math.max(0, areasTarget - areas)} rotación
            {Math.max(0, areasTarget - areas) === 1 ? "" : "es"}.
          </>
        )}
      </p>
    </div>
  );
};

export default StudentAcreditacionCard;
