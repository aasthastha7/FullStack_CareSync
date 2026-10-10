-- ============================================================
-- CareSync database schema
-- ============================================================
-- Target: Supabase PostgreSQL
--
-- Contents:
--   1. Tables (CREATE TABLE IF NOT EXISTS)
--   2. Triggers (auth.users signup trigger + staff update guard)
--   3. Row Level Security policies
--   4. Table privileges
--
-- Idempotent: safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------

-- Profiles: one row per Supabase Auth user (id = auth.users.id)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  role        text,
  employee_id text,
  region      text,
  created_at  timestamptz not null default now()
);

-- Prevent duplicate email addresses across profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_email_unique'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_unique UNIQUE (email);
  END IF;
END $$;

-- Shifts
create table if not exists public.shifts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  patient_name  text not null,
  start_time    time not null,
  end_time      time not null,
  address       text,
  task          text,
  duration      text,
  priority      text,
  shift_date    date not null,
  checked_in_at timestamptz,
  status        text not null default 'scheduled' check (status in ('scheduled', 'submitted')),
  created_at    timestamptz not null default now()
);
create index if not exists shifts_user_id_idx on public.shifts (user_id);
create index if not exists shifts_shift_date_idx on public.shifts (shift_date);

-- In case the table was created by an older schema.sql without created_at
alter table public.shifts
  add column if not exists created_at timestamptz not null default now();

-- Tasks on a shift
create table if not exists public.shift_tasks (
  id              uuid primary key default gen_random_uuid(),
  shift_id        uuid not null references public.shifts (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  label           text not null,
  medication_note text,
  done            boolean not null default false
);
create index if not exists shift_tasks_shift_id_idx on public.shift_tasks (shift_id);
create index if not exists shift_tasks_user_id_idx on public.shift_tasks (user_id);

-- Vitals / notes report for a shift (one per shift)
create table if not exists public.shift_reports (
  id           uuid primary key default gen_random_uuid(),
  shift_id     uuid not null unique references public.shifts (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  temp_f       numeric,
  pulse_bpm    integer,
  bp           text,
  notes        text,
  status       text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz
);
create index if not exists shift_reports_user_id_idx on public.shift_reports (user_id);

-- Mood check-ins
create table if not exists public.mood_checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  mood       text not null check (mood in ('Rough', 'Okay', 'Good', 'Great')),
  created_at timestamptz not null default now()
);
create index if not exists mood_checkins_user_id_idx on public.mood_checkins (user_id);

-- Wellbeing / support requests
create table if not exists public.support_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  request_type text not null check (request_type in ('mental_health_day', 'shift_swap', 'fatigue', 'injury')),
  note         text,
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);
create index if not exists support_requests_user_id_idx on public.support_requests (user_id);

-- Alerts / notifications
create table if not exists public.alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  icon       text,
  title      text not null,
  body       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists alerts_user_id_idx on public.alerts (user_id);

-- Staff directory (readable by every logged-in user; contact details editable)
create table if not exists public.staff (
  id                  text primary key,
  name                text not null,
  role                text,
  employee_id         text unique,
  email               text,
  phone               text,
  date_joined         text,
  employment_type     text,
  supervisor          text,
  last_activity       text,
  last_login          text,
  patients_attended   integer not null default 0,
  current_status      text,
  total_tasks         integer not null default 0,
  average_time        text,
  completion_rate     text,
  present_days        integer not null default 0,
  absent_days         integer not null default 0,
  late_days           integer not null default 0,
  present_percent     numeric not null default 0,
  punctuality_percent numeric not null default 0
);

-- Staff attendance history
create table if not exists public.staff_attendance (
  id        uuid primary key default gen_random_uuid(),
  staff_id  text not null references public.staff (id) on delete cascade,
  work_date date not null,
  status    text not null check (status in ('Present', 'Late', 'Absent')),
  unique (staff_id, work_date)
);
create index if not exists staff_attendance_staff_id_idx on public.staff_attendance (staff_id);

-- Chat messages between a caregiver and a colleague (staff member)
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  staff_id   text not null references public.staff (id) on delete cascade,
  sender     text not null check (sender in ('caregiver', 'colleague')),
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_id_idx on public.chat_messages (user_id);
create index if not exists chat_messages_staff_id_idx on public.chat_messages (staff_id);

