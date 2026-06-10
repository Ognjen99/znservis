-- Worker login by name (Ime + Lozinka) and allow worker deletion

alter table public.profiles
  add column if not exists login_name text;

update public.profiles
set login_name = lower(trim(full_name))
where role = 'worker'
  and login_name is null;

create unique index if not exists profiles_worker_login_name_unique
  on public.profiles (login_name)
  where role = 'worker' and login_name is not null;

alter table public.work_reports
  drop constraint if exists work_reports_worker_id_fkey;

alter table public.work_reports
  alter column worker_id drop not null;

alter table public.work_reports
  add constraint work_reports_worker_id_fkey
  foreign key (worker_id) references public.profiles(id) on delete set null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_login_name text;
begin
  resolved_login_name := coalesce(
    new.raw_user_meta_data ->> 'login_name',
    lower(trim(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))))
  );

  insert into public.profiles (id, full_name, login_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case
      when coalesce(new.raw_user_meta_data ->> 'role', 'worker') = 'worker'
        then resolved_login_name
      else null
    end,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'worker')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    login_name = excluded.login_name;

  return new;
end;
$$;
