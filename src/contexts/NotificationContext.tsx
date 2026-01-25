
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import {
    TABLE_NAME_PPS,
    TABLE_NAME_FINALIZACION,
    FIELD_SOLICITUD_NOMBRE_ALUMNO,
    FIELD_EMPRESA_PPS_SOLICITUD,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_ESTADO_PPS,
    FIELD_ESTADO_FINALIZACION,
    TABLE_NAME_LANZAMIENTOS_PPS,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    TABLE_NAME_CONVOCATORIAS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_FECHA_SOLICITUD_FINALIZACION,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS
} from '../constants';
import Toast from '../components/ui/Toast';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    timestamp: Date;
    type: 'solicitud_pps' | 'acreditacion' | 'info' | 'recordatorio' | 'estado' | 'lanzamiento';
    link: string;
    isRead: boolean;
}

interface NotificationContextType {
    notifications: AppNotification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearNotifications: () => void;
    subscribeToPush: () => Promise<void>;
    unsubscribeFromPush: () => Promise<void>;
    isPushEnabled: boolean;
    showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { authenticatedUser, isSuperUserMode, isJefeMode, isDirectivoMode } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
    const [isPushEnabled, setIsPushEnabled] = useState(false);

    // Persistencia Local: Set de IDs leídos
    const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());

    const navigate = useNavigate();

    const isAdmin = isSuperUserMode || isJefeMode || isDirectivoMode;
    const isStudent = !isAdmin && !!authenticatedUser;
    const userId = authenticatedUser?.id || 'guest';
    const STORAGE_KEY = `read_notifications_v2_${userId}`;
    const PUSH_STORAGE_KEY = `push_enabled_${userId}`;

    // Check Push Permission on Mount
    useEffect(() => {
        // 1. Check real service worker subscription status first
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(subscription => {
                    if (subscription) {
                        setIsPushEnabled(true);
                        localStorage.setItem(PUSH_STORAGE_KEY, 'true'); // Sync
                    }
                });
            });
        }

        // 2. Check local storage override if permission is already granted but no active sub retrieved yet
        const storedPush = localStorage.getItem(PUSH_STORAGE_KEY);
        if (storedPush === 'true' && Notification.permission === 'granted') {
            setIsPushEnabled(true);
        }
    }, [PUSH_STORAGE_KEY]);

    const subscribeToPush = async () => {
        if (!authenticatedUser) return;

        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                throw new Error('Tu navegador no soporta notificaciones push.');
            }

            // Check for iOS
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            if (isIOS && !('standalone' in window.navigator) && !(window.navigator as any).standalone) {
                // In iOS, push usually requires PWA installation, but we proceed to request permission anyway
            }

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Permiso de notificaciones denegado. Habilítalo en la configuración del navegador.');
            }

            // Immediately update state if permission granted
            setIsPushEnabled(true);
            localStorage.setItem(PUSH_STORAGE_KEY, 'true');

            const registration = await navigator.serviceWorker.ready;

            const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

            if (!vapidPublicKey) {
                console.warn("VITE_VAPID_PUBLIC_KEY not defined. Push notifications will not work securely.");
                throw new Error("Configuración de notificaciones incompleta (Falta VAPID Key). Contacta al soporte.");
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey
            });

            // Save subscription to Supabase
            if (subscription) {
                // Serialize keys properly
                const p256dh = subscription.getKey('p256dh');
                const auth = subscription.getKey('auth');

                if (!p256dh || !auth) throw new Error("No se pudieron generar las llaves de encriptación.");

                const subscriptionData = {
                    user_id: authenticatedUser.id,
                    endpoint: subscription.endpoint,
                    p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(p256dh) as any)),
                    auth: btoa(String.fromCharCode.apply(null, new Uint8Array(auth) as any))
                };

                const { error: dbError } = await supabase
                    .from('push_subscriptions')
                    .upsert(subscriptionData, { onConflict: 'user_id, endpoint' });

                if (dbError) throw new Error("Error al guardar suscripción en servidor: " + dbError.message);

                console.log("✅ Push Subscription saved:", subscriptionData);
            }

            setToast({ message: 'Notificaciones activadas correctamente.', type: 'success' });

            // Send a test notification immediately if supported to confirm
            if (registration.showNotification) {
                registration.showNotification('¡Activado!', {
                    body: 'Recibirás avisos de nuevas convocatorias aquí.',
                    icon: '/icons/icon-192x192.png'
                });
            }

        } catch (e: any) {
            console.error('Push subscription error:', e);
            let msg = 'No se pudieron activar las notificaciones.';
            if (e.message) msg = e.message;
            setToast({ message: msg, type: 'error' });
            setIsPushEnabled(false); // Revert on error
            localStorage.removeItem(PUSH_STORAGE_KEY);
        }
    };

    const unsubscribeFromPush = async () => {
        if (!authenticatedUser) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // 1. Remove from Supabase
                const { error: dbError } = await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', authenticatedUser.id)
                    .eq('endpoint', subscription.endpoint);

                if (dbError) console.error("Error removing sub from DB:", dbError);

                // 2. Unsubscribe from Browser
                await subscription.unsubscribe();
            }

            setIsPushEnabled(false);
            localStorage.removeItem(PUSH_STORAGE_KEY);
            setToast({ message: 'Notificaciones desactivadas.', type: 'success' });

        } catch (e: any) {
            console.error('Unsubscribe error:', e);
            setToast({ message: 'Error al desactivar notificaciones.', type: 'error' });
        }
    };

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
                        .select(`id, created_at, ${FIELD_SOLICITUD_NOMBRE_ALUMNO}, ${FIELD_EMPRESA_PPS_SOLICITUD}`)
                        .eq(FIELD_ESTADO_PPS, 'Pendiente')
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (pendingPPS) {
                        pendingPPS.forEach((req: any) => {
                            const notifId = `pps-${req.id}`;
                            loadedNotifications.push({
                                id: notifId,
                                title: 'Solicitud PPS Pendiente',
                                message: `${req[FIELD_SOLICITUD_NOMBRE_ALUMNO] || 'Estudiante'} solicitó iniciar en ${req[FIELD_EMPRESA_PPS_SOLICITUD] || 'Institución'}.`,
                                timestamp: new Date(req.created_at),
                                type: 'solicitud_pps',
                                link: '/admin/solicitudes?tab=ingreso',
                                isRead: readNotificationIds.has(notifId)
                            });
                        });
                    }

                    // --- B. Solicitudes de Acreditación (Finalización) Pendientes ---
                    const { data: pendingFinals } = await supabase
                        .from(TABLE_NAME_FINALIZACION)
                        .select(`
                            id, 
                            created_at, 
                            ${FIELD_FECHA_SOLICITUD_FINALIZACION}, 
                            estudiante:estudiantes!fk_finalizacion_estudiante (
                                ${FIELD_NOMBRE_ESTUDIANTES}
                            )
                        `)
                        .eq(FIELD_ESTADO_FINALIZACION, 'Pendiente')
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (pendingFinals) {
                        pendingFinals.forEach((req: any) => {
                            const notifId = `fin-${req.id}`;
                            const studentData = Array.isArray(req.estudiante) ? req.estudiante[0] : req.estudiante;
                            const studentName = studentData?.[FIELD_NOMBRE_ESTUDIANTES] || 'Estudiante';

                            loadedNotifications.push({
                                id: notifId,
                                title: 'Acreditación Pendiente',
                                message: `${studentName} ha enviado documentación para acreditar.`,
                                timestamp: new Date(req.created_at),
                                type: 'acreditacion',
                                link: '/admin/solicitudes?tab=egreso',
                                isRead: readNotificationIds.has(notifId)
                            });
                        });
                    }

                } else if (isStudent) {
                    // --- C. Nuevos Lanzamientos (Student) ---
                    // Fetch recent launches (last 7 days) that are 'Abierta'
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                    const { data: newLaunches } = await supabase
                        .from(TABLE_NAME_LANZAMIENTOS_PPS)
                        .select(`id, created_at, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS}`)
                        .eq(FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS, 'Abierta')
                        .gt('created_at', sevenDaysAgo.toISOString())
                        .order('created_at', { ascending: false });

                    if (newLaunches) {
                        newLaunches.forEach((l: any) => {
                            const notifId = `launch-${l.id}`;
                            loadedNotifications.push({
                                id: notifId,
                                title: 'Nueva Convocatoria',
                                message: `${l[FIELD_NOMBRE_PPS_LANZAMIENTOS]} está abierta para inscripción.`,
                                timestamp: new Date(l.created_at),
                                type: 'lanzamiento',
                                link: '/student',
                                isRead: readNotificationIds.has(notifId)
                            });
                        });
                    }
                }

                // Sort merged list by date desc
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

        const channel = supabase.channel(channelName)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: TABLE_NAME_PPS },
                async (payload: any) => {
                    if (!isAdmin) return; // Only admins see new requests
                    if (!payload || !payload.new) return;

                    const newRecord = payload.new;
                    const notifId = `pps-${newRecord.id}`;

                    const newNotif: AppNotification = {
                        id: notifId,
                        title: 'Nueva Solicitud de PPS',
                        message: `Nueva solicitud de inicio recibida.`,
                        timestamp: new Date(),
                        type: 'solicitud_pps',
                        link: '/admin/solicitudes?tab=ingreso',
                        isRead: false
                    };

                    addNotification(newNotif);
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: TABLE_NAME_FINALIZACION },
                async (payload: any) => {
                    if (!isAdmin) return; // Only admins see new accreditation requests
                    if (!payload || !payload.new) return;

                    const newRecord = payload.new;
                    const notifId = `fin-${newRecord.id}`;

                    // We might not have the student name immediately available in the INSERT payload
                    // but we can show a generic message or fetch details if critical.
                    const newNotif: AppNotification = {
                        id: notifId,
                        title: 'Nueva Solicitud de Acreditación',
                        message: `Un estudiante ha enviado documentación para finalizar.`,
                        timestamp: new Date(),
                        type: 'acreditacion',
                        link: '/admin/solicitudes?tab=egreso',
                        isRead: false
                    };

                    addNotification(newNotif);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: TABLE_NAME_LANZAMIENTOS_PPS }, // Listen to INSERT and UPDATE
                async (payload: any) => {
                    if (!isStudent) return; // Only students get notified of new launches

                    const newRecord = payload.new;
                    if (!newRecord) return;

                    // Trigger if it's a NEW active launch OR an update that sets it to 'Abierta'
                    const isNewActive = payload.eventType === 'INSERT' && newRecord[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === 'Abierta';
                    const isBecameActive = payload.eventType === 'UPDATE' &&
                        newRecord[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === 'Abierta' &&
                        payload.old?.[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] !== 'Abierta';

                    if (isNewActive || isBecameActive) {
                        const notifId = `launch-realtime-${newRecord.id}`;
                        const newNotif: AppNotification = {
                            id: notifId,
                            title: '¡Nueva Oportunidad de PPS!',
                            message: `Se ha abierto la inscripción para ${newRecord[FIELD_NOMBRE_PPS_LANZAMIENTOS]}.`,
                            timestamp: new Date(),
                            type: 'lanzamiento',
                            link: '/student', // Link to home where cards are
                            isRead: false
                        };
                        addNotification(newNotif);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: TABLE_NAME_CONVOCATORIAS },
                async (payload: any) => {
                    if (!isStudent) return; // Only students care about their status changes here

                    const newRecord = payload.new;
                    const oldRecord = payload.old;

                    const studentIdInRecord = newRecord[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
                    // Clean array format if necessary
                    const cleanId = Array.isArray(studentIdInRecord) ? studentIdInRecord[0] : studentIdInRecord;

                    // If we have the current user ID, compare.
                    if (authenticatedUser && cleanId === authenticatedUser.id) {
                        if (newRecord[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] !== oldRecord[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) {
                            const newState = newRecord[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS];
                            let msg = `Tu estado ha cambiado a: ${newState}`;
                            if (newState === 'Seleccionado') msg = '¡Felicitaciones! Has sido Seleccionado para la PPS.';

                            const newNotif: AppNotification = {
                                id: `conv-update-${newRecord.id}-${Date.now()}`,
                                title: 'Actualización de Postulación',
                                message: msg,
                                timestamp: new Date(),
                                type: 'estado',
                                link: '/student/solicitudes',
                                isRead: false
                            };
                            addNotification(newNotif);
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
        setNotifications(prev => [notif, ...prev]);
        setToast({ message: notif.title, type: 'success' });

        // System Notification Bridge (Native Android/Desktop)
        if (isPushEnabled && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                if (registration.showNotification) {
                    registration.showNotification(notif.title, {
                        body: notif.message,
                        icon: '/icons/icon-192x192.png',
                        data: { url: notif.link } // Used by SW click handler
                    });
                }
            });
        } else if (Notification.permission === 'granted' && document.hidden) {
            // Fallback for non-SW environments or desktop if SW fails
            new Notification(notif.title, { body: notif.message, icon: '/icons/icon-192x192.png' });
        }

        try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { }); } catch (e) { }
    };

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        const newSet = new Set<string>(readNotificationIds);
        newSet.add(id);
        persistReadIds(newSet);
        const target = notifications.find(n => n.id === id);
        if (target && target.link) navigate(target.link);
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        const newSet = new Set<string>(readNotificationIds);
        notifications.forEach(n => newSet.add(n.id));
        persistReadIds(newSet);
    };

    const clearNotifications = () => {
        markAllAsRead();
        setNotifications([]);
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
        setToast({ message, type });
    }, []);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            clearNotifications,
            subscribeToPush,
            unsubscribeFromPush,
            isPushEnabled,
            showToast
        }}>
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
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
