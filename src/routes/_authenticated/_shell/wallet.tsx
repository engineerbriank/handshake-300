import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, Lock, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard } from "@/components/common/ui-bits";
import { useWallet, useTransactions, TXN_LABEL } from "@/lib/user-data";
import { usd, dateTime } from "@/lib/format";
import { useSettings } from "@/components/app/MaintenanceBanner";

export const Route = createFileRoute("/_authenticated/_shell/wallet")({
  head: () => ({ meta: [{ title: "USD Wallet — HANDSHAKE" }, { name: "description", content: "Your USD balances and transactions." }] }),
  component: WalletPage,
});

function WalletPage() {
  const { data: w } = useWallet();
  const { data: txns } = useTransactions(20);
  const { data: settings } = useSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="USD Wallet" description="Balances are calculated from an immutable double-entry ledger and can only change through verified backend transactions." />
      <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-raised">
        <p className="text-sm text-primary-foreground/70">Available balance</p>
        <p className="tabular mt-1 text-4xl font-extrabold">{usd(w?.available_usd)} <span className="text-lg text-primary-foreground/60">USD</span></p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="secondary"><Link to="/withdrawals">Withdraw</Link></Button>
          <Button asChild variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/earnings">Earnings history</Link></Button>
        </div>
        <p className="mt-4 text-xs text-primary-foreground/60">Payouts: {String(settings?.payout_schedule ?? "Every Saturday at 8:00 PM EAT")} · Minimum ${String(settings?.min_withdrawal_usd ?? 5)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending" value={usd(w?.pending_usd)} hint="Submissions under review" icon={<Clock />} tone="warning" />
        <StatCard label="Reserved" value={usd(w?.reserved_usd)} hint="Withdrawals awaiting payout" icon={<Lock />} tone="info" />
        <StatCard label="Total earned" value={usd(w?.total_earned_usd)} icon={<TrendingUp />} tone="success" />
        <StatCard label="Total withdrawn" value={usd(w?.total_withdrawn_usd)} icon={<ArrowUpRight />} />
      </div>
      <Panel title="Transaction history" action={<Link to="/transactions" className="text-sm font-semibold">View all</Link>} bodyClassName="p-0">
        {txns?.length ? (
          <ul className="divide-y">
            {txns.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span><span className="block font-medium">{TXN_LABEL[t.kind] ?? t.description}</span><span className="text-xs text-muted-foreground">{dateTime(t.created_at)}</span></span>
                <span className={`tabular font-semibold ${t.amount >= 0 ? "text-success" : ""}`}>{t.amount >= 0 ? "+" : "−"}{usd(Math.abs(t.amount))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted-foreground"><Wallet className="h-4 w-4" /> No transactions yet. Complete an assignment to earn your first USD.</div>
        )}
      </Panel>
    </div>
  );
}
