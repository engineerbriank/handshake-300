create or replace function public.admin_task_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._require_staff(array['assignment_manager','finance_admin']::public.app_role[]);
  select jsonb_build_object(
    'templates_total', (select count(*) from public.task_templates),
    'templates_active', (select count(*) from public.task_templates where status = 'active'),
    'tasks_draft', (select count(*) from public.assignments where status = 'draft'),
    'tasks_funded', (select count(*) from public.assignments where status = 'funded'),
    'tasks_published', (select count(*) from public.assignments where status = 'published' and not paused and deadline > now() and slots_claimed < slots),
    'tasks_full', (select count(*) from public.assignments where status = 'published' and slots_claimed >= slots),
    'tasks_paused', (select count(*) from public.assignments where paused and status in ('funded','published')),
    'tasks_expired', (select count(*) from public.assignments where status = 'published' and deadline <= now()),
    'tasks_closed', (select count(*) from public.assignments where status in ('closed','cancelled')),
    'tasks_ever_published', (select count(*) from public.assignments where published_at is not null),
    'submissions_pending', (select count(*) from public.assignment_claims where status in ('submitted','under_review')),
    'submissions_disputed', (select count(*) from public.assignment_claims where status = 'disputed'),
    'approved', (select count(*) from public.assignment_claims where status in ('approved','credited')),
    'rejected', (select count(*) from public.assignment_claims where status = 'rejected'),
    'completed_tasks', (select count(*) from public.assignments a where a.published_at is not null and a.slots_claimed >= a.slots
        and not exists (select 1 from public.assignment_claims c where c.assignment_id = a.id and c.status not in ('credited','rejected','abandoned','expired'))),
    'budget_reserved', coalesce((select sum(total_usd) from public.assignment_budgets), 0),
    'budget_spent', coalesce((select sum(released_usd) from public.assignment_budgets), 0),
    'budget_refunded', coalesce((select sum(refunded_usd) from public.assignment_budgets), 0),
    'budget_remaining', coalesce((select sum(total_usd - released_usd - refunded_usd) from public.assignment_budgets), 0),
    'funding_pool', public._account_balance('FUNDING_POOL'),
    'escrow_balance', public._account_balance('ASSIGNMENT_ESCROW'),
    'avg_payment', coalesce((select round(avg(a.pay_usd), 2) from public.assignment_claims c join public.assignments a on a.id = c.assignment_id where c.status = 'credited'), 0),
    'avg_approval_hours', coalesce((select round(extract(epoch from avg(c.credited_at - s.submitted_at)) / 3600, 1)
        from public.assignment_claims c join lateral (select max(submitted_at) submitted_at from public.assignment_submissions where claim_id = c.id) s on true
        where c.status = 'credited'), 0),
    'credited_without_transaction', (select count(*) from public.assignment_claims where status = 'credited' and credit_transaction_id is null),
    'approved_not_credited', (select count(*) from public.assignment_claims where status = 'approved'),
    'duplicate_earning_transactions', (select count(*) from (select reference_id from public.ledger_transactions where kind = 'assignment_earning' group by reference_id having count(*) > 1) x)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_task_stats() from public, anon;
grant execute on function public.admin_task_stats() to authenticated;