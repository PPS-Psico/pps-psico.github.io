import { supabase } from "../lib/supabaseClient";
import { KEY_EMAIL_COUNT, KEY_EMAIL_MONTH } from "../constants";

type EmailScenario = "seleccion" | "solicitud" | "sac";

const DEFAULT_TEMPLATES: Record<EmailScenario, { subject: string; body: string }> = {
  seleccion: {
    subject: "Confirmación de Asignación PPS: {{nombre_pps}} 🎓",
    body: `Hola {{nombre_alumno}},
Nos complace informarte que has sido seleccionado/a para realizar tu Práctica Profesional Supervisada en:
Institución: {{nombre_pps}}
Horario/Comisión asignada: {{horario}}
{{encuentro_inicial}}`,
  },
  solicitud: {
    subject: "Actualización de tu Solicitud de PPS - UFLO",
    body: `Hola {{nombre_alumno}},
Hay novedades sobre tu solicitud de PPS en "{{institucion}}".
Nuevo Estado: {{estado_nuevo}}`,
  },
  sac: {
    subject: "Acreditación de Prácticas en SAC ✅",
    body: `Hola {{nombre_alumno}},
Queremos avisarte que tus horas de la PPS "{{nombre_pps}}" fueron acreditadas correctamente y ya podés visualizarlas en el sistema SAC.`,
  },
};

interface EmailData {
  studentName: string;
  studentEmail: string;
  ppsName?: string;
  schedule?: string;
  institution?: string;
  newState?: string;
  notes?: string;
  encuentroInicial?: string; // NEW: Fecha de encuentro inicial
}

const incrementCounter = () => {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const storedMonthKey = localStorage.getItem(KEY_EMAIL_MONTH);
  let currentCount = 0;

  if (storedMonthKey === currentMonthKey) {
    currentCount = parseInt(localStorage.getItem(KEY_EMAIL_COUNT) || "0", 10);
  } else {
    localStorage.setItem(KEY_EMAIL_MONTH, currentMonthKey);
  }
  localStorage.setItem(KEY_EMAIL_COUNT, String(currentCount + 1));
};

export const stripGreeting = (text: string): string => {
  return text
    .replace(/^[\s\S]*?(Hola|Estimad[oa]|Buen día|Buenas tardes).*?(\n|$)/im, "")
    .replace(/^\s*Espero que estés muy bien\.?\s*/im, "")
    .trim();
};

const getBlockConfig = (title: string) => {
  const lower = title.toLowerCase();
  if (lower.includes("puntualidad") || lower.includes("asistencia"))
    return { titleColor: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" };
  if (lower.includes("ética") || lower.includes("confidencialidad"))
    return { titleColor: "#047857", bg: "#ecfdf5", border: "#a7f3d0" };
  if (lower.includes("rol") || lower.includes("activo"))
    return { titleColor: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" };
  if (lower.includes("documentación"))
    return { titleColor: "#be123c", bg: "#fff1f2", border: "#fecdd3" };
  return { titleColor: "#334155", bg: "#f8fafc", border: "#e2e8f0" };
};

const getDataConfig = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes("instituci")) return { icon: "📍", color: "#dc2626" };
  if (lower.includes("horario") || lower.includes("comisi"))
    return { icon: "📅", color: "#2563eb" };
  return { icon: "👉", color: "#475569" };
};

