import { describe, expect, it } from 'vitest'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'

describe('audit action coverage', () => {
  it('defines actions for master data, contracts, operations and tenant portal mutations', () => {
    expect(Object.values(AUDIT_ACTIONS)).toEqual(expect.arrayContaining([
      'contract_occupant.added',
      'contract_occupant.moved_out',
      'contract_occupant.removed',
      'contract_payment.created',
      'contract_payment.updated',
      'contract_payment.removed',
      'building_expense.receipt_attached',
      'building_expense.receipt_removed',
      'shared_expense.created',
      'shared_expense.updated',
      'shared_expense.deactivated',
      'shared_expense.allocated',
      'reserve_fund_rate.created',
      'reserve_fund_rate.updated',
      'reserve_fund.accrual_refreshed',
      'operations_report_period.closed',
      'operations_report_period.auto_closed',
      'operations_report_period.reopened',
      'tenant.profile_updated',
      'tenant_document.uploaded',
      'tenant_document.removed',
    ]))
  })
})
