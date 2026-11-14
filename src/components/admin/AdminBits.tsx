import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
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
