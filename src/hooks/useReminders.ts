import { useState, useEffect, useCallback } from "react";
import ReminderService, { Reminder, CreateReminderInput } from "../services/reminderService";
import { useNotifications } from "../contexts/NotificationContext";

interface UseRemindersReturn {
  reminders: Reminder[];
  todayReminders: Reminder[];
  weekReminders: Reminder[];
  overdueReminders: Reminder[];
  counts: {
    today: number;
    week: number;
    overdue: number;
    total: number;
  };
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createReminder: (input: CreateReminderInput) => Promise<Reminder | null>;
  createLanzamientoReminders: (
    ppsId: string,
    ppsName: string,
    launchDate: string,
    institutionPhone?: string
  ) => Promise<boolean>;
  createSeguimientoReminder: (
    ppsId: string,
    ppsName: string,
    daysToWait?: number,
    institutionPhone?: string
  ) => Promise<boolean>;
  completeReminder: (reminderId: string) => Promise<boolean>;
  snoozeReminder: (reminderId: string, hours?: number) => Promise<boolean>;
  deleteReminder: (reminderId: string) => Promise<boolean>;
}

export const useReminders = (userId?: string): UseRemindersReturn => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [todayReminders, setTodayReminders] = useState<Reminder[]>([]);
  const [weekReminders, setWeekReminders] = useState<Reminder[]>([]);
  const [overdueReminders, setOverdueReminders] = useState<Reminder[]>([]);
  const [counts, setCounts] = useState({
    today: 0,
    week: 0,
    overdue: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get notifications context to add reminder notifications
  const { showToast } = useNotifications();

  // Set user ID when available
  useEffect(() => {
    if (userId) {
      ReminderService.setUserId(userId);
    }
  }, [userId]);

  const fetchAllReminders = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [all, today, week, overdue, countData] = await Promise.all([
        ReminderService.getPendingReminders(),
        ReminderService.getTodayReminders(),
        ReminderService.getThisWeekReminders(),
        ReminderService.getOverdueReminders(),
        ReminderService.getReminderCounts(),
      ]);

      setReminders(all);
      setTodayReminders(today);
      setWeekReminders(week);
      setOverdueReminders(overdue);
      setCounts(countData);
    } catch (err) {
      setError("Error al cargar recordatorios");
      console.error("[useReminders] Error fetching reminders:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load reminders on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchAllReminders();
    }
  }, [userId, fetchAllReminders]);

  const createReminder = useCallback(
    async (input: CreateReminderInput): Promise<Reminder | null> => {
      const result = await ReminderService.createReminder(input);
      if (result) {
        await fetchAllReminders();
        showToast(`Recordatorio creado: ${input.title}`, "success");
      }
      return result;
    },
    [fetchAllReminders, showToast]
  );

  const createLanzamientoReminders = useCallback(
    async (
      ppsId: string,
      ppsName: string,
      launchDate: string,
      institutionPhone?: string
    ): Promise<boolean> => {
      const result = await ReminderService.createLanzamientoReminders(
        ppsId,
        ppsName,
        launchDate,
        institutionPhone
      );
      if (result) {
        await fetchAllReminders();
        showToast(`Recordatorios de lanzamiento creados para "${ppsName}"`, "success");
      }
      return result;
    },
    [fetchAllReminders, showToast]
  );

  const createSeguimientoReminder = useCallback(
    async (
      ppsId: string,
      ppsName: string,
      daysToWait?: number,
      institutionPhone?: string
    ): Promise<boolean> => {
      const result = await ReminderService.createSeguimientoReminder(
        ppsId,
        ppsName,
        daysToWait,
        institutionPhone
      );
      if (result) {
        await fetchAllReminders();
        showToast(`Recordatorio de seguimiento creado para "${ppsName}"`, "success");
      }
      return result;
    },
    [fetchAllReminders, showToast]
  );

  const completeReminder = useCallback(
    async (reminderId: string): Promise<boolean> => {
      const result = await ReminderService.completeReminder(reminderId);
      if (result) {
        await fetchAllReminders();
      }
      return result;
    },
    [fetchAllReminders]
  );

  const snoozeReminder = useCallback(
    async (reminderId: string, hours?: number): Promise<boolean> => {
      const result = await ReminderService.snoozeReminder(reminderId, hours);
      if (result) {
        await fetchAllReminders();
      }
      return result;
    },
    [fetchAllReminders]
  );

  const deleteReminder = useCallback(
    async (reminderId: string): Promise<boolean> => {
      const result = await ReminderService.deleteReminder(reminderId);
      if (result) {
        await fetchAllReminders();
      }
      return result;
    },
    [fetchAllReminders]
  );

  return {
    reminders,
    todayReminders,
    weekReminders,
    overdueReminders,
    counts,
    isLoading,
    error,
    refresh: fetchAllReminders,
    createReminder,
    createLanzamientoReminders,
    createSeguimientoReminder,
    completeReminder,
    snoozeReminder,
    deleteReminder,
  };
};
