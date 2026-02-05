import React from "react";
import { adminTheme } from "../../../theme/adminTheme";

type CardVariant = "default" | "interactive" | "elevated";
type CardPadding = "none" | "sm" | "md" | "lg";

interface AdminCardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  onClick?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  default: `${adminTheme.card.default}`,
  interactive: `${adminTheme.card.default} ${adminTheme.card.interactive}`,
  elevated: `${adminTheme.card.default} shadow-md`,
};

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const AdminCard: React.FC<AdminCardProps> = ({
  children,
  variant = "default",
  padding = "md",
  className = "",
  onClick,
  header,
  footer,
}) => {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={`
        ${adminTheme.card.base}
        ${variantClasses[variant]}
        ${variant === "interactive" || variant === "elevated" ? adminTheme.card.hover : ""}
        ${className}
        ${onClick ? "text-left w-full" : ""}
      `}
    >
      {header && <div className={`${paddingClasses[padding]} pb-0`}>{header}</div>}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && (
        <div className={`${paddingClasses[padding]} pt-0 border-t ${adminTheme.border.default}`}>
          {footer}
        </div>
      )}
    </Component>
  );
};

export default AdminCard;
