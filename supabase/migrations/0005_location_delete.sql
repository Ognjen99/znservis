-- Allow deleting locations; keep reports but clear location reference

alter table public.work_reports
  drop constraint if exists work_reports_location_id_fkey;

alter table public.work_reports
  alter column location_id drop not null;

alter table public.work_reports
  add constraint work_reports_location_id_fkey
  foreign key (location_id) references public.locations(id) on delete set null;
