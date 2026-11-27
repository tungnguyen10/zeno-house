import { describe, expect, it } from 'vitest'
import {
  AUDIT_ENTITY_FILTER_OPTIONS,
  auditActionLabel,
  auditActionVariant,
  auditDiffRows,
  auditEntityDisplay,
  auditEntityLabel,
  auditEventSentence,
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

  it('labels access-request reconciliation in operational Vietnamese', () => {
    expect(auditActionLabel('user.access_request.reconciled')).toBe('Đối soát yêu cầu truy cập')
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

describe('renewal source transfer audit', () => {
  it('uses a Vietnamese action label and existing accent treatment', () => {
    expect(AUDIT_ACTIONS.CONTRACT_CHECKOUT_SOURCE_TRANSFERRED).toBe('contract.checkout_source.transferred')
    expect(auditActionLabel('contract.checkout_source.transferred')).toBe('Chuyển nguồn tiền tất toán')
    expect(auditActionVariant('contract.checkout_source.transferred')).toBe('accent')
  })
})

it('labels tenant identity conflicts for administrators', () => {
  expect(auditActionLabel(AUDIT_ACTIONS.TENANT_IDENTITY_CONFLICT)).toBe('Xung đột định danh khách thuê')
})

describe('auditEventSentence', () => {
  const base = { entityId: 'e1', beforeData: null, afterData: null, entitySubLabel: null }

  it('drops the entity noun when the verb already names it', () => {
    expect(auditEventSentence({ ...base, action: 'reserve_fund.accrual_refreshed', entityType: 'reserve_fund', entityLabel: 'Quỹ tòa A' }))
      .toEqual({ verb: 'cập nhật quỹ dự phòng', entityNoun: null, subject: 'Quỹ tòa A', detail: null })
    expect(auditEventSentence({ ...base, action: 'contract.document.issued', entityType: 'contract', entityLabel: 'HD-0012' }).entityNoun).toBeNull()
    expect(auditEventSentence({ ...base, action: 'building.visibility_changed', entityType: 'building', entityLabel: 'Zeno' }).entityNoun).toBeNull()
  })

  it('keeps the entity noun for generic verbs', () => {
    expect(auditEventSentence({ ...base, action: 'room.updated', entityType: 'room', entityLabel: 'P101' }))
      .toEqual({ verb: 'cập nhật', entityNoun: 'phòng', subject: 'P101', detail: null })
  })

  it('hides technical keys and duplicated sub-labels', () => {
    expect(auditEventSentence({ ...base, action: 'building_service.updated', entityType: 'building_service', entityLabel: 'water_input', entitySubLabel: 'water_input' }))
      .toMatchObject({ subject: null, detail: null })
    expect(auditEventSentence({ ...base, action: 'room.updated', entityType: 'room', entityLabel: 'P101', entitySubLabel: 'P101' }).detail).toBeNull()
    expect(auditEventSentence({ ...base, action: 'room.updated', entityType: 'room', entityLabel: 'P101', entitySubLabel: 'Tòa A' }).detail).toBe('Tòa A')
  })

  it('has no subject when the entity cannot be named', () => {
    expect(auditEventSentence({ ...base, entityId: null, action: 'contract_occupant.added', entityType: 'contract_occupant', entityLabel: null }).subject).toBeNull()
  })
})

it('spells action labels with xoá and tòa', () => {
  expect(auditActionLabel('building.removed')).toBe('Xoá')
  expect(auditActionLabel('building.visibility_changed')).toBe('Đổi hiển thị tòa nhà')
})
