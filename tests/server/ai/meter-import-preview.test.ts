import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { AiMeterImportPreviewService } from '../../../server/services/ai/meter-import-preview'

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  resolveBuilding: vi.fn(),
  listRooms: vi.fn(),
  findPeriod: vi.fn(),
  findReadings: vi.fn(),
  listInvoices: vi.fn(),
}))

vi.mock('../../../server/utils/permissions', () => ({ can: mocks.can }))
vi.mock('../../../server/services/ai/buildings', () => ({ AiBuildingService: { resolve: mocks.resolveBuilding } }))
vi.mock('../../../server/repositories/rooms', () => ({ RoomRepository: { listByBuilding: mocks.listRooms } }))
vi.mock('../../../server/repositories/billing/periods', () => ({ BillingPeriodRepository: { findByBuildingPeriod: mocks.findPeriod } }))
vi.mock('../../../server/repositories/meter-readings', () => ({ MeterReadingRepository: { findAll: mocks.findReadings } }))
vi.mock('../../../server/repositories/billing/invoices', () => ({ InvoiceRepository: { listByPeriod: mocks.listInvoices } }))

const event = {} as never
const actor = { id: 'user-1', app_metadata: { role: 'manager' } } as AuthUser
const building = {
  id: '00000000-0000-4000-8000-000000000001', slug: 'zeno', name: 'Zeno', address: '',
  status: 'active' as const, updatedAt: '2026-07-01T00:00:00.000Z',
}
const room = {
  id: '00000000-0000-4000-8000-000000000002', buildingId: building.id, roomNumber: '101',
  slug: '101', code: 'ZENO-101', floor: 1, status: 'occupied', monthlyRent: 1, area: null,
  description: null, createdAt: '', updatedAt: '',
}
const input = { building_ref: 'Zeno', period_year: 2026, period_month: 7, reading_date: '2026-07-31' }

describe('AiMeterImportPreviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
    mocks.resolveBuilding.mockResolvedValue({ status: 'resolved', building })
    mocks.listRooms.mockResolvedValue([room])
    mocks.findPeriod.mockResolvedValue({ id: 'period-1', status: 'draft' })
    mocks.findReadings.mockResolvedValue([])
    mocks.listInvoices.mockResolvedValue([])
  })

  it('normalizes exact scoped room rows and versions', async () => {
    const result = await AiMeterImportPreviewService.preview(event, actor, 'room\telectricity\twater\n101\t1200.5\t30', input)
    expect(result).toMatchObject({
      status: 'preview',
      preview: {
        blockers: [], warnings: [],
        rows: [
          { roomId: room.id, meterType: 'electricity', readingValue: 1200.5, expectedUpdatedAt: null },
          { roomId: room.id, meterType: 'water', readingValue: 30, expectedUpdatedAt: null },
        ],
      },
    })
  })

  it('classifies unknown rooms and malformed values as blockers', async () => {
    const result = await AiMeterImportPreviewService.preview(event, actor, 'room,electricity\n404,abc', input)
    expect(result).toMatchObject({ status: 'preview' })
    if (result.status !== 'preview') throw new Error('Expected preview')
    expect(result.preview.blockers.map(issue => issue.code)).toEqual(expect.arrayContaining(['invalid_number', 'missing_reading', 'room_not_found']))
  })

  it('blocks active invoices and closed periods', async () => {
    mocks.findPeriod.mockResolvedValue({ id: 'period-1', status: 'closed' })
    mocks.listInvoices.mockResolvedValue([{ roomId: room.id, status: 'issued' }])
    const result = await AiMeterImportPreviewService.preview(event, actor, 'room,electricity\n101,1200', input)
    if (result.status !== 'preview') throw new Error('Expected preview')
    expect(result.preview.blockers.map(issue => issue.code)).toEqual(expect.arrayContaining(['period_locked', 'invoice_locked']))
  })

  it('returns warnings for omitted and decreasing readings without changing values', async () => {
    mocks.findReadings
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ roomId: room.id, meterType: 'electricity', readingType: 'monthly', readingValue: 1300 }])
    const result = await AiMeterImportPreviewService.preview(event, actor, 'room,electricity\n101,1200', input)
    if (result.status !== 'preview') throw new Error('Expected preview')
    expect(result.preview.rows[0]?.readingValue).toBe(1200)
    expect(result.preview.warnings.map(issue => issue.code)).toEqual(expect.arrayContaining(['reading_decreased', 'reading_omitted']))
  })
})
