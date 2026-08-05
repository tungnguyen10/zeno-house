import { defaultInvoiceDueDate } from '../../../app/utils/billing/due-date'

describe('defaultInvoiceDueDate', () => {
  it('adds four calendar days in Asia/Ho_Chi_Minh', () => {
    expect(defaultInvoiceDueDate(new Date('2026-08-05T18:30:00.000Z'))).toBe('2026-08-10')
  })
})
