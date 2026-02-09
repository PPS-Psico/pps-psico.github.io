// OneSignal Integration - Custom Code Setup
// Documentation: https://documentation.onesignal.com/docs/custom-code-setup

// OneSignal Configuration
// Using hardcoded values (publishable keys - safe to expose in frontend)
// These are the same keys from GitHub Secrets but hardcoded to avoid env issues
const ONESIGNAL_APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID || "53f3327c-9553-41fc-919e-73161c8517f7";
const ONESIGNAL_SAFARI_WEB_ID =
  import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID ||
  "web.onesignal.auto.14e17240-829a-4079-8f1d-24e0d0f74783";

// Extend Window interface for OneSignal
declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

export const initializeOneSignal = async () => {
  if (!ONESIGNAL_APP_ID) {
    console.warn("[OneSignal] App ID not configured");
    return;
  }

  try {
    // Initialize OneSignal Deferred Array
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    // Push initialization function
    window.OneSignalDeferred.push((OneSignal: any) => {
      const initConfig: any = {
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerParam: { scope: "/consulta-pps-uflo/" },
        serviceWorkerPath: "consulta-pps-uflo/OneSignalSDKWorker.js",
        notifyButton: {
          enable: false, // Usamos nuestro propio botón, no el de OneSignal
        },
        // NO registrar automáticamente - esperar a que el usuario haga clic
        autoRegister: false,
        // Configurar Slidedown Prompt en español
        promptOptions: {
          slidedown: {
            enabled: true,
            autoPrompt: false,
            pageViews: 999,
            timeDelay: 999,
            actionMessage: "📬 ¿Querés recibir notificaciones?",
            acceptButtonText: "Sí, activar",
            cancelButtonText: "No, gracias",
            confirmMessage: "Te avisaremos cuando haya nuevas convocatorias PPS disponibles.",
          },
          native: {
            enabled: false,
            autoPrompt: false,
          },
        },
        // Desactivar todas las suscripciones automáticas
        subscription: {
          autoResubscribe: false,
        },
      };

      // Agregar Safari Web ID si está configurado
      if (ONESIGNAL_SAFARI_WEB_ID) {
        initConfig.safari_web_id = ONESIGNAL_SAFARI_WEB_ID;
      }

      OneSignal.init(initConfig);
    });

    console.log("[OneSignal] Initialized successfully");
  } catch (error) {
    console.error("[OneSignal] Initialization error:", error);
  }
};

import { supabase } from "./supabaseClient";

// Helper function to save player ID to database
async function savePlayerIdToDatabase(userId: string, playerId: string) {
  try {
    console.log("[OneSignal] Saving to database - userId:", userId, "playerId:", playerId);
    const { data, error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        onesignal_player_id: playerId,
        endpoint: `onesignal:${playerId}`,
        p256dh: "onesignal",
        auth: "onesignal",
        updated_at: new Date().toISOString(),
      } as any,
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.error("[OneSignal] Error saving to database:", error);
      throw error;
    } else {
      console.log("[OneSignal] Player ID saved successfully");
      return true;
    }
  } catch (dbError) {
    console.error("[OneSignal] Database error:", dbError);
    throw dbError;
  }
}

