/**
 * Firebase Cloud Messaging (FCM) Integration Module
 * Handles subscription, unsubscription, and token management
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, onMessage, type Messaging } from "firebase/messaging";
import { firebaseConfig, vapidKey } from "./firebaseConfig";
import { supabase } from "./supabaseClient";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";

// Initialize Firebase app
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let cachedToken: string | null = null;
let isGettingToken = false;
let tokenPromise: Promise<string | null> | null = null;
// Una vez que getToken() falla (p. ej. "AbortError: push service error"), no
// reintentamos automáticamente en cada refresh de sesión de Supabase: eso es lo
// que generaba el spam de errores en consola. Sólo se reintenta cuando el usuario
// activa explícitamente las notificaciones (subscribeToFCM pasa forceRetry=true).
let tokenFetchFailed = false;

const isPushSupported = (): boolean => {
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  try {
    const sw = navigator.serviceWorker?.ready;
    if (!sw) return false;
    return true;
  } catch {
    return false;
  }
};

export const initializeFCM = async () => {
  try {
    if (!isPushSupported()) {
      logger.info("[FCM] Push not supported in this environment, skipping.");
      return { app: null, messaging: null };
    }
    if (!app) {
      app = initializeApp(firebaseConfig);
      messaging = getMessaging(app);
      logger.info("[FCM] Firebase initialized successfully");
    }
    return { app, messaging };
  } catch (error) {
    logger.warn("[FCM] Failed to initialize:", getErrorMessage(error));
    return { app: null, messaging: null };
  }
};

/**
 * Get FCM token for the current user (with caching)
 */
export const getFCMToken = async (forceRetry = false): Promise<string | null> => {
  // Return cached token if available
  if (cachedToken) {
    return cachedToken;
  }

  // Si ya falló antes y no es un reintento explícito del usuario, no insistimos.
  // Evita el bucle de errores en cada TOKEN_REFRESHED de Supabase.
  if (tokenFetchFailed && !forceRetry) {
    return null;
  }

  // If already getting token, return the existing promise
  if (isGettingToken && tokenPromise) {
    return tokenPromise;
  }

  isGettingToken = true;
  tokenPromise = (async () => {
    try {
      if (!isPushSupported()) {
        logger.info("[FCM] Push not supported, skipping token request.");
        return null;
      }
      const { messaging } = await initializeFCM();
      if (!messaging) {
        logger.warn("[FCM] Messaging no inicializado");
        return null;
      }

      // Request notification permission first
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        logger.warn("[FCM] Notification permission not granted");
        return null;
      }

      // Get FCM token
      const token = await getToken(messaging, { vapidKey });

      if (token) {
        logger.info("[FCM] Token obtained:", token.substring(0, 20) + "...");
        cachedToken = token;
        tokenFetchFailed = false;
        return token;
      } else {
        logger.warn("[FCM] No token available");
        return null;
      }
    } catch (error) {
      // No reintentar automáticamente tras un fallo (push service caído,
      // VAPID/endpoint inalcanzable, etc.). Lo registramos una sola vez como
      // advertencia en lugar de error para no inundar la consola.
      tokenFetchFailed = true;
      const name = (error as { name?: string } | null)?.name;
      if (name === "AbortError") {
        logger.warn(
          "[FCM] Servicio push no disponible (AbortError). Se omiten reintentos automáticos."
        );
      } else {
        logger.warn("[FCM] No se pudo obtener el token push:", error);
      }
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
    logger.info("[FCM] Subscribing user:", userId);

    // Acción explícita del usuario: permitimos reintentar aunque antes fallara.
    tokenFetchFailed = false;

    // Check browser support
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return {
        success: false,
        error: "Tu navegador no soporta notificaciones push",
      };
    }

    // Get token (will return cached if exists)
    const token = await getFCMToken(true);

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
      logger.info("[FCM] Already subscribed, ensuring token is in database...");
    }

    // Save to database if userId provided
    let dbSaved = false;
    if (userId) {
      logger.info("[FCM] Saving token to database for user:", userId);

      try {
        // Use RPC function to save token (bypasses RLS and FK issues)
        const { data, error } = await supabase.rpc("save_fcm_token", {
          uid: userId,
          tok: token,
        });

        if (error) {
          logger.error("[FCM] Error saving token via RPC:", error);
        } else if (data === true) {
          logger.info("[FCM] Token saved to database via RPC");
          dbSaved = true;
        } else {
          logger.info("[FCM] Token NOT saved to database");
        }
      } catch (e) {
        logger.error("[FCM] Exception saving token:", e);
      }
    } else {
      logger.info("[FCM] No userId provided, skipping database save");
    }

    // Setup foreground message handler
    // Note: Service Worker handles background notifications automatically
    // Foreground messages can be used for in-app UI updates if needed
    const { messaging } = await initializeFCM();
    if (messaging) {
      onMessage(messaging, (payload) => {
        logger.info("[FCM] Message received in foreground:", payload);
        // In foreground, FCM doesn't show notifications automatically
        // You can add custom in-app UI here if needed
        // The Service Worker will handle notifications when app is in background
      });
    }

    return { success: true, token, dbSaved };
  } catch (error) {
    logger.error("[FCM] Subscription error:", error);
    return {
      success: false,
      error: "Error al suscribirse: " + getErrorMessage(error),
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
    if (!messaging) {
      cachedToken = null;
      return { success: true };
    }

    // Delete token
    await deleteToken(messaging);
    logger.info("[FCM] Token deleted");

    // Clear cache
    cachedToken = null;

    return { success: true };
  } catch (error) {
    logger.error("[FCM] Unsubscription error:", error);
    return {
      success: false,
      error: "Error al desuscribirse: " + getErrorMessage(error),
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

    // Si ya tenemos token en memoria, está suscrito.
    if (cachedToken) {
      return true;
    }

    // IMPORTANTE: no llamamos a getFCMToken() acá. Hacerlo disparaba getToken()
    // en cada chequeo de estado (y en cada refresh de sesión), provocando el
    // bucle de errores "push service error". En su lugar, consultamos si ya
    // existe una suscripción push en el Service Worker, que es no intrusivo.
    if (!("serviceWorker" in navigator)) {
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
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
    const { error } = await supabase.rpc("delete_fcm_token_user", {
      uid: userId,
    });

    if (error) {
      logger.error("[FCM] Error deleting token from database:", error);
    } else {
      logger.info("[FCM] Token deleted from database for user:", userId);
    }
  } catch (error) {
    logger.error("[FCM] Error deleting token from database:", error);
  }
};
