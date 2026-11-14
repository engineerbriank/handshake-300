import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export const MPESA_SECRETS = ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_INITIATOR_NAME", "MPESA_SECURITY_CREDENTIAL", "MPESA_CALLBACK_TOKEN"] as const;

export function missingSecrets(names: readonly string[]) {
  return names.filter((n) => !process.env[n]);
}

function darajaBase() {
  return process.env["MPESA_ENV"] === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

async function darajaToken() {
  const auth = btoa(`${process.env["MPESA_CONSUMER_KEY"]}:${process.env["MPESA_CONSUMER_SECRET"]}`);
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Daraja auth returned no token");
  return body.access_token;
}

/** Submits one M-Pesa B2C payment. Returns the provider ConversationID; confirmation arrives later via the result callback. */
async function submitMpesa(p: { payoutId: string; phone: string; amountKes: number; baseUrl: string }) {
  const token = await darajaToken();
  const cb = encodeURIComponent(process.env["MPESA_CALLBACK_TOKEN"]!);
  const res = await fetch(`${darajaBase()}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginatorConversationID: p.payoutId,
      InitiatorName: process.env["MPESA_INITIATOR_NAME"],
      SecurityCredential: process.env["MPESA_SECURITY_CREDENTIAL"],
      CommandID: "BusinessPayment",
      Amount: p.amountKes,
      PartyA: process.env["MPESA_SHORTCODE"],
      PartyB: p.phone.replace(/^\+/, ""),
      Remarks: "HANDSHAKE withdrawal",
      QueueTimeOutURL: `${p.baseUrl}/api/public/payments/mpesa/timeout?token=${cb}`,
      ResultURL: `${p.baseUrl}/api/public/payments/mpesa/result?token=${cb}`,
      Occasion: p.payoutId.slice(0, 20),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { ResponseCode?: string; ConversationID?: string; errorMessage?: string; ResponseDescription?: string };
  if (!res.ok || body.ResponseCode !== "0" || !body.ConversationID) {
    throw new Error(`M-Pesa rejected the request: ${body.errorMessage ?? body.ResponseDescription ?? res.status}`);
  }
  return body.ConversationID;
}

/** Sends pending payout transactions to their providers. Never marks anything paid — only provider callbacks do. */
export async function dispatchPendingPayouts(admin: Admin, baseUrl: string, limit = 5) {
  const { data: pending } = await admin
    .from("payout_transactions")
    .select("id, provider, attempts, withdrawal:withdrawal_requests(id, net_local, local_currency, method:withdrawal_methods(phone))")
    .eq("status", "pending")
    .lt("attempts", 5)
    .order("created_at")
    .limit(limit);
  const results: { id: string; outcome: string }[] = [];
  for (const p of pending ?? []) {
    const w = p.withdrawal as unknown as { net_local: number; local_currency: string; method: { phone: string | null } | null } | null;
    try {
      if (p.provider === "mpesa") {
        const missing = missingSecrets(MPESA_SECRETS);
        if (missing.length) throw new Error(`M-Pesa is not connected (missing ${missing.join(", ")})`);
        if (!w?.method?.phone) throw new Error("Payout phone number missing");
        const amount = Math.floor(Number(w.net_local));
        if (amount < 10) throw new Error("M-Pesa minimum B2C amount is KES 10");
        const conv = await submitMpesa({ payoutId: p.id, phone: w.method.phone, amountKes: amount, baseUrl });
        const { error } = await admin.rpc("payout_mark_submitted", { _payout: p.id, _provider_request_id: conv });
        if (error) throw error;
        results.push({ id: p.id, outcome: "submitted" });
      } else {
        throw new Error(`No authorised ${p.provider} payout integration is connected`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.rpc("payout_mark_attempt_error", { _payout: p.id, _error: msg });
      results.push({ id: p.id, outcome: `held: ${msg}` });
    }
  }
  return results;
}

export async function refreshProviderStatus(admin: Admin) {
  const { data: providers } = await admin.from("payment_providers").select("id, slug, required_secrets");
  const out: { slug: string; status: string; missing: string[] }[] = [];
  for (const p of providers ?? []) {
    const missing = p.required_secrets.length ? missingSecrets(p.required_secrets) : ["Authorised payout partner integration"];
    const status = missing.length ? "not_connected" : p.slug === "mpesa" && process.env["MPESA_ENV"] !== "production" ? "sandbox" : "live";
    await admin.from("payment_providers").update({ connection_status: status, last_checked_at: new Date().toISOString(), last_error: missing.length ? `Missing: ${missing.join(", ")}` : null }).eq("id", p.id);
    out.push({ slug: p.slug, status, missing });
  }
  return out;
}
