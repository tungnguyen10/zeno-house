-- Fix RLS policies for buildings table.
-- Previous migration used auth.jwt() ->> 'role' which returns the Supabase
-- built-in PostgreSQL role ('authenticated'), not our custom app role.
-- Correct path is auth.jwt() -> 'app_metadata' ->> 'role'.

begin;

drop policy if exists "buildings_admin_all" on public.buildings;
drop policy if exists "buildings_manager_select" on public.buildings;

-- Admin: full access
create policy "buildings_admin_all"
  on public.buildings
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read only
create policy "buildings_manager_select"
  on public.buildings
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

commit;
