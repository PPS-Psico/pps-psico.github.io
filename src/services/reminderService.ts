import { supabase } from "../lib/supabaseClient";

export type ReminderType =
  | "contactar"
  | "seguimiento"
  | "lanzamiento"
  | "vencimiento"
  | "acreditacion";

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  type: ReminderType;
  pps_id?: string;
  pps_name?: string;
  institution_phone?: string;
  due_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  completed: boolean;
  completed_at?: string;
  created_at: string;
  snooze_count: number;
  snoozed_until?: string;
}

export interface CreateReminderInput {
  title: string;
  description?: string;
  type: ReminderType;
  pps_id?: string;
  pps_name?: string;
  institution_phone?: string;
  due_date: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

/**
 * Servicio de recordatorios integrado con Supabase
 * No depende de servicios externos
 */
class ReminderService {
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Crea un nuevo recordatorio
   */
  async createReminder(input: CreateReminderInput): Promise<Reminder | null> {
    if (!this.userId) {
      console.error("[ReminderService] No user ID set");
      return null;
    }

    try {
      const { data, error } = await (supabase
        .from("reminders" as any)
        .insert({
          user_id: this.userId,
          title: input.title,
          description: input.description,
          type: input.type,
          pps_id: input.pps_id,
          pps_name: input.pps_name,
          institution_phone: input.institution_phone,
          due_date: input.due_date,
          priority: input.priority || "medium",
          completed: false,
          snooze_count: 0,
        } as any)
        .select()
        .single() as any);

      if (error) {
        console.error("[ReminderService] Error creating reminder:", error);
        return null;
      }

      return data as Reminder;
    } catch (error) {
      console.error("[ReminderService] Exception creating reminder:", error);
      return null;
    }
  }

  /**
   * Crea recordatorios automáticos para un lanzamiento confirmado
   */
  async createLanzamientoReminders(
    ppsId: string,
    ppsName: string,
    launchDate: string,
    institutionPhone?: string
  ): Promise<boolean> {
    if (!this.userId) return false;

    try {
      const launchDateObj = new Date(launchDate);

      // Recordatorio 7 días antes: Preparar materiales
      const reminder7Days = new Date(launchDateObj);
      reminder7Days.setDate(reminder7Days.getDate() - 7);

      await this.createReminder({
        title: `Preparar lanzamiento: ${ppsName}`,
        description: `Faltan 7 días para el lanzamiento. Preparar materiales, verificar cupos y coordinar con la institución.${institutionPhone ? `\n📱 WhatsApp: ${institutionPhone}` : ""}`,
        type: "lanzamiento",
        pps_id: ppsId,
        pps_name: ppsName,
        institution_phone: institutionPhone,
        due_date: reminder7Days.toISOString(),
        priority: "medium",
      });

      // Recordatorio 1 día antes: Lanzamiento mañana
      const reminder1Day = new Date(launchDateObj);
      reminder1Day.setDate(reminder1Day.getDate() - 1);

      await this.createReminder({
        title: `🚀 Lanzar mañana: ${ppsName}`,
        description: `El lanzamiento es mañana (${launchDate}). Últimos preparativos y verificación final.${institutionPhone ? `\n📱 WhatsApp: ${institutionPhone}` : ""}`,
        type: "lanzamiento",
        pps_id: ppsId,
        pps_name: ppsName,
        institution_phone: institutionPhone,
        due_date: reminder1Day.toISOString(),
        priority: "high",
      });

      // Recordatorio el día del lanzamiento
      await this.createReminder({
        title: `📢 HOY - Lanzamiento: ${ppsName}`,
        description: `¡Es hoy! Realizar el lanzamiento de la convocatoria.${institutionPhone ? `\n📱 WhatsApp: ${institutionPhone}` : ""}`,
        type: "lanzamiento",
        pps_id: ppsId,
        pps_name: ppsName,
        institution_phone: institutionPhone,
        due_date: launchDate,
        priority: "urgent",
      });

      return true;
    } catch (error) {
      console.error("[ReminderService] Error creating lanzamiento reminders:", error);
      return false;
    }
  }

  /**
   * Crea recordatorio de seguimiento
   */
  async createSeguimientoReminder(
    ppsId: string,
    ppsName: string,
    daysToWait: number = 7,
    institutionPhone?: string
  ): Promise<boolean> {
    if (!this.userId) return false;

    try {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + daysToWait);

      await this.createReminder({
        title: `Seguimiento: ${ppsName}`,
        description: `Han pasado ${daysToWait} días desde el último contacto. Verificar si hay respuesta de la institución.${institutionPhone ? `\n📱 WhatsApp: ${institutionPhone}` : ""}`,
        type: "seguimiento",
        pps_id: ppsId,
        pps_name: ppsName,
        institution_phone: institutionPhone,
        due_date: followUpDate.toISOString(),
        priority: daysToWait > 7 ? "high" : "medium",
      });

      return true;
    } catch (error) {
      console.error("[ReminderService] Error creating seguimiento reminder:", error);
      return false;
    }
  }

