
-- ============ ENUMS ============
create type public.app_role as enum ('super_admin','operations_admin','job_manager','assignment_manager','finance_admin','support_admin','compliance_admin','client','user');
create type public.account_status as enum ('registered','email_pending','verification_pending','verified','active','restricted','suspended','under_review','closed');
create type public.verification_kind as enum ('email','phone','profile','identity','payment_ownership');
create type public.verification_status as enum ('not_started','pending','approved','rejected');
create type public.job_status as enum ('active','expired','pending_review','rejected','removed');
create type public.assignment_status as enum ('draft','funded','published','closed','cancelled');
create type public.claim_status as enum ('claimed','in_progress','submitted','under_review','revision_requested','approved','rejected','credited','abandoned','disputed','expired');
create type public.withdrawal_status as enum ('requested','reserved','on_hold','batched','submitted','paid','failed','cancelled','reversed');

-- ============ PROFILES & ROLES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  middle_name text,
  last_name text not null default '',
  username text unique,
  email text not null,
  phone text,
  country text,
  headline text,
  bio text,
  avatar_url text,
  referral_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  referred_by uuid,
  account_status public.account_status not null default 'email_pending',
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,30}$')
);
grant select on public.profiles to authenticated;
grant update (first_name, middle_name, last_name, username, phone, country, headline, bio, avatar_url) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- current user has any of the given staff roles (super_admin always passes) AND has completed MFA (aal2)
create or replace function public.staff_has(_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
    and exists (select 1 from public.user_roles where user_id = auth.uid()
                and (role = 'super_admin' or role = any(_roles)))
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id
    and role in ('super_admin','operations_admin','job_manager','assignment_manager','finance_admin','support_admin','compliance_admin'))
$$;

create or replace function public._require_staff(_roles public.app_role[])
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if auth.role() = 'service_role' then return null; end if;
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.user_roles where user_id = uid and (role = 'super_admin' or role = any(_roles))) then
    raise exception 'Not authorized for this action';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Multi-factor authentication required for administrator actions';
  end if;
  return uid;
end $$;

create policy "Users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Staff read profiles" on public.profiles for select to authenticated using (public.staff_has(array['operations_admin','support_admin','compliance_admin','finance_admin','assignment_manager']::public.app_role[]));
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Super admin reads roles" on public.user_roles for select to authenticated using (public.staff_has(array['super_admin']::public.app_role[]));

create or replace function public.username_available(_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(_username))
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ============ VERIFICATIONS, SKILLS, EXPERIENCE, DOCUMENTS, SESSIONS ============
create table public.user_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.verification_kind not null,
  status public.verification_status not null default 'not_started',
  document_path text,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);
grant select on public.user_verifications to authenticated;
grant all on public.user_verifications to service_role;
alter table public.user_verifications enable row level security;
create policy "Own verifications" on public.user_verifications for select to authenticated using (user_id = auth.uid());
create policy "Compliance reads verifications" on public.user_verifications for select to authenticated using (public.staff_has(array['compliance_admin','operations_admin']::public.app_role[]));

create table public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null check (char_length(skill) between 1 and 60),
  level text not null default 'intermediate' check (level in ('beginner','intermediate','advanced','expert')),
  years int not null default 0 check (years between 0 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, skill)
);
grant select, insert, update, delete on public.user_skills to authenticated;
grant all on public.user_skills to service_role;
alter table public.user_skills enable row level security;
create policy "Own skills" on public.user_skills for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Staff read skills" on public.user_skills for select to authenticated using (public.staff_has(array['operations_admin','assignment_manager','support_admin']::public.app_role[]));

create table public.user_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  company text not null check (char_length(company) between 1 and 120),
  start_date date,
  end_date date,
  description text check (char_length(description) <= 2000),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_experience to authenticated;
grant all on public.user_experience to service_role;
alter table public.user_experience enable row level security;
create policy "Own experience" on public.user_experience for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('cv','identity','portfolio','payment_proof','other')),
  title text not null check (char_length(title) between 1 and 150),
  file_path text,
  url text check (url is null or url ~ '^https?://'),
  mime_type text,
  size_bytes int check (size_bytes is null or size_bytes <= 10485760),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.user_documents to authenticated;
