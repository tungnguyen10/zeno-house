import { describe, expect, it } from 'vitest'
import { throwContractCreateError } from '../../../server/repositories/contracts'

function caught(fn: () => void): { statusCode?: number; data?: { error?: { code?: string; details?: { reason?: string } } } } | null {
  try {
    fn()
    return null
  }
  catch (e) {
    return e as never
  }
}

describe('throwContractCreateError', () => {
  it.each([
    ['CONTRACT_CREATE_REQUEST_CONFLICT', 409],
    ['CONTRACT_OCCUPANT_LIMIT', 409],
    ['CONTRACT_OCCUPANT_BUSY', 409],
    ['CONTRACT_VEHICLE_DUPLICATE', 409],
  ])('maps %s to 409', (message, status) => {
    const e = caught(() => throwContractCreateError({ message }))
    expect(e?.statusCode).toBe(status)
    expect(e?.data?.error?.details?.reason).toBe(message)
  })

  it.each([
    ['CONTRACT_OCCUPANT_PRIMARY'],
    ['CONTRACT_SERVICE_INVALID'],
  ])('maps %s to 422', (message) => {
    const e = caught(() => throwContractCreateError({ message }))
    expect(e?.statusCode).toBe(422)
  })

  it('maps legacy P0001 to 409', () => {
    const e = caught(() => throwContractCreateError({ code: 'P0001', message: 'end_date must be after start_date' }))
    expect(e?.statusCode).toBe(409)
  })

  it('returns silently for unknown errors', () => {
    expect(caught(() => throwContractCreateError({ code: 'XX000', message: 'boom' }))).toBeNull()
  })
})
