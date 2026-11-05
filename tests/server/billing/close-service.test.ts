import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can as realCan } from '../../../server/utils/permissions'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findById = vi.fn()
const closeAtomic = vi.fn()
const reopenAtomic = vi.fn()
const computeAccrualInputs = vi.fn()
const assertBuildingScope = vi.fn()
const invalidateOperationsReport = vi.fn()
const append = vi.fn()

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findById, closeAtomic, reopenAtomic },
}))
vi.mock('../../../server/services/operations-report/accrual', () => ({ computeAccrualInputs }))
vi.mock('../../../server/services/operations-report/cache', () => ({ invalidateOperationsReport }))
vi.mock('../../../server/services/billing/audit', () => ({ BillingAuditService: { append } }))
vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
  getVisibleBuildingIds: vi.fn(),
}))

const admin = { id: 'admin-user', app_metadata: { role: 'admin' } } as AuthUser
const event = () => ({ context: {} }) as never

const inputs = {
  billingPeriodId: 'period-1',
  issuedRevenue: 3_000_000,
  profitByRevenue: 2_000_000,
  reserveRatePercent: 10,
  accrualAmount: 200_000,
}

function staleError() {
  const error = new Error('stale') as Error & { statusCode: number, data: unknown }
  error.statusCode = 409
  error.data = { error: { code: 'CONFLICT', details: { reason: 'PERIOD_SNAPSHOT_STALE' } } }
  return error
}

describe('BillingPeriodService.close', () => {
  const period = buildPeriod({ id: 'period-1', buildingId: 'building-1', periodYear: 2026, periodMonth: 7, status: 'collecting' })
  const closed = buildPeriod({ ...period, status: 'closed' })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', realCan)
    findById.mockResolvedValue(period)
    assertBuildingScope.mockResolvedValue(undefined)
    computeAccrualInputs.mockResolvedValue(inputs)
    closeAtomic.mockResolvedValue({ period: closed, accrualStatus: 'recorded', replayed: false })
  })

  it('denies users without billing.close before touching anything', async () => {
    vi.stubGlobal('can', () => false)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.close(event(), admin, 'period-1')).rejects.toMatchObject({ statusCode: 403 })
    expect(findById).not.toHaveBeenCalled()
    expect(closeAtomic).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown period', async () => {
    findById.mockResolvedValue(null)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.close(event(), admin, 'period-1')).rejects.toMatchObject({ statusCode: 404 })
    expect(closeAtomic).not.toHaveBeenCalled()
  })

  it('checks building write scope before computing or calling the RPC', async () => {
    assertBuildingScope.mockRejectedValue(Object.assign(new Error('forbidden'), { statusCode: 403 }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.close(event(), admin, 'period-1')).rejects.toMatchObject({ statusCode: 403 })
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), admin, 'building-1', 'write')
    expect(computeAccrualInputs).not.toHaveBeenCalled()
    expect(closeAtomic).not.toHaveBeenCalled()
  })

  it('passes the computed accrual inputs and a correlation id to the atomic RPC', async () => {
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.close(event(), admin, 'period-1')

    expect(computeAccrualInputs).toHaveBeenCalledWith(expect.anything(), 'building-1', 2026, 7)
    expect(closeAtomic).toHaveBeenCalledWith(expect.anything(), {
      periodId: 'period-1',
      actorId: 'admin-user',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      expectedIssuedRevenue: 3_000_000,
      issuedProfit: 2_000_000,
      reserveRatePercent: 10,
      accrualAmount: 200_000,
    })
    expect(result).toEqual({ period: closed, accrualStatus: 'recorded' })
  })

  it('does not write audit events from TypeScript', async () => {
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await BillingPeriodService.close(event(), admin, 'period-1')
    expect(append).not.toHaveBeenCalled()
  })

  it('recomputes and retries exactly once when the snapshot is stale', async () => {
    closeAtomic.mockRejectedValueOnce(staleError())
    computeAccrualInputs
      .mockResolvedValueOnce(inputs)
      .mockResolvedValueOnce({ ...inputs, issuedRevenue: 3_500_000, profitByRevenue: 2_500_000, accrualAmount: 250_000 })
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.close(event(), admin, 'period-1')

    expect(computeAccrualInputs).toHaveBeenCalledTimes(2)
    expect(closeAtomic).toHaveBeenCalledTimes(2)
    expect(closeAtomic).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      expectedIssuedRevenue: 3_500_000,
      accrualAmount: 250_000,
    }))
    expect(result.accrualStatus).toBe('recorded')
  })

  it('reuses one correlation id across the retry', async () => {
    closeAtomic.mockRejectedValueOnce(staleError())
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await BillingPeriodService.close(event(), admin, 'period-1')

    const ids = closeAtomic.mock.calls.map(call => call[1].correlationId)
    expect(ids[0]).toBe(ids[1])
  })

  it('propagates a second stale error', async () => {
    closeAtomic.mockRejectedValue(staleError())
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.close(event(), admin, 'period-1')).rejects.toMatchObject({ statusCode: 409 })
    expect(closeAtomic).toHaveBeenCalledTimes(2)
    expect(invalidateOperationsReport).not.toHaveBeenCalled()
  })

  it('does not retry other conflicts', async () => {
    const outstanding = Object.assign(new Error('outstanding'), {
      statusCode: 409,
      data: { error: { details: { reason: 'PERIOD_HAS_OUTSTANDING' } } },
    })
    closeAtomic.mockRejectedValue(outstanding)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.close(event(), admin, 'period-1')).rejects.toBe(outstanding)
    expect(closeAtomic).toHaveBeenCalledTimes(1)
  })

  it('returns a null accrual status on replay', async () => {
    closeAtomic.mockResolvedValue({ period: closed, accrualStatus: null, replayed: true })
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.close(event(), admin, 'period-1'))
      .resolves.toEqual({ period: closed, accrualStatus: null })
  })

  it('reports a skipped accrual when the operations report is already closed', async () => {
    closeAtomic.mockResolvedValue({ period: closed, accrualStatus: 'skipped_report_closed', replayed: false })
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.close(event(), admin, 'period-1')
    expect(result.accrualStatus).toBe('skipped_report_closed')
  })

  it('invalidates the operations report cache for the building after closing', async () => {
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await BillingPeriodService.close(event(), admin, 'period-1')
    expect(invalidateOperationsReport).toHaveBeenCalledWith('building-1')
  })
})

