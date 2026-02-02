import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, testSupabaseConnection } from "../constants";
import { Database } from "../types/supabase";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase URL and Anon Key must be provided in src/constants.ts");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

export { testSupabaseConnection };
