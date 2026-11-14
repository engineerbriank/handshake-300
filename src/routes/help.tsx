import { createFileRoute, Link } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { StaticPage, staticHead } from "@/components/common/StaticPage";

const FAQ: [string, string][] = [
  ["How do I get verified?", "Confirm your email, complete your profile (name, username, phone and country), then upload an identity document in the Verification Centre. Add a payout method so our team can confirm you own it."],
  ["Why can't I claim an assignment?", "You need a verified account (email + completed profile). Assignments may also be restricted by country, have no remaining slots, or be past the deadline."],
  ["When will I be paid for an assignment?", "When a reviewer approves your submission, the earnings are credited immediately to your available USD balance."],
  ["When are withdrawals sent?", "Every Saturday at 8:00 PM East Africa Time. Requests made before the run are included if your account and payout method are verified."],
  ["Why is my withdrawal on hold?", "Common reasons: account not verified, payout method not yet confirmed, or the payment provider is temporarily unavailable. The reason is shown on the Withdrawals page and the funds remain reserved for you."],
  ["Does HANDSHAKE pay for external jobs?", "No — external employers pay you directly. HANDSHAKE only pays for HANDSHAKE assignments."],
  ["How do I secure my account?", "Enable two-factor authentication in the Security Centre and review Login Activity regularly."],
];

export const Route = createFileRoute("/help")({
  head: staticHead("Help Centre", "Answers about verification, assignments, earnings and withdrawals on HANDSHAKE."),
  component: () => (
    <StaticPage title="Help Centre" intro="Common questions about using HANDSHAKE.">
      <Accordion type="single" collapsible>
        {FAQ.map(([q, a]) => (
          <AccordionItem key={q} value={q}>
            <AccordionTrigger className="text-left">{q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-8 rounded-2xl border bg-surface p-5">
        <p className="font-semibold">Still need help?</p>
        <p className="mt-1 text-sm text-muted-foreground">Open a ticket and our support team will respond in your account.</p>
        <Button asChild className="mt-3"><Link to="/report">Report a Problem</Link></Button>
      </div>
    </StaticPage>
  ),
});
