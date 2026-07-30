import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "app-button--primary",
  secondary: "app-button--secondary",
  danger: "app-button--danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "app-button--sm",
  md: "app-button--md",
  lg: "app-button--lg",
};

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  isLoading = false,
  disabled,
  className,
  "aria-busy": ariaBusy,
  ...props
}) => {
  const finalClassName = ["app-button", variantClasses[variant], sizeClasses[size], className]
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
      className={finalClassName}
      disabled={disabled || isLoading}
      {...props}
      aria-busy={isLoading ? true : ariaBusy}
    >
      {isLoading ? (
        <>
          <span className="app-button__spinner" aria-hidden="true" />
          <span>Cargando...</span>
        </>
      ) : (
        <>
          {iconPosition === "left" && iconMarkup}
          {children}
          {iconPosition === "right" && iconMarkup}
        </>
      )}
    </button>
  );
};

export default Button;
