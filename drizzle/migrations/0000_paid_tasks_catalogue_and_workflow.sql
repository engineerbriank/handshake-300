-- Task catalogue -------------------------------------------------------------
create table public.task_categories (
  slug text primary key,
  name text not null,
  description text,
  kind text not null default 'other' check (kind in ('research','writing','testing','design','data','media','support','other')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.task_categories to authenticated;
grant all on public.task_categories to service_role;
alter table public.task_categories enable row level security;
create policy "Signed-in users read task categories" on public.task_categories for select to authenticated using (true);

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category_slug text not null references public.task_categories(slug),
  title text not null check (char_length(title) between 5 and 140),
  summary text not null,
  description text not null,
  instructions text not null,
  deliverables text not null,
  verification_checklist text[] not null default '{}',
  submission_types text[] not null default '{text}',
  required_skills text[] not null default '{}',
  difficulty text not null check (difficulty in ('very_simple','basic','standard','intermediate','advanced','specialized','expert')),
  suggested_pay_usd numeric(10,2) not null check (suggested_pay_usd > 0),
  estimated_minutes integer not null check (estimated_minutes > 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists task_templates_category_idx on public.task_templates (category_slug, status);
grant select, insert, update on public.task_templates to authenticated;
grant all on public.task_templates to service_role;
alter table public.task_templates enable row level security;
create policy "Task managers read templates" on public.task_templates for select to authenticated
  using (public.staff_has(array['assignment_manager','finance_admin']::public.app_role[]));
create policy "Task managers add templates" on public.task_templates for insert to authenticated
  with check (public.staff_has(array['assignment_manager']::public.app_role[]));
create policy "Task managers edit templates" on public.task_templates for update to authenticated
  using (public.staff_has(array['assignment_manager']::public.app_role[]))
  with check (public.staff_has(array['assignment_manager']::public.app_role[]));

create table public.task_admin_settings (
  difficulty text primary key check (difficulty in ('very_simple','basic','standard','intermediate','advanced','specialized','expert')),
  label text not null,
  default_pay_usd numeric(10,2) not null check (default_pay_usd > 0),
  sort_order integer not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select, update on public.task_admin_settings to authenticated;
grant all on public.task_admin_settings to service_role;
alter table public.task_admin_settings enable row level security;
create policy "Signed-in users read pay rates" on public.task_admin_settings for select to authenticated using (true);
create policy "Finance or task managers edit pay rates" on public.task_admin_settings for update to authenticated
  using (public.staff_has(array['assignment_manager','finance_admin']::public.app_role[]))
  with check (public.staff_has(array['assignment_manager','finance_admin']::public.app_role[]));

create table public.task_app_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  publisher text,
  category text not null,
  package_id text unique,
  play_store_url text,
  website_url text,
  supported_countries text[],
  listing_available boolean not null default true,
  last_verified_at timestamptz,
  client_authorized boolean not null default false,
  testing_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists task_app_directory_category_idx on public.task_app_directory (category);
grant select, insert, update on public.task_app_directory to authenticated;
grant all on public.task_app_directory to service_role;
alter table public.task_app_directory enable row level security;
create policy "Signed-in users read app directory" on public.task_app_directory for select to authenticated using (true);
create policy "Task managers add apps" on public.task_app_directory for insert to authenticated
  with check (public.staff_has(array['assignment_manager']::public.app_role[]));
create policy "Task managers edit apps" on public.task_app_directory for update to authenticated
  using (public.staff_has(array['assignment_manager']::public.app_role[]))
  with check (public.staff_has(array['assignment_manager']::public.app_role[]));

-- Task metadata on funded work items -------------------------------------------
alter table public.assignments
  add column template_id uuid references public.task_templates(id),
  add column difficulty text check (difficulty in ('very_simple','basic','standard','intermediate','advanced','specialized','expert')),
  add column sponsor_type text not null default 'platform' check (sponsor_type in ('platform','client','business')),
  add column sponsor_name text not null default 'Handshake',
  add column submission_types text[] not null default '{text}',
  add column verification_checklist text[] not null default '{}',
  add column review_days integer not null default 5 check (review_days between 1 and 30),
  add column publish_at timestamptz,
  add column paused boolean not null default false,
  add column app_id uuid references public.task_app_directory(id);
create index if not exists assignments_template_idx on public.assignments (template_id);

alter table public.assignment_submissions
  add column attachments text[] not null default '{}',
  add column links text[] not null default '{}',
  add column content_hash text;
create index if not exists assignment_submissions_hash_idx on public.assignment_submissions (content_hash);

alter table public.assignment_claims add column deadline_notified_at timestamptz;

-- Audit template and pay-rate edits ------------------------------------------
create or replace function public._audit_task_catalogue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  perform public._audit(tg_table_name || '.' || lower(tg_op), tg_table_name,
    case when tg_table_name = 'task_admin_settings' then to_jsonb(new)->>'difficulty' else to_jsonb(new)->>'id' end,
    jsonb_build_object('new', to_jsonb(new)) || case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old)) else '{}'::jsonb end);
  return new;
end $$;
create trigger task_templates_audit before insert or update on public.task_templates for each row execute function public._audit_task_catalogue();
create trigger task_admin_settings_audit before update on public.task_admin_settings for each row execute function public._audit_task_catalogue();

-- Create a draft task from a template ------------------------------------------
create or replace function public.admin_create_task_from_template(
  _template uuid, _pay numeric, _slots integer, _deadline timestamptz,
  _sponsor_type text default 'platform', _sponsor_name text default 'Handshake', _employer uuid default null,
  _publish_at timestamptz default null, _app uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid; t public.task_templates; aid uuid;
begin
  actor := public._require_staff(array['assignment_manager']::public.app_role[]);
  select * into t from public.task_templates where id = _template;
  if t.id is null then raise exception 'Template not found'; end if;
  if t.status <> 'active' then raise exception 'Only active templates can be used to create tasks'; end if;
  if _pay is null or _pay <= 0 then raise exception 'Payment must be greater than zero'; end if;
  if _slots is null or _slots < 1 or _slots > 10000 then raise exception 'Participant limit must be between 1 and 10000'; end if;
  if _deadline is null or _deadline <= now() + interval '1 hour' then raise exception 'Deadline must be at least one hour away'; end if;
  if _sponsor_type not in ('platform','client','business') then raise exception 'Invalid funding source'; end if;
  if _sponsor_type <> 'platform' and char_length(coalesce(trim(_sponsor_name),'')) < 2 then raise exception 'Name the sponsoring client or business'; end if;
  if _sponsor_type = 'client' and _employer is null then raise exception 'Select the client account funding this task'; end if;
  insert into public.assignments (employer_id, created_by, title, description, instructions, required_skills, category, pay_usd, slots, deadline,
    estimated_minutes, deliverables, review_requirements, max_revisions, status, template_id, difficulty, sponsor_type, sponsor_name,
    submission_types, verification_checklist, publish_at, app_id)
  values (_employer, coalesce(actor, (select user_id from public.user_roles where role = 'super_admin' limit 1)), t.title,
    t.description, t.instructions, t.required_skills, t.category_slug, round(_pay, 2), _slots, _deadline,
    t.estimated_minutes, t.deliverables, array_to_string(t.verification_checklist, E'\n'), 1, 'draft', t.id, t.difficulty,
    _sponsor_type, case when _sponsor_type = 'platform' then 'Handshake' else trim(_sponsor_name) end,
    t.submission_types, t.verification_checklist, _publish_at, _app)
  returning id into aid;
  perform public._audit('task.created_from_template', 'assignment', aid::text, jsonb_build_object('template', t.code, 'pay', _pay, 'slots', _slots));
  return aid;
end $$;

-- Fund a task, optionally reducing slots to what available funds fully cover ---
create or replace function public.admin_fund_task(_assignment uuid, _idempotency_key text, _fit_to_funds boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.assignments; pool numeric; affordable integer; tx uuid; original integer;
begin
  perform public._require_staff(array['finance_admin']::public.app_role[]);
  select * into a from public.assignments where id = _assignment for update;
  if a.id is null then raise exception 'Task not found'; end if;
  if a.status <> 'draft' then raise exception 'Only draft tasks can be funded'; end if;
  original := a.slots;
  pool := public._account_balance('FUNDING_POOL');
  if pool < a.pay_usd * a.slots then
    affordable := floor(pool / a.pay_usd)::integer;
    if not _fit_to_funds then
      raise exception 'Insufficient unallocated funds: % available, % required for % slots (enough for % slots)', pool, a.pay_usd * a.slots, a.slots, affordable;
    end if;
    if affordable < 1 then raise exception 'Unallocated funds (%) do not cover even one paid slot', pool; end if;
    update public.assignments set slots = affordable where id = a.id;
  end if;
  tx := public.admin_fund_assignment(a.id, _idempotency_key);
  select * into a from public.assignments where id = _assignment;
  return jsonb_build_object('transaction', tx, 'slots', a.slots, 'requested_slots', original, 'reserved_usd', a.pay_usd * a.slots);
end $$;

-- Pause / resume a published task --------------------------------------------
create or replace function public.admin_set_task_paused(_assignment uuid, _paused boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff(array['assignment_manager']::public.app_role[]);
  update public.assignments set paused = _paused, updated_at = now() where id = _assignment and status in ('funded','published');
  if not found then raise exception 'Only funded or published tasks can be paused'; end if;
  perform public._audit(case when _paused then 'task.paused' else 'task.resumed' end, 'assignment', _assignment::text, '{}');
end $$;

-- Edit task text without touching accepted payment terms -----------------------
create or replace function public.admin_update_task_details(_assignment uuid, _instructions text, _deliverables text, _checklist text[], _deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare a public.assignments;
begin
  perform public._require_staff(array['assignment_manager']::public.app_role[]);
  select * into a from public.assignments where id = _assignment for update;
  if a.id is null then raise exception 'Task not found'; end if;
  if char_length(coalesce(trim(_instructions),'')) < 20 then raise exception 'Instructions are too short'; end if;
  if _deadline < a.deadline and exists (select 1 from public.assignment_claims where assignment_id = a.id) then
    raise exception 'The deadline cannot be shortened after users have accepted the task';
  end if;
  update public.assignments set instructions = trim(_instructions), deliverables = coalesce(nullif(trim(_deliverables),''), deliverables),
    verification_checklist = coalesce(_checklist, verification_checklist), review_requirements = array_to_string(coalesce(_checklist, verification_checklist), E'\n'),
    deadline = _deadline, updated_at = now() where id = a.id;
  perform public._audit('task.details_updated', 'assignment', a.id::text,
    jsonb_build_object('old_deadline', a.deadline, 'new_deadline', _deadline, 'old_instructions', a.instructions));
end $$;

-- Claiming: respect pause, schedule, claim limits ------------------------------
create or replace function public.claim_assignment(_assignment uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a public.assignments; st public.account_status; claim uuid; ctry text; active_count int; today_count int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select account_status, country into st, ctry from public.profiles where id = uid;
  if st not in ('verified','active') then raise exception 'Complete email and profile verification before claiming tasks'; end if;
  select * into a from public.assignments where id = _assignment for update;
  if a.id is null or a.status <> 'published' then raise exception 'This task is not open for claims'; end if;
  if a.paused then raise exception 'This task is paused'; end if;
  if a.publish_at is not null and a.publish_at > now() then raise exception 'This task is not open yet'; end if;
  if a.deadline <= now() then raise exception 'The task deadline has passed'; end if;
  if a.slots_claimed >= a.slots then raise exception 'All funded slots have been claimed'; end if;
  if coalesce(array_length(a.eligible_countries,1),0) > 0 and not (ctry = any(a.eligible_countries)) then raise exception 'This task is not available in your country'; end if;
  if exists (select 1 from public.assignment_claims where assignment_id = a.id and user_id = uid) then raise exception 'You have already accepted this task'; end if;
  select count(*) into active_count from public.assignment_claims where user_id = uid and status in ('claimed','in_progress','revision_requested');
  if active_count >= public._setting_num('max_active_task_claims', 5) then raise exception 'Finish or abandon your current tasks before accepting more (limit %)', public._setting_num('max_active_task_claims', 5); end if;
  select count(*) into today_count from public.assignment_claims where user_id = uid and claimed_at > now() - interval '24 hours';
  if today_count >= public._setting_num('max_daily_task_claims', 20) then raise exception 'Daily task limit reached. Try again tomorrow.'; end if;
  insert into public.assignment_claims (assignment_id, user_id, status, due_at) values (a.id, uid, 'claimed', a.deadline) returning id into claim;
  update public.assignments set slots_claimed = slots_claimed + 1 where id = a.id;
  perform public._notify(uid, 'assignment', 'Task accepted', a.title || ' — $' || a.pay_usd || ' USD after approval. Due ' || to_char(a.deadline at time zone 'Africa/Nairobi', 'DD Mon YYYY HH24:MI') || ' EAT.', '/work');
  return claim;
end $$;

-- Submitting: evidence checks and duplicate detection -------------------------
create or replace function public.submit_task(_claim uuid, _content text, _attachments text[] default '{}', _links text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.assignment_claims; a public.assignments; sub uuid; h text; p text; l text; recent int;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into c from public.assignment_claims where id = _claim and user_id = uid for update;
  if c.id is null then raise exception 'Task not found'; end if;
  if c.status not in ('claimed','in_progress','revision_requested') then raise exception 'This task cannot accept a submission now'; end if;
  if c.due_at <= now() then raise exception 'The deadline has passed; submissions are closed'; end if;
  select * into a from public.assignments where id = c.assignment_id;
  _attachments := coalesce(_attachments, '{}'); _links := coalesce(_links, '{}');
  if char_length(coalesce(trim(_content),'')) < 20 then raise exception 'Describe your work in at least 20 characters'; end if;
  if char_length(_content) > 20000 then raise exception 'Submission text is too long'; end if;
  if coalesce(array_length(_attachments,1),0) > 10 or coalesce(array_length(_links,1),0) > 10 then raise exception 'Up to 10 files and 10 links per submission'; end if;
  foreach p in array _attachments loop
    if split_part(p,'/',1) <> uid::text then raise exception 'Invalid file reference'; end if;
  end loop;
  foreach l in array _links loop
    if l !~* '^https://[^\s/$.?#].[^\s]*$' then raise exception 'Links must be valid https:// addresses: %', l; end if;
  end loop;
  if a.submission_types && array['file','image','spreadsheet','document','audio','video'] and coalesce(array_length(_attachments,1),0) = 0 then
    raise exception 'This task requires at least one uploaded file';
  end if;
  if 'url' = any(a.submission_types) and coalesce(array_length(_links,1),0) = 0 then raise exception 'This task requires at least one link'; end if;
  select count(*) into recent from public.assignment_submissions where user_id = uid and submitted_at > now() - interval '1 minute';
  if recent >= 3 then raise exception 'Too many submissions in a short time. Please wait a minute.'; end if;
  h := md5(lower(regexp_replace(trim(_content), '\s+', ' ', 'g')) || '|' || array_to_string(_links, ','));
  if exists (select 1 from public.assignment_submissions s join public.assignment_claims oc on oc.id = s.claim_id
             where oc.assignment_id = a.id and s.user_id <> uid and s.content_hash = h) then
    raise exception 'This submission duplicates another participant''s work';
  end if;
  if exists (select 1 from public.assignment_submissions where claim_id = c.id and content_hash = h) then
    raise exception 'This is identical to your previous submission. Update your work before resubmitting.';
  end if;
  insert into public.assignment_submissions (claim_id, user_id, content, file_path, revision_number, attachments, links, content_hash)
  values (c.id, uid, trim(_content), _attachments[1], c.revisions_used, _attachments, _links, h) returning id into sub;
  update public.assignment_claims set status = 'submitted', updated_at = now() where id = c.id;
  perform public._refresh_wallet(uid);
  perform public._notify(uid, 'submission', 'Submission received', a.title || ' is waiting for review (usually within ' || a.review_days || ' days). $' || a.pay_usd || ' shows as pending until approved.', '/work');
  return sub;
end $$;

-- Mark a submission under review --------------------------------------------
create or replace function public.admin_start_review(_submission uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.assignment_submissions; a public.assignments;
begin
  perform public._require_staff(array['assignment_manager']::public.app_role[]);
  select * into s from public.assignment_submissions where id = _submission;
  if s.id is null then raise exception 'Submission not found'; end if;
  if s.user_id = auth.uid() then raise exception 'You cannot review your own submission'; end if;
  update public.assignment_claims set status = 'under_review', updated_at = now() where id = s.claim_id and status = 'submitted';
  if found then
    select a2.* into a from public.assignments a2 join public.assignment_claims c on c.assignment_id = a2.id where c.id = s.claim_id;
    perform public._notify(s.user_id, 'submission', 'Submission under review', a.title || ' is being reviewed.', '/work');
  end if;
end $$;

-- Deadline reminders (called by the scheduled job) ----------------------------
create or replace function public.notify_task_deadlines()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  for r in select c.id, c.user_id, a.title, c.due_at from public.assignment_claims c join public.assignments a on a.id = c.assignment_id
           where c.status in ('claimed','in_progress','revision_requested') and c.deadline_notified_at is null
             and c.due_at between now() and now() + interval '24 hours' loop
    perform public._notify(r.user_id, 'assignment', 'Task deadline approaching', r.title || ' is due ' || to_char(r.due_at at time zone 'Africa/Nairobi', 'DD Mon HH24:MI') || ' EAT.', '/work');
    update public.assignment_claims set deadline_notified_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.notify_task_deadlines() from public, anon, authenticated;
grant execute on function public.notify_task_deadlines() to service_role;

-- New suitable task alerts on publish ----------------------------------------
create or replace function public._notify_task_published()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.notifications (user_id, type, title, body, link)
    select distinct s.user_id, 'assignment', 'New task matches your skills',
      new.title || ' — $' || new.pay_usd || ' USD, ' || (new.slots - new.slots_claimed) || ' funded slots.', '/assignments/' || new.id
    from public.user_skills s join public.profiles p on p.id = s.user_id
    where lower(s.skill) = any(select lower(x) from unnest(new.required_skills) x)
      and p.account_status in ('verified','active')
      and (coalesce(array_length(new.eligible_countries,1),0) = 0 or p.country = any(new.eligible_countries))
    limit 1000;
  end if;
  return new;
end $$;
create trigger assignments_notify_published after update of status on public.assignments for each row execute function public._notify_task_published();

revoke execute on function public.admin_create_task_from_template(uuid, numeric, integer, timestamptz, text, text, uuid, timestamptz, uuid) from public, anon;
revoke execute on function public.admin_fund_task(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_set_task_paused(uuid, boolean) from public, anon;
revoke execute on function public.admin_update_task_details(uuid, text, text, text[], timestamptz) from public, anon;
revoke execute on function public.submit_task(uuid, text, text[], text[]) from public, anon;
revoke execute on function public.admin_start_review(uuid) from public, anon;
grant execute on function public.admin_create_task_from_template(uuid, numeric, integer, timestamptz, text, text, uuid, timestamptz, uuid) to authenticated;
grant execute on function public.admin_fund_task(uuid, text, boolean) to authenticated;
grant execute on function public.admin_set_task_paused(uuid, boolean) to authenticated;
grant execute on function public.admin_update_task_details(uuid, text, text, text[], timestamptz) to authenticated;
grant execute on function public.submit_task(uuid, text, text[], text[]) to authenticated;
grant execute on function public.admin_start_review(uuid) to authenticated;