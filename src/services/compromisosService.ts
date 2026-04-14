import * as C from "../constants";
import {
  COMPROMISO_PPS_BLOCKS,
  COMPROMISO_PPS_CHECK_COMPROMISO,
  COMPROMISO_PPS_CHECK_LECTURA,
  COMPROMISO_PPS_DECLARACION,
  COMPROMISO_PPS_FULL_TEXT,
  COMPROMISO_PPS_INTRO,
  COMPROMISO_PPS_SUBTITLE,
  COMPROMISO_PPS_TITLE,
  COMPROMISO_PPS_VERSION,
} from "../constants/commitmentConstants";
import { supabase } from "../lib/supabaseClient";
import type { CompromisoPPS } from "../types";
import { Database } from "../types/supabase";
import { generateHtmlTemplate, stripGreeting } from "../utils/emailService";

export const fetchStudentCompromisos = async (studentId: string): Promise<CompromisoPPS[]> => {
  const { data, error } = await supabase
    .from("compromisos_pps")
    .select("*")
    .eq(C.FIELD_COMPROMISO_ESTUDIANTE, studentId);

  if (error) {
    console.warn("[fetchStudentCompromisos] Error fetching commitments:", error);
    return [];
  }

  return (data || []) as CompromisoPPS[];
};

export const submitCompromisoPPS = async (payload: {
  studentId: string;
  convocatoriaId: string;
  lanzamientoId: string;
  fullName: string;
  dni: number | null;
  legajo: string;
  signature: string;
}): Promise<CompromisoPPS> => {
  const record: Database["public"]["Tables"]["compromisos_pps"]["Insert"] = {
    [C.FIELD_COMPROMISO_ESTUDIANTE]: payload.studentId,
    [C.FIELD_COMPROMISO_CONVOCATORIA]: payload.convocatoriaId,
    [C.FIELD_COMPROMISO_LANZAMIENTO]: payload.lanzamientoId,
    [C.FIELD_COMPROMISO_VERSION]: COMPROMISO_PPS_VERSION,
    [C.FIELD_COMPROMISO_ESTADO]: "aceptado",
    [C.FIELD_COMPROMISO_TEXTO_ACTA]: COMPROMISO_PPS_FULL_TEXT,
    [C.FIELD_COMPROMISO_ACEPTA_LECTURA]: true,
    [C.FIELD_COMPROMISO_ACEPTA_COMPROMISO]: true,
    [C.FIELD_COMPROMISO_NOMBRE]: payload.fullName,
    [C.FIELD_COMPROMISO_DNI]: payload.dni,
    [C.FIELD_COMPROMISO_LEGAJO]: payload.legajo,
    [C.FIELD_COMPROMISO_FIRMA]: payload.signature,
    [C.FIELD_COMPROMISO_FECHA_ACEPTACION]: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("compromisos_pps")
    .upsert(record, { onConflict: "convocatoria_id" })
    .select()
    .single();

  if (error) throw error;
  return data as CompromisoPPS;
};

export const sendCompromisoAcceptanceEmail = async (data: {
  studentEmail: string;
  studentName: string;
  ppsName: string;
  schedule?: string | null;
  acceptedAt: string;
  fullName: string;
  dni?: number | null;
  legajo: string;
}) => {
  const acceptedDate = new Date(data.acceptedAt).toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const body = `Hola ${data.studentName},

Esta es tu constancia de aceptación del Acta de Compromiso para el inicio de tu Práctica Profesional Supervisada.

Institución / PPS: ${data.ppsName}
Horario asignado: ${data.schedule || "A confirmar"}
Fecha de aceptación: ${acceptedDate}
Nombre declarado: ${data.fullName}
DNI: ${data.dni || "No informado"}
Legajo: ${data.legajo}

Texto aceptado:

${COMPROMISO_PPS_FULL_TEXT}

Esta copia se emite como constancia del compromiso asumido a través de Mi Panel.

Saludos,

Coordinación de Prácticas Profesionales Supervisadas
UFLO Universidad`;

  const htmlBody = generateHtmlTemplate(body, "Copia de tu compromiso PPS");

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      to: data.studentEmail,
      subject: `Constancia de compromiso PPS - ${data.ppsName}`,
      text: stripGreeting(body),
      html: htmlBody,
      name: data.studentName,
    },
  });

  if (error) {
    throw new Error(error.message || "No se pudo enviar la constancia por correo");
  }
};

