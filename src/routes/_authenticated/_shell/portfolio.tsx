import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/ui-bits";
import { DocumentList } from "@/components/common/DocumentList";

export const Route = createFileRoute("/_authenticated/_shell/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — HANDSHAKE" }, { name: "description", content: "Samples of your work." }] }),
  component: () => (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Portfolio" description="Add work samples or links to show clients what you can do." />
      <DocumentList category="portfolio" allowLinks kinds={["document", "image", "archive"]} />
    </div>
  ),
});
