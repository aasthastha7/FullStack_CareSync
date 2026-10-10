-- ============================================================
-- Migration 005: Extend support_requests + GPS check-in
-- ============================================================
-- 1. Add requested_date, swap_shift_id, swap_with_staff_id,
--    decided_at to support_requests.
-- 2. Add a CHECK constraint on status (pending/approved/declined).
-- 3. Add checked_in_lat / checked_in_lng to shifts.
--
-- Idempotent: safe to run more than once.
-- Does NOT drop or delete any existing data.
-- ============================================================

-- 1. Extend support_requests ---------------------------------------
alter table public.support_requests
  add column if not exists requested_date date;

alter table public.support_requests
  add column if not exists swap_shift_id uuid;

alter table public.support_requests
  add column if not exists swap_with_staff_id text;

alter table public.support_requests
  add column if not exists decided_at timestamptz;

-- 2. Status CHECK constraint (idempotent via named constraint) ------
-- Only add if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_requests_status_check'
      and conrelid = 'public.support_requests'::regclass
  ) then
    alter table public.support_requests
      add constraint support_requests_status_check
      check (status in ('pending', 'approved', 'declined'));
  end if;
end $$;

-- 3. GPS coordinates on shifts -------------------------------------
alter table public.shifts
  add column if not exists checked_in_lat double precision;

alter table public.shifts
  add column if not exists checked_in_lng double precision;

-- Done.