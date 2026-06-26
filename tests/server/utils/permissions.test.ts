import { describe, expect, it } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can } from '../../../server/utils/permissions'

function makeUser(role: 'admin' | 'manager' | null): AuthUser {
  return {
    app_metadata: { role },
  } as AuthUser
}

describe('server permissions: can()', () => {
  it('admin has dashboard.read', () => {
    expect(can(makeUser('admin'), 'dashboard.read')).toBe(true)
  })

  it('manager has dashboard.read', () => {
    expect(can(makeUser('manager'), 'dashboard.read')).toBe(true)
  })

  it('user without role does not have dashboard.read', () => {
    expect(can(makeUser(null), 'dashboard.read')).toBe(false)
  })

  it('admin has buildings.create, manager does not', () => {
    expect(can(makeUser('admin'), 'buildings.create')).toBe(true)
    expect(can(makeUser('manager'), 'buildings.create')).toBe(false)
  })

  it('manager has buildings.read', () => {
    expect(can(makeUser('manager'), 'buildings.read')).toBe(true)
  })

  it('unknown capability returns false', () => {
    expect(can(makeUser('admin'), 'nonexistent.capability')).toBe(false)
  })
})
