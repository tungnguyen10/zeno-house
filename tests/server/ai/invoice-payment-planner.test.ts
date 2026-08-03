import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const listBuildings = vi.fn()
const resolveBuilding = vi.fn()
const listPeriods = vi.fn()
const findPeriod = vi.fn()
const listRooms = vi.fn()
const listInvoices = vi.fn()
const getMessage = vi.fn()
const createPlan = vi.fn()

vi.mock('../../../server/services/ai/buildings', () => ({
  AiBuildingService: { list: listBuildings, resolve: resolveBuilding },
}))
vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { list: listPeriods, findByBuildingPeriod: findPeriod },
}))
vi.mock('../../../server/repositories/rooms', () => ({ RoomRepository: { listByBuilding: listRooms } }))
vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: { listByPeriod: listInvoices },
}))
vi.mock('../../../server/services/ai/conversations', () => ({
  AiConversationService: { getOwnedUserMessage: getMessage },
}))
vi.mock('../../../server/services/ai/actions', () => ({ AiActionService: { createPlan } }))

const building = {
  id: '00000000-0000-4000-8000-000000000010', slug: 'zeno', name: 'Zeno', address: '',
  status: 'active', updatedAt: '2026-07-01T00:00:00.000Z',
}
const period = buildPeriod({
  id: '00000000-0000-4000-8000-000000000011', buildingId: building.id,
  periodYear: 2026, periodMonth: 7, status: 'issued', updatedAt: '2026-07-02T00:00:00.000Z',
})
const rooms = [
  { id: '00000000-0000-4000-8000-000000000021', buildingId: building.id, roomNumber: '01', slug: '01', code: 'ZENO-01' },
  { id: '00000000-0000-4000-8000-000000000022', buildingId: building.id, roomNumber: '02', slug: '02', code: 'ZENO-02' },
  { id: '00000000-0000-4000-8000-000000000023', buildingId: building.id, roomNumber: '03', slug: '03', code: 'ZENO-03' },
].map(room => ({ ...room, floor: 1, status: 'occupied', monthlyRent: 1_000_000, area: null, description: null, createdAt: '', updatedAt: '' }))
const eligible = buildInvoice({
  id: '00000000-0000-4000-8000-000000000031', billingPeriodId: period.id, roomId: rooms[0]!.id,
  invoiceCode: 'INV-01', status: 'issued', totalAmount: 1_000_000, paidAmount: 0,
  balanceAmount: 1_000_000, updatedAt: '2026-07-03T00:00:00.000Z',
})
const paid = buildInvoice({
  id: '00000000-0000-4000-8000-000000000032', billingPeriodId: period.id, roomId: rooms[1]!.id,
  invoiceCode: 'INV-02', status: 'paid', totalAmount: 1_000_000, paidAmount: 1_000_000,
  balanceAmount: 0, updatedAt: '2026-07-03T00:00:00.000Z',
})
const user = { id: 'user-1', app_metadata: { role: 'admin' } } as never
const event = {} as never

