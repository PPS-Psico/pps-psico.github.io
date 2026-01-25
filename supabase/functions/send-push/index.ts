import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from "https://esm.sh/web-push@3.6.7";

// -- CONFIGURATION --
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_EMAIL = 'mailto:admin@uflo.edu.ar'; // Valid email for VAPID

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🔧 Config loaded:', {
    hasUrl: !!SUPABASE_URL,
    hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
    hasVapidPublic: !!VAPID_PUBLIC_KEY,
    hasVapidPrivate: !!VAPID_PRIVATE_KEY
});

// Initialize Web Push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_EMAIL,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
} else {
    console.warn("⚠️ VAPID Keys not found in environment variables.");
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { title, message, url, user_id } = await req.json();

        if (!title || !message) {
            throw new Error('Title and message are required.');
        }

        console.log(`[Push] Sending: "${title}" to ${user_id ? user_id : 'ALL'}`);

        let query = supabase.from('push_subscriptions').select('*');
        if (user_id) {
            query = query.eq('user_id', user_id);
        }

        const { data: subscriptions, error: dbError } = await query;

        if (dbError) throw dbError;
        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ message: 'No subscriptions found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const payload = JSON.stringify({ title, message, url: url || '/' });
        const results = [];

        // Send concurrently
        const promises = subscriptions.map(async (sub) => {
            try {
                const pushConfig = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                await webpush.sendNotification(pushConfig, payload);
                return { id: sub.id, success: true };
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Expired subscription, cleanup
                    console.log(`[Push] Cleaning up expired subscription ${sub.id}`);
                    await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                    return { id: sub.id, success: false, error: 'Expired', cleaned: true };
                }
                console.error(`[Push] Error sending to ${sub.id}:`, err);
                return { id: sub.id, success: false, error: err.message };
            }
        });

        const sentResults = await Promise.all(promises);
        const successCount = sentResults.filter(r => r.success).length;

        return new Response(JSON.stringify({
            success: true,
            sent: successCount,
            total: subscriptions.length,
            details: sentResults
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("[Push] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
});
