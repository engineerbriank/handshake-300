import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Loading, StatusBadge } from "@/components/common/ui-bits";
import { EmployerLogo } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApplications } from "@/lib/user-data";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_shell/applications")({
  head: () => ({ meta: [{ title: "My Applications — HANDSHAKE" }, { name: "description", content: "Track the jobs you've applied to." }] }),
  component: Applications,
});

const STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

function Applications() {
  const { data, isLoading } = useApplications();
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("job_applications").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_applications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });
  const active = data?.filter((a) => ["applied", "interviewing", "offer"].includes(a.status)) ?? [];
  const closed = data?.filter((a) => ["rejected", "withdrawn"].includes(a.status)) ?? [];

  const list = (items: typeof active) =>
    items.length === 0 ? (
      <EmptyState icon={<FileText />} title="No applications here" description="When you apply to a job, track it here to keep your search organised." action={<Button asChild><Link to="/jobs">Find jobs</Link></Button>} />
    ) : (
      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
            <EmployerLogo src={a.job?.employer_logo ?? null} name={a.job?.employer ?? "?"} />
            <div className="min-w-0 flex-1">
              <Link to="/jobs/$jobId" params={{ jobId: a.job_id }} className="block truncate font-semibold hover:underline">{a.job?.title}</Link>
              <p className="text-xs text-muted-foreground">{a.job?.employer} · Applied: {shortDate(a.applied_at)}</p>
            </div>
            <div className="hidden sm:block"><StatusBadge status={a.status} /></div>
            <Select value={a.status} onValueChange={(v) => update.mutate({ id: a.id, status: v })}>
              <SelectTrigger className="h-9 w-[130px] rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
            {a.job?.apply_url && <a href={a.job.apply_url} target="_blank" rel="noopener" className="rounded-lg p-2 hover:bg-secondary" aria-label="Open employer page"><ExternalLink className="h-4 w-4" /></a>}
            <button type="button" onClick={() => remove.mutate(a.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    );

  return (
    <div>
      <PageHeader title="My Applications" description="You update these statuses yourself — HANDSHAKE does not receive decisions from external employers." />
      {isLoading ? <Loading /> : (
        <Tabs defaultValue="active">
          <TabsList className="mb-4"><TabsTrigger value="active">Active ({active.length})</TabsTrigger><TabsTrigger value="closed">Completed ({closed.length})</TabsTrigger></TabsList>
          <TabsContent value="active">{list(active)}</TabsContent>
          <TabsContent value="closed">{list(closed)}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}
