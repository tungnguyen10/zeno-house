import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc }) }))

const throwDbError = vi.hoisted(() => vi.fn((error: unknown) => {
  throw Object.assign(new Error('db'), { original: error })
}))
vi.stubGlobal('throwDbError', throwDbError)

const event = {} as never
const limits = { globalLimit: 20, userLimit: 10, budgetMicroUsd: 1_000_000, reserveMicroUsd: 20_000 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TenantOcrUsageRepository', () => {
  it('reserves with the configured limits and returns the reservation id', async () => {
    rpc.mockResolvedValue({ data: 'res-1', error: null })
    const { TenantOcrUsageRepository } = await import('../../../server/repositories/tenant-ocr-usage')
    const result = await TenantOcrUsageRepository.reserve(event, 'user-1', limits)
    expect(result).toEqual({ kind: 'reserved', id: 'res-1' })
    expect(rpc).toHaveBeenCalledWith('reserve_tenant_ocr', {
      p_user_id: 'user-1',
      p_global_limit: 20,
      p_user_limit: 10,
      p_budget_micro_usd: 1_000_000,
      p_reserve_micro_usd: 20_000,
    })
  })

  it.each([
    ['TENANT_OCR_GLOBAL_LIMIT', 'global'],
    ['TENANT_OCR_USER_LIMIT', 'user'],
    ['TENANT_OCR_BUDGET', 'budget'],
  ])('maps %s to a quota result', async (message, reason) => {
    rpc.mockResolvedValue({ data: null, error: { message, code: 'P0001' } })
    const { TenantOcrUsageRepository } = await import('../../../server/repositories/tenant-ocr-usage')
    expect(await TenantOcrUsageRepository.reserve(event, 'user-1', limits)).toEqual({ kind: 'quota', reason })
  })

  it('delegates unknown database errors to throwDbError', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { TenantOcrUsageRepository } = await import('../../../server/repositories/tenant-ocr-usage')
    await expect(TenantOcrUsageRepository.reserve(event, 'user-1', limits)).rejects.toThrow('db')
    expect(throwDbError).toHaveBeenCalledWith({ message: 'boom' }, 'tenantOcrUsage.reserve')
  })

  it('settles with usage numbers only', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const { TenantOcrUsageRepository } = await import('../../../server/repositories/tenant-ocr-usage')
    await TenantOcrUsageRepository.settle(event, 'res-1', { costMicroUsd: 1200, inputTokens: 900, outputTokens: 150, model: 'm' })
    expect(rpc).toHaveBeenCalledWith('settle_tenant_ocr', {
      p_id: 'res-1',
      p_cost_micro_usd: 1200,
      p_input_tokens: 900,
      p_output_tokens: 150,
      p_model: 'm',
    })
  })

  it('releases a reservation', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const { TenantOcrUsageRepository } = await import('../../../server/repositories/tenant-ocr-usage')
    await TenantOcrUsageRepository.release(event, 'res-1')
    expect(rpc).toHaveBeenCalledWith('release_tenant_ocr', { p_id: 'res-1' })
  })
})