describe('BillingPeriodService.reopen', () => {
  const closed = buildPeriod({ id: 'period-1', buildingId: 'building-1', status: 'closed' })
  const reopened = buildPeriod({ ...closed, status: 'collecting' })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', realCan)
    findById.mockResolvedValue(closed)
    assertBuildingScope.mockResolvedValue(undefined)
    reopenAtomic.mockResolvedValue(reopened)
  })

  it('denies users without billing.reopen', async () => {
    vi.stubGlobal('can', () => false)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(event(), admin, 'period-1', 'cần mở lại để chỉnh sửa'))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(reopenAtomic).not.toHaveBeenCalled()
  })

  it('rejects a reason shorter than 10 characters before any lookup', async () => {
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(event(), admin, 'period-1', 'ngắn'))
      .rejects.toMatchObject({ statusCode: 422 })
    expect(findById).not.toHaveBeenCalled()
    expect(reopenAtomic).not.toHaveBeenCalled()
  })

  it('checks building write scope', async () => {
    assertBuildingScope.mockRejectedValue(Object.assign(new Error('forbidden'), { statusCode: 403 }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(event(), admin, 'period-1', 'cần mở lại để chỉnh sửa'))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(reopenAtomic).not.toHaveBeenCalled()
  })

  it('passes the trimmed reason to the atomic RPC, skips TypeScript audit and invalidates the cache', async () => {
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.reopen(event(), admin, 'period-1', '  sửa lại chỉ số điện phòng 201  ')

    expect(result).toBe(reopened)
    expect(reopenAtomic).toHaveBeenCalledWith(expect.anything(), {
      periodId: 'period-1',
      actorId: 'admin-user',
      reason: 'sửa lại chỉ số điện phòng 201',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
    expect(append).not.toHaveBeenCalled()
    expect(invalidateOperationsReport).toHaveBeenCalledWith('building-1')
  })
})
