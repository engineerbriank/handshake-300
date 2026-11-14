import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { PageHeader, EmptyState, Loading } from "@/components/common/ui-bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTransactions, TXN_LABEL } from "@/lib/user-data";
import { usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_shell/transactions")({
  head: () => ({ meta: [{ title: "Transactions — HANDSHAKE" }, { name: "description", content: "Every movement on your available USD balance." }] }),
  component: Transactions,
});

function Transactions() {
  const { data, isLoading } = useTransactions(500);
  let balance = 0;
  const rows = [...(data ?? [])].reverse().map((t) => ({ ...t, balance: (balance = Math.round((balance + t.amount) * 100) / 100) })).reverse();
  return (
    <div>
      <PageHeader title="Transactions" description="Ledger entries on your available balance. Records are immutable; corrections appear as new entries." />
      {isLoading ? <Loading /> : rows.length === 0 ? <EmptyState icon={<Receipt />} title="No transactions yet" /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(t.created_at)}</TableCell>
                  <TableCell><span className="font-medium">{TXN_LABEL[t.kind] ?? t.kind}</span><span className="block text-xs text-muted-foreground">{t.description}{t.external_reference ? ` · Ref ${t.external_reference}` : ""}</span></TableCell>
                  <TableCell className={`tabular text-right font-semibold ${t.amount >= 0 ? "text-success" : ""}`}>{t.amount >= 0 ? "+" : "−"}{usd(Math.abs(t.amount))}</TableCell>
                  <TableCell className="tabular text-right">{usd(t.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
