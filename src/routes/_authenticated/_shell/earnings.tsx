import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays } from "date-fns";
import { TrendingUp, Download } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/common/ui-bits";
import { useTransactions, useWallet } from "@/lib/user-data";
import { usd, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/earnings")({
  head: () => ({ meta: [{ title: "Earnings — Handshake" }, { name: "description", content: "Your assignment earnings over time." }] }),
  component: Earnings,
});

const RANGES = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 } as const;

function Earnings() {
  const { data: wallet } = useWallet();
  const { data: txns } = useTransactions(500);
  const [range, setRange] = useState<keyof typeof RANGES>("1M");
  const earnings = useMemo(() => (txns ?? []).filter((t) => t.kind === "assignment_earning"), [txns]);
  const series = useMemo(() => {
    const days = RANGES[range];
    const start = subDays(new Date(), days - 1);
    const buckets = Array.from({ length: days }, (_, i) => ({ date: subDays(new Date(), days - 1 - i), amount: 0 }));
    for (const t of earnings) {
      const d = new Date(t.created_at);
      if (d < start) continue;
      const idx = Math.floor((d.getTime() - new Date(start.toDateString()).getTime()) / 86400_000);
      if (buckets[idx]) buckets[idx].amount += t.amount;
    }
    let run = 0;
    return buckets.map((b) => ({ label: format(b.date, days <= 7 ? "EEE" : "MMM d"), total: Math.round((run += b.amount) * 100) / 100 }));
  }, [earnings, range]);

  const exportCsv = () => {
    const rows = [["date", "description", "amount_usd"], ...earnings.map((t) => [t.created_at, t.description.replace(/,/g, " "), t.amount.toFixed(2)])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "handshake-earnings.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Earnings" actions={earnings.length > 0 && <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 text-sm font-semibold"><Download className="h-4 w-4" /> Export CSV</button>} />
      <div className="flex items-center justify-between rounded-3xl bg-primary p-6 text-primary-foreground shadow-raised">
        <div><p className="text-sm text-primary-foreground/70">Total Earnings</p><p className="tabular text-3xl font-extrabold">{usd(wallet?.total_earned_usd)} <span className="text-base text-primary-foreground/60">USD</span></p></div>
        <TrendingUp className="h-8 w-8 text-primary-foreground/70" />
      </div>
      <Panel>
        <div className="mb-4 inline-flex rounded-xl bg-secondary p-1">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold", range === r ? "bg-background shadow-card" : "text-muted-foreground")}>{r}</button>
          ))}
        </div>
        {earnings.length === 0 ? (
          <EmptyState title="No earnings yet" description="Your chart will grow as approved assignments are credited." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -10, right: 8, top: 8 }}>
                <defs><linearGradient id="earn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--color-info)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => usd(v)} />
                <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} fill="url(#earn)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel title="Recent earnings" bodyClassName="p-0">
        {earnings.length ? (
          <ul className="divide-y">
            {earnings.slice(0, 20).map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span><span className="block font-medium">{t.description.replace(/^Earnings: /, "")}</span><span className="text-xs text-muted-foreground">{shortDate(t.created_at)}</span></span>
                <span className="tabular font-semibold text-success">+{usd(t.amount)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-muted-foreground">Nothing yet.</p>}
      </Panel>
    </div>
  );
}
