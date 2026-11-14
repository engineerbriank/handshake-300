
create or replace function public._audit(_action text, _entity_type text, _entity_id text, _details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details) values (auth.uid(), _action, _entity_type, _entity_id, coalesce(_details,'{}'));
$$;

create or replace function public._notify(_user uuid, _type text, _title text, _body text, _link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link) values (_user, _type, _title, _body, _link);
$$;

create or replace function public._setting_num(_key text, _default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.system_settings where key = _key), _default)
$$;

create or replace function public._setting_bool(_key text, _default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.system_settings where key = _key), _default)
$$;

create or replace function public.next_payout_time(_from timestamptz default now())
returns timestamptz language plpgsql stable set search_path = public as $$
declare base timestamptz; dow int; candidate timestamptz;
begin
  base := date_trunc('day', _from at time zone 'UTC') at time zone 'UTC';
  dow := extract(dow from (_from at time zone 'UTC'))::int;
  candidate := base + make_interval(days => ((6 - dow + 7) % 7)) + interval '17 hours';
  if candidate <= _from then candidate := candidate + interval '7 days'; end if;
  return candidate;
end $$;
grant execute on function public.next_payout_time(timestamptz) to anon, authenticated;

create or replace function public._account_id(_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.ledger_accounts where code = _code
$$;

create or replace function public._account_balance(_code text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when a.type in ('asset','expense') then e.debit - e.credit else e.credit - e.debit end), 0)
  from public.ledger_accounts a left join public.ledger_entries e on e.account_id = a.id
  where a.code = _code
$$;

