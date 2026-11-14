import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/sync-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = (await request.json().catch(() => ({}))) as { source?: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncAllSources } = await import("@/lib/job-sync.server");
        const results = await syncAllSources(supabaseAdmin, body.source);
        return Response.json({ results });
      },
    },
  },
});
