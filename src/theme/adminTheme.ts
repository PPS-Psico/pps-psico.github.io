// Sistema de diseño consistente para el panel de administración

export const adminTheme = {
  // Colores de estado
  status: {
    success: {
      light: "#10b981",
      dark: "#34d399",
      bg: "bg-emerald-50",
      bgDark: "dark:bg-emerald-900/30",
      border: "border-emerald-200",
      borderDark: "dark:border-emerald-800",
      text: "text-emerald-700",
      textDark: "dark:text-emerald-300",
      icon: "text-emerald-600",
      iconDark: "dark:text-emerald-400",
    },
    warning: {
      light: "#f59e0b",
      dark: "#fbbf24",
      bg: "bg-amber-50",
      bgDark: "dark:bg-amber-900/30",
      border: "border-amber-200",
      borderDark: "dark:border-amber-800",
      text: "text-amber-700",
      textDark: "dark:text-amber-300",
      icon: "text-amber-600",
      iconDark: "dark:text-amber-400",
    },
    error: {
      light: "#ef4444",
      dark: "#f87171",
      bg: "bg-rose-50",
      bgDark: "dark:bg-rose-900/30",
      border: "border-rose-200",
      borderDark: "dark:border-rose-800",
      text: "text-rose-700",
      textDark: "dark:text-rose-300",
      icon: "text-rose-600",
      iconDark: "dark:text-rose-400",
    },
    info: {
      light: "#3b82f6",
      dark: "#60a5fa",
      bg: "bg-blue-50",
      bgDark: "dark:bg-blue-900/30",
      border: "border-blue-200",
      borderDark: "dark:border-blue-800",
      text: "text-blue-700",
      textDark: "dark:text-blue-300",
      icon: "text-blue-600",
      iconDark: "dark:text-blue-400",
    },
    neutral: {
      light: "#64748b",
      dark: "#94a3b8",
      bg: "bg-slate-50",
      bgDark: "dark:bg-slate-800",
      border: "border-slate-200",
      borderDark: "dark:border-slate-700",
      text: "text-slate-700",
      textDark: "dark:text-slate-300",
      icon: "text-slate-600",
      iconDark: "dark:text-slate-400",
    },
  },

  // Fondos
  background: {
    primary: "bg-white dark:bg-slate-900",
    secondary: "bg-slate-50 dark:bg-slate-800",
    tertiary: "bg-slate-100 dark:bg-slate-700",
    elevated: "bg-white dark:bg-slate-800 shadow-sm",
  },

  // Bordes
  border: {
    default: "border-slate-200 dark:border-slate-700",
    hover: "hover:border-slate-300 dark:hover:border-slate-600",
    focus: "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
  },

  // Texto
  text: {
    primary: "text-slate-900 dark:text-slate-100",
    secondary: "text-slate-700 dark:text-slate-300",
    muted: "text-slate-500 dark:text-slate-400",
    disabled: "text-slate-400 dark:text-slate-500",
  },

  // Botones
  button: {
    primary:
      "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:text-slate-500",
    secondary:
      "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700",
    ghost: "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
    danger: "bg-rose-600 hover:bg-rose-700 text-white",
  },

  // Inputs
  input: {
    base: "w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400",
    focus: "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
    error: "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20",
  },

  // Cards
  card: {
    base: "rounded-xl border transition-all duration-200",
    default: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    hover: "hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600",
    interactive: "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
  },

  // Sombras
  shadow: {
    sm: "shadow-sm",
    DEFAULT: "shadow",
    md: "shadow-md",
    lg: "shadow-lg",
    xl: "shadow-xl",
  },

  // Espaciado
  spacing: {
    xs: "0.5rem", // 8px
    sm: "0.75rem", // 12px
    md: "1rem", // 16px
    lg: "1.5rem", // 24px
    xl: "2rem", // 32px
  },

  // Bordes redondeados
  radius: {
    sm: "rounded",
    DEFAULT: "rounded-lg",
    md: "rounded-xl",
    lg: "rounded-2xl",
    full: "rounded-full",
  },
};

// Helper para obtener clases de estado
export const getStatusClasses = (status: "success" | "warning" | "error" | "info" | "neutral") => {
  const theme = adminTheme.status[status];
  return {
    badge: `${theme.bg} ${theme.bgDark} ${theme.border} ${theme.borderDark} ${theme.text} ${theme.textDark}`,
    icon: `${theme.icon} ${theme.iconDark}`,
    border: `${theme.border} ${theme.borderDark}`,
  };
};

export default adminTheme;
