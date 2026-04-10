export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export const testSupabaseConnection = async () => {
  console.log("=== TESTING SUPABASE CONNECTION ===");
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log("❌ ERROR: Missing Supabase URL or Anon Key");
      return { success: false, error: "Missing configuration" };
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/estudiantes?select=id&limit=1`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const status = response.status;
    if (status === 200 || status === 206) {
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
