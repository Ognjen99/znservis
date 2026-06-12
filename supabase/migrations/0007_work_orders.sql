-- Work orders, multi-day daily logs, material assignment and plan attachments.

create type public.work_order_status as enum (
  'created',
  'assigned',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled'
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 2),
  description text,
  location_id uuid not null references public.locations(id) on delete restrict,
  status public.work_order_status not null default 'created',
  created_by uuid references public.profiles(id) on delete set null,
  scheduled_start date,
  scheduled_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end is null or scheduled_start is null or scheduled_end >= scheduled_start)
);

create table public.work_order_assignees (
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_order_id, worker_id)
);

create table public.work_order_materials (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  assigned_quantity numeric(12, 3) not null check (assigned_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_order_materials_unique_material unique (work_order_id, material_id)
);

create table public.work_order_attachments (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text not null check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint work_order_attachments_unique_path unique (file_path)
);

alter table public.work_reports
  add column work_order_id uuid references public.work_orders(id) on delete cascade,
  add column work_date date;

update public.work_reports
set work_date = performed_at::date
where work_date is null;

alter table public.work_reports
  alter column work_date set not null;

create index work_orders_status_idx on public.work_orders(status);
create index work_orders_location_idx on public.work_orders(location_id);
create index work_orders_schedule_idx on public.work_orders(scheduled_start, scheduled_end);
create index work_order_assignees_worker_idx on public.work_order_assignees(worker_id);
create index work_order_materials_order_idx on public.work_order_materials(work_order_id);
create index work_order_materials_material_idx on public.work_order_materials(material_id);
create index work_order_attachments_order_idx on public.work_order_attachments(work_order_id);
create index work_reports_work_order_idx on public.work_reports(work_order_id, work_date desc);

create trigger set_work_orders_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

create trigger set_work_order_materials_updated_at
before update on public.work_order_materials
for each row execute function public.set_updated_at();

create or replace function public.is_assigned_to_work_order(order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.work_order_assignees woa
    where woa.work_order_id = order_id
      and woa.worker_id = auth.uid()
  );
$$;

create or replace function public.work_order_material_used_quantity(
  order_id uuid,
  material uuid,
  ignored_item_id uuid default null
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(wri.quantity), 0)
  from public.work_report_items wri
  join public.work_reports wr on wr.id = wri.report_id
  where wr.work_order_id = order_id
    and wri.material_id = material
    and (ignored_item_id is null or wri.id <> ignored_item_id);
$$;

create or replace view public.work_order_material_usage
with (security_invoker = true)
as
select
  wom.id,
  wom.work_order_id,
  wom.material_id,
  wom.assigned_quantity,
  public.work_order_material_used_quantity(wom.work_order_id, wom.material_id) as used_quantity,
  wom.assigned_quantity - public.work_order_material_used_quantity(wom.work_order_id, wom.material_id) as remaining_quantity,
  wom.created_at,
  wom.updated_at
from public.work_order_materials wom;

create or replace function public.validate_work_order_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if old.status in ('completed', 'cancelled') then
      raise exception 'Work order status % is terminal.', old.status;
    end if;

    if old.status = 'created' and new.status not in ('assigned', 'cancelled') then
      raise exception 'Invalid work order status transition from % to %.', old.status, new.status;
    end if;

    if old.status = 'assigned' and new.status not in ('in_progress', 'on_hold', 'cancelled') then
      raise exception 'Invalid work order status transition from % to %.', old.status, new.status;
    end if;

    if old.status = 'in_progress' and new.status not in ('on_hold', 'completed', 'cancelled') then
      raise exception 'Invalid work order status transition from % to %.', old.status, new.status;
    end if;

    if old.status = 'on_hold' and new.status not in ('in_progress', 'cancelled') then
      raise exception 'Invalid work order status transition from % to %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_work_order_status_transition
before update on public.work_orders
for each row execute function public.validate_work_order_status_transition();

create or replace function public.sync_work_report_from_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  order_location_id uuid;
  order_status public.work_order_status;
begin
  if new.work_order_id is null then
    return new;
  end if;

  select location_id, status
  into order_location_id, order_status
  from public.work_orders
  where id = new.work_order_id;

  if order_location_id is null then
    raise exception 'Work order was not found.';
  end if;

  if order_status in ('created', 'completed', 'cancelled', 'on_hold') then
    raise exception 'Cannot create or update daily logs while work order status is %.', order_status;
  end if;

  if not exists (
    select 1
    from public.work_order_assignees woa
    where woa.work_order_id = new.work_order_id
      and woa.worker_id = new.worker_id
  ) then
    raise exception 'Worker is not assigned to this work order.';
  end if;

  new.location_id := order_location_id;
  new.performed_at := coalesce(new.performed_at, (new.work_date::text || 'T12:00:00Z')::timestamptz);

  return new;
end;
$$;

create trigger sync_work_report_from_order
before insert or update on public.work_reports
for each row execute function public.sync_work_report_from_order();

create or replace function public.mark_work_order_in_progress()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.work_order_id is not null then
    update public.work_orders
    set status = 'in_progress'
    where id = new.work_order_id
      and status = 'assigned';
  end if;

  return new;
end;
$$;

create trigger mark_work_order_in_progress
after insert on public.work_reports
for each row execute function public.mark_work_order_in_progress();

create or replace function public.validate_work_report_item_for_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  order_id uuid;
  order_status public.work_order_status;
  assigned_qty numeric;
  used_qty numeric;
begin
  select wr.work_order_id, wo.status
  into order_id, order_status
  from public.work_reports wr
  left join public.work_orders wo on wo.id = wr.work_order_id
  where wr.id = new.report_id;

  if order_id is null then
    raise exception 'Daily log must belong to a work order.';
  end if;

  if order_status in ('created', 'completed', 'cancelled', 'on_hold') then
    raise exception 'Cannot record materials while work order status is %.', order_status;
  end if;

  select assigned_quantity
  into assigned_qty
  from public.work_order_materials wom
  where wom.work_order_id = order_id
    and wom.material_id = new.material_id;

  if assigned_qty is null then
    raise exception 'Material is not assigned to this work order.';
  end if;

  used_qty := public.work_order_material_used_quantity(
    order_id,
    new.material_id,
    case when tg_op = 'UPDATE' then old.id else null end
  );

  if used_qty + new.quantity > assigned_qty then
    raise exception 'Material usage exceeds remaining assigned quantity.';
  end if;

  return new;
end;
$$;

create trigger validate_work_report_item_for_order
before insert or update on public.work_report_items
for each row execute function public.validate_work_report_item_for_order();

create or replace function public.prevent_material_assignment_below_usage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  used_qty numeric;
begin
  used_qty := public.work_order_material_used_quantity(new.work_order_id, new.material_id);

  if new.assigned_quantity < used_qty then
    raise exception 'Assigned quantity cannot be lower than already used quantity.';
  end if;

  return new;
end;
$$;

create trigger prevent_material_assignment_below_usage
before update on public.work_order_materials
for each row execute function public.prevent_material_assignment_below_usage();

create or replace function public.prevent_used_material_assignment_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.work_order_material_used_quantity(old.work_order_id, old.material_id) > 0 then
    raise exception 'Cannot remove assigned material after it has been used.';
  end if;

  return old;
end;
$$;

create trigger prevent_used_material_assignment_delete
before delete on public.work_order_materials
for each row execute function public.prevent_used_material_assignment_delete();

alter table public.work_orders enable row level security;
alter table public.work_order_assignees enable row level security;
alter table public.work_order_materials enable row level security;
alter table public.work_order_attachments enable row level security;

create policy "admins can manage work orders"
on public.work_orders
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "workers can read assigned work orders"
on public.work_orders
for select
to authenticated
using (public.is_active_worker() and public.is_assigned_to_work_order(id));

create policy "admins can manage work order assignees"
on public.work_order_assignees
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "workers can read assigned teams"
on public.work_order_assignees
for select
to authenticated
using (
  public.is_active_worker()
  and public.is_assigned_to_work_order(work_order_id)
);

create policy "admins can manage work order materials"
on public.work_order_materials
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "workers can read assigned order materials"
on public.work_order_materials
for select
to authenticated
using (
  public.is_active_worker()
  and public.is_assigned_to_work_order(work_order_id)
);

create policy "admins can manage work order attachments"
on public.work_order_attachments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "workers can read assigned order attachments"
on public.work_order_attachments
for select
to authenticated
using (
  public.is_active_worker()
  and public.is_assigned_to_work_order(work_order_id)
);

drop policy if exists "workers can read own reports" on public.work_reports;
drop policy if exists "workers can create own reports" on public.work_reports;
drop policy if exists "workers can update own reports" on public.work_reports;

create policy "workers can read assigned order reports"
on public.work_reports
for select
to authenticated
using (
  public.is_active_worker()
  and work_order_id is not null
  and public.is_assigned_to_work_order(work_order_id)
);

create policy "workers can create assigned order reports"
on public.work_reports
for insert
to authenticated
with check (
  worker_id = auth.uid()
  and work_order_id is not null
  and public.is_active_worker()
  and public.is_assigned_to_work_order(work_order_id)
);

create policy "workers can update own assigned order reports"
on public.work_reports
for update
to authenticated
using (
  worker_id = auth.uid()
  and work_order_id is not null
  and public.is_active_worker()
  and public.is_assigned_to_work_order(work_order_id)
)
with check (
  worker_id = auth.uid()
  and work_order_id is not null
  and public.is_active_worker()
  and public.is_assigned_to_work_order(work_order_id)
);

drop policy if exists "workers can read own report items" on public.work_report_items;
drop policy if exists "workers can create own report items" on public.work_report_items;
drop policy if exists "workers can delete own report items" on public.work_report_items;

create policy "workers can read assigned order report items"
on public.work_report_items
for select
to authenticated
using (
  public.is_active_worker()
  and exists (
    select 1
    from public.work_reports wr
    where wr.id = work_report_items.report_id
      and wr.work_order_id is not null
      and public.is_assigned_to_work_order(wr.work_order_id)
  )
);

create policy "workers can create own assigned order report items"
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
      and wr.work_order_id is not null
      and public.is_assigned_to_work_order(wr.work_order_id)
  )
);

