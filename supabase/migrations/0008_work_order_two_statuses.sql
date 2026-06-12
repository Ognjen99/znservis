-- Simplify work orders to two statuses: in_progress and completed.

update public.work_orders
set status = 'in_progress'
where status not in ('in_progress', 'completed');

alter table public.work_orders
  alter column status set default 'in_progress';

drop trigger if exists mark_work_order_in_progress on public.work_reports;
drop function if exists public.mark_work_order_in_progress();

create or replace function public.validate_work_order_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if old.status = 'completed' then
      raise exception 'Work order is already completed.';
    end if;

    if old.status = 'in_progress' and new.status <> 'completed' then
      raise exception 'Invalid work order status transition from % to %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

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

  if order_status <> 'in_progress' then
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

  if order_status <> 'in_progress' then
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

drop policy if exists "workers can complete assigned work orders" on public.work_orders;

create policy "workers can complete assigned work orders"
on public.work_orders
for update
to authenticated
using (
  public.is_active_worker()
  and public.is_assigned_to_work_order(id)
  and status = 'in_progress'
)
with check (
  public.is_active_worker()
  and public.is_assigned_to_work_order(id)
  and status = 'completed'
);
