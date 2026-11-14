import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/common/ui-bits";
import { AdminTabs, AdminTable, Td } from "@/components/admin/AdminBits";
import { tabSearch } from "@/components/admin/admin-nav";
import { usd, ago } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: tabSearch,
  component: AdminOverview,
});

type CountQ = { count: number | null; error: unknown };
async function c(q: PromiseLike<CountQ>) {
  const r = await q;
  return r.error ? null : (r.count ?? 0);
}
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString());

function AdminOverview() {
  const { tab = "dashboard" } = Route.useSearch();
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const head = { count: "exact" as const, head: true };
      const [users, verified, suspended, jobs, expiredJobs, apps, assignmentsLive, assignmentsDraft, pendingReviews, disputes, withdrawalsQueued, batches, tickets, onHold] = await Promise.all([
        c(supabase.from("profiles").select("id", head)),
        c(supabase.from("profiles").select("id", head).in("account_status", ["verified", "active"])),
        c(supabase.from("profiles").select("id", head).in("account_status", ["suspended", "restricted"])),
        c(supabase.from("jobs").select("id", head).eq("status", "active")),
        c(supabase.from("jobs").select("id", head).eq("status", "expired")),
        c(supabase.from("job_applications").select("id", head)),
        c(supabase.from("assignments").select("id", head).eq("status", "published")),
        c(supabase.from("assignments").select("id", head).in("status", ["draft", "funded"])),
        c(supabase.from("assignment_claims").select("id", head).in("status", ["submitted", "under_review"])),
        c(supabase.from("assignment_disputes").select("id", head).eq("status", "open")),
        c(supabase.from("withdrawal_requests").select("id", head).in("status", ["reserved", "batched", "submitted"])),
        c(supabase.from("payout_batches").select("id", head)),
        c(supabase.from("support_tickets").select("id", head).in("status", ["open", "in_progress"])),
        c(supabase.from("withdrawal_requests").select("id", head).eq("status", "on_hold")),
      ]);
      const recon = await supabase.rpc("admin_reconciliation");
      return { users, verified, suspended, jobs, expiredJobs, apps, assignmentsLive, assignmentsDraft, pendingReviews, disputes, withdrawalsQueued, batches, tickets, onHold, recon: recon.error ? null : (recon.data as Record<string, number>) };
    },
  });
  const sources = useQuery({ queryKey: ["admin-sources"], queryFn: async () => (await supabase.from("job_sources").select("*").order("name")).data ?? [] });
  const providers = useQuery({ queryKey: ["admin-providers"], queryFn: async () => (await supabase.from("payment_providers").select("*").order("name")).data ?? [] });
  const signups = useQuery({
    queryKey: ["admin-signups"],
    enabled: tab === "analytics",
    queryFn: async () => {
      const since = subDays(new Date(), 29);
      const { data } = await supabase.from("profiles").select("created_at").gte("created_at", since.toISOString());
      const days = Array.from({ length: 30 }, (_, i) => ({ d: format(subDays(new Date(), 29 - i), "MMM d"), users: 0 }));
      for (const r of data ?? []) {
        const label = format(new Date(r.created_at), "MMM d");
        const b = days.find((x) => x.d === label);
        if (b) b.users++;
      }
      return days;
    },
  });
  const jobsByCat = useQuery({
    queryKey: ["admin-jobs-cat"],
    enabled: tab === "analytics",
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("category").eq("status", "active").limit(5000);
      const m = new Map<string, number>();
      for (const r of data ?? []) m.set(r.category, (m.get(r.category) ?? 0) + 1);
      return [...m.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
    },
  });
  const s = stats.data;
  const balanced = s?.recon ? Number(s.recon.total_debits) === Number(s.recon.total_credits) && Number(s.recon.wallet_mismatches) === 0 : null;

  return (
    <div>
      <PageHeader title="Admin Overview" description="Live platform figures. Values show — when your role cannot view that area." />
      <AdminTabs section="/admin" tab={tab} />
      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <StatCard label="Users" value={n(s?.users)} />
            <StatCard label="Verified users" value={n(s?.verified)} tone="success" />
            <StatCard label="Suspended" value={n(s?.suspended)} tone="warning" />
            <StatCard label="Active jobs" value={n(s?.jobs)} hint={`${n(s?.expiredJobs)} expired`} />
            <StatCard label="Applications tracked" value={n(s?.apps)} />
            <StatCard label="Live assignments" value={n(s?.assignmentsLive)} hint={`${n(s?.assignmentsDraft)} draft/funded`} />
            <StatCard label="Pending reviews" value={n(s?.pendingReviews)} tone="warning" />
            <StatCard label="Open disputes" value={n(s?.disputes)} tone="warning" />
            <StatCard label="Withdrawals in queue" value={n(s?.withdrawalsQueued)} hint={`${n(s?.onHold)} on hold`} tone="info" />
            <StatCard label="Payout batches" value={n(s?.batches)} />
            <StatCard label="Open tickets" value={n(s?.tickets)} />
            <StatCard label="Platform revenue" value={s?.recon ? usd(s.recon.platform_revenue) : "—"} tone="success" />
          </div>
          {s?.recon && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Treasury" value={usd(s.recon.treasury)} />
              <StatCard label="Unallocated funding" value={usd(s.recon.funding_pool)} />
              <StatCard label="Assignment escrow" value={usd(s.recon.assignment_escrow)} />
              <StatCard label="User balances" value={usd(Number(s.recon.user_available_total) + Number(s.recon.user_reserved_total))} />
            </div>
          )}
          <Panel title="Job synchronisation" action={<Link to="/admin/jobs" search={{ tab: "sources" }} className="text-sm font-semibold">Manage</Link>} bodyClassName="p-0">
            <SourcesTable rows={sources.data ?? []} />
          </Panel>
        </div>
      )}
      {tab === "analytics" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Sign-ups (last 30 days)">
            <div className="h-64"><ResponsiveContainer><BarChart data={signups.data ?? []}><CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="d" tick={{ fontSize: 10 }} minTickGap={16} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="users" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Active jobs by category">
            <div className="h-64"><ResponsiveContainer><BarChart data={jobsByCat.data ?? []} layout="vertical" margin={{ left: 40 }}><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={110} /><Tooltip /><Bar dataKey="count" fill="var(--color-chart-3)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
          </Panel>
        </div>
      )}
      {tab === "health" && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Ledger" value={balanced === null ? "—" : balanced ? "Balanced" : "Mismatch"} tone={balanced === false ? "warning" : "success"} hint={s?.recon ? `Checked ${ago(String(s.recon.checked_at))}` : "Finance role required"} />
            <StatCard label="Unconfirmed payouts" value={s?.recon ? n(Number(s.recon.unconfirmed_payouts)) : "—"} />
            <StatCard label="Job sources with errors" value={n(sources.data?.filter((x) => x.last_status === "error").length)} />
          </div>
          <Panel title="Job sources" bodyClassName="p-0"><SourcesTable rows={sources.data ?? []} /></Panel>
          <Panel title="Payment providers" bodyClassName="p-0">
            <AdminTable head={["Provider", "Currency", "Enabled", "Connection", "Last check", "Notes"]} empty={!providers.data?.length}>
              {providers.data?.map((p) => (
                <tr key={p.id}><Td className="font-medium">{p.name}</Td><Td>{p.currency}</Td><Td>{p.enabled ? "Yes" : "No"}</Td><Td><StatusBadge status={p.connection_status} /></Td><Td>{p.last_checked_at ? ago(p.last_checked_at) : "Never"}</Td><Td className="text-xs text-muted-foreground">{p.last_error ?? p.notes}</Td></tr>
              ))}
            </AdminTable>
          </Panel>
        </div>
      )}
    </div>
  );
}

export function SourcesTable({ rows }: { rows: { id: string; name: string; enabled: boolean; last_status: string; last_sync_at: string | null; active_jobs: number; last_error: string | null; requires_credentials: boolean }[] }) {
  return (
    <AdminTable head={["Source", "Status", "Active jobs", "Last sync", "Detail"]} empty={!rows.length}>
      {rows.map((r) => (
        <tr key={r.id}>
          <Td className="font-medium">{r.name}{!r.enabled && <span className="ml-1 text-xs text-muted-foreground">(disabled)</span>}</Td>
          <Td><StatusBadge status={r.last_status} /></Td>
          <Td className="tabular">{r.active_jobs}</Td>
          <Td>{r.last_sync_at ? ago(r.last_sync_at) : "Never"}</Td>
          <Td className="max-w-sm text-xs text-muted-foreground">{r.last_error ?? (r.requires_credentials ? "Requires API credentials" : "Public feed")}</Td>
        </tr>
      ))}
    </AdminTable>
  );
}
