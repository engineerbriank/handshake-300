import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Menu, LogOut, Home, Search, CircleDollarSign, UserRound, ShieldHalf, Building2, ClipboardList } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { NAV_GROUPS } from "./nav-items";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useProfile, useRoles, isStaff, displayName } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export async function signOut(queryClient: ReturnType<typeof useQueryClient>, navigate: ReturnType<typeof useNavigate>) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
  navigate({ to: "/auth", replace: true });
}

function NavList({ onNavigate, dark }: { onNavigate?: () => void; dark?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: roles } = useRoles();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const item = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-[0.95rem] font-medium transition-colors",
      dark
        ? active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        : active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );
  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((g) => (
        <div key={g.title}>
          <p className={cn("mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em]", dark ? "text-sidebar-foreground/45" : "text-muted-foreground/70")}>{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = path === i.to || (i.to !== "/dashboard" && path.startsWith(i.to + "/"));
              return (
                <li key={i.to}>
                  <Link to={i.to} onClick={onNavigate} className={item(active)}>
                    <i.icon className="h-4 w-4 shrink-0" /> {i.label}
                  </Link>
                </li>
              );
            })}
            {g.title === "Account" && (
              <li>
                <Button variant="ghost" type="button" onClick={() => signOut(qc, navigate)} className={cn(item(false), "w-full justify-start text-destructive")}>
                  <LogOut className="h-4 w-4" /> Logout
                </Button>
              </li>
            )}
          </ul>
        </div>
      ))}
      <div className="space-y-0.5">
        <p className={cn("mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em]", dark ? "text-sidebar-foreground/45" : "text-muted-foreground/70")}>More</p>
        <Link to="/employer" onClick={onNavigate} className={item(path.startsWith("/employer"))}>
          <Building2 className="h-4 w-4" /> Client Portal
        </Link>
        {isStaff(roles) && (
          <Link to="/admin" onClick={onNavigate} className={item(false)}>
            <ShieldHalf className="h-4 w-4" /> Admin Console
          </Link>
        )}
      </div>
    </nav>
  );
}

function useUnreadCount() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
      return count ?? 0;
    },
  });
}

const TABS = [
  { label: "Home", to: "/dashboard", icon: Home },
  { label: "Jobs", to: "/jobs", icon: Search },
  { label: "Tasks", to: "/assignments", icon: ClipboardList },
  { label: "Earnings", to: "/wallet", icon: CircleDollarSign },
  { label: "Account", to: "/profile", icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useProfile();
  const { data: unread } = useUnreadCount();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar lg:flex">
        <div className="px-5 py-5">
          <Logo to="/dashboard" light />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <NavList dark />
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-background px-4 sm:px-6 lg:border-b">
          <Button variant="ghost" size="icon" type="button" className="-ml-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/notifications" className="relative rounded-lg p-2 hover:bg-secondary" aria-label="Notifications">
              <Bell className="h-6 w-6" />
              {!!unread && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link to="/profile" className="hidden items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {(profile?.first_name?.[0] ?? "") + (profile?.last_name?.[0] ?? "")}
              </span>
              <span className="text-sm font-medium">{displayName(profile)}</span>
            </Link>
          </div>
        </header>

        <main className="app-content mx-auto w-full max-w-5xl px-4 pb-28 pt-2 sm:px-6 lg:pb-12 lg:pt-6">{children}</main>
      </div>

      {/* Mobile menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[290px] overflow-y-auto bg-background p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="border-b px-5 py-4">
            <Logo to="/dashboard" />
            <p className="mt-2 text-xs text-muted-foreground">{displayName(profile)}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          </div>
          <div className="px-3 py-4">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map((t) => {
          const active = path === t.to || path.startsWith(t.to + "/") || (t.to === "/assignments" && path === "/work") || (t.to === "/wallet" && ["/earnings", "/withdrawals", "/payment-methods", "/transactions"].includes(path)) || (t.to === "/profile" && ["/skills", "/cv", "/portfolio", "/verification", "/security", "/login-activity"].includes(path));
          return (
            <Link key={t.to} to={t.to} className={cn("flex flex-col items-center gap-1 py-2.5 text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>
              <t.icon className={cn("h-6 w-6", active && "stroke-[2.4]")} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
