import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Loading } from "@/components/common/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_shell/login-activity")({
  head: () => ({ meta: [{ title: "Login Activity — Handshake" }, { name: "description", content: "Recent sign-ins to your account." }] }),
  component: LoginActivity,
});

function browser(ua: string | null) {
  if (!ua) return "Unknown device";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${b}${os ? ` on ${os}` : ""}`;
}

function LoginActivity() {
  const { user } = useCurrentUser();
  const q = useQuery({ queryKey: ["sessions", user?.id], enabled: !!user, queryFn: async () => (await supabase.from("user_sessions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? [] });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Login Activity" description="Sign-ins from new devices or countries are flagged and trigger a security alert." />
      {q.isLoading ? <Loading /> : q.data?.length ? (
        <ul className="divide-y rounded-2xl border bg-card shadow-card">
          {q.data.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              {s.suspicious ? <AlertTriangle className="h-5 w-5 text-warning" /> : <Monitor className="h-5 w-5 text-muted-foreground" />}
              <div className="flex-1">
                <p className="font-medium">{browser(s.user_agent)} {s.suspicious && <span className="text-xs font-semibold text-warning">· New device or location</span>}</p>
                <p className="text-xs text-muted-foreground">{dateTime(s.created_at)} · {s.ip_address || "IP unavailable"}{s.country ? ` · ${s.country}` : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No sign-ins recorded yet" />}
    </div>
  );
}
