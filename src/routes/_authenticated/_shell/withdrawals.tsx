import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet, Landmark, Smartphone, Mail, Loader2, CalendarClock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Panel, StatusBadge, KeyValue, EmptyState } from "@/components/common/ui-bits";
import { useWallet, useWithdrawalMethods, useWithdrawals } from "@/lib/user-data";
import { getWithdrawalQuote, requestWithdrawal } from "@/lib/wallet.functions";
import { usd, money, dateTime, errorMessage } from "@/lib/format";
import { useSettings } from "@/components/app/MaintenanceBanner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/withdrawals")({
  head: () => ({ meta: [{ title: "Withdraw Funds — Handshake" }, { name: "description", content: "Request a withdrawal to M-Pesa or other supported methods." }] }),
  component: Withdrawals,
});

const ICON = { mpesa: Smartphone, bank: Landmark, paypal: Mail } as const;
type Quote = Awaited<ReturnType<typeof getWithdrawalQuote>>;

function Withdrawals() {
  const { data: wallet } = useWallet();
  const { data: methods } = useWithdrawalMethods();
  const { data: history } = useWithdrawals();
  const { data: settings } = useSettings();
  const providers = useQuery({ queryKey: ["providers"], queryFn: async () => (await supabase.from("payment_providers").select("slug,name,enabled,connection_status")).data ?? [] });
  const nextRun = useQuery({ queryKey: ["next-payout"], queryFn: async () => (await supabase.rpc("next_payout_time", {})).data as string | null });
  const qc = useQueryClient();
  const [methodId, setMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [idem, setIdem] = useState(() => crypto.randomUUID());
  const min = Number(settings?.min_withdrawal_usd ?? 5);
  const selected = methodId ?? methods?.find((m) => m.is_default)?.id ?? methods?.[0]?.id ?? null;

  const getQuote = useMutation({
    mutationFn: () => getWithdrawalQuote({ data: { methodId: selected!, amount: Number(amount) } }),
    onSuccess: setQuote,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const confirm = useMutation({
    mutationFn: () => requestWithdrawal({ data: { methodId: selected!, amount: Number(amount), idempotencyKey: idem } }),
    onSuccess: () => {
      toast.success("Withdrawal requested. Funds are reserved until Saturday's payout run.");
      setQuote(null);
      setAmount("");
      setIdem(crypto.randomUUID());
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_withdrawal", { _wid: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Withdrawal cancelled");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const amt = Number(amount);
  const valid = selected && amt >= min && amt <= Number(wallet?.available_usd ?? 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Withdraw Funds" />
      <div className="flex flex-col items-center rounded-3xl border bg-card p-6 text-center shadow-card">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Wallet className="h-7 w-7" /></span>
        <p className="mt-3 text-sm text-muted-foreground">Available Balance</p>
        <p className="tabular text-3xl font-extrabold">{usd(wallet?.available_usd)} USD</p>
      </div>

      <section>
        <h2 className="mb-2 font-bold">Withdrawal Method</h2>
        {methods?.length ? (
          <div className="space-y-2">
            {methods.map((m) => {
              const Icon = ICON[m.provider as keyof typeof ICON] ?? Landmark;
              const p = providers.data?.find((x) => x.slug === m.provider);
              return (
                <button key={m.id} type="button" onClick={() => setMethodId(m.id)} className={cn("flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left", selected === m.id && "border-primary ring-1 ring-primary")}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">
                    <span className="block font-semibold">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.account_name} · {m.phone ?? m.account_number ?? m.email}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <StatusBadge status={m.ownership_status} label={m.ownership_status === "approved" ? "Verified" : m.ownership_status === "pending" ? "Verifying" : undefined} />
                    {p && !p.enabled && <span className="text-[0.7rem] text-muted-foreground">Provider unavailable</span>}
                  </span>
                  <span className={cn("ml-1 h-5 w-5 rounded-full border-2", selected === m.id ? "border-[6px] border-primary" : "border-input")} />
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No payment method yet" description="Add your M-Pesa number or other payout account first." action={<Button asChild><Link to="/payment-methods">Add payment method</Link></Button>} />
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold">Amount (USD)</h2>
        <Input type="number" inputMode="decimal" min={min} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Minimum ${usd(min)}`} className="h-12 rounded-xl text-lg" />
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" /> Withdrawals are processed every Saturday at 8:00 PM (EAT).{nextRun.data && ` Next run: ${dateTime(nextRun.data)} your time.`}</p>
      </section>

      <Button size="lg" className="w-full" disabled={!valid || getQuote.isPending} onClick={() => getQuote.mutate()}>
        {getQuote.isPending && <Loader2 className="animate-spin" />} Request Withdrawal
      </Button>
      {amount && amt < min && <p className="-mt-4 text-center text-xs text-destructive">Minimum withdrawal is {usd(min)}.</p>}
      {amount && amt > Number(wallet?.available_usd ?? 0) && <p className="-mt-4 text-center text-xs text-destructive">Amount exceeds your available balance.</p>}

      <Panel title="Withdrawal history" bodyClassName="p-0">
        {history?.length ? (
          <ul className="divide-y">
            {history.map((w) => (
              <li key={w.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span><span className="block font-semibold tabular">{usd(w.amount_usd)} → {money(w.net_local, w.local_currency)}</span><span className="text-xs text-muted-foreground">{w.method?.label} · {dateTime(w.created_at)} · scheduled {dateTime(w.scheduled_for)}</span></span>
                  <StatusBadge status={w.status} />
                </div>
                {w.failure_reason && <p className="mt-1 flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" /> {w.failure_reason}</p>}
                {w.provider_reference && <p className="mt-1 text-xs text-muted-foreground">Provider reference: {w.provider_reference}</p>}
                {["reserved", "on_hold"].includes(w.status) && <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => cancel.mutate(w.id)}>Cancel</Button>}
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-muted-foreground">No withdrawals yet.</p>}
      </Panel>

      <Dialog open={!!quote} onOpenChange={(o) => !o && setQuote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm withdrawal</DialogTitle>
            <DialogDescription>Funds are reserved now and sent in the next Saturday 8:00 PM EAT payout run.</DialogDescription>
          </DialogHeader>
          {quote && (
            <>
              <KeyValue
                items={[
                  { label: "Amount", value: `${usd(quote.amountUsd)} USD` },
                  ...(quote.currency !== "USD"
                    ? [
                        { label: "Exchange rate", value: `1 USD = ${quote.rate.toFixed(4)} ${quote.currency}` },
                        { label: `Gross ${quote.currency}`, value: money(quote.grossLocal, quote.currency) },
                        { label: "Fees", value: `${money(quote.feeLocal, quote.currency)} (${usd(quote.feeUsd)})` },
                        { label: `Net ${quote.currency}`, value: <b>{money(quote.netLocal, quote.currency)}</b> },
                      ]
                    : [
                        { label: "Fees", value: usd(quote.feeUsd) },
                        { label: "Net", value: <b>{usd(quote.netUsd)} USD</b> },
                      ]),
                  { label: "Provider", value: quote.providerName },
                ]}
              />
              {quote.currency !== "USD" && <p className="text-xs text-muted-foreground">Rate source: {quote.rateSource}, retrieved {dateTime(quote.rateFetchedAt)}. The final rate is fixed at payout time and shown on your receipt.</p>}
              {quote.connection !== "live" && (
                <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{quote.providerName} is not yet connected for live payouts. Your request will be reserved and held until the provider connection is active — it will not be marked as paid without provider confirmation.</p>
              )}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuote(null)}>Back</Button>
            <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>{confirm.isPending && <Loader2 className="animate-spin" />} Confirm withdrawal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
