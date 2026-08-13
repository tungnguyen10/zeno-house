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
    'server/services/tenants/index.ts',
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

  it('records the successor contract created by renewal', () => {
    const code = source('server/services/contract-renewals.ts')
    expect(code).toContain('action: AUDIT_ACTIONS.CONTRACT_CREATED')
    expect(code).toContain("source: 'renewal'")
    expect(code).toContain('correlation_id: correlationId')
  })
})
