begin;

alter table public.rooms
  drop constraint if exists rooms_status_check;

alter table public.rooms
  add constraint rooms_status_check
  check (status in ('available', 'occupied', 'maintenance', 'archived'));

commit;
