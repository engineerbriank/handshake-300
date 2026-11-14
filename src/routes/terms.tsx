import { createFileRoute } from "@tanstack/react-router";
import { StaticPage, staticHead } from "@/components/common/StaticPage";

export const Route = createFileRoute("/terms")({
  head: staticHead("Terms of Service", "The terms that govern your use of HANDSHAKE, including assignments, wallet, withdrawals and acceptable use."),
  component: () => (
    <StaticPage title="Terms of Service" intro="Please read these terms carefully. By creating an account you agree to them.">
      <h2>1. The service</h2>
      <p>HANDSHAKE helps you discover remote job opportunities published by third-party employers and sources, and lets you complete paid digital assignments ("Assignments") funded by HANDSHAKE or approved clients.</p>
      <h2>2. External jobs</h2>
      <p>External listings are provided by third parties and link to the original application page. HANDSHAKE is not the employer, does not guarantee employment, and does not pay for work performed for external employers. Never pay anyone to obtain a job.</p>
      <h2>3. Accounts</h2>
      <ul>
        <li>You must provide accurate information and keep your credentials secure.</li>
        <li>Accounts are personal and non-transferable. Selling, renting or sharing accounts, credentials, identities or wallet balances is prohibited and results in suspension and possible forfeiture of fraudulently obtained earnings.</li>
        <li>We may require email, phone, identity and payment-ownership verification.</li>
      </ul>
      <h2>4. Assignments</h2>
      <p>Assignments state the payment in USD, deadline, deliverables and review requirements. Earnings are credited only after a submission is approved. Rejected submissions may be disputed through the platform. Submissions after the deadline are not accepted.</p>
      <h2>5. Wallet and withdrawals</h2>
      <ul>
        <li>Your wallet is denominated in USD. Balances change only through recorded ledger transactions.</li>
        <li>Withdrawals can be requested at any time and are processed every Saturday at 8:00 PM East Africa Time (UTC+3). The minimum withdrawal is shown in the app (currently $5).</li>
        <li>For local-currency payouts, the exchange rate, gross amount, fees and net amount are shown before you confirm. A withdrawal is complete only when the payment provider confirms it.</li>
        <li>We may hold or reverse transactions linked to fraud, error or legal requirements.</li>
      </ul>
      <h2>6. Acceptable use</h2>
      <p>No fraud, plagiarism, automated submissions where prohibited, harassment, or attempts to circumvent security or verification.</p>
      <h2>7. Changes and contact</h2>
      <p>We may update these terms and will notify you of material changes. For questions, use the Help Centre or Report a Problem.</p>
    </StaticPage>
  ),
});
