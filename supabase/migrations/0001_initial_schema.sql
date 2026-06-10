-- ZN Servis initial schema
-- Run this in Supabase SQL editor or via the Supabase CLI.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'worker');
create type public.material_unit as enum ('kom', 'm', 'm2', 'm3', 'kg', 'l', 'pak', 'kutija');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) >= 2),
  role public.app_role not null default 'worker',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.material_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  group_id uuid references public.material_groups(id) on delete set null,
  unit public.material_unit not null default 'kom',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_reports (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  performed_at timestamptz not null,
  notes text,
  client_generated_id uuid,
  created_at timestamptz not null default now(),
  constraint work_reports_unique_client_id unique (worker_id, client_generated_id)
);

create table public.work_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.work_reports(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index locations_active_idx on public.locations(active);
create index material_groups_name_idx on public.material_groups(name);
create index materials_group_idx on public.materials(group_id, name);
create index materials_active_idx on public.materials(active);
create index work_reports_performed_at_idx on public.work_reports(performed_at desc);
create index work_reports_worker_date_idx on public.work_reports(worker_id, performed_at desc);
create index work_reports_location_idx on public.work_reports(location_id);
create index work_report_items_report_idx on public.work_report_items(report_id);
create index work_report_items_material_idx on public.work_report_items(material_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_locations_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create trigger set_material_groups_updated_at
before update on public.material_groups
for each row execute function public.set_updated_at();

create trigger set_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'worker'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

create or replace function public.is_active_worker()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'worker'
      and active = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.material_groups enable row level security;
alter table public.materials enable row level security;
alter table public.work_reports enable row level security;
alter table public.work_report_items enable row level security;

create policy "admins can manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "users can read own active profile"
on public.profiles
for select
to authenticated
using (id = auth.uid() and active = true);

create policy "admins can manage locations"
on public.locations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "workers can read active locations"
on public.locations
for select
to authenticated
using (active = true and public.is_active_worker());

create policy "admins can manage material groups"
on public.material_groups
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "workers can read material groups"
on public.material_groups
for select
to authenticated
using (public.is_active_worker());

create policy "admins can manage materials"
on public.materials
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "workers can read active materials"
on public.materials
for select
to authenticated
using (active = true and public.is_active_worker());

create policy "admins can read reports"
on public.work_reports
for select
to authenticated
using (public.is_admin());

create policy "workers can read own reports"
on public.work_reports
for select
to authenticated
using (worker_id = auth.uid() and public.is_active_worker());

create policy "workers can create own reports"
on public.work_reports
for insert
to authenticated
with check (worker_id = auth.uid() and public.is_active_worker());

create policy "admins can read report items"
on public.work_report_items
for select
to authenticated
using (public.is_admin());

create policy "workers can read own report items"
on public.work_report_items
for select
to authenticated
using (
  public.is_active_worker()
  and exists (
    select 1
    from public.work_reports wr
    where wr.id = work_report_items.report_id
      and wr.worker_id = auth.uid()
  )
);

create policy "workers can create own report items"
on public.work_report_items
for insert
to authenticated
with check (
  public.is_active_worker()
  and exists (
    select 1
    from public.work_reports wr
    where wr.id = work_report_items.report_id
      and wr.worker_id = auth.uid()
  )
);

-- After creating your first auth user, promote it manually:
-- update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
