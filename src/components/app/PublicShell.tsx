import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";
import { AppShell } from "./AppShell";

export function PublicHeader() {
  const { user } = useCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/jobs" className="hover:text-foreground">Find jobs</Link>
          <Link to="/how-it-works" className="hover:text-foreground">How it works</Link>
          <Link to="/employers" className="hover:text-foreground">Employers</Link>
          <Link to="/help" className="hover:text-foreground">Help</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Button asChild size="sm"><Link to="/dashboard">Dashboard</Link></Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost"><Link to="/auth">Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/auth" search={{ mode: "signup" }}>Create account</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="text-lg font-extrabold tracking-[0.08em]">Handshake</p>
          <p className="mt-1 text-sm text-primary-foreground/70">Global Work. Real Earnings.</p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-primary-foreground/60">
            External job listings link to the original employer or source. Handshake does not guarantee employment and does not pay for work performed for external employers.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Platform</p>
          <Link to="/jobs" className="block text-primary-foreground/70 hover:text-primary-foreground">Explore jobs</Link>
          <Link to="/how-it-works" className="block text-primary-foreground/70 hover:text-primary-foreground">How it works</Link>
          <Link to="/employers" className="block text-primary-foreground/70 hover:text-primary-foreground">Hire remote talent</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Company</p>
          <Link to="/help" className="block text-primary-foreground/70 hover:text-primary-foreground">Help Centre</Link>
          <Link to="/terms" className="block text-primary-foreground/70 hover:text-primary-foreground">Terms</Link>
          <Link to="/privacy" className="block text-primary-foreground/70 hover:text-primary-foreground">Privacy Policy</Link>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-4 text-center text-xs text-primary-foreground/50">© {new Date().getFullYear()} Handshake</div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

/** Uses the signed-in app shell when a session exists, otherwise the public site chrome. */
export function SmartShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useCurrentUser();
  if (!isLoading && user) return <AppShell>{children}</AppShell>;
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </PublicShell>
  );
}
