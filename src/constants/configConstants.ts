
// --- Supabase Configuration ---
// IMPORTANTE: No modificar manualmente estos valores si vas a usar 'npm run prep-github'
export const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

// --- Google Gemini AI ---
export const GEMINI_API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
