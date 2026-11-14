import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

type DarajaResult = {
  Result?: {
    ResultCode?: number | string;
    ResultDesc?: string;
    OriginatorConversationID?: string;
    ConversationID?: string;
    TransactionID?: string;
  };
};

export const Route = createFileRoute("/api/public/payments/mpesa/result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["MPESA_CALLBACK_TOKEN"];
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!expected || !safeEqual(token, expected)) return new Response("Unauthorized", { status: 401 });

        const payload = (await request.json().catch(() => null)) as DarajaResult | null;
        const r = payload?.Result;
        if (!r?.ConversationID) return Response.json({ ResultCode: 1, ResultDesc: "Malformed result" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payout } = await supabaseAdmin
          .from("payout_transactions")
          .select("id, status")
          .eq("provider_request_id", r.ConversationID)
          .maybeSingle();
        if (!payout) return Response.json({ ResultCode: 1, ResultDesc: "Unknown conversation" }, { status: 404 });
        if (payout.status === "confirmed" || payout.status === "failed") return Response.json({ ResultCode: 0, ResultDesc: "Already processed" });

        const json = JSON.parse(JSON.stringify(payload));
        if (Number(r.ResultCode) === 0 && r.TransactionID) {
          const { error } = await supabaseAdmin.rpc("payout_confirm", { _payout: payout.id, _receipt: r.TransactionID, _payload: json });
          if (error) {
            console.error("[mpesa] confirm failed", error.message);
            return Response.json({ ResultCode: 1, ResultDesc: "Processing error" }, { status: 500 });
          }
        } else {
          const { error } = await supabaseAdmin.rpc("payout_fail", { _payout: payout.id, _reason: `M-Pesa: ${r.ResultDesc ?? "payment failed"}`, _payload: json });
          if (error) console.error("[mpesa] fail handling error", error.message);
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
