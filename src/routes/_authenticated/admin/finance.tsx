import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader, StatusBadge, StatCard, Panel, Field } from "@/components/common/ui-bits";
import { AdminTabs, AdminTable, Td, Notice } from "@/components/admin/AdminBits";
import { tabSearch } from "@/components/admin/admin-nav";
import { adminCheckProviders, adminRefreshRate, adminRunPayoutBatch } from "@/lib/admin.functions";
import { usd, money, dateTime, ago, humanize, errorMessage } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  validateSearch: tabSearch,
  component: AdminFinance,
});

type Recon = Record<string, number | string>;
const useRecon = () => useQuery({ queryKey: ["admin-recon"], queryFn: async () => { const { data, error } = await supabase.rpc("admin_reconciliation"); if (error) throw error; return data as Recon; } });

function AdminFinance() {
  const { tab = "wallets" } = Route.useSearch();
  return (
    <div>
      <PageHeader title="Finance" description="All balances come from the double-entry ledger. Nothing here edits a balance directly." />
      <AdminTabs section="/admin/finance" tab={tab} />
      {tab === "wallets" && <Wallets />}
      {tab === "ledger" && <Ledger />}
      {tab === "withdrawals" && <Withdrawals />}
      {tab === "batches" && <Batches />}
      {tab === "providers" && <Providers />}
      {tab === "rates" && <Rates />}
      {tab === "reconciliation" && <Reconciliation />}
      {tab === "revenue" && <Revenue />}
      {tab === "deposits" && <Deposits />}
      {tab === "fees" && <Fees />}
    </div>
  );
}

