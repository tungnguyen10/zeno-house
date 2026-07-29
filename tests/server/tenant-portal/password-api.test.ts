import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  change: vi.fn(),
}))

vi.mock('../../../server/services/tenant-portal/password', () => ({
  TenantPasswordService: { change: mocks.change },
}))

type MockEvent = { context: { body?: unknown } }
const tenantUser = { id: 'auth-tenant', app_metadata: { role: 'tenant' } }

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('parseBody', async (
  event: MockEvent,
  schema: { parse: (value: unknown) => unknown },
) => schema.parse(event.context.body))

describe('POST /api/tenant/password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue(tenantUser)
    mocks.change.mockResolvedValue(undefined)
  })

  it('parses the password payload and returns an empty success envelope', async () => {
    const { default: handler } = await import('../../../server/api/tenant/password.post')
    const body = {
      current_password: 'mat-khau-cu',
      password: 'mat-khau-moi',
      password_confirmation: 'mat-khau-moi',
    }

    await expect(handler({ context: { body } } as never)).resolves.toEqual({ data: null })
    expect(mocks.change).toHaveBeenCalledWith(expect.anything(), tenantUser, body)
  })
})
