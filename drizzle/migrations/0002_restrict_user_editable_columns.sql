-- Users may only edit their own descriptive fields; status, verification and ownership fields change only through audited backend functions.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (first_name, middle_name, last_name, username, phone, country, headline, bio, avatar_url, updated_at) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.withdrawal_methods FROM authenticated;
GRANT UPDATE (label, is_default) ON public.withdrawal_methods TO authenticated;

REVOKE UPDATE ON public.employer_profiles FROM authenticated;
GRANT UPDATE (company_name, website, country, description, billing_email) ON public.employer_profiles TO authenticated;

REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

REVOKE UPDATE ON public.job_applications FROM authenticated;
GRANT UPDATE (status, notes, updated_at) ON public.job_applications TO authenticated;

REVOKE UPDATE ON public.assignments FROM authenticated;
GRANT UPDATE (title, description, instructions, deliverables, review_requirements, revision_policy, eligibility, required_skills, category, pay_usd, slots, deadline, estimated_minutes, max_revisions, eligible_countries, updated_at) ON public.assignments TO authenticated;

REVOKE UPDATE ON public.support_tickets FROM authenticated;
GRANT UPDATE (status, staff_response, assigned_to, priority, updated_at) ON public.support_tickets TO authenticated;

REVOKE UPDATE ON public.job_reports FROM authenticated;
GRANT UPDATE (status) ON public.job_reports TO authenticated;

-- Rejected claims no longer keep budget locked when an assignment is closed; a later upheld dispute fails safely if budget is exhausted.
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
    where assignment_id = a.id and status in ('claimed','in_progress','submitted','under_review','revision_requested','disputed');
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