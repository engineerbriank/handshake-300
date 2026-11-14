import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatusBadge, Panel } from "@/components/common/ui-bits";
import { AdminTabs, AdminTable, Td, Notice } from "@/components/admin/AdminBits";
import { AssignmentForm } from "@/components/admin/AssignmentForm";
import { tabSearch } from "@/components/admin/admin-nav";
import { usd, dateTime, shortDate, errorMessage } from "@/lib/format";
import { openPrivate } from "@/lib/upload";
import { useRoles, hasAny } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/assignments")({
  validateSearch: tabSearch,
  component: AdminAssignments,
});

function AdminAssignments() {
  const { tab = "all" } = Route.useSearch();
  const qc = useQueryClient();
  return (
    <div>
      <PageHeader title="Assignments" description="Lifecycle: Draft → Funded → Published → Claimed → Submitted → Reviewed → Earnings credited." />
      <AdminTabs section="/admin/assignments" tab={tab} />
      {tab === "all" && <AllAssignments />}
      {tab === "create" && <Panel title="Create assignment"><AssignmentForm onCreated={() => qc.invalidateQueries({ queryKey: ["admin-assignments"] })} /></Panel>}
      {tab === "budgets" && <Budgets />}
      {tab === "reviews" && <Reviews statuses={["submitted", "under_review"]} />}
      {tab === "disputes" && <Disputes />}
    </div>
  );
}

function AllAssignments() {
  const qc = useQueryClient();
  const { data: roles } = useRoles();
  const q = useQuery({
    queryKey: ["admin-assignments"],
    queryFn: async () => (await supabase.from("assignments").select("*, employer:employer_profiles(company_name)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const pool = useQuery({ queryKey: ["admin-recon"], enabled: hasAny(roles, ["finance_admin"]), queryFn: async () => (await supabase.rpc("admin_reconciliation")).data as Record<string, number> | null });
  const act = useMutation({
    mutationFn: async ({ fn, id }: { fn: "fund" | "publish" | "close"; id: string }) => {
      const r =
        fn === "fund" ? await supabase.rpc("admin_fund_assignment", { _assignment: id, _idempotency_key: crypto.randomUUID() })
        : fn === "publish" ? await supabase.rpc("admin_publish_assignment", { _assignment: id })
        : await supabase.rpc("admin_close_assignment", { _assignment: id });
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["admin-assignments"] }); qc.invalidateQueries({ queryKey: ["admin-recon"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3">
      {pool.data && <Notice>Unallocated funding available to reserve: <b>{usd(pool.data.funding_pool)}</b>. Record confirmed deposits under Finance → Deposits.</Notice>}
      <AdminTable head={["Assignment", "Client", "Pay × slots", "Claimed", "Deadline", "Status", "Actions"]} empty={!q.data?.length}>
        {q.data?.map((a) => (
          <tr key={a.id}>
            <Td className="max-w-xs"><Link to="/assignments/$assignmentId" params={{ assignmentId: a.id }} className="font-medium hover:underline">{a.title}</Link></Td>
            <Td>{a.employer?.company_name ?? "HANDSHAKE"}</Td>
            <Td className="tabular whitespace-nowrap">{usd(a.pay_usd)} × {a.slots}<span className="block text-xs text-muted-foreground">= {usd(Number(a.pay_usd) * a.slots)}</span></Td>
            <Td>{a.slots_claimed}/{a.slots}</Td>
            <Td className="whitespace-nowrap">{dateTime(a.deadline)}</Td>
            <Td><StatusBadge status={a.status} /></Td>
            <Td className="whitespace-nowrap">
              {a.status === "draft" && hasAny(roles, ["finance_admin"]) && <Button size="sm" onClick={() => confirm(`Reserve ${usd(Number(a.pay_usd) * a.slots)} from unallocated funds?`) && act.mutate({ fn: "fund", id: a.id })}>Fund</Button>}
              {a.status === "funded" && hasAny(roles, ["assignment_manager"]) && <Button size="sm" variant="success" onClick={() => act.mutate({ fn: "publish", id: a.id })}>Publish</Button>}
              {["funded", "published"].includes(a.status) && <Button size="sm" variant="outline" className="ml-1" onClick={() => confirm("Close this assignment and return unused budget?") && act.mutate({ fn: "close", id: a.id })}>Close</Button>}
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

function Budgets() {
  const q = useQuery({ queryKey: ["admin-budgets"], queryFn: async () => (await supabase.from("assignment_budgets").select("*, assignment:assignments(title,status)").order("funded_at", { ascending: false })).data ?? [] });
  return (
    <AdminTable head={["Assignment", "Funded", "Total", "Released", "Refunded", "Remaining in escrow", "Status"]} empty={!q.data?.length}>
      {q.data?.map((b) => (
        <tr key={b.id}>
          <Td className="font-medium">{b.assignment?.title}</Td><Td>{shortDate(b.funded_at)}</Td>
          <Td className="tabular">{usd(b.total_usd)}</Td><Td className="tabular">{usd(b.released_usd)}</Td><Td className="tabular">{usd(b.refunded_usd)}</Td>
          <Td className="tabular font-semibold">{usd(Number(b.total_usd) - Number(b.released_usd) - Number(b.refunded_usd))}</Td>
          <Td><StatusBadge status={b.assignment?.status} /></Td>
        </tr>
      ))}
    </AdminTable>
  );
}

export function Reviews({ statuses, ownerOnly }: { statuses: ("submitted" | "under_review" | "disputed")[]; ownerOnly?: boolean }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["admin-reviews", statuses, ownerOnly],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_claims")
        .select("id,status,revisions_used,updated_at, assignment:assignments(title,pay_usd,max_revisions), profile:profiles(email,first_name,last_name), submissions:assignment_submissions(id,content,file_path,revision_number,submitted_at)")
        .in("status", statuses)
        .order("updated_at");
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
              <div><p className="font-semibold">{c.assignment?.title} · <span className="text-success">{usd(c.assignment?.pay_usd)}</span></p><p className="text-xs text-muted-foreground">{c.profile?.first_name} {c.profile?.last_name} ({c.profile?.email}) · revision {latest.revision_number} of {c.assignment?.max_revisions} · {dateTime(latest.submitted_at)}</p></div>
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

function Disputes() {
  const q = useQuery({ queryKey: ["admin-disputes"], queryFn: async () => (await supabase.from("assignment_disputes").select("*, profile:profiles(email)").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  return (
    <div className="space-y-6">
      <Notice>Resolve an open dispute by re-reviewing the submission below: approving credits the worker and upholds the dispute; rejecting dismisses it.</Notice>
      <Reviews statuses={["disputed"]} />
      <Panel title="Dispute history" bodyClassName="p-0">
        <AdminTable head={["Opened", "Worker", "Reason", "Status", "Resolution"]} empty={!q.data?.length}>
          {q.data?.map((d) => <tr key={d.id}><Td>{dateTime(d.created_at)}</Td><Td>{d.profile?.email}</Td><Td className="max-w-sm">{d.reason}</Td><Td><StatusBadge status={d.status} /></Td><Td className="text-xs">{d.resolution ?? "—"}</Td></tr>)}
        </AdminTable>
      </Panel>
    </div>
  );
}
