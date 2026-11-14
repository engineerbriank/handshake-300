import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/common/ui-bits";
import { usd, dateTime, errorMessage } from "@/lib/format";
import { openPrivate } from "@/lib/upload";
import { FILE_SUBMISSION_TYPES, SUBMISSION_LABEL } from "@/lib/tasks";

type Sub = { id: string; content: string; file_path: string | null; attachments: string[]; links: string[]; content_hash: string | null; revision_number: number; submitted_at: string };

/** Latest submission per claim with automated checks and approve / revision / reject actions. Permission is enforced by the review_submission backend function. */
export function ReviewQueue({ statuses, assignmentIds }: { statuses: ("submitted" | "under_review" | "disputed")[]; assignmentIds?: string[] }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<Record<string, string>>({});
  const [ticks, setTicks] = useState<Record<string, Record<number, boolean>>>({});
  const q = useQuery({
    queryKey: ["admin-reviews", statuses, assignmentIds],
    enabled: !assignmentIds || assignmentIds.length > 0,
    queryFn: async () => {
      let qb = supabase
        .from("assignment_claims")
        .select("id,status,user_id,assignment_id,revisions_used,updated_at, assignment:assignments(title,pay_usd,max_revisions,submission_types,verification_checklist), profile:profiles(email,first_name,last_name), submissions:assignment_submissions(id,content,file_path,attachments,links,content_hash,revision_number,submitted_at)")
        .in("status", statuses)
        .order("updated_at");
      if (assignmentIds) qb = qb.in("assignment_id", assignmentIds);
      const { data, error } = await qb;
      if (error) throw error;
      const users = [...new Set((data ?? []).map((c) => c.user_id))];
      const hist = users.length ? (await supabase.from("assignment_claims").select("user_id,status").in("user_id", users)).data ?? [] : [];
      const hashes = (data ?? []).flatMap((c) => (c.submissions ?? []).map((s) => s.content_hash)).filter(Boolean) as string[];
      const dupes = hashes.length ? (await supabase.from("assignment_submissions").select("content_hash,user_id").in("content_hash", hashes)).data ?? [] : [];
      return { rows: data ?? [], hist, dupes };
    },
  });
  const start = useMutation({
    mutationFn: async (sub: string) => { const { error } = await supabase.rpc("admin_start_review", { _submission: sub }); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }), onError: (e) => toast.error(errorMessage(e)),
  });
  const review = useMutation({
    mutationFn: async ({ sub, decision }: { sub: string; decision: "approved" | "revision_requested" | "rejected" }) => {
      const { error } = await supabase.rpc("review_submission", { _submission: sub, _decision: decision, _reason: reason[sub] || undefined });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Review recorded"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); qc.invalidateQueries({ queryKey: ["admin-disputes"] }); qc.invalidateQueries({ queryKey: ["admin-task-stats"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!q.data?.rows.length) return <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No submissions waiting.</p>;
  return (
    <div className="space-y-3">
      {q.data.rows.map((c) => {
        const latest = [...((c.submissions ?? []) as Sub[])].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
        if (!latest) return null;
        const types = c.assignment?.submission_types ?? [];
        const checklist = c.assignment?.verification_checklist ?? [];
        const files = latest.attachments?.length ? latest.attachments : latest.file_path ? [latest.file_path] : [];
        const h = q.data.hist.filter((x) => x.user_id === c.user_id);
        const dupOthers = q.data.dupes.filter((d) => d.content_hash === latest.content_hash && d.user_id !== c.user_id).length;
        const auto = [
          { ok: latest.content.trim().length >= 20, label: "Written response present" },
          ...(types.some((t) => FILE_SUBMISSION_TYPES.includes(t)) ? [{ ok: files.length > 0, label: `Required file evidence (${files.length} attached)` }] : []),
          ...(types.includes("url") ? [{ ok: latest.links.length > 0, label: `Required link (${latest.links.length})` }] : []),
          { ok: latest.links.every((l) => /^https:\/\/\S+\.\S+/.test(l)), label: "Links are valid https addresses" },
          { ok: dupOthers === 0, label: dupOthers ? `Matches ${dupOthers} other participant submission(s)` : "No duplicate of other participants' work" },
        ];
        const t = ticks[latest.id] ?? {};
        const allTicked = checklist.every((_, i) => t[i]);
        return (
          <div key={c.id} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{c.assignment?.title} · <span className="text-success">{usd(c.assignment?.pay_usd)}</span></p>
                <p className="text-xs text-muted-foreground">{c.profile ? `${c.profile.first_name} ${c.profile.last_name} (${c.profile.email}) · ` : "Worker · "}revision {latest.revision_number} of {c.assignment?.max_revisions} · {dateTime(latest.submitted_at)}</p>
                <p className="text-xs text-muted-foreground">History: {h.filter((x) => x.status === "credited").length} paid · {h.filter((x) => x.status === "rejected").length} rejected · {h.length} accepted in total</p>
              </div>
              <div className="flex items-center gap-2"><StatusBadge status={c.status} />{c.status === "submitted" && <Button size="sm" variant="outline" onClick={() => start.mutate(latest.id)}>Start review</Button>}</div>
            </div>
            <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{auto.map((a) => <li key={a.label} className="flex items-center gap-1.5">{a.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />} {a.label}</li>)}</ul>
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm">{latest.content}</p>
            {(files.length > 0 || latest.links.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f, i) => <Button key={f} size="sm" variant="outline" onClick={() => openPrivate(f).catch((e) => toast.error(errorMessage(e)))}><FileText /> File {i + 1}: {f.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "").slice(0, 40)}</Button>)}
                {latest.links.map((l) => <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs underline"><ExternalLink className="h-3 w-3" /> {l.slice(0, 60)}</a>)}
              </div>
            )}
            {checklist.length > 0 && (
              <div className="mt-3 space-y-1.5 rounded-xl border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviewer checklist</p>
                {checklist.map((item, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm"><Checkbox checked={!!t[i]} onCheckedChange={(v) => setTicks({ ...ticks, [latest.id]: { ...t, [i]: !!v } })} className="mt-0.5" /> {item}</label>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Expected evidence: {types.map((x) => SUBMISSION_LABEL[x] ?? x).join(", ")}</p>
            <Textarea rows={2} className="mt-3" placeholder="Reviewer note — required for revision or rejection and shown to the worker" value={reason[latest.id] ?? ""} onChange={(e) => setReason({ ...reason, [latest.id]: e.target.value })} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="success" disabled={review.isPending || (checklist.length > 0 && !allTicked)} title={checklist.length && !allTicked ? "Tick every checklist item to approve" : undefined} onClick={() => confirm(`Approve and credit ${usd(c.assignment?.pay_usd)} to this worker?`) && review.mutate({ sub: latest.id, decision: "approved" })}>Approve & credit</Button>
              <Button size="sm" variant="outline" disabled={review.isPending || c.revisions_used >= (c.assignment?.max_revisions ?? 0)} onClick={() => review.mutate({ sub: latest.id, decision: "revision_requested" })}>Request revision</Button>
              <Button size="sm" variant="destructive" disabled={review.isPending} onClick={() => review.mutate({ sub: latest.id, decision: "rejected" })}>Reject</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
