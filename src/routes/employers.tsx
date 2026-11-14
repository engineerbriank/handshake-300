import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StaticPage, staticHead } from "@/components/common/StaticPage";

export const Route = createFileRoute("/employers")({
  head: staticHead("Hire remote talent", "Publish funded digital assignments to a verified international workforce on Handshake."),
  component: () => (
    <StaticPage title="Hire remote talent" intro="Get well-defined digital work done by verified workers around the world.">
      <h2>What you can post</h2>
      <p>Data labelling and AI training, transcription, translation, research, content writing, data entry, design micro-tasks and other digital deliverables.</p>
      <h2>How it works</h2>
      <ol>
        <li>Create a client account and company profile.</li>
        <li>Draft an assignment with instructions, deliverables, slots, deadline and USD payment.</li>
        <li>Fund the budget. Our finance team confirms receipt and reserves the full amount before publishing.</li>
        <li>Review submissions: approve, request revisions, or reject with a reason.</li>
        <li>Unused budget is returned when you close the assignment. Funding invoices are available to download.</li>
      </ol>
      <div className="not-prose mt-6 flex gap-2"><Button asChild><Link to="/employer">Open the client portal</Link></Button></div>
    </StaticPage>
  ),
});
