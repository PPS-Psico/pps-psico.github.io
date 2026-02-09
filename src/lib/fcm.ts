/**
 * Firebase Cloud Messaging (FCM) Integration Module
 * Handles subscription, unsubscription, and token management
 */

import { initializeApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, onMessage } from "firebase/messaging";
import { firebaseConfig, vapidKey } from "./firebaseConfig";
import { supabase } from "./supabaseClient";

// Initialize Firebase app
let app: any = null;
let messaging: any = null;

export const initializeFCM = async () => {
  try {
    if (!app) {
      app = initializeApp(firebaseConfig);
      messaging = getMessaging(app);
      console.log("[FCM] Firebase initialized successfully");
    }
    return { app, messaging };
  } catch (error: any) {
    console.error("[FCM] Failed to initialize:", error);
    throw error;
  }
};

/**
 * Get FCM token for the current user
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const { messaging } = await initializeFCM();

    // Request notification permission first
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Notification permission not granted");
      return null;
    }

    // Get FCM token
    const token = await getToken(messaging, { vapidKey });

    if (token) {
      console.log("[FCM] Token obtained:", token.substring(0, 20) + "...");
      return token;
    } else {
      console.warn("[FCM] No token available");
      return null;
    }
  } catch (error: any) {
    console.error("[FCM] Error getting token:", error);
    return null;
  }
};

/**
 * Subscribe user to push notifications
 */
export const subscribeToFCM = async (
  userId: string | undefined
): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> => {
  try {
    console.log("[FCM] Subscribing user:", userId);

    // Check browser support
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return {
        success: false,
        error: "Tu navegador no soporta notificaciones push",
      };
    }

    // Check if already subscribed
    const isSubscribed = await isFCMSubscribed();
    if (isSubscribed) {
      console.log("[FCM] Already subscribed");
      const token = await getFCMToken();
      return { success: true, token: token || undefined };
    }

    // Get token
    const token = await getFCMToken();

    if (!token) {
      return {
        success: false,
        error:
          "No se pudo obtener el token de notificación. Por favor, permití las notificaciones en tu navegador.",
      };
    }

    // Save to database if userId provided
    if (userId) {
      const { error } = await (supabase as any).from("fcm_tokens").upsert(
        {
          user_id: userId,
          fcm_token: token,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) {
        console.error("[FCM] Error saving to database:", error);
        return {
          success: false,
          error: "Error guardando la suscripción: " + error.message,
        };
      }

      console.log("[FCM] Token saved to database for user:", userId);
    }

    // Setup foreground message handler
    const { messaging } = await initializeFCM();
    onMessage(messaging, (payload) => {
      console.log("[FCM] Message received in foreground:", payload);
      // Show notification manually in foreground
      if (payload.notification) {
        new Notification(payload.notification.title || "Notificación", {
          body: payload.notification.body || "",
          icon: payload.notification.icon || "/icon-192x192.png",
          badge: "/icon-192x192.png",
        });
      }
    });

    return { success: true, token };
  } catch (error: any) {
    console.error("[FCM] Subscription error:", error);
    return {
      success: false,
      error: "Error al suscribirse: " + error.message,
    };
  }
};

/**
 * Unsubscribe user from push notifications
 */
export const unsubscribeFromFCM = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { messaging } = await initializeFCM();

    // Delete token
    await deleteToken(messaging);
    console.log("[FCM] Token deleted");

    return { success: true };
  } catch (error: any) {
    console.error("[FCM] Unsubscription error:", error);
    return {
      success: false,
      error: "Error al desuscribirse: " + error.message,
    };
  }
};

/**
 * Check if user is subscribed to FCM
 */
export const isFCMSubscribed = async (): Promise<boolean> => {
  try {
    if (!("Notification" in window)) {
      return false;
    }

    const permission = Notification.permission;
    if (permission !== "granted") {
      return false;
    }

    const token = await getFCMToken();
    return !!token;
  } catch (error) {
    return false;
  }
};

/**
 * Get current FCM token if available
 */
export const getCurrentFCMToken = async (): Promise<string | null> => {
  return await getFCMToken();
};

/**
 * Delete FCM token from database (for logout or cleanup)
 */
export const deleteFCMTokenFromDB = async (userId: string): Promise<void> => {
  try {
    // Use rpc to bypass RLS for deletion
    const { error } = await supabase.rpc("delete_fcm_token", {
      p_user_id: userId,
    });

    if (error) {
      console.error("[FCM] Error deleting token from database:", error);
    } else {
      console.log("[FCM] Token deleted from database for user:", userId);
    }
  } catch (error) {
    console.error("[FCM] Error deleting token from database:", error);
  }
};