create policy "workers can update own assigned order report items"
on public.work_report_items
for update
to authenticated
using (
  public.is_active_worker()
  and exists (
    select 1
    from public.work_reports wr
    where wr.id = work_report_items.report_id
      and wr.worker_id = auth.uid()
      and wr.work_order_id is not null
      and public.is_assigned_to_work_order(wr.work_order_id)
  )
)
with check (
  public.is_active_worker()
  and exists (
    select 1
    from public.work_reports wr
    where wr.id = work_report_items.report_id
      and wr.worker_id = auth.uid()
      and wr.work_order_id is not null
      and public.is_assigned_to_work_order(wr.work_order_id)
  )
);

create policy "workers can delete own assigned order report items"
on public.work_report_items
for delete
to authenticated
using (
  public.is_active_worker()
  and exists (
    select 1
    from public.work_reports wr
    join public.work_orders wo on wo.id = wr.work_order_id
    where wr.id = work_report_items.report_id
      and wr.worker_id = auth.uid()
      and wo.status not in ('completed', 'cancelled', 'on_hold')
      and public.is_assigned_to_work_order(wr.work_order_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-order-plans',
  'work-order-plans',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "admins can upload work order plans"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'work-order-plans'
  and public.is_admin()
);

create policy "admins can read work order plans"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'work-order-plans'
  and public.is_admin()
);

create policy "admins can delete work order plans"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'work-order-plans'
  and public.is_admin()
);

create policy "assigned workers can read work order plans"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'work-order-plans'
  and public.is_active_worker()
  and public.is_assigned_to_work_order(split_part(name, '/', 1)::uuid)
);
