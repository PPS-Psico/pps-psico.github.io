import React from "react";

export type AreaName = "Clínica" | "Educacional" | "Laboral" | "Comunitaria";

export function getAreaColor(area: string | null | undefined): string {
  const normalized = (area ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

  if (normalized.startsWith("ed")) return "var(--area-educacional, #203B73)";
  if (normalized.startsWith("la") || normalized.startsWith("tr"))
    return "var(--area-laboral, #b4502a)";
  if (normalized.startsWith("co") || normalized.startsWith("so")) {
    return "var(--area-comunitaria, #7A3F9E)";
  }
  return "var(--area-clinica, #3CB88D)";
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