grant all on public.user_documents to service_role;
alter table public.user_documents enable row level security;
create policy "Own documents" on public.user_documents for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Compliance reads documents" on public.user_documents for select to authenticated using (public.staff_has(array['compliance_admin']::public.app_role[]));

create table public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null default 'sign_in',
  user_agent text,
  ip_address text,
  country text,
  suspicious boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.user_sessions (user_id, created_at desc);
grant select on public.user_sessions to authenticated;
grant all on public.user_sessions to service_role;
alter table public.user_sessions enable row level security;
create policy "Own sessions" on public.user_sessions for select to authenticated using (user_id = auth.uid());
create policy "Staff read sessions" on public.user_sessions for select to authenticated using (public.staff_has(array['operations_admin','compliance_admin','support_admin']::public.app_role[]));

-- ============ JOBS ============
create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  kind text not null check (kind in ('api','feed','direct')),
  website text,
  requires_credentials boolean not null default false,
  credential_names text[] not null default '{}',
  enabled boolean not null default true,
  attribution text,
  last_sync_at timestamptz,
  last_status text not null default 'never_synced',
  last_error text,
  active_jobs int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.job_sources to anon, authenticated;
grant update on public.job_sources to authenticated;
grant all on public.job_sources to service_role;
alter table public.job_sources enable row level security;
create policy "Anyone reads sources" on public.job_sources for select to anon, authenticated using (true);
create policy "Job managers update sources" on public.job_sources for update to authenticated using (public.staff_has(array['job_manager','operations_admin']::public.app_role[])) with check (public.staff_has(array['job_manager','operations_admin']::public.app_role[]));

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.job_sources(id) on delete cascade,
  external_id text not null,
  title text not null,
  employer text not null,
  employer_logo text,
  description text not null,
  excerpt text,
  responsibilities text,
  requirements text,
  location text not null default 'Remote',
  eligible_countries text[] not null default '{}',
  is_remote boolean not null default true,
  worldwide boolean not null default false,
  employment_type text,
  category text not null default 'other',
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_period text,
  skills text[] not null default '{}',
  deadline timestamptz,
  published_at timestamptz,
  apply_url text not null check (apply_url ~ '^https?://'),
  source_url text,
  last_verified_at timestamptz not null default now(),
  status public.job_status not null default 'active',
  is_verified boolean not null default false,
  dedupe_hash text not null,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);
create index jobs_status_pub_idx on public.jobs (status, published_at desc);
create index jobs_category_idx on public.jobs (category);
create index jobs_dedupe_idx on public.jobs (dedupe_hash);
grant select on public.jobs to anon, authenticated;
grant insert, update on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "Public reads active jobs" on public.jobs for select to anon, authenticated using (status = 'active');
create policy "Job managers read all jobs" on public.jobs for select to authenticated using (public.staff_has(array['job_manager','operations_admin']::public.app_role[]));
create policy "Job managers insert jobs" on public.jobs for insert to authenticated with check (public.staff_has(array['job_manager']::public.app_role[]));
create policy "Job managers update jobs" on public.jobs for update to authenticated using (public.staff_has(array['job_manager']::public.app_role[])) with check (public.staff_has(array['job_manager']::public.app_role[]));

create table public.job_sync_logs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.job_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  fetched int not null default 0,
  upserted int not null default 0,
  duplicates int not null default 0,
  invalid int not null default 0,
  expired int not null default 0,
  error text
);
create index on public.job_sync_logs (source_id, started_at desc);
grant select on public.job_sync_logs to authenticated;
grant all on public.job_sync_logs to service_role;
alter table public.job_sync_logs enable row level security;
create policy "Job managers read sync logs" on public.job_sync_logs for select to authenticated using (public.staff_has(array['job_manager','operations_admin']::public.app_role[]));

