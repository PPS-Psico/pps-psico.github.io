/**
 * OneSignal Verification Edge Function
 * Verifies the status of OneSignal player IDs via REST API
 *
 * Required Supabase Secrets:
 * - ONESIGNAL_REST_API_KEY: Your OneSignal REST API Key
 * - ONESIGNAL_APP_ID: Your OneSignal App ID
 *
 * Deployed via GitHub Actions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -- CONFIGURATION --
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
const ONESIGNAL_APP_ID = "53f3327c-9553-41fc-919e-73161c8517f7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Verify player ID status with OneSignal API
async function verifyPlayerId(playerId: string): Promise<{
  valid: boolean;
  device_type?: number;
  invalid_identifier?: boolean;
  unsubscribed?: boolean;
  reason?: string;
  raw?: any;
}> {
  try {
    // OneSignal API endpoint to view device
    const url = `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`;

    console.log(`[OneSignal Verify] Checking player ID: ${playerId}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
    });

    const data = await response.json();
    console.log(`[OneSignal Verify] Response for ${playerId}:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      // Player ID not found or invalid
      if (response.status === 404 || data.errors?.includes("User not found")) {
        return {
          valid: false,
          reason: "Player ID not found in OneSignal",
          raw: data,
        };
      }

      return {
        valid: false,
        reason: `API error: ${data.errors?.join(", ") || response.statusText}`,
        raw: data,
      };
    }

    // Check device status
    const isInvalid = data.invalid_identifier === true;
    const isUnsubscribed = data.invalid_identifier === true || data.subscribed === false;

    if (isInvalid || isUnsubscribed) {
      return {
        valid: false,
        device_type: data.device_type,
        invalid_identifier: isInvalid,
        unsubscribed: isUnsubscribed,
        reason: isInvalid ? "Device marked as invalid" : "Device unsubscribed",
        raw: data,
      };
    }

    return {
      valid: true,
      device_type: data.device_type,
      invalid_identifier: false,
      unsubscribed: false,
      raw: data,
    };
  } catch (error: any) {
    console.error(`[OneSignal Verify] Error:`, error);
    return {
      valid: false,
      reason: `Exception: ${error.message}`,
    };
  }
}

// Get all subscriptions from database and verify them
async function verifyAllSubscriptions(): Promise<{
  total: number;
  valid: number;
  invalid: number;
  unknown: number;
  details: any[];
}> {
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, onesignal_player_id, created_at")
    .not("onesignal_player_id", "is", null);

  if (error) {
    throw error;
  }

  const results = {
    total: subscriptions?.length || 0,
    valid: 0,
    invalid: 0,
    unknown: 0,
    details: [] as any[],
  };

  if (!subscriptions || subscriptions.length === 0) {
    return results;
  }

  // Verificar cada suscripción (con delay para no saturar la API)
  for (const sub of subscriptions) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay

    const verification = await verifyPlayerId(sub.onesignal_player_id);

    const detail = {
      subscription_id: sub.id,
      user_id: sub.user_id,
      player_id: sub.onesignal_player_id,
      created_at: sub.created_at,
      ...verification,
    };

    results.details.push(detail);

    if (verification.valid) {
      results.valid++;
    } else if (verification.reason?.includes("not found")) {
      results.unknown++;
    } else {
      results.invalid++;
    }
  }

  return results;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  console.log("📥 OneSignal Verify Request received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { player_id, verify_all } = body;

    // Verify specific player ID
    if (player_id) {
      const result = await verifyPlayerId(player_id);

      return new Response(
        JSON.stringify({
          player_id,
          ...result,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify all subscriptions
    if (verify_all) {
      if (!ONESIGNAL_REST_API_KEY) {
        throw new Error("ONESIGNAL_REST_API_KEY not configured");
      }

      const results = await verifyAllSubscriptions();

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No action specified
    return new Response(
      JSON.stringify({
        error: "Specify either 'player_id' to verify one, or 'verify_all: true' to verify all",
        usage: {
          verify_single: { player_id: "xxxxx-xxxxx-xxxxx" },
          verify_all: { verify_all: true },
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  } catch (error: any) {
    console.error("[OneSignal Verify] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
