# Handshake

check the uploaded image, it should be the main design, of the aapp, then i want you # BUILD HANDSHAKE — A COMPLETE INTERNATIONAL REMOTE JOB AND PAID ASSIGNMENT PLATFORM

## PRODUCT IDENTITY

Build a complete production-oriented web application called HANDSHAKE.

Tagline: Global Work. Real Earnings.

HANDSHAKE is an international remote employment and paid digital assignment platform. It enables users to discover genuine remote employment opportunities from international employers, complete platform-funded digital assignments, receive earnings in USD and request withdrawals through supported payment providers, including M-Pesa in Kenya.

This is NOT a demo website, static UI, ordinary job directory or fictional earning application.

Build a real application with:
- Functional frontend.
- Real authentication.
- Real PostgreSQL database.
- Backend business logic.
- Database migrations.
- Role-based permissions.
- Secure file storage.
- External job API integrations.
- Financial ledger.
- USD wallet.
- Payment integration architecture.
- Withdrawal scheduling.
- Administrator control centre.
- Notifications.
- Error handling.
- Audit logging.

Never generate fake financial transactions, fake users, fictional employers, fabricated earnings or simulated successful payouts.

When external credentials are unavailable, create the complete integration interface and show an honest connection status. Never represent an unconnected integration as operational.

## TECHNOLOGY

Use:
- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- shadcn/ui.
- Supabase Authentication.
- Supabase PostgreSQL.
- Supabase Storage.
- Supabase Edge Functions.
- Row Level Security.
- GitHub-compatible source structure.
- Vercel deployment compatibility.

Keep all secrets on the server.

## BRANDING AND DESIGN

Use a professional international employment-platform design.

Brand name: HANDSHAKE.

Primary colour: Deep navy.
Secondary colour: White.
Accent: Professional blue.
Supporting colours: Light grey and neutral surfaces.

Use professional typography, clear spacing, compact layouts, responsive cards and polished dashboards.

Avoid cartoon illustrations, excessive gradients, unnecessary animations, generic AI-generated imagery and crowded interfaces.

The application must look like a serious global employment technology company.

Mobile responsiveness is mandatory.

## USER REGISTRATION

Build a structured registration process.

Collect:
- First name.
- Middle name.
- Last name.
- Username.
- Email.
- Phone number.
- Country.
- Password.
- Password confirmation.
- Referral code (optional).

Require email verification.

Add phone verification, profile completion, identity verification where required, payment ownership verification and account security.

Create a verification centre showing each verification stage.

Account statuses:
- Registered.
- Email pending.
- Verification pending.
- Verified.
- Active.
- Restricted.
- Suspended.
- Under review.
- Closed.

Implement password recovery, MFA, login history, session management and suspicious login detection.

Accounts are personal and non-transferable. Never enable sale of user identities, credentials or wallet balances.

## USER DASHBOARD

Create a professional user dashboard displaying:

- Available USD balance.
- Pending earnings.
- Reserved earnings.
- Total earnings.
- Total withdrawals.
- Available jobs.
- Active assignments.
- Pending submissions.
- Completed assignments.
- Recent transactions.
- Recent applications.
- Notifications.

Add quick actions for:
- Find jobs.
- Explore assignments.
- View wallet.
- Withdraw.
- View applications.
- Update profile.

## NAVIGATION

Create a compact hamburger menu containing:

MAIN:
1. Dashboard.
2. Explore Jobs.
3. HANDSHAKE Assignments.
4. Recommended Jobs.
5. Saved Jobs.
6. Applications.
7. My Work.

EARNINGS:
8. USD Wallet.
9. Earnings History.
10. Withdrawals.
11. Payment Methods.
12. Transactions.

PROFILE:
13. My Profile.
14. My CV.
15. Skills and Experience.
16. Portfolio.
17. Verification Centre.

ACCOUNT:
18. Notifications.
19. Security Centre.
20. Login Activity.
21. Help Centre.
22. Report a Problem.
23. Terms.
24. Privacy Policy.
25. Logout.

## GLOBAL JOB DISCOVERY

Build a genuine global job discovery engine.

The target is at least 400 live opportunities when source inventory permits.

Integrate approved job sources, including:

- Himalayas API.
- Adzuna API.
- Jooble API.
- Jobicy feed.
- Remote OK feed.
- Direct employer integrations.

Respect the terms, rate limits, attribution and application-link requirements of every provider.

