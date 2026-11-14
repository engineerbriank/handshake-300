import { Link } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground", className ?? "h-9 w-9")}>
      <Handshake className="h-[60%] w-[60%]" strokeWidth={2.2} />
    </span>
  );
}

export function Logo({ to = "/", className, light }: { to?: string; className?: string; light?: boolean }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2.5", className)} aria-label="HANDSHAKE home">
      <LogoMark className="h-9 w-9" />
      <span className={cn("text-[1.05rem] font-extrabold tracking-[0.08em]", light ? "text-sidebar-foreground" : "text-foreground")}>
        HANDSHAKE
      </span>
    </Link>
  );
}
