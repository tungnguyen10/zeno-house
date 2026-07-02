import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ownerRls = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260702000001_assignments_owner_rls.sql'),
  'utf8',
)

const ownershipMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260702000000_building_ownership_metadata.sql'),
  'utf8',
)

const ownerCreateFlowRls = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260702000002_owner_building_create_rls.sql'),
  'utf8',
)

const ownerAssignmentScopeHelperRls = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260702000003_owner_assignment_scope_helper.sql'),
  'utf8',
)

describe('user_building_assignments owner RLS', () => {
  it('adds an owner self-select policy scoped to app_metadata role and auth.uid()', () => {
    expect(ownerRls).toContain('user_building_assignments_owner_select_own')
    expect(ownerRls).toContain("(auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'")
    expect(ownerRls).toContain('user_id = (select auth.uid())')
    expect(ownerRls).toMatch(/for\s+select/i)
  })

  it('allows owners to select only buildings assigned to them', () => {
    expect(ownerRls).toContain('buildings_owner_select_assigned')
    expect(ownerRls).toContain('on public.buildings')
    expect(ownerRls).toContain('assignment.user_id = (select auth.uid())')
    expect(ownerRls).toContain('assignment.building_id = buildings.id')
  })

  it('allows owners to load service summaries for assigned buildings', () => {
    expect(ownerRls).toContain('building_services_owner_select_assigned')
    expect(ownerRls).toContain('on public.building_services')
    expect(ownerRls).toContain('assignment.building_id = building_services.building_id')
  })
})

describe('building ownership metadata migration', () => {
  it('adds nullable created_by and owner_user_id columns referencing auth.users', () => {
    expect(ownershipMigration).toMatch(/add column if not exists created_by uuid references auth\.users\(id\)/i)
    expect(ownershipMigration).toMatch(/add column if not exists owner_user_id uuid references auth\.users\(id\)/i)
  })

  it('indexes the ownership columns', () => {
    expect(ownershipMigration).toContain('idx_buildings_owner_user_id')
    expect(ownershipMigration).toContain('idx_buildings_created_by')
  })
})

describe('owner create-building RLS migration', () => {
  it('allows owner insert on buildings only when provenance matches auth.uid()', () => {
    expect(ownerCreateFlowRls).toContain('buildings_owner_insert_own')
    expect(ownerCreateFlowRls).toContain('on public.buildings')
    expect(ownerCreateFlowRls).toMatch(/for\s+insert/i)
    expect(ownerCreateFlowRls).toContain('owner_user_id = (select auth.uid())')
    expect(ownerCreateFlowRls).toContain('created_by = (select auth.uid())')
  })

  it('allows owner self-assignment insert for owned buildings', () => {
    expect(ownerCreateFlowRls).toContain('user_building_assignments_owner_insert_self')
    expect(ownerCreateFlowRls).toContain('on public.user_building_assignments')
    expect(ownerCreateFlowRls).toContain('user_id = (select auth.uid())')
    expect(ownerCreateFlowRls).toContain('building.owner_user_id = (select auth.uid())')
  })
})

describe('owner assignment scope helper migration', () => {
  it('defines a security-definer helper for owner building scope', () => {
    expect(ownerAssignmentScopeHelperRls).toContain('create or replace function public.owner_has_building_scope')
    expect(ownerAssignmentScopeHelperRls).toMatch(/security\s+definer/i)
    expect(ownerAssignmentScopeHelperRls).toContain('revoke all on function public.owner_has_building_scope(uuid) from public')
    expect(ownerAssignmentScopeHelperRls).toContain('grant execute on function public.owner_has_building_scope(uuid) to authenticated')
  })

  it('uses owner_has_building_scope in owner self-assignment insert policy', () => {
    expect(ownerAssignmentScopeHelperRls).toContain('user_building_assignments_owner_insert_self')
    expect(ownerAssignmentScopeHelperRls).toContain('public.owner_has_building_scope(building_id)')
    expect(ownerAssignmentScopeHelperRls).toContain("(auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'")
    expect(ownerAssignmentScopeHelperRls).toContain('user_id = (select auth.uid())')
  })
})
