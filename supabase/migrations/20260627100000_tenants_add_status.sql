begin;

alter table public.tenants
  add column if not exists status text not null default 'active';

alter table public.tenants
  drop constraint if exists tenants_status_check;

alter table public.tenants
  add constraint tenants_status_check
  check (status in ('active', 'archived'));

create index if not exists idx_tenants_status on public.tenants (status);

commit;
