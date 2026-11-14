import type { ReactNode } from "react";
import { Loader2, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/format";

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, bodyClassName }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("bg-card", className)}>
      {(title || action) && (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-3">
          <h2 className="text-lg font-bold">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn("py-2", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "default" | "success" | "warning" | "info" }) {
  const toneCls = {
    default: "bg-secondary text-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
  }[tone];
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {icon && <span className={cn("rounded-lg p-1.5 [&_svg]:h-4 [&_svg]:w-4", toneCls)}>{icon}</span>}
      </div>
      <p className="tabular mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <span className="mb-3 rounded-full bg-background p-3 text-muted-foreground shadow-card [&_svg]:h-5 [&_svg]:w-5">{icon ?? <Inbox />}</span>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}…
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : (error as { message?: string })?.message ?? String(error);
  return <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{msg}</div>;
}

const STATUS_TONE: Record<string, "success" | "warning" | "info" | "muted" | "destructive" | "default"> = {
  active: "success", verified: "success", approved: "success", credited: "success", paid: "success", confirmed: "success", published: "success",
  live: "success", completed: "success", resolved: "success", upheld: "success", offer: "success", connected: "success", ok: "success",
  pending: "warning", email_pending: "warning", verification_pending: "warning", submitted: "warning", under_review: "warning", reserved: "warning",
  batched: "info", processing: "info", awaiting_provider: "info", in_progress: "info", claimed: "info", funded: "info", interviewing: "info", applied: "info",
  revision_requested: "warning", on_hold: "warning", open: "warning", sandbox: "info", registered: "muted", draft: "muted", not_started: "muted",
  never_synced: "muted", closed: "muted", cancelled: "muted", abandoned: "muted", expired: "muted", withdrawn: "muted", dismissed: "muted", not_connected: "muted",
  rejected: "destructive", failed: "destructive", suspended: "destructive", restricted: "destructive", disputed: "destructive", error: "destructive",
  reversed: "destructive", partial: "warning", removed: "destructive",
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return null;
  const tone = STATUS_TONE[status] ?? "muted";
  const variant = tone === "destructive" ? "destructive" : tone === "default" ? "default" : tone;
  return <Badge variant={variant as "success"}>{label ?? humanize(status)}</Badge>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y rounded-xl border">
      {items.map((i) => (
        <div key={i.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="tabular text-right font-medium">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
