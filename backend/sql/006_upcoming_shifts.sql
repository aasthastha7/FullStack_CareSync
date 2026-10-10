-- ============================================================
-- Migration 006: Backfill 4 upcoming shifts per existing user
-- ============================================================
-- Seeds one shift per day for current_date +1 through +4 for
-- every existing profile.  Skips users who already have a shift
-- on that date (idempotent).
--
-- Idempotent: safe to run more than once.
-- Does NOT drop or delete any existing data.
-- ============================================================

do $$
declare
  r record;
  v_patient text;
  v_address text;
  v_task    text;
  v_start   time;
  v_end     time;
  v_dur     text;
  v_prio    text;
  v_offset  int;
  v_date    date;
begin
  for r in select id from public.profiles loop
    for v_offset in 1..4 loop
      v_date := current_date + v_offset;

      -- skip if a shift already exists for this user+date
      continue when exists (
        select 1 from public.shifts
        where user_id = r.id and shift_date = v_date
      );

      -- vary the patient/address/task by day
      case v_offset
        when 1 then
          v_patient := 'Margaret Lee';
          v_address := '27 Cedar Lane';
          v_task    := 'Medication Administration';
          v_start   := time '08:00:00';
          v_end     := time '12:00:00';
          v_dur     := '4 hrs';
          v_prio    := 'High';
        when 2 then
          v_patient := 'Tom Harris';
          v_address := '9 Riverside Walk';
          v_task    := 'Wound Dressing';
          v_start   := time '09:00:00';
          v_end     := time '11:00:00';
          v_dur     := '2 hrs';
          v_prio    := 'Medium';
        when 3 then
          v_patient := 'Dorothy Chen';
          v_address := '55 Oak Avenue';
          v_task    := 'Personal Care';
          v_start   := time '07:00:00';
          v_end     := time '15:00:00';
          v_dur     := '2 hrs';
          v_prio    := 'High';
        when 4 then
          v_patient := 'James Oduya';
          v_address := '12 Birch Street';
          v_task    := 'Companionship & Light Housekeeping';
          v_start   := time '10:00:00';
          v_end     := time '14:00:00';
          v_dur     := '2 hrs';
          v_prio    := 'Normal';
      end case;

      -- Insert the shift; capture its id for tasks/report
      insert into public.shifts (
        user_id, patient_name, start_time, end_time, address,
        task, duration, priority, shift_date, status
      )
      values (
        r.id, v_patient, v_start, v_end, v_address,
        v_task, v_dur, v_prio, v_date, 'scheduled'
      );

      -- We need the id back for shift_tasks and shift_reports.
      -- PostgreSQL doesn't support RETURNING inside DO blocks easily,
      -- so we fetch the row we just inserted by user+date.
      declare
        v_shift_id uuid;
      begin
        select id into v_shift_id
        from public.shifts
        where user_id = r.id and shift_date = v_date
        limit 1;

        -- Starter tasks (skip if already exist for this shift+label)
        if not exists (
          select 1 from public.shift_tasks
          where shift_id = v_shift_id and label = 'Check Blood Pressure'
        ) then
          insert into public.shift_tasks
            (shift_id, user_id, label, medication_note, done)
          values
            (v_shift_id, r.id, 'Check Blood Pressure', null, false),
            (v_shift_id, r.id, 'Administer Medication', null, false);
        end if;

        -- Empty draft report
        insert into public.shift_reports (shift_id, user_id, status)
        values (v_shift_id, r.id, 'draft')
        on conflict (shift_id) do nothing;
      end;
    end loop;
  end loop;
end $$;

-- Done.