import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// -- CONFIGURATION --
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_EMAIL = 'mailto:admin@uflo.edu.ar';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
    console.log('📥 Request received:', req.method);

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

        console.log(`[Push] Found ${subscriptions.length} subscriptions`);

        // Import web-push only when needed (lazy loading)
        console.log('[Push] Importing web-push...');
        const webpushModule = await import('https://cdn.skypack.dev/web-push@3.6.7');
        console.log('[Push] Web-push module loaded, exports:', Object.keys(webpushModule));
        const webpush = webpushModule.default;

        if (!webpush) {
            throw new Error('Failed to load web-push module');
        }

        console.log('[Push] Setting VAPID details...');
        webpush.setVapidDetails(
            VAPID_EMAIL,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );
        console.log('[Push] VAPID configured');

        const payload = JSON.stringify({ title, message, url: url || '/' });
        const results: any[] = [];

        console.log('[Push] Starting to send notifications...');

        for (const sub of subscriptions) {
            try {
                const pushConfig = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                console.log(`[Push] Sending to subscription ${sub.id}...`);
                await webpush.sendNotification(pushConfig, payload);
                results.push({ id: sub.id, success: true });
                console.log(`[Push] ✅ Success for ${sub.id}`);
            } catch (err) {
                console.error(`[Push] ❌ Error for ${sub.id}:`, err);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`[Push] Cleaning up expired subscription ${sub.id}`);
                    await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                    results.push({ id: sub.id, success: false, error: 'Expired', cleaned: true });
                } else {
                    results.push({ id: sub.id, success: false, error: err.message || String(err) });
                }
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`[Push] Completed: ${successCount}/${subscriptions.length} successful`);

        return new Response(JSON.stringify({
            success: true,
            sent: successCount,
            total: subscriptions.length,
            details: results
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
