import { Link } from "@tanstack/react-router";
import logo from "@/assets/handshake-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return <img src={logo.url} alt="" className={cn("rounded-[22%] object-cover", className ?? "h-9 w-9")} />;
}

export function Logo({ to = "/", className, light }: { to?: string; className?: string; light?: boolean }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2", className)} aria-label="Handshake home">
      <LogoMark className="h-8 w-8" />
      <span className={cn("text-lg font-bold", light ? "text-sidebar-foreground" : "text-foreground")}>Handshake</span>
    </Link>
  );
}
