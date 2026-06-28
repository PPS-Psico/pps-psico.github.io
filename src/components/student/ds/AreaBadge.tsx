import React from "react";

export type AreaName = "Clínica" | "Educacional" | "Laboral" | "Comunitaria";

const AREA_HEX: Record<AreaName, string> = {
  Clínica: "#3CB88D",
  Educacional: "#203B73",
  Laboral: "#C0392B",
  Comunitaria: "#7A3F9E",
};

export function getAreaColor(area: string | null | undefined): string {
  if (!area) return "#3CB88D";
  return AREA_HEX[area as AreaName] ?? "#3CB88D";
}

export function getAreaToneClass(area: string | null | undefined): string {
  const normalized = (area ?? "").toLowerCase();
  if (normalized.startsWith("cl")) return "text-area-clinica";
  if (normalized.startsWith("ed")) return "text-area-educacional";
  if (normalized.startsWith("la")) return "text-area-laboral";
  if (normalized.startsWith("co")) return "text-area-comunitaria";
  return "text-area-clinica";
}

interface AreaBadgeProps {
  area: string | null | undefined;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}

export const AreaBadge: React.FC<AreaBadgeProps> = ({
  area,
  size = "sm",
  showDot = true,
  className,
}) => {
  const color = getAreaColor(area);
  const fontSize = size === "md" ? 12 : 11;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color,
        fontSize,
        fontWeight: 600,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        fontFamily: '"Geist Mono", ui-monospace, monospace',
      }}
    >
      {showDot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: color,
            display: "inline-block",
          }}
        />
      )}
      {area || "General"}
    </span>
  );
};

export default AreaBadge;
