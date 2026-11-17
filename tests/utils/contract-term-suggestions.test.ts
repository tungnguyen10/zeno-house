import { describe, expect, it } from 'vitest'
import { CONTRACT_TERM_SUGGESTIONS, contractTermsInitialValues } from '~/utils/contracts/contract-term-suggestions'

describe('contractTermsInitialValues', () => {
  it('prefills suggestions for an empty profile and leaves fees empty', () => {
    expect(contractTermsInitialValues(null)).toMatchObject({
      ...CONTRACT_TERM_SUGGESTIONS,
      extra_occupant_fee: null,
      drilling_fee: null,
      fingerprint_reset_fee: null,
      signed_copies: 2,
      copies_per_party: 1,
      brand_name: '',
    })
  })

  it('keeps stored values, including zero, over suggestions', () => {
    const values = contractTermsInitialValues({ noticeDays: 0, renewalMonths: 0, defaultTermMonths: 6 } as never)
    expect(values.notice_days).toBe(0)
    expect(values.renewal_months).toBe(0)
    expect(values.default_term_months).toBe(6)
    expect(values.deposit_refund_days).toBe(7)
  })
})
