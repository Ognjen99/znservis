-- Flatten material groups: remove subgroup hierarchy.
-- Run this in Supabase SQL editor after 0001_initial_schema.sql.

-- Promote existing subgroups to top-level groups.
update public.material_groups
set parent_id = null
where parent_id is not null;

drop index if exists public.material_groups_parent_idx;

alter table public.material_groups
  drop constraint if exists material_groups_no_self_parent;

alter table public.material_groups
  drop constraint if exists material_groups_parent_id_fkey;

alter table public.material_groups
  drop column if exists parent_id;
