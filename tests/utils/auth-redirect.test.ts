import { describe, expect, it } from 'vitest'
import { getRedirectByRole } from '../../app/utils/auth-redirect'

describe('getRedirectByRole', () => {
  it.each([
    ['admin', '/dashboard'],
    ['owner', '/dashboard'],
    ['manager', '/dashboard'],
    ['tenant', '/portal'],
  ])('routes the %s role to %s', (role, expected) => {
    expect(getRedirectByRole(role)).toBe(expected)
  })

  it.each([null, undefined])('routes missing role %s to pending', (role) => {
    expect(getRedirectByRole(role)).toBe('/auth/pending')
  })

  it('routes an unknown non-empty role to login', () => {
    const role = 'unknown'
    expect(getRedirectByRole(role)).toBe('/login')
  })
})
