-- ============================================================
-- Migration 009: Populate staff.email and employee_id on signup
-- ============================================================
-- Purpose:
--   1. Update handle_new_user() so the staff row copies
--      new.email from the auth user and sets employee_id
--      from the profile when metadata omits it.
--   2. Backfill: fill NULL email (and employee_id) on
--      existing staff rows by joining public.profiles
--      and auth.users.
--
-- Idempotent: safe to run more than once.
-- ============================================================

-- 1. Replace handle_new_user() — adds email + employee_id fallback
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

  -- Staff directory entry: now includes email + employee_id from profile
  insert into public.staff (id, name, role, employee_id, email, user_id, date_joined)
  values (
    'user-' || new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'Care Worker'),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'employee_id', ''),
      (select p.employee_id from public.profiles p where p.id = new.id)
    ),
    new.email,
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

-- 2. Backfill NULL email on existing staff rows via profiles
update public.staff s
   set email = p.email
  from public.profiles p
 where s.user_id = p.id
   and s.email is null
   and p.email is not null;

-- 3. Backfill remaining NULL email via auth.users (rows with user_id but no profile match)
update public.staff s
   set email = au.email
  from auth.users au
 where s.user_id = au.id
   and s.email is null
   and au.email is not null;

-- 4. Backfill NULL employee_id from profiles
update public.staff s
   set employee_id = p.employee_id
  from public.profiles p
 where s.user_id = p.id
   and s.employee_id is null
   and p.employee_id is not null;

-- Done.