create table public.saved_jobs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
grant select, insert, delete on public.saved_jobs to authenticated;
grant all on public.saved_jobs to service_role;
alter table public.saved_jobs enable row level security;
create policy "Own saved jobs" on public.saved_jobs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied','interviewing','offer','rejected','withdrawn')),
  notes text check (char_length(notes) <= 2000),
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);
grant select, insert, update, delete on public.job_applications to authenticated;
grant all on public.job_applications to service_role;
alter table public.job_applications enable row level security;
create policy "Own applications" on public.job_applications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Staff read applications" on public.job_applications for select to authenticated using (public.staff_has(array['job_manager','operations_admin']::public.app_role[]));

create table public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  unique (job_id, user_id)
);
grant select, insert on public.job_reports to authenticated;
grant update on public.job_reports to authenticated;
grant all on public.job_reports to service_role;
alter table public.job_reports enable row level security;
create policy "Users report jobs" on public.job_reports for insert to authenticated with check (user_id = auth.uid());
create policy "Users read own reports" on public.job_reports for select to authenticated using (user_id = auth.uid());
create policy "Job managers manage reports" on public.job_reports for select to authenticated using (public.staff_has(array['job_manager']::public.app_role[]));
create policy "Job managers update reports" on public.job_reports for update to authenticated using (public.staff_has(array['job_manager']::public.app_role[])) with check (public.staff_has(array['job_manager']::public.app_role[]));

-- ============ EMPLOYERS ============
create table public.employer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 2 and 150),
  website text check (website is null or website ~ '^https?://'),
  country text,
  description text check (char_length(description) <= 2000),
  billing_email text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert on public.employer_profiles to authenticated;
grant update (company_name, website, country, description, billing_email) on public.employer_profiles to authenticated;
grant all on public.employer_profiles to service_role;
alter table public.employer_profiles enable row level security;
create policy "Owner manages employer" on public.employer_profiles for select to authenticated using (owner_id = auth.uid());
create policy "Owner inserts employer" on public.employer_profiles for insert to authenticated with check (owner_id = auth.uid() and verified = false);
create policy "Owner updates employer" on public.employer_profiles for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Staff read employers" on public.employer_profiles for select to authenticated using (public.staff_has(array['operations_admin','compliance_admin','assignment_manager','finance_admin']::public.app_role[]));

create table public.employer_verifications (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  status public.verification_status not null default 'pending',
  document_path text,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert on public.employer_verifications to authenticated;
grant all on public.employer_verifications to service_role;
alter table public.employer_verifications enable row level security;
create policy "Owner employer verifications" on public.employer_verifications for select to authenticated using (exists (select 1 from public.employer_profiles e where e.id = employer_id and e.owner_id = auth.uid()));
create policy "Owner submits employer verification" on public.employer_verifications for insert to authenticated with check (status = 'pending' and exists (select 1 from public.employer_profiles e where e.id = employer_id and e.owner_id = auth.uid()));
create policy "Compliance reads employer verifications" on public.employer_verifications for select to authenticated using (public.staff_has(array['compliance_admin']::public.app_role[]));

-- ============ ASSIGNMENTS ============
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references public.employer_profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 5 and 150),
  description text not null check (char_length(description) between 20 and 5000),
  instructions text not null check (char_length(instructions) between 10 and 8000),
  required_skills text[] not null default '{}',
  category text not null default 'other',
  pay_usd numeric(12,2) not null check (pay_usd > 0 and pay_usd <= 10000),
  slots int not null check (slots between 1 and 10000),
  slots_claimed int not null default 0 check (slots_claimed >= 0),
  deadline timestamptz not null,
  estimated_minutes int not null check (estimated_minutes between 1 and 100000),
  deliverables text not null,
  review_requirements text,
  revision_policy text,
  max_revisions int not null default 1 check (max_revisions between 0 and 10),
  eligibility text,
  eligible_countries text[] not null default '{}',
  status public.assignment_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slots_within check (slots_claimed <= slots)
);
create index on public.assignments (status, deadline);
grant select, insert, update on public.assignments to authenticated;
grant all on public.assignments to service_role;
alter table public.assignments enable row level security;
create policy "Users read published assignments" on public.assignments for select to authenticated using (status in ('published','closed'));
create policy "Client reads own assignments" on public.assignments for select to authenticated using (exists (select 1 from public.employer_profiles e where e.id = employer_id and e.owner_id = auth.uid()));
create policy "Managers read assignments" on public.assignments for select to authenticated using (public.staff_has(array['assignment_manager','finance_admin','operations_admin']::public.app_role[]));
create policy "Client creates draft" on public.assignments for insert to authenticated with check (status = 'draft' and created_by = auth.uid() and exists (select 1 from public.employer_profiles e where e.id = employer_id and e.owner_id = auth.uid()));
create policy "Manager creates draft" on public.assignments for insert to authenticated with check (status = 'draft' and created_by = auth.uid() and public.staff_has(array['assignment_manager']::public.app_role[]));
create policy "Client edits own draft" on public.assignments for update to authenticated using (status = 'draft' and exists (select 1 from public.employer_profiles e where e.id = employer_id and e.owner_id = auth.uid())) with check (status = 'draft');
create policy "Manager edits drafts" on public.assignments for update to authenticated using (status = 'draft' and public.staff_has(array['assignment_manager']::public.app_role[])) with check (status = 'draft');

