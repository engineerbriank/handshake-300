import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { Loading } from "@/components/common/ui-bits";
import { MfaManager, useMfa } from "@/components/common/MfaManager";
import { ADMIN_SECTIONS } from "@/components/admin/admin-nav";
import { useRoles, isStaff, hasAny, useProfile, displayName } from "@/lib/auth";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Console — Handshake" }, { name: "description", content: "Handshake administration." }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { data: roles } = useRoles();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="space-y-1">
      {ADMIN_SECTIONS.filter((s) => s.roles.length === 0 || hasAny(roles, s.roles)).map((s) => {
        const active = s.to === "/admin" ? path === "/admin" || path === "/admin/" : path.startsWith(s.to);
        return (
          <div key={s.to}>
            <Link to={s.to} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")}>
              <s.icon className="h-4 w-4" /> {s.title}
            </Link>
            {active && (
              <div className="ml-7 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {s.tabs.map((t) => (
                  <Link key={t.tab} to={s.to} search={{ tab: t.tab }} onClick={onNavigate} className="block rounded-md px-2 py-1 text-xs text-sidebar-foreground/65 hover:text-sidebar-accent-foreground">
                    {t.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <Link to="/dashboard" className="mt-6 flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to user app</Link>
    </nav>
  );
}

function AdminLayout() {
  const { data: roles, isLoading } = useRoles();
  const mfa = useMfa();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);

  if (isLoading || mfa.isLoading) return <Loading label="Checking access" />;
  if (!isStaff(roles))
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 text-xl font-bold">Administrator access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account does not have an administrator role.</p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold">Back to dashboard</Link>
        </div>
      </div>
    );
  if (mfa.data?.current !== "aal2")
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-3xl border bg-background p-7 shadow-card">
          <ShieldCheck className="h-9 w-9 text-info" />
          <h1 className="mt-3 text-xl font-bold">Multi-factor authentication required</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Administrator actions require an authenticator-app verified session. Every privileged action is checked again on the server.</p>
          <MfaManager onVerified={() => mfa.refetch()} />
          <Link to="/dashboard" className="mt-6 block text-sm text-muted-foreground">Back to dashboard</Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex">
        <div className="px-5 py-5"><Logo to="/admin" light /><p className="mt-1 pl-12 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sidebar-primary">Admin</p></div>
        <div className="flex-1 overflow-y-auto px-3 pb-6"><AdminNav /></div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-lg p-2 hover:bg-secondary lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin menu"><Menu className="h-5 w-5" /></button>
          <span className="font-bold lg:hidden">Admin Console</span>
          <div className="ml-auto text-right text-xs">
            <p className="font-semibold">{displayName(profile)}</p>
            <p className="text-muted-foreground">{roles?.filter((r) => r !== "user" && r !== "client").map(humanize).join(", ")}</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6"><Outlet /></main>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[290px] overflow-y-auto border-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Admin menu</SheetTitle>
          <div className="px-5 py-5"><Logo to="/admin" light /></div>
          <div className="px-3 pb-6"><AdminNav onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
