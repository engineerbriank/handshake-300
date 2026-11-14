import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, Loading } from "@/components/common/ui-bits";
import { useNotifications } from "@/lib/user-data";
import { useCurrentUser } from "@/lib/auth";
import { ago, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/notifications")({
  head: () => ({ meta: [{ title: "Notifications — HANDSHAKE" }, { name: "description", content: "Updates about your account, work and earnings." }] }),
  component: Notifications,
});

function Notifications() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useNotifications(100);
  const qc = useQueryClient();
  const router = useRouter();
  const inval = () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["unread"] }); };
  const markAll = useMutation({ mutationFn: async () => { await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null); }, onSuccess: inval });
  const markOne = useMutation({ mutationFn: async (id: string) => { await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); }, onSuccess: inval });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("notifications").delete().eq("id", id); }, onSuccess: inval });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" actions={!!data?.some((n) => !n.read_at) && <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>Mark all as read</Button>} />
      {isLoading ? <Loading /> : data?.length ? (
        <ul className="divide-y rounded-2xl border bg-card shadow-card">
          {data.map((n) => (
            <li key={n.id} className={cn("flex gap-3 px-5 py-4", !n.read_at && "bg-info-soft/40")} onMouseEnter={() => !n.read_at && markOne.mutate(n.id)}>
              <Bell className={cn("mt-0.5 h-5 w-5 shrink-0", n.read_at ? "text-muted-foreground" : "text-info")} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{humanize(n.type)} · {ago(n.created_at)}{n.link && <> · <a href={n.link} onClick={(e) => { e.preventDefault(); router.history.push(n.link!); }} className="font-semibold text-foreground">Open</a></>}</p>
              </div>
              <button type="button" onClick={() => del.mutate(n.id)} className="self-start rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<Bell />} title="No notifications" />}
    </div>
  );
}
