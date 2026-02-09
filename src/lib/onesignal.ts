// OneSignal Integration - Custom Code Setup
// Documentation: https://documentation.onesignal.com/docs/custom-code-setup

const ONESIGNAL_APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID || "53f3327c-9553-41fc-919e-73161c8517f7";
const ONESIGNAL_SAFARI_WEB_ID =
  import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID ||
  "web.onesignal.auto.14e17240-829a-4079-8f1d-24e0d0f74783";

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

// Sistema de logs para debuggear en móvil
const DEBUG_LOGS: string[] = [];
const logDebug = (msg: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${msg}`;
  DEBUG_LOGS.push(logEntry);
  console.log(logEntry);
  // Mantener solo últimos 50 logs
  if (DEBUG_LOGS.length > 50) DEBUG_LOGS.shift();
  // Guardar en localStorage para poder recuperar
  try {
    localStorage.setItem("onesignal_debug_logs", JSON.stringify(DEBUG_LOGS));
  } catch (e) {}
};

export const getDebugLogs = (): string[] => {
  try {
    const stored = localStorage.getItem("onesignal_debug_logs");
    return stored ? JSON.parse(stored) : DEBUG_LOGS;
  } catch (e) {
    return DEBUG_LOGS;
  }
};

export const initializeOneSignal = async () => {
  if (!ONESIGNAL_APP_ID) {
    logDebug("App ID not configured");
    return;
  }

  try {
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.OneSignalDeferred.push((OneSignal: any) => {
      const initConfig: any = {
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerParam: { scope: "/consulta-pps-uflo/" },
        serviceWorkerPath: "consulta-pps-uflo/OneSignalSDKWorker.js",
        notifyButton: { enable: false },
        autoRegister: false,
        // DESACTIVAR TODOS LOS PROMPTS automáticos
        promptOptions: {
          slidedown: { enabled: false, autoPrompt: false },
          native: { enabled: false, autoPrompt: false },
        },
        subscription: { autoResubscribe: false },
      };

      if (ONESIGNAL_SAFARI_WEB_ID) {
        initConfig.safari_web_id = ONESIGNAL_SAFARI_WEB_ID;
      }

      OneSignal.init(initConfig)
        .then(() => {
          logDebug("OneSignal initialized successfully");
        })
        .catch((err: any) => {
          logDebug(`OneSignal init error: ${err.message}`);
        });
    });

    logDebug("OneSignal initialization queued");
  } catch (error: any) {
    logDebug(`Initialization error: ${error.message}`);
  }
};

import { supabase } from "./supabaseClient";

export const subscribeToOneSignal = async (userId?: string) => {
  logDebug(`Starting subscription for user: ${userId}`);

  try {
    if (!window.OneSignal) {
      logDebug("ERROR: OneSignal not loaded");
      return {
        success: false,
        error: "OneSignal no está disponible. Recargá la página.",
        logs: getDebugLogs(),
      };
    }

    // Paso 1: Verificar permiso del navegador
    let browserPermission: NotificationPermission = "default";
    try {
      browserPermission = Notification.permission;
      logDebug(`Browser permission: ${browserPermission}`);
    } catch (e) {
      logDebug(`Cannot check notification permission: ${e}`);
    }

    if (browserPermission === "denied") {
      logDebug("Permission denied by browser");
      return {
        success: false,
        error:
          "Notificaciones bloqueadas. Para activar: Configuración del navegador → Sitio → Notificaciones → Permitir",
        blocked: true,
        logs: getDebugLogs(),
      };
    }

    // Paso 2: Intentar obtener estado actual de OneSignal
    let currentOptedIn = false;
    let existingPlayerId: string | null = null;

    try {
      const subscription = await window.OneSignal.User.PushSubscription;
      existingPlayerId = subscription?.id || null;
      currentOptedIn = subscription?.optedIn || false;
      logDebug(
        `Current state - optedIn: ${currentOptedIn}, playerId: ${existingPlayerId || "none"}`
      );
    } catch (e: any) {
      logDebug(`Could not get subscription state: ${e.message}`);
    }

    // Si ya está suscrito con ID válido, solo guardar
    if (currentOptedIn && existingPlayerId) {
      logDebug("Already subscribed with valid ID");
      if (userId) {
        await saveToDatabase(userId, existingPlayerId);
      }
      return { success: true, playerId: existingPlayerId, alreadySubscribed: true };
    }

    // Paso 3: Si no tiene permiso, SOLICITARLO
    if (browserPermission !== "granted") {
      logDebug("Requesting browser permission...");

      try {
        const permission = await Notification.requestPermission();
        logDebug(`Permission result: ${permission}`);

        if (permission === "denied") {
          return {
            success: false,
            error: "Bloqueaste las notificaciones. Activalas en la configuración del navegador.",
            blocked: true,
            logs: getDebugLogs(),
          };
        }

        if (permission !== "granted") {
          return {
            success: false,
            error: "No se concedió el permiso. Intentá de nuevo.",
            logs: getDebugLogs(),
          };
        }
      } catch (e: any) {
        logDebug(`Error requesting permission: ${e.message}`);
        // En móvil a veces falla, continuar de todas formas
      }
    }

    // Paso 4: Intentar opt-in en OneSignal
    logDebug("Attempting OneSignal optIn...");
    let optInSuccess = false;

    try {
      await window.OneSignal.User.PushSubscription.optIn();
      optInSuccess = true;
      logDebug("optIn called successfully");
    } catch (e: any) {
      logDebug(`optIn error (may be already opted in): ${e.message}`);
      // Puede fallar si ya está opt-in, eso está bien
      optInSuccess = true;
    }

    // Paso 5: Esperar y obtener player ID con timeout
    logDebug("Waiting for player ID...");
    let playerId: string | null = null;
    const maxAttempts = 30; // 6 segundos

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const sub = await window.OneSignal.User.PushSubscription;
        if (sub?.id) {
          playerId = sub.id;
          logDebug(`Got player ID: ${playerId}`);
          break;
        }
      } catch (e) {
        // ignorar
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!playerId) {
      logDebug("ERROR: Timeout waiting for player ID");
      return {
        success: false,
        error:
          "No se pudo completar la suscripción. Intentá: 1) Recargar la página 2) Asegurarte de tener conexión 3) Intentar de nuevo",
        logs: getDebugLogs(),
      };
    }

    // Paso 6: Guardar en base de datos
    if (userId) {
      const saved = await saveToDatabase(userId, playerId);
      if (!saved) {
        logDebug("WARNING: Could not save to database but subscription succeeded");
      }
    }

    // Paso 7: Verificación final
    try {
      const finalSub = await window.OneSignal.User.PushSubscription;
      if (finalSub?.optedIn) {
        logDebug("SUCCESS: Subscription verified");
        return { success: true, playerId };
      } else {
        logDebug("WARNING: Subscription created but not opted in");
        return {
          success: true,
          playerId,
          warning: "Suscripción creada pero puede no estar activa",
        };
      }
    } catch (e) {
      logDebug("Verification failed but returning success anyway");
      return { success: true, playerId };
    }
  } catch (error: any) {
    logDebug(`FATAL ERROR: ${error.message}`);
    return {
      success: false,
      error: `Error inesperado: ${error.message}. Intentá recargar la página.`,
      logs: getDebugLogs(),
    };
  }
};

async function saveToDatabase(userId: string, playerId: string): Promise<boolean> {
  try {
    logDebug(`Saving to DB: user=${userId}, player=${playerId}`);
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        onesignal_player_id: playerId,
        endpoint: `onesignal:${playerId}`,
        p256dh: "onesignal",
        auth: "onesignal",
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id" }
    );

    if (error) {
      logDebug(`DB save error: ${error.message}`);
      return false;
    }
    logDebug("DB save successful");
    return true;
  } catch (e: any) {
    logDebug(`DB exception: ${e.message}`);
    return false;
  }
}

export const unsubscribeFromOneSignal = async () => {
  try {
    if (!window.OneSignal) {
      return { success: false, error: "OneSignal not available" };
    }
    await window.OneSignal.User.PushSubscription.optOut();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const isOneSignalSubscribed = async () => {
  try {
    if (!window.OneSignal) return false;
    const subscription = await window.OneSignal.User.PushSubscription;
    return subscription?.optedIn || false;
  } catch {
    return false;
  }
};

export const getOneSignalPlayerId = async () => {
  try {
    if (!window.OneSignal) return null;
    const subscription = await window.OneSignal.User.PushSubscription;
    return subscription?.id || null;
  } catch {
    return null;
  }
};

export const getOneSignalUserId = getOneSignalPlayerId;
