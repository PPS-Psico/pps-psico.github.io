// --- Environment Configuration ---
// TEMPORAL: Hardcodeo las credenciales para producción
// TODO: Resolver problema con variables de entorno en GitHub Actions

export const SUPABASE_URL = "https://qxnxtnhtbpsgzprqtrjl.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bnh0bmh0YnBzZ3pwcnF0cmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjIzNDEsImV4cCI6MjA3OTAzODM0MX0.Lwj2kZPjYaM6M7VbUX48hSnCh3N2YB6iMJtdhFP9brU";
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
