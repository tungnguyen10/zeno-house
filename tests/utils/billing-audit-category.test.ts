import { describe, expect, it } from 'vitest'
import {
  BILLING_AUDIT_ACTION_CATEGORY,
  BILLING_AUDIT_ACTIONS,
  billingAuditActionsForCategories,
} from '../../app/utils/constants/billing'

describe('billing audit category mapping (design D9)', () => {
  it('maps every action code to exactly one category', () => {
    for (const action of Object.values(BILLING_AUDIT_ACTIONS)) {
      expect(BILLING_AUDIT_ACTION_CATEGORY[action]).toBeDefined()
    }
  })

  it('returns destructive actions: void, undo, unissue', () => {
    const actions = billingAuditActionsForCategories(['destructive'])
    expect(actions).toEqual(expect.arrayContaining([
      'invoice.voided',
      'payment.undone',
      'period.unissued',
    ]))
    expect(actions).not.toContain('invoices.issued')
  })

  it('classifies period.reopened as a status change, not destructive', () => {
    expect(BILLING_AUDIT_ACTION_CATEGORY['period.reopened']).toBe('status')
    expect(billingAuditActionsForCategories(['status'])).toContain('period.reopened')
    expect(billingAuditActionsForCategories(['destructive'])).not.toContain('period.reopened')
  })

  it('classifies invoice.printed and payment events under create', () => {
    expect(BILLING_AUDIT_ACTION_CATEGORY['invoice.printed']).toBe('create')
    const create = billingAuditActionsForCategories(['create'])
    expect(create).toEqual(expect.arrayContaining([
      'invoices.issued',
      'invoice.payment_recorded',
      'payments.bulk_recorded',
      'invoice.printed',
    ]))
  })

  it('combines multiple categories', () => {
    const actions = billingAuditActionsForCategories(['destructive', 'status'])
    expect(actions).toContain('invoice.voided')
    expect(actions).toContain('period.closed')
    expect(actions).not.toContain('reading.saved')
  })
})
