import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/ui/Toast";
import {
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_CHECKED_AT_ANALYTICS_HEALTH,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTADO_PPS,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ID_ANALYTICS_HEALTH,
  FIELD_ISSUE_COUNT_ANALYTICS_HEALTH,
  FIELD_ISSUES_ANALYTICS_HEALTH,
  FIELD_STATUS_ANALYTICS_HEALTH,
  FIELD_SOLICITUD_NOMBRE_ALUMNO,
  TABLE_NAME_ANALYTICS_HEALTH_CHECKS,
  TABLE_NAME_FINALIZACION,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PPS,
  TABLE_NAME_SOLICITUDES_MODIFICACION,
  TABLE_NAME_SOLICITUDES_NUEVA,
} from "../constants";
import { supabase } from "../lib/supabaseClient";
import ReminderService, { Reminder } from "../services/reminderService";
import { useAuth } from "./AuthContext";
import { logger } from "../utils/logger";
import { usePushNotifications } from "../hooks/notifications/usePushNotifications";
import { useNotificationRealtime } from "../hooks/notifications/useNotificationRealtime";
import { useUnreadBadge } from "../hooks/notifications/useUnreadBadge";
import { playNotificationSound } from "../utils/playNotificationSound";
import type { AppNotification } from "./notificationTypes";
export type { AppNotification } from "./notificationTypes";

type AnalyticsHealthIssue = {
  severity?: string;
  code?: string;
  message?: string;
};

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

