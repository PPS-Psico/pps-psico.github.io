// Google Analytics 4 Configuration
import ReactGA from "react-ga4";

// Get GA4 Measurement ID from environment variables
const GA4_MEASUREMENT_ID = process.env.VITE_GA4_MEASUREMENT_ID || "G-XXXXXXXXXX";

// Initialize Google Analytics
export const initGA4 = () => {
  if (process.env.PROD && GA4_MEASUREMENT_ID !== "G-XXXXXXXXXX") {
    ReactGA.initialize(GA4_MEASUREMENT_ID, {
      // Enable debug mode in development
      gaOptions: {
        debug_mode: !process.env.PROD,
      },
    });

    console.log("✅ Google Analytics 4 initialized");
  }
};

// Track page views
export const trackPageView = (path: string, title?: string) => {
  if (process.env.PROD) {
    ReactGA.send({
      hitType: "pageview",
      page: path,
      title: title || document.title,
    });
  }
};

// Track custom events
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (process.env.PROD) {
    ReactGA.event({
      action,
      category,
      label,
      value,
    });
  }
};

// Academic-specific tracking functions
export const trackAcademicEvents = {
  // Student registration
  studentRegistration: (studentData: { legajo: string; orientation: string }) => {
    trackEvent(
      "student_registered",
      "academic",
      `${studentData.legajo} - ${studentData.orientation}`
    );
  },

  // Practice submission
  practiceSubmission: (practiceData: { hours: number; institution: string; type: string }) => {
    trackEvent(
      "practice_submitted",
      "academic",
      `${practiceData.institution} - ${practiceData.type}`,
      practiceData.hours
    );
  },

  // Convocatoria application
  convocatoriaApplication: (convocatoriaData: { name: string; orientation: string }) => {
    trackEvent(
      "convocatoria_applied",
      "academic",
      `${convocatoriaData.name} - ${convocatoriaData.orientation}`
    );
  },

  // Report submission
  reportSubmission: (reportData: { type: string; practiceId: string }) => {
    trackEvent("report_submitted", "academic", `${reportData.type} - ${reportData.practiceId}`);
  },

  // Login events
  login: (userRole: string) => {
    trackEvent("user_login", "authentication", userRole);
  },

  // Logout events
  logout: (userRole: string) => {
    trackEvent("user_logout", "authentication", userRole);
  },

  // Feature usage
  featureUsed: (featureName: string, context?: string) => {
    trackEvent("feature_used", "engagement", context ? `${featureName} - ${context}` : featureName);
  },

  // Error tracking (non-critical)
  errorOccurred: (errorType: string, context: string) => {
    trackEvent("error_occurred", "error", `${errorType} - ${context}`);
  },

  // Performance metrics
  performanceMetric: (metricName: string, value: number) => {
    trackEvent("performance_metric", "performance", metricName, value);
  },
};

// E-commerce style tracking for academic "conversions"
export const trackAcademicConversion = {
  // Track practice completion as a conversion
  practiceCompletion: (practiceData: { hours: number; institution: string; studentId: string }) => {
    ReactGA.gtag("event", "conversion", {
      send_to: GA4_MEASUREMENT_ID,
      value: practiceData.hours, // Use hours as "value"
      currency: "HRS", // Custom currency for hours
      transaction_id: `practice_${practiceData.studentId}_${Date.now()}`,
    });
  },

  // Track student registration as a conversion
  studentRegistrationConversion: (studentData: { legajo: string; orientation: string }) => {
    ReactGA.gtag("event", "conversion", {
      send_to: GA4_MEASUREMENT_ID,
      value: 1,
      currency: "STU",
      transaction_id: `student_${studentData.legajo}_${Date.now()}`,
    });
  },
};

// Custom dimensions for academic tracking
export const setCustomDimensions = (userData: {
  role?: string;
  orientation?: string;
  legajo?: string;
}) => {
  if (process.env.PROD) {
    // Set custom dimensions for better segmentation
    ReactGA.gtag("config", GA4_MEASUREMENT_ID, {
      custom_map: {
        dimension1: "user_role",
        dimension2: "student_orientation",
        dimension3: "student_legajo",
      },
    });

    // Set custom dimension values
    if (userData.role) {
      ReactGA.gtag("event", "user_role_dimension", { user_role: userData.role });
    }
    if (userData.orientation) {
      ReactGA.gtag("event", "student_orientation_dimension", {
        student_orientation: userData.orientation,
      });
    }
    if (userData.legajo) {
      ReactGA.gtag("event", "student_legajo_dimension", { student_legajo: userData.legajo });
    }
  }
};
