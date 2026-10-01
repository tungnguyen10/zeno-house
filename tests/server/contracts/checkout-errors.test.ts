import { describe, expect, it } from 'vitest'
import { throwDbError } from '../../../server/utils/errors'

describe('checkout persistence boundary errors', () => {
  it('returns a safe conflict when an ordinary API tries to edit an allocated receipt', () => {
    expect(() => throwDbError({ code: 'P0001', message: 'CHECKOUT_RECEIPT_ALLOCATED' }, 'contractPayments.update'))
      .toThrow(expect.objectContaining({ statusCode: 409 }))
  })
})
