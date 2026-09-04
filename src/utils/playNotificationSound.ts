const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export const playNotificationSound = () => {
  try {
    void new Audio(NOTIFICATION_SOUND_URL).play().catch(() => {});
  } catch {
    // Audio may be unavailable or blocked by the browser's autoplay policy.
  }
};
