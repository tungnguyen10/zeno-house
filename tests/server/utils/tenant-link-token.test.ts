import { describe, expect, it } from 'vitest'
import { signTenantLinkToken, verifyTenantLinkToken } from '../../../server/utils/tenant-link-token'

const SECRET = 'x'.repeat(48)
const CLAIMS = { sub: 'actor-1', tid: 'tenant-1', bid: 'building-1' }
const NOW = Date.UTC(2026, 10, 18, 9, 0, 0)

describe('tenant link token', () => {
  it('round-trips claims with a 10 minute expiry', () => {
    const { token, expiresAt } = signTenantLinkToken(SECRET, CLAIMS, NOW)
    expect(expiresAt).toBe(new Date(NOW + 600_000).toISOString())
    expect(verifyTenantLinkToken(SECRET, token, NOW + 599_000)).toMatchObject(CLAIMS)
  })

  it('rejects an expired token', () => {
    const { token } = signTenantLinkToken(SECRET, CLAIMS, NOW)
    expect(verifyTenantLinkToken(SECRET, token, NOW + 600_001)).toBeNull()
  })

  it('rejects a token signed with another secret', () => {
    const { token } = signTenantLinkToken('y'.repeat(48), CLAIMS, NOW)
    expect(verifyTenantLinkToken(SECRET, token, NOW)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const { token } = signTenantLinkToken(SECRET, CLAIMS, NOW)
    const [, signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ v: 1, ...CLAIMS, tid: 'tenant-2', exp: NOW + 600_000, n: 'x' })).toString('base64url')
    expect(verifyTenantLinkToken(SECRET, `${forged}.${signature}`, NOW)).toBeNull()
  })

  it.each(['', 'abc', 'a.b.c', '.', 'not-base64.sig'])('rejects malformed token %j', (token) => {
    expect(verifyTenantLinkToken(SECRET, token, NOW)).toBeNull()
  })

  it('uses a fresh nonce for every token', () => {
    expect(signTenantLinkToken(SECRET, CLAIMS, NOW).token).not.toBe(signTenantLinkToken(SECRET, CLAIMS, NOW).token)
  })

  it('refuses to sign with a short secret', () => {
    expect(() => signTenantLinkToken('short', CLAIMS, NOW)).toThrow()
    expect(verifyTenantLinkToken('short', 'a.b', NOW)).toBeNull()
  })
})