-- ------------------------------------------------------------
-- 2. TRIGGERS
-- ------------------------------------------------------------

-- 2a. On signup: create the profile + starter demo data
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id uuid;
begin
  -- Profile linked to the Supabase Auth user id
  insert into public.profiles (id, full_name, email, role, employee_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'caregiver'),
    new.raw_user_meta_data ->> 'employee_id'
  )
  on conflict (id) do nothing;

  -- Starter demo shift: Eleanor Smith, 7:00 AM - 3:00 PM
  insert into public.shifts (
    user_id, patient_name, start_time, end_time, address,
    task, duration, priority, shift_date, status
  )
  values (
    new.id,
    'Eleanor Smith',
    time '07:00:00',
    time '15:00:00',
    '142 Maple Drive',
    'Personal Care',
    '2 hrs',
    'High',
    current_date,
    'scheduled'
  )
  returning id into v_shift_id;

  -- Starter tasks for the shift
  insert into public.shift_tasks (shift_id, user_id, label, medication_note, done)
  values
    (v_shift_id, new.id, 'Check Blood Pressure', null, false),
    (v_shift_id, new.id, 'Administer Morning Meds', 'Lisinopril 10mg, Aspirin 81mg', false)
  on conflict do nothing;

  -- Empty draft report for the shift
  insert into public.shift_reports (shift_id, user_id, status)
  values (v_shift_id, new.id, 'draft')
  on conflict (shift_id) do nothing;

  -- Starter alerts
  insert into public.alerts (user_id, icon, title, body, is_read)
  values
    (new.id, 'calendar', 'Schedule Updated', 'Your schedule has been updated. Please review your upcoming shifts.', false),
    (new.id, 'medication', 'Medication Reminder', 'Remember to administer the morning medication for Eleanor Smith.', false),
    (new.id, 'supplies', 'Supplies Restocked', 'Care supplies have been restocked and are ready for collection.', false)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2b. Staff: only contact details (email, phone) may be updated
create or replace function public.protect_staff_contact_details()
returns trigger
language plpgsql
as $$
begin
  if new.id                     is distinct from old.id
     or new.name                is distinct from old.name
     or new.role                is distinct from old.role
     or new.employee_id         is distinct from old.employee_id
     or new.date_joined         is distinct from old.date_joined
     or new.employment_type     is distinct from old.employment_type
     or new.supervisor          is distinct from old.supervisor
     or new.last_activity       is distinct from old.last_activity
     or new.last_login          is distinct from old.last_login
     or new.patients_attended   is distinct from old.patients_attended
     or new.current_status      is distinct from old.current_status
     or new.total_tasks         is distinct from old.total_tasks
     or new.average_time        is distinct from old.average_time
     or new.completion_rate     is distinct from old.completion_rate
     or new.present_days        is distinct from old.present_days
     or new.absent_days         is distinct from old.absent_days
     or new.late_days           is distinct from old.late_days
     or new.present_percent     is distinct from old.present_percent
     or new.punctuality_percent is distinct from old.punctuality_percent
  then
    raise exception 'Only staff contact details (email, phone) can be updated';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_contact_details_only on public.staff;
create trigger staff_contact_details_only
  before update on public.staff
  for each row execute function public.protect_staff_contact_details();

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Every table gets RLS. Users only touch their own rows
-- (auth.uid() = user_id, or = id for profiles).
-- staff / staff_attendance are a shared directory for logged-in users.
-- "drop policy if exists" + "create policy" keeps this file idempotent.

-- profiles ----------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- shifts ------------------------------------------------------
alter table public.shifts enable row level security;

drop policy if exists "shifts_select_own" on public.shifts;
create policy "shifts_select_own" on public.shifts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "shifts_insert_own" on public.shifts;
create policy "shifts_insert_own" on public.shifts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "shifts_update_own" on public.shifts;
create policy "shifts_update_own" on public.shifts
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shifts_delete_own" on public.shifts;
create policy "shifts_delete_own" on public.shifts
  for delete to authenticated using (auth.uid() = user_id);

-- shift_tasks -------------------------------------------------
alter table public.shift_tasks enable row level security;