create table public.assignment_budgets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments(id) on delete restrict,
  total_usd numeric(14,2) not null check (total_usd > 0),
  released_usd numeric(14,2) not null default 0 check (released_usd >= 0),
  refunded_usd numeric(14,2) not null default 0 check (refunded_usd >= 0),
  funding_transaction_id uuid,
  funded_by uuid,
  funded_at timestamptz not null default now(),
  constraint budget_consistency check (released_usd + refunded_usd <= total_usd)
);
grant select on public.assignment_budgets to authenticated;
grant all on public.assignment_budgets to service_role;
alter table public.assignment_budgets enable row level security;
create policy "Anyone signed in reads budgets of visible assignments" on public.assignment_budgets for select to authenticated using (exists (select 1 from public.assignments a where a.id = assignment_id));

create table public.assignment_claims (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.claim_status not null default 'claimed',
  revisions_used int not null default 0,
  claimed_at timestamptz not null default now(),
  due_at timestamptz not null,
  credited_at timestamptz,
  credit_transaction_id uuid,
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);
create index on public.assignment_claims (user_id, status);
grant select on public.assignment_claims to authenticated;
grant all on public.assignment_claims to service_role;
alter table public.assignment_claims enable row level security;
create policy "Own claims" on public.assignment_claims for select to authenticated using (user_id = auth.uid());
create policy "Client reads claims" on public.assignment_claims for select to authenticated using (exists (select 1 from public.assignments a join public.employer_profiles e on e.id = a.employer_id where a.id = assignment_id and e.owner_id = auth.uid()));
create policy "Managers read claims" on public.assignment_claims for select to authenticated using (public.staff_has(array['assignment_manager','finance_admin']::public.app_role[]));

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.assignment_claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 20000),
  file_path text,
  revision_number int not null default 0,
  submitted_at timestamptz not null default now()
);
grant select on public.assignment_submissions to authenticated;
grant all on public.assignment_submissions to service_role;
alter table public.assignment_submissions enable row level security;
create policy "Own submissions" on public.assignment_submissions for select to authenticated using (user_id = auth.uid());
create policy "Client reads submissions" on public.assignment_submissions for select to authenticated using (exists (select 1 from public.assignment_claims c join public.assignments a on a.id = c.assignment_id join public.employer_profiles e on e.id = a.employer_id where c.id = claim_id and e.owner_id = auth.uid()));
create policy "Managers read submissions" on public.assignment_submissions for select to authenticated using (public.staff_has(array['assignment_manager']::public.app_role[]));

