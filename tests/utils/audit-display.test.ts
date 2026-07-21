import { describe, expect, it } from 'vitest'
import {
  AUDIT_ENTITY_FILTER_OPTIONS,
  auditActionLabel,
  auditActionVariant,
  auditDiffRows,
  auditEntityDisplay,
  auditEntityLabel,
} from '../../app/utils/audit/display'
import { AUDIT_ACTIONS } from '../../app/utils/constants/audit'

describe('audit display helpers', () => {
  it('formats contract monthly rent diffs as readable currency rows', () => {
    const rows = auditDiffRows(
      { monthlyRent: 4_000_000, status: 'active', updatedAt: '2026-07-01T00:00:00Z' },
      { monthlyRent: 4_500_000, status: 'active', updatedAt: '2026-07-02T00:00:00Z' },
      'contract',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: 'monthlyRent',
      label: 'Giá thuê / tháng',
      beforeText: '4.000.000\u00a0\u20ab',
      afterText: '4.500.000\u00a0\u20ab',
    })
  })

  it('omits technical timestamp fields from readable diffs', () => {
    const rows = auditDiffRows(
      { updatedAt: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
      { updatedAt: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z' },
      'contract',
    )

    expect(rows).toEqual([])
  })

  it('covers operations and tenant portal labels and action variants', () => {
    expect(auditEntityLabel('shared_expense')).toBe('Chi phí dùng chung')
    expect(auditEntityLabel('tenant_document')).toBe('Tài liệu khách thuê')
    expect(auditActionLabel('operations_report_period.reopened')).toBe('Mở lại báo cáo')
    expect(auditActionVariant('operations_report_period.reopened')).toBe('warning')
    expect(AUDIT_ENTITY_FILTER_OPTIONS.filter(option => option.disabled).map(option => option.label))
      .toEqual(expect.arrayContaining(['Master data', 'Phân quyền', 'Hợp đồng', 'Vận hành', 'Tenant portal']))
  })

  it('uses snapshots as a deleted entity label fallback', () => {
    expect(auditEntityDisplay({
      entityType: 'shared_expense',
      entityLabel: null,
      entityId: '550e8400-e29b-41d4-a716-446655440000',
      beforeData: { name: 'Bảo vệ tháng 7' },
      afterData: null,
    })).toBe('Bảo vệ tháng 7')
  })

  it('has a Vietnamese display label for every declared audit action', () => {
    for (const action of Object.values(AUDIT_ACTIONS)) {
      expect(auditActionLabel(action), action).not.toBe(action.split('.').at(-1))
    }
  })
})
