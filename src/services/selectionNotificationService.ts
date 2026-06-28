/**
 * selectionNotificationService.ts
 *
 * Servicio puro (sin dependencias de React) para enviar notificaciones
 * de selección (email + push) a los estudiantes seleccionados de una
 * convocatoria/lanzamiento.
 *
 * Extraído de useSeleccionadorLogic.handleConfirmAndCloseTable para que
 * pueda ser invocado tanto desde el hook como desde LanzadorView.
 */
import {
  FIELD_CORREO_ESTUDIANTES,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_USER_ID_ESTUDIANTES,
} from "../constants";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import type { LanzamientoPPS } from "../types";
import { getPublicPanelUrl, sendSmartEmail } from "../utils/emailService";
import { normalizeStringForComparison } from "../utils/formatters";
import { logger } from "../utils/logger";

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Datos mínimos de un candidato seleccionado para enviar notificaciones. */
export interface SelectionCandidate {
  nombre: string;
  correo: string | null;
  /** Horario que el estudiante eligió / le asignaron */
  horarioSeleccionado: string;
  userId?: string;
  studentId: string;
}

interface NotifyResult {
  sent: number;
  errors: number;
}

// ── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Envía el email de selección ("fuiste seleccionado") a cada candidato.
 * Reutiliza el template `seleccion` de emailService.
 */
export async function sendSelectionEmails(
  launch: LanzamientoPPS,
  candidates: SelectionCandidate[]
): Promise<NotifyResult> {
  if (candidates.length === 0) return { sent: 0, errors: 0 };

  // Resolver info de horarios del lanzamiento
  const horarioSeleccionadoLanzamiento = launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS];
  const horariosDisponibles = horarioSeleccionadoLanzamiento
    ? String(horarioSeleccionadoLanzamiento)
        .split(";")
        .filter((h) => h.trim())
    : [];
  const tieneUnSoloHorario = horariosDisponibles.length <= 1;

  // Formato del encuentro inicial
  const encuentroInicial = launch[FIELD_FECHA_ENCUENTRO_INICIAL_LANZAMIENTOS];
  let encuentroText = "";
  if (encuentroInicial) {
    const dateObj = new Date(encuentroInicial as string);
    const fechaStr = dateObj.toLocaleDateString("es-AR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const hora = dateObj.getHours().toString().padStart(2, "0");
    const minutos = dateObj.getMinutes().toString().padStart(2, "0");
    encuentroText = `${fechaStr} a las ${hora}:${minutos} hs`;
  }

  let sent = 0;
  let errors = 0;

  const emailPromises = candidates.map(async (student) => {
    // Determinar el horario a mostrar: el del estudiante, o si hay un solo
    // horario disponible y no eligió ninguno, usar ese.
    const horarioAsignado =
      student.horarioSeleccionado || (tieneUnSoloHorario ? horariosDisponibles[0] : "");
    const panelUrl = getPublicPanelUrl();

    const result = await sendSmartEmail("seleccion", {
      studentName: student.nombre,
      studentEmail: student.correo ?? "",
      ppsName: launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] ?? undefined,
      schedule: horarioAsignado || undefined,
      encuentroInicial: encuentroText || undefined,
      panelUrl,
    });

    if (result.success) sent++;
    else errors++;

    return result;
  });

  await Promise.all(emailPromises);
  logger.info(
    `[SelectionNotification] Emails sent: ${sent} ok, ${errors} errors (${candidates.length} total)`
  );

  return { sent, errors };
}

/**
 * Envía push notification ("¡Fuiste seleccionado!") a cada candidato.
 * Lee el template `seleccion_push` de la tabla `email_templates` para
 * respetar personalización y el flag is_active.
 */
export async function sendSelectionPushNotifications(
  launch: LanzamientoPPS,
  candidates: SelectionCandidate[]
): Promise<void> {
  if (candidates.length === 0) return;

  try {
    const { data: pushTemplate } = await supabase
      .from("email_templates")
      .select("subject, body, is_active")
      .eq("id", "seleccion_push")
      .single();

    if (pushTemplate?.is_active === false) {
      logger.info("[SelectionNotification] Push template disabled, skipping");
      return;
    }

    const pushPromises = candidates.map(async (student) => {
      const title = (pushTemplate?.subject || "¡Fuiste seleccionado! 🎉")
        .replace("{{nombre_alumno}}", student.nombre ?? "")
        .replace("{{nombre_pps}}", launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] ?? "");

      const message = (
        pushTemplate?.body ||
        "Hola {{nombre_alumno}}, has sido seleccionado para la PPS: {{nombre_pps}}. Revisá tu correo para más detalles."
      )
        .replace("{{nombre_alumno}}", student.nombre ?? "")
        .replace("{{nombre_pps}}", launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] ?? "");

      return supabase.functions.invoke("send-fcm-notification", {
        body: {
          title,
          body: message,
          type: "selection",
          user_ids: [student.userId || student.studentId],
        },
      });
    });

    await Promise.all(pushPromises);
    logger.info("[SelectionNotification] Push notifications sent successfully");
  } catch (pushError) {
    // No fallar la operación entera si push falla
    logger.error("[SelectionNotification] Error sending push notifications:", pushError);
  }
}

