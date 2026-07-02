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
