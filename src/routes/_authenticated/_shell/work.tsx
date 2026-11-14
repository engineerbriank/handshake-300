import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, EmptyState, Loading, StatusBadge } from "@/components/common/ui-bits";
import { useClaims } from "@/lib/user-data";
import { useCurrentUser } from "@/lib/auth";
import { usd, dateTime, shortDate } from "@/lib/format";
import { uploadPrivate, validateFile } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/_shell/work")({
  head: () => ({ meta: [{ title: "My Work — HANDSHAKE" }, { name: "description", content: "Your claimed assignments and submissions." }] }),
  component: WorkPage,
});

type Claim = NonNullable<ReturnType<typeof useClaims>["data"]>[number];

function WorkPage() {
  const { data: claims, isLoading } = useClaims();
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

  const groups = {
    active: claims?.filter((c) => ["claimed", "in_progress", "revision_requested"].includes(c.status)) ?? [],
    review: claims?.filter((c) => ["submitted", "under_review", "disputed"].includes(c.status)) ?? [],
    done: claims?.filter((c) => ["credited", "approved", "rejected", "abandoned", "expired"].includes(c.status)) ?? [],
  };

  const list = (items: Claim[]) =>
    items.length === 0 ? (
      <EmptyState icon={<ClipboardList />} title="Nothing here" action={<Button asChild variant="outline"><Link to="/assignments">Browse assignments</Link></Button>} />
    ) : (
      <div className="space-y-3">
        {items.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to="/assignments/$assignmentId" params={{ assignmentId: c.assignment_id }} className="font-semibold hover:underline">{c.assignment?.title}</Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{usd(c.assignment?.pay_usd)} · claimed {shortDate(c.claimed_at)} · due {dateTime(c.due_at)}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <ClaimHistory claimId={c.id} />
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status === "claimed" && <Button size="sm" variant="outline" onClick={() => act.mutate({ fn: "start_claim", id: c.id })}>Start work</Button>}
              {["claimed", "in_progress", "revision_requested"].includes(c.status) && (
                <>
                  <Button size="sm" onClick={() => setSubmitFor(c)}>{c.status === "revision_requested" ? "Submit revision" : "Submit work"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => confirm("Release this slot? You won't be able to claim it again.") && act.mutate({ fn: "abandon_claim", id: c.id })}>Release slot</Button>
                </>
              )}
              {c.status === "rejected" && <Button size="sm" variant="outline" onClick={() => setDisputeFor(c)}>Open dispute</Button>}
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div>
      <PageHeader title="My Work" description="Assignments you've claimed, submitted and completed." />
      {isLoading ? <Loading /> : (
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">Active ({groups.active.length})</TabsTrigger>
            <TabsTrigger value="review">In review ({groups.review.length})</TabsTrigger>
            <TabsTrigger value="done">Completed ({groups.done.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active">{list(groups.active)}</TabsContent>
          <TabsContent value="review">{list(groups.review)}</TabsContent>
          <TabsContent value="done">{list(groups.done)}</TabsContent>
        </Tabs>
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
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      let path: string | null = null;
      if (file) {
        const err = validateFile(file, ["document", "image", "archive"]);
        if (err) throw new Error(err);
        path = await uploadPrivate(user!.id, "submissions", file);
      }
      const { error } = await supabase.rpc("submit_assignment", { _claim: claim.id, _content: content.trim(), _file_path: path ?? undefined });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submitted for review");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit: {claim.assignment?.title}</DialogTitle>
          <DialogDescription>Due {dateTime(claim.due_at)}. Late submissions are not accepted.</DialogDescription>
        </DialogHeader>
        <Textarea rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Describe your deliverable or paste your work / links here" maxLength={20000} />
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <Paperclip className="h-4 w-4" /> {file ? file.name : "Attach a file (PDF, DOCX, TXT, image or ZIP, max 10 MB)"}
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={!content.trim() || m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Submit</Button>
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
      toast.success("Dispute opened. An assignment manager will review it.");
      qc.invalidateQueries({ queryKey: ["claims"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dispute rejection</DialogTitle><DialogDescription>Explain why your submission meets the assignment requirements.</DialogDescription></DialogHeader>
        <Textarea rows={5} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={3000} />
        <DialogFooter><Button onClick={() => m.mutate()} disabled={reason.trim().length < 10 || m.isPending}>Open dispute</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