/**
 * Envía un push recordando al estudiante que debe completar el
 * consentimiento / compromiso digital ahora que quedó seleccionado.
 *
 * Lee el template `compromiso_push` de `email_templates` (respeta is_active y
 * personalización). Se envía con type "compromiso" y un tag propio para que
 * no colisione con el push de selección (el SW usa tag por notificación).
 */
export async function sendConsentReminderPushNotifications(
  launch: LanzamientoPPS,
  candidates: SelectionCandidate[]
): Promise<void> {
  if (candidates.length === 0) return;

  try {
    const { data: pushTemplate } = await supabase
      .from("email_templates")
      .select("subject, body, is_active")
      .eq("id", "compromiso_push")
      .single();

    if (pushTemplate?.is_active === false) {
      logger.info("[SelectionNotification] Consent push template disabled, skipping");
      return;
    }

    const panelUrl = getPublicPanelUrl();

    const pushPromises = candidates.map(async (student) => {
      const title = (pushTemplate?.subject || "Falta tu consentimiento digital ✍️")
        .replace("{{nombre_alumno}}", student.nombre ?? "")
        .replace("{{nombre_pps}}", launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] ?? "");

      const message = (
        pushTemplate?.body ||
        "Hola {{nombre_alumno}}, para confirmar tu lugar en {{nombre_pps}} tenés que aceptar el compromiso digital desde Mi Panel. ¡No te quedes afuera!"
      )
        .replace("{{nombre_alumno}}", student.nombre ?? "")
        .replace("{{nombre_pps}}", launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] ?? "");

      return supabase.functions.invoke("send-fcm-notification", {
        body: {
          title,
          body: message,
          type: "compromiso",
          user_ids: [student.userId || student.studentId],
          // tag propio + deep-link al panel para que no reemplace al push de selección
          data: { tag: "pps-consent", url: panelUrl },
        },
      });
    });

    await Promise.all(pushPromises);
    logger.info("[SelectionNotification] Consent reminder push notifications sent successfully");
  } catch (pushError) {
    // No fallar la operación entera si push falla
    logger.error("[SelectionNotification] Error sending consent reminder push:", pushError);
  }
}

/**
 * Conveniencia: envía tanto emails como push notifications.
 * Retorna el resultado de los emails (push es fire-and-forget).
 *
 * Orden de los push: primero "¡Fuiste seleccionado!" y luego el recordatorio
 * del consentimiento digital, para que el estudiante vea ambas notificaciones.
 */
export async function notifySelectedStudents(
  launch: LanzamientoPPS,
  candidates: SelectionCandidate[]
): Promise<NotifyResult> {
  const result = await sendSelectionEmails(launch, candidates);
  await sendSelectionPushNotifications(launch, candidates);
  await sendConsentReminderPushNotifications(launch, candidates);
  return result;
}

// ── Helpers para obtener candidatos ──────────────────────────────────────────

/**
 * Busca en la DB los inscriptos con estado "Seleccionado" para un
 * lanzamiento dado y devuelve los datos mínimos para notificarlos.
 *
 * Útil cuando el llamador (p.ej. LanzadorView) no tiene la lista de
 * candidatos en memoria.
 */
export async function fetchSelectedCandidatesForLaunch(
  launchId: string
): Promise<SelectionCandidate[]> {
  // 1. Traer inscripciones seleccionadas
  const allEnrollments = await db.convocatorias.getAll();
  const selectedEnrollments = allEnrollments.filter(
    (c) =>
      c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] === launchId &&
      normalizeStringForComparison(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] as string) ===
        "seleccionado"
  );

  if (selectedEnrollments.length === 0) return [];

  // 2. Traer datos de los estudiantes
  const studentIds = selectedEnrollments
    .map((e) => e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS])
    .filter(Boolean) as string[];

  const students = await db.estudiantes.getAll({ filters: { id: studentIds } });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // 3. Mapear al tipo mínimo
  return selectedEnrollments
    .map((enrollment) => {
      const sId = enrollment[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string;
      const student = sId ? studentMap.get(sId) : null;
      if (!student) return null;

      return {
        nombre: (student[FIELD_NOMBRE_ESTUDIANTES] as string) || "Desconocido",
        correo: (student[FIELD_CORREO_ESTUDIANTES] as string) || null,
        horarioSeleccionado: (enrollment[FIELD_HORARIO_FORMULA_CONVOCATORIAS] as string) || "",
        userId: student[FIELD_USER_ID_ESTUDIANTES] as string | undefined,
        studentId: sId,
      } as SelectionCandidate;
    })
    .filter((item): item is SelectionCandidate => item !== null);
}
