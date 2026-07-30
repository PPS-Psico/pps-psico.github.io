import React from "react";

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
  primary: "app-button--primary",
  secondary: "app-button--secondary",
  ghost: "app-button--ghost",
  danger: "app-button--danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "app-button--sm",
  md: "app-button--md",
  lg: "app-button--lg",
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
  const finalClassName = [
    "app-button",
    "app-action-button",
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconMarkup = icon && (
    <span
      className={`material-icons app-button__icon app-button__icon--${size}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={finalClassName}
      aria-busy={loading || undefined}
    >
      {loading && <span className="app-button__spinner" aria-hidden="true" />}
      {!loading && iconPosition === "left" && iconMarkup}
      {children}
      {!loading && iconPosition === "right" && iconMarkup}
    </button>
  );
};

export default ActionButton;
