-- Supabase schema + RLS for restaurants

-- Extensions
create extension if not exists pgcrypto;

-- MENU ITEMS
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  currency text default 'USD',
  available_today boolean default true,
  is_available boolean default true,
  modifiers jsonb,
  variants jsonb,
  created_at timestamptz default now()
);

-- SETTINGS
create table if not exists public.restaurant_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid,
  delivery_enabled boolean default true,
  pickup_enabled boolean default true,
  delivery_time_minutes text,
  payment_methods jsonb,
  notes_allowed boolean default true,
  created_at timestamptz default now()
);

-- ORDERS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  restaurant_id uuid,
  customer_name text,
  customer_phone text,
  order_type text,
  address text,
  payment text,
  notes text,
  items jsonb,
  raw jsonb,
  source text,
  status text default 'new',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_menu_items_restaurant_id on public.menu_items (restaurant_id);
create index if not exists idx_settings_restaurant_id on public.restaurant_settings (restaurant_id);
create index if not exists idx_orders_restaurant_id on public.orders (restaurant_id);
create index if not exists idx_orders_created_at on public.orders (created_at desc);

-- RLS
alter table public.menu_items enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.orders enable row level security;

-- Menu: read-only for anon
create policy "menu_items_read" on public.menu_items
  for select
  to anon, authenticated
  using (true);

-- Settings: read-only for anon
create policy "settings_read" on public.restaurant_settings
  for select
  to anon, authenticated
  using (true);

-- Orders: allow insert from anon (AI backend)
create policy "orders_insert" on public.orders
  for insert
  to anon, authenticated
  with check (true);

-- Orders: allow read for authenticated only (admin panel)
create policy "orders_read_auth" on public.orders
  for select
  to authenticated
  using (true);
