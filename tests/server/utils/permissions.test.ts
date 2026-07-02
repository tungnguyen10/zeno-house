import { describe, expect, it } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can } from '../../../server/utils/permissions'

function makeUser(role: 'admin' | 'owner' | 'manager' | null): AuthUser {
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

  it('ignores top-level role and user_metadata role', () => {
    expect(can({
      role: 'admin',
      app_metadata: { role: 'manager' },
    } as unknown as AuthUser, 'buildings.delete')).toBe(false)

    expect(can({
      app_metadata: { role: null },
      user_metadata: { role: 'admin' },
    } as unknown as AuthUser, 'buildings.read')).toBe(false)
  })
})

describe('server permissions: owner capabilities', () => {
  it('owner can create/update/delete buildings', () => {
    expect(can(makeUser('owner'), 'buildings.create')).toBe(true)
    expect(can(makeUser('owner'), 'buildings.update')).toBe(true)
    expect(can(makeUser('owner'), 'buildings.delete')).toBe(true)
  })

  it('owner has full operational billing rights inside scope', () => {
    expect(can(makeUser('owner'), 'billing.close')).toBe(true)
    expect(can(makeUser('owner'), 'billing.unissue')).toBe(true)
    expect(can(makeUser('owner'), 'billing.corrections')).toBe(true)
  })

  it('owner has dashboard.read', () => {
    expect(can(makeUser('owner'), 'dashboard.read')).toBe(true)
  })

  it('owner can manage users scoped but not globally', () => {
    expect(can(makeUser('owner'), 'users.manage.scoped')).toBe(true)
    expect(can(makeUser('owner'), 'users.manage.global')).toBe(false)
  })

  it('owner can create managers but not owners', () => {
    expect(can(makeUser('owner'), 'users.create.manager')).toBe(true)
    expect(can(makeUser('owner'), 'users.create.owner')).toBe(false)
  })
})

describe('server permissions: user-management capabilities', () => {
  it('admin can manage users globally and create owners/managers', () => {
    expect(can(makeUser('admin'), 'users.manage.global')).toBe(true)
    expect(can(makeUser('admin'), 'users.create.owner')).toBe(true)
    expect(can(makeUser('admin'), 'users.create.manager')).toBe(true)
  })

  it('no role can create admin from the app', () => {
    expect(can(makeUser('admin'), 'users.create.admin')).toBe(false)
    expect(can(makeUser('owner'), 'users.create.admin')).toBe(false)
    expect(can(makeUser('manager'), 'users.create.admin')).toBe(false)
  })

  it('manager cannot manage users at all', () => {
    expect(can(makeUser('manager'), 'users.manage.global')).toBe(false)
    expect(can(makeUser('manager'), 'users.manage.scoped')).toBe(false)
    expect(can(makeUser('manager'), 'users.create.manager')).toBe(false)
  })
})
