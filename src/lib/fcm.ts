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
let cachedToken: string | null = null;
let isGettingToken = false;
let tokenPromise: Promise<string | null> | null = null;

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
 * Get FCM token for the current user (with caching)
 */
export const getFCMToken = async (): Promise<string | null> => {
  // Return cached token if available
  if (cachedToken) {
    return cachedToken;
  }

  // If already getting token, return the existing promise
  if (isGettingToken && tokenPromise) {
    return tokenPromise;
  }

  isGettingToken = true;
  tokenPromise = (async () => {
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
        cachedToken = token;
        return token;
      } else {
        console.warn("[FCM] No token available");
        return null;
      }
    } catch (error: any) {
      console.error("[FCM] Error getting token:", error);
      return null;
    } finally {
      isGettingToken = false;
      tokenPromise = null;
    }
  })();

  return tokenPromise;
};

/**
 * Subscribe user to push notifications
 */
export const subscribeToFCM = async (
  userId: string | undefined
): Promise<{
  success: boolean;
  token?: string;
  dbSaved?: boolean;
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

    // Get token (will return cached if exists)
    const token = await getFCMToken();

    if (!token) {
      return {
        success: false,
        error:
          "No se pudo obtener el token de notificación. Por favor, permití las notificaciones en tu navegador.",
      };
    }

    // Check if already subscribed
    const isSubscribed = await isFCMSubscribed();
    if (isSubscribed) {
      console.log("[FCM] Already subscribed, ensuring token is in database...");
    }

    // Save to database if userId provided
    let dbSaved = false;
    if (userId) {
      console.log("[FCM] Saving token to database for user:", userId);

      try {
        // Use RPC function to save token (bypasses RLS and FK issues)
        const { data, error } = await (supabase as any).rpc("save_fcm_token", {
          uid: userId,
          tok: token,
        });

        if (error) {
          console.error("[FCM] Error saving token via RPC:", error);
        } else if (data === true) {
          console.log("[FCM] Token saved to database via RPC");
          dbSaved = true;
        } else {
          console.log("[FCM] Token NOT saved to database");
        }
      } catch (e) {
        console.error("[FCM] Exception saving token:", e);
      }
    } else {
      console.log("[FCM] No userId provided, skipping database save");
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

    return { success: true, token, dbSaved };
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

    // Clear cache
    cachedToken = null;

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
    const { error } = await (supabase as any).rpc("delete_fcm_token_user", {
      uid: userId,
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
