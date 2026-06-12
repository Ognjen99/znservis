-- Allow deleting work orders even when assigned materials have been used.
-- The material delete guard should block manual row removal, not cascade deletes.

create or replace function public.mark_work_order_deletion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform set_config('app.deleting_work_order', old.id::text, true);
  return old;
end;
$$;

drop trigger if exists mark_work_order_deletion on public.work_orders;

create trigger mark_work_order_deletion
before delete on public.work_orders
for each row execute function public.mark_work_order_deletion();

create or replace function public.prevent_used_material_assignment_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.deleting_work_order', true), '') = old.work_order_id::text then
    return old;
  end if;

  if public.work_order_material_used_quantity(old.work_order_id, old.material_id) > 0 then
    raise exception 'Cannot remove assigned material after it has been used.';
  end if;

  return old;
end;
$$;
