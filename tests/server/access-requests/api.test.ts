import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getMine: vi.fn(),
  list: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
}))

vi.mock('../../../server/services/access-requests', () => ({
  AccessRequestService: {
    getMine: mocks.getMine,
    list: mocks.list,
    approve: mocks.approve,
    reject: mocks.reject,
  },
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
interface TestEvent { context: { params?: Record<string, string>; query?: unknown; body?: unknown } }
vi.stubGlobal('getRouterParam', (event: TestEvent, key: string) => event.context.params?.[key])
vi.stubGlobal('parseQuery', (event: TestEvent, schema: ZodType) => schema.parse(event.context.query ?? {}))
vi.stubGlobal('parseBody', async (event: TestEvent, schema: ZodType) => schema.parse(event.context.body))

const user = { id: 'admin-1', app_metadata: { role: 'admin' } }
const event = (context: Record<string, unknown> = {}) => ({ context }) as never

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue(user)
  mocks.getMine.mockResolvedValue({ status: 'pending', email: 'x@example.com' })
  mocks.list.mockResolvedValue([])
  mocks.approve.mockResolvedValue({ id: 'r-1', status: 'approved' })
  mocks.reject.mockResolvedValue({ id: 'r-1', status: 'rejected' })
})

describe('access request API', () => {
  it('returns the authenticated user own request', async () => {
    const handler = (await import('../../../server/api/auth/access-request/me.get')).default
    await expect(handler(event())).resolves.toEqual({ data: { status: 'pending', email: 'x@example.com' } })
    expect(mocks.getMine).toHaveBeenCalledWith(expect.anything(), user)
  })

  it('validates and forwards approval and rejection decisions', async () => {
    const approve = (await import('../../../server/api/access-requests/[id]/approve.post')).default
    const reject = (await import('../../../server/api/access-requests/[id]/reject.post')).default
    await approve(event({ params: { id: 'r-1' }, body: { role: 'manager', building_ids: ['00000000-0000-4000-8000-000000000001'] } }))
    await reject(event({ params: { id: 'r-1' }, body: { reason: 'Không phù hợp.' } }))
    expect(mocks.approve).toHaveBeenCalledWith(expect.anything(), user, 'r-1', expect.objectContaining({ role: 'manager' }))
    expect(mocks.reject).toHaveBeenCalledWith(expect.anything(), user, 'r-1', { reason: 'Không phù hợp.' })
  })
})
