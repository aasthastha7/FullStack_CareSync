-- ============================================================
-- Migration 008: Link staff rows to auth accounts
-- ============================================================
-- Purpose:
--   1. Add a nullable user_id (uuid) column to public.staff
--      that references public.profiles(id).
--   2. Add a UNIQUE constraint on user_id (partial: only
--      enforced for non-NULL values).
--   3. Update handle_new_user() trigger so new signups also
--      create a staff row.
--   4. Backfill: create a staff row for every existing
--      profile that does not already have one.
--
-- Idempotent: safe to run more than once.
-- Existing seed staff rows ('1'-'4') keep user_id = NULL.
-- ============================================================

-- 1. Add user_id column ------------------------------------------------
alter table public.staff
  add column if not exists user_id uuid;

-- 2. Unique constraint (partial: allows multiple NULLs) -----------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_user_id_unique'
      AND conrelid = 'public.staff'::regclass
  ) THEN
    ALTER TABLE public.staff
      ADD CONSTRAINT staff_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 3. Index for filtering by user_id ------------------------------------
create index if not exists staff_user_id_idx on public.staff (user_id);

-- 4. Update protect_staff_contact_details guard to include user_id ------
create or replace function public.protect_staff_contact_details()
returns trigger
language plpgsql
as $$
begin
  if new.id                     is distinct from old.id
     or new.name                is distinct from old.name
     or new.role                is distinct from old.role
     or new.employee_id         is distinct from old.employee_id
     or new.user_id             is distinct from old.user_id
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

-- 5. Update handle_new_user() trigger to also create a staff row --------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare v_shift_id uuid; v_tz text; v_today date;
begin
  v_tz := coalesce(nullif(trim(new.raw_user_meta_data ->> 'timezone'), ''), 'Australia/Sydney');
  v_today := (now() at time zone v_tz)::date;

  insert into public.profiles (id, full_name, email, role, employee_id, timezone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)),
          new.email, coalesce(new.raw_user_meta_data->>'role','caregiver'),
          new.raw_user_meta_data->>'employee_id', v_tz)
  on conflict (id) do nothing;

  -- Staff directory entry linked to the account
  insert into public.staff (id, name, role, employee_id, user_id, date_joined)
  values (
    'user-' || new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'Care Worker'),
    new.raw_user_meta_data ->> 'employee_id',
    new.id,
    to_char(now(), 'DDth Mon YYYY')
  )
  on conflict (id) do nothing;

  insert into public.shifts (user_id,patient_name,start_time,end_time,address,task,duration,priority,shift_date,status)
  values (new.id,'Eleanor Smith','07:00','15:00','142 Maple Drive','Personal Care','2 hrs','High',v_today,'scheduled')
  returning id into v_shift_id;
  insert into public.shift_tasks (shift_id,user_id,label,medication_note,done)
  values (v_shift_id,new.id,'Check Blood Pressure',null,false),(v_shift_id,new.id,'Administer Morning Meds','Lisinopril 10mg, Aspirin 81mg',false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id,user_id,status) values (v_shift_id,new.id,'draft')
  on conflict (shift_id) do nothing;

  insert into public.shifts (user_id,patient_name,start_time,end_time,address,task,duration,priority,shift_date,status)
  values (new.id,'Margaret Lee','08:00','12:00','27 Cedar Lane','Medication Administration','4 hrs','High',v_today+1,'scheduled')
  returning id into v_shift_id;
  insert into public.shift_tasks (shift_id,user_id,label,medication_note,done)
  values (v_shift_id,new.id,'Check Blood Pressure',null,false),(v_shift_id,new.id,'Administer Medication',null,false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id,user_id,status) values (v_shift_id,new.id,'draft')
  on conflict (shift_id) do nothing;

  insert into public.shifts (user_id,patient_name,start_time,end_time,address,task,duration,priority,shift_date,status)
  values (new.id,'Tom Harris','09:00','11:00','9 Riverside Walk','Wound Dressing','2 hrs','Medium',v_today+2,'scheduled')
  returning id into v_shift_id;
  insert into public.shift_tasks (shift_id,user_id,label,medication_note,done)
  values (v_shift_id,new.id,'Check Blood Pressure',null,false),(v_shift_id,new.id,'Administer Medication',null,false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id,user_id,status) values (v_shift_id,new.id,'draft')
  on conflict (shift_id) do nothing;

  insert into public.shifts (user_id,patient_name,start_time,end_time,address,task,duration,priority,shift_date,status)
  values (new.id,'Dorothy Chen','07:00','15:00','55 Oak Avenue','Personal Care','2 hrs','High',v_today+3,'scheduled')
  returning id into v_shift_id;
  insert into public.shift_tasks (shift_id,user_id,label,medication_note,done)
  values (v_shift_id,new.id,'Check Blood Pressure',null,false),(v_shift_id,new.id,'Administer Medication',null,false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id,user_id,status) values (v_shift_id,new.id,'draft')
  on conflict (shift_id) do nothing;

  insert into public.shifts (user_id,patient_name,start_time,end_time,address,task,duration,priority,shift_date,status)
  values (new.id,'James Oduya','10:00','14:00','12 Birch Street','Companionship & Light Housekeeping','2 hrs','Normal',v_today+4,'scheduled')
  returning id into v_shift_id;
  insert into public.shift_tasks (shift_id,user_id,label,medication_note,done)
  values (v_shift_id,new.id,'Check Blood Pressure',null,false),(v_shift_id,new.id,'Administer Medication',null,false)
  on conflict do nothing;
  insert into public.shift_reports (shift_id,user_id,status) values (v_shift_id,new.id,'draft')
  on conflict (shift_id) do nothing;

  insert into public.alerts (user_id,icon,title,body,is_read) values
    (new.id,'calendar','Schedule Updated','Your schedule has been updated. Please review your upcoming shifts.',false),
    (new.id,'medication','Medication Reminder','Remember to administer the morning medication for Eleanor Smith.',false),
    (new.id,'supplies','Supplies Restocked','Care supplies have been restocked and are ready for collection.',false)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- 6. Grant INSERT on staff to authenticated -----------------------------
grant insert on public.staff to authenticated;

-- 7. Backfill: create staff rows for existing profiles that lack one ----
INSERT INTO public.staff (id, name, role, employee_id, user_id, date_joined)
SELECT
  'user-' || p.id,
  COALESCE(p.full_name, split_part(p.email, '@', 1), 'Unknown'),
  COALESCE(NULLIF(p.role, ''), 'Care Worker'),
  p.employee_id,
  p.id,
  to_char(p.created_at, 'DDth Mon YYYY')
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff s WHERE s.user_id = p.id
)
ON CONFLICT (id) DO NOTHING;

-- Done.