/**
 * Render del correo de selección, del lado del servidor.
 *
 * DUPLICACIÓN DELIBERADA — LEER ANTES DE TOCAR
 *
 * Esto es un port de `generateHtmlTemplate` + sus helpers, que viven en
 * `src/utils/emailService.ts`. La lógica está repetida a propósito: aquel módulo
 * se compila para el navegador (importa el cliente de Supabase del browser,
 * `logger`, contadores en localStorage) y este corre en Deno. El `tsconfig` del
 * proyecto solo incluye `src`, así que no hay un único archivo que ambos puedan
 * importar sin inventar una configuración nueva.
 *
 * SI CAMBIÁS EL DISEÑO DEL MAIL, CAMBIALO EN LOS DOS LADOS. La firma visual es
 * la misma que ve el estudiante en el resto de los correos; que este se
 * desincronice se nota.
 *
 * Lo que este módulo NO duplica es el contenido: el cuerpo y el asunto salen de
 * la tabla `email_templates` (fila `seleccion`), igual que antes, así que la
 * plantilla que edita Coordinación desde el panel sigue mandando.
 */

const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Cuerpo por defecto si la fila `seleccion` de `email_templates` no existe. */
export const DEFAULT_SELECTION_TEMPLATE = {
  subject: "Confirmación de Asignación PPS: {{nombre_pps}}",
  body: `Hola {{nombre_alumno}},
Nos complace informarte que has sido seleccionado/a para realizar tu Práctica Profesional Supervisada en:
Institución: {{nombre_pps}}
{{encuentro_inicial}}{{horario}}

**Acción requerida** Ingresá a Mi Panel, revisá el acta de compromiso y registrá tu aceptación digital para reservar tu vacante antes del inicio de la PPS.
[[button|Ingresar a Mi Panel|{{panel_url}}]]

Si tenés dudas o surge alguna dificultad, comunicate con la Coordinación lo antes posible.

Saludos,

Blas
Coordinador de Prácticas Profesionales Supervisadas
Licenciatura en Psicología
UFLO`,
};

export const stripGreeting = (text: string): string =>
  text
    .replace(/^[\s\S]*?(Hola|Estimad[oa]|Buen día|Buenas tardes).*?(\n|$)/im, "")
    .replace(/^\s*Espero que estés muy bien\.?\s*/im, "")
    .trim();

const getBlockConfig = (title: string) => {
  const lower = title.toLowerCase();
  if (lower.includes("acción requerida"))
    return { titleColor: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" };
  if (lower.includes("tiempo límite"))
    return { titleColor: "#ea580c", bg: "#fff7ed", border: "#fed7aa" };
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
  if (lower.includes("horario") || lower.includes("comisión"))
    return { icon: "🕒", color: "#2563eb" };
  if (lower.includes("encuentro")) return { icon: "🤝", color: "#7e22ce" };
  return { icon: "👉", color: "#475569" };
};

export const generateHtmlTemplate = (textBody: string, title: string): string => {
  const cleanText = stripGreeting(textBody)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = cleanText.split(/\n/);
  let contentHtml = "";
  let isSignatureBlock = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (!line) {
      contentHtml += '<div style="height: 12px;">&nbsp;</div>';
      continue;
    }

    if (line.match(/^(Saludos|Atentamente|Cariños),?$/i)) {
      isSignatureBlock = true;
      contentHtml += `<div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;"><p style="margin: 0; color: #64748b; font-size: 14px; font-family: ${FONT_STACK};">${line}</p>`;
      continue;
    }

    if (isSignatureBlock) {
      const fontWeight = line.includes("Blas") ? "700" : "400";
      const fontSize = line.includes("Blas") ? "16px" : "13px";
      const color = line.includes("Blas") ? "#0f172a" : "#64748b";
      contentHtml += `<p style="margin: 4px 0; color: ${color}; font-weight: ${fontWeight}; font-size: ${fontSize}; font-family: ${FONT_STACK};">${line}</p>`;
      continue;
    }

    const ctaMatch = line.match(/^\[\[button\|(.*?)\|(.*?)\]\]$/i);
    const blockMatch = line.match(/^\*\*(.*?)\*\*[:]?\s*(.*)/);
    const dataMatch = line.match(/^([^:]+):[:]?\s*(.*)/);

    if (ctaMatch) {
      const label = ctaMatch[1].trim();
      const url = ctaMatch[2].trim();
      contentHtml += `<div style="margin: 24px 0 28px 0;"><a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #00B2A9 0%, #1e40af 100%); color: #ffffff; text-decoration: none; font-family: ${FONT_STACK}; font-size: 15px; font-weight: 800; padding: 14px 24px; border-radius: 10px; box-shadow: 0 10px 20px rgba(30,64,175,0.18);">${label}</a></div>`;
      continue;
    }

    if (blockMatch) {
      const blockTitle = blockMatch[1].trim();
      const blockContent = blockMatch[2].trim();
      const style = getBlockConfig(blockTitle);
      contentHtml += `<div style="margin-bottom: 12px; background-color: ${style.bg}; border: 1px solid ${style.border}; border-left: 4px solid ${style.titleColor}; border-radius: 6px; padding: 16px 20px;"><div style="color: ${style.titleColor}; font-family: ${FONT_STACK}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${blockTitle}</div><div style="color: #334155; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6;">${blockContent}</div></div>`;
      continue;
    }

    if (
      dataMatch &&
      (line.includes("Institución") ||
        line.includes("Horario") ||
        line.includes("Estado") ||
        line.includes("Comisión") ||
        line.includes("Encuentro"))
    ) {
      const label = dataMatch[1].trim();
      const val = dataMatch[2].trim();
      const config = getDataConfig(label);
      contentHtml += `<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid ${config.color}; border-radius: 8px; padding: 15px 20px; margin-bottom: 12px;"><table width="100%" border="0"><tr><td width="24" align="center" style="font-size: 18px;">${config.icon}</td><td style="font-family: ${FONT_STACK}; padding-left: 12px;"><div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">${label}</div><div style="font-size: 15px; color: #0f172a; font-weight: 600;">${val}</div></td></tr></table></div>`;
      continue;
    }

    const boldLine = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    contentHtml += `<p style="margin: 0 0 16px 0; color: #475569; font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.6;">${boldLine}</p>`;
  }

  if (isSignatureBlock) contentHtml += "</div>";

  const year = new Date().getFullYear();
  const headerStyle =
    "background: linear-gradient(135deg, #00B2A9 0%, #1e40af 100%); padding: 32px 40px;";

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head><body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: ${FONT_STACK};"><table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding: 40px 10px;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px rgba(0,0,0,0.1);"><tr><td style="${headerStyle}"><div style="color: #ffffff; font-family: ${FONT_STACK}; font-weight: 900; font-size: 28px;">UFLO</div><div style="color: #ffffff; font-family: ${FONT_STACK}; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.9;">Universidad</div></td></tr><tr><td style="padding: 40px;"><h1 style="margin: 0 0 24px 0; color: #0f172a; font-size: 24px; font-weight: 800;">${title}</h1><div style="font-size: 15px; color: #334155;">${contentHtml}</div></td></tr><tr><td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;"><p style="margin: 0; font-size: 11px; color: #94a3b8; font-family: ${FONT_STACK};"><strong>Facultad de Psicología y Ciencias Sociales</strong><br>Prácticas Profesionales Supervisadas<br>&copy; ${year} Universidad de Flores</p></td></tr></table></td></tr></table></body></html>`;
};