create table public.submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  reviewer_id uuid not null,
  decision text not null check (decision in ('approved','revision_requested','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  constraint reason_required check (decision = 'approved' or char_length(coalesce(reason,'')) >= 5)
);
grant select on public.submission_reviews to authenticated;
grant all on public.submission_reviews to service_role;
alter table public.submission_reviews enable row level security;
create policy "Read reviews of own submissions" on public.submission_reviews for select to authenticated using (exists (select 1 from public.assignment_submissions s where s.id = submission_id and s.user_id = auth.uid()));
create policy "Managers read reviews" on public.submission_reviews for select to authenticated using (public.staff_has(array['assignment_manager']::public.app_role[]));
create policy "Client reads reviews" on public.submission_reviews for select to authenticated using (reviewer_id = auth.uid());

create table public.assignment_disputes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.assignment_claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 3000),
  status text not null default 'open' check (status in ('open','upheld','dismissed')),
  resolution text,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select on public.assignment_disputes to authenticated;
grant all on public.assignment_disputes to service_role;
alter table public.assignment_disputes enable row level security;
create policy "Own disputes" on public.assignment_disputes for select to authenticated using (user_id = auth.uid());
create policy "Managers read disputes" on public.assignment_disputes for select to authenticated using (public.staff_has(array['assignment_manager','compliance_admin']::public.app_role[]));

-- ============ LEDGER & WALLETS ============
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  currency text not null default 'USD' check (currency = 'USD'),
  available_usd numeric(14,2) not null default 0,
  pending_usd numeric(14,2) not null default 0,
  reserved_usd numeric(14,2) not null default 0,
  total_earned_usd numeric(14,2) not null default 0,
  total_withdrawn_usd numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint wallet_non_negative check (available_usd >= 0 and reserved_usd >= 0)
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "Own wallet" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "Finance reads wallets" on public.wallets for select to authenticated using (public.staff_has(array['finance_admin']::public.app_role[]));

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','revenue','expense')),
  user_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
grant select on public.ledger_accounts to authenticated;
grant all on public.ledger_accounts to service_role;
alter table public.ledger_accounts enable row level security;
create policy "Own ledger accounts" on public.ledger_accounts for select to authenticated using (user_id = auth.uid());
create policy "Finance reads ledger accounts" on public.ledger_accounts for select to authenticated using (public.staff_has(array['finance_admin']::public.app_role[]));

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text unique not null,
  kind text not null check (kind in ('treasury_deposit','assignment_funding','assignment_earning','assignment_refund','withdrawal_reserve','withdrawal_release','withdrawal_submit','withdrawal_paid','withdrawal_reversal','platform_fee','adjustment')),
  description text not null,
  reference_type text,
  reference_id uuid,
  external_reference text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.ledger_transactions (reference_type, reference_id);
grant select on public.ledger_transactions to authenticated;
grant all on public.ledger_transactions to service_role;
alter table public.ledger_transactions enable row level security;

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  constraint one_sided check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create index on public.ledger_entries (account_id);
create index on public.ledger_entries (transaction_id);
grant select on public.ledger_entries to authenticated;
grant all on public.ledger_entries to service_role;
alter table public.ledger_entries enable row level security;
create policy "Own ledger entries" on public.ledger_entries for select to authenticated using (exists (select 1 from public.ledger_accounts a where a.id = account_id and a.user_id = auth.uid()));
create policy "Finance reads entries" on public.ledger_entries for select to authenticated using (public.staff_has(array['finance_admin']::public.app_role[]));
create policy "Own ledger transactions" on public.ledger_transactions for select to authenticated using (exists (select 1 from public.ledger_entries e join public.ledger_accounts a on a.id = e.account_id where e.transaction_id = ledger_transactions.id and a.user_id = auth.uid()));
create policy "Finance reads transactions" on public.ledger_transactions for select to authenticated using (public.staff_has(array['finance_admin']::public.app_role[]));

create or replace function public._ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'Ledger records are immutable'; end $$;
create trigger ledger_tx_immutable before update or delete on public.ledger_transactions for each row execute function public._ledger_immutable();
create trigger ledger_entries_immutable before update or delete on public.ledger_entries for each row execute function public._ledger_immutable();

create or replace function public._ledger_balanced() returns trigger language plpgsql as $$
declare d numeric; c numeric;
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c from public.ledger_entries where transaction_id = new.transaction_id;
  if d <> c then raise exception 'Unbalanced ledger transaction % (debits %, credits %)', new.transaction_id, d, c; end if;
  return null;
