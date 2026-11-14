import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Copy, Pencil, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Field, Panel, StatCard, StatusBadge } from "@/components/common/ui-bits";
import { AdminTable, Td, Notice } from "@/components/admin/AdminBits";
import { usd, dateTime, shortDate, errorMessage, humanize } from "@/lib/format";
import { DIFFICULTIES, difficultyLabel, hourlyEquivalent, budgetFor, coveredSlots, SUBMISSION_LABEL } from "@/lib/tasks";
import { useTaskCategories } from "@/lib/task-data";
import { useRoles, hasAny } from "@/lib/auth";

type Stats = Record<string, number>;
export function useTaskStats() {
  return useQuery({ queryKey: ["admin-task-stats"], queryFn: async () => { const { data, error } = await supabase.rpc("admin_task_stats"); if (error) throw error; return data as Stats; } });
}

export function TaskOverview() {
  const s = useTaskStats().data;
  if (!s) return null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tasks published (all time)" value={s.tasks_ever_published} />
        <StatCard label="Open now" value={s.tasks_published} hint={`${s.tasks_full} fully claimed · ${s.tasks_paused} paused`} />
        <StatCard label="Completed tasks" value={s.completed_tasks} hint={`${s.tasks_expired} past deadline · ${s.tasks_closed} closed`} />
        <StatCard label="Unfunded drafts" value={s.tasks_draft} hint={`${s.tasks_funded} funded, not yet published`} />
        <StatCard label="Approved submissions" value={s.approved} />
        <StatCard label="Rejected submissions" value={s.rejected} />
        <StatCard label="Pending reviews" value={s.submissions_pending} hint={`${s.submissions_disputed} disputed`} />
        <StatCard label="Avg. approval time" value={`${s.avg_approval_hours} h`} />
        <StatCard label="Task expenditure" value={usd(s.budget_spent)} hint={`Avg. ${usd(s.avg_payment)} per paid task`} />
        <StatCard label="Remaining reserved budget" value={usd(s.budget_remaining)} />
        <StatCard label="Unallocated funding" value={usd(s.funding_pool)} />
        <StatCard label="Catalogue templates" value={s.templates_total} hint={`${s.templates_active} active`} />
      </div>
      <Integrity s={s} />
    </div>
  );
}

function Integrity({ s }: { s: Stats }) {
  const escrowOk = Math.abs(Number(s.escrow_balance) - Number(s.budget_remaining)) < 0.005;
  const rows = [
    { label: "Escrow balance matches remaining task budgets", ok: escrowOk, detail: `${usd(s.escrow_balance)} in escrow vs ${usd(s.budget_remaining)} in budgets` },
    { label: "Every paid submission has a ledger transaction", ok: s.credited_without_transaction === 0, detail: `${s.credited_without_transaction} missing` },
    { label: "No submission paid twice", ok: s.duplicate_earning_transactions === 0, detail: `${s.duplicate_earning_transactions} duplicates` },
    { label: "No approvals stuck before payment", ok: s.approved_not_credited === 0, detail: `${s.approved_not_credited} waiting` },
  ];
  return (
    <Panel title="Payment reconciliation">
      <ul className="space-y-2 text-sm">{rows.map((r) => <li key={r.label} className="flex flex-wrap items-center gap-2"><Badge variant={r.ok ? "success" : "destructive"}>{r.ok ? "OK" : "Check"}</Badge> {r.label} <span className="text-xs text-muted-foreground">({r.detail})</span></li>)}</ul>
    </Panel>
  );
}

type Template = { id: string; code: string; category_slug: string; title: string; summary: string; description: string; instructions: string; deliverables: string; verification_checklist: string[]; submission_types: string[]; required_skills: string[]; difficulty: string; suggested_pay_usd: number; estimated_minutes: number; status: string };