export interface SelectionEmailInput {
  studentName: string;
  ppsName: string;
  /** Horario o comisión asignada; vacío si el lanzamiento tiene uno solo. */
  schedule: string | null;
  /** Fecha del encuentro inicial, ya formateada para leer. */
  encuentroInicial: string | null;
  panelUrl: string;
  templateSubject?: string | null;
  templateBody?: string | null;
}

/**
 * Arma asunto, texto plano y HTML del correo de selección.
 *
 * Reproduce las sustituciones que hacía `sendSmartEmail("seleccion", ...)`,
 * incluidos los dos parches sobre plantillas viejas: si el cuerpo no menciona
 * `{{encuentro_inicial}}` o `{{horario}}`, se los inyecta después de
 * `{{nombre_pps}}` para que el dato no se pierda; y si no tiene el botón, se lo
 * agrega al final.
 */
export const buildSelectionEmail = (input: SelectionEmailInput) => {
  const subjectTemplate = input.templateSubject || DEFAULT_SELECTION_TEMPLATE.subject;
  let body = input.templateBody || DEFAULT_SELECTION_TEMPLATE.body;

  const subject = subjectTemplate.replace(/{{nombre_pps}}/g, input.ppsName);

  if (input.encuentroInicial && !body.includes("{{encuentro_inicial}}")) {
    body = body.replace("{{nombre_pps}}", "{{nombre_pps}}\n{{encuentro_inicial}}");
  }
  if (input.schedule && !body.includes("{{horario}}")) {
    body = body.replace("{{encuentro_inicial}}", "{{encuentro_inicial}}{{horario}}");
  }
  if (!body.includes("{{panel_url}}")) {
    body += `\n\n[[button|Ingresar a Mi Panel|{{panel_url}}]]`;
  }

  const encuentroText = input.encuentroInicial
    ? `Encuentro inicial: ${input.encuentroInicial}\n`
    : "";
  const horarioText = input.schedule ? `Horario/Comisión asignada: ${input.schedule}\n` : "";

  const textBody = body
    .replace(/{{nombre_alumno}}/g, input.studentName)
    .replace(/{{nombre_pps}}/g, input.ppsName)
    .replace(/{{horario}}/g, horarioText)
    .replace(/{{panel_url}}/g, input.panelUrl)
    .replace(/{{encuentro_inicial}}/g, encuentroText);

  const firstName = input.studentName.split(" ")[0];
  const html = generateHtmlTemplate(
    textBody,
    `Hola, <span style="color: #2563eb;">${firstName}</span>`
  );

  return { subject, text: stripGreeting(textBody), html };
};