/*
  `showToast` va en su propio contexto a propósito.

  De los 7 consumidores, 5 usan ÚNICAMENTE `showToast` — que es un `useCallback`
  con dependencias vacías, o sea estable para siempre. Aun así se re-renderizaban
  cada vez que llegaba una notificación nueva, porque compartían el contexto con
  la bandeja. Con el contexto separado, su valor nunca cambia de identidad y esos
  componentes dejan de re-renderizarse por completo.
*/
interface ToastContextType {
  showToast: (message: string, type: "success" | "error" | "warning") => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authenticatedUser, isSuperUserMode, isJefeMode, isDirectivoMode } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type });
  }, []);

  // Persistencia Local: Set de IDs leídos
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  /*
    Espejo en ref del set de leídos.

    El efecto que arma la bandeja consulta 6 tablas y necesita saber qué está
    leído para marcar cada aviso. Antes lo tomaba del estado y por eso lo tenía
    en sus dependencias: marcar UNA notificación como leída creaba un Set nuevo,
    cambiaba la referencia y volvía a consultar las 6 tablas enteras. Y encima
    ocurría mientras `markAsRead` navegaba al link del aviso.

    Leyéndolo por ref, el efecto ve siempre el valor actual sin depender de él.
    Lo que sí debe esperar es la carga inicial desde localStorage, y para eso
    está `readIdsLoadedFor`, que cambia una sola vez por usuario.
  */
  const readIdsRef = useRef<Set<string>>(readNotificationIds);
  /* Mismo motivo que `readIdsRef`: los handlers necesitan la bandeja actual sin
     depender de ella. */
  const notificationsRef = useRef<AppNotification[]>([]);
  const [readIdsLoadedFor, setReadIdsLoadedFor] = useState<string | null>(null);

  const navigate = useNavigate();

  const isAdmin = isSuperUserMode || isJefeMode || isDirectivoMode;
  const isStudent = !isAdmin && !!authenticatedUser;
  const userId = authenticatedUser?.id || "guest";
  const STORAGE_KEY = `read_notifications_v2_${userId}`;
  const push = usePushNotifications(authenticatedUser?.id, showToast);

  // 0. CARGAR LE�DOS DESDE LOCALSTORAGE
  useEffect(() => {
    if (!authenticatedUser) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const restored = new Set<string>(parsed);
          readIdsRef.current = restored;
          setReadNotificationIds(restored);
        }
      }
    } catch (e) {
      logger.warn("Error cargando notificaciones leídas del storage", e);
    } finally {
      // Se marca cargado incluso si no había nada guardado: la bandeja tiene
      // que armarse igual, y este es el disparador de esa primera carga.
      setReadIdsLoadedFor(userId);
    }
  }, [authenticatedUser, STORAGE_KEY, userId]);

  // Helper para guardar en storage
  const persistReadIds = useCallback(
    (newSet: Set<string>) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSet)));
      readIdsRef.current = newSet;
      setReadNotificationIds(newSet);
    },
    [STORAGE_KEY]
  );

  // 1. LOAD PENDING NOTIFICATIONS & GENERATE REMINDERS
  useEffect(() => {
    if (!authenticatedUser) return;
    // Sin los leídos cargados, todo se marcaría como no leído.
    if (readIdsLoadedFor !== userId) return;

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
            pendingPPS.forEach((req) => {
              const notifId = `pps-${req.id}`;
              loadedNotifications.push({
                id: notifId,
                title: "Solicitud PPS Pendiente",
                message: `${req[FIELD_SOLICITUD_NOMBRE_ALUMNO] || "Estudiante"} solicitó iniciar en ${req[FIELD_EMPRESA_PPS_SOLICITUD] || "Institución"}.`,
                timestamp: new Date(req.created_at ?? ""),
                type: "solicitud_pps",
                link: "/admin/solicitudes?tab=ingreso",
                isRead: readIdsRef.current.has(notifId),
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
            pendingFinals.forEach((req) => {
              const notifId = `fin-${req.id}`;
              const studentData = Array.isArray(req.estudiante)
                ? req.estudiante[0]
                : req.estudiante;
              const studentName = studentData?.[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante";

              loadedNotifications.push({
                id: notifId,
                title: "Acreditación Pendiente",
                message: `${studentName} ha enviado documentación para acreditar.`,
                timestamp: new Date(req.created_at ?? ""),
                type: "acreditacion",
                link: "/admin/solicitudes?tab=egreso",
                isRead: readIdsRef.current.has(notifId),
              });
            });
          }

          // --- C. Solicitudes de Modificación Pendientes ---
          const { data: pendingMods } = await supabase
            .from(TABLE_NAME_SOLICITUDES_MODIFICACION)
            .select(
              `
              id,
              created_at,
              tipo_modificacion,
              estudiante:estudiantes(nombre)
            `
            )
            .eq("estado", "pendiente")
            .order("created_at", { ascending: false })
            .limit(10);

          if (pendingMods) {
            pendingMods.forEach((mod) => {
              const notifId = `mod-${mod.id}`;
              const studentName = Array.isArray(mod.estudiante)
                ? mod.estudiante[0]?.nombre
                : mod.estudiante?.nombre;
              loadedNotifications.push({
                id: notifId,
                title:
                  mod.tipo_modificacion === "eliminacion"
                    ? "Solicitud de Baja de PPS"
                    : "Solicitud de Modificación",
                message:
                  mod.tipo_modificacion === "eliminacion"
                    ? `${studentName || "Estudiante"} solicita la baja de una PPS.`
                    : `${studentName || "Estudiante"} solicita cambio de ${mod.tipo_modificacion}.`,
                timestamp: new Date(mod.created_at ?? ""),
                type: "solicitud_pps",
                link: "/admin/solicitudes",
                isRead: readIdsRef.current.has(notifId),
              });
            });
          }

          // --- D. Solicitudes de Nueva PPS Pendientes ---
          const { data: pendingNewRequests } = await supabase
            .from(TABLE_NAME_SOLICITUDES_NUEVA)
            .select(
              `
              id,
              created_at,
              nombre_institucion_manual,
              estudiante:estudiantes(nombre),
              institucion:instituciones(nombre)
            `
            )
            .eq("estado", "pendiente")
            .order("created_at", { ascending: false })
            .limit(10);

          if (pendingNewRequests) {
            pendingNewRequests.forEach((req) => {
              const notifId = `newpps-${req.id}`;
              const studentName = Array.isArray(req.estudiante)
                ? req.estudiante[0]?.nombre
                : req.estudiante?.nombre;
              const instName =
                (Array.isArray(req.institucion)
                  ? req.institucion[0]?.nombre
                  : req.institucion?.nombre) || req.nombre_institucion_manual;

              loadedNotifications.push({
                id: notifId,
                title: "Nueva PPS Autogestiva",
                message: `${studentName || "Estudiante"} solicita iniciar en ${instName || "Institución"}.`,
                timestamp: new Date(req.created_at ?? ""),
                type: "solicitud_pps",
                link: "/admin/solicitudes",
                isRead: readIdsRef.current.has(notifId),
              });
            });
          }

          // --- E. Salud de analytics ---
          const { data: analyticsHealth, error: analyticsHealthError } = await supabase
            .from(TABLE_NAME_ANALYTICS_HEALTH_CHECKS)
            .select(
              `${FIELD_ID_ANALYTICS_HEALTH}, ${FIELD_CHECKED_AT_ANALYTICS_HEALTH}, ${FIELD_STATUS_ANALYTICS_HEALTH}, ${FIELD_ISSUE_COUNT_ANALYTICS_HEALTH}, ${FIELD_ISSUES_ANALYTICS_HEALTH}`
            )
            .order(FIELD_CHECKED_AT_ANALYTICS_HEALTH, { ascending: false })
            .limit(1)
            .maybeSingle();

          if (analyticsHealthError) {
            logger.warn("No se pudo cargar la salud de analytics", analyticsHealthError);
          } else if (
            analyticsHealth &&
            (analyticsHealth[FIELD_STATUS_ANALYTICS_HEALTH] === "warning" ||
              analyticsHealth[FIELD_STATUS_ANALYTICS_HEALTH] === "critical")
          ) {
            const rawIssues = analyticsHealth[FIELD_ISSUES_ANALYTICS_HEALTH];
            const healthIssues: AnalyticsHealthIssue[] = Array.isArray(rawIssues)
              ? rawIssues.filter(
                  (issue): issue is AnalyticsHealthIssue =>
                    typeof issue === "object" && issue !== null && !Array.isArray(issue)
                )
              : [];
            const primaryIssue =
              healthIssues.find((issue) => issue.severity === "critical") || healthIssues[0];
            const healthId = analyticsHealth[FIELD_ID_ANALYTICS_HEALTH];
            const notifId = `analytics-health-${healthId}`;
            const isCritical = analyticsHealth[FIELD_STATUS_ANALYTICS_HEALTH] === "critical";

            loadedNotifications.push({
              id: notifId,
              title: isCritical ? "Analytics requiere atención" : "Advertencia de analytics",
              message:
                primaryIssue?.message ||
                `Se detectaron ${analyticsHealth[FIELD_ISSUE_COUNT_ANALYTICS_HEALTH]} controles para revisar.`,
              timestamp: new Date(analyticsHealth[FIELD_CHECKED_AT_ANALYTICS_HEALTH]),
              type: "info",
              link: "/admin/metrics",
              isRead: readIdsRef.current.has(notifId),
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
            newLaunches.forEach((l) => {
              const notifId = `launch-${l.id}`;
              loadedNotifications.push({
                id: notifId,
                title: "Nueva Convocatoria",
                message: `${l[FIELD_NOMBRE_PPS_LANZAMIENTOS]} est� abierta para inscripci�n.`,
                timestamp: new Date(l.created_at ?? ""),
                type: "lanzamiento",
                link: "/student",
                isRead: readIdsRef.current.has(notifId),
              });
            });
          }
        }

        // --- D. Recordatorios de Hoy (para Administradores) ---
        if (isAdmin && authenticatedUser?.id) {
          ReminderService.setUserId(authenticatedUser.id);
          const todayReminders = await ReminderService.getTodayReminders();

          todayReminders.forEach((reminder: Reminder) => {
            const notifId = `reminder-${reminder.id}`;
            loadedNotifications.push({
              id: notifId,
              title: `Recordatorio: ${reminder.title}`,
              message: reminder.description || `Tienes un recordatorio pendiente para hoy`,
              timestamp: new Date(reminder.due_date),
              type: "recordatorio",
              link: "/admin",
              isRead: readIdsRef.current.has(notifId),
            });
          });
        }

        loadedNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setNotifications(loadedNotifications);
      } catch (err) {
        logger.error("Error loading notification history:", err);
      }
    };

    fetchNotificationsAndReminders();
  }, [isAdmin, isStudent, authenticatedUser, readIdsLoadedFor, userId]);

  const addNotification = useCallback((notif: AppNotification) => {
    setNotifications((prev) => [notif, ...prev]);
    setToast({ message: notif.title, type: "success" });
    // Note: Push notifications when the page is hidden are handled by the
    // service worker. Do NOT use the native Notification API here as it
    // creates duplicate notifications.
    playNotificationSound();
  }, []);

  useNotificationRealtime({
    userId: authenticatedUser?.id,
    isAdmin,
    isStudent,
    onNotification: addNotification,
  });

  /*
    Los tres handlers leen la bandeja y los leídos por ref en vez de por estado.
    Si dependieran del estado cambiarían de identidad en cada render y el
    `useMemo` del value no serviría de nada -- que es justo lo que ESLint marca.
    Así quedan estables y los consumidores sólo se re-renderizan cuando cambia
    algo que de verdad les importa.
  */
  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      const newSet = new Set<string>(readIdsRef.current);
      newSet.add(id);
      persistReadIds(newSet);
      const target = notificationsRef.current.find((n) => n.id === id);
      if (target && target.link) navigate(target.link);
    },
    [navigate, persistReadIds]
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    const newSet = new Set<string>(readIdsRef.current);
    notificationsRef.current.forEach((n) => newSet.add(n.id));
    persistReadIds(newSet);
  }, [persistReadIds]);

  const clearNotifications = useCallback(() => {
    markAllAsRead();
    setNotifications([]);
  }, [markAllAsRead]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  useUnreadBadge(unreadCount);

  // `showToast` es estable, así que este valor nunca cambia de identidad.
  const toastValue = useMemo(() => ({ showToast }), [showToast]);

  const notificationValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      showToast,
      isPushSupported: push.isSupported,
      isPushEnabled: push.isEnabled,
      isPushLoading: push.isLoading,
      subscribeToPush: push.subscribe,
      unsubscribeFromPush: push.unsubscribe,
    }),
    [
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      showToast,
      push.isSupported,
      push.isEnabled,
      push.isLoading,
      push.subscribe,
      push.unsubscribe,
    ]
  );

  return (
    <ToastContext.Provider value={toastValue}>
      <NotificationContext.Provider value={notificationValue}>
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
    </ToastContext.Provider>
  );
};

/**
 * Para componentes que sólo necesitan avisar algo. No se suscribe a la bandeja,
 * así que no se re-renderiza cuando llegan notificaciones.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a NotificationProvider");
  }
  return context;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
