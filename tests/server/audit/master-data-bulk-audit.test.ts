import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('master-data bulk audit wiring', () => {
  it('uses the canonical tenant activation action', () => {
    const code = source('server/services/tenants/index.ts')
    expect(code).toMatch(/input\.action === 'activate'\s*\? AUDIT_ACTIONS\.TENANT_ACTIVATED/)
  })

  it('uses removed children for building bulk delete', () => {
    const code = source('server/services/buildings/index.ts')
    expect(code).toContain("input.action === 'delete' ? AUDIT_ACTIONS.BUILDING_REMOVED")
  })

  it.each([
    'server/services/buildings/index.ts',
    'server/services/rooms/index.ts',
    'server/services/tenants/index.ts',
    'server/services/contracts/index.ts',
  ])('suppresses standalone delete audit before correlated bulk children in %s', (path) => {
    const code = source(path)
    expect(code).toContain('emitAudit: false')
  })

  it.each([
    'server/services/rooms/index.ts',
    'server/services/contracts/index.ts',
  ])('resolves child building scope in %s', (path) => {
    const code = source(path)
    expect(code).toContain('building_id: scopes.get(id)')
  })
})

describe('correlated contract side-effect audit wiring', () => {
  it('records room status changes with the contract correlation id', () => {
    const code = source('server/services/contracts/index.ts')
    expect(code).toContain('action: AUDIT_ACTIONS.ROOM_UPDATED')
    expect(code).toContain('correlation_id: correlationId')
  })

  it('records successor and transferred-source audits in the atomic renewal transaction', () => {
    const code = source('supabase/migrations/20261105120000_atomic_contract_renewal.sql')
    expect(code).toContain("'contract.created', 'contract', new_row.id, p_correlation_id, to_jsonb(new_row)")
    expect(code).toContain("jsonb_build_object('source', 'renewal', 'renewal_id', renewal.id, 'previous_contract_id', old_row.id)")
    expect(code).toContain("'contract.checkout_source.transferred', 'contract', new_row.id, p_correlation_id")
    expect(code).toContain("jsonb_build_object('from_contract_id', old_row.id, 'renewal_id', renewal.id, 'sources', v_sources)")
  })
})
