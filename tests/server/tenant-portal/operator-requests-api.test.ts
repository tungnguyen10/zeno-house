import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tenantSupportRequestQueueQuerySchema, tenantSupportRequestStatusUpdateSchema } from '~/utils/validators/tenant-support-requests'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), update: vi.fn(), query: vi.fn(), body: vi.fn(), param: vi.fn() }))
vi.mock('../../../server/services/tenant-portal/operator-requests', () => ({ TenantSupportRequestOperatorService: { list: mocks.list, updateStatus: mocks.update } }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.auth)
vi.stubGlobal('parseQuery', mocks.query)
vi.stubGlobal('parseBody', mocks.body)
vi.stubGlobal('getRouterParam', mocks.param)
const user = { id: 'operator', app_metadata: { role: 'owner' } }
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue(user)
  mocks.query.mockReturnValue({ page: 1, limit: 20 })
  mocks.body.mockResolvedValue({ status: 'in_progress', expected_status: 'new' })
  mocks.param.mockReturnValue(id)
})
describe('staff request endpoints', () => {
  it('returns authorized pagination envelope from the receiving service', async () => {
    const result = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
    mocks.list.mockResolvedValue(result)
    const { default: handler } = await import('../../../server/api/tenant-support-requests/index.get')
    expect(await handler({} as never)).toEqual(result)
    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), user, { page: 1, limit: 20 })
  })
  it('denies unauthenticated callers before query or status access', async () => {
    mocks.auth.mockRejectedValue({ statusCode: 401 })
    const { default: get } = await import('../../../server/api/tenant-support-requests/index.get')
    const { default: patch } = await import('../../../server/api/tenant-support-requests/[id].patch')
    await expect(get({} as never)).rejects.toMatchObject({ statusCode: 401 })
    await expect(patch({} as never)).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.query).not.toHaveBeenCalled()
    expect(mocks.body).not.toHaveBeenCalled()
  })
  it('passes the canonical request identifier and strict expected status input', async () => {
    mocks.update.mockResolvedValue({ id, status: 'in_progress' })
    const { default: handler } = await import('../../../server/api/tenant-support-requests/[id].patch')
    expect(await handler({} as never)).toEqual({ data: { id, status: 'in_progress' } })
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), user, id, { status: 'in_progress', expected_status: 'new' })
  })
  it('rejects malformed direct identifiers as404', async () => {
    mocks.param.mockReturnValue('not-an-id')
    const { default: handler } = await import('../../../server/api/tenant-support-requests/[id].patch')
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('bounds pagination and rejects unknown status/body keys', () => {
    expect(tenantSupportRequestQueueQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
    expect(tenantSupportRequestQueueQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(tenantSupportRequestQueueQuerySchema.safeParse({ status: 'approved' }).success).toBe(false)
    expect(tenantSupportRequestStatusUpdateSchema.safeParse({ status: 'resolved', expected_status: 'new', description: 'Secret' }).success).toBe(false)
  })
})
