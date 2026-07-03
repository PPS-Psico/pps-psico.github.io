import { logger } from "./logger";

type NavigatorWithBadging = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function getBadgingNavigator(): NavigatorWithBadging | null {
  if (typeof navigator === "undefined") return null;
  return navigator as NavigatorWithBadging;
}

export const badgeService = {
  set: (count: number): void => {
    const badgeNavigator = getBadgingNavigator();
    if (!badgeNavigator?.setAppBadge) return;

    badgeNavigator
      .setAppBadge(count)
      .then(() => logger.info(`[BadgeService] Badge seteado a ${count}`))
      .catch((err) => logger.error("[BadgeService] Error al setear badge:", err));
  },

  clear: (): void => {
    const badgeNavigator = getBadgingNavigator();
    if (!badgeNavigator?.clearAppBadge) return;

    badgeNavigator
      .clearAppBadge()
      .then(() => logger.info("[BadgeService] Badge limpiado"))
      .catch((err) => logger.error("[BadgeService] Error al limpiar badge:", err));
  },
};

export default badgeService;
