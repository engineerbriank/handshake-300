import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/ui-bits";
import { DocumentList } from "@/components/common/DocumentList";

export const Route = createFileRoute("/_authenticated/_shell/cv")({
  head: () => ({ meta: [{ title: "My CV — Handshake" }, { name: "description", content: "Upload and manage your CV." }] }),
  component: () => (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My CV" description="Keep your latest CV ready to attach to external applications." />
      <DocumentList category="cv" kinds={["document"]} />
    </div>
  ),
});
