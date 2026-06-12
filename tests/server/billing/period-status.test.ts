import { assertPeriodCanTransition } from '../../../server/services/billing/rules'

describe('billing period status rules', () => {
  it('allows drafted to issued to collecting to closed happy path', () => {
    expect(() => assertPeriodCanTransition('draft', 'issued')).not.toThrow()
    expect(() => assertPeriodCanTransition('issued', 'collecting')).not.toThrow()
    expect(() => assertPeriodCanTransition('collecting', 'closed')).not.toThrow()
  })

  it('blocks transitions from closed', () => {
    expect(() => assertPeriodCanTransition('closed', 'collecting')).toThrowError(
      expect.objectContaining({ statusCode: 409 }),
    )
  })
})
