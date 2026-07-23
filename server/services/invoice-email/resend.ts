import { Resend } from 'resend'

export interface ResendInvoiceInput {
  apiKey: string
  from: string
  replyTo?: string
  recipient: string
  subject: string
  html: string
  filename: string
  pdf: Buffer
  idempotencyKey: string
}

export type ResendInvoiceResult =
  | { ok: true; providerEmailId: string }
  | {
      ok: false
      retryable: boolean
      code: string
      message: string
    }

function safeProviderMessage(retryable: boolean): string {
  return retryable
    ? 'Nhà cung cấp email tạm thời không khả dụng'
    : 'Nhà cung cấp email từ chối yêu cầu gửi'
}

export const ResendInvoiceAdapter = {
  async send(input: ResendInvoiceInput): Promise<ResendInvoiceResult> {
    try {
      const resend = new Resend(input.apiKey)
      const response = await resend.emails.send({
        from: input.from,
        to: input.recipient,
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        attachments: [{
          filename: input.filename,
          content: input.pdf,
        }],
      }, {
        idempotencyKey: input.idempotencyKey,
      })

      if (response.data) {
        return { ok: true, providerEmailId: response.data.id }
      }

      const status = response.error.statusCode ?? 0
      const retryable = status === 429
        || status >= 500
        || response.error.name === 'rate_limit_exceeded'
        || response.error.name === 'application_error'
        || response.error.name === 'internal_server_error'
        || response.error.name === 'concurrent_idempotent_requests'
      return {
        ok: false,
        retryable,
        code: response.error.name,
        message: safeProviderMessage(retryable),
      }
    }
    catch {
      return {
        ok: false,
        retryable: true,
        code: 'network_error',
        message: safeProviderMessage(true),
      }
    }
  },
}
