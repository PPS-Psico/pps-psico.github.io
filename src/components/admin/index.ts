// Exportaciones organizadas de componentes admin

// Preview components
export * from "./preview";

// UI Components
export * from "../ui/admin";

// Search and Filter
export * from "./SearchAndFilter";

// Error Boundary
export { AdminErrorBoundary } from "./AdminErrorBoundary";

// Main Admin Components (mantener compatibilidad)
export { default as AdminDashboard } from "./AdminDashboard";
export { default as SolicitudesManager } from "./SolicitudesManager";
export { default as FinalizacionReview } from "./FinalizacionReview";
export { default as GestionCard } from "./GestionCard";
export { default as ConvocatoriaManager } from "./ConvocatoriaManager";
