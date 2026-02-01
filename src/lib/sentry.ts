// Sentry Configuration for Error Tracking and Performance Monitoring
import * as Sentry from "@sentry/react";

// Get DSN from environment variables
const SENTRY_DSN = process.env.VITE_SENTRY_DSN || "https://your-dsn@sentry.io/project-id";

// Initialize Sentry
export const initSentry = () => {
  if (process.env.PROD) {
    Sentry.init({
      dsn: SENTRY_DSN,

      // Set traces sample rate to capture 10% of transactions
      tracesSampleRate: 0.1,

      // Environment
      environment: process.env.MODE,

      // Release version
      release: `consulta-pps-uflo@${process.env.VITE_APP_VERSION || "1.0.0"}`,

      // Before send hook to filter errors
      beforeSend(event) {
        // Filter out certain errors
        if (event.exception) {
          const error = event.exception.values?.[0];

          // Ignore network errors that are not critical
          if (error?.value?.includes("fetch") || error?.value?.includes("NetworkError")) {
            return null;
          }

          // Ignore Chrome extension errors
          if (event.message?.includes("chrome-extension://")) {
            return null;
          }
        }

        return event;
      },

      // Custom tags for better filtering
      initialScope: {
        tags: {
          application: "consulta-pps-uflo",
          platform: "web",
          university: "uflo",
        },
      },
    });
  }
};

// Custom error tracking functions
export const trackError = (error: Error, context?: any) => {
  console.error("Tracking error:", error);

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("custom_context", context);
    }

    // Add user context if available
    const user = getCurrentUser();
    if (user) {
      scope.setUser({
        id: user.legajo || "unknown",
        email: user.correo || "unknown",
        username: user.nombre || "unknown",
        role: user.role || "unknown",
      });
    }

    Sentry.captureException(error);
  });
};

// Track custom messages
export const trackMessage = (message: string, level: Sentry.SeverityLevel = "info") => {
  Sentry.captureMessage(message, level);
};

// Track academic events
export const trackAcademicEvent = (eventName: string, data: any) => {
  Sentry.addBreadcrumb({
    message: `Academic Event: ${eventName}`,
    category: "academic",
    level: "info",
    data,
  });
};

// Performance tracking
export const trackPerformance = (operation: string, duration: number, context?: any) => {
  Sentry.addBreadcrumb({
    message: `Performance: ${operation}`,
    category: "performance",
    level: "info",
    data: { duration, ...context },
  });
};

// Define user interface for type safety
interface CurrentUser {
  legajo?: string;
  correo?: string;
  nombre?: string;
  role?: string;
}

// Helper function to get current user (to be implemented based on your auth context)
const getCurrentUser = (): CurrentUser | null => {
  // This should be implemented based on your auth context
  // For now, return null
  return null;
};

// Export Sentry components for easy use
export { Sentry };
