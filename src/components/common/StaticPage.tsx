import type { ReactNode } from "react";
import { SmartShell } from "@/components/app/PublicShell";

export function StaticPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <SmartShell>
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">{title}</h1>
        {intro && <p className="mt-2 text-muted-foreground">{intro}</p>}
        <div className="prose-job mt-6 space-y-2">{children}</div>
      </article>
    </SmartShell>
  );
}

export function staticHead(title: string, description: string) {
  return () => ({
    meta: [
      { title: `${title} — Handshake` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Handshake` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  });
}
