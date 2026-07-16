import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => vi.fn())

vi.mock('../../../server/utils/db', () => ({ db: dbMock }))

function queryResult(data: { tenant_id: string } | null, error: unknown = null) {
  const calls: Array<{ column: string; value: string }> = []
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: string) => {
      calls.push({ column, value })
      return query
    }),
    maybeSingle: vi.fn(async () => ({ data, error })),
  }

  return {
    calls,
    client: { from: vi.fn(() => query) },
  }
}

describe('getTenantIdForAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the active tenant link for the auth user', async () => {
    const mock = queryResult({ tenant_id: 'tenant-a' })
    dbMock.mockReturnValue(mock.client)
    const { getTenantIdForAuthUser } = await import('../../../server/repositories/tenant-portal/links')

    await expect(getTenantIdForAuthUser({} as never, 'auth-user-a')).resolves.toBe('tenant-a')
    expect(mock.client.from).toHaveBeenCalledWith('tenant_user_links')
    expect(mock.calls).toEqual([
      { column: 'auth_user_id', value: 'auth-user-a' },
      { column: 'status', value: 'active' },
    ])
  })

  it('returns null when the active link is missing or disabled', async () => {
    const mock = queryResult(null)
    dbMock.mockReturnValue(mock.client)
    const { getTenantIdForAuthUser } = await import('../../../server/repositories/tenant-portal/links')

    await expect(getTenantIdForAuthUser({} as never, 'auth-user-a')).resolves.toBeNull()
  })

  it('normalizes database failures', async () => {
    const mock = queryResult(null, { code: 'XX000', message: 'raw database error' })
    dbMock.mockReturnValue(mock.client)
    const { getTenantIdForAuthUser } = await import('../../../server/repositories/tenant-portal/links')

    await expect(getTenantIdForAuthUser({} as never, 'auth-user-a')).rejects.toMatchObject({
      statusCode: 500,
      data: { error: { code: 'INTERNAL' } },
    })
  })
})
