import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/mpesa/timeout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["MPESA_CALLBACK_TOKEN"];
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!expected || token !== expected) return new Response("Unauthorized", { status: 401 });
        const payload = (await request.json().catch(() => null)) as { Result?: { ConversationID?: string } } | null;
        const conv = payload?.Result?.ConversationID;
        if (conv) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // A timeout does not prove failure: funds stay in clearing until finance reconciles with Safaricom.
          await supabaseAdmin
            .from("payout_transactions")
            .update({ last_error: "Provider queue timeout — awaiting reconciliation", callback_payload: JSON.parse(JSON.stringify(payload)) })
            .eq("provider_request_id", conv)
            .eq("status", "submitted");
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
