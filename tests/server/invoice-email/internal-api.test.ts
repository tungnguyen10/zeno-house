import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getHeader: vi.fn(),
  run: vi.fn(),
}))

vi.mock('../../../server/services/invoice-email/dispatcher', () => ({
  InvoiceEmailDispatcher: { run: mocks.run },
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getHeader', mocks.getHeader)
vi.stubGlobal('useRuntimeConfig', () => ({
  invoiceEmailDispatchSecret: 'dispatch-secret',
}))

describe('invoice email internal dispatch API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.run.mockResolvedValue({
      skipped: false,
      reason: null,
      claimed: 1,
      accepted: 1,
      retried: 0,
      failed: 0,
    })
  })

  it('rejects missing or incorrect secrets without claiming work', async () => {
    mocks.getHeader.mockReturnValue('wrong')
    const { default: handler } = await import(
      '../../../server/api/internal/invoice-email/dispatch.post'
    )

    await expect(handler({ context: {} } as never))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.run).not.toHaveBeenCalled()
  })

  it('returns a safe dispatcher result for the matching secret', async () => {
    mocks.getHeader.mockReturnValue('dispatch-secret')
    const event = { context: {} } as never
    const { default: handler } = await import(
      '../../../server/api/internal/invoice-email/dispatch.post'
    )

    await expect(handler(event)).resolves.toEqual({
      data: {
        skipped: false,
        reason: null,
        claimed: 1,
        accepted: 1,
        retried: 0,
        failed: 0,
      },
    })
    expect(mocks.run).toHaveBeenCalledWith(event)
  })
})