export function useTemplates() {
  return useQuery({
    queryKey: ["admin-templates"],
    queryFn: async () => {
      const out: Template[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("task_templates").select("*").order("code").range(from, from + 999);
        if (error) throw error;
        out.push(...((data ?? []) as Template[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
}

export function Catalogue({ onUse }: { onUse: (t: Template) => void }) {
  const qc = useQueryClient();
  const t = useTemplates();
  const cats = useTaskCategories();
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Template | null>(null);
  const rows = useMemo(() => (t.data ?? []).filter((x) => (cat === "all" || x.category_slug === cat) && (status === "all" || x.status === status) && (!q || `${x.code} ${x.title} ${x.summary}`.toLowerCase().includes(q.toLowerCase()))), [t.data, cat, status, q]);
  const setSt = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { const { error } = await supabase.from("task_templates").update({ status }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-templates"] }), onError: (e) => toast.error(errorMessage(e)),
  });
  const dup = useMutation({
    mutationFn: async (x: Template) => {
      const n = (t.data ?? []).filter((y) => y.code.startsWith(x.code + "-C")).length + 1;
      const { id: _id, status: _s, ...rest } = x as Template & Record<string, unknown>;
      delete (rest as Record<string, unknown>)["created_at"]; delete (rest as Record<string, unknown>)["updated_at"]; delete (rest as Record<string, unknown>)["updated_by"];
      const { error } = await supabase.from("task_templates").insert({ ...(rest as Omit<Template, "id" | "status">), code: `${x.code}-C${n}`, title: `${x.title} (copy)`, status: "inactive" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Copy created as inactive. Edit it, then activate."); qc.invalidateQueries({ queryKey: ["admin-templates"] }); }, onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3">
      <Notice>Templates are task briefs only. None of them is paid work until you create a task from it, reserve its full budget and publish it.</Notice>
      <div className="flex flex-wrap gap-2">
        <Input className="h-10 max-w-xs" placeholder="Search code or title" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="h-10 w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{cats.data?.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger><SelectContent>{["all", "active", "inactive", "archived"].map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent></Select>
        <span className="self-center text-sm text-muted-foreground">{rows.length} of {t.data?.length ?? 0} templates</span>
      </div>
      <AdminTable head={["Code", "Template", "Difficulty", "Pay · time", "Evidence", "Status", "Actions"]} empty={!rows.length}>
        {rows.slice(0, 200).map((x) => (
          <tr key={x.id}>
            <Td className="whitespace-nowrap font-mono text-xs">{x.code}</Td>
            <Td className="max-w-md"><p className="font-medium">{x.title}</p><p className="text-xs text-muted-foreground">{x.summary}</p></Td>
            <Td>{difficultyLabel(x.difficulty)}</Td>
            <Td className="tabular whitespace-nowrap">{usd(x.suggested_pay_usd)} · {x.estimated_minutes} min<span className="block text-xs text-muted-foreground">≈{usd(hourlyEquivalent(Number(x.suggested_pay_usd), x.estimated_minutes))}/hr</span></Td>
            <Td className="text-xs">{x.submission_types.map((s) => SUBMISSION_LABEL[s] ?? s).join(", ")}</Td>
            <Td><StatusBadge status={x.status} /></Td>
            <Td className="whitespace-nowrap">
              {x.status === "active" && <Button size="sm" onClick={() => onUse(x)}>Use</Button>}
              <Button size="icon" variant="ghost" title="Edit" onClick={() => setEdit(x)}><Pencil /></Button>
              <Button size="icon" variant="ghost" title="Duplicate" onClick={() => dup.mutate(x)}><Copy /></Button>
              {x.status !== "active" && x.status !== "archived" && <Button size="sm" variant="outline" onClick={() => setSt.mutate({ id: x.id, status: "active" })}>Activate</Button>}
              {x.status === "active" && <Button size="sm" variant="ghost" onClick={() => setSt.mutate({ id: x.id, status: "inactive" })}>Deactivate</Button>}
              {x.status !== "archived" && <Button size="sm" variant="ghost" onClick={() => confirm("Archive this template?") && setSt.mutate({ id: x.id, status: "archived" })}>Archive</Button>}
            </Td>
          </tr>
        ))}
      </AdminTable>
      {rows.length > 200 && <p className="text-xs text-muted-foreground">Showing the first 200 — narrow the search to see more.</p>}
      {edit && <TemplateEditor t={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function TemplateEditor({ t, onClose }: { t: Template; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: t.title, summary: t.summary, description: t.description, instructions: t.instructions, deliverables: t.deliverables, checklist: t.verification_checklist.join("\n"), skills: t.required_skills.join(", "), difficulty: t.difficulty, pay: String(t.suggested_pay_usd), minutes: String(t.estimated_minutes), types: t.submission_types.join(", ") });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const m = useMutation({
    mutationFn: async () => {
      const types = f.types.split(",").map((s) => s.trim()).filter((s) => s in SUBMISSION_LABEL);
      if (!types.length) throw new Error("Add at least one evidence type: " + Object.keys(SUBMISSION_LABEL).join(", "));
      const { error } = await supabase.from("task_templates").update({
        title: f.title.trim(), summary: f.summary.trim(), description: f.description.trim(), instructions: f.instructions.trim(), deliverables: f.deliverables.trim(),
        verification_checklist: f.checklist.split("\n").map((s) => s.trim()).filter(Boolean), required_skills: f.skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
        difficulty: f.difficulty, suggested_pay_usd: Math.round(Number(f.pay) * 100) / 100, estimated_minutes: Math.max(1, Math.floor(Number(f.minutes))), submission_types: types,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Template saved. Existing tasks keep their agreed terms."); qc.invalidateQueries({ queryKey: ["admin-templates"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {t.code}</DialogTitle><DialogDescription>Changes apply to new tasks created from this template. Tasks already published keep their pay and terms.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="Title"><Input value={f.title} onChange={set("title")} /></Field>
          <Field label="Summary"><Input value={f.summary} onChange={set("summary")} /></Field>
          <Field label="Description"><Textarea rows={3} value={f.description} onChange={set("description")} /></Field>
          <Field label="Instructions"><Textarea rows={6} value={f.instructions} onChange={set("instructions")} /></Field>
          <Field label="Deliverables"><Textarea rows={2} value={f.deliverables} onChange={set("deliverables")} /></Field>
          <Field label="Verification checklist (one per line)"><Textarea rows={4} value={f.checklist} onChange={set("checklist")} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Skills (comma separated)"><Input value={f.skills} onChange={set("skills")} /></Field>
            <Field label="Evidence types (comma separated)"><Input value={f.types} onChange={set("types")} /></Field>
            <Field label="Difficulty"><Select value={f.difficulty} onValueChange={(v) => setF({ ...f, difficulty: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Suggested pay (USD)"><Input type="number" min="0.01" step="0.01" value={f.pay} onChange={set("pay")} /></Field>
            <Field label="Estimated minutes"><Input type="number" min="1" value={f.minutes} onChange={set("minutes")} /></Field>
          </div>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Save template</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PublishFromTemplate({ initial, onCreated }: { initial?: Template | null; onCreated: () => void }) {
  const templates = useTemplates();
  const [tid, setTid] = useState(initial?.id ?? "");
  const [search, setSearch] = useState("");
  const t = (templates.data ?? []).find((x) => x.id === tid) ?? initial ?? null;
  const pool = useTaskStats().data?.funding_pool ?? 0;
  const employers = useQuery({ queryKey: ["admin-employers-min"], queryFn: async () => (await supabase.from("employer_profiles").select("id,company_name").order("company_name").limit(500)).data ?? [] });
  const [f, setF] = useState({ pay: initial ? String(initial.suggested_pay_usd) : "", slots: "", deadline: "", sponsor: "platform", sponsorName: "", employer: "", publishAt: "" });
  const pay = Number(f.pay || 0), slots = Math.floor(Number(f.slots || 0));
  const m = useMutation({
    mutationFn: async () => {
      if (!t) throw new Error("Choose a template");
      const { error } = await supabase.rpc("admin_create_task_from_template", {
        _template: t.id, _pay: pay, _slots: slots, _deadline: new Date(f.deadline).toISOString(), _sponsor_type: f.sponsor,
        _sponsor_name: f.sponsor === "platform" ? "Handshake" : f.sponsorName, _employer: f.employer || undefined, _publish_at: f.publishAt ? new Date(f.publishAt).toISOString() : undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Draft task created. Fund it, preview it, then publish from the Tasks tab."); onCreated(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const matches = (templates.data ?? []).filter((x) => x.status === "active" && search.length > 1 && `${x.code} ${x.title}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Panel title="1. Choose a template">
        <Input placeholder="Search the catalogue by code or title" value={search} onChange={(e) => setSearch(e.target.value)} />
        {matches.length > 0 && <ul className="mt-2 divide-y rounded-xl border">{matches.map((x) => <li key={x.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => { setTid(x.id); setSearch(""); setF((p) => ({ ...p, pay: String(x.suggested_pay_usd) })); }}><span className="font-mono text-xs">{x.code}</span> {x.title}</button></li>)}</ul>}
        {t && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold">{t.title} <span className="font-mono text-xs text-muted-foreground">{t.code}</span></p>
            <p className="text-muted-foreground">{t.description}</p>
            <p className="whitespace-pre-line rounded-xl bg-surface p-3">{t.instructions}</p>
            <p><b>Deliverables:</b> {t.deliverables}</p>
            <p><b>Checked against:</b> {t.verification_checklist.join(" · ")}</p>
            <p className="text-xs text-muted-foreground">{difficultyLabel(t.difficulty)} · ~{t.estimated_minutes} min · evidence: {t.submission_types.map((s) => SUBMISSION_LABEL[s] ?? s).join(", ")}</p>
          </div>
        )}
      </Panel>
      <Panel title="2. Configure and fund">
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Field label="Payment per approved submission (USD)"><Input type="number" min="0.01" step="0.01" value={f.pay} onChange={(e) => setF({ ...f, pay: e.target.value })} required /></Field>
          <Field label="Participant limit (paid slots)"><Input type="number" min="1" max="10000" value={f.slots} onChange={(e) => setF({ ...f, slots: e.target.value })} required /></Field>
          <Field label="Deadline"><Input type="datetime-local" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} required /></Field>
          <Field label="Open for claims from (optional)"><Input type="datetime-local" value={f.publishAt} onChange={(e) => setF({ ...f, publishAt: e.target.value })} /></Field>
          <Field label="Funding source">
            <Select value={f.sponsor} onValueChange={(v) => setF({ ...f, sponsor: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="platform">Handshake platform-funded</SelectItem><SelectItem value="client">Client-funded</SelectItem><SelectItem value="business">Approved business sponsor</SelectItem></SelectContent></Select>
          </Field>
          {f.sponsor === "client" && <Field label="Client account"><Select value={f.employer} onValueChange={(v) => setF({ ...f, employer: v, sponsorName: employers.data?.find((e) => e.id === v)?.company_name ?? "" })}><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger><SelectContent>{employers.data?.map((e) => <SelectItem key={e.id} value={e.id}>{e.company_name}</SelectItem>)}</SelectContent></Select></Field>}
          {f.sponsor === "business" && <Field label="Sponsor name (as on the signed agreement)"><Input value={f.sponsorName} onChange={(e) => setF({ ...f, sponsorName: e.target.value })} required /></Field>}
          <div className="rounded-xl bg-surface p-3 text-sm">
            <p>Budget to reserve: <b className="tabular">{usd(budgetFor(pay, slots))}</b></p>
            <p className="text-muted-foreground">Unallocated funding: {usd(pool)} — covers {coveredSlots(Number(pool), pay)} slots at this pay.</p>
            {pay > 0 && slots > coveredSlots(Number(pool), pay) && <p className="mt-1 text-warning">Not enough funding for {slots} slots. Funding will be refused unless you choose "fit to funds", which publishes only {coveredSlots(Number(pool), pay)}.</p>}
            {pay > 0 && t && <p className="text-muted-foreground">≈{usd(hourlyEquivalent(pay, t.estimated_minutes))}/hour equivalent</p>}
          </div>
          <Button disabled={m.isPending || !t}>{m.isPending && <Loader2 className="animate-spin" />} Create draft task</Button>
        </form>
      </Panel>
    </div>
  );
}

export function Funding() {
  const s = useTaskStats().data;
  const qc = useQueryClient();
  const { data: roles } = useRoles();
  const deposits = useQuery({ queryKey: ["admin-funding-history"], queryFn: async () => (await supabase.from("ledger_transactions").select("id,kind,description,external_reference,created_at,entries:ledger_entries(debit,credit,account:ledger_accounts(code))").in("kind", ["treasury_deposit", "assignment_funding", "assignment_refund"]).order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const [f, setF] = useState({ amount: "", ref: "", note: "" });
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("admin_record_deposit", { _amount: Number(f.amount), _external_reference: f.ref.trim(), _note: f.note.trim() || "Task funding deposit", _idempotency_key: `task-funding:${f.ref.trim()}` }); if (error) throw error; },
    onSuccess: () => { toast.success("Funding recorded"); setF({ amount: "", ref: "", note: "" }); qc.invalidateQueries({ queryKey: ["admin-task-stats"] }); qc.invalidateQueries({ queryKey: ["admin-funding-history"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const amountOf = (d: { entries: { debit: number; credit: number; account: { code: string } | null }[] }, code: string) => d.entries.filter((e) => e.account?.code === code).reduce((a, e) => a + Number(e.credit) - Number(e.debit), 0);
  return (
    <div className="space-y-5">
      {s && <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total task budget" value={usd(s.budget_reserved)} hint="Ever reserved" />
        <StatCard label="Reserved now" value={usd(s.budget_remaining)} hint="Held in escrow" />
        <StatCard label="Unallocated" value={usd(s.funding_pool)} hint="Available to reserve" />
        <StatCard label="Spent" value={usd(s.budget_spent)} hint="Paid to workers" />
        <StatCard label="Released back" value={usd(s.budget_refunded)} hint="Unused budget returned" />
      </div>}
      {hasAny(roles, ["finance_admin"]) && (
        <Panel title="Add funding record">
          <p className="mb-3 text-sm text-muted-foreground">Record money that has actually arrived in a Handshake bank or provider account. A verifiable bank or provider reference is required.</p>
          <form className="grid gap-3 md:grid-cols-[160px_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (confirm(`Record ${usd(Number(f.amount))} received with reference ${f.ref}?`)) add.mutate(); }}>
            <Input type="number" min="0.01" step="0.01" placeholder="Amount USD" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
            <Input placeholder="Bank / provider reference" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} minLength={4} required />
            <Input placeholder="Note (e.g. Q4 platform task budget)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            <Button disabled={add.isPending}>Record</Button>
          </form>
        </Panel>
      )}
      <Panel title="Funding history" bodyClassName="p-0">
        <AdminTable head={["Date", "Type", "Description", "Reference", "Unallocated change"]} empty={!deposits.data?.length}>
          {deposits.data?.map((d) => <tr key={d.id}><Td className="whitespace-nowrap">{dateTime(d.created_at)}</Td><Td>{humanize(d.kind)}</Td><Td>{d.description}</Td><Td className="text-xs">{d.external_reference ?? "—"}</Td><Td className="tabular">{usd(amountOf(d as never, "FUNDING_POOL"))}</Td></tr>)}
        </AdminTable>
      </Panel>
    </div>
  );
}

export function Payments() {
  const q = useQuery({ queryKey: ["admin-task-payments"], queryFn: async () => (await supabase.from("assignment_claims").select("id,status,credited_at,credit_transaction_id,updated_at, assignment:assignments(title,pay_usd), profile:profiles(email)").in("status", ["credited", "approved", "submitted", "under_review", "disputed"]).order("updated_at", { ascending: false }).limit(300)).data ?? [] });
  const paid = q.data?.filter((c) => c.status === "credited") ?? [];
  const pending = q.data?.filter((c) => c.status !== "credited") ?? [];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Approved & paid" value={usd(paid.reduce((a, c) => a + Number(c.assignment?.pay_usd ?? 0), 0))} hint={`${paid.length} payments (latest 300)`} />
        <StatCard label="Pending earnings" value={usd(pending.reduce((a, c) => a + Number(c.assignment?.pay_usd ?? 0), 0))} hint={`${pending.length} awaiting review`} />
        <StatCard label="Payments without ledger record" value={paid.filter((c) => !c.credit_transaction_id).length} hint="Should be 0" />
      </div>
      <Panel title="Payment history" bodyClassName="p-0">
        <AdminTable head={["Paid", "Worker", "Task", "Gross", "Ledger transaction"]} empty={!paid.length}>
          {paid.map((c) => <tr key={c.id}><Td className="whitespace-nowrap">{c.credited_at ? dateTime(c.credited_at) : "—"}</Td><Td>{c.profile?.email}</Td><Td>{c.assignment?.title}</Td><Td className="tabular">{usd(c.assignment?.pay_usd)}</Td><Td className="font-mono text-xs">{c.credit_transaction_id?.slice(0, 8) ?? <Badge variant="destructive">missing</Badge>}</Td></tr>)}
        </AdminTable>
      </Panel>
      <p className="text-xs text-muted-foreground">Each approval posts one ledger transaction keyed to the submission, so a repeated approval attempt is refused rather than paid twice. Full checks are under Overview → Payment reconciliation.</p>
    </div>
  );
}

export function AppDirectory() {
  const qc = useQueryClient();
  const [cat, setCat] = useState("all"); const [q, setQ] = useState("");
  const apps = useQuery({ queryKey: ["admin-apps"], queryFn: async () => (await supabase.from("task_app_directory").select("*").order("category").order("name")).data ?? [] });
  const rows = (apps.data ?? []).filter((a) => (cat === "all" || a.category === cat) && (!q || `${a.name} ${a.publisher}`.toLowerCase().includes(q.toLowerCase())));
  const cats = [...new Set((apps.data ?? []).map((a) => a.category))];
  const auth = useMutation({
    mutationFn: async ({ id, v, notes }: { id: string; v: boolean; notes?: string }) => { const { error } = await supabase.from("task_app_directory").update({ client_authorized: v, testing_instructions: notes ?? null, updated_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-apps"] }), onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3">
      <Notice tone="warning">App tasks are for research and private usability feedback only. Never pay for ratings, public reviews, installs or extra accounts. Mark an app "authorised" only when its owner has commissioned testing in writing.</Notice>
      <div className="flex flex-wrap gap-2">
        <Input className="h-10 max-w-xs" placeholder="Search apps" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="h-10 w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{cats.map((c) => <SelectItem key={c} value={c}>{humanize(c)}</SelectItem>)}</SelectContent></Select>
        <span className="self-center text-sm text-muted-foreground">{rows.length} apps</span>
      </div>
      <AdminTable head={["App", "Category", "Official links", "Listing checked", "Client authorised test"]} empty={!rows.length}>
        {rows.map((a) => (
          <tr key={a.id}>
            <Td><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.publisher ?? "Publisher not confirmed"}</p></Td>
            <Td>{humanize(a.category)}</Td>
            <Td className="whitespace-nowrap text-xs">{a.play_store_url && <a href={a.play_store_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Google Play <ExternalLink className="h-3 w-3" /></a>}{a.website_url && <a href={a.website_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 underline">Website <ExternalLink className="h-3 w-3" /></a>}</Td>
            <Td className="whitespace-nowrap text-xs">{a.listing_available ? "Available" : "Unavailable"} · {a.last_verified_at ? shortDate(a.last_verified_at) : "never"}</Td>
            <Td>{a.client_authorized ? <Button size="sm" variant="outline" onClick={() => auth.mutate({ id: a.id, v: false })}>Authorised — revoke</Button> : <Button size="sm" variant="ghost" onClick={() => { const notes = prompt("Reference to the written authorisation and testing instructions:"); if (notes && notes.trim().length > 5) auth.mutate({ id: a.id, v: true, notes: notes.trim() }); }}>Mark authorised</Button>}</Td>
          </tr>
        ))}
      </AdminTable>
      <p className="text-xs text-muted-foreground">Country availability is not recorded because it hasn't been verified for each listing.</p>
    </div>
  );
}

export function PayRates() {
  const qc = useQueryClient();
  const rates = useQuery({ queryKey: ["task-rates"], queryFn: async () => (await supabase.from("task_admin_settings").select("*").order("sort_order")).data ?? [] });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async ({ difficulty, value }: { difficulty: string; value: number }) => { const { error } = await supabase.from("task_admin_settings").update({ default_pay_usd: value }).eq("difficulty", difficulty); if (error) throw error; },
    onSuccess: () => { toast.success("Default rate saved"); qc.invalidateQueries({ queryKey: ["task-rates"] }); }, onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Panel title="Default pay by difficulty">
      <p className="mb-3 text-sm text-muted-foreground">Starting suggestions only. Every task's pay is set when it is created, and it never changes after users accept it.</p>
      <AdminTable head={["Difficulty", "Default pay (USD)", ""]} empty={!rates.data?.length}>
        {rates.data?.map((r) => (
          <tr key={r.difficulty}>
            <Td className="font-medium">{r.label}</Td>
            <Td><Input type="number" min="0.01" step="0.01" className="h-9 w-32" value={edits[r.difficulty] ?? String(r.default_pay_usd)} onChange={(e) => setEdits({ ...edits, [r.difficulty]: e.target.value })} /></Td>
            <Td><Button size="sm" variant="outline" disabled={!edits[r.difficulty] || Number(edits[r.difficulty]) <= 0} onClick={() => save.mutate({ difficulty: r.difficulty, value: Math.round(Number(edits[r.difficulty]) * 100) / 100 })}>Save</Button></Td>
          </tr>
        ))}
      </AdminTable>
    </Panel>
  );
}