end $$;
create constraint trigger ledger_entries_balanced after insert on public.ledger_entries deferrable initially deferred for each row execute function public._ledger_balanced();

-- ============ PAYMENTS ============
create table public.payment_providers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  purpose text not null check (purpose in ('payout','funding')),
  currency text not null,
  countries text[] not null default '{}',
  enabled boolean not null default false,
  connection_status text not null default 'not_connected' check (connection_status in ('not_connected','sandbox','live','error')),
  required_secrets text[] not null default '{}',
  last_checked_at timestamptz,
  last_error text,
  notes text,
  created_at timestamptz not null default now()
);
grant select on public.payment_providers to authenticated;
grant update (enabled, notes) on public.payment_providers to authenticated;
grant all on public.payment_providers to service_role;
alter table public.payment_providers enable row level security;
create policy "Signed in reads providers" on public.payment_providers for select to authenticated using (true);
create policy "Finance updates providers" on public.payment_providers for update to authenticated using (public.staff_has(array['finance_admin']::public.app_role[])) with check (public.staff_has(array['finance_admin']::public.app_role[]));

create table public.withdrawal_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('mpesa','bank','paypal')),
  label text not null,
  account_name text not null check (char_length(account_name) between 2 and 120),
  phone text check (phone is null or phone ~ '^\+?[0-9]{9,15}$'),
  account_number text,
  bank_name text,
  bank_code text,
  email text,
  country text not null,
  ownership_status public.verification_status not null default 'pending',
  review_notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint mpesa_phone check (provider <> 'mpesa' or phone ~ '^(\+?254|0)?[17][0-9]{8}$')
);
grant select, insert, delete on public.withdrawal_methods to authenticated;
grant update (is_default, label) on public.withdrawal_methods to authenticated;
grant all on public.withdrawal_methods to service_role;
alter table public.withdrawal_methods enable row level security;
create policy "Own methods" on public.withdrawal_methods for select to authenticated using (user_id = auth.uid());
create policy "Insert own methods" on public.withdrawal_methods for insert to authenticated with check (user_id = auth.uid() and ownership_status = 'pending');
create policy "Update own methods" on public.withdrawal_methods for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Delete own methods" on public.withdrawal_methods for delete to authenticated using (user_id = auth.uid());
create policy "Compliance reads methods" on public.withdrawal_methods for select to authenticated using (public.staff_has(array['compliance_admin','finance_admin']::public.app_role[]));

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base text not null default 'USD',
  quote text not null,
  rate numeric(18,6) not null check (rate > 0),
  source text not null,
  source_timestamp timestamptz,
  fetched_at timestamptz not null default now()
);
create index on public.exchange_rates (quote, fetched_at desc);
grant select on public.exchange_rates to authenticated;
grant all on public.exchange_rates to service_role;
alter table public.exchange_rates enable row level security;
create policy "Signed in reads rates" on public.exchange_rates for select to authenticated using (true);

create table public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  scheduled_for timestamptz not null,
  status text not null default 'processing' check (status in ('processing','awaiting_provider','completed','partial','failed')),
  total_usd numeric(14,2) not null default 0,
  item_count int not null default 0,
  created_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
grant select on public.payout_batches to authenticated;
grant all on public.payout_batches to service_role;
alter table public.payout_batches enable row level security;
create policy "Finance reads batches" on public.payout_batches for select to authenticated using (public.staff_has(array['finance_admin']::public.app_role[]));

