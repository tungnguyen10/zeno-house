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
    ['/api/portal', 'portal'],
    ['/api/portal/profile', 'portal'],
    ['/login', null],
  ])('classifies %s as %s', (path, expected) => {
    expect(classifyApiNamespace(path)).toBe(expected)
  })

  it.each([
    ['/api/buildings', 'tenant', 'internal'],
    ['/api/portal/profile', 'admin', 'portal'],
  ])('records %s for a %s user without rejecting the request', (path, role, expected) => {
    const event = {
      path,
      context: { user: { app_metadata: { role } } },
    }

    expect(namespaceMiddleware(event)).toBeUndefined()
    expect(event.context.apiNamespace).toBe(expected)
  })
})
