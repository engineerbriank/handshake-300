import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, EmptyState } from "@/components/common/ui-bits";
import { AdminTabs } from "@/components/admin/AdminBits";
import { tabSearch } from "@/components/admin/admin-nav";
import { useCurrentUser } from "@/lib/auth";
import { dateTime, humanize, errorMessage } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/support")({
  validateSearch: tabSearch,
  component: AdminSupport,
});

const STATUSES = ["open", "in_progress", "resolved", "closed"];

function AdminSupport() {
  const { tab = "open" } = Route.useSearch();
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [reply, setReply] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["admin-tickets", tab],
    queryFn: async () => {
      let qb = supabase.from("support_tickets").select("*, profile:profiles!support_tickets_user_id_fkey(email,first_name,last_name)").order("created_at", { ascending: false }).limit(100);
      if (tab === "open") qb = qb.in("status", ["open", "in_progress"]);
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });
  const upd = useMutation({
    mutationFn: async ({ id, status, response }: { id: string; status: string; response?: string }) => {
      const patch: { status: string; updated_at: string; assigned_to?: string; staff_response?: string } = { status, updated_at: new Date().toISOString(), assigned_to: user!.id };
      if (response !== undefined) patch.staff_response = response;
      const { error } = await supabase.from("support_tickets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ticket updated"); qc.invalidateQueries({ queryKey: ["admin-tickets"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div>
      <PageHeader title="Support" />
      <AdminTabs section="/admin/support" tab={tab} />
      {q.error && <p className="text-sm text-destructive">{errorMessage(q.error)}</p>}
      {!q.data?.length ? <EmptyState title="No tickets" description="Problems reported by users will appear here." /> : (
        <div className="space-y-3">
          {q.data.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{t.subject}</p><p className="text-xs text-muted-foreground">{t.profile?.first_name} {t.profile?.last_name} · {t.profile?.email} · {humanize(t.category)} · {humanize(t.priority)} · {dateTime(t.created_at)}</p></div>
                <Select value={t.status} onValueChange={(v) => upd.mutate({ id: t.id, status: v })}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent></Select>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{t.message}</p>
              {t.staff_response && <p className="mt-3 rounded-xl bg-info-soft p-3 text-sm"><b>Response:</b> {t.staff_response}</p>}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Textarea rows={2} placeholder="Write a response to the user" value={reply[t.id] ?? ""} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} />
                <Button disabled={(reply[t.id] ?? "").trim().length < 3 || upd.isPending} onClick={() => { upd.mutate({ id: t.id, status: "resolved", response: reply[t.id]!.trim() }); setReply({ ...reply, [t.id]: "" }); }}>Respond & resolve</Button>
              </div>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
