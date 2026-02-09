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

export const subscribeToOneSignal = async (
  userId?: string
): Promise<{ success: boolean; error?: string; playerId?: string }> => {
  try {
    if (!window.OneSignal) {
      return { success: false, error: "OneSignal not loaded" };
    }

    // Request permission using OneSignal's slidedown prompt
    await window.OneSignal.Slidedown.promptPush();

    // Wait a moment for the subscription to be created
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get the player ID
    const playerId = await getOneSignalPlayerId();

    if (!playerId) {
      console.warn("[OneSignal] No player ID obtained after subscription");
      return { success: true }; // Still success, but no player ID
    }

    console.log("[OneSignal] Subscription successful, player ID:", playerId);
    console.log("[OneSignal] User ID provided:", userId);

    // Save to database if we have a user ID
    if (userId) {
      try {
        console.log("[OneSignal] Attempting to save to database...");
        // Use raw query to avoid type checking issues
        const { data, error } = await supabase.from("push_subscriptions").upsert(
          {
            user_id: userId,
            onesignal_player_id: playerId,
            endpoint: `onesignal:${playerId}`, // Placeholder to satisfy NOT NULL
            p256dh: "onesignal", // Placeholder
            auth: "onesignal", // Placeholder
            updated_at: new Date().toISOString(),
          } as any,
          {
            onConflict: "user_id",
          }
        );

        if (error) {
          console.error("[OneSignal] Error saving to database:", error);
          console.error("[OneSignal] Error details:", JSON.stringify(error));
        } else {
          console.log("[OneSignal] Player ID saved to database successfully");
          console.log("[OneSignal] Upsert result:", data);
        }
      } catch (dbError) {
        console.error("[OneSignal] Database error:", dbError);
        console.error("[OneSignal] Database error details:", JSON.stringify(dbError));
      }
    } else {
      console.warn("[OneSignal] No userId provided, skipping database save");
    }

    return { success: true, playerId };
  } catch (error: any) {
    console.error("[OneSignal] Subscribe error:", error);
    return { success: false, error: error.message };
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
