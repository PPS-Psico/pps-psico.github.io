// --- Environment Configuration ---
// NOTA: Estas credenciales están hardcodeadas para que el entorno de desarrollo y 'vite preview' funcionen.
// El script "npm run prep-github" buscará y reemplazará estos valores exactos antes del despliegue.

// Direct usage of import.meta.env for Vite to properly inline values during build
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.API_KEY || "";
