import { useCallback, useEffect, useState } from "react";
import { isFCMSubscribed, subscribeToFCM, unsubscribeFromFCM } from "../../lib/fcm";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { logger } from "../../utils/logger";

type ShowToast = (message: string, type: "success" | "error" | "warning") => void;

export const usePushNotifications = (userId: string | undefined, showToast: ShowToast) => {
  const isSupported = "Notification" in window && "serviceWorker" in navigator;
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId || !isSupported) return;

    const checkStatus = async () => {
      try {
        setIsEnabled(await isFCMSubscribed());
      } catch (error) {
        logger.warn("Error checking push status", error);
      }
    };

    void checkStatus();
  }, [userId, isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      showToast("Tu navegador no soporta notificaciones push", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const result = await subscribeToFCM(userId);
      if (result.success) {
        setIsEnabled(true);
        showToast("Notificaciones activadas! Te avisaremos de nuevas convocatorias.", "success");
      } else {
        showToast(result.error || "No se pudo activar notificaciones", "error");
      }
    } catch (error) {
      showToast(getErrorMessage(error, "Error al activar notificaciones"), "error");
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, showToast, userId]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await unsubscribeFromFCM();
      if (result.success) {
        setIsEnabled(false);
        showToast("Notificaciones desactivadas", "success");
      } else {
        showToast(result.error || "No se pudo desactivar notificaciones", "error");
      }
    } catch (error) {
      showToast(getErrorMessage(error, "Error al desactivar notificaciones"), "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  return {
    isSupported,
    isEnabled,
    isLoading,
    subscribe,
    unsubscribe,
  };
};
