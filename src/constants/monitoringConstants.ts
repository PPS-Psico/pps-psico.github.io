// Environment Variables for Monitoring and Analytics

// Sentry Configuration
export const SENTRY_DSN = process.env.VITE_SENTRY_DSN || "";
export const SENTRY_ENVIRONMENT = process.env.MODE || "development";

// Google Analytics 4 Configuration
export const GA4_MEASUREMENT_ID = process.env.VITE_GA4_MEASUREMENT_ID || "";
export const GA4_ENABLED = Boolean(GA4_MEASUREMENT_ID && GA4_MEASUREMENT_ID !== "G-XXXXXXXXXX");

// Application Version
export const APP_VERSION = process.env.VITE_APP_VERSION || "1.0.0";

// Monitoring Flags
export const MONITORING_ENABLED = process.env.PROD;
export const DEBUG_MODE = process.env.DEV;

// Feature Flags
export const FEATURES = {
  ERROR_TRACKING: MONITORING_ENABLED && Boolean(SENTRY_DSN),
  ANALYTICS: MONITORING_ENABLED && GA4_ENABLED,
  PERFORMANCE_MONITORING: MONITORING_ENABLED,
  HEALTH_CHECKS: MONITORING_ENABLED,
  WEB_VITALS: MONITORING_ENABLED,
};
