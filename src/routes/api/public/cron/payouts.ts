import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * action "batch": weekly Saturday 20:00 EAT run — builds the payout batch from eligible requests.
 * action "dispatch": frequent small runs — sends pending batch items to providers and retries held ones.
 */
export const Route = createFileRoute("/api/public/cron/payouts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = (await request.json().catch(() => ({}))) as { action?: "batch" | "dispatch" };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { dispatchPendingPayouts, refreshProviderStatus } = await import("@/lib/payouts.server");
        const baseUrl = new URL(request.url).origin;
        if (body.action === "batch") {
          await refreshProviderStatus(supabaseAdmin);
          const { data: batchId, error } = await supabaseAdmin.rpc("create_payout_batch");
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ batchId });
        }
        const results = await dispatchPendingPayouts(supabaseAdmin, baseUrl, 5);
        return Response.json({ results });
      },
    },
  },
});
