import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const adminAccessToken = process.env.SUPABASE_ADMIN_ACCESS_TOKEN;

if (!supabaseUrl || !publishableKey || !adminAccessToken) {
  throw new Error(
    "Definí SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y SUPABASE_ADMIN_ACCESS_TOKEN para ejecutar el smoke."
  );
}

const supabase = createClient(supabaseUrl, publishableKey, {
  global: { headers: { Authorization: `Bearer ${adminAccessToken}` } },
});

const { data, error } = await supabase.functions.invoke("send-fcm-notification", {
  body: {
    title: "Prueba de notificación",
    body: "Notificación de prueba desde el smoke administrativo.",
    type: "test",
    send_to_all: true,
  },
});

if (error) throw error;
console.log(data);