create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  method_id uuid not null references public.withdrawal_methods(id) on delete restrict,
  provider text not null,
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  fee_usd numeric(14,2) not null default 0 check (fee_usd >= 0),
  net_usd numeric(14,2) not null check (net_usd > 0),
  local_currency text not null default 'USD',
  exchange_rate numeric(18,6) not null default 1,
  exchange_rate_source text,
  gross_local numeric(16,2) not null,
  fee_local numeric(16,2) not null default 0,
  net_local numeric(16,2) not null,
  status public.withdrawal_status not null default 'reserved',
  idempotency_key text unique not null,
  scheduled_for timestamptz not null,
  batch_id uuid references public.payout_batches(id),
  provider_reference text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_within check (fee_usd < amount_usd)
);
create index on public.withdrawal_requests (status, scheduled_for);
create index on public.withdrawal_requests (user_id, created_at desc);
grant select on public.withdrawal_requests to authenticated;
grant all on public.withdrawal_requests to service_role;
alter table public.withdrawal_requests enable row level security;
create policy "Own withdrawals" on public.withdrawal_requests for select to authenticated using (user_id = auth.uid());
create policy "Finance reads withdrawals" on public.withdrawal_requests for select to authenticated using (public.staff_has(array['finance_admin']::public.app_role[]));

create table public.payout_transactions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payout_batches(id) on delete restrict,
  withdrawal_id uuid not null unique references public.withdrawal_requests(id) on delete restrict,
  provider text not null,
  status text not null default 'pending' check (status in ('pending','submitted','confirmed','failed')),
  attempts int not null default 0,
  provider_request_id text,
  provider_receipt text,
  last_error text,
  callback_payload jsonb,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.payout_transactions (provider_request_id);
grant select on public.payout_transactions to authenticated;
grant all on public.payout_transactions to service_role;
alter table public.payout_transactions enable row level security;
create policy "Finance reads payouts" on public.payout_transactions for select to authenticated using (public.staff_has(array['finance_admin']::public.app_role[]));

-- ============ NOTIFICATIONS, SUPPORT, AUDIT, SETTINGS ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Mark own read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Delete own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 150),
  category text not null default 'general' check (category in ('general','account','verification','jobs','assignments','wallet','withdrawal','security','report','appeal')),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  staff_response text,
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.support_tickets to authenticated;
grant update (status, priority, staff_response, assigned_to, updated_at) on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "Own tickets" on public.support_tickets for select to authenticated using (user_id = auth.uid());
create policy "Create own tickets" on public.support_tickets for insert to authenticated with check (user_id = auth.uid() and status = 'open' and staff_response is null);
create policy "Support reads tickets" on public.support_tickets for select to authenticated using (public.staff_has(array['support_admin','operations_admin','compliance_admin']::public.app_role[]));
create policy "Support updates tickets" on public.support_tickets for update to authenticated using (public.staff_has(array['support_admin','operations_admin']::public.app_role[])) with check (public.staff_has(array['support_admin','operations_admin']::public.app_role[]));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "Compliance reads audit" on public.audit_logs for select to authenticated using (public.staff_has(array['compliance_admin','operations_admin']::public.app_role[]));
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function public._ledger_immutable();

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select on public.system_settings to anon, authenticated;
grant all on public.system_settings to service_role;
alter table public.system_settings enable row level security;
create policy "Read public settings" on public.system_settings for select to anon, authenticated using (is_public);
create policy "Super reads all settings" on public.system_settings for select to authenticated using (public.staff_has(array['super_admin']::public.app_role[]));

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null,
  invited_by uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
grant select on public.admin_invitations to authenticated;
grant all on public.admin_invitations to service_role;
alter table public.admin_invitations enable row level security;
create policy "Super reads invitations" on public.admin_invitations for select to authenticated using (public.staff_has(array['super_admin']::public.app_role[]));

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'registered',
  created_at timestamptz not null default now()
);
grant select on public.referrals to authenticated;
grant all on public.referrals to service_role;
alter table public.referrals enable row level security;
create policy "Own referrals" on public.referrals for select to authenticated using (referrer_id = auth.uid() or referred_id = auth.uid());

create table public.platform_fees (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('withdrawal','assignment_commission')),
  provider text,
  percent numeric(6,3) not null default 0 check (percent >= 0 and percent < 50),
  flat_usd numeric(10,2) not null default 0 check (flat_usd >= 0),
  active boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (kind, provider)
);
grant select on public.platform_fees to authenticated;
grant all on public.platform_fees to service_role;
alter table public.platform_fees enable row level security;
create policy "Signed in reads fees" on public.platform_fees for select to authenticated using (true);