function Wallets() {
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const w = useQuery({
    queryKey: ["admin-wallets", term],
    queryFn: async () => {
      let qb = supabase.from("wallets").select("*, profile:profiles!inner(email,first_name,last_name)").order("available_usd", { ascending: false }).limit(100);
      if (term) qb = qb.ilike("profile.email", `%${term.replace(/[%,()]/g, "")}%`);
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-3">
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email" /><Button><Search /></Button></form>
      <AdminTable head={["User", "Available", "Pending", "Reserved", "Total earned", "Withdrawn", "Updated"]} empty={!w.data?.length}>
        {w.data?.map((x) => (
          <tr key={x.id}><Td className="font-medium">{x.profile?.first_name} {x.profile?.last_name}<span className="block text-xs text-muted-foreground">{x.profile?.email}</span></Td>
            <Td className="tabular">{usd(x.available_usd)}</Td><Td className="tabular">{usd(x.pending_usd)}</Td><Td className="tabular">{usd(x.reserved_usd)}</Td><Td className="tabular">{usd(x.total_earned_usd)}</Td><Td className="tabular">{usd(x.total_withdrawn_usd)}</Td><Td>{ago(x.updated_at)}</Td></tr>
        ))}
      </AdminTable>
    </div>
  );
}

function Ledger() {
  const q = useQuery({
    queryKey: ["admin-ledger"],
    queryFn: async () => (await supabase.from("ledger_transactions").select("*, entries:ledger_entries(debit,credit, account:ledger_accounts(code,name))").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  return (
    <AdminTable head={["When", "Kind", "Description", "Entries", "Reference"]} empty={!q.data?.length}>
      {q.data?.map((t) => (
        <tr key={t.id} className="align-top">
          <Td className="whitespace-nowrap">{dateTime(t.created_at)}</Td><Td><StatusBadge status={t.kind} /></Td><Td>{t.description}</Td>
          <Td><ul className="space-y-0.5 text-xs">{t.entries?.map((e, i) => <li key={i} className="tabular"><span className="text-muted-foreground">{e.account?.code.split(":")[0]}</span> {Number(e.debit) > 0 ? `Dr ${usd(e.debit)}` : `Cr ${usd(e.credit)}`}</li>)}</ul></Td>
          <Td className="text-xs text-muted-foreground">{t.external_reference ?? t.idempotency_key}</Td>
        </tr>
      ))}
    </AdminTable>
  );
}

function Withdrawals() {
  const qc = useQueryClient();
  const [reason, setReason] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => (await supabase.from("withdrawal_requests").select("*, profile:profiles(email,account_status), method:withdrawal_methods(label,account_name,phone,account_number,ownership_status)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const release = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc("admin_release_withdrawal", { _wid: id, _reason: reason[id] ?? "" }); if (error) throw error; },
    onSuccess: () => { toast.success("Withdrawal cancelled and funds returned"); qc.invalidateQueries({ queryKey: ["admin-withdrawals"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <AdminTable head={["Requested", "User", "Amount", "Payout", "Method", "Status", "Action"]} empty={!q.data?.length}>
      {q.data?.map((w) => (
        <tr key={w.id}>
          <Td className="whitespace-nowrap">{dateTime(w.created_at)}<span className="block text-xs text-muted-foreground">for {dateTime(w.scheduled_for)}</span></Td>
          <Td>{w.profile?.email}<span className="block"><StatusBadge status={w.profile?.account_status} /></span></Td>
          <Td className="tabular">{usd(w.amount_usd)}<span className="block text-xs text-muted-foreground">fee {usd(w.fee_usd)}</span></Td>
          <Td className="tabular">{w.net_local ? money(w.net_local, w.local_currency ?? "USD") : usd(w.net_usd)}{w.exchange_rate && <span className="block text-xs text-muted-foreground">@ {w.exchange_rate} ({w.exchange_rate_source})</span>}</Td>
          <Td>{w.method?.label}<span className="block text-xs text-muted-foreground">{w.method?.account_name} · {w.method?.phone ?? w.method?.account_number}</span></Td>
          <Td><StatusBadge status={w.status} />{w.failure_reason && <span className="block max-w-[14rem] text-xs text-destructive">{w.failure_reason}</span>}{w.provider_reference && <span className="block text-xs text-muted-foreground">Ref {w.provider_reference}</span>}</Td>
          <Td>{["reserved", "on_hold", "failed"].includes(w.status) && (
            <div className="flex gap-1"><Input className="h-8 w-36 text-xs" placeholder="Reason" value={reason[w.id] ?? ""} onChange={(e) => setReason({ ...reason, [w.id]: e.target.value })} /><Button size="sm" variant="outline" disabled={(reason[w.id] ?? "").length < 3} onClick={() => release.mutate(w.id)}>Cancel & refund</Button></div>
          )}</Td>
        </tr>
      ))}
    </AdminTable>
  );
}

function Batches() {
  const qc = useQueryClient();
  const b = useQuery({ queryKey: ["admin-batches"], queryFn: async () => (await supabase.from("payout_batches").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [] });
  const p = useQuery({ queryKey: ["admin-payouts"], queryFn: async () => (await supabase.from("payout_transactions").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const run = useMutation({
    mutationFn: () => adminRunPayoutBatch(),
    onSuccess: (r) => { toast.success(r.batchId ? `Batch created. ${JSON.stringify(r.dispatched)}` : "No eligible withdrawals"); qc.invalidateQueries({ queryKey: ["admin-batches"] }); qc.invalidateQueries({ queryKey: ["admin-payouts"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">Batches run automatically every Saturday at 8:00 PM East Africa Time. A payout is marked paid only when the provider confirms it; requests to a provider that is not connected stay queued.</p>
        <Button onClick={() => confirm("Create a payout batch now from all eligible withdrawals?") && run.mutate()} disabled={run.isPending}>{run.isPending ? <Loader2 className="animate-spin" /> : <Play />} Run batch now</Button>
      </div>
      <Panel title="Batches" bodyClassName="p-0">
        <AdminTable head={["Created", "Scheduled for", "Items", "Total", "Status", "Completed"]} empty={!b.data?.length}>
          {b.data?.map((x) => <tr key={x.id}><Td>{dateTime(x.created_at)}</Td><Td>{dateTime(x.scheduled_for)}</Td><Td>{x.item_count}</Td><Td className="tabular">{usd(x.total_usd)}</Td><Td><StatusBadge status={x.status} /></Td><Td>{x.completed_at ? dateTime(x.completed_at) : "—"}</Td></tr>)}
        </AdminTable>
      </Panel>
      <Panel title="Provider payouts" bodyClassName="p-0">
        <AdminTable head={["Created", "Provider", "Status", "Attempts", "Provider request", "Receipt", "Last error"]} empty={!p.data?.length}>
          {p.data?.map((x) => <tr key={x.id}><Td>{dateTime(x.created_at)}</Td><Td>{humanize(x.provider)}</Td><Td><StatusBadge status={x.status} /></Td><Td>{x.attempts}</Td><Td className="text-xs">{x.provider_request_id ?? "—"}</Td><Td className="text-xs">{x.provider_receipt ?? "—"}</Td><Td className="max-w-xs text-xs text-destructive">{x.last_error}</Td></tr>)}
        </AdminTable>
      </Panel>
    </div>
  );
}

function Providers() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-providers"], queryFn: async () => (await supabase.from("payment_providers").select("*").order("name")).data ?? [] });
  const check = useMutation({ mutationFn: () => adminCheckProviders(), onSuccess: () => { toast.success("Connection status refreshed"); qc.invalidateQueries({ queryKey: ["admin-providers"] }); }, onError: (e) => toast.error(errorMessage(e)) });
  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => { const { error } = await supabase.from("payment_providers").update({ enabled }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-providers"] }),
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>{check.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check connections</Button></div>
      <div className="grid gap-4 md:grid-cols-3">
        {q.data?.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between"><div><p className="font-bold">{p.name}</p><p className="text-xs text-muted-foreground">{p.purpose} · {p.currency} · {p.countries.join(", ") || "International"}</p></div><StatusBadge status={p.connection_status} /></div>
            <p className="mt-3 text-xs text-muted-foreground">Required secrets: {p.required_secrets.join(", ") || "none"}</p>
            {p.last_error && <p className="mt-1 text-xs text-destructive">{p.last_error}</p>}
            {p.notes && <p className="mt-2 text-xs">{p.notes}</p>}
            <div className="mt-4 flex items-center justify-between text-sm"><label className="flex items-center gap-2"><Switch checked={p.enabled} onCheckedChange={(v) => toggle.mutate({ id: p.id, enabled: v })} /> Offer to users</label><span className="text-xs text-muted-foreground">Checked {p.last_checked_at ? ago(p.last_checked_at) : "never"}</span></div>
          </div>
        ))}
      </div>
      <Notice tone="warning">M-Pesa payouts need Safaricom Daraja B2C approval for your business shortcode. When you have the credentials, ask in chat to store them as secure secrets; the status turns to connected only after a live authentication check succeeds.</Notice>
    </div>
  );
}

function Rates() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-rates"], queryFn: async () => (await supabase.from("exchange_rates").select("*").order("fetched_at", { ascending: false }).limit(50)).data ?? [] });
  const refresh = useMutation({ mutationFn: () => adminRefreshRate({ data: { currency: "KES" } }), onSuccess: () => { toast.success("Rate fetched"); qc.invalidateQueries({ queryKey: ["admin-rates"] }); }, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Fetch USD → KES now</Button></div>
      <AdminTable head={["Fetched", "Pair", "Rate", "Source", "Source time"]} empty={!q.data?.length}>
        {q.data?.map((r) => <tr key={r.id}><Td>{dateTime(r.fetched_at)}</Td><Td>{r.base}/{r.quote}</Td><Td className="tabular font-semibold">{Number(r.rate).toFixed(4)}</Td><Td>{r.source}</Td><Td>{r.source_timestamp ? dateTime(r.source_timestamp) : "—"}</Td></tr>)}
      </AdminTable>
    </div>
  );
}

function Reconciliation() {
  const r = useRecon();
  const d = r.data;
  if (r.error) return <p className="text-sm text-destructive">{errorMessage(r.error)}</p>;
  if (!d) return null;
  const balanced = Number(d.total_debits) === Number(d.total_credits) && Number(d.unbalanced_transactions) === 0;
  const escrowOk = Number(d.assignment_escrow) === Number(d.escrow_vs_budgets);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => r.refetch()}><RefreshCw /> Re-run checks</Button></div>
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Ledger debits = credits" value={balanced ? "Balanced" : "Out of balance"} tone={balanced ? "success" : "warning"} hint={`${usd(d.total_debits)} / ${usd(d.total_credits)}`} />
        <StatCard label="Wallets match ledger" value={Number(d.wallet_mismatches) === 0 ? "All match" : `${d.wallet_mismatches} mismatched`} tone={Number(d.wallet_mismatches) === 0 ? "success" : "warning"} />
        <StatCard label="Escrow matches budgets" value={escrowOk ? "Matches" : "Mismatch"} tone={escrowOk ? "success" : "warning"} hint={`${usd(d.assignment_escrow)} vs ${usd(d.escrow_vs_budgets)}`} />
      </div>
      <Panel title="Account balances" bodyClassName="p-0">
        <AdminTable head={["Account", "Balance"]}>
          {[["Treasury (cash held)", d.treasury], ["Unallocated funding", d.funding_pool], ["Assignment escrow", d.assignment_escrow], ["Payout clearing (awaiting confirmation)", d.payout_clearing], ["Platform revenue", d.platform_revenue], ["User available balances", d.user_available_total], ["User reserved (withdrawals)", d.user_reserved_total]].map(([k, v]) => <tr key={String(k)}><Td>{k}</Td><Td className="tabular font-semibold">{usd(v as number)}</Td></tr>)}
        </AdminTable>
      </Panel>
      <p className="text-xs text-muted-foreground">Checked {dateTime(String(d.checked_at))}. Compare Treasury against your bank and provider statements; unconfirmed payouts: {d.unconfirmed_payouts}.</p>
    </div>
  );
}

function Revenue() {
  const q = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: async () => {
      const { data: acct } = await supabase.from("ledger_accounts").select("id").eq("code", "PLATFORM_REVENUE").single();
      if (!acct) return [];
      return (await supabase.from("ledger_entries").select("credit,debit,created_at, tx:ledger_transactions(kind,description)").eq("account_id", acct.id).order("created_at", { ascending: false }).limit(200)).data ?? [];
    },
  });
  const total = (q.data ?? []).reduce((s, e) => s + Number(e.credit) - Number(e.debit), 0);
  return (
    <div className="space-y-3">
      <StatCard label="Revenue (last 200 entries)" value={usd(total)} tone="success" />
      <AdminTable head={["When", "Source", "Description", "Amount"]} empty={!q.data?.length}>
        {q.data?.map((e, i) => <tr key={i}><Td>{dateTime(e.created_at)}</Td><Td><StatusBadge status={e.tx?.kind} /></Td><Td>{e.tx?.description}</Td><Td className="tabular">{usd(Number(e.credit) - Number(e.debit))}</Td></tr>)}
      </AdminTable>
    </div>
  );
}

function Deposits() {
  const qc = useQueryClient();
  const [f, setF] = useState({ amount: "", ref: "", note: "" });
  const [key] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("admin_record_deposit", { _amount: Number(f.amount), _external_reference: f.ref.trim(), _note: f.note.trim(), _idempotency_key: `${key}:${f.ref.trim()}` }); if (error) throw error; },
    onSuccess: () => { toast.success("Deposit recorded"); setF({ amount: "", ref: "", note: "" }); qc.invalidateQueries({ queryKey: ["admin-recon"] }); qc.invalidateQueries({ queryKey: ["admin-ledger"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const recon = useRecon();
  return (
    <Panel title="Record a confirmed deposit">
      <Notice>Record money only after it has actually arrived in a Handshake bank or provider account. The external reference (bank transfer ID, M-Pesa receipt, invoice number) is stored permanently and audited.</Notice>
      <form className="grid max-w-2xl gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (confirm(`Record ${usd(f.amount)} received with reference ${f.ref}?`)) m.mutate(); }}>
        <Field label="Amount received (USD)"><Input type="number" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
        <Field label="External payment reference"><Input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} minLength={4} required /></Field>
        <div className="md:col-span-2"><Field label="Note (e.g. client name and invoice)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
        <div className="flex items-center gap-4 md:col-span-2"><Button disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Record deposit</Button>{recon.data && <span className="text-sm text-muted-foreground">Unallocated now: <b>{usd(recon.data.funding_pool as number)}</b></span>}</div>
      </form>
    </Panel>
  );
}

function Fees() {
  const qc = useQueryClient();
  const fees = useQuery({ queryKey: ["admin-fees"], queryFn: async () => (await supabase.from("platform_fees").select("*").order("kind")).data ?? [] });
  const settings = useQuery({ queryKey: ["admin-fin-settings"], queryFn: async () => (await supabase.from("system_settings").select("key,value").in("key", ["min_withdrawal_usd", "max_withdrawal_usd"])).data ?? [] });
  const [edit, setEdit] = useState<Record<string, { percent: string; flat: string }>>({});
  const [lim, setLim] = useState<Record<string, string>>({});
  const saveFee = useMutation({
    mutationFn: async (f: { kind: string; provider: string | null; percent: number; flat: number }) => { const { error } = await supabase.rpc("admin_set_fee", { _kind: f.kind, _provider: f.provider as string, _percent: f.percent, _flat: f.flat }); if (error) throw error; },
    onSuccess: () => { toast.success("Fee saved"); qc.invalidateQueries({ queryKey: ["admin-fees"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveLimit = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => { const { error } = await supabase.rpc("admin_update_finance_setting", { _key: key, _value: value }); if (error) throw error; },
    onSuccess: () => { toast.success("Limit saved"); qc.invalidateQueries({ queryKey: ["admin-fin-settings"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Fees" bodyClassName="p-0">
        <AdminTable head={["Fee", "Percent", "Flat USD", ""]} empty={!fees.data?.length}>
          {fees.data?.map((f) => {
            const k = f.id; const e = edit[k] ?? { percent: String(f.percent), flat: String(f.flat_usd) };
            return (
              <tr key={k}>
                <Td>{humanize(f.kind)}{f.provider && <span className="block text-xs text-muted-foreground">{humanize(f.provider)}</span>}</Td>
                <Td><Input className="h-8 w-20" type="number" min="0" max="50" step="0.01" value={e.percent} onChange={(ev) => setEdit({ ...edit, [k]: { ...e, percent: ev.target.value } })} /></Td>
                <Td><Input className="h-8 w-20" type="number" min="0" step="0.01" value={e.flat} onChange={(ev) => setEdit({ ...edit, [k]: { ...e, flat: ev.target.value } })} /></Td>
                <Td><Button size="sm" variant="outline" onClick={() => saveFee.mutate({ kind: f.kind, provider: f.provider, percent: Number(e.percent), flat: Number(e.flat) })}>Save</Button></Td>
              </tr>
            );
          })}
        </AdminTable>
      </Panel>
      <Panel title="Withdrawal limits">
        <div className="space-y-4">
          {settings.data?.map((s) => (
            <div key={s.key} className="flex items-end gap-2">
              <Field label={s.key === "min_withdrawal_usd" ? "Minimum withdrawal (USD)" : "Maximum per request (USD)"}><Input type="number" min="1" step="0.01" value={lim[s.key] ?? String(s.value)} onChange={(e) => setLim({ ...lim, [s.key]: e.target.value })} /></Field>
              <Button variant="outline" onClick={() => saveLimit.mutate({ key: s.key, value: Number(lim[s.key] ?? s.value) })}>Save</Button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
