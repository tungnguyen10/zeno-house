import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { InvoiceEmailDeliveryRepository } from '../../repositories/invoice-email-deliveries'
import type { InternalInvoiceEmailDeliveryRow } from '../../repositories/invoice-email-deliveries'
import { InvoiceEmailDocumentService } from './document'
import { InvoiceEmailAssetService } from './assets'
import { invoiceEmailSubject, renderInvoiceEmailHtml } from './html'
import { invoicePdfFilename, renderInvoicePdf } from './pdf'
import { ResendInvoiceAdapter } from './resend'

const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 360] as const

export interface InvoiceEmailDispatchResult {
  skipped: boolean
  reason: string | null
  claimed: number
  accepted: number
  retried: number
  failed: number
}

function enabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  return false
}

async function dispatchOne(
  event: H3Event,
  workerId: string,
  row: InternalInvoiceEmailDeliveryRow,
  config: {
    apiKey: string
    from: string
    replyTo?: string
  },
): Promise<'accepted' | 'retried' | 'failed'> {
  if (!row.recipient_email) {
    await InvoiceEmailDeliveryRepository.markFailed(event, {
      id: row.id,
      workerId,
      failedAt: new Date().toISOString(),
      errorCode: 'recipient_missing',
      errorMessage: 'Hoá đơn không có địa chỉ email người nhận',
    })
    return 'failed'
  }

  let document
  let pdf: Buffer
  let assets
  try {
    document = await InvoiceEmailDocumentService.build(event, row.invoice_id)
    assets = await InvoiceEmailAssetService.load(event, document)
    pdf = await renderInvoicePdf(document, assets)
  }
  catch {
    await InvoiceEmailDeliveryRepository.markFailed(event, {
      id: row.id,
      workerId,
      failedAt: new Date().toISOString(),
      errorCode: 'rendering_error',
      errorMessage: 'Không thể tạo tài liệu hoá đơn',
    })
    return 'failed'
  }

  const result = await ResendInvoiceAdapter.send({
    apiKey: config.apiKey,
    from: config.from,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    recipient: row.recipient_email,
    subject: invoiceEmailSubject(document),
    html: renderInvoiceEmailHtml(document, assets),
    filename: invoicePdfFilename(document.invoiceCode),
    pdf,
    idempotencyKey: row.id,
  })

  if (result.ok) {
    // If this persistence step fails, leave the processing lease intact. A
    // reclaimed job will use the same delivery UUID, so Resend deduplicates it.
    await InvoiceEmailDeliveryRepository.markAccepted(event, {
      id: row.id,
      workerId,
      providerEmailId: result.providerEmailId,
      acceptedAt: new Date().toISOString(),
    })
    return 'accepted'
  }

  if (result.retryable && row.attempt_count < 6) {
    const delayMinutes = RETRY_DELAYS_MINUTES[row.attempt_count - 1]
    if (delayMinutes !== undefined) {
      await InvoiceEmailDeliveryRepository.markRetry(event, {
        id: row.id,
        workerId,
        nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        errorCode: result.code,
        errorMessage: result.message,
      })
      return 'retried'
    }
  }

  await InvoiceEmailDeliveryRepository.markFailed(event, {
    id: row.id,
    workerId,
    failedAt: new Date().toISOString(),
    errorCode: result.code,
    errorMessage: result.message,
  })
  return 'failed'
}

export const InvoiceEmailDispatcher = {
  async run(event: H3Event): Promise<InvoiceEmailDispatchResult> {
    const runtime = useRuntimeConfig(event)
    if (!enabled(runtime.public.invoiceEmailEnabled)) {
      return {
        skipped: true,
        reason: 'feature_disabled',
        claimed: 0,
        accepted: 0,
        retried: 0,
        failed: 0,
      }
    }
    if (!runtime.resendApiKey || !runtime.resendFrom) {
      return {
        skipped: true,
        reason: 'missing_provider_config',
        claimed: 0,
        accepted: 0,
        retried: 0,
        failed: 0,
      }
    }

    const workerId = randomUUID()
    const rows = await InvoiceEmailDeliveryRepository.claim(event, workerId, 20)
    const outcomes: Array<'accepted' | 'retried' | 'failed'> = []
    for (let index = 0; index < rows.length; index += 3) {
      outcomes.push(...await Promise.all(
        rows.slice(index, index + 3).map(row => dispatchOne(event, workerId, row, {
          apiKey: runtime.resendApiKey,
          from: runtime.resendFrom,
          ...(runtime.resendReplyTo ? { replyTo: runtime.resendReplyTo } : {}),
        })),
      ))
    }

    return {
      skipped: false,
      reason: null,
      claimed: rows.length,
      accepted: outcomes.filter(outcome => outcome === 'accepted').length,
      retried: outcomes.filter(outcome => outcome === 'retried').length,
      failed: outcomes.filter(outcome => outcome === 'failed').length,
    }
  },
}
