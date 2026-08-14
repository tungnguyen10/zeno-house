import { describe, expect, it } from 'vitest'
import { throwContractAmendmentRpcError } from '../../../server/repositories/contract-amendments'

describe('contract amendment RPC error mapping', () => {
  it('maps optimistic and invoice conflicts to actionable 409 responses', () => {
    expect(() => throwContractAmendmentRpcError({ message: 'AMENDMENT_VERSION_CONFLICT' }))
      .toThrowError(expect.objectContaining({ statusCode: 409 }))
    expect(() => throwContractAmendmentRpcError({ message: 'AMENDMENT_INVOICE_CONFLICT' }))
      .toThrowError(expect.objectContaining({ statusCode: 409 }))
  })

  it('maps invalid lifecycle and effective-date transitions to validation errors', () => {
    expect(() => throwContractAmendmentRpcError({ message: 'AMENDMENT_REQUIRES_MONTH_BOUNDARY' }))
      .toThrowError(expect.objectContaining({ statusCode: 422 }))
    expect(() => throwContractAmendmentRpcError({ message: 'AMENDMENT_NOT_SCHEDULED' }))
      .toThrowError(expect.objectContaining({ statusCode: 422 }))
  })
})
