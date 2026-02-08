/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_AIRTABLE_PAT?: string;
  readonly VITE_AIRTABLE_BASE_ID?: string;
  readonly VITE_ONESIGNAL_APP_ID?: string;
  readonly VITE_ONESIGNAL_SAFARI_WEB_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
