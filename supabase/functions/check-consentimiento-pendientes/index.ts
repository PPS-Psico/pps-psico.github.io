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

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDetailRows(rows: { label: string; value: string }[]) {
  return rows
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; width: 34%; vertical-align: top;">
            <div style="font-family: ${fontStack}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b;">${escapeHtml(label)}</div>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
            <div style="font-family: ${fontStack}; font-size: 15px; line-height: 1.6; color: #0f172a; font-weight: 600;">${escapeHtml(value)}</div>
          </td>
        </tr>`
    )
    .join("");
}

function wrapEmailTemplate(bodyContent: string, accentColor = "#ea580c") {
  return `<!DOCTYPE html>
<html lang="es">
  <head><meta charset="utf-8" /></head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: ${fontStack};">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 40px 10px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px rgba(0,0,0,0.1);">
            <tr>
              <td style="background: linear-gradient(135deg, #00B2A9 0%, #1e40af 100%); padding: 32px 40px;">
                <div style="color: #ffffff; font-family: ${fontStack}; font-weight: 900; font-size: 28px;">UFLO</div>
                <div style="color: #ffffff; font-family: ${fontStack}; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.9;">Universidad</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px;">
                ${bodyContent}
                <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                  <p style="margin: 0 0 6px 0; color: #64748b; font-size: 14px; font-family: ${fontStack};">Saludos,</p>
                  <p style="margin: 4px 0; color: #0f172a; font-weight: 700; font-size: 16px; font-family: ${fontStack};">Coordinación de Prácticas Profesionales Supervisadas</p>
                  <p style="margin: 4px 0; color: #64748b; font-size: 13px; font-family: ${fontStack};">UFLO Universidad</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8; font-family: ${fontStack};"><strong>Facultad de Psicología y Ciencias Sociales</strong><br />Prácticas Profesionales Supervisadas<br />&copy; ${new Date().getFullYear()} Universidad de Flores</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildReminderHtml(estNombre: string, ppsNombre: string, hoursLeft: number) {
  const detailRows = buildDetailRows([
    { label: "Institución / PPS", value: ppsNombre },
    { label: "Horas restantes", value: hoursLeft + " horas" },
    { label: "Acción requerida", value: "Ingresar a Mi Panel y confirmar tu participación" },
  ]);

  const bodyContent = `
    <h1 style="margin: 0 0 18px 0; color: #0f172a; font-size: 24px; font-weight: 800; line-height: 1.25;">Recordatorio urgente: confirmá tu participación</h1>
    <p style="margin: 0 0 28px 0; color: #475569; font-family: ${fontStack}; font-size: 15px; line-height: 1.7;">Hola ${escapeHtml(estNombre)}, te recordamos que fuiste seleccionado/a para una Práctica Profesional Supervisada y aún no registraste tu aceptación digital del compromiso.</p>
    <div style="margin-bottom: 24px; border: 1px solid #dbeafe; border-radius: 12px; overflow: hidden; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);">
      <div style="padding: 14px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-family: ${fontStack}; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #1e3a8a;">Datos de tu asignación</div>
      <div style="padding: 0 20px 4px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">${detailRows}</table>
      </div>
    </div>
    <div style="margin-bottom: 24px; border-radius: 12px; padding: 22px 24px; background: linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%); border: 1px solid #fed7aa;">
      <div style="margin-bottom: 10px; font-family: ${fontStack}; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #c2410c;">Atención</div>
      <p style="margin: 0; color: #1e293b; font-family: ${fontStack}; font-size: 15px; line-height: 1.7;">Si no confirmás tu participación dentro del plazo restante, se dará de baja automáticamente tu asignación y la vacante será liberada.</p>
    </div>
    <div style="margin-bottom: 24px; text-align: center;">
      <a href="${panelUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); color: #ffffff; font-family: ${fontStack}; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; letter-spacing: 0.03em;">IR A MI PANEL</a>
    </div>
    <div style="margin-bottom: 24px; padding: 18px 20px; border-radius: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
      <div style="font-family: ${fontStack}; font-size: 13px; line-height: 1.7; color: #334155;">Si ya no podés realizar la PPS, comunicate con la Coordinación respondiendo este correo.</div>
    </div>`;
  return wrapEmailTemplate(bodyContent);
}

function buildBajaEstudianteHtml(estNombre: string, ppsNombre: string) {
  const detailRows = buildDetailRows([
    { label: "Institución / PPS", value: ppsNombre },
    { label: "Motivo", value: "Falta de confirmación digital dentro de las 24 horas" },
  ]);

  const bodyContent = `
    <h1 style="margin: 0 0 18px 0; color: #0f172a; font-size: 24px; font-weight: 800; line-height: 1.25;">Baja automática por falta de confirmación</h1>
    <p style="margin: 0 0 28px 0; color: #475569; font-family: ${fontStack}; font-size: 15px; line-height: 1.7;">Hola ${escapeHtml(estNombre)}, te informamos que se dio de baja automáticamente tu asignación a la Práctica Profesional Supervisada.</p>
    <div style="margin-bottom: 24px; border: 1px solid #dbeafe; border-radius: 12px; overflow: hidden; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);">
      <div style="padding: 14px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-family: ${fontStack}; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #1e3a8a;">Detalle de la baja</div>
      <div style="padding: 0 20px 4px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">${detailRows}</table>
      </div>
    </div>
    <div style="margin-bottom: 24px; border-radius: 12px; padding: 22px 24px; background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%); border: 1px solid #dbeafe;">
      <div style="margin-bottom: 10px; font-family: ${fontStack}; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #1e3a8a;">¿Esto fue un error?</div>
      <p style="margin: 0; color: #1e293b; font-family: ${fontStack}; font-size: 15px; line-height: 1.7;">Si esto fue un error o tenías una razón válida, comunicate con la Coordinación lo antes posible respondiendo este correo.</p>
    </div>`;
  return wrapEmailTemplate(bodyContent);
}

