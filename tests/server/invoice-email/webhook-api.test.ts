import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  handle: vi.fn(),
  readRawBody: vi.fn(),
  getHeader: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: vi.fn(function Resend() {
    return { webhooks: { verify: mocks.verify } }
  }),
}))
vi.mock('../../../server/services/invoice-email/webhook', () => ({
  InvoiceEmailWebhookService: { handle: mocks.handle },
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readRawBody', mocks.readRawBody)
vi.stubGlobal('getHeader', mocks.getHeader)
vi.stubGlobal('useRuntimeConfig', () => ({
  resendApiKey: 're_test',
  resendWebhookSecret: 'whsec_test',
}))

describe('Resend invoice webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readRawBody.mockResolvedValue('{"type":"email.delivered"}')
    mocks.getHeader.mockImplementation((_event: unknown, name: string) => ({
      'webhook-id': 'msg-1',
      'webhook-timestamp': '1721700000',
      'webhook-signature': 'v1,signature',
    })[name])
    mocks.verify.mockReturnValue({
      type: 'email.delivered',
      created_at: '2026-07-23T01:00:00.000Z',
      data: { email_id: 'email-1' },
    })
    mocks.handle.mockResolvedValue({ duplicate: false, matched: true, updated: true })
  })

  it('rejects missing and invalid signatures before persisting an event', async () => {
    const { default: handler } = await import(
      '../../../server/api/webhooks/resend.post'
    )

    mocks.getHeader.mockReturnValueOnce(undefined)
    await expect(handler({ context: {} } as never))
      .rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.handle).not.toHaveBeenCalled()

    mocks.getHeader.mockImplementation((_event: unknown, name: string) => ({
      'webhook-id': 'msg-1',
      'webhook-timestamp': '1721700000',
      'webhook-signature': 'v1,invalid',
    })[name])
    mocks.verify.mockImplementationOnce(() => {
      throw new Error('invalid signature')
    })
    await expect(handler({ context: {} } as never))
      .rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.handle).not.toHaveBeenCalled()
  })

  it('verifies the raw body and delegates supported events to the atomic state handler', async () => {
    const event = { context: {} } as never
    const { default: handler } = await import(
      '../../../server/api/webhooks/resend.post'
    )

    await expect(handler(event)).resolves.toEqual({
      data: { duplicate: false, matched: true, updated: true },
    })
    expect(mocks.verify).toHaveBeenCalledWith({
      payload: '{"type":"email.delivered"}',
      headers: {
        id: 'msg-1',
        timestamp: '1721700000',
        signature: 'v1,signature',
      },
      webhookSecret: 'whsec_test',
    })
    expect(mocks.handle).toHaveBeenCalledWith(event, {
      svixId: 'msg-1',
      providerEmailId: 'email-1',
      type: 'email.delivered',
      eventCreatedAt: '2026-07-23T01:00:00.000Z',
    })
  })

  it('acknowledges unsupported events without writing delivery state', async () => {
    mocks.verify.mockReturnValue({
      type: 'email.opened',
      created_at: '2026-07-23T01:00:00.000Z',
      data: { email_id: 'email-1' },
    })
    const { default: handler } = await import(
      '../../../server/api/webhooks/resend.post'
    )

    await expect(handler({ context: {} } as never))
      .resolves.toEqual({ data: { ignored: true } })
    expect(mocks.handle).not.toHaveBeenCalled()
  })
})
