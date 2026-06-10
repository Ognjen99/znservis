with group_seed(name) as (
  values
    ('CCTV'),
    ('Kamere'),
    ('Snimaci'),
    ('Mrezna oprema'),
    ('Switch-evi'),
    ('Ruteri'),
    ('Kablovi'),
    ('UTP/FTP'),
    ('Alarmni sistemi'),
    ('Senzori'),
    ('Kontrola pristupa'),
    ('Citaci i brave')
)
insert into public.material_groups (name)
select seed.name
from group_seed seed
where not exists (
  select 1
  from public.material_groups existing
  where existing.name = seed.name
);

with material_seed(name, group_name, unit) as (
  values
    ('IP kamera 4MP', 'Kamere', 'kom'),
    ('Dome kamera', 'Kamere', 'kom'),
    ('NVR 8 kanala', 'Snimaci', 'kom'),
    ('PoE switch 8 portova', 'Switch-evi', 'kom'),
    ('Router', 'Ruteri', 'kom'),
    ('UTP CAT6 kabl', 'UTP/FTP', 'm'),
    ('FTP CAT6 kabl', 'UTP/FTP', 'm'),
    ('PIR senzor', 'Senzori', 'kom'),
    ('Magnetni kontakt', 'Senzori', 'kom'),
    ('RFID citac', 'Citaci i brave', 'kom')
)
insert into public.materials (name, group_id, unit)
select seed.name, material_group.id, seed.unit::public.material_unit
from material_seed seed
cross join lateral (
  select id
  from public.material_groups
  where name = seed.group_name
  order by created_at
  limit 1
) material_group
where not exists (
  select 1
  from public.materials existing
  where existing.name = seed.name
);

with location_seed(name, address, notes) as (
  values
    ('Magacin ZN Servis', 'Unesite adresu', 'Primer lokacije'),
    ('Test klijent', 'Unesite adresu', 'Primer klijenta za proveru toka rada')
)
insert into public.locations (name, address, notes)
select seed.name, seed.address, seed.notes
from location_seed seed
where not exists (
  select 1
  from public.locations existing
  where existing.name = seed.name
);
