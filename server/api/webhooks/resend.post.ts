import { Resend } from 'resend'
import type { SupportedResendInvoiceEvent } from '../../services/invoice-email/webhook'
import { InvoiceEmailWebhookService } from '../../services/invoice-email/webhook'

const SUPPORTED = new Set<SupportedResendInvoiceEvent>([
  'email.sent',
  'email.delivered',
  'email.failed',
  'email.bounced',
  'email.complained',
])

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = config.resendWebhookSecret
  const rawBody = await readRawBody(event)
  const id = getHeader(event, 'webhook-id')
  const timestamp = getHeader(event, 'webhook-timestamp')
  const signature = getHeader(event, 'webhook-signature')
  if (!secret || !rawBody || !id || !timestamp || !signature) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid webhook signature' })
  }

  let payload
  try {
    payload = new Resend(config.resendApiKey || 're_webhook_verification').webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    })
  }
  catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid webhook signature' })
  }

  if (!SUPPORTED.has(payload.type as SupportedResendInvoiceEvent)) {
    return { data: { ignored: true } }
  }
  if (!('email_id' in payload.data) || typeof payload.data.email_id !== 'string') {
    return { data: { ignored: true } }
  }

  return {
    data: await InvoiceEmailWebhookService.handle(event, {
      svixId: id,
      providerEmailId: payload.data.email_id,
      type: payload.type as SupportedResendInvoiceEvent,
      eventCreatedAt: payload.created_at,
    }),
  }
})
