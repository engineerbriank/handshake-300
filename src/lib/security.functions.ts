import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Records a sign-in event with IP/user agent and flags unfamiliar devices or countries. */
export const recordSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const req = getRequest();
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
    const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64);
    const country = (req.headers.get("cf-ipcountry") ?? "").slice(0, 8) || null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prior } = await supabaseAdmin
      .from("user_sessions")
      .select("user_agent, country")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);

    const browserKey = (s: string) => s.replace(/[\d.]+/g, "").slice(0, 120);
    const hasHistory = (prior?.length ?? 0) > 0;
    const knownDevice = prior?.some((p) => browserKey(p.user_agent ?? "") === browserKey(ua));
    const knownCountry = !country || prior?.some((p) => p.country === country);
    const suspicious = hasHistory && (!knownDevice || !knownCountry);

    await supabaseAdmin.from("user_sessions").insert({ user_id: context.userId, user_agent: ua, ip_address: ip, country, suspicious });
    if (suspicious) {
      await supabaseAdmin.from("notifications").insert({
        user_id: context.userId,
        type: "security",
        title: "New sign-in detected",
        body: `A sign-in from ${!knownCountry ? `a new country (${country})` : "a new device or browser"} was recorded. If this wasn't you, change your password and enable two-factor authentication.`,
        link: "/login-activity",
      });
    }
    return { suspicious };
  });
