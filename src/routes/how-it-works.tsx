import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StaticPage, staticHead } from "@/components/common/StaticPage";

export const Route = createFileRoute("/how-it-works")({
  head: staticHead("How it works", "How HANDSHAKE job discovery, funded assignments, the USD wallet and weekly withdrawals work."),
  component: () => (
    <StaticPage title="How HANDSHAKE works" intro="Two ways to work, one place to manage your earnings.">
      <h2>1. Discover international jobs</h2>
      <p>We continuously import listings from sources such as Himalayas, Jobicy and Remote OK. Each listing keeps its original source, eligible countries and application link. You apply directly with the employer.</p>
      <h2>2. Complete funded assignments</h2>
      <p>Assignments are created by HANDSHAKE or approved clients. Their full budget is reserved before publishing. Claim a slot, follow the instructions, submit before the deadline, and get paid when approved.</p>
      <h2>3. Your USD wallet</h2>
      <p>Available balance can be withdrawn. Pending shows submissions under review. Reserved shows withdrawals waiting for the next payout run.</p>
      <h2>4. Weekly withdrawals</h2>
      <p>Payouts run every Saturday at 8:00 PM East Africa Time. For M-Pesa you see the exchange rate, gross KES, fees and net KES before confirming.</p>
      <div className="not-prose mt-6 flex gap-2"><Button asChild><Link to="/auth" search={{ mode: "signup" }}>Create Account</Link></Button><Button asChild variant="outline"><Link to="/jobs">Explore jobs</Link></Button></div>
    </StaticPage>
  ),
});
