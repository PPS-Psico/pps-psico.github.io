/**
 * Web Push Subscription Utilities
 * Handles subscribing/unsubscribing to push notifications using the native Push API
 */

import { supabase } from "./supabaseClient";

// VAPID Public Key - This needs to match the one in Supabase Edge Function secrets
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

/**
 * Convert base64 URL-safe string to Uint8Array (for applicationServerKey)
 */
/**
 * Convert base64 URL-safe string to Uint8Array (for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert ArrayBuffer to base64 URL-safe string
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    // Check if we are in a secure context
    window.isSecureContext
  );
}

/**
 * Check if subscription exists in database
 */
async function checkSubscriptionInDatabase(endpoint: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .single();

    if (error || !data) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get the current push subscription status (checks both browser and database)
 */
export async function getPushSubscriptionStatus(): Promise<{
  isSubscribed: boolean;
  permission: NotificationPermission;
}> {
  if (!isPushSupported()) {
    return { isSubscribed: false, permission: "denied" };
  }

  const permission = Notification.permission;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    // If no local subscription, return false
    if (!subscription) {
      return { isSubscribed: false, permission };
    }

    // Check if subscription exists in database
    const existsInDb = await checkSubscriptionInDatabase(subscription.endpoint);

    if (!existsInDb) {
      console.log("[Push] Local subscription found but not in database - cleaning up...");
      // Clean up local subscription since it's not in DB
      await subscription.unsubscribe();
      return { isSubscribed: false, permission };
    }

    return { isSubscribed: true, permission };
  } catch (error) {
    console.error("[Push] Error checking subscription status:", error);
    return { isSubscribed: false, permission };
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    const errorMsg = !window.isSecureContext
      ? "Push requiere un contexto seguro (HTTPS o localhost)"
      : "Push notifications no soportadas en este navegador";
    return { success: false, error: errorMsg };
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error("[Push] VAPID_PUBLIC_KEY not configured");
    return { success: false, error: "Configuración de notificaciones incompleta (VAPID lacks)" };
  }

  try {
    console.log("[Push] Iniciando proceso de suscripción...");

    // Request notification permission
    const permission = await Notification.requestPermission();
    console.log("[Push] Permiso de notificaciones:", permission);

    if (permission !== "granted") {
      return {
        success: false,
        error: "Permiso de notificaciones denegado. Habilitalo en la configuración del navegador.",
      };
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    console.log("[Push] Service Worker listo:", registration.scope);

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log("[Push] No hay suscripción previa, creando una nueva...");
      try {
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        console.log("[Push] VAPID Key convertida (Largo):", convertedVapidKey.length);

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as BufferSource,
        });
      } catch (subError: any) {
        console.error("[Push] Error específico en subscribe():", subError);
        console.error("[Push] Nombre del error:", subError.name);

        // Si hay una suscripción antigua "fantasma", intentamos limpiarla
        try {
          const oldSub = await registration.pushManager.getSubscription();
          if (oldSub) {
            console.log("[Push] Intentando limpiar suscripción antigua problemática...");
            await oldSub.unsubscribe();
          }
        } catch (e) {}

        if (subError.name === "AbortError" || subError.message.includes("Registration failed")) {
          console.warn("[Push] Fallo de registro (AbortError).");

          // Intentar desuscribir forzosamente por si quedó en un estado zombie
          try {
            const zombieSub = await registration.pushManager.getSubscription();
            if (zombieSub) await zombieSub.unsubscribe();
            await registration.unregister();
          } catch (e) {}

          // Mensaje amigable para el usuario final
          throw new Error(
            "El navegador bloqueó la conexión. En Opera/Brave, asegúrate de desactivar el 'Escudo de Privacidad' para este sitio y que los Permisos de Notificación estén en 'Preguntar' o 'Permitir'."
          );
        }
        throw subError;
      }
    } else {
      console.log("[Push] Suscripción existente encontrada.");
    }

    // Extract keys from subscription
    const p256dh = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");

    if (!p256dh || !auth) {
      throw new Error("Failed to get subscription keys");
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Usuario no autenticado");
    }

    // Save subscription to database
    const subscriptionData = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: arrayBufferToBase64Url(p256dh),
      auth: arrayBufferToBase64Url(auth),
    };

    // Upsert (insert or update if endpoint exists)
    const { error: dbError } = await supabase.from("push_subscriptions").upsert(subscriptionData, {
      onConflict: "user_id,endpoint",
    });

    if (dbError) {
      console.error("[Push] Database error:", dbError);
      throw new Error("Error guardando suscripción");
    }

    console.log("[Push] ✅ Subscribed successfully");
    return { success: true };
  } catch (error: any) {
    console.error("[Push] Subscription error:", error);
    return { success: false, error: error.message || "Error al suscribirse" };
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Remove from database first
      if (user) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      // Then unsubscribe from push manager
      await subscription.unsubscribe();
    }

    console.log("[Push] ✅ Unsubscribed successfully");
    return { success: true };
  } catch (error: any) {
    console.error("[Push] Unsubscribe error:", error);
    return { success: false, error: error.message || "Error al desuscribirse" };
  }
}

/**
 * Test push notification (for debugging)
 */
export async function testPushNotification(): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    console.log("[Push Test] Iniciando envío de notificación de prueba...");
    console.log(
      "[Push Test] VAPID_PUBLIC_KEY:",
      VAPID_PUBLIC_KEY ? "Configurada" : "NO CONFIGURADA"
    );

    // Verificar suscripción antes de enviar
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return {
        success: false,
        error: "No hay suscripción activa. Desactivá y volvé a activar las notificaciones.",
      };
    }

    console.log("[Push Test] Suscripción encontrada:", {
      endpoint: subscription.endpoint.substring(0, 50) + "...",
      expirationTime: subscription.expirationTime,
    });

    const { data, error } = await supabase.functions.invoke("send-push", {
      body: {
        title: "🔔 Prueba de Notificación",
        message: "¡Las notificaciones están funcionando correctamente!",
        url: "/student",
      },
    });

    console.log("[Push Test] Respuesta:", { data, error });

    if (error) {
      console.error("[Push Test] Error de Supabase:", error);
      throw error;
    }

    return { success: true, details: data };
  } catch (error: any) {
    console.error("[Push Test] Error completo:", error);
    return {
      success: false,
      error: error.message,
      details: error,
    };
  }
}
