import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/common/ui-bits";
import { ago } from "@/lib/format";
import { ADMIN_SECTIONS, type AdminSection } from "./admin-nav";

export function AdminTabs({ section, tab }: { section: AdminSection["to"]; tab: string }) {
  const navigate = useNavigate();
  const s = ADMIN_SECTIONS.find((x) => x.to === section)!;
  return (
    <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto pb-1">
      {s.tabs.map((t) => (
        <button
          key={t.tab}
          type="button"
          onClick={() => navigate({ to: section, search: { tab: t.tab } })}
          className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium", tab === t.tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function AdminTable({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing to show.</p>}
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 align-top", className)}>{children}</td>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return <div className={cn("mb-4 rounded-xl px-4 py-3 text-sm", tone === "info" ? "bg-info-soft text-info" : "bg-warning-soft text-warning")}>{children}</div>;
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
