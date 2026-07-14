import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { BillingUtilityUsageService } from '../../../server/services/billing/utility-usages'

const mocks = vi.hoisted(() => ({
  findPeriod: vi.fn(), findOverride: vi.fn(), findOverrideById: vi.fn(), save: vi.fn(),
  deleteById: vi.fn(), approveById: vi.fn(), findRoom: vi.fn(), listInvoices: vi.fn(),
  assertScope: vi.fn(), audit: vi.fn(),
}))

vi.mock('../../../server/repositories/billing/periods', () => ({ BillingPeriodRepository: { findById: mocks.findPeriod } }))
vi.mock('../../../server/repositories/billing/utility-usages', () => ({ BillingUtilityUsageRepository: {
  findByPeriodRoomMeter: mocks.findOverride,
  findById: mocks.findOverrideById,
  saveWithAudit: mocks.save,
  deleteById: mocks.deleteById,
  approveById: mocks.approveById,
} }))
vi.mock('../../../server/repositories/rooms', () => ({ RoomRepository: { findById: mocks.findRoom } }))
vi.mock('../../../server/repositories/billing/invoices', () => ({ InvoiceRepository: { listByPeriod: mocks.listInvoices } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.assertScope }))
vi.mock('../../../server/services/billing/audit', () => ({ BillingAuditService: { append: mocks.audit } }))

const event = {} as never
const user = { id: '00000000-0000-4000-8000-000000000001', app_metadata: { role: 'manager' } } as AuthUser
const period = {
  id: '00000000-0000-4000-8000-000000000002', buildingId: '00000000-0000-4000-8000-000000000003',
  status: 'draft', updatedAt: '2026-07-14T00:00:00.000Z',
}
const room = { id: '00000000-0000-4000-8000-000000000004', buildingId: period.buildingId }
const input = {
  room_id: room.id, meter_type: 'electricity' as const,
  previous_reading_value: 100, current_reading_value: 90, billable_usage: 10,
  reason: 'correction' as const, note: 'Đính chính chỉ số điện',
}
const existing = {
  id: '00000000-0000-4000-8000-000000000005', billingPeriodId: period.id, roomId: room.id,
  meterType: 'electricity', updatedAt: '2026-07-14T00:00:00.000Z', approvedBy: null,
}

describe('BillingUtilityUsageService atomic and lock behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findPeriod.mockResolvedValue(period)
    mocks.findRoom.mockResolvedValue(room)
    mocks.listInvoices.mockResolvedValue([])
    mocks.findOverride.mockResolvedValue(existing)
    mocks.save.mockResolvedValue(existing)
  })

  it('passes the current client version into one atomic save-and-audit RPC', async () => {
    await BillingUtilityUsageService.saveOverride(event, user, period.id, {
      ...input, expected_updated_at: existing.updatedAt,
    })
    expect(mocks.save).toHaveBeenCalledWith(event, period.id, user.id, {
      ...input, expected_updated_at: existing.updatedAt,
    }, { source: 'api', action_plan_id: undefined, idempotency_key: undefined })
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('uses the freshly loaded version for compatible direct callers', async () => {
    await BillingUtilityUsageService.saveOverride(event, user, period.id, input)
    expect(mocks.save.mock.calls[0]?.[3]).toMatchObject({ expected_updated_at: existing.updatedAt })
  })

  it.each(['closed', 'invoice'] as const)('blocks %s billing state before saving', async (state) => {
    if (state === 'closed') mocks.findPeriod.mockResolvedValue({ ...period, status: 'closed' })
    else mocks.listInvoices.mockResolvedValue([{ roomId: room.id, status: 'issued' }])
    await expect(BillingUtilityUsageService.saveOverride(event, user, period.id, input))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('applies the active-invoice lock to delete and approve paths', async () => {
    mocks.findOverrideById.mockResolvedValue(existing)
    mocks.listInvoices.mockResolvedValue([{ roomId: room.id, status: 'paid' }])
    await expect(BillingUtilityUsageService.deleteOverride(event, user, period.id, existing.id))
      .rejects.toMatchObject({ statusCode: 409 })
    await expect(BillingUtilityUsageService.approveOverride(event, user, period.id, existing.id))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.deleteById).not.toHaveBeenCalled()
    expect(mocks.approveById).not.toHaveBeenCalled()
  })
})
