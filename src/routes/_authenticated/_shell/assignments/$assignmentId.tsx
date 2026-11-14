import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Loader2, CheckCircle2, XCircle, Clock, Users, CalendarClock, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading, ErrorNote, Panel } from "@/components/common/ui-bits";
import { usd, dateTime, humanize, errorMessage } from "@/lib/format";
import { useCurrentUser, useProfile } from "@/lib/auth";
import { useClaims } from "@/lib/user-data";
import { difficultyLabel, hourlyEquivalent, SUBMISSION_LABEL, taskState, TASK_STATE_LABEL } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/_shell/assignments/$assignmentId")({
  head: () => ({ meta: [
    { title: "Task details — Handshake" },
    { name: "description", content: "Pay, instructions and requirements for a funded Handshake task." },
    { property: "og:title", content: "Task details — Handshake" },
    { property: "og:description", content: "Pay, instructions and requirements for a funded task." },
  ] }),
  component: TaskDetail,
});

const ACTIVE = ["claimed", "in_progress", "revision_requested"];

function TaskDetail() {
  const { assignmentId } = Route.useParams();
  const { user } = useCurrentUser();
  const { data: profile } = useProfile();
  const { data: claims } = useClaims();
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
  const limit = useQuery({ queryKey: ["setting", "max_active_task_claims"], queryFn: async () => Number((await supabase.from("system_settings").select("value").eq("key", "max_active_task_claims").maybeSingle()).data?.value ?? 5) });
  const doClaim = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("claim_assignment", { _assignment: assignmentId }); if (error) throw error; },
    onSuccess: () => { toast.success("Task accepted. Your slot is reserved — find it in My Tasks."); qc.invalidateQueries(); navigate({ to: "/work" }); },
    onError: (e) => { toast.error(errorMessage(e)); qc.invalidateQueries({ queryKey: ["assignment", assignmentId] }); },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const a = q.data;
  if (!a) return <p className="py-12 text-center text-muted-foreground">This task is not available.</p>;
  const budget = Array.isArray(a.budget) ? a.budget[0] : a.budget;
  const left = a.slots - a.slots_claimed;
  const state = taskState(a);
  const mine = claims?.find((c) => c.assignment_id === a.id);
  const activeCount = claims?.filter((c) => ACTIVE.includes(c.status)).length ?? 0;
  const countryOk = !a.eligible_countries.length || (!!profile?.country && a.eligible_countries.includes(profile.country));
  const verified = profile?.account_status === "verified" || profile?.account_status === "active";
  const checks = [
    { ok: verified, label: verified ? "Your account is verified" : "Complete email and profile verification first", to: "/verification" as const },
    { ok: countryOk, label: countryOk ? "Available in your country" : `Only available in ${a.eligible_countries.join(", ")}` },
    { ok: left > 0, label: left > 0 ? `${left} funded ${left === 1 ? "slot" : "slots"} left` : "All funded slots are taken" },
    { ok: activeCount < (limit.data ?? 5), label: activeCount < (limit.data ?? 5) ? `You have ${activeCount} of ${limit.data ?? 5} active tasks` : `Finish a current task first (limit ${limit.data ?? 5})` },
  ];
  const canClaim = !mine && state === "published" && checks.every((c) => c.ok) && !!user;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-4">
      <Link to="/assignments" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Paid Tasks</Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">{humanize(a.category)}</Badge>
          <Badge variant={state === "published" ? "success" : "outline"}>{TASK_STATE_LABEL[state]}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{a.title}</h1>
        <p className="tabular mt-3 text-3xl font-extrabold text-success">{usd(a.pay_usd)} <span className="text-base font-semibold text-muted-foreground">USD fixed pay</span></p>
        <p className="mt-1 text-sm text-muted-foreground">Paid once, after your submission is approved. About {usd(hourlyEquivalent(Number(a.pay_usd), a.estimated_minutes))}/hour if it takes the estimated {a.estimated_minutes} minutes — not an hourly wage.</p>
        {budget && <p className="mt-3 flex items-center gap-1.5 text-sm"><ShieldCheck className="h-4 w-4 shrink-0 text-success" /> {usd(budget.total_usd)} reserved by {a.sponsor_name} for {a.slots} {a.slots === 1 ? "slot" : "slots"}.</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: Clock, label: "Time", value: `~${a.estimated_minutes} min` },
          { icon: Gauge, label: "Difficulty", value: difficultyLabel(a.difficulty) },
          { icon: Users, label: "Slots left", value: `${left} of ${a.slots}` },
          { icon: CalendarClock, label: "Deadline", value: dateTime(a.deadline) },
        ].map((x) => (
          <div key={x.label} className="rounded-xl border bg-card p-3">
            <x.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-1.5 text-xs text-muted-foreground">{x.label}</p>
            <p className="text-sm font-semibold">{x.value}</p>
          </div>
        ))}
      </div>

      <Panel title="About this task"><p className="whitespace-pre-line text-sm leading-relaxed">{a.description}</p>
        {a.required_skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{a.required_skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>}
      </Panel>
      <Panel title="Instructions"><p className="whitespace-pre-line text-sm leading-relaxed">{a.instructions}</p></Panel>
      <Panel title="What to submit">
        <p className="whitespace-pre-line text-sm leading-relaxed">{a.deliverables}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{a.submission_types.map((t) => <Badge key={t} variant="muted">{SUBMISSION_LABEL[t] ?? humanize(t)}</Badge>)}</div>
      </Panel>
      {a.verification_checklist.length > 0 && (
        <Panel title="How your work is checked">
          <ul className="space-y-2 text-sm">{a.verification_checklist.map((c) => <li key={c} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {c}</li>)}</ul>
          <p className="mt-3 text-xs text-muted-foreground">A Handshake reviewer checks every submission, usually within {a.review_days} days. You can revise up to {a.max_revisions} {a.max_revisions === 1 ? "time" : "times"} if asked. Rejections always include a reason and can be disputed.</p>
        </Panel>
      )}
      <Panel title="How you get paid">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Accept the task — your slot and its {usd(a.pay_usd)} are held for you until the deadline.</li>
          <li>Submit your work before {dateTime(a.deadline)}. The amount shows as pending in your wallet.</li>
          <li>Once approved, {usd(a.pay_usd)} moves to your available USD balance{Number(a.pay_usd) > 0 && " (minus any platform fee shown in Fees & Limits; currently none)"}.</li>
          <li>Withdraw under the usual wallet rules (minimum $5, weekly payout run).</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Handshake will never ask for your passwords, one-time codes or banking logins to complete a task.</p>
      </Panel>

      {!mine && (
        <Panel title="Can you take this task?">
          <ul className="space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                {c.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                {c.to && !c.ok ? <Link to={c.to} className="underline">{c.label}</Link> : c.label}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="sticky bottom-20 rounded-2xl border bg-background/95 p-3 shadow-raised backdrop-blur lg:bottom-4">
        {mine ? (
          <Button asChild size="lg" className="h-12 w-full text-base"><Link to="/work">You accepted this — open My Tasks</Link></Button>
        ) : (
          <Button size="lg" variant="brand" className="h-12 w-full text-base" disabled={!canClaim || doClaim.isPending} onClick={() => doClaim.mutate()}>
            {doClaim.isPending && <Loader2 className="animate-spin" />}
            {state === "expired" ? "Deadline passed" : state === "full" ? "All slots claimed" : state !== "published" ? TASK_STATE_LABEL[state] : `Accept task · ${usd(a.pay_usd)}`}
          </Button>
        )}
      </div>
    </div>
  );
}
