begin;

alter table public.building_expenses
  add column if not exists receipt_url text;

alter table public.building_expenses
  drop constraint if exists building_expenses_category_check;

alter table public.building_expenses
  add constraint building_expenses_category_check
  check (category in (
    'electricity_input',
    'water_input',
    'internet',
    'cleaning',
    'repair',
    'admin_fee',
    'supplies',
    'staff',
    'rent_adjustment',
    'insurance',
    'bank_fee',
    'fire_safety',
    'other'
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists expense_receipts_admin_all on storage.objects;
create policy expense_receipts_admin_all
  on storage.objects
  for all
  using (
    bucket_id = 'expense-receipts'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'expense-receipts'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists expense_receipts_assigned_select on storage.objects;
create policy expense_receipts_assigned_select
  on storage.objects
  for select
  using (
    bucket_id = 'expense-receipts'
    and (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      or exists (
        select 1
        from public.user_building_assignments assignment
        where assignment.user_id = auth.uid()
          and assignment.building_id::text = split_part(storage.objects.name, '/', 1)
      )
    )
  );

grant select, insert, update, delete on storage.objects to authenticated;

commit;
