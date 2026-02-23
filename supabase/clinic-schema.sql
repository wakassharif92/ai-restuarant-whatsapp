-- ========================================
-- CLINIC APPOINTMENT BOOKING SYSTEM
-- Separate schema from restaurant orders
-- ========================================

-- Enable UUID generation (Supabase typically already has this available)
create extension if not exists "pgcrypto";

-- 1) Services (dental treatments + charges)
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'PKR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_services_active on public.services (is_active);

-- 2) Clinic settings (single row for one clinic)
create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  timezone text not null default 'Asia/Karachi',
  working_hours jsonb not null default '{}'::jsonb,
  slot_step_minutes int not null default 15 check (slot_step_minutes > 0),
  buffer_minutes int not null default 0 check (buffer_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: ensure only ONE settings row exists (idiot-proof for single clinic)
create unique index if not exists one_row_clinic_settings on public.clinic_settings ((true));

-- 3) Blocked times (breaks, holidays, lunch)
create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists idx_blocked_times_start_end on public.blocked_times (start_at, end_at);

-- 4) Appointments
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),

  patient_name text not null,
  patient_phone text not null,

  service_id uuid not null references public.services(id) on delete restrict,

  start_at timestamptz not null,
  end_at timestamptz not null,

  status text not null default 'booked'
    check (status in ('booked','cancelled','completed','no_show')),

  notes text null,
  source text not null default 'vapi' check (source in ('vapi','admin','api')),
  created_at timestamptz not null default now(),

  check (end_at > start_at)
);

create index if not exists idx_appointments_start_at on public.appointments (start_at);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_phone on public.appointments (patient_phone);

-- ✅ Prevent double booking for the single doctor:
-- Only one ACTIVE appointment can exist for the same start time.
-- Cancelled/completed/no_show won't block new bookings.
create unique index if not exists uniq_active_appointment_start
on public.appointments (start_at)
where status = 'booked';

-- 5) Clinic admin users (separate from restaurant admins)
create table if not exists public.clinic_admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_plain text not null,
  is_super boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clinic_admin_username on public.clinic_admin_users (username);

-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on all tables
alter table public.services enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.blocked_times enable row level security;
alter table public.appointments enable row level security;
alter table public.clinic_admin_users enable row level security;

-- ✅ Services: Anyone can read, authenticated can write
create policy "services_select_anon" on public.services
  for select using (true);

create policy "services_insert_authenticated" on public.services
  for insert with check (auth.role() = 'authenticated');

create policy "services_update_authenticated" on public.services
  for update using (auth.role() = 'authenticated');

create policy "services_delete_authenticated" on public.services
  for delete using (auth.role() = 'authenticated');

-- ✅ Clinic Settings: Anyone can read, authenticated can write
create policy "clinic_settings_select_anon" on public.clinic_settings
  for select using (true);

create policy "clinic_settings_insert_authenticated" on public.clinic_settings
  for insert with check (auth.role() = 'authenticated');

create policy "clinic_settings_update_authenticated" on public.clinic_settings
  for update using (auth.role() = 'authenticated');

create policy "clinic_settings_delete_authenticated" on public.clinic_settings
  for delete using (auth.role() = 'authenticated');

-- ✅ Blocked Times: Anyone can read, authenticated can write
create policy "blocked_times_select_anon" on public.blocked_times
  for select using (true);

create policy "blocked_times_insert_authenticated" on public.blocked_times
  for insert with check (auth.role() = 'authenticated');

create policy "blocked_times_update_authenticated" on public.blocked_times
  for update using (auth.role() = 'authenticated');

create policy "blocked_times_delete_authenticated" on public.blocked_times
  for delete using (auth.role() = 'authenticated');

-- ✅ Appointments: Anyone can read, anon can insert, authenticated can update
create policy "appointments_select_all" on public.appointments
  for select using (true);

create policy "appointments_insert_anon" on public.appointments
  for insert with check (auth.role() = 'anon' or auth.role() = 'authenticated');

create policy "appointments_update_authenticated" on public.appointments
  for update using (auth.role() = 'authenticated');

create policy "appointments_delete_authenticated" on public.appointments
  for delete using (auth.role() = 'authenticated');

-- ✅ Clinic Admin Users: Only authenticated users can read their own record
create policy "clinic_admin_select_self" on public.clinic_admin_users
  for select using (
    auth.role() = 'authenticated' or auth.uid()::text = id::text
  );

create policy "clinic_admin_insert_anon" on public.clinic_admin_users
  for insert with check (true);

-- ========================================
-- SAMPLE DATA (Optional)
-- ========================================

-- Insert sample clinic settings (only one row allowed)
insert into public.clinic_settings (timezone, working_hours, slot_step_minutes, buffer_minutes)
values (
  'Asia/Karachi',
  '{"mon": "09:00-17:00", "tue": "09:00-17:00", "wed": "09:00-17:00", "thu": "09:00-17:00", "fri": "10:00-16:00", "sat": "09:00-13:00", "sun": "closed"}'::jsonb,
  15,
  5
)
on conflict do nothing;

-- Insert sample services
insert into public.services (name, duration_minutes, price, currency, is_active)
values
  ('Dental Cleaning', 30, 1500, 'PKR', true),
  ('Root Canal', 60, 5000, 'PKR', true),
  ('Tooth Extraction', 45, 3000, 'PKR', true),
  ('Filling', 40, 2500, 'PKR', true),
  ('Crown', 90, 8000, 'PKR', true)
on conflict do nothing;

-- Insert sample clinic admin (username: clinic_admin, password: clinic_admin)
insert into public.clinic_admin_users (username, password_plain, is_super)
values
  ('clinic_admin', 'clinic_admin', true)
on conflict (username) do nothing;
