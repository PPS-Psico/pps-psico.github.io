import { useEffect } from "react";
import { badgeService } from "../../utils/badgeService";

export const useUnreadBadge = (unreadCount: number) => {
  useEffect(() => {
    if (unreadCount > 0) {
      badgeService.set(unreadCount);
    } else {
      badgeService.clear();
    }
  }, [unreadCount]);
};
