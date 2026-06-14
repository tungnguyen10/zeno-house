import { can } from '../../../server/utils/permissions'
import type { AuthUser } from '~/types/auth'

function user(role: 'admin' | 'manager' | null): AuthUser {
  return {
    id: `${role ?? 'none'}-user`,
    email: `${role ?? 'none'}@example.test`,
    app_metadata: { role },
    user_metadata: {},
  } as AuthUser
}

describe('billing permission matrix', () => {
  it('allows admins to read, write, close, and unissue billing periods', () => {
    const admin = user('admin')

    expect(can(admin, 'billing.read')).toBe(true)
    expect(can(admin, 'billing.write')).toBe(true)
    expect(can(admin, 'billing.close')).toBe(true)
    expect(can(admin, 'billing.unissue')).toBe(true)
  })

  it('allows managers to read/write billing but blocks close and unissue', () => {
    const manager = user('manager')

    expect(can(manager, 'billing.read')).toBe(true)
    expect(can(manager, 'billing.write')).toBe(true)
    expect(can(manager, 'billing.close')).toBe(false)
    expect(can(manager, 'billing.unissue')).toBe(false)
  })

  it('denies billing capabilities when no role is present', () => {
    const anonymous = user(null)

    expect(can(anonymous, 'billing.read')).toBe(false)
    expect(can(anonymous, 'billing.write')).toBe(false)
    expect(can(anonymous, 'billing.close')).toBe(false)
  })
})
