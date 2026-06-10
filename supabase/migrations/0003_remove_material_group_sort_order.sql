-- Remove sort order from material groups.
-- Run this in Supabase SQL editor after previous migrations.

drop index if exists public.material_groups_sort_idx;

alter table public.material_groups
  drop column if exists sort_order;

create index if not exists material_groups_name_idx on public.material_groups(name);
