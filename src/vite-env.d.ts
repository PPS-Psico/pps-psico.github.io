/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_ENABLE_MONITORING_IN_DEV?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_ONESIGNAL_APP_ID?: string;
  readonly VITE_ONESIGNAL_SAFARI_WEB_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
