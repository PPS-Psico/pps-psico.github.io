import React from "react";

export type ChipTone = "ok" | "wait" | "info" | "warn" | "accent" | "neutral";

interface ChipProps {
  children: React.ReactNode;
  tone?: ChipTone;
  className?: string;
}

const TONE_CLS: Record<ChipTone, string> = {
  ok: "bg-[rgba(60,184,141,.14)] text-area-clinica",
  wait: "bg-[rgba(183,119,11,.14)] text-area-laboral",
  info: "bg-[rgba(122,63,158,.14)] text-area-comunitaria",
  warn: "bg-[rgba(180,80,30,.14)] text-status-warn",
  accent: "bg-uflo-teal/10 text-uflo-teal",
  neutral: "bg-student-bg-sunken text-student-ink-muted",
};

export const Chip: React.FC<ChipProps> = ({ children, tone = "neutral", className }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold tracking-[.02em] ${TONE_CLS[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
};

export default Chip;
