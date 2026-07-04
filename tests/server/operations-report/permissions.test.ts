import { can } from '../../../server/utils/permissions'
import type { AuthUser } from '~/types/auth'

function user(role: 'admin' | 'owner' | 'manager' | null): AuthUser {
  return {
    id: `${role ?? 'none'}-user`,
    email: `${role ?? 'none'}@example.test`,
    app_metadata: { role },
    user_metadata: {},
  } as AuthUser
}

const ALL_CAPS = [
  'operations-report.read',
  'operations-report.export',
  'building-expenses.read',
  'building-expenses.write',
  'building-expenses.delete',
  'building-fixed-costs.read',
  'building-fixed-costs.write',
] as const

describe('operations-report permission matrix', () => {
  it('grants every operations capability to admin', () => {
    const admin = user('admin')
    for (const cap of ALL_CAPS) expect(can(admin, cap)).toBe(true)
  })

  it('grants every operations capability to owner', () => {
    const owner = user('owner')
    for (const cap of ALL_CAPS) expect(can(owner, cap)).toBe(true)
  })

  it('limits manager to report read plus expense read/write only', () => {
    const manager = user('manager')

    expect(can(manager, 'operations-report.read')).toBe(true)
    expect(can(manager, 'operations-report.export')).toBe(false)
    expect(can(manager, 'building-expenses.read')).toBe(true)
    expect(can(manager, 'building-expenses.write')).toBe(true)

    // Manager cannot void expenses or manage fixed costs.
    expect(can(manager, 'building-expenses.delete')).toBe(false)
    expect(can(manager, 'building-fixed-costs.read')).toBe(false)
    expect(can(manager, 'building-fixed-costs.write')).toBe(false)
  })

  it('denies all operations capabilities when no role is present', () => {
    const anonymous = user(null)
    for (const cap of ALL_CAPS) expect(can(anonymous, cap)).toBe(false)
  })
})
