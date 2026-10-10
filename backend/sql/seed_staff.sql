-- ============================================================
-- CareSync staff seed data
-- ============================================================
-- Source: frontend/src/data/staff.ts (4 staff members + attendance)
-- Idempotent: safe to run twice (ON CONFLICT DO NOTHING).
-- ============================================================

insert into public.staff (
  id, name, role, employee_id, email, phone, date_joined, employment_type,
  supervisor, last_activity, last_login, patients_attended, current_status,
  total_tasks, average_time, completion_rate, present_days, absent_days,
  late_days, present_percent, punctuality_percent
)
values
  (
    '1', 'Angela Basnet', 'Registered Nurse', 'AA00DD12345',
    'angela.basnet@caresync.io', '+44 7700 900123', '29th April 2021',
    'Intern / Full-Time Employee', 'Dr. Camroon King',
    'Eleanor''s Blood Pressure Check', '23rd July | 10:50 AM', 32,
    'Working on Eleanor''s Morning Meds', 23, '8 hr', '91%',
    497, 17, 32, 77, 71
  ),
  (
    '2', 'Angela Pillar', 'Registered Nurse', 'AP00RN98765',
    'angela.pillar@caresync.io', '+44 7700 900456', '15th March 2020',
    'Full-Time Employee', 'Dr. Camroon King',
    'Medication Administration — Margaret Lee', '23rd July | 9:15 AM', 58,
    'On Shift', 31, '6 hr', '96%',
    612, 8, 14, 94, 89
  ),
  (
    '3', 'Peter Okonkwo', 'Home Care Assistant', 'CS-1042',
    'peter.okonkwo@caresync.io', '+44 7700 900789', '5th January 2023',
    'Full-Time Employee', 'Dr. Camroon King',
    'Eleanor''s Morning Visit', '23rd July | 7:00 AM', 14,
    'Checked In — Eleanor''s Visit', 12, '2 hr', '88%',
    310, 5, 10, 95, 91
  ),
  (
    '4', 'Sarah Ndegwa', 'Senior Care Assistant', 'SN00CA55555',
    'sarah.ndegwa@caresync.io', '+44 7700 900321', '10th September 2021',
    'Part-Time Employee', 'Dr. Camroon King',
    'Wound Dressing — Tom Harris', '22nd July | 4:30 PM', 41,
    'Off Shift', 27, '5 hr', '93%',
    402, 12, 20, 88, 82
  )
on conflict (id) do nothing;

insert into public.staff_attendance (staff_id, work_date, status)
values
  ('1', date '2025-07-21', 'Present'),
  ('1', date '2025-07-20', 'Present'),
  ('1', date '2025-07-19', 'Late'),
  ('1', date '2025-07-18', 'Present'),
  ('1', date '2025-07-17', 'Absent'),
  ('1', date '2025-07-16', 'Present'),
  ('1', date '2025-07-15', 'Present'),
  ('1', date '2025-07-14', 'Late'),
  ('1', date '2025-07-13', 'Present'),
  ('1', date '2025-07-12', 'Present'),
  ('2', date '2025-07-21', 'Present'),
  ('2', date '2025-07-20', 'Present'),
  ('2', date '2025-07-19', 'Present'),
  ('2', date '2025-07-18', 'Present'),
  ('2', date '2025-07-17', 'Late'),
  ('2', date '2025-07-16', 'Present'),
  ('2', date '2025-07-15', 'Present'),
  ('2', date '2025-07-14', 'Present'),
  ('2', date '2025-07-13', 'Absent'),
  ('2', date '2025-07-12', 'Present')
on conflict (staff_id, work_date) do nothing;

insert into public.staff_attendance (staff_id, work_date, status)
values
  ('3', date '2025-07-21', 'Present'),
  ('3', date '2025-07-20', 'Present'),
  ('3', date '2025-07-19', 'Present'),
  ('3', date '2025-07-18', 'Late'),
  ('3', date '2025-07-17', 'Present'),
  ('3', date '2025-07-16', 'Present'),
  ('3', date '2025-07-15', 'Absent'),
  ('3', date '2025-07-14', 'Present'),
  ('3', date '2025-07-13', 'Present'),
  ('3', date '2025-07-12', 'Present'),
  ('4', date '2025-07-21', 'Absent'),
  ('4', date '2025-07-20', 'Present'),
  ('4', date '2025-07-19', 'Present'),
  ('4', date '2025-07-18', 'Late'),
  ('4', date '2025-07-17', 'Present'),
  ('4', date '2025-07-16', 'Present'),
  ('4', date '2025-07-15', 'Late'),
  ('4', date '2025-07-14', 'Present'),
  ('4', date '2025-07-13', 'Present'),
  ('4', date '2025-07-12', 'Absent')
on conflict (staff_id, work_date) do nothing;

-- Done.