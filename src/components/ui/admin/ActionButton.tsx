import React from "react";
import { adminTheme } from "../../../theme/adminTheme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ActionButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: "left" | "right";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  title?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: adminTheme.button.primary,
  secondary: adminTheme.button.secondary,
  ghost: adminTheme.button.ghost,
  danger: adminTheme.button.danger,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  icon,
  iconPosition = "left",
  disabled = false,
  loading = false,
  className = "",
  type = "button",
  title,
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    font-medium rounded-lg
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50
  `;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {!loading && icon && iconPosition === "left" && (
        <span className="material-icons text-base">{icon}</span>
      )}
      {children}
      {!loading && icon && iconPosition === "right" && (
        <span className="material-icons text-base">{icon}</span>
      )}
    </button>
  );
};

export default ActionButton;
