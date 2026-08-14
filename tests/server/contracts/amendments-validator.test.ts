import { describe, expect, it } from 'vitest'
import {
  contractAmendmentCancelSchema,
  contractAmendmentCreateSchema,
  contractAmendmentPublishSchema,
  contractAmendmentUpdateSchema,
  recurringAmendmentRequiresMonthBoundary,
} from '../../../app/utils/validators/contract-amendments'

const validDraft = {
  title: 'Điều chỉnh tiền thuê',
  public_content: 'Tiền thuê mới áp dụng từ kỳ tháng 9.',
  effective_date: '2026-09-01',
  changes: { monthly_rent: 5_500_000 },
}

describe('contract amendment validators', () => {
  it('preserves an explicit null payment due day', () => {
    const result = contractAmendmentCreateSchema.parse({
      ...validDraft,
      changes: { payment_due_day: null },
    })

    expect(result.changes).toEqual({ payment_due_day: null })
    expect(Object.hasOwn(result.changes, 'payment_due_day')).toBe(true)
  })

  it('trims public copy and rejects unsupported change keys', () => {
    expect(contractAmendmentCreateSchema.parse({
      ...validDraft,
      title: '  Phụ lục 01  ',
      public_content: '  Nội dung công khai  ',
    })).toMatchObject({ title: 'Phụ lục 01', public_content: 'Nội dung công khai' })

    expect(contractAmendmentCreateSchema.safeParse({
      ...validDraft,
      changes: { monthly_rent: 5_500_000, notes: 'internal' },
    }).success).toBe(false)
  })

  it('requires at least one structured change', () => {
    expect(contractAmendmentCreateSchema.safeParse({ ...validDraft, changes: {} }).success).toBe(false)
  })

  it('validates values and strict draft input', () => {
    expect(contractAmendmentCreateSchema.safeParse({
      ...validDraft,
      changes: { occupant_count: 0 },
    }).success).toBe(false)
    expect(contractAmendmentCreateSchema.safeParse({ ...validDraft, internal_note: 'secret' }).success).toBe(false)
    expect(contractAmendmentCreateSchema.safeParse({ ...validDraft, effective_date: '2026-02-31' }).success).toBe(false)
    expect(contractAmendmentCreateSchema.safeParse({
      ...validDraft,
      changes: { monthly_rent: 1_000_000.5 },
    }).success).toBe(false)
    expect(contractAmendmentCreateSchema.safeParse({
      ...validDraft,
      changes: { deposit: 1_000_000_000_000 },
    }).success).toBe(false)
  })

  it('requires optimistic versions for update, publish, and cancel', () => {
    const expectedUpdatedAt = '2026-08-15T01:02:03.000Z'
    expect(contractAmendmentUpdateSchema.parse({ ...validDraft, expected_updated_at: expectedUpdatedAt }).expected_updated_at)
      .toBe(expectedUpdatedAt)
    expect(contractAmendmentPublishSchema.parse({ expected_updated_at: expectedUpdatedAt }).expected_updated_at)
      .toBe(expectedUpdatedAt)
    expect(contractAmendmentCancelSchema.parse({ expected_updated_at: expectedUpdatedAt, reason: '  Hợp đồng đã thay đổi  ' }).reason)
      .toBe('Hợp đồng đã thay đổi')
  })

  it('identifies every billing-sensitive change', () => {
    expect(recurringAmendmentRequiresMonthBoundary({ deposit: 1_000_000 })).toBe(false)
    expect(recurringAmendmentRequiresMonthBoundary({ occupant_count: 2 })).toBe(true)
    expect(recurringAmendmentRequiresMonthBoundary({ payment_due_day: null })).toBe(true)
  })
})
