import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COORDINADOR_EMAIL = "blas.rivera@uflouniversidad.edu.ar";
const COORDINADOR_NOMBRE = "Blas Rivera";
const APP_URL = (Deno.env.get("APP_URL") || "https://pps-psico.github.io").replace(/\/$/, "");
const panelUrl = APP_URL + "/#/student";

async function sendEmail(
  supabase: any,
  to: string,
  subject: string,
  text: string,
  html: string,
  name: string
) {
  const { error } = await supabase.functions.invoke("send-email", {
    body: { to, subject, text, html, name },
  });
  if (error) {
    console.error("[Consentimiento] Error enviando email a " + to + ":", error);
  }
  return !error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const now = new Date();
    const isoNow = now.toISOString();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    console.log("[Consentimiento] Ejecutando verificacion en " + isoNow + "...");
    const results = { reminders_sent: 0, bajas_processed: 0, errors: [] as string[] };

    // PASO 1: Recordatorio a las 12hs
    const { data: pending12h, error: err12 } = await supabase
      .from("convocatorias")
      .select(
        "id, estudiante_id, lanzamiento_id, nombre_pps, correo, selected_at, reminder_sent_at"
      )
      .eq("estado_inscripcion", "Seleccionado")
      .not("selected_at", "is", null)
      .lt("selected_at", twelveHoursAgo)
      .gt("selected_at", twentyFourHoursAgo)
      .is("reminder_sent_at", null)
      .is("baja_automatica_at", null);

    if (err12) {
      console.error("[Consentimiento] Error 12h:", err12);
      results.errors.push("Error 12h: " + err12.message);
    }

    if (pending12h && pending12h.length > 0) {
      for (const conv of pending12h) {
        const { data: compromiso } = await supabase
          .from("compromisos_pps")
          .select("id")
          .eq("convocatoria_id", conv.id)
          .eq("estado", "aceptado")
          .maybeSingle();

        if (compromiso) continue;

        const { data: est12 } = await supabase
          .from("estudiantes")
          .select("nombre, correo")
          .eq("id", conv.estudiante_id)
          .maybeSingle();

        const estNombre = est12 && est12.nombre ? est12.nombre : "Estudiante";
        const estCorreo = conv.correo || (est12 && est12.correo) || "";

        if (!estCorreo) {
          results.errors.push("Sin correo: conv " + conv.id);
          continue;
        }

        const ppsNombre = conv.nombre_pps || "PPS";
        const subject = "Recordatorio urgente: Tenes 12 horas para confirmar tu PPS";
        const textBody =
          "Hola " +
          estNombre +
          ",\n\nTe recordamos que fuiste seleccionado/a para la Practica Profesional Supervisada en:\nInstitucion: " +
          ppsNombre +
          "\n\nPasaron 12 horas desde tu seleccion y aun no registraste tu aceptacion digital del compromiso.\n\nTenes 12 horas restantes para ingresar a Mi Panel y confirmar tu participacion.\nSi no confirmas en ese plazo, se dara de baja automaticamente tu asignacion.\n\nSi ya no podes realizar la PPS, comunicate con la Coordinacion respondiendo este correo.\n\nSaludos,\n\nBlas\nCoordinador de Practicas Profesionales Supervisadas\nLicenciatura en Psicologia - UFLO";

        const sent = await sendEmail(supabase, estCorreo, subject, textBody, "", estNombre);

        if (sent) {
          await supabase
            .from("convocatorias")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", conv.id);
          results.reminders_sent++;
          console.log("[Consentimiento] Reminder enviado a " + estCorreo);
        }
      }
    }

    // PASO 2: Baja automatica a las 24hs
    const { data: pending24h, error: err24 } = await supabase
      .from("convocatorias")
      .select(
        "id, estudiante_id, lanzamiento_id, nombre_pps, correo, selected_at, reminder_sent_at"
      )
      .eq("estado_inscripcion", "Seleccionado")
      .not("selected_at", "is", null)
      .lt("selected_at", twentyFourHoursAgo)
      .is("baja_automatica_at", null);

    if (err24) {
      console.error("[Consentimiento] Error 24h:", err24);
      results.errors.push("Error 24h: " + err24.message);
    }

    if (pending24h && pending24h.length > 0) {
      for (const conv of pending24h) {
        const { data: compromiso } = await supabase
          .from("compromisos_pps")
          .select("id")
          .eq("convocatoria_id", conv.id)
          .eq("estado", "aceptado")
          .maybeSingle();

        if (compromiso) continue;

        const { data: est24 } = await supabase
          .from("estudiantes")
          .select("nombre, correo")
          .eq("id", conv.estudiante_id)
          .maybeSingle();

        const estNombre = est24 && est24.nombre ? est24.nombre : "Estudiante";
        const estCorreo = conv.correo || (est24 && est24.correo) || "";
        const ppsNombre = conv.nombre_pps || "PPS";

        // Revertir estado
        const { error: updErr } = await supabase
          .from("convocatorias")
          .update({
            estado_inscripcion: "Inscripto",
            baja_automatica_at: new Date().toISOString(),
          })
          .eq("id", conv.id);

        if (updErr) {
          console.error("[Consentimiento] Error baja conv " + conv.id + ":", updErr);
          results.errors.push("Error baja conv " + conv.id + ": " + updErr.message);
          continue;
        }

        // Eliminar practica asociada
        await supabase
          .from("practicas")
          .delete()
          .eq("estudiante_id", conv.estudiante_id)
          .eq("lanzamiento_id", conv.lanzamiento_id);

        // Email al estudiante
        if (estCorreo) {
          const subjectEst = "Baja automatica por falta de confirmacion - PPS: " + ppsNombre;
          const textEst =
            "Hola " +
            estNombre +
            ",\n\nTe informamos que se dio de baja automaticamente tu asignacion a la Practica Profesional Supervisada en:\nInstitucion: " +
            ppsNombre +
            "\n\nEsto ocurrio porque no se registro la aceptacion digital del compromiso dentro del plazo de 24 horas desde tu seleccion.\n\nSi esto fue un error o tenias una razon valida, comunicate con la Coordinacion lo antes posible.\n\nSaludos,\n\nBlas\nCoordinador de Practicas Profesionales Supervisadas\nLicenciatura en Psicologia - UFLO";
          await sendEmail(supabase, estCorreo, subjectEst, textEst, "", estNombre);
        }

        // Email al coordinador
        const subjectCoord = "Baja automatica de estudiante - PPS: " + ppsNombre;
        const textCoord =
          "Se dio de baja automaticamente a un estudiante por no confirmar el compromiso digital dentro del plazo de 24 horas.\n\nEstudiante: " +
          estNombre +
          "\nCorreo: " +
          (estCorreo || "No disponible") +
          "\nPPS: " +
          ppsNombre +
          "\nFecha de seleccion: " +
          (conv.selected_at || "N/A") +
          "\nFecha de baja: " +
          isoNow +
          "\nRecordatorio enviado: " +
          (conv.reminder_sent_at ? "Si" : "No") +
          "\n\nSe libero la vacante. Considera seleccionar un nuevo estudiante si corresponde.";
        await sendEmail(
          supabase,
          COORDINADOR_EMAIL,
          subjectCoord,
          textCoord,
          "",
          COORDINADOR_NOMBRE
        );

        results.bajas_processed++;
        console.log("[Consentimiento] Baja automatica: " + estNombre + " de " + ppsNombre);
      }
    }

    console.log(
      "[Consentimiento] Completado: " +
        results.reminders_sent +
        " reminders, " +
        results.bajas_processed +
        " bajas"
    );

    return new Response(JSON.stringify({ success: true, ...results, time: isoNow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Consentimiento] Global Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
