import React from "react";
import { adminTheme, getStatusClasses } from "../../../theme/adminTheme";

type StatusType = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  dot?: boolean;
}

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  className = "",
  size = "md",
  dot = false,
}) => {
  const classes = getStatusClasses(status);

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-semibold rounded-full border
        ${sizeClasses[size]}
        ${classes.badge}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${adminTheme.status[status].icon} ${adminTheme.status[status].iconDark}`}
        />
      )}
      {children}
    </span>
  );
};

export default StatusBadge;
