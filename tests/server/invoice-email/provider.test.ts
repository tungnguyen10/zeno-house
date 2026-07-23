import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: vi.fn(function Resend() {
    return { emails: { send: mocks.send } }
  }),
}))

const input = {
  apiKey: 're_test',
  from: 'Zeno House <billing@example.test>',
  replyTo: 'support@example.test',
  recipient: 'tenant@example.test',
  subject: 'Hoá đơn INV-1',
  html: '<p>Hoá đơn</p>',
  filename: 'hoa-don-inv-1.pdf',
  pdf: Buffer.from('%PDF-test'),
  idempotencyKey: 'delivery-1',
}

describe('ResendInvoiceAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends HTML and PDF with the stable delivery idempotency key', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null })
    const { ResendInvoiceAdapter } = await import(
      '../../../server/services/invoice-email/resend'
    )

    await expect(ResendInvoiceAdapter.send(input)).resolves.toEqual({
      ok: true,
      providerEmailId: 'email-1',
    })
    expect(mocks.send).toHaveBeenCalledWith({
      from: input.from,
      to: input.recipient,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
      attachments: [{ filename: input.filename, content: input.pdf }],
    }, {
      idempotencyKey: 'delivery-1',
    })
  })

  it('classifies 429 and network failures as retryable without exposing provider content', async () => {
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: { statusCode: 429, name: 'rate_limit_exceeded', message: 'raw provider detail' },
    })
    const { ResendInvoiceAdapter } = await import(
      '../../../server/services/invoice-email/resend'
    )

    await expect(ResendInvoiceAdapter.send(input)).resolves.toEqual({
      ok: false,
      retryable: true,
      code: 'rate_limit_exceeded',
      message: 'Nhà cung cấp email tạm thời không khả dụng',
    })

    mocks.send.mockRejectedValueOnce(new Error('socket timeout with recipient data'))
    await expect(ResendInvoiceAdapter.send(input)).resolves.toEqual({
      ok: false,
      retryable: true,
      code: 'network_error',
      message: 'Nhà cung cấp email tạm thời không khả dụng',
    })
  })

  it('classifies validation failures as terminal and masks the provider message', async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { statusCode: 422, name: 'validation_error', message: 'raw provider detail' },
    })
    const { ResendInvoiceAdapter } = await import(
      '../../../server/services/invoice-email/resend'
    )

    await expect(ResendInvoiceAdapter.send(input)).resolves.toEqual({
      ok: false,
      retryable: false,
      code: 'validation_error',
      message: 'Nhà cung cấp email từ chối yêu cầu gửi',
    })
  })
})