export const subscribeToOneSignal = async (
  userId?: string
): Promise<{
  success: boolean;
  error?: string;
  playerId?: string;
  requiresUserAction?: boolean;
}> => {
  try {
    if (!window.OneSignal) {
      console.error("[OneSignal] Not loaded - reloading page may fix this");
      return {
        success: false,
        error: "OneSignal no está cargado. Recargá la página e intentá de nuevo.",
      };
    }

    console.log("[OneSignal] Starting subscription process for user:", userId);

    // Paso 1: Verificar estado actual del permiso del navegador
    const browserPermission = Notification.permission;
    console.log("[OneSignal] Browser permission status:", browserPermission);

    // Si está bloqueado, no se puede hacer nada automáticamente
    if (browserPermission === "denied") {
      console.warn("[OneSignal] Permission denied by user");
      return {
        success: false,
        error:
          "Las notificaciones están bloqueadas. Para activarlas: 1) Click en el 🔒 al lado de la URL, 2) Sitio configuración, 3) Notificaciones: Permitir, 4) Recargá la página",
        requiresUserAction: true,
      };
    }

    // Paso 2: Si ya está concedido, verificar si tenemos player ID válido
    if (browserPermission === "granted") {
      console.log("[OneSignal] Permission already granted, checking subscription...");

      // Intentar obtener player ID existente
      let attempts = 0;
      let playerId = null;

      while (attempts < 10 && !playerId) {
        playerId = await getOneSignalPlayerId();
        if (playerId) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
        attempts++;
      }

      if (playerId) {
        console.log("[OneSignal] Found existing player ID:", playerId);
        // Verificar que sigue siendo válido intentando obtener el estado
        try {
          const subscription = await window.OneSignal.User.PushSubscription;
          if (subscription?.id) {
            console.log("[OneSignal] Subscription is valid");
            if (userId) {
              await savePlayerIdToDatabase(userId, playerId);
            }
            return { success: true, playerId };
          }
        } catch (e) {
          console.log("[OneSignal] Existing subscription may be invalid, requesting new one");
        }
      }

      // Si llegamos aquí, el permiso está concedido pero no hay player ID válido
      // Forzar re-registro
      console.log("[OneSignal] Permission granted but no valid player ID, forcing re-registration");
    }

    // Paso 3: Solicitar permiso (mostrará el Slidedown)
    console.log("[OneSignal] Requesting permission via Slidedown...");

    // Esperar a que el usuario interactúe con el prompt
    await window.OneSignal.Slidedown.promptPush();

    // El usuario pudo haber dado: Allow, Block, o cerrado el prompt
    // Esperar un momento y verificar el resultado
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Paso 4: Verificar si el usuario concedió el permiso
    const newPermission = Notification.permission;
    console.log("[OneSignal] Permission after prompt:", newPermission);

    if (newPermission === "denied") {
      return {
        success: false,
        error:
          "Bloqueaste las notificaciones. Para activarlas, click en el 🔒 al lado de la URL → Notificaciones: Permitir",
        requiresUserAction: true,
      };
    }

    if (newPermission === "default") {
      // El usuario cerró el prompt sin decidir
      return {
        success: false,
        error:
          "Tenés que aceptar las notificaciones para recibir alertas. Intentá de nuevo y dale 'Sí, activar'.",
      };
    }

    // Paso 5: Esperar a que OneSignal genere el player ID (con timeout)
    console.log("[OneSignal] Waiting for player ID generation...");
    let playerId = null;
    let maxAttempts = 30; // 6 segundos máximo

    while (maxAttempts > 0 && !playerId) {
      playerId = await getOneSignalPlayerId();
      if (playerId) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
      maxAttempts--;
    }

    if (!playerId) {
      console.error("[OneSignal] Timeout waiting for player ID");
      // Intentar una última vez forzando la inicialización
      try {
        await window.OneSignal.User.PushSubscription.optIn();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        playerId = await getOneSignalPlayerId();
      } catch (e) {
        console.error("[OneSignal] Final attempt failed:", e);
      }

      if (!playerId) {
        return {
          success: false,
          error:
            "No se pudo crear la suscripción. Intentá: 1) Recargar la página, 2) Asegurarte de tener conexión estable, 3) Intentar de nuevo",
        };
      }
    }

    console.log("[OneSignal] Player ID obtained:", playerId);

    // Paso 6: Guardar en base de datos
    if (userId) {
      try {
        await savePlayerIdToDatabase(userId, playerId);
      } catch (dbError: any) {
        console.error("[OneSignal] Database save failed:", dbError);
        return {
          success: true, // La suscripción funcionó pero no se guardó
          playerId,
          error: "Suscripción creada pero no se pudo guardar. Intentá recargar la página.",
        };
      }
    }

    // Paso 7: Verificación final - comprobar que realmente estamos suscritos
    const finalCheck = await isOneSignalSubscribed();
    if (!finalCheck) {
      console.warn("[OneSignal] Final check failed - subscription may not be active");
      return {
        success: false,
        error: "La suscripción no se activó correctamente. Intentá de nuevo.",
      };
    }

    console.log("[OneSignal] Subscription completed successfully!");
    return { success: true, playerId };
  } catch (error: any) {
    console.error("[OneSignal] Subscribe error:", error);
    return {
      success: false,
      error:
        error.message || "Error desconocido al suscribir. Recargá la página e intentá de nuevo.",
    };
  }
};

export const unsubscribeFromOneSignal = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!window.OneSignal) {
      return { success: false, error: "OneSignal not loaded" };
    }

    // Opt out from push notifications
    await window.OneSignal.User.PushSubscription.optOut();

    console.log("[OneSignal] Unsubscribed successfully");
    return { success: true };
  } catch (error: any) {
    console.error("[OneSignal] Unsubscribe error:", error);
    return { success: false, error: error.message };
  }
};

export const isOneSignalSubscribed = async (): Promise<boolean> => {
  try {
    if (!window.OneSignal) {
      return false;
    }

    const subscription = await window.OneSignal.User.PushSubscription;
    return subscription?.optedIn || false;
  } catch (error) {
    return false;
  }
};

export const getOneSignalPlayerId = async (): Promise<string | null> => {
  try {
    if (!window.OneSignal) {
      return null;
    }

    const subscription = await window.OneSignal.User.PushSubscription;
    return subscription?.id || null;
  } catch (error) {
    return null;
  }
};

// Alias for backward compatibility
export const getOneSignalUserId = getOneSignalPlayerId;
