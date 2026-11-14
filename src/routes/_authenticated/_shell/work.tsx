import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, EmptyState, Loading, StatusBadge } from "@/components/common/ui-bits";
import { useClaims } from "@/lib/user-data";
import { useCurrentUser } from "@/lib/auth";
import { usd, dateTime, shortDate } from "@/lib/format";
import { uploadPrivate, validateFile } from "@/lib/upload";
import { useOpenTasks } from "@/lib/task-data";
import { FILE_SUBMISSION_TYPES, SUBMISSION_LABEL } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/work")({
  head: () => ({ meta: [
    { title: "My Tasks — Handshake" },
    { name: "description", content: "Tasks you've accepted, submitted, and been paid for." },
    { property: "og:title", content: "My Tasks — Handshake" },
    { property: "og:description", content: "Track accepted, submitted and paid tasks." },
  ] }),
  component: WorkPage,
});

type Claim = NonNullable<ReturnType<typeof useClaims>["data"]>[number];

const TABS = [
  { key: "accepted", label: "Accepted", statuses: ["claimed"] },
  { key: "in_progress", label: "In progress", statuses: ["in_progress"] },
  { key: "revision", label: "Revision requested", statuses: ["revision_requested"] },
  { key: "submitted", label: "Submitted", statuses: ["submitted"] },
  { key: "review", label: "Under review", statuses: ["under_review", "disputed"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "paid", label: "Paid", statuses: ["credited"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
  { key: "closed", label: "Released", statuses: ["abandoned", "expired"] },
] as const;

function WorkPage() {
  const { data: claims, isLoading } = useClaims();
  const open = useOpenTasks();
  const [tab, setTab] = useState<string>("accepted");
  const [submitFor, setSubmitFor] = useState<Claim | null>(null);
  const [disputeFor, setDisputeFor] = useState<Claim | null>(null);
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: async ({ fn, id }: { fn: "start_claim" | "abandon_claim"; id: string }) => {
      const { error } = await supabase.rpc(fn, { _claim: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["claims"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const mineIds = new Set(claims?.map((c) => c.assignment_id));
  const available = (open.data ?? []).filter((t) => !mineIds.has(t.id) && t.slots_claimed < t.slots).length;
  const count = (st: readonly string[]) => claims?.filter((c) => st.includes(c.status)).length ?? 0;
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const items = claims?.filter((c) => (current.statuses as readonly string[]).includes(c.status)) ?? [];

  return (
    <div>
      <PageHeader title="My Tasks" description="Everything you've accepted, from first step to payment." />
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link to="/assignments" className="shrink-0 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium hover:bg-secondary">Available ({available})</Link>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium", tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}>
            {t.label} ({count(t.statuses)})
          </button>
        ))}
      </div>
      {isLoading ? <Loading /> : items.length === 0 ? (
        <EmptyState icon={<ClipboardList />} title={`Nothing ${current.label.toLowerCase()}`} action={<Button asChild variant="outline"><Link to="/assignments">Browse paid tasks</Link></Button>} />
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/assignments/$assignmentId" params={{ assignmentId: c.assignment_id }} className="font-semibold hover:underline">{c.assignment?.title}</Link>
                  <p className="mt-0.5 text-sm text-muted-foreground"><span className="font-semibold text-success">{usd(c.assignment?.pay_usd)}</span> · accepted {shortDate(c.claimed_at)} · due {dateTime(c.due_at)}</p>
                  {c.status === "credited" && c.credited_at && <p className="mt-0.5 text-xs text-success">Credited to your wallet {dateTime(c.credited_at)}</p>}
                </div>
                <StatusBadge status={c.status} />
              </div>
              <ClaimHistory claimId={c.id} />
              <div className="mt-3 flex flex-wrap gap-2">
                {c.status === "claimed" && <Button size="sm" variant="outline" onClick={() => act.mutate({ fn: "start_claim", id: c.id })}>Start work</Button>}
                {["claimed", "in_progress", "revision_requested"].includes(c.status) && (
                  <>
                    <Button size="sm" onClick={() => setSubmitFor(c)}>{c.status === "revision_requested" ? "Submit revision" : "Submit work"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm("Release this slot? You won't be able to accept this task again.") && act.mutate({ fn: "abandon_claim", id: c.id })}>Release slot</Button>
                  </>
                )}
                {c.status === "rejected" && <Button size="sm" variant="outline" onClick={() => setDisputeFor(c)}>Open dispute</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {submitFor && <SubmitDialog claim={submitFor} onClose={() => setSubmitFor(null)} />}
      {disputeFor && <DisputeDialog claim={disputeFor} onClose={() => setDisputeFor(null)} />}
    </div>
  );
}

function ClaimHistory({ claimId }: { claimId: string }) {
  const q = useQuery({
    queryKey: ["claim-history", claimId],
    queryFn: async () => {
      const { data } = await supabase.from("assignment_submissions").select("id,revision_number,submitted_at,reviews:submission_reviews(decision,reason,created_at)").eq("claim_id", claimId).order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });
  const reviews = q.data?.flatMap((s) => (s.reviews ?? []).map((r) => ({ ...r, rev: s.revision_number }))) ?? [];
  if (!reviews.length) return null;
  return (
    <ul className="mt-3 space-y-1.5 rounded-xl bg-surface p-3 text-xs">
      {reviews.map((r, i) => (
        <li key={i}><StatusBadge status={r.decision} /> <span className="text-muted-foreground">{shortDate(r.created_at)}</span> {r.reason && <span>— {r.reason}</span>}</li>
      ))}
    </ul>
  );
}

function SubmitDialog({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const types = claim.assignment?.submission_types ?? ["text"];
  const needsFile = types.some((t) => FILE_SUBMISSION_TYPES.includes(t));
  const needsLink = types.includes("url");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState("");
  const linkList = links.split(/\s+/).map((l) => l.trim()).filter(Boolean);
  const problems = [
    content.trim().length < 20 && "Describe your work in at least 20 characters",
    needsFile && files.length === 0 && "Attach at least one file",
    needsLink && linkList.length === 0 && "Add at least one link",
    linkList.some((l) => !/^https:\/\/\S+\.\S+/.test(l)) && "Links must start with https://",
    files.length > 10 && "Up to 10 files",
  ].filter(Boolean) as string[];
  const m = useMutation({
    mutationFn: async () => {
      for (const f of files) { const err = validateFile(f, ["document", "image", "archive", "spreadsheet", "audio", "video"]); if (err) throw new Error(`${f.name}: ${err}`); }
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadPrivate(user!.id, "submissions", f));
      const { error } = await supabase.rpc("submit_task", { _claim: claim.id, _content: content.trim(), _attachments: paths, _links: linkList });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Submitted. The amount shows as pending until it's approved."); qc.invalidateQueries(); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit: {claim.assignment?.title}</DialogTitle>
          <DialogDescription>Due {dateTime(claim.due_at)}. Required: {types.map((t) => SUBMISSION_LABEL[t] ?? t).join(", ")}.</DialogDescription>
        </DialogHeader>
        {claim.assignment?.deliverables && <p className="rounded-xl bg-surface p-3 text-sm">{claim.assignment.deliverables}</p>}
        <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Your response, or a summary of what you've attached" maxLength={20000} />
        <Textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} placeholder={needsLink ? "Links (required) — one per line, https:// only" : "Links (optional) — one per line, https:// only"} />
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <Paperclip className="h-4 w-4 shrink-0" /> {files.length ? files.map((f) => f.name).join(", ") : `Attach files${needsFile ? " (required)" : ""}: PDF, DOCX, image, spreadsheet, audio, video or ZIP — 10 MB each, up to 10`}
          <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        {problems.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{problems.map((p) => <li key={p}>• {p}</li>)}</ul>}
        <p className="text-xs text-muted-foreground">Submit only your own work. Copies of other people's submissions are detected and rejected. Never include passwords or one-time codes.</p>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={problems.length > 0 || m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Submit for review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisputeDialog({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("open_dispute", { _claim: claim.id, _reason: reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dispute opened. A reviewer will look at it again.");
      qc.invalidateQueries({ queryKey: ["claims"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dispute rejection</DialogTitle><DialogDescription>Explain why your submission meets the task requirements.</DialogDescription></DialogHeader>
        <Textarea rows={5} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={3000} />
        <DialogFooter><Button onClick={() => m.mutate()} disabled={reason.trim().length < 10 || m.isPending}>Open dispute</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
