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
        // Same schedule also sends "task deadline approaching" reminders (within 24h, once per task).
        const { data: reminders, error: remindError } = await supabaseAdmin.rpc("notify_task_deadlines");
        if (remindError) console.error("[cron] task deadline reminders failed:", remindError.message);
        return Response.json({ results, task_deadline_reminders: reminders ?? 0 });
      },
    },
  },
});
