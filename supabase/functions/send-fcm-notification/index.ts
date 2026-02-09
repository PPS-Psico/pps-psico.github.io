/**
 * Send FCM Notification Edge Function
 * Sends push notifications via Firebase Cloud Messaging HTTP v1 API
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get access token for FCM HTTP v1 API
async function getAccessToken(): Promise<string> {
  // In production, you should use a service account key stored as a secret
  // For now, we'll use a simpler approach with the server key
  const serverKey = Deno.env.get("FCM_SERVER_KEY");

  if (!serverKey) {
    throw new Error("FCM_SERVER_KEY not configured");
  }

  return serverKey;
}

// Send notification to a specific FCM token
async function sendToToken(
  token: string,
  title: string,
  body: string,
  data: any = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const serverKey = await getAccessToken();

    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title,
          body,
          icon: "https://pps-psico.github.io/icon-192x192.png",
          badge: "https://pps-psico.github.io/icon-192x192.png",
          click_action: "https://pps-psico.github.io/",
        },
        data: {
          ...data,
          url: "https://pps-psico.github.io/",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[FCM] Send failed:", errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }

    const result = await response.json();

    if (result.failure > 0) {
      console.error("[FCM] Partial failure:", result);
      return { success: false, error: result.results?.[0]?.error || "Unknown error" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[FCM] Error sending:", error);
    return { success: false, error: error.message };
  }
}

// Main handler
Deno.serve(async (req) => {
  console.log("📥 FCM Notification Request received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { title, body: messageBody, user_ids, send_to_all } = body;

    if (!title || !messageBody) {
      return new Response(JSON.stringify({ error: "Title and body are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tokens
    let tokens: string[] = [];

    if (send_to_all) {
      // Get all tokens
      const { data, error } = await supabase.from("fcm_tokens").select("fcm_token");

      if (error) throw error;
      tokens = data?.map((t: any) => t.fcm_token) || [];
    } else if (user_ids && user_ids.length > 0) {
      // Get tokens for specific users
      const { data, error } = await supabase
        .from("fcm_tokens")
        .select("fcm_token")
        .in("user_id", user_ids);

      if (error) throw error;
      tokens = data?.map((t: any) => t.fcm_token) || [];
    } else {
      return new Response(
        JSON.stringify({ error: "Either user_ids or send_to_all must be specified" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No subscribed users found",
          sent: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[FCM] Sending to ${tokens.length} devices`);

    // Send notifications
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const token of tokens) {
      const result = await sendToToken(token, title, messageBody, body.data || {});
      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push(result.error || "Unknown error");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: tokens.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[FCM] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
