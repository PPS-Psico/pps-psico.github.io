// OneSignal Integration - Custom Code Setup
// Documentation: https://documentation.onesignal.com/docs/custom-code-setup

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || "";
const ONESIGNAL_SAFARI_WEB_ID = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID || "";

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
        notifyButton: {
          enable: false, // Usamos nuestro propio botón, no el de OneSignal
        },
        // No mostrar prompts automáticos, los controlamos manualmente
        promptOptions: {
          slidedown: {
            enabled: false,
          },
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

export const subscribeToOneSignal = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!window.OneSignal) {
      return { success: false, error: "OneSignal not loaded" };
    }

    // Request permission using OneSignal's slidedown prompt
    await window.OneSignal.Slidedown.promptPush();

    console.log("[OneSignal] Subscription prompt shown");
    return { success: true };
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

export const getOneSignalUserId = async (): Promise<string | null> => {
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
