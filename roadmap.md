# HANDSHAKE roadmap

## Reference redesign
- [x] Match the reference welcome, sign-in, signup and logo/favicon.
- [ ] Apply reference typography, cards, navigation and layouts across user and staff screens.
- [ ] Verify signed-in screens (needs a signed-in test account)

- [x] Database schema, RLS, ledger & workflow functions
- [x] Design system (navy/white/blue, mobile-first like mockups)
- [ ] Auth: register (structured), sign in, Google/Apple, reset password, MFA
- [x] Landing page
- [ ] User app shell (hamburger menu + bottom tabs) and all user pages
- [ ] Job ingestion (Himalayas, Jobicy, Remote OK live; Adzuna/Jooble adapters needing keys)
- [ ] Workroom assignments lifecycle
- [ ] USD wallet, withdrawals, payment methods
- [ ] Payout scheduler (Sat 20:00 EAT) + M-Pesa Daraja adapter + callbacks
- [ ] Admin console (MFA required) with all sections
- [ ] Employer/client portal
- [ ] Tests for money rules, commit
- [x] Send user a preview screenshot of progress
- [x] Remix setup: re-apply database schema, storage, sign-in providers and job import on the new project
- [x] Second remix setup: verify schema, sign-up triggers, starting settings, sign-in providers, job import
- [x] Third remix setup: check database connection, schema, sign-up triggers, settings, job import

## Paid Tasks
- [x] Fourth remix setup: sign-up hooks, starting records, 473 imported jobs, sign-in options
- [x] Task catalogue tables, funding/claim/submit/review rules
- [x] Load 720 task templates and 226 verified apps
- [x] User screens: Paid Tasks, task detail, My Tasks, dashboard sections, navigation
- [x] Admin Paid Tasks centre: catalogue, publish, funding, submissions, payments, performance
- [x] Run the full $100 / 40 × $2.00 money test and edge cases against real records
- [ ] Check signed-in Paid Tasks and admin screens in the browser (needs a real account; none exists yet)
