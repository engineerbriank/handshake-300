CREATE OR REPLACE FUNCTION public.admin_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare r jsonb;
begin
  perform public._require_staff(array['finance_admin']::public.app_role[]);
  select jsonb_build_object(
    'checked_at', now(),
    'total_debits', coalesce((select sum(debit) from public.ledger_entries), 0),
    'total_credits', coalesce((select sum(credit) from public.ledger_entries), 0),
    'unbalanced_transactions', (select count(*) from (select transaction_id from public.ledger_entries group by transaction_id having sum(debit) <> sum(credit)) x),
    'treasury', public._account_balance('TREASURY'),
    'funding_pool', public._account_balance('FUNDING_POOL'),
    'assignment_escrow', public._account_balance('ASSIGNMENT_ESCROW'),
    'payout_clearing', public._account_balance('PAYOUT_CLEARING'),
    'platform_revenue', public._account_balance('PLATFORM_REVENUE'),
    'user_available_total', coalesce((select sum(available_usd) from public.wallets), 0),
    'user_reserved_total', coalesce((select sum(reserved_usd) from public.wallets), 0),
    'wallet_mismatches', (select count(*) from public.wallets w
        where w.available_usd <> public._account_balance('USER_AVAILABLE:' || w.user_id)
           or w.reserved_usd <> public._account_balance('USER_RESERVED:' || w.user_id)),
    'escrow_vs_budgets', coalesce((select sum(total_usd - released_usd - refunded_usd) from public.assignment_budgets), 0),
    'unconfirmed_payouts', (select count(*) from public.payout_transactions where status in ('pending','submitted'))
  ) into r;
  return r;
end $$;

REVOKE ALL ON FUNCTION public.admin_reconciliation() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reconciliation() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_close_assignment(_assignment uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare a public.assignments; b public.assignment_budgets; outstanding int; refundable numeric; tx uuid;
begin
  perform public._require_staff(array['assignment_manager','finance_admin']::public.app_role[]);
  select * into a from public.assignments where id = _assignment for update;
  if a.id is null then raise exception 'Assignment not found'; end if;
  if a.status not in ('draft','funded','published','closed') then raise exception 'Assignment cannot be closed from status %', a.status; end if;
  if a.status = 'draft' then
    update public.assignments set status = 'cancelled', updated_at = now() where id = a.id;
    perform public._audit('assignment.cancelled', 'assignment', a.id::text, '{}'::jsonb);
    return 0;
  end if;
  select count(*) into outstanding from public.assignment_claims
    where assignment_id = a.id and status in ('claimed','in_progress','submitted','under_review','revision_requested','disputed','rejected');
  select * into b from public.assignment_budgets where assignment_id = a.id for update;
  refundable := 0;
  if b.id is not null then
    refundable := greatest(0, b.total_usd - b.released_usd - b.refunded_usd - outstanding * a.pay_usd);
    if refundable > 0 then
      tx := public._post_txn('close:' || a.id || ':' || (b.refunded_usd + refundable), 'assignment_refund', 'Unused budget returned: ' || a.title, 'assignment', a.id,
        jsonb_build_array(jsonb_build_object('account','ASSIGNMENT_ESCROW','debit',refundable), jsonb_build_object('account','FUNDING_POOL','credit',refundable)));
      update public.assignment_budgets set refunded_usd = refunded_usd + refundable where id = b.id;
    end if;
  end if;
  update public.assignments set status = 'closed', updated_at = now() where id = a.id;
  perform public._audit('assignment.closed', 'assignment', a.id::text, jsonb_build_object('refunded', refundable, 'outstanding_claims', outstanding));
  return refundable;
end $$;

REVOKE ALL ON FUNCTION public.admin_close_assignment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_close_assignment(uuid) TO authenticated;