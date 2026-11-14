import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/common/ui-bits";
import { usd, dateTime, errorMessage } from "@/lib/format";
import { openPrivate } from "@/lib/upload";

/** Latest submission per claim with approve / revision / reject actions. Permission is enforced by the review_submission backend function. */
export function ReviewQueue({ statuses, assignmentIds }: { statuses: ("submitted" | "under_review" | "disputed")[]; assignmentIds?: string[] }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["admin-reviews", statuses, assignmentIds],
    enabled: !assignmentIds || assignmentIds.length > 0,
    queryFn: async () => {
      let qb = supabase
        .from("assignment_claims")
        .select("id,status,revisions_used,updated_at, assignment:assignments(title,pay_usd,max_revisions), profile:profiles(email,first_name,last_name), submissions:assignment_submissions(id,content,file_path,revision_number,submitted_at)")
        .in("status", statuses)
        .order("updated_at");
      if (assignmentIds) qb = qb.in("assignment_id", assignmentIds);
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });
  const review = useMutation({
    mutationFn: async ({ sub, decision }: { sub: string; decision: "approved" | "revision_requested" | "rejected" }) => {
      const { error } = await supabase.rpc("review_submission", { _submission: sub, _decision: decision, _reason: reason[sub] || undefined });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Review recorded"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); qc.invalidateQueries({ queryKey: ["admin-disputes"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!q.data?.length) return <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No submissions waiting.</p>;
  return (
    <div className="space-y-3">
      {q.data.map((c) => {
        const latest = [...(c.submissions ?? [])].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
        if (!latest) return null;
        return (
          <div key={c.id} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{c.assignment?.title} · <span className="text-success">{usd(c.assignment?.pay_usd)}</span></p><p className="text-xs text-muted-foreground">{c.profile ? `${c.profile.first_name} ${c.profile.last_name} (${c.profile.email}) · ` : "Worker · "}revision {latest.revision_number} of {c.assignment?.max_revisions} · {dateTime(latest.submitted_at)}</p></div>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm">{latest.content}</p>
            {latest.file_path && <Button size="sm" variant="outline" className="mt-2" onClick={() => openPrivate(latest.file_path!).catch((e) => toast.error(errorMessage(e)))}><FileText /> Open attachment</Button>}
            <Textarea rows={2} className="mt-3" placeholder="Reason (required for revision or rejection, shown to worker)" value={reason[latest.id] ?? ""} onChange={(e) => setReason({ ...reason, [latest.id]: e.target.value })} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="success" disabled={review.isPending} onClick={() => confirm(`Approve and credit ${usd(c.assignment?.pay_usd)} to this worker?`) && review.mutate({ sub: latest.id, decision: "approved" })}>Approve & credit</Button>
              <Button size="sm" variant="outline" disabled={review.isPending || c.revisions_used >= (c.assignment?.max_revisions ?? 0)} onClick={() => review.mutate({ sub: latest.id, decision: "revision_requested" })}>Request revision</Button>
              <Button size="sm" variant="destructive" disabled={review.isPending} onClick={() => review.mutate({ sub: latest.id, decision: "rejected" })}>Reject</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