  /**
   * Obtiene recordatorios pendientes
   */
  async getPendingReminders(limit: number = 50): Promise<Reminder[]> {
    if (!this.userId) return [];

    try {
      const { data, error } = await (supabase
        .from("reminders" as any)
        .select("*")
        .eq("user_id", this.userId)
        .eq("completed", false)
        .is("snoozed_until", null)
        .order("due_date", { ascending: true })
        .limit(limit) as any);

      if (error) {
        console.error("[ReminderService] Error fetching reminders:", error);
        return [];
      }

      return (data || []) as Reminder[];
    } catch (error) {
      console.error("[ReminderService] Exception fetching reminders:", error);
      return [];
    }
  }

  /**
   * Obtiene recordatorios de hoy
   */
  async getTodayReminders(): Promise<Reminder[]> {
    if (!this.userId) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const { data, error } = await (supabase
        .from("reminders" as any)
        .select("*")
        .eq("user_id", this.userId)
        .eq("completed", false)
        .gte("due_date", today.toISOString())
        .lt("due_date", tomorrow.toISOString())
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true }) as any);

      if (error) {
        console.error("[ReminderService] Error fetching today's reminders:", error);
        return [];
      }

      return (data || []) as Reminder[];
    } catch (error) {
      console.error("[ReminderService] Exception fetching today's reminders:", error);
      return [];
    }
  }

  /**
   * Obtiene recordatorios de esta semana
   */
  async getThisWeekReminders(): Promise<Reminder[]> {
    if (!this.userId) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    try {
      const { data, error } = await (supabase
        .from("reminders" as any)
        .select("*")
        .eq("user_id", this.userId)
        .eq("completed", false)
        .gte("due_date", today.toISOString())
        .lt("due_date", nextWeek.toISOString())
        .order("due_date", { ascending: true }) as any);

      if (error) {
        console.error("[ReminderService] Error fetching week reminders:", error);
        return [];
      }

      return (data || []) as Reminder[];
    } catch (error) {
      console.error("[ReminderService] Exception fetching week reminders:", error);
      return [];
    }
  }

  /**
   * Obtiene recordatorios vencidos (overdue)
   */
  async getOverdueReminders(): Promise<Reminder[]> {
    if (!this.userId) return [];

    const now = new Date().toISOString();

    try {
      const { data, error } = await (supabase
        .from("reminders" as any)
        .select("*")
        .eq("user_id", this.userId)
        .eq("completed", false)
        .lt("due_date", now)
        .order("due_date", { ascending: true })
        .limit(20) as any);

      if (error) {
        console.error("[ReminderService] Error fetching overdue reminders:", error);
        return [];
      }

      return (data || []) as Reminder[];
    } catch (error) {
      console.error("[ReminderService] Exception fetching overdue reminders:", error);
      return [];
    }
  }

  /**
   * Marca un recordatorio como completado
   */
  async completeReminder(reminderId: string): Promise<boolean> {
    if (!this.userId) return false;

    try {
      const { error } = await (supabase
        .from("reminders" as any)
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        } as any)
        .eq("id", reminderId)
        .eq("user_id", this.userId) as any);

      if (error) {
        console.error("[ReminderService] Error completing reminder:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[ReminderService] Exception completing reminder:", error);
      return false;
    }
  }

  /**
   * Posponer (snooze) un recordatorio
   */
  async snoozeReminder(reminderId: string, hours: number = 24): Promise<boolean> {
    if (!this.userId) return false;

    try {
      const snoozedUntil = new Date();
      snoozedUntil.setHours(snoozedUntil.getHours() + hours);

      // Obtener el contador actual
      const { data: reminder } = await (supabase
        .from("reminders" as any)
        .select("snooze_count")
        .eq("id", reminderId)
        .single() as any);

      const newCount = (reminder?.snooze_count || 0) + 1;

      const { error } = await (supabase
        .from("reminders" as any)
        .update({
          snoozed_until: snoozedUntil.toISOString(),
          snooze_count: newCount,
        } as any)
        .eq("id", reminderId)
        .eq("user_id", this.userId) as any);

      if (error) {
        console.error("[ReminderService] Error snoozing reminder:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[ReminderService] Exception snoozing reminder:", error);
      return false;
    }
  }

  /**
   * Elimina un recordatorio
   */
  async deleteReminder(reminderId: string): Promise<boolean> {
    if (!this.userId) return false;

    try {
      const { error } = await (supabase
        .from("reminders" as any)
        .delete()
        .eq("id", reminderId)
        .eq("user_id", this.userId) as any);

      if (error) {
        console.error("[ReminderService] Error deleting reminder:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[ReminderService] Exception deleting reminder:", error);
      return false;
    }
  }

  /**
   * Obtiene el conteo de recordatorios por tipo
   */
  async getReminderCounts(): Promise<{
    today: number;
    week: number;
    overdue: number;
    total: number;
  }> {
    if (!this.userId) {
      return { today: 0, week: 0, overdue: 0, total: 0 };
    }

    try {
      const [today, week, overdue, total] = await Promise.all([
        this.getTodayReminders(),
        this.getThisWeekReminders(),
        this.getOverdueReminders(),
        this.getPendingReminders(1000),
      ]);

      return {
        today: today.length,
        week: week.length,
        overdue: overdue.length,
        total: total.length,
      };
    } catch (error) {
      console.error("[ReminderService] Error getting counts:", error);
      return { today: 0, week: 0, overdue: 0, total: 0 };
    }
  }
}

export default new ReminderService();