export const sendCompromisoAcceptanceEmailV2 = async (data: {
  studentEmail: string;
  studentName: string;
  ppsName: string;
  schedule?: string | null;
  encuentroInicial?: string | null;
  acceptedAt: string;
  fullName: string;
  dni?: number | null;
  legajo: string;
}) => {
  const acceptedDate = new Date(data.acceptedAt).toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const structuredActa = COMPROMISO_PPS_BLOCKS.flatMap((block) => [
    `**${block.title}**`,
    ...block.clauses.map((clause) => `${clause.label}: ${clause.text}`),
    "",
  ]).join("\n");

  const body = `Hola ${data.studentName},

Se registró correctamente tu aceptación digital del Acta de Compromiso correspondiente al inicio de tu Práctica Profesional Supervisada.

**Datos de tu confirmación**
Institución / PPS: ${data.ppsName}
Horario / Comisión asignada: ${data.schedule || "A confirmar"}
Fecha de aceptación: ${acceptedDate}
Versión del acta: ${COMPROMISO_PPS_VERSION}

**Firma declarada**
Nombre completo: ${data.fullName}
DNI: ${data.dni || "No informado"}
Legajo: ${data.legajo}

**Declaración ratificada**
1. ${COMPROMISO_PPS_CHECK_LECTURA}
2. ${COMPROMISO_PPS_CHECK_COMPROMISO}

**Declaración final**
${COMPROMISO_PPS_DECLARACION}

**Texto del acta aceptada**
${COMPROMISO_PPS_TITLE}
${COMPROMISO_PPS_SUBTITLE}

${COMPROMISO_PPS_INTRO}

${structuredActa}
**Cierre institucional**
Esta copia se emite como constancia formal del compromiso asumido a través de Mi Panel y quedará vinculada a tu registro académico-administrativo de PPS.

Saludos,

Coordinación de Prácticas Profesionales Supervisadas
UFLO Universidad`;

  const htmlBody = generateHtmlTemplate(body, "Constancia de aceptación registrada");

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      to: data.studentEmail,
      subject: `Constancia de aceptación PPS - ${data.ppsName}`,
      text: stripGreeting(body),
      html: htmlBody,
      name: data.studentName,
    },
  });

  if (error) {
    throw new Error(error.message || "No se pudo enviar la constancia por correo");
  }
};

