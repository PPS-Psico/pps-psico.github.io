
import { supabase } from '../lib/supabaseClient';

export interface PushNotificationPayload {
    title: string;
    message: string;
    url?: string;
    user_id?: string; // Optional: send to specific user or all
}

/**
 * Service to handle push notification triggers via Supabase Edge Functions
 */
export const notificationService = {
    /**
     * Sends a push notification to all subscribed users or a specific one
     */
    sendPush: async (payload: PushNotificationPayload): Promise<{ success: boolean; error?: string }> => {
        try {
            console.log('[NotificationService] Triggering push:', payload);

            const { data, error } = await supabase.functions.invoke('send-push', {
                body: payload
            });

            if (error) {
                console.error('[NotificationService] Edge Function Error:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err: any) {
            console.error('[NotificationService] Unexpected Error:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Specialized helper for new launch notifications
     */
    notifyNewLaunch: async (launchName: string) => {
        return notificationService.sendPush({
            title: '🚀 ¡Nueva Convocatoria Abierta!',
            message: `Ya podés inscribirte en: ${launchName}`,
            url: '/student' // Navigate to student home
        });
    }
};
