import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = "https://qxnxtnhtbpsgzprqtrjl.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bnh0bmh0YnBzZ3pwcnF0cmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjIzNDEsImV4cCI6MjA3OTAzODM0MX0.Lwj2kZPjYaM6M7VbUX48hSnCh3N2YB6iMJtdhFP9brU";
  const hermesToken = "8KqNm3vR7tYxL2pH9wJ4sZ6bF1cA5dG0eU8iO3kP4qX7vN2mL9";
  const hermesUrl = "https://pps-hermes.n8n-blas.com.ar/tasks/daily_brief";

  const sb = createClient(supabaseUrl, supabaseKey);

  console.log("Fetching signals from Supabase...");

  // 1. Solicitudes
  const { data: solicitudes, error: errSolis } = await sb
    .from("solicitudes_pps")
    .select("id,estudiante_id,nombre_alumno,nombre_institucion,estado_seguimiento,actualizacion,created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  if (errSolis) console.error("Error fetching solicitudes:", errSolis);

  // 2. Lanzamientos
  const { data: lanzamientos, error: errLanzs } = await sb
    .from("lanzamientos_pps")
    .select("id,nombre_pps,orientacion,fecha_inicio,fecha_finalizacion,estado_gestion,estado_convocatoria,cupos_disponibles,proximo_seguimiento")
    .neq("estado_gestion", "Archivado")
    .order("fecha_finalizacion", { ascending: true })
    .limit(30);
  if (errLanzs) console.error("Error fetching lanzamientos:", errLanzs);

  // 3. Gmail
  const { data: gmail, error: errGmail } = await sb
    .from("gmail_hilos")
    .select("thread_id,asunto,ultimo_mensaje_de,ultimo_mensaje_at,estado,clasificacion,institucion_id")
    .eq("estado", "esperando_respuesta")
    .order("ultimo_mensaje_at", { ascending: true })
    .limit(20);
  if (errGmail) console.error("Error fetching gmail hilos:", errGmail);

  // 4. WhatsApp
  const { data: whatsapp, error: errWA } = await sb
    .from("whatsapp_mensajes")
    .select("id,chat_jid,institucion_id,autor,texto,timestamp")
    .eq("from_me", false)
    .order("timestamp", { ascending: false })
    .limit(20);
  if (errWA) console.error("Error fetching whatsapp mensajes:", errWA);

  console.log("Filtering signals...");
  const now = new Date();
  const hoursSince = (iso) => (now - new Date(iso)) / 36e5;

  const solicitudes_pendientes = (solicitudes || [])
    .filter(s => hoursSince(s.created_at) > 48)
    .slice(0, 15);

  const lanzamientos_por_vencer = (lanzamientos || [])
    .filter(l => {
      if (!l.fecha_finalizacion) return false;
      const d = new Date(l.fecha_finalizacion);
      const diffDays = (d - now) / (1000 * 60 * 60 * 24);
      return diffDays >= -1 && diffDays <= 7;
    })
    .slice(0, 15);

  const payload = {
    solicitudes_pendientes,
    lanzamientos_por_vencer,
    instituciones_sin_contacto: [],
    gmail_sin_responder: gmail || [],
    whatsapp_pendientes: whatsapp || []
  };

  console.log("Payload summary:");
  console.log(`- Solicitudes pendientes (>48hs): ${solicitudes_pendientes.length}`);
  console.log(`- Lanzamientos por vencer (próximos 7 días): ${lanzamientos_por_vencer.length}`);
  console.log(`- Gmail sin responder: ${payload.gmail_sin_responder.length}`);
  console.log(`- WhatsApp pendientes: ${payload.whatsapp_pendientes.length}`);

  console.log("Calling Hermes Daily Brief endpoint...");
  try {
    const response = await fetch(hermesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hermes-Token": hermesToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Hermes API error (${response.status}): ${text}`);
    }

    const result = await response.json();
    console.log("Daily brief generated successfully!");
    console.log("Suggestion ID:", result.suggestion_id);
    console.log("Content:", JSON.stringify(result.content, null, 2));
  } catch (error) {
    console.error("Error triggering Hermes:", error);
  }
}

main().catch(console.error);