export const sendCompromisoAcceptanceEmailV3 = async (data: {
  studentEmail: string;
  studentName: string;
  ppsName: string;
  schedule?: string | null;
  encuentroInicial?: string | null;
  acceptedAt: string;
  fullName: string;
  dni?: number | null;
  legajo: string;
}) => {
  const acceptedDate = new Date(data.acceptedAt).toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const initialMeetingDate = data.encuentroInicial ? new Date(data.encuentroInicial) : null;
  const formattedInitialMeeting =
    initialMeetingDate && !Number.isNaN(initialMeetingDate.getTime())
      ? initialMeetingDate.toLocaleString("es-AR", {
          dateStyle: "full",
          timeStyle: "short",
        })
      : data.encuentroInicial || null;

  const body = `Hola ${data.studentName},

Se registró correctamente tu aceptación digital del compromiso correspondiente al inicio de tu Práctica Profesional Supervisada.

Institución / PPS: ${data.ppsName}
Horario asignado: ${data.schedule || "A confirmar"}
${
  formattedInitialMeeting
    ? `Encuentro inicial: ${formattedInitialMeeting}
`
    : ""
}Fecha y hora de aceptación: ${acceptedDate}
Nombre completo: ${data.fullName}
DNI: ${data.dni || "No informado"}
Legajo: ${data.legajo}

Resumen de condiciones aceptadas:
- Asistencia mínima del 80% a las actividades previstas.
- Obligación de informar inasistencias o dificultades de manera inmediata.
- Compromiso de confidencialidad, responsabilidad y representación institucional.
- Cumplimiento de la documentación requerida y entrega del informe final en plazo.

Constancia formal:
${COMPROMISO_PPS_DECLARACION}

Versión del acta aceptada: ${COMPROMISO_PPS_VERSION}

Conservá este correo como comprobante de tu confirmación.

Saludos,

Coordinación de Prácticas Profesionales Supervisadas
UFLO Universidad`;

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const fontStack =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const detailRows = [
    { label: "Institución / PPS", value: data.ppsName },
    { label: "Horario asignado", value: data.schedule || "A confirmar" },
    ...(formattedInitialMeeting
      ? [{ label: "Encuentro inicial", value: formattedInitialMeeting }]
      : []),
    { label: "Fecha y hora de aceptación", value: acceptedDate },
    { label: "Nombre completo", value: data.fullName },
    { label: "DNI", value: data.dni ? String(data.dni) : "No informado" },
    { label: "Legajo", value: data.legajo },
  ];

  const detailHtml = detailRows
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

  const conditions = [
    "Asistencia mínima del 80% a las actividades previstas.",
    "Obligación de informar inasistencias o dificultades de manera inmediata.",
    "Compromiso de confidencialidad, responsabilidad y representación institucional.",
    "Cumplimiento de la documentación requerida y entrega del informe final en plazo.",
  ];

  const conditionsHtml = conditions
    .map(
      (item) => `
        <tr>
          <td style="width: 18px; padding-top: 10px; vertical-align: top;">
            <div style="width: 7px; height: 7px; margin-top: 7px; border-radius: 999px; background: linear-gradient(135deg, #00B2A9 0%, #1e40af 100%);"></div>
          </td>
          <td style="padding: 4px 0 4px 8px; font-family: ${fontStack}; font-size: 15px; line-height: 1.7; color: #334155;">${escapeHtml(item)}</td>
        </tr>`
    )
    .join("");

  const htmlBody = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
  </head>
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
                  <h1 style="margin: 0 0 18px 0; color: #0f172a; font-size: 24px; font-weight: 800; line-height: 1.25;">Confirmación registrada de tu compromiso para PPS</h1>
                  <p style="margin: 0 0 28px 0; color: #475569; font-family: ${fontStack}; font-size: 15px; line-height: 1.7;">Se registró correctamente tu aceptación digital del compromiso correspondiente al inicio de tu Práctica Profesional Supervisada.</p>

                <div style="margin-bottom: 24px; border: 1px solid #dbeafe; border-radius: 12px; overflow: hidden; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);">
                  <div style="padding: 14px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-family: ${fontStack}; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #1e3a8a;">Datos de tu confirmación</div>
                  <div style="padding: 0 20px 4px 20px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">${detailHtml}
                    </table>
                  </div>
                </div>

                <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 24px; background-color: #ffffff;">
                  <div style="margin-bottom: 12px; font-family: ${fontStack}; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #1e3a8a;">Resumen de condiciones aceptadas</div>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">${conditionsHtml}
                  </table>
                </div>

                <div style="margin-bottom: 24px; border-radius: 12px; padding: 22px 24px; background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%); border: 1px solid #dbeafe;">
                  <div style="margin-bottom: 10px; font-family: ${fontStack}; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #1e3a8a;">Constancia formal</div>
                  <p style="margin: 0; color: #1e293b; font-family: ${fontStack}; font-size: 15px; line-height: 1.7;">${escapeHtml(COMPROMISO_PPS_DECLARACION)}</p>
                </div>

                <div style="margin-bottom: 28px; padding: 18px 20px; border-radius: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
                  <div style="font-family: ${fontStack}; font-size: 13px; line-height: 1.7; color: #334155;"><strong style="color: #0f172a;">Versión del acta aceptada:</strong> ${escapeHtml(COMPROMISO_PPS_VERSION)}<br /><strong style="color: #0f172a;">Importante:</strong> Conservá este correo como comprobante de tu confirmación.</div>
                </div>

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

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      to: data.studentEmail,
      subject: `Confirmación registrada - Compromiso PPS - ${data.ppsName}`,
      text: stripGreeting(body),
      html: htmlBody,
      name: data.studentName,
    },
  });

  if (error) {
    throw new Error(error.message || "No se pudo enviar la constancia por correo");
  }
};
