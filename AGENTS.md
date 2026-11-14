<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## HANDSHAKE project rules
- Money moves only through SECURITY DEFINER SQL functions that post balanced, idempotent double-entry ledger transactions; never write balances from client or server code directly — keeps the ledger the single source of truth.
- Administrator RPCs and staff RLS require a staff role plus an MFA (aal2) session via `_require_staff` / `staff_has` — admin rights are never decided in the browser.
- Payouts are marked paid only by `payout_confirm` from a provider callback/confirmation running as service role — never simulate provider success.
- External jobs come only from real source adapters in `src/lib/job-sync.server.ts`; description HTML is sanitised at import — never fabricate listings.
- TypeScript runs with `exactOptionalPropertyTypes` and `noPropertyAccessFromIndexSignature` off to keep router search params and DB rows ergonomic.
- Paid Tasks reuse the `assignments` workflow (funding pool → escrow → claim → submit → review → credit); the task catalogue, pay rates and app directory are separate tables, and seed data lives in `seed/` with `seed/load_seed.py` — remixed copies start with empty data, so re-run it there.
