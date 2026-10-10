-- ============================================================
-- Migration 003: Signup improvements
-- ============================================================
-- Purpose:
--   1. Add a UNIQUE constraint on profiles.email so duplicate
--      sign-ups are caught at the database level.
--   2. Make the handle_new_user() trigger idempotent: if the
--      trigger fires twice (e.g. a retry) the second run is a
--      harmless no-op instead of raising a duplicate-key error.
--
-- How to run:
--   Paste this entire file into the Supabase SQL Editor and
--   click "Run".  It is safe to run more than once (idempotent).
--
-- Does NOT drop or delete any existing data.
-- ============================================================

-- 1. Unique constraint on email ----------------------------------------
--    Prevents two profiles from sharing the same email address.
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

-- 2. Replace the trigger function with an idempotent version -----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id uuid;
begin
  -- Profile: skip silently if the row already exists
  insert into public.profiles (id, full_name, email, role, employee_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'caregiver'),
    new.raw_user_meta_data ->> 'employee_id'
  )
  on conflict (id) do nothing;

  -- Starter demo shift: Eleanor Smith, 7:00 AM - 3:00 PM (today)
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

  -- Starter tasks for the shift (skip if they already exist)
  insert into public.shift_tasks (shift_id, user_id, label, medication_note, done)
  values
    (v_shift_id, new.id, 'Check Blood Pressure', null, false),
    (v_shift_id, new.id, 'Administer Morning Meds', 'Lisinopril 10mg, Aspirin 81mg', false)
  on conflict do nothing;

  -- Empty draft report for the shift (skip if it already exists)
  insert into public.shift_reports (shift_id, user_id, status)
  values (v_shift_id, new.id, 'draft')
  on conflict (shift_id) do nothing;

  -- Upcoming shift +1 day: Margaret Lee
  insert into public.shifts (
    user_id, patient_name, start_time, end_time, address,
    task, duration, priority, shift_date, status
  ) values (
    new.id, 'Margaret Lee', time '08:00:00', time '12:00:00',
    '27 Cedar Lane', 'Medication Administration', '4 hrs', 'High',
    current_date + 1, 'scheduled'
  ) returning id into v_shift_id;
  insert into public.shift_tasks (shift_id, user_id, label, medication_note, done)
  values (v_shift_id, new.id, 'Check Blood Pressure', null, false),
         (v_shift_id, new.id, 'Administer Medication', null, false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id, user_id, status)
  values (v_shift_id, new.id, 'draft')
  on conflict (shift_id) do nothing;

  -- Upcoming shift +2 days: Tom Harris
  insert into public.shifts (
    user_id, patient_name, start_time, end_time, address,
    task, duration, priority, shift_date, status
  ) values (
    new.id, 'Tom Harris', time '09:00:00', time '11:00:00',
    '9 Riverside Walk', 'Wound Dressing', '2 hrs', 'Medium',
    current_date + 2, 'scheduled'
  ) returning id into v_shift_id;
  insert into public.shift_tasks (shift_id, user_id, label, medication_note, done)
  values (v_shift_id, new.id, 'Check Blood Pressure', null, false),
         (v_shift_id, new.id, 'Administer Medication', null, false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id, user_id, status)
  values (v_shift_id, new.id, 'draft')
  on conflict (shift_id) do nothing;

  -- Upcoming shift +3 days: Dorothy Chen
  insert into public.shifts (
    user_id, patient_name, start_time, end_time, address,
    task, duration, priority, shift_date, status
  ) values (
    new.id, 'Dorothy Chen', time '07:00:00', time '15:00:00',
    '55 Oak Avenue', 'Personal Care', '2 hrs', 'High',
    current_date + 3, 'scheduled'
  ) returning id into v_shift_id;
  insert into public.shift_tasks (shift_id, user_id, label, medication_note, done)
  values (v_shift_id, new.id, 'Check Blood Pressure', null, false),
         (v_shift_id, new.id, 'Administer Medication', null, false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id, user_id, status)
  values (v_shift_id, new.id, 'draft')
  on conflict (shift_id) do nothing;

  -- Upcoming shift +4 days: James Oduya
  insert into public.shifts (
    user_id, patient_name, start_time, end_time, address,
    task, duration, priority, shift_date, status
  ) values (
    new.id, 'James Oduya', time '10:00:00', time '14:00:00',
    '12 Birch Street', 'Companionship & Light Housekeeping', '2 hrs', 'Normal',
    current_date + 4, 'scheduled'
  ) returning id into v_shift_id;
  insert into public.shift_tasks (shift_id, user_id, label, medication_note, done)
  values (v_shift_id, new.id, 'Check Blood Pressure', null, false),
         (v_shift_id, new.id, 'Administer Medication', null, false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id, user_id, status)
  values (v_shift_id, new.id, 'draft')
  on conflict (shift_id) do nothing;

  -- Starter alerts (skip if they already exist)
  insert into public.alerts (user_id, icon, title, body, is_read)
  values
    (new.id, 'calendar', 'Schedule Updated',
     'Your schedule has been updated. Please review your upcoming shifts.', false),
    (new.id, 'medication', 'Medication Reminder',
     'Remember to administer the morning medication for Eleanor Smith.', false),
    (new.id, 'supplies', 'Supplies Restocked',
     'Care supplies have been restocked and are ready for collection.', false)
  on conflict do nothing;

  return new;
end;
$$;

-- Re-create the trigger (DROP IF EXISTS ensures idempotency)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Done.