import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  removeDraft: vi.fn(),
  publish: vi.fn(),
  cancel: vi.fn(),
  applyDue: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('../../../server/services/contract-amendments', () => ({
  ContractAmendmentService: {
    list: mocks.list,
    create: mocks.create,
    update: mocks.update,
    removeDraft: mocks.removeDraft,
    publish: mocks.publish,
    cancel: mocks.cancel,
    applyDue: mocks.applyDue,
  },
}))

type MockEvent = {
  context: {
    params?: Record<string, string>
    body?: unknown
    statusCode?: number
    headers?: Record<string, string>
  }
}

function event(body?: unknown): MockEvent {
  return {
    context: {
      params: { id: 'contract-1', amendmentId: 'amendment-1' },
      body,
      headers: { 'x-contract-amendments-secret': 'worker-secret' },
    },
  }
}

describe('contract amendment API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'user-1', app_metadata: { role: 'admin' } })
    vi.stubGlobal('defineEventHandler', (handler: (event: MockEvent) => unknown) => handler)
    vi.stubGlobal('requireAuth', mocks.requireAuth)
    vi.stubGlobal('getRouterParam', (input: MockEvent, key: string) => input.context.params?.[key])
    vi.stubGlobal('readBody', async (input: MockEvent) => input.context.body)
    vi.stubGlobal('setResponseStatus', (input: MockEvent, code: number) => { input.context.statusCode = code })
    vi.stubGlobal('useRuntimeConfig', () => ({ contractAmendmentsApplySecret: 'worker-secret' }))
    vi.stubGlobal('getHeader', (input: MockEvent, key: string) => input.context.headers?.[key])
  })

  it('lists and creates amendments under the resolved contract route', async () => {
    mocks.list.mockResolvedValue([])
    mocks.create.mockResolvedValue({ id: 'amendment-1' })
    const getHandler = (await import('../../../server/api/contracts/[id]/amendments.get')).default
    const postHandler = (await import('../../../server/api/contracts/[id]/amendments.post')).default

    await expect(getHandler(event() as never)).resolves.toEqual({ data: [] })
    const request = event({
      title: 'Điều chỉnh tiền thuê',
      public_content: 'Áp dụng từ kỳ tiếp theo.',
      effective_date: '2026-09-01',
      changes: { monthly_rent: 4_000_000 },
    })
    await expect(postHandler(request as never)).resolves.toEqual({ data: { id: 'amendment-1' } })
    expect(request.context.statusCode).toBe(201)
  })

  it('updates, deletes, publishes, and cancels through lifecycle services', async () => {
    mocks.update.mockResolvedValue({ id: 'amendment-1', status: 'draft' })
    mocks.publish.mockResolvedValue({ id: 'amendment-1', status: 'scheduled' })
    mocks.cancel.mockResolvedValue({ id: 'amendment-1', status: 'cancelled' })
    const patchHandler = (await import('../../../server/api/contracts/[id]/amendments/[amendmentId].patch')).default
    const deleteHandler = (await import('../../../server/api/contracts/[id]/amendments/[amendmentId].delete')).default
    const publishHandler = (await import('../../../server/api/contracts/[id]/amendments/[amendmentId]/publish.post')).default
    const cancelHandler = (await import('../../../server/api/contracts/[id]/amendments/[amendmentId]/cancel.post')).default
    const timestamp = '2026-08-14T09:00:00.000Z'

    await patchHandler(event({
      title: 'Điều chỉnh', public_content: 'Nội dung', effective_date: '2026-09-01',
      changes: { deposit: 1 }, expected_updated_at: timestamp,
    }) as never)
    const deleteEvent = event({ expected_updated_at: timestamp })
    await deleteHandler(deleteEvent as never)
    expect(deleteEvent.context.statusCode).toBe(204)
    await publishHandler(event({ expected_updated_at: timestamp }) as never)
    await cancelHandler(event({ expected_updated_at: timestamp, reason: 'Gia hạn hợp đồng' }) as never)

    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.removeDraft).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'contract-1', 'amendment-1', timestamp)
    expect(mocks.publish).toHaveBeenCalledTimes(1)
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
  })

  it('protects the due-amendment worker with the private runtime secret', async () => {
    mocks.applyDue.mockResolvedValue([{ id: 'amendment-1' }])
    const handler = (await import('../../../server/api/internal/contracts/amendments/apply-due.post')).default

    await expect(handler(event() as never)).resolves.toEqual({ data: { applied: 1, amendmentIds: ['amendment-1'] } })
    expect(mocks.applyDue).toHaveBeenCalledTimes(1)

    const denied = event()
    denied.context.headers = {}
    await expect(handler(denied as never)).rejects.toMatchObject({ statusCode: 403 })
  })
})
