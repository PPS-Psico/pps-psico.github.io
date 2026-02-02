// --- Environment Configuration ---
// TEMPORAL: Hardcodeo las credenciales para producción
// TODO: Resolver problema con variables de entorno en GitHub Actions

const SUPABASE_URL_VALUE = "https://qxnxtnhtbpsgzprqtrjl.supabase.co";
const SUPABASE_ANON_KEY_VALUE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bnh0bmh0YnBzZ3pwcnF0cmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjIzNDEsImV4cCI6MjA3OTAzODM0MX0.Lwj2kZPjYaM6M7VbUX48hSnCh3N2YB6iMJtdhFP9brU";

// Debug logging
console.log("=== SUPABASE CREDENTIALS DEBUG ===");
console.log("Full SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY_VALUE);
console.log("First 50 chars:", SUPABASE_ANON_KEY_VALUE.substring(0, 50));
console.log("================================");

export const SUPABASE_URL = SUPABASE_URL_VALUE;
export const SUPABASE_ANON_KEY = SUPABASE_ANON_KEY_VALUE;

// Test function to verify Supabase connection
export const testSupabaseConnection = async () => {
  console.log("=== TESTING SUPABASE CONNECTION ===");
  try {
    const response = await fetch(`${SUPABASE_URL_VALUE}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY_VALUE,
        "Content-Type": "application/json",
      },
    });
    const status = response.status;
    console.log("Supabase API Status:", status);
    if (status === 200) {
      console.log("✅ SUCCESS: Supabase connection is valid!");
      return { success: true, status };
    } else if (status === 401) {
      console.log("❌ ERROR: Invalid API Key");
      return { success: false, status, error: "Invalid API Key" };
    } else {
      console.log(`❌ ERROR: Unexpected status ${status}`);
      return { success: false, status, error: `Status ${status}` };
    }
  } catch (error: any) {
    console.error("❌ ERROR: Connection failed", error);
    return { success: false, error: error.message };
  }
};

export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
