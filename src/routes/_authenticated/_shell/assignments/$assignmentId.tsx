import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyValue, Loading, ErrorNote, Panel, StatusBadge } from "@/components/common/ui-bits";
import { usd, dateTime, humanize } from "@/lib/format";
import { useCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/_shell/assignments/$assignmentId")({
  head: () => ({ meta: [{ title: "Assignment — HANDSHAKE" }, { name: "description", content: "Assignment details and instructions." }] }),
  component: AssignmentDetail,
});

function AssignmentDetail() {
  const { assignmentId } = Route.useParams();
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments").select("*, budget:assignment_budgets(total_usd,released_usd,refunded_usd)").eq("id", assignmentId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const claim = useQuery({
    queryKey: ["my-claim", assignmentId, user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("assignment_claims").select("id,status").eq("assignment_id", assignmentId).eq("user_id", user!.id).maybeSingle()).data,
  });
  const doClaim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("claim_assignment", { _assignment: assignmentId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment claimed. Find it in My Work.");
      qc.invalidateQueries();
      navigate({ to: "/work" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const a = q.data;
  if (!a) return <p className="py-12 text-center text-muted-foreground">This assignment is not available.</p>;
  const budget = Array.isArray(a.budget) ? a.budget[0] : a.budget;
  const left = a.slots - a.slots_claimed;
  const expired = new Date(a.deadline) <= new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/assignments" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Assignments</Link>
      <div className="rounded-3xl border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{a.title}</h1>
          <StatusBadge status={a.status} />
        </div>
        <p className="tabular mt-3 text-3xl font-extrabold text-success">{usd(a.pay_usd)} <span className="text-base font-semibold text-muted-foreground">USD per approved submission</span></p>
        {budget && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" /> Budget of {usd(budget.total_usd)} reserved in escrow.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge variant="muted">{humanize(a.category)}</Badge>
          {a.required_skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
        </div>
        <p className="mt-5 whitespace-pre-line text-[0.95rem] leading-relaxed">{a.description}</p>
      </div>

      <KeyValue
        items={[
          { label: "Slots remaining", value: `${left} of ${a.slots}` },
          { label: "Deadline", value: dateTime(a.deadline) },
          { label: "Estimated time", value: `${a.estimated_minutes} minutes` },
          { label: "Revisions allowed", value: a.max_revisions },
          { label: "Eligible countries", value: a.eligible_countries.length ? a.eligible_countries.join(", ") : "All countries" },
        ]}
      />

      <Panel title="Instructions"><p className="whitespace-pre-line text-sm leading-relaxed">{a.instructions}</p></Panel>
      <Panel title="Required deliverables"><p className="whitespace-pre-line text-sm leading-relaxed">{a.deliverables}</p></Panel>
      {(a.review_requirements || a.revision_policy || a.eligibility) && (
        <Panel title="Review and eligibility">
          <div className="space-y-3 text-sm">
            {a.review_requirements && <p><b>Review:</b> {a.review_requirements}</p>}
            {a.revision_policy && <p><b>Revisions:</b> {a.revision_policy}</p>}
            {a.eligibility && <p><b>Eligibility:</b> {a.eligibility}</p>}
          </div>
        </Panel>
      )}

      <div className="sticky bottom-20 rounded-2xl border bg-background/95 p-3 shadow-raised backdrop-blur lg:bottom-4">
        {claim.data ? (
          <Button asChild size="lg" className="w-full"><Link to="/work">You claimed this — open My Work</Link></Button>
        ) : (
          <Button size="lg" className="w-full" disabled={left <= 0 || expired || a.status !== "published" || doClaim.isPending} onClick={() => doClaim.mutate()}>
            {doClaim.isPending && <Loader2 className="animate-spin" />}
            {expired ? "Deadline passed" : left <= 0 ? "All slots claimed" : "Claim this assignment"}
          </Button>
        )}
      </div>
    </div>
  );
}
