/**
 * Send FCM Notification Edge Function
 * Sends push notifications via Firebase Cloud Messaging HTTP v1 API using OAuth2
 */

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parse service account credentials from environment
interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

// Generate JWT and get access token
async function getAccessToken(): Promise<string> {
  try {
    // Get service account from environment variable
    const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountJson) {
      throw new Error("FCM_SERVICE_ACCOUNT_KEY not configured");
    }

    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);

    // Create JWT header
    const header = {
      alg: "RS256",
      typ: "JWT",
      kid: serviceAccount.private_key_id,
    };

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600, // 1 hour
    };

    // Encode JWT parts
    const encodedHeader = encodeBase64(new TextEncoder().encode(JSON.stringify(header)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const encodedPayload = encodeBase64(new TextEncoder().encode(JSON.stringify(payload)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    // Create signature
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Import private key - convert PEM to binary
    const privateKeyPem = serviceAccount.private_key
      .replace(/\\n/g, "\n")
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s/g, "");

    const binaryKey = Uint8Array.from(atob(privateKeyPem), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Sign the JWT
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(signingInput)
    );

    const encodedSignature = encodeBase64(new Uint8Array(signature))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const jwt = `${signingInput}.${encodedSignature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch(serviceAccount.token_uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error: any) {
    console.error("[FCM] Error getting access token:", error);
    throw error;
  }
}

// Send notification to a specific FCM token
async function sendToToken(
  token: string,
  title: string,
  body: string,
  data: any = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountJson) {
      throw new Error("FCM_SERVICE_ACCOUNT_KEY not configured");
    }
    const serviceAccount = JSON.parse(serviceAccountJson);

    // FCM v1 API endpoint
    const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: token,
          // Use data-only payload so the service worker has full control
          // over notification display (icon, badge, tag). Using a 'notification'
          // payload causes Firebase to auto-display a notification AND trigger
          // onBackgroundMessage, resulting in duplicates.
          // Use data-only payload so the service worker has full control
          // over notification display (icon, badge, tag). Using a 'notification'
          // payload causes Firebase to auto-display a notification AND trigger
          // onBackgroundMessage, resulting in duplicates.
          data: {
            content_title: title, // Use specific keys to avoid conflicts
            content_body: body, // Use specific keys to avoid conflicts
            content_type: data.type || "message", // Priority to data.type
            title: title,
            body: body,
            url: "https://pps-psico.github.io/",
            ...data,
          },
          // Web push specific options
          webpush: {
            fcm_options: {
              link: "https://pps-psico.github.io/",
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[FCM] Send failed:", errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }

    const result = await response.json();
    console.log("[FCM] Message sent:", result.name);
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
      // Get all tokens using RPC function (bypasses RLS)
      console.log("[FCM] Querying fcm_tokens via RPC...");
      const { data, error } = await supabase.rpc("get_all_fcm_tokens");

      console.log("[FCM] RPC result:", { data, error, count: data?.length });

      if (error) {
        console.error("[FCM] RPC error:", error);
        throw error;
      }
      tokens = data?.map((t: any) => t.fcm_token) || [];
      console.log("[FCM] Found tokens:", tokens.length);
    } else if (user_ids && user_ids.length > 0) {
      // Get tokens for specific users
      const { data, error } = await supabase
        .from("fcm_tokens")
        .select("fcm_token")
        .in("user_id", user_ids);

      if (error) throw error;
      tokens = data?.map((t: any) => t.fcm_token) || [];
      console.log("[FCM] Found tokens:", tokens.length);
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
      const result = await sendToToken(token, title, messageBody, {
        ...(body.data || {}),
        type: body.type,
      });
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
