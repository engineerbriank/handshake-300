import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Handshake — Global Work. Real Earnings." },
    { name: "description", content: "Find international remote jobs, complete paid assignments and manage your earnings in one place." },
    { property: "og:title", content: "Handshake — Global Work. Real Earnings." },
    { property: "og:description", content: "International remote opportunities and funded assignments in one place." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Welcome,
});

function Welcome() {
  return (
    <main className="welcome-screen flex min-h-dvh flex-col items-center px-6">
      <div className="flex w-full max-w-[350px] flex-1 flex-col items-center pt-[15vh] text-center sm:pt-[13vh]">
        <LogoMark className="h-[76px] w-[76px] sm:h-[88px] sm:w-[88px]" />
        <h1 className="mt-4 text-[34px] font-bold leading-tight sm:text-[40px]">Handshake</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">Global Work. Real Earnings.</p>
        <p className="mt-10 max-w-[235px] text-[13px] leading-[1.6] text-muted-foreground">Find international remote jobs,<br />complete paid assignments<br />and manage your earnings<br />in one place.</p>
        <div className="mt-auto w-full pb-8 pt-24">
          <Button asChild className="h-12 w-full"><Link to="/auth" search={{ mode: "signup" }}>Get Started <ArrowRight /></Link></Button>
          <Link to="/auth" className="mt-5 block text-xs font-medium">Sign In</Link>
          <Link to="/jobs" className="mt-4 block text-xs text-muted-foreground">Explore Jobs</Link>
        </div>
      </div>
      <div className="home-indicator" />
    </main>
  );
}
