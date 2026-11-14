import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Wallet, ArrowUpRight, LifeBuoy, ArrowRight, Clock, CheckCircle2, ClipboardList, ShieldAlert, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, StatCard, StatusBadge, EmptyState } from "@/components/common/ui-bits";
import { JobCard } from "@/components/jobs/JobCard";
import { useProfile } from "@/lib/auth";
import { useWallet, useTransactions, useClaims, useApplications, useNotifications, TXN_LABEL } from "@/lib/user-data";
import { usd, shortDate, ago, humanize } from "@/lib/format";
import { listJobs } from "@/lib/jobs.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSavedJobs } from "@/lib/use-saved-jobs";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useOpenTasks, useTaskProfile } from "@/lib/task-data";
import { recommendTasks } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Handshake" }, { name: "description", content: "Your Handshake balance, work and opportunities." }] }),
  component: Dashboard,
});

const QUICK = [
  { label: "Jobs", to: "/jobs", icon: Briefcase },
  { label: "Tasks", to: "/assignments", icon: ClipboardList },
  { label: "Wallet", to: "/wallet", icon: Wallet },
  { label: "Support", to: "/report", icon: LifeBuoy },
] as const;

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: wallet } = useWallet();
  const { data: txns } = useTransactions(5);
  const { data: claims } = useClaims();
  const { data: apps } = useApplications();
  const { data: notes } = useNotifications(5);
  const { saved, toggle } = useSavedJobs();
  const topJobs = useQuery({ queryKey: ["dash-top-jobs"], queryFn: () => listJobs({ data: { page: 1, pageSize: 4, worldwide: true } }), staleTime: 300_000 });
  const openAssignments = useQuery({
    queryKey: ["open-assignments-count"],
    queryFn: async () => (await supabase.from("assignments").select("id", { count: "exact", head: true }).eq("status", "published").gt("deadline", new Date().toISOString())).count ?? 0,
  });

  const active = claims?.filter((c) => ["claimed", "in_progress", "revision_requested"].includes(c.status)).length ?? 0;
  const pending = claims?.filter((c) => ["submitted", "under_review", "disputed"].includes(c.status)).length ?? 0;
  const done = claims?.filter((c) => c.status === "credited").length ?? 0;
  const openTasks = useOpenTasks();
  const taskProfile = useTaskProfile();
  const mineIds = new Set(claims?.map((c) => c.assignment_id));
  const recTasks = taskProfile.data ? recommendTasks((openTasks.data ?? []).filter((t) => !mineIds.has(t.id)), taskProfile.data).slice(0, 3) : [];
  const needsVerification = profile && !["verified", "active"].includes(profile.account_status);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-bold leading-tight">Hello, {profile?.first_name || "there"}! 👋</h1>
        <p className="mt-1 text-base text-muted-foreground">Welcome to Handshake</p>
      </div>

      {needsVerification && (
        <Link to="/verification" className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
          <span className="flex-1"><b>Finish verification.</b> Your account is {humanize(profile.account_status).toLowerCase()}. Complete the remaining steps to accept paid tasks and withdraw.</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-card">
        <div>
          <p className="text-sm text-primary-foreground/80">Your Balance</p>
          <p className="tabular mt-1 text-[26px] font-semibold">{usd(wallet?.available_usd)} <span className="text-sm font-semibold text-primary-foreground/60">USD</span></p>
        </div>
        <Button asChild variant="outline" className="shrink-0 rounded-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/withdrawals">Withdraw</Link></Button>
      </div>

      <div className="grid grid-cols-4 gap-1 sm:gap-3">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className="flex min-w-0 flex-col items-center gap-2 py-1 text-center text-sm font-medium">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-card shadow-card"><q.icon className="h-6 w-6" /></span>
            <span className="w-full truncate">{q.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/jobs" className="group rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/30">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><Briefcase className="h-5 w-5" /></span>
          <h2 className="mt-3 text-lg font-bold">Find a Job</h2>
          <p className="mt-1 text-sm text-muted-foreground">Discover international remote employment and apply directly to employers.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">Explore jobs <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
        <Link to="/assignments" className="group rounded-2xl border-2 border-brand/40 bg-card p-4 transition-colors hover:border-brand">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-foreground"><ClipboardList className="h-5 w-5" /></span>
          <h2 className="mt-3 text-lg font-bold">Earn Through Tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">Complete short funded tasks, submit your work and get paid in USD after approval.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">{openTasks.data ? `${openTasks.data.length} open ${openTasks.data.length === 1 ? "task" : "tasks"}` : "See paid tasks"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
      </div>

      {recTasks.length > 0 && (
        <Panel title="Paid tasks for you" action={<Link to="/assignments" className="flex items-center gap-1 text-sm font-semibold">View all <ArrowRight className="h-4 w-4" /></Link>} bodyClassName="grid gap-3 p-0 md:grid-cols-3">
          {recTasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending" value={usd(wallet?.pending_usd)} hint="Under review" icon={<Clock />} tone="warning" />
        <StatCard label="Reserved" value={usd(wallet?.reserved_usd)} hint="Awaiting payout" icon={<ArrowUpRight />} tone="info" />
        <StatCard label="Total earned" value={usd(wallet?.total_earned_usd)} icon={<CheckCircle2 />} tone="success" />
        <StatCard label="Total withdrawn" value={usd(wallet?.total_withdrawn_usd)} icon={<Wallet />} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Available jobs" value={topJobs.data?.total?.toLocaleString() ?? "—"} hint="Live listings" />
        <StatCard label="Open assignments" value={openAssignments.data ?? "—"} />
        <StatCard label="Active / pending" value={`${active} / ${pending}`} hint="Your claims" />
        <StatCard label="Completed" value={done} hint="Paid assignments" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Recent transactions" action={<Link to="/transactions" className="text-sm font-semibold">View all</Link>} bodyClassName="p-0">
            {txns?.length ? (
              <ul className="divide-y">
                {txns.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span><span className="block font-medium">{TXN_LABEL[t.kind] ?? t.description}</span><span className="text-xs text-muted-foreground">{shortDate(t.created_at)}</span></span>
                    <span className={`tabular font-semibold ${t.amount >= 0 ? "text-success" : ""}`}>{t.amount >= 0 ? "+" : "−"}{usd(Math.abs(t.amount))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No transactions yet. Earnings appear here when an assignment is approved.</p>
            )}
          </Panel>

          <Panel title="Recent applications" action={<Link to="/applications" className="text-sm font-semibold">View all</Link>} bodyClassName="p-0">
            {apps?.length ? (
              <ul className="divide-y">
                {apps.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium">{a.job?.title}</span><span className="text-xs text-muted-foreground">{a.job?.employer} · {shortDate(a.applied_at)}</span></span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">Track jobs you apply to from any job page.</p>
            )}
          </Panel>

          <Panel title="Notifications" action={<Link to="/notifications" className="text-sm font-semibold">View all</Link>} bodyClassName="p-0">
            {notes?.length ? (
              <ul className="divide-y">
                {notes.map((n) => (
                  <li key={n.id} className="flex gap-3 py-3 text-sm">
                    <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.read_at ? "text-muted-foreground" : "text-info"}`} />
                    <span className="min-w-0"><span className="block font-medium">{n.title}</span><span className="line-clamp-1 text-xs text-muted-foreground">{n.body} · {ago(n.created_at)}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">You're all caught up.</p>
            )}
          </Panel>

          <Panel title="My work" action={<Link to="/work" className="text-sm font-semibold">Open</Link>} bodyClassName="p-0">
            {claims?.length ? (
              <ul className="divide-y">
                {claims.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium">{c.assignment?.title}</span><span className="text-xs text-muted-foreground">{usd(c.assignment?.pay_usd)} · due {shortDate(c.due_at)}</span></span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground"><ClipboardList className="h-4 w-4" /> No assignments claimed yet.</div>
            )}
          </Panel>
      </div>

      <Panel title="Top Jobs" action={<Link to="/jobs" className="flex items-center gap-1 text-sm font-semibold">View all <ArrowRight className="h-4 w-4" /></Link>} bodyClassName="grid gap-3 p-0 md:grid-cols-2">
          {topJobs.data?.jobs.map((j) => <JobCard key={j.id} job={j} saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)} />)}
          {topJobs.data?.jobs.length === 0 && <EmptyState title="No listings right now" />}
        </Panel>
    </div>
  );
}
