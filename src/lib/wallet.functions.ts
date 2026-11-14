import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RATE_SOURCE = "ExchangeRate-API open access (open.er-api.com)";

/** Returns a recent documented USD→currency rate, refreshing it from the public source when older than 6 hours. */
export async function ensureRate(currency: string) {
  if (currency === "USD") return { rate: 1, source: "USD", fetched_at: new Date().toISOString() };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data: recent } = await supabaseAdmin.from("exchange_rates").select("rate,source,fetched_at").eq("quote", currency).gte("fetched_at", since).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  if (recent) return { rate: Number(recent.rate), source: recent.source, fetched_at: recent.fetched_at };
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error("Exchange rate source is unavailable. Please try again shortly.");
  const body = (await res.json()) as { result: string; rates: Record<string, number>; time_last_update_unix: number };
  const rate = body.rates?.[currency];
  if (body.result !== "success" || !rate) throw new Error(`No published USD/${currency} rate is available right now.`);
  const row = { base: "USD", quote: currency, rate, source: RATE_SOURCE, source_timestamp: new Date(body.time_last_update_unix * 1000).toISOString() };
  const { data, error } = await supabaseAdmin.from("exchange_rates").insert(row).select("rate,source,fetched_at").single();
  if (error) throw new Error("Could not record the exchange rate.");
  return { rate: Number(data.rate), source: data.source, fetched_at: data.fetched_at };
}

export const getWithdrawalQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ methodId: z.string().uuid(), amount: z.number().positive().max(1_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: method } = await context.supabase.from("withdrawal_methods").select("provider").eq("id", data.methodId).single();
    if (!method) throw new Error("Payment method not found");
    const [{ data: provider }, { data: fee }] = await Promise.all([
      context.supabase.from("payment_providers").select("currency,enabled,name,connection_status").eq("slug", method.provider).single(),
      context.supabase.from("platform_fees").select("percent,flat_usd").eq("kind", "withdrawal").eq("provider", method.provider).eq("active", true).maybeSingle(),
    ]);
    if (!provider) throw new Error("Provider not configured");
    const r = await ensureRate(provider.currency);
    const amount = Math.round(data.amount * 100) / 100;
    const feeUsd = Math.round((amount * Number(fee?.percent ?? 0)) / 100 * 100 + Number(fee?.flat_usd ?? 0) * 100) / 100;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      currency: provider.currency,
      providerName: provider.name,
      providerEnabled: provider.enabled,
      connection: provider.connection_status,
      amountUsd: amount,
      feeUsd,
      netUsd: round2(amount - feeUsd),
      rate: r.rate,
      rateSource: r.source,
      rateFetchedAt: r.fetched_at,
      grossLocal: round2(amount * r.rate),
      feeLocal: round2(feeUsd * r.rate),
      netLocal: round2((amount - feeUsd) * r.rate),
    };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ methodId: z.string().uuid(), amount: z.number().positive().max(1_000_000), idempotencyKey: z.string().min(8).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: method } = await context.supabase.from("withdrawal_methods").select("provider").eq("id", data.methodId).single();
    if (!method) throw new Error("Payment method not found");
    const { data: provider } = await context.supabase.from("payment_providers").select("currency").eq("slug", method.provider).single();
    if (provider) await ensureRate(provider.currency);
    const { data: id, error } = await context.supabase.rpc("request_withdrawal", { _method: data.methodId, _amount: data.amount, _idempotency_key: data.idempotencyKey });
    if (error) throw new Error(error.message);
    return { id };
  });
