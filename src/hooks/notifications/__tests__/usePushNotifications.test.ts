import { act, renderHook, waitFor } from "@testing-library/react";
import { isFCMSubscribed, subscribeToFCM, unsubscribeFromFCM } from "../../../lib/fcm";
import { badgeService } from "../../../utils/badgeService";
import { usePushNotifications } from "../usePushNotifications";
import { useUnreadBadge } from "../useUnreadBadge";

jest.mock("../../../lib/fcm", () => ({
  isFCMSubscribed: jest.fn(),
  subscribeToFCM: jest.fn(),
  unsubscribeFromFCM: jest.fn(),
}));

jest.mock("../../../utils/badgeService", () => ({
  badgeService: {
    set: jest.fn(),
    clear: jest.fn(),
  },
}));

const mockedIsFCMSubscribed = jest.mocked(isFCMSubscribed);
const mockedSubscribeToFCM = jest.mocked(subscribeToFCM);
const mockedUnsubscribeFromFCM = jest.mocked(unsubscribeFromFCM);
const mockedBadgeService = jest.mocked(badgeService);

describe("notification infrastructure hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: function Notification() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
  });

  it("keeps the FCM state and feedback contract outside the provider", async () => {
    mockedIsFCMSubscribed.mockResolvedValue(false);
    mockedSubscribeToFCM.mockResolvedValue({ success: true, token: "token" });
    mockedUnsubscribeFromFCM.mockResolvedValue({ success: true });
    const showToast = jest.fn();
    const { result } = renderHook(() => usePushNotifications("user-1", showToast));

    expect(result.current.isSupported).toBe(true);
    await waitFor(() => expect(mockedIsFCMSubscribed).toHaveBeenCalledTimes(1));

    await act(async () => result.current.subscribe());
    expect(mockedSubscribeToFCM).toHaveBeenCalledWith("user-1");
    expect(result.current.isEnabled).toBe(true);
    expect(showToast).toHaveBeenCalledWith(
      "Notificaciones activadas! Te avisaremos de nuevas convocatorias.",
      "success"
    );

    await act(async () => result.current.unsubscribe());
    expect(mockedUnsubscribeFromFCM).toHaveBeenCalledTimes(1);
    expect(result.current.isEnabled).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Notificaciones desactivadas", "success");
  });

  it("synchronizes the PWA badge only when the unread count changes", () => {
    const { rerender } = renderHook(({ count }) => useUnreadBadge(count), {
      initialProps: { count: 3 },
    });

    expect(mockedBadgeService.set).toHaveBeenCalledWith(3);
    rerender({ count: 0 });
    expect(mockedBadgeService.clear).toHaveBeenCalledTimes(1);
  });
});
