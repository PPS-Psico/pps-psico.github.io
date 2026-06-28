import React from "react";
import { Icon } from "../ds";

export interface NextStepData {
  title: string;
  subtitle: string;
  where: string;
  date: string;
  time?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

interface StudentNextStepCardProps {
  next: NextStepData | null;
}

export const StudentNextStepCard: React.FC<StudentNextStepCardProps> = ({ next }) => {
  if (!next) return null;
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white"
      style={{
        background: "linear-gradient(135deg, #2A1A2A 0%, #203B73 55%, #2F6E5C 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -top-16 -right-12 h-[220px] w-[220px] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, #3CB88D 0%, transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative">
        <div className="font-mono text-[10.5px] uppercase tracking-[.14em] text-white/60">
          Próximo paso
        </div>
        <h4 className="font-bricolage text-[18px] font-semibold leading-[1.2] tracking-[-0.02em] text-white mt-2">
          {next.title}
        </h4>
        <p className="text-[12.5px] text-white/75 mt-1.5 leading-[1.4]">{next.subtitle}</p>
        <div className="mt-4 flex items-center gap-2 border-t border-white/15 pt-3 text-[12px]">
          <Icon name="cal" size={14} color="rgba(255,255,255,.85)" />
          <span className="text-white/85">{next.where}</span>
          {next.date && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-mono text-[10.5px] tracking-[.04em] text-white">
              <Icon name="clock" size={11} color="rgba(255,255,255,.9)" />
              {next.date}
              {next.time ? ` · ${next.time}` : ""}
            </span>
          )}
        </div>
        {next.ctaLabel && next.ctaHref && (
          <a
            href={next.ctaHref}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-white/90 hover:text-white"
          >
            {next.ctaLabel}
            <Icon name="arrow" size={12} strokeWidth={2.2} />
          </a>
        )}
      </div>
    </div>
  );
};

export default StudentNextStepCard;
