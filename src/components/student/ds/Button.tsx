import React from "react";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "ink" | "ghost" | "brand" | "soft" | "area";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: "left" | "right";
  areaColor?: string;
  block?: boolean;
}

const SIZE_CLS: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-11 px-5 text-[14px] gap-2 rounded-[12px]",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-[14px]",
};

const VARIANT_CLS: Record<ButtonVariant, string> = {
  ink: "bg-student-ink text-white hover:bg-black focus-visible:ring-student-ink/30",
  ghost:
    "bg-transparent text-student-ink border border-student-line-strong hover:bg-student-bg-sunken focus-visible:ring-student-ink/20",
  brand: "bg-uflo-teal text-[#04221A] hover:bg-uflo-aqua focus-visible:ring-uflo-teal/30",
  soft: "bg-student-bg-sunken text-student-ink hover:bg-student-line focus-visible:ring-student-ink/20",
  area: "text-white hover:opacity-90 focus-visible:ring-white/30",
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "ink",
  size = "md",
  icon,
  iconPosition = "right",
  areaColor,
  block = false,
  className,
  style,
  ...rest
}) => {
  const base =
    "inline-flex items-center justify-center font-medium transition-all duration-150 ease-spring focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-student-bg disabled:opacity-50 disabled:cursor-not-allowed";
  const blockCls = block ? "w-full" : "";
  const areaStyle = variant === "area" && areaColor ? { ...style, background: areaColor } : style;
  return (
    <button
      className={`${base} ${SIZE_CLS[size]} ${VARIANT_CLS[variant]} ${blockCls} ${className ?? ""}`}
      style={areaStyle}
      {...rest}
    >
      {icon && iconPosition === "left" && (
        <Icon name={icon} size={size === "lg" ? 17 : 15} strokeWidth={2.1} />
      )}
      {children}
      {icon && iconPosition === "right" && (
        <Icon name={icon} size={size === "lg" ? 17 : 15} strokeWidth={2.2} />
      )}
    </button>
  );
};

export default Button;
