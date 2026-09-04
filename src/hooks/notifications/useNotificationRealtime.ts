import { useEffect } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_FINALIZACION,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PPS,
  TABLE_NAME_SOLICITUDES_MODIFICACION,
  TABLE_NAME_SOLICITUDES_NUEVA,
} from "../../constants";
import type { AppNotification } from "../../contexts/notificationTypes";
import { supabase } from "../../lib/supabaseClient";

type RealtimeRow = { id: string; [key: string]: unknown };

interface UseNotificationRealtimeOptions {
  userId: string | undefined;
  isAdmin: boolean;
  isStudent: boolean;
  onNotification: (notification: AppNotification) => void;
}

export const useNotificationRealtime = ({
  userId,
  isAdmin,
  isStudent,
  onNotification,
}: UseNotificationRealtimeOptions) => {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE_NAME_PPS },
        (payload: RealtimePostgresChangesPayload<RealtimeRow>) => {
          if (!isAdmin || !payload?.new) return;
          const record = payload.new as RealtimeRow;
          onNotification({
            id: `pps-${record.id}`,
            title: "Nueva Solicitud de PPS",
            message: "Nueva solicitud de inicio recibida.",
            timestamp: new Date(),
            type: "solicitud_pps",
            link: "/admin/solicitudes?tab=ingreso",
            isRead: false,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE_NAME_FINALIZACION },
        (payload: RealtimePostgresChangesPayload<RealtimeRow>) => {
          if (!isAdmin || !payload?.new) return;
          const record = payload.new as RealtimeRow;
          onNotification({
            id: `fin-${record.id}`,
            title: "Nueva Solicitud de Acreditación",
            message: "Un estudiante ha enviado documentación para finalizar.",
            timestamp: new Date(),
            type: "acreditacion",
            link: "/admin/solicitudes?tab=egreso",
            isRead: false,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE_NAME_SOLICITUDES_MODIFICACION },
        (payload: RealtimePostgresChangesPayload<RealtimeRow>) => {
          if (!isAdmin || !payload?.new) return;
          onNotification({
            id: `mod-${(payload.new as RealtimeRow).id}`,
            title: "Solicitud de Modificación",
            message: "Un estudiante solicita un cambio en su práctica.",
            timestamp: new Date(),
            type: "solicitud_pps",
            link: "/admin/solicitudes",
            isRead: false,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE_NAME_SOLICITUDES_NUEVA },
        (payload: RealtimePostgresChangesPayload<RealtimeRow>) => {
          if (!isAdmin || !payload?.new) return;
          onNotification({
            id: `newpps-${(payload.new as RealtimeRow).id}`,
            title: "Nueva PPS Autogestiva",
            message: "Nueva solicitud autogestiva recibida.",
            timestamp: new Date(),
            type: "solicitud_pps",
            link: "/admin/solicitudes",
            isRead: false,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME_LANZAMIENTOS_PPS },
        (payload: RealtimePostgresChangesPayload<RealtimeRow>) => {
          if (!isStudent) return;
          const record = payload.new as RealtimeRow;
          if (!record) return;

          const isNewActive =
            payload.eventType === "INSERT" &&
            record[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === "Abierta";
          const isBecameActive =
            payload.eventType === "UPDATE" &&
            record[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === "Abierta" &&
            payload.old?.[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] !== "Abierta";

          if (isNewActive || isBecameActive) {
            onNotification({
              id: `launch-realtime-${record.id}`,
              title: "¡Nueva Oportunidad de PPS!",
              message: `Se ha abierto la inscripción para ${record[FIELD_NOMBRE_PPS_LANZAMIENTOS]}.`,
              timestamp: new Date(),
              type: "lanzamiento",
              link: "/student",
              isRead: false,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLE_NAME_CONVOCATORIAS },
        (payload: RealtimePostgresChangesPayload<RealtimeRow>) => {
          if (!isStudent) return;
          const record = payload.new as RealtimeRow;
          const previous = payload.old as Partial<RealtimeRow>;
          const studentId = record[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
          const normalizedStudentId = Array.isArray(studentId) ? studentId[0] : studentId;
          if (normalizedStudentId !== userId) return;

          const nextState = record[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS];
          if (nextState === previous[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) return;

          onNotification({
            id: `conv-update-${record.id}-${Date.now()}`,
            title: "Actualización de Postulación",
            message:
              nextState === "Seleccionado"
                ? "¡Felicitaciones! Has sido Seleccionado para la PPS."
                : `Tu estado ha cambiado a: ${nextState}`,
            timestamp: new Date(),
            type: "estado",
            link: "/student/solicitudes",
            isRead: false,
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, isStudent, onNotification, userId]);
};
