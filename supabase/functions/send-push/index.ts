/**
 * Web Push Notification Edge Function
 * Uses native Web Push API (RFC 8030) - No Firebase dependency
 *
 * Required Supabase Secrets:
 * - VAPID_PUBLIC_KEY: Your VAPID public key
 * - VAPID_PRIVATE_KEY: Your VAPID private key
 * - VAPID_SUBJECT: mailto:your-email@example.com
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -- CONFIGURATION --
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// VAPID Configuration (for Web Push)
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:pps@uflo.edu.ar";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("🔧 Config loaded:", {
  hasSupabaseUrl: !!SUPABASE_URL,
  hasVapidConfig: !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY,
});

// ============================================================================
// WEB PUSH IMPLEMENTATION (RFC 8030 + VAPID)
// ============================================================================

// Base64URL encoding/decoding utilities
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  // Add padding
  const padding = (4 - (str.length % 4)) % 4;
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padding);
  const binary = atob(base64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

// Import VAPID private key for signing
async function importVapidPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const keyData = base64UrlDecode(privateKeyBase64);

  // Create PKCS8 format from raw key
  // The raw key is 32 bytes for P-256
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Footer = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]);

  // Get public key from the VAPID_PUBLIC_KEY
  const publicKeyData = base64UrlDecode(VAPID_PUBLIC_KEY);
  const pkcs8Key = new Uint8Array([...pkcs8Header, ...keyData, ...pkcs8Footer, ...publicKeyData]);

  return crypto.subtle.importKey("pkcs8", pkcs8Key, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
}

// Create VAPID JWT token
async function createVapidJwt(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: VAPID_SUBJECT,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = await importVapidPrivateKey(VAPID_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw format (r || s)
  const signatureArray = new Uint8Array(signature);
  let rawSignature: Uint8Array;

  if (signatureArray.length === 64) {
    rawSignature = signatureArray;
  } else {
    // Parse DER format
    const rLength = signatureArray[3];
    const rStart = 4 + (signatureArray[4] === 0 ? 1 : 0);
    const rEnd = 4 + rLength;
    const sStart = rEnd + 2 + (signatureArray[rEnd + 3] === 0 ? 1 : 0);

    const r = signatureArray.slice(rStart, rStart + 32);
    const s = signatureArray.slice(sStart, sStart + 32);
    rawSignature = new Uint8Array([...r, ...s]);
  }

  const signatureB64 = base64UrlEncode(rawSignature);
  return `${unsignedToken}.${signatureB64}`;
}

// HKDF for key derivation
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  // Extract
  const prk = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        salt.length ? salt : new Uint8Array(32),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      ),
      ikm
    )
  );

  // Expand
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const infoWithCounter = new Uint8Array([...info, 1]);
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, infoWithCounter));

  return okm.slice(0, length);
}

// Encrypt payload using Web Push encryption (RFC 8291)
async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const userPublicKey = base64UrlDecode(p256dh);
  const userAuth = base64UrlDecode(auth);

  // Generate ephemeral key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  // Import user's public key
  const userKey = await crypto.subtle.importKey(
    "raw",
    userPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: userKey }, localKeyPair.privateKey, 256)
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Key derivation (RFC 8291)
  const encoder = new TextEncoder();
  const authInfo = encoder.encode("Content-Encoding: auth\0");
  const prkCombined = new Uint8Array([...userAuth, ...sharedSecret]);

  const ikm = await hkdf(userAuth, sharedSecret, authInfo, 32);

  const keyInfo = new Uint8Array([...encoder.encode("Content-Encoding: aes128gcm\0")]);
  const nonceInfo = new Uint8Array([...encoder.encode("Content-Encoding: nonce\0")]);

  const contentEncryptionKey = await hkdf(salt, ikm, keyInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding (RFC 8291)
  const paddingLength = 0;
  const paddedPayload = new Uint8Array([
    ...new Uint8Array(2), // Padding length (big-endian)
    ...encoder.encode(payload),
  ]);
  paddedPayload[0] = (paddingLength >> 8) & 0xff;
  paddedPayload[1] = paddingLength & 0xff;

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    paddedPayload
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    salt,
    localPublicKey,
  };
}

// Build encrypted body with aes128gcm header
function buildAes128gcmBody(
  ciphertext: Uint8Array,
  salt: Uint8Array,
  localPublicKey: Uint8Array,
  recordSize: number = 4096
): Uint8Array {
  const header = new Uint8Array(86);
  header.set(salt, 0); // 16 bytes salt
  header[16] = (recordSize >> 24) & 0xff;
  header[17] = (recordSize >> 16) & 0xff;
  header[18] = (recordSize >> 8) & 0xff;
  header[19] = recordSize & 0xff;
  header[20] = localPublicKey.length; // 1 byte key length
  header.set(localPublicKey, 21); // 65 bytes public key

  return new Uint8Array([...header, ...ciphertext]);
}

// Send Web Push notification
async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object
): Promise<Response> {
  const payloadString = JSON.stringify(payload);

  // Extract audience from endpoint
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // Create VAPID authorization
  const jwt = await createVapidJwt(audience);
  const vapidAuth = `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`;

  // Encrypt payload
  const { ciphertext, salt, localPublicKey } = await encryptPayload(payloadString, p256dh, auth);
  const body = buildAes128gcmBody(ciphertext, salt, localPublicKey);

  // Send request
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuth,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });

  return response;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  console.log("📥 Request received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, message, url, user_id } = await req.json();

    if (!title || !message) {
      throw new Error("Title and message are required.");
    }

    console.log(`[Push] Sending: "${title}" to ${user_id ? user_id : "ALL"}`);

    // Fetch subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    const { data: subscriptions, error: dbError } = await query;

    if (dbError) throw dbError;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Push] Found ${subscriptions.length} subscriptions`);

    const results: any[] = [];
    const payload = {
      title,
      message,
      url: url || "/",
    };

    // Send to all subscriptions
    for (const sub of subscriptions) {
      try {
        console.log(`[Push] Sending to endpoint ${sub.endpoint?.substring(0, 50)}...`);

        const response = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, payload);

        if (response.ok || response.status === 201) {
          results.push({ id: sub.id, success: true });
          console.log(`[Push] ✅ Success for ${sub.id}`);
        } else {
          const errorText = await response.text();
          console.error(`[Push] ❌ Error for ${sub.id}: ${response.status}`, errorText);
          results.push({ id: sub.id, success: false, error: errorText, status: response.status });

          // If subscription is expired or invalid (410 Gone, 404 Not Found), clean it up
          if (response.status === 410 || response.status === 404) {
            console.log(`[Push] Cleaning up expired subscription ${sub.id}`);
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      } catch (err: any) {
        console.error(`[Push] ❌ Error for ${sub.id}:`, err);
        results.push({ id: sub.id, success: false, error: String(err) });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[Push] Completed: ${successCount}/${subscriptions.length} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Push] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
