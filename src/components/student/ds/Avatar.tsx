import React from "react";

type AvatarTone = "teal" | "navy" | "purple" | "amber";

interface AvatarProps {
  initials: string;
  tone?: AvatarTone;
  size?: number;
  className?: string;
}

const TONE_BG: Record<AvatarTone, { bg: string; fg: string }> = {
  teal: { bg: "rgba(60,184,141,.18)", fg: "#2F9C76" },
  navy: { bg: "rgba(32,59,115,.16)", fg: "#203B73" },
  purple: { bg: "rgba(122,63,158,.18)", fg: "#7A3F9E" },
  amber: { bg: "rgba(183,119,11,.18)", fg: "#B7770B" },
};

export const Avatar: React.FC<AvatarProps> = ({
  initials,
  tone = "teal",
  size = 32,
  className,
}) => {
  const { bg, fg } = TONE_BG[tone];
  return (
    <span
      className={className}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        background: bg,
        color: fg,
        borderRadius: "50%",
        fontFamily: '"Geist Mono", ui-monospace, monospace',
        fontSize: size * 0.36,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: ".02em",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
};

export default Avatar;
