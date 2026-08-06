import {
  calculationDateInHoChiMinh,
  resolveInvoiceDueSchedule,
} from '../../../server/services/billing/invoice-due-policy'

describe('invoice due policy', () => {
  it('derives the calculation date in Asia/Ho_Chi_Minh', () => {
    expect(calculationDateInHoChiMinh(new Date('2026-08-05T18:30:00.000Z'))).toBe('2026-08-06')
  })

  it('prefers the contract due day over the building due day', () => {
    expect(resolveInvoiceDueSchedule({
      calculationDate: '2026-08-05',
      contractPaymentDueDay: 10,
      buildingPaymentDueDay: 15,
      gracePeriodDays: 2,
    })).toEqual({
      dueDate: '2026-08-10',
      gracePeriodDays: 2,
      overdueDate: '2026-08-12',
      source: 'contract',
    })
  })

  it('inherits the building due day when the contract does not override it', () => {
    expect(resolveInvoiceDueSchedule({
      calculationDate: '2026-08-05',
      contractPaymentDueDay: null,
      buildingPaymentDueDay: 15,
      gracePeriodDays: 0,
    }).dueDate).toBe('2026-08-15')
  })

  it('rolls a configured due day into the next month when this month has passed', () => {
    expect(resolveInvoiceDueSchedule({
      calculationDate: '2026-08-11',
      contractPaymentDueDay: 10,
      buildingPaymentDueDay: null,
      gracePeriodDays: 0,
    }).dueDate).toBe('2026-09-10')
  })

  it('clamps day 31 to the final day of a leap-year February', () => {
    expect(resolveInvoiceDueSchedule({
      calculationDate: '2028-02-01',
      contractPaymentDueDay: 31,
      buildingPaymentDueDay: null,
      gracePeriodDays: 0,
    }).dueDate).toBe('2028-02-29')
  })

  it('uses the four-calendar-day fallback when no due day is configured', () => {
    expect(resolveInvoiceDueSchedule({
      calculationDate: '2026-12-30',
      contractPaymentDueDay: null,
      buildingPaymentDueDay: null,
      gracePeriodDays: 0,
    })).toEqual({
      dueDate: '2027-01-03',
      gracePeriodDays: 0,
      overdueDate: '2027-01-03',
      source: 'system',
    })
  })

  it('lets a valid batch override win and keeps building grace', () => {
    expect(resolveInvoiceDueSchedule({
      calculationDate: '2026-08-05',
      dueDateOverride: '2026-08-20',
      contractPaymentDueDay: 10,
      buildingPaymentDueDay: 15,
      gracePeriodDays: 3,
    })).toEqual({
      dueDate: '2026-08-20',
      gracePeriodDays: 3,
      overdueDate: '2026-08-23',
      source: 'override',
    })
  })

  it('rejects a batch override before the calculation date', () => {
    expect(() => resolveInvoiceDueSchedule({
      calculationDate: '2026-08-05',
      dueDateOverride: '2026-08-04',
      contractPaymentDueDay: null,
      buildingPaymentDueDay: null,
      gracePeriodDays: 0,
    })).toThrow('Hạn thanh toán không được trước ngày phát hành')
  })
})