Build an ingestion engine that:
1. Retrieves listings.
2. Normalizes data.
3. Detects duplicates.
4. Validates mandatory fields.
5. Checks expiration.
6. Preserves source attribution.
7. Preserves original application URLs.
8. Stores last synchronization time.
9. Automatically expires outdated listings.
10. Records API errors.

Never create fictional job opportunities to reach 400 listings.

Every listing must have:
- Title.
- Employer.
- Description.
- Responsibilities.
- Requirements.
- Location.
- Eligible countries.
- Remote status.
- Employment type.
- Salary where published.
- Skills.
- Application deadline where provided.
- Original source.
- Original application URL.
- Last verified date.

Include filters for:
- Country.
- Worldwide remote.
- Category.
- Salary.
- Experience.
- Employment type.
- Date published.
- Employer.
- Verified status.

Categories must include technology, administration, customer support, data entry, writing, design, marketing, research, AI training, translation, transcription, finance, education, sales and project management.

External jobs must link to their real employer application pages.

Do not imply that HANDSHAKE guarantees employment or pays for work performed for an external employer.

## HANDSHAKE WORKROOM

Build a separate internal paid-assignment system.

This is where HANDSHAKE or approved clients publish actual funded digital assignments.

Allow administrators to create assignments with:

- Title.
- Detailed description.
- Instructions.
- Required skills.
- Payment in USD.
- Available slots.
- Deadline.
- Estimated duration.
- Required deliverables.
- Review requirements.
- Revision policy.
- Eligibility.
- Funding status.

Implement the complete lifecycle:

Created → Funded → Published → Claimed → In Progress → Submitted → Under Review → Approved → Earnings Credited → Withdrawable.

Also support revision requests, rejection with reasons, appeals and disputes.

Never publish a guaranteed-payment assignment without reserving its budget.

Prevent double claiming, duplicate payments, unauthorized approvals and submissions after deadlines.

Allow clients to create accounts, fund assignments, review work and download invoices.

## USD WALLET

Create an actual USD wallet system.

Display:
- Available balance.
- Pending balance.
- Reserved balance.
- Total earned.
- Total withdrawn.
- Transaction history.

Use a double-entry financial ledger.

Never allow frontend code to directly modify balances.

All financial operations must be processed through secure backend functions and database transactions.

Support:
- Assignment earnings.
- Client funding.
- Platform fees.
- Withdrawal reservations.
- Withdrawal payments.
- Refunds.
- Reversals.
- Reconciliation.

Use idempotency keys and immutable financial transaction records.

## WITHDRAWALS

Support:
- M-Pesa in Kenya.
- Bank transfers where supported.
- Additional approved international payment providers.

Use authorized payment integrations.

For M-Pesa, prepare integration with Safaricom Daraja or an appropriately authorized provider.

Use USD as the internal accounting currency.

For KES payouts, obtain a documented exchange rate and show the user:
- USD amount.
- Exchange rate.
- Gross KES amount.
- Fees.
- Net KES amount.

Require verified payment ownership.

Withdrawal schedule:

EVERY SATURDAY AT 8:00 PM EAST AFRICAN TIME (UTC+3).

Users can request withdrawals throughout the week.

Create a payout scheduler that:
1. Finds eligible requests.
2. Checks user verification.
3. Checks account status.
4. Validates balances.
5. Detects duplicates.
6. Creates payout batches.
7. Submits payments to approved providers.
8. Processes provider callbacks.
9. Updates transaction statuses.
10. Notifies users.
11. Reconciles failed and successful transactions.

Create a configurable minimum withdrawal of $5.

Allow administrators to configure withdrawal limits and fees.

Never mark a payout successful without provider confirmation.

## ADMINISTRATOR SYSTEM

Create a completely separate administrator interface.

Initial Super Admin email:

briannamacharia15@gmail.com

Grant Super Admin access only to the verified account corresponding to this email.

Do not rely on frontend email checks. Establish the initial role securely on the backend.

Require MFA.

Super Admin dashboard must include:

- User statistics.
- Verified users.
- Suspended users.
- Job listings.
- Job synchronization status.
- Applications.
- Assignments.
- Assignment funding.
- Submissions.
- Pending reviews.
- Wallet statistics.
- Withdrawals.
- Payout batches.
- Financial reconciliation.
- Platform revenue.
- Support tickets.
- System health.

Create administrator roles:

1. Super Admin.
2. Operations Admin.
3. Job Manager.
4. Assignment Manager.
5. Finance Admin.
6. Support Admin.
7. Compliance Admin.

