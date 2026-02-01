import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/ui/Toast";
import {
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTADO_PPS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_SOLICITUD_NOMBRE_ALUMNO,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_FINALIZACION,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PPS,
} from "../constants";
import {
  isPushSupported as checkPushSupported,
  getPushSubscriptionStatus,
  subscribeToPush as subscribeToPushApi,
  unsubscribeFromPush as unsubscribeFromPushApi,
} from "../lib/pushSubscription";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: "solicitud_pps" | "acreditacion" | "info" | "recordatorio" | "estado" | "lanzamiento";
  link: string;
  isRead: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  showToast: (message: string, type: "success" | "error" | "warning") => void;
  // Push notification methods
  isPushSupported: boolean;
  isPushEnabled: boolean;
  isPushLoading: boolean;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authenticatedUser, isSuperUserMode, isJefeMode, isDirectivoMode } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // Persistencia Local: Set de IDs leídos
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());

  // Push notification state
  const [pushSupported] = useState(() => checkPushSupported());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const navigate = useNavigate();

  const isAdmin = isSuperUserMode || isJefeMode || isDirectivoMode;
  const isStudent = !isAdmin && !!authenticatedUser;
  const userId = authenticatedUser?.id || "guest";
  const STORAGE_KEY = `read_notifications_v2_${userId}`;

  // 0. CARGAR LEÍDOS DESDE LOCALSTORAGE
  useEffect(() => {
    if (!authenticatedUser) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setReadNotificationIds(new Set(parsed));
        }
      }
    } catch (e) {
      console.warn("Error cargando notificaciones leídas del storage", e);
    }
  }, [authenticatedUser, STORAGE_KEY]);

  // 0.5. CHECK PUSH SUBSCRIPTION STATUS
  useEffect(() => {
    if (!authenticatedUser || !pushSupported) return;

    const checkPushStatus = async () => {
      try {
        const { isSubscribed } = await getPushSubscriptionStatus();
        setPushEnabled(isSubscribed);
      } catch (e) {
        console.warn("Error checking push status", e);
      }
    };

    checkPushStatus();
  }, [authenticatedUser, pushSupported]);

  // Helper para guardar en storage
  const persistReadIds = (newSet: Set<string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSet)));
    setReadNotificationIds(newSet);
  };

  // 1. LOAD PENDING NOTIFICATIONS & GENERATE REMINDERS
  useEffect(() => {
    if (!authenticatedUser) return;

    const fetchNotificationsAndReminders = async () => {
      try {
        const loadedNotifications: AppNotification[] = [];

        if (isAdmin) {
          // --- A. Solicitudes de Inicio (PPS) Pendientes ---
          const { data: pendingPPS } = await supabase
            .from(TABLE_NAME_PPS)
            .select(
              `id, created_at, ${FIELD_SOLICITUD_NOMBRE_ALUMNO}, ${FIELD_EMPRESA_PPS_SOLICITUD}`
            )
            .eq(FIELD_ESTADO_PPS, "Pendiente")
            .order("created_at", { ascending: false })
            .limit(20);

          if (pendingPPS) {
            pendingPPS.forEach((req: any) => {
              const notifId = `pps-${req.id}`;
              loadedNotifications.push({
                id: notifId,
                title: "Solicitud PPS Pendiente",
                message: `${req[FIELD_SOLICITUD_NOMBRE_ALUMNO] || "Estudiante"} solicitó iniciar en ${req[FIELD_EMPRESA_PPS_SOLICITUD] || "Institución"}.`,
                timestamp: new Date(req.created_at),
                type: "solicitud_pps",
                link: "/admin/solicitudes?tab=ingreso",
                isRead: readNotificationIds.has(notifId),
              });
            });
          }

          // --- B. Solicitudes de Acreditación (Finalización) Pendientes ---
          const { data: pendingFinals } = await supabase
            .from(TABLE_NAME_FINALIZACION)
            .select(
              `
                            id,
                            created_at,
                            ${FIELD_FECHA_SOLICITUD_FINALIZACION},
                            estudiante:estudiantes!fk_finalizacion_estudiante (
                                ${FIELD_NOMBRE_ESTUDIANTES}
                            )
                        `
            )
            .eq(FIELD_ESTADO_FINALIZACION, "Pendiente")
            .order("created_at", { ascending: false })
            .limit(20);

          if (pendingFinals) {
            pendingFinals.forEach((req: any) => {
              const notifId = `fin-${req.id}`;
              const studentData = Array.isArray(req.estudiante)
                ? req.estudiante[0]
                : req.estudiante;
              const studentName = studentData?.[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante";

              loadedNotifications.push({
                id: notifId,
                title: "Acreditación Pendiente",
                message: `${studentName} ha enviado documentación para acreditar.`,
                timestamp: new Date(req.created_at),
                type: "acreditacion",
                link: "/admin/solicitudes?tab=egreso",
                isRead: readNotificationIds.has(notifId),
              });
            });
          }
        } else if (isStudent) {
          // --- C. Nuevos Lanzamientos (Student) ---
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const { data: newLaunches } = await supabase
            .from(TABLE_NAME_LANZAMIENTOS_PPS)
            .select(
              `id, created_at, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS}`
            )
            .eq(FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS, "Abierta")
            .gt("created_at", sevenDaysAgo.toISOString())
            .order("created_at", { ascending: false });

          if (newLaunches) {
            newLaunches.forEach((l: any) => {
              const notifId = `launch-${l.id}`;
              loadedNotifications.push({
                id: notifId,
                title: "Nueva Convocatoria",
                message: `${l[FIELD_NOMBRE_PPS_LANZAMIENTOS]} está abierta para inscripción.`,
                timestamp: new Date(l.created_at),
                type: "lanzamiento",
                link: "/student",
                isRead: readNotificationIds.has(notifId),
              });
            });
          }
        }

        loadedNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setNotifications(loadedNotifications);
      } catch (err) {
        console.error("Error loading notification history:", err);
      }
    };

    fetchNotificationsAndReminders();
  }, [isAdmin, isStudent, authenticatedUser, readNotificationIds]);

  // 2. LISTEN FOR NEW EVENTS (REALTIME)
  useEffect(() => {
    if (!authenticatedUser) return;

    const channelName = `notifications-${authenticatedUser.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE_NAME_PPS },
        async (payload: any) => {
          if (!isAdmin) return;
          if (!payload || !payload.new) return;

          const newRecord = payload.new;
          const notifId = `pps-${newRecord.id}`;

          addNotification({
            id: notifId,
            title: "Nueva Solicitud de PPS",
            message: `Nueva solicitud de inicio recibida.`,
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
        async (payload: any) => {
          if (!isAdmin) return;
          if (!payload || !payload.new) return;

          const newRecord = payload.new;
          const notifId = `fin-${newRecord.id}`;

          addNotification({
            id: notifId,
            title: "Nueva Solicitud de Acreditación",
            message: `Un estudiante ha enviado documentación para finalizar.`,
            timestamp: new Date(),
            type: "acreditacion",
            link: "/admin/solicitudes?tab=egreso",
            isRead: false,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME_LANZAMIENTOS_PPS },
        async (payload: any) => {
          if (!isStudent) return;

          const newRecord = payload.new;
          if (!newRecord) return;

          const isNewActive =
            payload.eventType === "INSERT" &&
            newRecord[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === "Abierta";
          const isBecameActive =
            payload.eventType === "UPDATE" &&
            newRecord[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === "Abierta" &&
            payload.old?.[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] !== "Abierta";

          if (isNewActive || isBecameActive) {
            const notifId = `launch-realtime-${newRecord.id}`;
            addNotification({
              id: notifId,
              title: "¡Nueva Oportunidad de PPS!",
              message: `Se ha abierto la inscripción para ${newRecord[FIELD_NOMBRE_PPS_LANZAMIENTOS]}.`,
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
        async (payload: any) => {
          if (!isStudent) return;

          const newRecord = payload.new;
          const oldRecord = payload.old;

          const studentIdInRecord = newRecord[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
          const cleanId = Array.isArray(studentIdInRecord)
            ? studentIdInRecord[0]
            : studentIdInRecord;

          if (authenticatedUser && cleanId === authenticatedUser.id) {
            if (
              newRecord[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] !==
              oldRecord[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]
            ) {
              const newState = newRecord[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS];
              let msg = `Tu estado ha cambiado a: ${newState}`;
              if (newState === "Seleccionado")
                msg = "¡Felicitaciones! Has sido Seleccionado para la PPS.";

              addNotification({
                id: `conv-update-${newRecord.id}-${Date.now()}`,
                title: "Actualización de Postulación",
                message: msg,
                timestamp: new Date(),
                type: "estado",
                link: "/student/solicitudes",
                isRead: false,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, isStudent, authenticatedUser]);

  const addNotification = (notif: AppNotification) => {
    setNotifications((prev) => [notif, ...prev]);
    setToast({ message: notif.title, type: "success" });

    // Simple Native Notification Fallback
    if (Notification.permission === "granted" && document.hidden) {
      new Notification(notif.title, { body: notif.message, icon: "/icons/icon-192x192.png" });
    }

    try {
      new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
        .play()
        .catch(() => {});
    } catch (e) {}
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    const newSet = new Set<string>(readNotificationIds);
    newSet.add(id);
    persistReadIds(newSet);
    const target = notifications.find((n) => n.id === id);
    if (target && target.link) navigate(target.link);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    const newSet = new Set<string>(readNotificationIds);
    notifications.forEach((n) => newSet.add(n.id));
    persistReadIds(newSet);
  };

  const clearNotifications = () => {
    markAllAsRead();
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const showToast = useCallback((message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type });
  }, []);

  // Push notification handlers
  const subscribeToPush = useCallback(async () => {
    if (!pushSupported) {
      showToast("Tu navegador no soporta notificaciones push", "warning");
      return;
    }

    setPushLoading(true);
    try {
      const result = await subscribeToPushApi();
      if (result.success) {
        setPushEnabled(true);
        showToast("¡Notificaciones activadas! Te avisaremos de nuevas convocatorias.", "success");
      } else {
        showToast(result.error || "No se pudo activar notificaciones", "error");
      }
    } catch (error: any) {
      showToast(error.message || "Error al activar notificaciones", "error");
    } finally {
      setPushLoading(false);
    }
  }, [pushSupported, showToast]);

  const unsubscribeFromPush = useCallback(async () => {
    setPushLoading(true);
    try {
      const result = await unsubscribeFromPushApi();
      if (result.success) {
        setPushEnabled(false);
        showToast("Notificaciones desactivadas", "success");
      } else {
        showToast(result.error || "No se pudo desactivar notificaciones", "error");
      }
    } catch (error: any) {
      showToast(error.message || "Error al desactivar notificaciones", "error");
    } finally {
      setPushLoading(false);
    }
  }, [showToast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        showToast,
        // Push notification methods
        isPushSupported: pushSupported,
        isPushEnabled: pushEnabled,
        isPushLoading: pushLoading,
        subscribeToPush,
        unsubscribeFromPush,
      }}
    >
      {children}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={5000}
        />
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
