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

  it.each([null, undefined, 'unknown'])('routes missing or unknown role %s to login', (role) => {
    expect(getRedirectByRole(role)).toBe('/login')
  })
})
