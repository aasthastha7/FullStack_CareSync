-- ============================================================
-- Migration 004: Support contacts (crisis helpline numbers)
-- ============================================================
-- Creates a reference table of support/crisis phone numbers.
-- Two fake placeholder rows are seeded — replace them in the
-- Supabase Table Editor with real numbers.
--
-- Idempotent: safe to run more than once.
-- Does NOT drop or delete any existing data.
-- ============================================================

-- 1. Table ---------------------------------------------------------
create table if not exists public.support_contacts (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  phone       text not null,
  description text,
  is_crisis   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 2. Seed placeholder contacts -------------------------------------
insert into public.support_contacts (label, phone, description, is_crisis)
values
  (
    'Crisis Helpline (Placeholder)',
    '+44 0000 000001',
    'Replace this number in the Table Editor with your real crisis line.',
    true
  ),
  (
    'Emotional Support Line (Placeholder)',
    '+44 0000 000002',
    'Replace this number in the Table Editor with a real support line.',
    true
  )
on conflict do nothing;

-- 3. RLS — read-only for everyone (reference table) ----------------
alter table public.support_contacts enable row level security;

drop policy if exists "support_contacts_select_all" on public.support_contacts;
create policy "support_contacts_select_all" on public.support_contacts
  for select
  using (true);

-- 4. Grants --------------------------------------------------------
grant select on public.support_contacts to anon, authenticated;

-- Done.