export const generateHtmlTemplate = (
  textBody: string,
  title: string = "Comunicación Institucional"
): string => {
  const cleanText = stripGreeting(textBody)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = cleanText.split(/\n/);
  let contentHtml = "";
  const fontStack =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  let isSignatureBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      contentHtml += '<div style="height: 12px;">&nbsp;</div>';
      continue;
    }

    if (line.match(/^(Saludos|Atentamente|Cariños),?$/i)) {
      isSignatureBlock = true;
      contentHtml += `<div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;"><p style="margin: 0; color: #64748b; font-size: 14px; font-family: ${fontStack};">${line}</p>`;
      continue;
    }

    if (isSignatureBlock) {
      const fontWeight = line.includes("Blas") ? "700" : "400";
      const fontSize = line.includes("Blas") ? "16px" : "13px";
      const color = line.includes("Blas") ? "#0f172a" : "#64748b";
      contentHtml += `<p style="margin: 4px 0; color: ${color}; font-weight: ${fontWeight}; font-size: ${fontSize}; font-family: ${fontStack};">${line}</p>`;
      continue;
    }

    const blockMatch = line.match(/^\*\*(.*?)\*\*[:]?\s*(.*)/);
    const dataMatch = line.match(/^([^:]+):[:]?\s*(.*)/);

    if (blockMatch) {
      const blockTitle = blockMatch[1].trim();
      const blockContent = blockMatch[2].trim();
      const style = getBlockConfig(blockTitle);
      contentHtml += `<div style="margin-bottom: 12px; background-color: ${style.bg}; border: 1px solid ${style.border}; border-left: 4px solid ${style.titleColor}; border-radius: 6px; padding: 16px 20px;"><div style="color: ${style.titleColor}; font-family: ${fontStack}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${blockTitle}</div><div style="color: #334155; font-family: ${fontStack}; font-size: 15px; line-height: 1.6;">${blockContent}</div></div>`;
    } else if (
      dataMatch &&
      (line.includes("Institución") ||
        line.includes("Horario") ||
        line.includes("Estado") ||
        line.includes("Comisión"))
    ) {
      const label = dataMatch[1].trim();
      const val = dataMatch[2].trim();
      const config = getDataConfig(label);
      contentHtml += `<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid ${config.color}; border-radius: 8px; padding: 15px 20px; margin-bottom: 12px;"><table width="100%" border="0"><tr><td width="24" align="center" style="font-size: 18px;">${config.icon}</td><td style="font-family: ${fontStack}; padding-left: 12px;"><div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">${label}</div><div style="font-size: 15px; color: #0f172a; font-weight: 600;">${val}</div></td></tr></table></div>`;
    } else {
      const boldLine = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      contentHtml += `<p style="margin: 0 0 16px 0; color: #475569; font-family: ${fontStack}; font-size: 15px; line-height: 1.6;">${boldLine}</p>`;
    }
  }
  if (isSignatureBlock) contentHtml += `</div>`;

  const year = new Date().getFullYear();
  const headerStyle =
    "background: linear-gradient(135deg, #00B2A9 0%, #1e40af 100%); padding: 32px 40px;";

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head><body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: ${fontStack};"><table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding: 40px 10px;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px rgba(0,0,0,0.1);"><tr><td style="${headerStyle}"><div style="color: #ffffff; font-family: ${fontStack}; font-weight: 900; font-size: 28px;">UFLO</div><div style="color: #ffffff; font-family: ${fontStack}; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.9;">Universidad</div></td></tr><tr><td style="padding: 40px;"><h1 style="margin: 0 0 24px 0; color: #0f172a; font-size: 24px; font-weight: 800;">${title}</h1><div style="font-size: 15px; color: #334155;">${contentHtml}</div></td></tr><tr><td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;"><p style="margin: 0; font-size: 11px; color: #94a3b8; font-family: ${fontStack};"><strong>Facultad de Psicología y Ciencias Sociales</strong><br>Prácticas Profesionales Supervisadas<br>&copy; ${year} Universidad de Flores</p></td></tr></table></td></tr></table></body></html>`;
};

export const sendSmartEmail = async (
  scenario: EmailScenario,
  data: EmailData
): Promise<{ success: boolean; message?: string }> => {
  try {
    const { data: template, error: dbError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", scenario)
      .maybeSingle();

    if (dbError) throw new Error("Error al consultar plantillas: " + dbError.message);
    if (template && template.is_active === false) {
      return { success: true, message: "Automación desactivada" };
    }

    if (!data.studentEmail) return { success: false, message: "Falta email del alumno." };

    const subjectTmpl = template?.subject || DEFAULT_TEMPLATES[scenario].subject;
    const bodyTmpl = template?.body || DEFAULT_TEMPLATES[scenario].body;

    const finalSubject = subjectTmpl
      .replace(/{{nombre_pps}}/g, data.ppsName || "")
      .replace(/{{institucion}}/g, data.institution || "");

    // Build encuentro inicial text
    const encuentroText = data.encuentroInicial
      ? `\n📅 Encuentro Inicial Obligatorio: ${data.encuentroInicial}\n   (Es obligatorio para todos los seleccionados)`
      : "";

    const textBody = bodyTmpl
      .replace(/{{nombre_alumno}}/g, data.studentName)
      .replace(/{{nombre_pps}}/g, data.ppsName || "")
      .replace(/{{horario}}/g, data.schedule || "")
      .replace(/{{institucion}}/g, data.institution || "")
      .replace(/{{estado_nuevo}}/g, data.newState || "")
      .replace(/{{notas}}/g, data.notes || "")
      .replace(/{{encuentro_inicial}}/g, encuentroText);

    const firstName = data.studentName.split(" ")[0];
    const htmlTitle = `Hola, <span style="color: #2563eb;">${firstName}</span>`;
    const htmlBody = generateHtmlTemplate(textBody, htmlTitle);
    const cleanTextBody = stripGreeting(textBody);

    const { error: invokeError } = await supabase.functions.invoke("send-email", {
      body: {
        to: data.studentEmail,
        subject: finalSubject,
        text: cleanTextBody,
        html: htmlBody,
        name: data.studentName,
      },
    });

    if (invokeError) throw new Error(invokeError.message || "Error en el servidor de correo");

    incrementCounter();
    return { success: true };
  } catch (error: any) {
    console.error(`[EmailService] Error enviando correo (${scenario}):`, error);
    return { success: false, message: error.message || "Error de envío" };
  }
};
