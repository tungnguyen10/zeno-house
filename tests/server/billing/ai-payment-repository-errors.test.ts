import { describe, expect, it } from 'vitest'
import { throwAiPaymentRpcError } from '../../../server/repositories/billing/payments'

describe('AI payment RPC error categories', () => {
  it.each([
    ['AI_PAYMENT_INVOICE_VERSION_CONFLICT', 'stale_version'],
    ['AI_PAYMENT_ALREADY_PAID', 'already_paid'],
    ['AI_PAYMENT_PERIOD_CLOSED', 'period_closed'],
    ['AI_PAYMENT_INVOICE_NOT_FOUND', 'invalid_invoice'],
  ])('maps %s to %s without exposing database details', (databaseMessage, paymentFailure) => {
    try {
      throwAiPaymentRpcError(new Error(databaseMessage))
    }
    catch (error) {
      expect(error).toMatchObject({
        statusCode: 409,
        data: { error: { details: {
          category: 'OPTIMISTIC_LOCK_CONFLICT',
          details: { paymentFailure },
        } } },
      })
    }
  })
})
