import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TaskOverview, Catalogue, PublishFromTemplate, Funding, Payments, AppDirectory, PayRates } from "@/components/admin/TaskAdmin";
import { taskState, TASK_STATE_LABEL, coveredSlots } from "@/lib/tasks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, Panel } from "@/components/common/ui-bits";
import { AdminTabs, AdminTable, Td, Notice } from "@/components/admin/AdminBits";
import { AssignmentForm } from "@/components/admin/AssignmentForm";
import { ReviewQueue as Reviews } from "@/components/admin/ReviewQueue";
import { tabSearch } from "@/components/admin/admin-nav";
import { usd, dateTime, shortDate, errorMessage } from "@/lib/format";
import { useRoles, hasAny } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/assignments")({
  validateSearch: tabSearch,
  component: AdminAssignments,
});

function AdminAssignments() {
  const { tab = "overview" } = Route.useSearch();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<Parameters<typeof PublishFromTemplate>[0]["initial"]>(null);
  const created = () => { qc.invalidateQueries({ queryKey: ["admin-assignments"] }); qc.invalidateQueries({ queryKey: ["admin-task-stats"] }); navigate({ to: "/admin/assignments", search: { tab: "all" } }); };
  return (
    <div>
      <PageHeader title="Paid Tasks" description="Template → Draft → Funded (budget reserved) → Published → Accepted → Submitted → Reviewed → Paid to wallet." />
      <AdminTabs section="/admin/assignments" tab={tab} />
      {tab === "overview" && <TaskOverview />}
      {tab === "all" && <AllAssignments />}
      {tab === "catalogue" && <Catalogue onUse={(t) => { setTemplate(t); navigate({ to: "/admin/assignments", search: { tab: "create" } }); }} />}
      {tab === "create" && <PublishFromTemplate key={template?.id ?? "none"} initial={template} onCreated={created} />}
      {tab === "custom" && <Panel title="Create a custom task"><AssignmentForm onCreated={created} /></Panel>}
      {tab === "funding" && <Funding />}
      {tab === "payments" && <Payments />}
      {tab === "apps" && <AppDirectory />}
      {tab === "rates" && <PayRates />}
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
    mutationFn: async ({ fn, id, fit }: { fn: "fund" | "publish" | "close" | "pause" | "resume"; id: string; fit?: boolean }) => {
      const r =
        fn === "fund" ? await supabase.rpc("admin_fund_task", { _assignment: id, _idempotency_key: crypto.randomUUID(), _fit_to_funds: !!fit })
        : fn === "publish" ? await supabase.rpc("admin_publish_assignment", { _assignment: id })
        : fn === "pause" || fn === "resume" ? await supabase.rpc("admin_set_task_paused", { _assignment: id, _paused: fn === "pause" })
        : await supabase.rpc("admin_close_assignment", { _assignment: id });
      if (r.error) throw r.error;
      return r.data as { slots?: number; requested_slots?: number } | number | null;
    },
    onSuccess: (d) => {
      if (d && typeof d === "object" && d.slots !== undefined && d.requested_slots !== d.slots) toast.success(`Funded ${d.slots} of ${d.requested_slots} slots — all that available funds fully cover.`);
      else if (typeof d === "number" && d > 0) toast.success(`Closed. ${usd(d)} of unused budget returned to unallocated funds.`);
      else toast.success("Done");
      qc.invalidateQueries({ queryKey: ["admin-assignments"] }); qc.invalidateQueries({ queryKey: ["admin-recon"] }); qc.invalidateQueries({ queryKey: ["admin-task-stats"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3">
      {pool.data && <Notice>Unallocated funding available to reserve: <b>{usd(pool.data.funding_pool)}</b>. Record confirmed deposits under Finance → Deposits.</Notice>}
      <AdminTable head={["Task", "Funded by", "Pay × slots", "Claimed", "Deadline", "State", "Actions"]} empty={!q.data?.length}>
        {q.data?.map((a) => (
          <tr key={a.id}>
            <Td className="max-w-xs"><Link to="/assignments/$assignmentId" params={{ assignmentId: a.id }} className="font-medium hover:underline">{a.title}</Link></Td>
            <Td>{a.sponsor_type === "client" ? a.employer?.company_name ?? a.sponsor_name : a.sponsor_name}<span className="block text-xs text-muted-foreground">{a.sponsor_type === "platform" ? "Platform" : a.sponsor_type === "client" ? "Client" : "Business sponsor"}</span></Td>
            <Td className="tabular whitespace-nowrap">{usd(a.pay_usd)} × {a.slots}<span className="block text-xs text-muted-foreground">= {usd(Number(a.pay_usd) * a.slots)}</span></Td>
            <Td>{a.slots_claimed}/{a.slots}</Td>
            <Td className="whitespace-nowrap">{dateTime(a.deadline)}</Td>
            <Td><Badge variant={taskState(a) === "published" ? "success" : "muted"}>{TASK_STATE_LABEL[taskState(a)]}</Badge>{a.publish_at && new Date(a.publish_at) > new Date() && <span className="block text-xs text-muted-foreground">opens {dateTime(a.publish_at)}</span>}</Td>
            <Td className="whitespace-nowrap">
              {a.status === "draft" && hasAny(roles, ["finance_admin"]) && <Button size="sm" onClick={() => {
                const need = Number(a.pay_usd) * a.slots; const pl = Number(pool.data?.funding_pool ?? 0);
                if (pl >= need) { if (confirm(`Reserve ${usd(need)} from unallocated funds?`)) act.mutate({ fn: "fund", id: a.id }); return; }
                const fit = coveredSlots(pl, Number(a.pay_usd));
                if (fit < 1) { toast.error(`Not enough unallocated funds (${usd(pl)}) for even one ${usd(a.pay_usd)} slot.`); return; }
                if (confirm(`Only ${usd(pl)} is unallocated — enough for ${fit} of ${a.slots} slots. Reduce this task to ${fit} slots and reserve ${usd(fit * Number(a.pay_usd))}?`)) act.mutate({ fn: "fund", id: a.id, fit: true });
              }}>Fund</Button>}
              {a.status === "funded" && hasAny(roles, ["assignment_manager"]) && <Button size="sm" variant="success" onClick={() => confirm("Publish this task? Users can accept it immediately (or from its scheduled time).") && act.mutate({ fn: "publish", id: a.id })}>Publish</Button>}
              {["funded", "published"].includes(a.status) && hasAny(roles, ["assignment_manager"]) && <Button size="sm" variant="ghost" className="ml-1" onClick={() => act.mutate({ fn: a.paused ? "resume" : "pause", id: a.id })}>{a.paused ? "Resume" : "Pause"}</Button>}
              {["funded", "published"].includes(a.status) && <Button size="sm" variant="outline" className="ml-1" onClick={() => confirm("Close this task? Unused budget (slots not accepted or already paid) returns to unallocated funds.") && act.mutate({ fn: "close", id: a.id })}>Close</Button>}
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