function buildBajaCoordinadorHtml(
  estNombre: string,
  estCorreo: string,
  ppsNombre: string,
  selectedAt: string,
  bajaAt: string,
  reminderEnviado: boolean
) {
  const detailRows = buildDetailRows([
    { label: "Estudiante", value: estNombre },
    { label: "Correo", value: estCorreo || "No disponible" },
    { label: "PPS", value: ppsNombre },
    { label: "Fecha de selección", value: selectedAt || "N/A" },
    { label: "Fecha de baja", value: bajaAt },
    { label: "Recordatorio enviado", value: reminderEnviado ? "Sí" : "No" },
  ]);

  const bodyContent = `
    <h1 style="margin: 0 0 18px 0; color: #0f172a; font-size: 24px; font-weight: 800; line-height: 1.25;">Baja automática de estudiante</h1>
    <p style="margin: 0 0 28px 0; color: #475569; font-family: ${fontStack}; font-size: 15px; line-height: 1.7;">Se dio de baja automáticamente a un estudiante por no confirmar el compromiso digital dentro del plazo de 24 horas. Se liberó la vacante.</p>
    <div style="margin-bottom: 24px; border: 1px solid #dbeafe; border-radius: 12px; overflow: hidden; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);">
      <div style="padding: 14px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-family: ${fontStack}; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #1e3a8a;">Datos del estudiante</div>
      <div style="padding: 0 20px 4px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">${detailRows}</table>
      </div>
    </div>
    <div style="margin-bottom: 24px; padding: 18px 20px; border-radius: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
      <div style="font-family: ${fontStack}; font-size: 13px; line-height: 1.7; color: #334155;">Considerá seleccionar un nuevo estudiante si corresponde.</div>
    </div>`;
  return wrapEmailTemplate(bodyContent);
}

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

    console.log(
      "[Consentimiento] 12h: " + (pending12h ? pending12h.length : 0) + " convocatorias candidatas"
    );

    if (pending12h && pending12h.length > 0) {
      for (const conv of pending12h) {
        const { data: compromiso, error: compErr } = await supabase
          .from("compromisos_pps")
          .select("id")
          .eq("convocatoria_id", conv.id)
          .eq("estado", "aceptado")
          .maybeSingle();

        if (compErr) {
          console.error(
            "[Consentimiento] Error verificando compromiso conv " + conv.id + ":",
            compErr
          );
        }

        if (compromiso) {
          console.log("[Consentimiento] 12h SKIP conv " + conv.id + ": compromiso ya aceptado");
          await supabase
            .from("convocatorias")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", conv.id);
          continue;
        }

        if (compErr) {
          console.error(
            "[Consentimiento] Error verificando compromiso conv " + conv.id + ", saltando:",
            compErr
          );
          continue;
        }

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
          ", te recordamos que fuiste seleccionado/a para la PPS en " +
          ppsNombre +
          ". Pasaron 12 horas y aun no confirmaste. Tenes 12 horas restantes para ingresar a Mi Panel y confirmar tu participacion.";
        const htmlBody = buildReminderHtml(estNombre, ppsNombre, 12);

        const sent = await sendEmail(supabase, estCorreo, subject, textBody, htmlBody, estNombre);

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

    console.log(
      "[Consentimiento] 24h: " + (pending24h ? pending24h.length : 0) + " convocatorias candidatas"
    );

    if (pending24h && pending24h.length > 0) {
      for (const conv of pending24h) {
        const { data: compromiso, error: compErr24 } = await supabase
          .from("compromisos_pps")
          .select("id")
          .eq("convocatoria_id", conv.id)
          .eq("estado", "aceptado")
          .maybeSingle();

        if (compromiso) {
          console.log("[Consentimiento] 24h SKIP conv " + conv.id + ": compromiso ya aceptado");
          await supabase
            .from("convocatorias")
            .update({ baja_automatica_at: new Date().toISOString() })
            .eq("id", conv.id);
          continue;
        }

        if (compErr24) {
          console.error(
            "[Consentimiento] Error verificando compromiso 24h conv " + conv.id + ", saltando:",
            compErr24
          );
          continue;
        }

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
            ", se dio de baja automaticamente tu asignacion a la PPS en " +
            ppsNombre +
            " porque no confirmaste el compromiso digital dentro de las 24 horas.";
          const htmlEst = buildBajaEstudianteHtml(estNombre, ppsNombre);
          await sendEmail(supabase, estCorreo, subjectEst, textEst, htmlEst, estNombre);
        }

        // Email al coordinador
        const subjectCoord = "Baja automatica de estudiante - PPS: " + ppsNombre;
        const textCoord =
          "Se dio de baja automaticamente a " +
          estNombre +
          " de " +
          ppsNombre +
          " por no confirmar el compromiso en 24 horas.";
        const htmlCoord = buildBajaCoordinadorHtml(
          estNombre,
          estCorreo || "",
          ppsNombre,
          conv.selected_at || "",
          isoNow,
          !!conv.reminder_sent_at
        );
        await sendEmail(
          supabase,
          COORDINADOR_EMAIL,
          subjectCoord,
          textCoord,
          htmlCoord,
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