create or replace function public._ensure_user_accounts(_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ledger_accounts (code, name, type, user_id) values
    ('USER_AVAILABLE:' || _user, 'User available balance', 'liability', _user),
    ('USER_RESERVED:' || _user, 'User reserved for withdrawal', 'liability', _user)
  on conflict (code) do nothing;
  insert into public.wallets (user_id) values (_user) on conflict (user_id) do nothing;
end $$;

create or replace function public._post_txn(_key text, _kind text, _description text, _ref_type text, _ref_id uuid, _entries jsonb, _external_ref text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare tx uuid; e jsonb; acct uuid; d numeric := 0; c numeric := 0;
begin
  select id into tx from public.ledger_transactions where idempotency_key = _key;
  if tx is not null then return tx; end if;
  insert into public.ledger_transactions (idempotency_key, kind, description, reference_type, reference_id, external_reference, created_by)
  values (_key, _kind, _description, _ref_type, _ref_id, _external_ref, auth.uid()) returning id into tx;
  for e in select * from jsonb_array_elements(_entries) loop
    acct := public._account_id(e->>'account');
    if acct is null then raise exception 'Unknown ledger account %', e->>'account'; end if;
    if coalesce((e->>'debit')::numeric,0) = 0 and coalesce((e->>'credit')::numeric,0) = 0 then continue; end if;
    insert into public.ledger_entries (transaction_id, account_id, debit, credit)
    values (tx, acct, round(coalesce((e->>'debit')::numeric,0),2), round(coalesce((e->>'credit')::numeric,0),2));
    d := d + round(coalesce((e->>'debit')::numeric,0),2); c := c + round(coalesce((e->>'credit')::numeric,0),2);
  end loop;
  if d <> c or d = 0 then raise exception 'Unbalanced transaction (debits %, credits %)', d, c; end if;
  return tx;
end $$;

create or replace function public._refresh_wallet(_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.wallets set
    available_usd = public._account_balance('USER_AVAILABLE:' || _user),
    reserved_usd = public._account_balance('USER_RESERVED:' || _user),
    pending_usd = coalesce((select sum(a.pay_usd) from public.assignment_claims c join public.assignments a on a.id = c.assignment_id
                    where c.user_id = _user and c.status in ('submitted','under_review','disputed')), 0),
    total_earned_usd = coalesce((select sum(e.credit) from public.ledger_entries e join public.ledger_transactions t on t.id = e.transaction_id
                    where e.account_id = public._account_id('USER_AVAILABLE:' || _user) and t.kind = 'assignment_earning'), 0),
    total_withdrawn_usd = coalesce((select sum(amount_usd) from public.withdrawal_requests where user_id = _user and status = 'paid'), 0),
    updated_at = now()
  where user_id = _user;
end $$;

create or replace function public._recompute_status(_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cur public.account_status; email_ok boolean; profile_ok boolean; target public.account_status;
begin
  select account_status into cur from public.profiles where id = _user;
  if cur is null or cur not in ('registered','email_pending','verification_pending','verified') then return; end if;
  select exists(select 1 from public.user_verifications where user_id=_user and kind='email' and status='approved') into email_ok;
  select exists(select 1 from public.user_verifications where user_id=_user and kind='profile' and status='approved') into profile_ok;
  target := case when not email_ok then 'email_pending'::public.account_status
                 when not profile_ok then 'verification_pending'::public.account_status
                 else 'verified'::public.account_status end;
  if target <> cur then update public.profiles set account_status = target where id = _user; end if;
end $$;

create or replace function public._profile_completion(_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles; complete boolean; target public.verification_status;
begin
  select * into p from public.profiles where id = _user;
  if p.id is null then return; end if;
  complete := char_length(coalesce(p.first_name,'')) > 0 and char_length(coalesce(p.last_name,'')) > 0
    and p.username is not null and char_length(coalesce(p.phone,'')) >= 9 and char_length(coalesce(p.country,'')) > 0;
  target := case when complete then 'approved' else 'not_started' end;
  update public.user_verifications set status = target, reviewed_at = case when complete then now() end
  where user_id = _user and kind = 'profile' and status <> target;
  perform public._recompute_status(_user);
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'); uname text; ref_code text; referrer uuid; full_name text;
begin
  uname := lower(regexp_replace(coalesce(meta->>'username',''), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(uname) < 3 or char_length(uname) > 30 or exists(select 1 from public.profiles where username = uname) then
    uname := null;
  end if;
  full_name := coalesce(meta->>'full_name', meta->>'name', '');
  insert into public.profiles (id, first_name, middle_name, last_name, username, email, phone, country, account_status)
  values (new.id,
    left(coalesce(nullif(meta->>'first_name',''), split_part(full_name,' ',1), ''), 60),
    left(nullif(meta->>'middle_name',''), 60),
    left(coalesce(nullif(meta->>'last_name',''), nullif(regexp_replace(full_name, '^\S+\s*', ''), ''), ''), 60),
    uname, coalesce(new.email,''), left(nullif(meta->>'phone',''), 20), left(nullif(meta->>'country',''), 60),
    case when new.email_confirmed_at is not null then 'verification_pending'::public.account_status else 'email_pending'::public.account_status end);
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  insert into public.user_verifications (user_id, kind, status, reviewed_at) values
    (new.id, 'email', case when new.email_confirmed_at is not null then 'approved' else 'pending' end::public.verification_status, case when new.email_confirmed_at is not null then now() end),
    (new.id, 'phone', 'not_started', null),
    (new.id, 'profile', 'not_started', null),
    (new.id, 'identity', 'not_started', null),
    (new.id, 'payment_ownership', 'not_started', null);
  perform public._ensure_user_accounts(new.id);
  ref_code := upper(nullif(trim(meta->>'referral_code'),''));
  if ref_code is not null then
    select id into referrer from public.profiles where referral_code = ref_code and id <> new.id;
    if referrer is not null then
      update public.profiles set referred_by = referrer where id = new.id;
      insert into public.referrals (referrer_id, referred_id) values (referrer, new.id) on conflict do nothing;
    end if;
  end if;
  if new.email_confirmed_at is not null and lower(new.email) = 'briannamacharia15@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin') on conflict do nothing;
  end if;
  perform public._profile_completion(new.id);
  return new;
end $$;

create or replace function public.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.user_verifications set status = 'approved', reviewed_at = now() where user_id = new.id and kind = 'email';
  if lower(new.email) = 'briannamacharia15@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin') on conflict do nothing;
  end if;
  perform public._recompute_status(new.id);
  perform public._notify(new.id, 'verification', 'Email verified', 'Your email address has been confirmed.', '/verification');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null) execute function public.handle_user_confirmed();

create or replace function public._on_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.username is not null then new.username := lower(new.username); end if;
  if new.phone is distinct from old.phone then
    update public.user_verifications set status = 'not_started', reviewed_at = null where user_id = new.id and kind = 'phone';
  end if;
  return new;
end $$;
create trigger profiles_before_update before update on public.profiles for each row execute function public._on_profile_update();

create or replace function public._after_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.first_name, new.last_name, new.username, new.phone, new.country) is distinct from (old.first_name, old.last_name, old.username, old.phone, old.country) then
    perform public._profile_completion(new.id);
  end if;
  return null;
end $$;
create trigger profiles_after_update after update on public.profiles for each row execute function public._after_profile_update();

create or replace function public.submit_identity_verification(_document_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if _document_path is null or split_part(_document_path,'/',1) <> auth.uid()::text then raise exception 'Invalid document path'; end if;
  update public.user_verifications set status = 'pending', document_path = _document_path, submitted_at = now(), notes = null
  where user_id = auth.uid() and kind = 'identity' and status <> 'approved';
end $$;

create or replace function public.mark_phone_verified()
returns void language plpgsql security definer set search_path = public, auth as $$
declare confirmed timestamptz; authphone text;
begin
  select phone_confirmed_at, phone into confirmed, authphone from auth.users where id = auth.uid();
  if confirmed is null then raise exception 'Phone not confirmed by the verification provider'; end if;
  update public.profiles set phone = '+' || ltrim(authphone,'+') where id = auth.uid();
  update public.user_verifications set status = 'approved', reviewed_at = now() where user_id = auth.uid() and kind = 'phone';
end $$;

create or replace function public._assignment_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if old.status <> 'draft' and (new.pay_usd <> old.pay_usd or new.slots <> old.slots) then
      raise exception 'Pay and slots are locked once an assignment is funded';
    end if;
  end if;
  if new.status in ('funded','published') and not exists (select 1 from public.assignment_budgets b where b.assignment_id = new.id and b.total_usd >= new.pay_usd * new.slots) then
    raise exception 'Assignment budget must be fully reserved before it can be funded or published';
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger assignments_guard before insert or update on public.assignments for each row execute function public._assignment_guard();

create or replace function public.admin_record_deposit(_amount numeric, _external_reference text, _note text, _idempotency_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare tx uuid;
begin
  perform public._require_staff(array['finance_admin']::public.app_role[]);
  if _amount is null or _amount <= 0 then raise exception 'Amount must be positive'; end if;
  if char_length(coalesce(_external_reference,'')) < 4 then raise exception 'A verifiable external payment reference is required'; end if;
  tx := public._post_txn('deposit:' || _idempotency_key, 'treasury_deposit', coalesce(nullif(_note,''),'Treasury deposit'), 'treasury', null,
    jsonb_build_array(jsonb_build_object('account','TREASURY','debit',_amount), jsonb_build_object('account','FUNDING_POOL','credit',_amount)), _external_reference);
  perform public._audit('finance.deposit_recorded', 'ledger_transaction', tx::text, jsonb_build_object('amount',_amount,'reference',_external_reference));
  return tx;
end $$;

create or replace function public.admin_fund_assignment(_assignment uuid, _idempotency_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid; a public.assignments; total numeric; pool numeric; tx uuid;
begin
  actor := public._require_staff(array['finance_admin']::public.app_role[]);
  select * into a from public.assignments where id = _assignment for update;
  if a.id is null then raise exception 'Assignment not found'; end if;
  if a.status <> 'draft' then raise exception 'Only draft assignments can be funded'; end if;
  total := a.pay_usd * a.slots;
  pool := public._account_balance('FUNDING_POOL');
  if pool < total then raise exception 'Insufficient unallocated funds: % available, % required', pool, total; end if;
  tx := public._post_txn('fund:' || _assignment || ':' || _idempotency_key, 'assignment_funding', 'Budget reserved: ' || a.title, 'assignment', a.id,
    jsonb_build_array(jsonb_build_object('account','FUNDING_POOL','debit',total), jsonb_build_object('account','ASSIGNMENT_ESCROW','credit',total)));
  insert into public.assignment_budgets (assignment_id, total_usd, funding_transaction_id, funded_by) values (a.id, total, tx, actor);
  update public.assignments set status = 'funded' where id = a.id;
  perform public._audit('assignment.funded', 'assignment', a.id::text, jsonb_build_object('total',total));
  return tx;
end $$;

create or replace function public.admin_publish_assignment(_assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.assignments;
begin
  perform public._require_staff(array['assignment_manager']::public.app_role[]);
  select * into a from public.assignments where id = _assignment for update;
  if a.status <> 'funded' then raise exception 'Only funded assignments can be published'; end if;
  if a.deadline <= now() then raise exception 'Deadline has already passed'; end if;
  update public.assignments set status = 'published' where id = a.id;
  perform public._audit('assignment.published', 'assignment', a.id::text, '{}');
end $$;

create or replace function public.admin_close_assignment(_assignment uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare a public.assignments; b public.assignment_budgets; committed numeric; refundable numeric;
begin
  perform public._require_staff(array['assignment_manager','finance_admin']::public.app_role[]);
  select * into a from public.assignments where id = _assignment for update;
  if a.status not in ('funded','published') then raise exception 'Assignment is not open'; end if;
  select * into b from public.assignment_budgets where assignment_id = a.id for update;
  select coalesce(count(*),0) * a.pay_usd into committed from public.assignment_claims
    where assignment_id = a.id and status in ('claimed','in_progress','submitted','under_review','revision_requested','disputed','approved');
  refundable := b.total_usd - b.released_usd - b.refunded_usd - committed;
  if refundable > 0 then
    perform public._post_txn('refund:' || a.id || ':' || (b.refunded_usd + refundable), 'assignment_refund', 'Unused budget returned: ' || a.title, 'assignment', a.id,
      jsonb_build_array(jsonb_build_object('account','ASSIGNMENT_ESCROW','debit',refundable), jsonb_build_object('account','FUNDING_POOL','credit',refundable)));
    update public.assignment_budgets set refunded_usd = refunded_usd + refundable where id = b.id;
  end if;
  update public.assignments set status = 'closed' where id = a.id;
  perform public._audit('assignment.closed', 'assignment', a.id::text, jsonb_build_object('refunded', greatest(refundable,0)));
  return greatest(refundable,0);
end $$;

create or replace function public.claim_assignment(_assignment uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a public.assignments; st public.account_status; claim uuid; ctry text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select account_status, country into st, ctry from public.profiles where id = uid;
  if st not in ('verified','active') then raise exception 'Complete email and profile verification before claiming assignments'; end if;
  select * into a from public.assignments where id = _assignment for update;
  if a.id is null or a.status <> 'published' then raise exception 'Assignment is not open for claims'; end if;
  if a.deadline <= now() then raise exception 'Assignment deadline has passed'; end if;
  if a.slots_claimed >= a.slots then raise exception 'All slots have been claimed'; end if;
  if coalesce(array_length(a.eligible_countries,1),0) > 0 and not (ctry = any(a.eligible_countries)) then raise exception 'This assignment is not available in your country'; end if;
  if exists (select 1 from public.assignment_claims where assignment_id = a.id and user_id = uid) then raise exception 'You have already claimed this assignment'; end if;
  insert into public.assignment_claims (assignment_id, user_id, status, due_at) values (a.id, uid, 'claimed', a.deadline) returning id into claim;
  update public.assignments set slots_claimed = slots_claimed + 1 where id = a.id;
  perform public._notify(uid, 'assignment', 'Assignment claimed', a.title, '/work');
  return claim;
end $$;

create or replace function public.start_claim(_claim uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.assignment_claims set status = 'in_progress', updated_at = now()
  where id = _claim and user_id = auth.uid() and status = 'claimed';
  if not found then raise exception 'Claim cannot be started'; end if;
end $$;

create or replace function public.abandon_claim(_claim uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.assignment_claims;
begin
  select * into c from public.assignment_claims where id = _claim and user_id = auth.uid() for update;
  if c.id is null or c.status not in ('claimed','in_progress','revision_requested') then raise exception 'Claim cannot be abandoned'; end if;
  update public.assignment_claims set status = 'abandoned', updated_at = now() where id = c.id;
  update public.assignments set slots_claimed = greatest(slots_claimed - 1, 0) where id = c.assignment_id;
end $$;

create or replace function public.submit_assignment(_claim uuid, _content text, _file_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.assignment_claims; a public.assignments; sub uuid;
begin
  select * into c from public.assignment_claims where id = _claim and user_id = auth.uid() for update;
  if c.id is null then raise exception 'Claim not found'; end if;
  if c.status not in ('claimed','in_progress','revision_requested') then raise exception 'This claim cannot accept a submission now'; end if;
  if c.due_at <= now() then raise exception 'The deadline has passed; submissions are closed'; end if;
  if char_length(coalesce(trim(_content),'')) < 1 then raise exception 'Submission content is required'; end if;
  if _file_path is not null and split_part(_file_path,'/',1) <> auth.uid()::text then raise exception 'Invalid file path'; end if;
  select * into a from public.assignments where id = c.assignment_id;
  insert into public.assignment_submissions (claim_id, user_id, content, file_path, revision_number)
  values (c.id, auth.uid(), _content, _file_path, c.revisions_used) returning id into sub;
  update public.assignment_claims set status = 'submitted', updated_at = now() where id = c.id;
  perform public._refresh_wallet(auth.uid());
  perform public._notify(auth.uid(), 'submission', 'Submission received', a.title || ' is awaiting review.', '/work');
  return sub;
end $$;

create or replace function public.review_submission(_submission uuid, _decision text, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
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
  if (select id from public.assignment_submissions where claim_id = c.id order by submitted_at desc limit 1) <> s.id then raise exception 'Only the latest submission can be reviewed'; end if;

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
    perform public._notify(c.user_id, 'submission', 'Submission rejected', a.title || ': ' || _reason || ' You can open a dispute from My Work.', '/work');
  end if;
  update public.assignment_disputes set status = case when _decision='approved' then 'upheld' else 'dismissed' end, resolution = coalesce(_reason,'Approved on review'), resolved_by = actor, resolved_at = now()
    where claim_id = c.id and status = 'open';
  perform public._refresh_wallet(c.user_id);
  perform public._audit('submission.reviewed', 'assignment_submission', s.id::text, jsonb_build_object('decision',_decision,'reason',_reason));
end $$;

create or replace function public.open_dispute(_claim uuid, _reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.assignment_claims; d uuid;
begin
  select * into c from public.assignment_claims where id = _claim and user_id = auth.uid() for update;
  if c.id is null or c.status <> 'rejected' then raise exception 'Only rejected submissions can be disputed'; end if;
  if char_length(coalesce(_reason,'')) < 10 then raise exception 'Please explain the dispute (at least 10 characters)'; end if;
  insert into public.assignment_disputes (claim_id, user_id, reason) values (c.id, auth.uid(), _reason) returning id into d;
  update public.assignment_claims set status = 'disputed', updated_at = now() where id = c.id;
  perform public._refresh_wallet(auth.uid());
  return d;
end $$;

create or replace function public.request_withdrawal(_method uuid, _amount numeric, _idempotency_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); st public.account_status; m public.withdrawal_methods; w public.wallets; prov public.payment_providers;
  minw numeric; maxw numeric; pct numeric; flat numeric; fee numeric; rate numeric; rate_src text; cur text; wid uuid; existing uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if char_length(coalesce(_idempotency_key,'')) < 8 then raise exception 'Invalid request key'; end if;
  select id into existing from public.withdrawal_requests where idempotency_key = _idempotency_key and user_id = uid;
  if existing is not null then return existing; end if;
  select account_status into st from public.profiles where id = uid;
  if st not in ('verified','active') then raise exception 'Your account must be verified to withdraw'; end if;
  if public._setting_bool('identity_required_for_withdrawal', true)
     and not exists (select 1 from public.user_verifications where user_id = uid and kind='identity' and status='approved') then
    raise exception 'Identity verification is required before withdrawing';
  end if;
  select * into m from public.withdrawal_methods where id = _method and user_id = uid;
  if m.id is null then raise exception 'Payment method not found'; end if;
  if m.ownership_status <> 'approved' then raise exception 'This payment method has not passed ownership verification'; end if;
  select * into prov from public.payment_providers where slug = m.provider;
  if prov.id is null or not prov.enabled then raise exception '% payouts are not currently enabled', coalesce(prov.name, m.provider); end if;
  minw := public._setting_num('min_withdrawal_usd', 5);
  maxw := public._setting_num('max_withdrawal_usd', 1000);
  _amount := round(_amount, 2);
  if _amount < minw then raise exception 'Minimum withdrawal is $% USD', minw; end if;
  if _amount > maxw then raise exception 'Maximum withdrawal per request is $% USD', maxw; end if;
  select * into w from public.wallets where user_id = uid for update;
  if public._account_balance('USER_AVAILABLE:' || uid) < _amount then raise exception 'Insufficient available balance'; end if;
  select coalesce(percent,0), coalesce(flat_usd,0) into pct, flat from public.platform_fees where kind='withdrawal' and provider = m.provider and active;
  fee := round(_amount * coalesce(pct,0) / 100 + coalesce(flat,0), 2);
  if fee >= _amount then raise exception 'Amount does not cover withdrawal fees'; end if;
  cur := prov.currency;
  if cur = 'USD' then rate := 1; rate_src := 'USD (no conversion)';
  else
    select r.rate, r.source into rate, rate_src from public.exchange_rates r where r.quote = cur and r.fetched_at > now() - interval '36 hours' order by r.fetched_at desc limit 1;
    if rate is null then raise exception 'No current documented USD/% exchange rate is available. Please try again shortly.', cur; end if;
  end if;
  insert into public.withdrawal_requests (user_id, method_id, provider, amount_usd, fee_usd, net_usd, local_currency, exchange_rate, exchange_rate_source,
    gross_local, fee_local, net_local, status, idempotency_key, scheduled_for)
  values (uid, m.id, m.provider, _amount, fee, _amount - fee, cur, rate, rate_src, round(_amount*rate,2), round(fee*rate,2), round((_amount-fee)*rate,2),
    'reserved', _idempotency_key, public.next_payout_time()) returning id into wid;
  perform public._post_txn('wd-reserve:' || wid, 'withdrawal_reserve', 'Withdrawal reserved', 'withdrawal', wid,
    jsonb_build_array(jsonb_build_object('account','USER_AVAILABLE:' || uid,'debit',_amount), jsonb_build_object('account','USER_RESERVED:' || uid,'credit',_amount)));
  perform public._refresh_wallet(uid);
  perform public._notify(uid, 'withdrawal', 'Withdrawal requested', '$' || _amount || ' USD will be processed on the next payout run (Saturday 8:00 PM EAT).', '/withdrawals');
  return wid;
end $$;

create or replace function public._release_withdrawal(_wid uuid, _status public.withdrawal_status, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare w public.withdrawal_requests;
begin
  select * into w from public.withdrawal_requests where id = _wid for update;
  if w.status not in ('reserved','on_hold') then raise exception 'Withdrawal can no longer be released'; end if;
  perform public._post_txn('wd-release:' || w.id, 'withdrawal_release', 'Withdrawal released back to balance', 'withdrawal', w.id,
    jsonb_build_array(jsonb_build_object('account','USER_RESERVED:' || w.user_id,'debit',w.amount_usd), jsonb_build_object('account','USER_AVAILABLE:' || w.user_id,'credit',w.amount_usd)));
  update public.withdrawal_requests set status = _status, failure_reason = _reason, updated_at = now() where id = w.id;
  perform public._refresh_wallet(w.user_id);
end $$;

create or replace function public.cancel_withdrawal(_wid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.withdrawal_requests where id = _wid and user_id = auth.uid()) then raise exception 'Not found'; end if;
  perform public._release_withdrawal(_wid, 'cancelled', 'Cancelled by user');
  perform public._notify(auth.uid(), 'withdrawal', 'Withdrawal cancelled', 'Funds returned to your available balance.', '/withdrawals');
end $$;

create or replace function public.admin_release_withdrawal(_wid uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  perform public._require_staff(array['finance_admin']::public.app_role[]);
  if char_length(coalesce(_reason,'')) < 3 then raise exception 'A reason is required'; end if;
  select user_id into uid from public.withdrawal_requests where id = _wid;
  perform public._release_withdrawal(_wid, 'cancelled', _reason);
  perform public._notify(uid, 'withdrawal', 'Withdrawal cancelled by finance', 'Funds returned to your balance. ' || _reason, '/withdrawals');
  perform public._audit('withdrawal.released', 'withdrawal_request', _wid::text, jsonb_build_object('reason',_reason));
end $$;

create or replace function public.create_payout_batch()
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid; batch uuid; w record; ok int := 0; total numeric := 0; reason text;
begin
  actor := public._require_staff(array['finance_admin']::public.app_role[]);
  insert into public.payout_batches (scheduled_for, created_by, status) values (now(), actor, 'processing') returning id into batch;
  for w in select r.id, r.user_id, r.amount_usd, r.net_usd, r.fee_usd, r.provider, p.account_status, m.ownership_status, pp.enabled as prov_enabled
           from public.withdrawal_requests r join public.profiles p on p.id = r.user_id
           join public.withdrawal_methods m on m.id = r.method_id
           left join public.payment_providers pp on pp.slug = r.provider
           where r.status in ('reserved','on_hold') and r.scheduled_for <= now() + interval '5 minutes'
           order by r.created_at for update of r skip locked loop
    reason := null;
    if w.account_status not in ('verified','active') then reason := 'Account status is ' || w.account_status;
    elsif w.ownership_status <> 'approved' then reason := 'Payment method ownership not verified';
    elsif not coalesce(w.prov_enabled,false) then reason := 'Payment provider disabled';
    elsif public._account_balance('USER_RESERVED:' || w.user_id) < w.amount_usd then reason := 'Reserved balance mismatch — sent to reconciliation';
    elsif exists (select 1 from public.payout_transactions t where t.withdrawal_id = w.id) then reason := 'Duplicate payout detected';
    end if;
    if reason is not null then
      update public.withdrawal_requests set status = 'on_hold', failure_reason = reason, updated_at = now() where id = w.id;
      continue;
    end if;
    perform public._post_txn('wd-submit:' || w.id, 'withdrawal_submit', 'Withdrawal moved to payout clearing', 'withdrawal', w.id,
      jsonb_build_array(
        jsonb_build_object('account','USER_RESERVED:' || w.user_id,'debit',w.amount_usd),
        jsonb_build_object('account','PAYOUT_CLEARING','credit',w.net_usd),
        jsonb_build_object('account','PLATFORM_REVENUE','credit',w.fee_usd)));
    insert into public.payout_transactions (batch_id, withdrawal_id, provider) values (batch, w.id, w.provider);
    update public.withdrawal_requests set status = 'batched', batch_id = batch, failure_reason = null, updated_at = now() where id = w.id;
    perform public._refresh_wallet(w.user_id);
    ok := ok + 1; total := total + w.amount_usd;
  end loop;
  update public.payout_batches set item_count = ok, total_usd = total, status = case when ok = 0 then 'completed' else 'awaiting_provider' end,
    completed_at = case when ok = 0 then now() end where id = batch;
  perform public._audit('payout.batch_created', 'payout_batch', batch::text, jsonb_build_object('items',ok,'total',total));
  return batch;
end $$;

create or replace function public.payout_mark_submitted(_payout uuid, _provider_request_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Server only'; end if;
  update public.payout_transactions set status = 'submitted', provider_request_id = _provider_request_id, submitted_at = now(), attempts = attempts + 1, last_error = null
  where id = _payout and status in ('pending','submitted');
  update public.withdrawal_requests set status = 'submitted', updated_at = now() where id = (select withdrawal_id from public.payout_transactions where id = _payout);
end $$;

create or replace function public.payout_mark_attempt_error(_payout uuid, _error text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Server only'; end if;
  update public.payout_transactions set attempts = attempts + 1, last_error = left(_error, 1000) where id = _payout and status = 'pending';
end $$;

create or replace function public.payout_confirm(_payout uuid, _receipt text, _payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t public.payout_transactions; w public.withdrawal_requests;
begin
  if auth.role() <> 'service_role' then raise exception 'Server only'; end if;
  select * into t from public.payout_transactions where id = _payout for update;
  if t.id is null then raise exception 'Payout not found'; end if;
  if t.status = 'confirmed' then return; end if;
  if t.status <> 'submitted' then raise exception 'Payout was not submitted to the provider'; end if;
  if char_length(coalesce(_receipt,'')) < 4 then raise exception 'Provider receipt required'; end if;
  select * into w from public.withdrawal_requests where id = t.withdrawal_id for update;
  perform public._post_txn('wd-paid:' || w.id, 'withdrawal_paid', 'Payout confirmed by provider', 'withdrawal', w.id,
    jsonb_build_array(jsonb_build_object('account','PAYOUT_CLEARING','debit',w.net_usd), jsonb_build_object('account','TREASURY','credit',w.net_usd)), _receipt);
  update public.payout_transactions set status = 'confirmed', provider_receipt = _receipt, callback_payload = _payload, confirmed_at = now() where id = t.id;
  update public.withdrawal_requests set status = 'paid', provider_reference = _receipt, updated_at = now() where id = w.id;
  perform public._refresh_wallet(w.user_id);
  perform public._notify(w.user_id, 'withdrawal', 'Withdrawal paid', w.net_local || ' ' || w.local_currency || ' sent. Reference ' || _receipt, '/withdrawals');
  update public.payout_batches b set status = 'completed', completed_at = now() where b.id = t.batch_id
    and not exists (select 1 from public.payout_transactions x where x.batch_id = b.id and x.status in ('pending','submitted'));
end $$;

create or replace function public.payout_fail(_payout uuid, _reason text, _payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t public.payout_transactions; w public.withdrawal_requests;
begin
  if auth.role() <> 'service_role' then perform public._require_staff(array['finance_admin']::public.app_role[]); end if;
  select * into t from public.payout_transactions where id = _payout for update;
  if t.id is null or t.status in ('confirmed','failed') then raise exception 'Payout is not in a failable state'; end if;
  select * into w from public.withdrawal_requests where id = t.withdrawal_id for update;
  perform public._post_txn('wd-reverse:' || w.id, 'withdrawal_reversal', 'Payout failed — funds returned', 'withdrawal', w.id,
    jsonb_build_array(
      jsonb_build_object('account','PAYOUT_CLEARING','debit',w.net_usd),
      jsonb_build_object('account','PLATFORM_REVENUE','debit',w.fee_usd),
      jsonb_build_object('account','USER_AVAILABLE:' || w.user_id,'credit',w.amount_usd)));
  update public.payout_transactions set status = 'failed', last_error = left(_reason,1000), callback_payload = _payload where id = t.id;
  update public.withdrawal_requests set status = 'failed', failure_reason = _reason, updated_at = now() where id = w.id;
  perform public._refresh_wallet(w.user_id);
  perform public._notify(w.user_id, 'withdrawal', 'Withdrawal failed', 'Funds were returned to your balance. Reason: ' || _reason, '/withdrawals');
  perform public._audit('payout.failed', 'payout_transaction', t.id::text, jsonb_build_object('reason',_reason));
  update public.payout_batches b set status = 'partial', completed_at = now() where b.id = t.batch_id
    and not exists (select 1 from public.payout_transactions x where x.batch_id = b.id and x.status in ('pending','submitted'));
end $$;

create or replace function public.admin_set_user_status(_user uuid, _status public.account_status, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff(array['operations_admin','compliance_admin']::public.app_role[]);
  if _user = auth.uid() then raise exception 'You cannot change your own status'; end if;
  if public.has_role(_user,'super_admin') then raise exception 'The Super Admin account status cannot be changed from the app'; end if;
  if char_length(coalesce(_reason,'')) < 3 then raise exception 'A reason is required'; end if;
  update public.profiles set account_status = _status, status_reason = _reason where id = _user;
  perform public._notify(_user, 'security', 'Account status updated', 'Your account status is now ' || replace(_status::text,'_',' ') || '. ' || _reason, '/verification');
  perform public._audit('user.status_changed', 'profile', _user::text, jsonb_build_object('status',_status,'reason',_reason));
end $$;

create or replace function public.admin_review_verification(_verification uuid, _status public.verification_status, _notes text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.user_verifications;
begin
  perform public._require_staff(array['compliance_admin']::public.app_role[]);
  select * into v from public.user_verifications where id = _verification for update;
  if v.id is null then raise exception 'Not found'; end if;
  if v.kind <> 'identity' then raise exception 'This verification is completed automatically or via payment method review'; end if;
  if _status not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  if v.user_id = auth.uid() then raise exception 'You cannot review your own verification'; end if;
  update public.user_verifications set status = _status, notes = _notes, reviewed_by = auth.uid(), reviewed_at = now() where id = v.id;
  perform public._notify(v.user_id, 'verification', 'Identity verification ' || _status, coalesce(_notes,''), '/verification');
  perform public._audit('verification.reviewed', 'user_verification', v.id::text, jsonb_build_object('status',_status,'kind',v.kind));
end $$;

create or replace function public.admin_review_method(_method uuid, _status public.verification_status, _notes text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.withdrawal_methods;
begin
  perform public._require_staff(array['compliance_admin','finance_admin']::public.app_role[]);
  select * into m from public.withdrawal_methods where id = _method for update;
  if m.id is null then raise exception 'Not found'; end if;
  if m.user_id = auth.uid() then raise exception 'You cannot verify your own payment method'; end if;
  if _status not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  update public.withdrawal_methods set ownership_status = _status, review_notes = _notes where id = m.id;
  if _status = 'approved' then
    update public.user_verifications set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where user_id = m.user_id and kind = 'payment_ownership';
  end if;
  perform public._notify(m.user_id, 'verification', 'Payment method ' || _status, m.label || coalesce(': ' || _notes,''), '/payment-methods');
  perform public._audit('payment_method.reviewed', 'withdrawal_method', m.id::text, jsonb_build_object('status',_status));
end $$;

create or replace function public._on_method_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.user_verifications set status = 'pending', submitted_at = now() where user_id = new.user_id and kind = 'payment_ownership' and status in ('not_started','rejected');
  return null;
end $$;
create trigger withdrawal_methods_after_insert after insert on public.withdrawal_methods for each row execute function public._on_method_insert();

create or replace function public.admin_grant_role(_user uuid, _role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff(array['super_admin']::public.app_role[]);
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'Only the Super Admin can appoint administrators'; end if;
  if _role = 'super_admin' then raise exception 'Super Admin cannot be granted from the app'; end if;
  insert into public.user_roles (user_id, role, granted_by) values (_user, _role, auth.uid()) on conflict do nothing;
  perform public._notify(_user, 'security', 'Role granted', 'You were granted the ' || replace(_role::text,'_',' ') || ' role. Multi-factor authentication is required to use it.', '/admin');
  perform public._audit('role.granted', 'profile', _user::text, jsonb_build_object('role',_role));
end $$;

create or replace function public.admin_revoke_role(_user uuid, _role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff(array['super_admin']::public.app_role[]);
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'Only the Super Admin can remove administrators'; end if;
  if _role in ('super_admin','user') then raise exception 'This role cannot be revoked from the app'; end if;
  delete from public.user_roles where user_id = _user and role = _role;
  perform public._audit('role.revoked', 'profile', _user::text, jsonb_build_object('role',_role));
end $$;

create or replace function public.admin_update_setting(_key text, _value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff(array['super_admin']::public.app_role[]);
  update public.system_settings set value = _value, updated_by = auth.uid(), updated_at = now() where key = _key;
  if not found then raise exception 'Unknown setting'; end if;
  perform public._audit('setting.updated', 'system_setting', _key, jsonb_build_object('value',_value));
end $$;

create or replace function public.admin_update_finance_setting(_key text, _value numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff(array['finance_admin']::public.app_role[]);
  if _key not in ('min_withdrawal_usd','max_withdrawal_usd') then raise exception 'Not a finance setting'; end if;
  if _value is null or _value <= 0 then raise exception 'Must be positive'; end if;
  update public.system_settings set value = to_jsonb(_value), updated_by = auth.uid(), updated_at = now() where key = _key;
  perform public._audit('setting.updated', 'system_setting', _key, jsonb_build_object('value',_value));
end $$;

create or replace function public.admin_set_fee(_kind text, _provider text, _percent numeric, _flat numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff(array['finance_admin']::public.app_role[]);
  update public.platform_fees set percent = _percent, flat_usd = _flat, updated_by = auth.uid(), updated_at = now()
  where kind = _kind and provider is not distinct from _provider;
  if not found then insert into public.platform_fees (kind, provider, percent, flat_usd, updated_by) values (_kind, _provider, _percent, _flat, auth.uid()); end if;
  perform public._audit('fee.updated', 'platform_fee', _kind || ':' || coalesce(_provider,'*'), jsonb_build_object('percent',_percent,'flat',_flat));
end $$;

create or replace function public.admin_broadcast(_title text, _body text, _link text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._require_staff(array['operations_admin','support_admin']::public.app_role[]);
  if char_length(coalesce(_title,'')) < 3 then raise exception 'Title required'; end if;
  insert into public.notifications (user_id, type, title, body, link) select id, 'announcement', _title, _body, _link from public.profiles where account_status <> 'closed';
  get diagnostics n = row_count;
  perform public._audit('notification.broadcast', 'notification', null, jsonb_build_object('title',_title,'recipients',n));
  return n;
end $$;

create or replace function public.admin_reconciliation()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  perform public._require_staff(array['finance_admin']::public.app_role[]);
  select jsonb_build_object(
    'total_debits', (select coalesce(sum(debit),0) from public.ledger_entries),
    'total_credits', (select coalesce(sum(credit),0) from public.ledger_entries),
    'treasury', public._account_balance('TREASURY'),
    'funding_pool', public._account_balance('FUNDING_POOL'),
    'assignment_escrow', public._account_balance('ASSIGNMENT_ESCROW'),
    'payout_clearing', public._account_balance('PAYOUT_CLEARING'),
    'platform_revenue', public._account_balance('PLATFORM_REVENUE'),
    'user_available_total', (select coalesce(sum(e.credit - e.debit),0) from public.ledger_entries e join public.ledger_accounts a on a.id=e.account_id where a.code like 'USER_AVAILABLE:%'),
    'user_reserved_total', (select coalesce(sum(e.credit - e.debit),0) from public.ledger_entries e join public.ledger_accounts a on a.id=e.account_id where a.code like 'USER_RESERVED:%'),
    'wallet_mismatches', (select count(*) from public.wallets w where w.available_usd <> public._account_balance('USER_AVAILABLE:' || w.user_id) or w.reserved_usd <> public._account_balance('USER_RESERVED:' || w.user_id)),
    'escrow_vs_budgets', (select coalesce(sum(total_usd - released_usd - refunded_usd),0) from public.assignment_budgets),
    'unconfirmed_payouts', (select count(*) from public.payout_transactions where status in ('pending','submitted')),
    'checked_at', now()
  ) into res;
  return res;
end $$;

revoke execute on function public._post_txn(text,text,text,text,uuid,jsonb,text) from public, anon, authenticated;
revoke execute on function public._refresh_wallet(uuid) from public, anon, authenticated;
revoke execute on function public._ensure_user_accounts(uuid) from public, anon, authenticated;
revoke execute on function public._release_withdrawal(uuid, public.withdrawal_status, text) from public, anon, authenticated;
revoke execute on function public._notify(uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public._audit(text,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public._recompute_status(uuid) from public, anon, authenticated;
revoke execute on function public._profile_completion(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_confirmed() from public, anon, authenticated;
revoke execute on function public.payout_mark_submitted(uuid,text) from public, anon, authenticated;
revoke execute on function public.payout_mark_attempt_error(uuid,text) from public, anon, authenticated;
revoke execute on function public.payout_confirm(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.payout_mark_submitted(uuid,text) to service_role;
grant execute on function public.payout_mark_attempt_error(uuid,text) to service_role;
grant execute on function public.payout_confirm(uuid,text,jsonb) to service_role;
grant execute on function public._refresh_wallet(uuid) to service_role;

insert into public.ledger_accounts (code, name, type) values
  ('TREASURY','Platform treasury (cash held with providers/banks)','asset'),
  ('FUNDING_POOL','Unallocated funding (deposits not yet reserved)','equity'),
  ('ASSIGNMENT_ESCROW','Reserved assignment budgets','liability'),
  ('PAYOUT_CLEARING','Payouts submitted, awaiting provider confirmation','liability'),
  ('PLATFORM_REVENUE','Platform fees and commissions','revenue');

insert into public.job_sources (slug, name, kind, website, requires_credentials, credential_names, enabled, attribution) values
  ('himalayas','Himalayas','api','https://himalayas.app',false,'{}',true,'Jobs via Himalayas'),
  ('jobicy','Jobicy','feed','https://jobicy.com',false,'{}',true,'Jobs via Jobicy'),
  ('remoteok','Remote OK','feed','https://remoteok.com',false,'{}',true,'Jobs via Remote OK'),
  ('adzuna','Adzuna','api','https://www.adzuna.com',true,'{ADZUNA_APP_ID,ADZUNA_APP_KEY}',true,'Jobs by Adzuna'),
  ('jooble','Jooble','api','https://jooble.org',true,'{JOOBLE_API_KEY}',true,'Jobs via Jooble'),
  ('direct','Direct employers','direct',null,false,'{}',true,'Posted directly on HANDSHAKE');

insert into public.payment_providers (slug, name, purpose, currency, countries, enabled, required_secrets, notes) values
  ('mpesa','M-Pesa (Safaricom Daraja B2C)','payout','KES','{Kenya}',true,'{MPESA_CONSUMER_KEY,MPESA_CONSUMER_SECRET,MPESA_SHORTCODE,MPESA_INITIATOR_NAME,MPESA_SECURITY_CREDENTIAL,MPESA_CALLBACK_TOKEN}','Requires an approved Daraja B2C organisation shortcode.'),
  ('bank','Bank transfer','payout','USD','{}',false,'{}','Requires an authorised payout partner before enabling.'),
  ('paypal','PayPal Payouts','payout','USD','{}',false,'{PAYPAL_CLIENT_ID,PAYPAL_CLIENT_SECRET}','Requires PayPal Payouts approval.');

insert into public.system_settings (key, value, description, is_public) values
  ('min_withdrawal_usd','5','Minimum withdrawal amount in USD',true),
  ('max_withdrawal_usd','1000','Maximum withdrawal per request in USD',true),
  ('payout_schedule','"Every Saturday at 8:00 PM East Africa Time (UTC+3)"','Payout schedule shown to users',true),
  ('identity_required_for_withdrawal','true','Require approved identity verification before withdrawals',true),
  ('maintenance_mode','false','When true, users see a maintenance notice',true),
  ('maintenance_message','"HANDSHAKE is undergoing scheduled maintenance."','Message shown during maintenance',true),
  ('job_sync_interval_hours','6','Hours between automatic job synchronisations',true);

insert into public.platform_fees (kind, provider, percent, flat_usd) values
  ('withdrawal','mpesa',0,0), ('withdrawal','bank',0,0), ('withdrawal','paypal',0,0), ('assignment_commission',null,0,0);

create policy "Users upload own documents" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users read own documents" on storage.objects for select to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own documents" on storage.objects for delete to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Staff read documents" on storage.objects for select to authenticated using (bucket_id = 'documents' and public.staff_has(array['compliance_admin','assignment_manager']::public.app_role[]));