drop policy if exists "shift_tasks_select_own" on public.shift_tasks;
create policy "shift_tasks_select_own" on public.shift_tasks
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "shift_tasks_insert_own" on public.shift_tasks;
create policy "shift_tasks_insert_own" on public.shift_tasks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "shift_tasks_update_own" on public.shift_tasks;
create policy "shift_tasks_update_own" on public.shift_tasks
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shift_tasks_delete_own" on public.shift_tasks;
create policy "shift_tasks_delete_own" on public.shift_tasks
  for delete to authenticated using (auth.uid() = user_id);

-- shift_reports ------------------------------------------------
alter table public.shift_reports enable row level security;

drop policy if exists "shift_reports_select_own" on public.shift_reports;
create policy "shift_reports_select_own" on public.shift_reports
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "shift_reports_insert_own" on public.shift_reports;
create policy "shift_reports_insert_own" on public.shift_reports
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "shift_reports_update_own" on public.shift_reports;
create policy "shift_reports_update_own" on public.shift_reports
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shift_reports_delete_own" on public.shift_reports;
create policy "shift_reports_delete_own" on public.shift_reports
  for delete to authenticated using (auth.uid() = user_id);

-- mood_checkins -----------------------------------------------
alter table public.mood_checkins enable row level security;

drop policy if exists "mood_checkins_select_own" on public.mood_checkins;
create policy "mood_checkins_select_own" on public.mood_checkins
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "mood_checkins_insert_own" on public.mood_checkins;
create policy "mood_checkins_insert_own" on public.mood_checkins
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "mood_checkins_update_own" on public.mood_checkins;
create policy "mood_checkins_update_own" on public.mood_checkins
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mood_checkins_delete_own" on public.mood_checkins;
create policy "mood_checkins_delete_own" on public.mood_checkins
  for delete to authenticated using (auth.uid() = user_id);

-- support_requests --------------------------------------------
alter table public.support_requests enable row level security;

drop policy if exists "support_requests_select_own" on public.support_requests;
create policy "support_requests_select_own" on public.support_requests
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "support_requests_insert_own" on public.support_requests;
create policy "support_requests_insert_own" on public.support_requests
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "support_requests_update_own" on public.support_requests;
create policy "support_requests_update_own" on public.support_requests
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "support_requests_delete_own" on public.support_requests;
create policy "support_requests_delete_own" on public.support_requests
  for delete to authenticated using (auth.uid() = user_id);

-- alerts ------------------------------------------------------
alter table public.alerts enable row level security;

drop policy if exists "alerts_select_own" on public.alerts;
create policy "alerts_select_own" on public.alerts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "alerts_insert_own" on public.alerts;
create policy "alerts_insert_own" on public.alerts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "alerts_update_own" on public.alerts;
create policy "alerts_update_own" on public.alerts
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "alerts_delete_own" on public.alerts;
create policy "alerts_delete_own" on public.alerts
  for delete to authenticated using (auth.uid() = user_id);

-- chat_messages ------------------------------------------------
alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own" on public.chat_messages
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages
  for delete to authenticated using (auth.uid() = user_id);

-- staff --------------------------------------------------------
-- Readable by any logged-in user; contact details editable by any
-- logged-in user (enforced by the staff_contact_details_only trigger).
alter table public.staff enable row level security;

drop policy if exists "staff_select_all" on public.staff;
create policy "staff_select_all" on public.staff
  for select to authenticated
  using (true);

drop policy if exists "staff_update_contact" on public.staff;
create policy "staff_update_contact" on public.staff
  for update to authenticated
  using (true)
  with check (true);

-- staff_attendance ----------------------------------------------
-- Read-only for logged-in users.
alter table public.staff_attendance enable row level security;

drop policy if exists "staff_attendance_select_all" on public.staff_attendance;
create policy "staff_attendance_select_all" on public.staff_attendance
  for select to authenticated
  using (true);

-- ------------------------------------------------------------
-- 4. PRIVILEGES
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  public.profiles,
  public.shifts,
  public.shift_tasks,
  public.shift_reports,
  public.mood_checkins,
  public.support_requests,
  public.alerts,
  public.chat_messages
  to authenticated, service_role;

-- staff directory: logged-in users can read and edit contact details
grant select, update on public.staff to authenticated;
grant select on public.staff_attendance to authenticated;

-- the service role (and the backend) manages staff + attendance rows
grant select, insert, update, delete on public.staff, public.staff_attendance to service_role;

-- Done.