create or replace function public.review_submission(_submission uuid, _decision text, _reason text default null::text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare actor uuid := auth.uid(); s public.assignment_submissions; c public.assignment_claims; a public.assignments; b public.assignment_budgets;
  is_owner boolean; pct numeric; flat numeric; fee numeric; net numeric; tx uuid;
begin
  select * into s from public.assignment_submissions where id = _submission;
  if s.id is null then raise exception 'Submission not found'; end if;
  select * into c from public.assignment_claims where id = s.claim_id for update;
  select * into a from public.assignments where id = c.assignment_id;
  select exists(select 1 from public.employer_profiles e where e.id = a.employer_id and e.owner_id = actor) into is_owner;
  if not is_owner then perform public._require_staff(array['assignment_manager']::public.app_role[]); end if;
  if s.user_id = actor then raise exception 'You cannot review your own submission'; end if;
  if c.status not in ('submitted','under_review','disputed') then raise exception 'Submission is not awaiting review'; end if;
  if _decision not in ('approved','revision_requested','rejected') then raise exception 'Invalid decision'; end if;
  if _decision <> 'approved' and char_length(coalesce(_reason,'')) < 5 then raise exception 'A reason is required'; end if;
  if (select id from public.assignment_submissions where claim_id = c.id order by revision_number desc, submitted_at desc limit 1) <> s.id then raise exception 'Only the latest submission can be reviewed'; end if;

  insert into public.submission_reviews (submission_id, reviewer_id, decision, reason) values (s.id, coalesce(actor, '00000000-0000-0000-0000-000000000000'::uuid), _decision, _reason);

  if _decision = 'approved' then
    select * into b from public.assignment_budgets where assignment_id = a.id for update;
    if b.id is null or b.total_usd - b.released_usd - b.refunded_usd < a.pay_usd then raise exception 'Budget exhausted; cannot credit earnings'; end if;
    select coalesce(percent,0), coalesce(flat_usd,0) into pct, flat from public.platform_fees where kind='assignment_commission' and provider is null and active;
    fee := round(a.pay_usd * coalesce(pct,0) / 100 + coalesce(flat,0), 2);
    if fee >= a.pay_usd then fee := 0; end if;
    net := a.pay_usd - fee;
    tx := public._post_txn('earning:' || c.id, 'assignment_earning', 'Earnings: ' || a.title, 'assignment_claim', c.id,
      jsonb_build_array(
        jsonb_build_object('account','ASSIGNMENT_ESCROW','debit',a.pay_usd),
        jsonb_build_object('account','USER_AVAILABLE:' || c.user_id,'credit',net),
        jsonb_build_object('account','PLATFORM_REVENUE','credit',fee)));
    update public.assignment_budgets set released_usd = released_usd + a.pay_usd where id = b.id;
    update public.assignment_claims set status = 'credited', credited_at = now(), credit_transaction_id = tx, updated_at = now() where id = c.id;
    perform public._notify(c.user_id, 'earning', 'Earnings credited', '$' || net || ' USD from "' || a.title || '" is now in your wallet.', '/wallet');
  elsif _decision = 'revision_requested' then
    if c.revisions_used >= a.max_revisions then raise exception 'Revision limit reached; approve or reject'; end if;
    update public.assignment_claims set status = 'revision_requested', revisions_used = revisions_used + 1, updated_at = now() where id = c.id;
    perform public._notify(c.user_id, 'submission', 'Revision requested', a.title || ': ' || _reason, '/work');
  else
    update public.assignment_claims set status = 'rejected', updated_at = now() where id = c.id;
    perform public._notify(c.user_id, 'submission', 'Submission rejected', a.title || ': ' || _reason || ' You can open a dispute from My Tasks.', '/work');
  end if;
  update public.assignment_disputes set status = case when _decision='approved' then 'upheld' else 'dismissed' end, resolution = coalesce(_reason,'Approved on review'), resolved_by = actor, resolved_at = now()
    where claim_id = c.id and status = 'open';
  perform public._refresh_wallet(c.user_id);
  perform public._audit('submission.reviewed', 'assignment_submission', s.id::text, jsonb_build_object('decision',_decision,'reason',_reason));
end $function$;