Only Super Admin can appoint administrators and configure privileged permissions.

Implement granular access control and audit logging.

Finance permissions must be separate from job-management permissions.

## ADMINISTRATOR MENU

Overview:
- Dashboard.
- Analytics.
- System Health.

Users:
- All Users.
- Verification.
- Activity.
- Suspensions.
- Appeals.

Jobs:
- All Jobs.
- Create Job.
- Edit Job.
- Approve Job.
- Job Sources.
- API Integrations.
- Expired Jobs.
- Reported Listings.

Assignments:
- All Assignments.
- Create Assignment.
- Budgets.
- Submissions.
- Reviews.
- Disputes.

Finance:
- Wallets.
- Ledger.
- Withdrawals.
- Payout Batches.
- Payment Providers.
- Exchange Rates.
- Reconciliation.
- Platform Revenue.

Administration:
- Administrators.
- Roles.
- Permissions.
- Audit Logs.
- System Settings.
- Notifications.
- Security.
- API Configuration.
- Maintenance Mode.

## DATABASE

Create production-oriented PostgreSQL migrations for:

profiles,
user_roles,
user_verifications,
user_skills,
user_experience,
user_documents,
user_sessions,
job_sources,
jobs,
job_sync_logs,
saved_jobs,
job_applications,
employer_profiles,
employer_verifications,
assignments,
assignment_budgets,
assignment_claims,
assignment_submissions,
submission_reviews,
assignment_disputes,
wallets,
ledger_accounts,
ledger_transactions,
ledger_entries,
withdrawal_methods,
withdrawal_requests,
payout_batches,
payout_transactions,
exchange_rates,
payment_providers,
notifications,
support_tickets,
audit_logs,
system_settings,
admin_invitations,
referrals,
platform_fees.

Implement appropriate foreign keys, unique constraints, indexes, financial consistency constraints and Row Level Security.

Users must only access their own sensitive information.

Use server-side privileged operations for financial transactions and administrator actions.

## NOTIFICATIONS

Implement:
- New job alerts.
- Application updates.
- Assignment alerts.
- Submission updates.
- Approval notifications.
- Earnings notifications.
- Withdrawal notifications.
- Security alerts.
- Account verification notifications.

Support in-app notifications, email and optional SMS.

## LANDING PAGE

Build an international professional employment landing page.

Headline:

YOUR NEXT OPPORTUNITY COULD BE ANYWHERE.

Subheading:

Discover international remote opportunities, complete paid digital assignments and manage your earnings in one place.

Sections:
1. Navigation.
2. Hero.
3. Global job search.
4. Featured opportunities.
5. HANDSHAKE assignments.
6. How it works.
7. Supported countries.
8. Payment explanation.
9. Worker benefits.
10. Employer services.
11. Trust and security.
12. FAQ.
13. Footer.

Buttons:
- Explore Opportunities.
- Create Account.
- Hire Remote Talent.

Do not display fabricated statistics, testimonials, employers or payment evidence.

## PRODUCTION REQUIREMENTS

Build:
- Secure authentication.
- Database migrations.
- Real CRUD operations.
- Backend financial logic.
- External API adapters.
- Payment callbacks.
- Job synchronization.
- Payout scheduling.
- Administrator permission enforcement.
- File upload validation.
- Audit logs.
- Error handling.
- Loading states.
- Empty states.
- Responsive layouts.
- Security controls.
- Backup strategy.

Never put secret API keys in frontend source code.

Never simulate a successful M-Pesa transaction.

Never generate fictional jobs or claim an external employer has approved an application without confirmation.

Do not create fake wallet balances or fake earning histories.

## DEVELOPMENT INSTRUCTIONS

Work systematically.

First establish the database schema, authentication, application routing and authorization.

Then implement the user experience and administrator interface.

Then connect real job sources.

Then implement the assignment engine.

Then implement the wallet and financial ledger.

Finally integrate real payment providers and scheduled payouts after credentials, approvals and compliance requirements are available.

Do not leave important buttons decorative.

Do not substitute static arrays for live backend data.

Do not create placeholder dashboards presented as functional systems.

If an integration needs credentials, build its backend adapter, configuration screen, connection status and testing process, and clearly identify what remains to be connected.

The final application must be a cohesive, secure, scalable international employment and earning platform named HANDSHAKE.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://handshake-300.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/99196361-2072-4892-9919-db2e4a2000ac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