describe('AI invoice payment planner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listBuildings.mockResolvedValue([building])
    resolveBuilding.mockResolvedValue({ status: 'resolved', building })
    listPeriods.mockResolvedValue([period])
    findPeriod.mockResolvedValue(period)
    listRooms.mockResolvedValue(rooms)
    listInvoices.mockResolvedValue([eligible, paid])
    getMessage.mockResolvedValue({ createdAt: '2026-07-04T18:30:00.000Z' })
    createPlan.mockResolvedValue({
      id: 'plan-1', conversationId: 'conversation-1', actionType: 'record_invoice_payments',
      status: 'pending', title: 'Plan', summary: 'Plan', buildingId: building.id,
      preview: {}, warnings: [], expiresAt: '2026-07-05T00:00:00.000Z', result: null, error: null,
    })
  })

  it('asks for the building before resolving rooms when scope has multiple buildings', async () => {
    listBuildings.mockResolvedValue([building, { ...building, id: 'building-2', slug: 'other', name: 'Other' }])
    const { AiInvoicePaymentPlanner } = await import('../../../server/services/ai/invoice-payment-planner')
    await expect(AiInvoicePaymentPlanner.plan(event, user, 'conversation-1', 'message-1', {
      selection: { mode: 'rooms', room_refs: ['01'] },
    })).resolves.toMatchObject({ status: 'needs_building_clarification' })
    expect(listRooms).not.toHaveBeenCalled()
    expect(listInvoices).not.toHaveBeenCalled()
  })

  it('plans only eligible rows and reports paid, missing, and invalid rooms', async () => {
    const { AiInvoicePaymentPlanner } = await import('../../../server/services/ai/invoice-payment-planner')
    const result = await AiInvoicePaymentPlanner.plan(event, user, 'conversation-1', 'message-1', {
      selection: { mode: 'rooms', room_refs: ['01', '02', '03', '404'] },
    })
    expect(result).toMatchObject({
      status: 'planned',
      preview: { eligibleCount: 1, alreadyPaidCount: 1, noInvoiceCount: 1, invalidRoomCount: 1 },
    })
    expect(createPlan).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action_type: 'record_invoice_payments',
      normalized_payload: {
        billing_period_id: period.id,
        payments: [{
          invoice_id: eligible.id, room_id: rooms[0]!.id,
          expected_updated_at: eligible.updatedAt, expected_balance_amount: eligible.balanceAmount,
        }],
        payment_date: '2026-07-05', payment_method: 'cash', note: null,
        snapshot_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      warnings: expect.arrayContaining([
        'Bỏ qua 1 phòng đã ghi thu.',
        'Bỏ qua 1 phòng không có hoá đơn trong kỳ.',
        'Bỏ qua 1 mã phòng không hợp lệ hoặc không xác định duy nhất.',
      ]),
    }))
  })

  it('uses only the explicit period and creates no action when nothing is eligible', async () => {
    findPeriod.mockResolvedValue({ ...period, id: 'explicit-period' })
    listInvoices.mockResolvedValue([])
    const { AiInvoicePaymentPlanner } = await import('../../../server/services/ai/invoice-payment-planner')
    const result = await AiInvoicePaymentPlanner.plan(event, user, 'conversation-1', 'message-1', {
      building_ref: 'Zeno', selection: { mode: 'rooms', room_refs: ['01'] },
      period_year: 2026, period_month: 6,
    })
    expect(findPeriod).toHaveBeenCalledWith(expect.anything(), building.id, 2026, 6)
    expect(listPeriods).not.toHaveBeenCalled()
    expect(result).toMatchObject({ status: 'no_eligible_payments', preview: { noInvoiceCount: 1 } })
    expect(createPlan).not.toHaveBeenCalled()
  })

  it('selects every unpaid collectible invoice for all_unpaid', async () => {
    const partial = buildInvoice({
      ...eligible, id: '00000000-0000-4000-8000-000000000033', roomId: rooms[2]!.id,
      invoiceCode: 'INV-03', status: 'partial', totalAmount: 1_000_000,
      paidAmount: 250_000, balanceAmount: 750_000,
    })
    listInvoices.mockResolvedValue([paid, eligible, partial, buildInvoice({
      ...eligible, id: '00000000-0000-4000-8000-000000000034', status: 'void', roomId: rooms[1]!.id,
    })])
    const { AiInvoicePaymentPlanner } = await import('../../../server/services/ai/invoice-payment-planner')
    const result = await AiInvoicePaymentPlanner.plan(event, user, 'conversation-1', 'message-1', {
      building_ref: 'zeno', selection: { mode: 'all_unpaid' }, payment_method: 'bank_transfer',
    })
    expect(result).toMatchObject({ status: 'planned', preview: { eligibleCount: 2, totalAmount: 1_750_000 } })
    expect(createPlan.mock.calls[0]![2].normalized_payload.payments).toHaveLength(2)
    expect(createPlan.mock.calls[0]![2].normalized_payload.payment_method).toBe('bank_transfer')
  })
})
