import { beforeAll, describe, expect, it, vi } from 'vitest'
import { classifyApiNamespace } from '../../server/utils/api-namespace'

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

let namespaceMiddleware: (event: {
  path: string
  context: Record<string, unknown>
}) => void

beforeAll(async () => {
  namespaceMiddleware = (await import('../../server/middleware/02.namespace')).default as typeof namespaceMiddleware
})

describe('API namespace classification', () => {
  it.each([
    ['/api/buildings', 'internal'],
    ['/api/billing/periods', 'internal'],
    ['/api/tenant', 'tenant'],
    ['/api/tenant?view=summary', 'tenant'],
    ['/api/tenant/profile', 'tenant'],
    ['/api/tenant/profile?locale=vi', 'tenant'],
    ['/api/auth/access-request/me', 'auth'],
    ['/login', null],
  ])('classifies %s as %s', (path, expected) => {
    expect(classifyApiNamespace(path)).toBe(expected)
  })

  it.each([
    ['/api/buildings', 'tenant'],
    ['/api/tenant/profile', 'admin'],
    ['/api/tenant?view=summary', 'admin'],
    ['/api/tenant/profile', 'owner'],
    ['/api/tenant/profile', 'manager'],
  ])('rejects %s for a %s user with the shared not-found response', (path, role) => {
    const event = {
      path,
      context: { user: { app_metadata: { role } } },
    }

    expect(() => namespaceMiddleware(event)).toThrow(expect.objectContaining({
      statusCode: 404,
      data: expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      }),
    }))
  })

  it.each(['/api/buildings', '/api/tenant/profile']) (
    'rejects an authenticated unknown role consistently on %s',
    (path) => {
      const event = {
        path,
        context: { user: { app_metadata: { role: 'unknown' } } },
      }

      expect(() => namespaceMiddleware(event)).toThrow(expect.objectContaining({
        statusCode: 404,
        data: expect.objectContaining({
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        }),
      }))
    },
  )

  it.each([
    ['/api/buildings', 'admin', 'internal'],
    ['/api/buildings', 'owner', 'internal'],
    ['/api/buildings', 'manager', 'internal'],
    ['/api/tenant/profile', 'tenant', 'tenant'],
  ])('allows %s for a %s user', (path, role, expected) => {
    const event = {
      path,
      context: { user: { app_metadata: { role } } },
    }

    expect(namespaceMiddleware(event)).toBeUndefined()
    expect(event.context.apiNamespace).toBe(expected)
  })

  it('allows a missing-role session only into the auth API namespace', () => {
    const authEvent = { path: '/api/auth/access-request/me', context: { user: { app_metadata: {} } } }
    expect(namespaceMiddleware(authEvent)).toBeUndefined()
    expect(authEvent.context.apiNamespace).toBe('auth')

    const internalEvent = { path: '/api/buildings', context: { user: { app_metadata: {} } } }
    expect(() => namespaceMiddleware(internalEvent)).toThrow(expect.objectContaining({ statusCode: 404 }))
  })

  it('leaves unauthenticated requests to endpoint authentication', () => {
    const event = { path: '/api/tenant/profile', context: { user: null } }

    expect(namespaceMiddleware(event)).toBeUndefined()
    expect(event.context.apiNamespace).toBe('tenant')
  })
})
