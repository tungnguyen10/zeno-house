import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export interface TenantLinkClaims { sub: string; tid: string; bid: string; exp: number }

const VERSION = 1
const MIN_SECRET_LENGTH = 32
export const TENANT_LINK_TOKEN_TTL_MS = 10 * 60 * 1000

function sign(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest()
}

export function getTenantLinkSecret(event: H3Event): string | null {
  const secret = String((useRuntimeConfig(event) as { tenantLinkSecret?: unknown }).tenantLinkSecret ?? '')
  return secret.length >= MIN_SECRET_LENGTH ? secret : null
}

export function signTenantLinkToken(
  secret: string,
  claims: Omit<TenantLinkClaims, 'exp'>,
  now = Date.now(),
): { token: string; expiresAt: string } {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error('Tenant link secret is too short')
  const exp = now + TENANT_LINK_TOKEN_TTL_MS
  const payload = Buffer.from(JSON.stringify({
    v: VERSION, sub: claims.sub, tid: claims.tid, bid: claims.bid, exp, n: randomBytes(12).toString('base64url'),
  })).toString('base64url')
  return { token: `${payload}.${sign(secret, payload).toString('base64url')}`, expiresAt: new Date(exp).toISOString() }
}

export function verifyTenantLinkToken(secret: string, token: string, now = Date.now()): TenantLinkClaims | null {
  if (secret.length < MIN_SECRET_LENGTH) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [payload, signature] = parts as [string, string]
  const expected = sign(secret, payload)
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
    if (data.v !== VERSION || typeof data.exp !== 'number' || data.exp < now) return null
    if (typeof data.sub !== 'string' || typeof data.tid !== 'string' || typeof data.bid !== 'string') return null
    return { sub: data.sub, tid: data.tid, bid: data.bid, exp: data.exp }
  }
  catch {
    return null
  }
}
