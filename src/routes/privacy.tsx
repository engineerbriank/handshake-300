import { createFileRoute } from "@tanstack/react-router";
import { StaticPage, staticHead } from "@/components/common/StaticPage";

export const Route = createFileRoute("/privacy")({
  head: staticHead("Privacy Policy", "How Handshake collects, uses and protects your personal and financial information."),
  component: () => (
    <StaticPage title="Privacy Policy" intro="We collect only what we need to run the platform securely.">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, username, email, phone, country and referral information.</li>
        <li>Verification documents you upload, stored in private, access-controlled storage.</li>
        <li>Payout details such as your M-Pesa number or bank information.</li>
        <li>Security data: sign-in times, IP address, approximate country and browser, used to detect suspicious activity.</li>
        <li>Activity: saved jobs, tracked applications, assignment submissions and wallet transactions.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To provide the service, verify identity and payout ownership, prevent fraud, process payouts through authorised providers, and meet legal obligations.</p>
      <h2>Sharing</h2>
      <p>We share data only with payment providers needed to complete your payouts, clients reviewing assignments you submit (your submission content only), and authorities where legally required. We do not sell personal data.</p>
      <h2>Your rights</h2>
      <p>You may access and update your profile, download your data on request, and request account closure through Report a Problem. Financial records are retained as required by law.</p>
      <h2>Security</h2>
      <p>Data is encrypted in transit, access is restricted by role, administrator actions require multi-factor authentication and are audit-logged.</p>
    </StaticPage>
  ),
});
