import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type Role = Database["public"]["Enums"]["app_role"];

async function assertStaff(supabase: { rpc: (fn: "staff_has", args: { _roles: Role[] }) => PromiseLike<{ data: boolean | null }> }, roles: Role[]) {
  const { data } = await supabase.rpc("staff_has", { _roles: roles });
  if (!data) throw new Error("Not authorized, or multi-factor authentication is required for this action.");
}

export const adminRunJobSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ source: z.string().max(40).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, ["job_manager", "operations_admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncAllSources } = await import("./job-sync.server");
    const results = await syncAllSources(supabaseAdmin, data.source);
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "jobs.sync_triggered", entity_type: "job_source", entity_id: data.source ?? "all", details: JSON.parse(JSON.stringify({ results })) });
    return results;
  });

export const adminCheckProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, ["finance_admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshProviderStatus } = await import("./payouts.server");
    return refreshProviderStatus(supabaseAdmin);
  });

export const adminRunPayoutBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // The RPC itself enforces finance role + MFA.
    const { data: batchId, error } = await context.supabase.rpc("create_payout_batch");
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dispatchPendingPayouts, refreshProviderStatus } = await import("./payouts.server");
    await refreshProviderStatus(supabaseAdmin);
    const origin = new URL(getRequest().url).origin;
    const dispatched = await dispatchPendingPayouts(supabaseAdmin, origin, 10);
    return { batchId, dispatched };
  });

export const adminRefreshRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ currency: z.string().regex(/^[A-Z]{3}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, ["finance_admin"]);
    const { ensureRate } = await import("./wallet.functions");
    return ensureRate(data.currency);
  });

const jobInput = z.object({
  title: z.string().trim().min(3).max(250),
  employer: z.string().trim().min(1).max(200),
  description: z.string().trim().min(20).max(30000),
  responsibilities: z.string().trim().max(10000).optional(),
  requirements: z.string().trim().max(10000).optional(),
  location: z.string().trim().min(2).max(120),
  eligible_countries: z.array(z.string().max(60)).max(60),
  worldwide: z.boolean(),
  employment_type: z.string().max(40).optional(),
  category: z.string().max(40),
  experience_level: z.string().max(40).optional(),
  salary_min: z.number().min(0).optional(),
  salary_max: z.number().min(0).optional(),
  salary_currency: z.string().max(3).optional(),
  salary_period: z.enum(["annual", "monthly", "hourly"]).optional(),
  skills: z.array(z.string().max(40)).max(20),
  deadline: z.string().optional(),
  apply_url: z.string().url().regex(/^https?:\/\//),
  status: z.enum(["active", "pending_review"]),
  is_verified: z.boolean(),
});

function toParagraphs(text: string) {
  return text.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}
function toList(text?: string) {
  if (!text) return null;
  const items = text.split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  return items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : null;
}

export const adminCreateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, ["job_manager"]);
    const { cleanHtml, plainText, dedupeHash } = await import("./job-sync.server");
    const { data: src } = await context.supabase.from("job_sources").select("id").eq("slug", "direct").single();
    if (!src) throw new Error("Direct source missing");
    const description = cleanHtml(toParagraphs(data.description));
    const row = {
      source_id: src.id,
      external_id: crypto.randomUUID(),
      title: data.title,
      employer: data.employer,
      description,
      excerpt: plainText(description),
      responsibilities: toList(data.responsibilities) ? cleanHtml(toList(data.responsibilities)!) : null,
      requirements: toList(data.requirements) ? cleanHtml(toList(data.requirements)!) : null,
      location: data.location,
      eligible_countries: data.eligible_countries,
      is_remote: true,
      worldwide: data.worldwide,
      employment_type: data.employment_type ?? null,
      category: data.category,
      experience_level: data.experience_level ?? null,
      salary_min: data.salary_min ?? null,
      salary_max: data.salary_max ?? null,
      salary_currency: data.salary_min || data.salary_max ? (data.salary_currency ?? "USD") : null,
      salary_period: data.salary_min || data.salary_max ? (data.salary_period ?? "annual") : null,
      skills: data.skills.map((s) => s.toLowerCase()),
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      published_at: new Date().toISOString(),
      apply_url: data.apply_url,
      source_url: data.apply_url,
      status: data.status,
      is_verified: data.is_verified,
      dedupe_hash: dedupeHash(data.title, data.employer),
    };
    const { data: job, error } = await context.supabase.from("jobs").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return job;
  });
