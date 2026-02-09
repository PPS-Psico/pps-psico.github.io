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

// Función para desregistrar Service Workers conflictivos
const unregisterConflictingServiceWorkers = async (): Promise<boolean> => {
  try {
    if (!("serviceWorker" in navigator)) {
      return true;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    logDebug(`Found ${registrations.length} existing service worker registrations`);

    let unregistered = false;
    for (const registration of registrations) {
      // Si hay un SW que NO es de OneSignal, desregistrarlo
      if (
        !registration.scope.includes("OneSignal") &&
        !registration.active?.scriptURL?.includes("OneSignalSDK")
      ) {
        logDebug(`Unregistering conflicting SW: ${registration.scope}`);
        await registration.unregister();
        unregistered = true;
      }
    }

    return unregistered;
  } catch (e: any) {
    logDebug(`Error unregistering SWs: ${e.message}`);
    return false;
  }
};

export const initializeOneSignal = async () => {
  if (!ONESIGNAL_APP_ID) {
    logDebug("App ID not configured");
    return;
  }

  try {
    // Desregistrar SWs conflictivos antes de inicializar OneSignal
    const hadConflicts = await unregisterConflictingServiceWorkers();
    if (hadConflicts) {
      logDebug("Unregistered conflicting service workers, reloading page in 1s...");
      // Recargar la página para que OneSignal pueda registrar su SW limpio
      setTimeout(() => window.location.reload(), 1000);
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.OneSignalDeferred.push((OneSignal: any) => {
      // Detectar si estamos en GitHub Pages con subdirectorio
      const isGitHubPages =
        window.location.hostname === "pps-psico.github.io" ||
        window.location.hostname.includes("github.io");

      // Para GitHub Pages con subdirectorio, usar path relativo
      // OneSignal no soporta subdirectorios en Site URL, así que usamos paths relativos
      const basePath = isGitHubPages ? "/consulta-pps-uflo/" : "/";

      const initConfig: any = {
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        // CAMBIO CLAVE: Usar path relativo para GitHub Pages
        // OneSignal Site URL está configurado sin subdirectorio, así que usamos paths relativos
        serviceWorkerParam: { scope: basePath },
        serviceWorkerPath: "OneSignalSDKWorker.js", // Path relativo, no absoluto
        notifyButton: { enable: false },
        autoRegister: false,
        // DESACTIVAR TODOS LOS PROMPTS automáticos
        promptOptions: {
          slidedown: { enabled: false, autoPrompt: false },
          native: { enabled: false, autoPrompt: false },
        },
        subscription: { autoResubscribe: true }, // CAMBIADO: activar auto-resubscribe para prevenir opt-out
        // Agregar configuración adicional para debug
        welcomeNotification: {
          disable: true, // Desactivar welcome notification automático
        },
      };

      if (isGitHubPages) {
        logDebug(`GitHub Pages detected - Using relative paths for Service Worker`);
        logDebug(`Base path: ${basePath}, SW path: ${initConfig.serviceWorkerPath}`);
      }

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

    // Paso 5: Esperar y obtener player ID con timeout extendido
    logDebug("Waiting for player ID...");
    let playerId: string | null = null;
    let subscriptionToken: string | null = null;
    const maxAttempts = 50; // 10 segundos

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const sub = await window.OneSignal.User.PushSubscription;
        if (sub?.id && sub?.token) {
          playerId = sub.id;
          subscriptionToken = sub.token;
          logDebug(`Got player ID: ${playerId}, token exists: ${!!subscriptionToken}`);
          break;
        } else if (sub?.id) {
          // Tenemos ID pero no token aún, seguir esperando
          logDebug(`Got player ID but waiting for token... attempt ${i + 1}`);
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

    if (!subscriptionToken) {
      logDebug("ERROR: Player ID obtained but no subscription token");
      return {
        success: false,
        error:
          "La suscripción no se completó correctamente. Intentá recargar la página y activar nuevamente.",
        logs: getDebugLogs(),
      };
    }

    // Paso 6: Verificación CRÍTICA - esperar a que OneSignal confirme el registro
    logDebug("Verifying subscription with OneSignal...");
    let verified = false;
    for (let i = 0; i < 10; i++) {
      try {
        const sub = await window.OneSignal.User.PushSubscription;
        // Verificar que optedIn sea true y que tengamos token
        if (sub?.optedIn && sub?.token) {
          verified = true;
          logDebug("Subscription verified with OneSignal");
          break;
        }
      } catch (e) {
        // ignorar
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!verified) {
      logDebug("ERROR: Subscription not verified with OneSignal");
      return {
        success: false,
        error:
          "OneSignal no confirmó la suscripción. Intentá: 1) Recargar la página 2) Asegurarte de tener conexión estable 3) Intentar de nuevo",
        logs: getDebugLogs(),
      };
    }

    // Paso 7: Guardar en base de datos SOLO si está verificado
    if (userId) {
      const saved = await saveToDatabase(userId, playerId);
      if (!saved) {
        logDebug("WARNING: Could not save to database but subscription succeeded");
      }
    }

    logDebug("SUCCESS: Subscription completed and verified");
    return { success: true, playerId };
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

// ============================================================================
// DIAGNÓSTICO PROFUNDO - Para debuggear problemas de suscripción
// ============================================================================

export interface OneSignalDiagnostics {
  playerId: string | null;
  optedIn: boolean;
  token: string | null;
  subscriptionState: any;
  serviceWorkerInfo: any;
  browserInfo: {
    userAgent: string;
    url: string;
    protocol: string;
    hostname: string;
  };
  notificationPermission: NotificationPermission | "unsupported";
  errors: string[];
  timestamp: string;
}

export const runOneSignalDiagnostics = async (): Promise<OneSignalDiagnostics> => {
  const errors: string[] = [];
  const diagnostics: OneSignalDiagnostics = {
    playerId: null,
    optedIn: false,
    token: null,
    subscriptionState: null,
    serviceWorkerInfo: null,
    browserInfo: {
      userAgent: navigator.userAgent,
      url: window.location.href,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    },
    notificationPermission: "default",
    errors,
    timestamp: new Date().toISOString(),
  };

  logDebug("Running OneSignal diagnostics...");

  // 1. Verificar permisos del navegador
  try {
    if ("Notification" in window) {
      diagnostics.notificationPermission = Notification.permission;
      logDebug(`Notification permission: ${diagnostics.notificationPermission}`);
    } else {
      diagnostics.notificationPermission = "unsupported";
      errors.push("Notifications not supported in this browser");
    }
  } catch (e: any) {
    errors.push(`Notification permission check failed: ${e.message}`);
  }

  // 2. Verificar Service Worker
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      diagnostics.serviceWorkerInfo = {
        count: registrations.length,
        registrations: registrations.map((r) => ({
          scope: r.scope,
          state: r.active?.state || "inactive",
          scriptURL: r.active?.scriptURL,
        })),
      };
      logDebug(`Service Worker registrations: ${registrations.length}`);
    } else {
      errors.push("Service Workers not supported");
    }
  } catch (e: any) {
    errors.push(`Service Worker check failed: ${e.message}`);
  }

  // 3. Verificar estado de OneSignal
  if (!window.OneSignal) {
    errors.push("OneSignal SDK not loaded");
    return diagnostics;
  }

  try {
    const subscription = await window.OneSignal.User.PushSubscription;
    diagnostics.subscriptionState = subscription;
    diagnostics.playerId = subscription?.id || null;
    diagnostics.optedIn = subscription?.optedIn || false;
    diagnostics.token = subscription?.token || null;

    logDebug(
      `OneSignal state - ID: ${diagnostics.playerId}, optedIn: ${diagnostics.optedIn}, hasToken: ${!!diagnostics.token}`
    );
  } catch (e: any) {
    errors.push(`Failed to get OneSignal subscription: ${e.message}`);
  }

  // 4. Verificar configuración de OneSignal
  try {
    const onesignalConfig = await window.OneSignal?.config;
    logDebug(`OneSignal config: ${JSON.stringify(onesignalConfig)}`);
  } catch (e: any) {
    errors.push(`Failed to get OneSignal config: ${e.message}`);
  }

  // 5. Verificar si hay un OneSignal Player ID en localStorage
  try {
    const localPlayerId = localStorage.getItem("onesignal_player_id");
    if (localPlayerId) {
      logDebug(`LocalStorage player ID: ${localPlayerId}`);
      if (diagnostics.playerId && diagnostics.playerId !== localPlayerId) {
        errors.push(`Player ID mismatch: local=${localPlayerId}, current=${diagnostics.playerId}`);
      }
    }
  } catch (e: any) {
    errors.push(`Failed to check localStorage: ${e.message}`);
  }

  // Guardar diagnósticos en localStorage para referencia
  try {
    localStorage.setItem("onesignal_diagnostics", JSON.stringify(diagnostics));
  } catch (e) {}

  return diagnostics;
};

export const getStoredDiagnostics = (): OneSignalDiagnostics | null => {
  try {
    const stored = localStorage.getItem("onesignal_diagnostics");
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

// Función para verificar si una suscripción está realmente activa en OneSignal
export const verifyOneSignalSubscription = async (
  playerId: string
): Promise<{
  valid: boolean;
  reason?: string;
  apiResponse?: any;
}> => {
  try {
    // Llamar al backend para verificar el estado real del player ID
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onesignal-verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ player_id: playerId }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { valid: false, reason: `API error: ${error}` };
    }

    const data = await response.json();
    return {
      valid: data.valid || false,
      reason: data.reason,
      apiResponse: data,
    };
  } catch (e: any) {
    return { valid: false, reason: `Network error: ${e.message}` };
  }
};
