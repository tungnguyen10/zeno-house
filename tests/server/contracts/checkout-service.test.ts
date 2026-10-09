import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(), scope: vi.fn(), get: vi.fn(), save: vi.fn(), saveChargeModes: vi.fn(), returnRoom: vi.fn(), issueFinal: vi.fn(), confirm: vi.fn(), refund: vi.fn(), preview: vi.fn(),
}))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findByIdentifier: mocks.find } }))
vi.mock('../../../server/repositories/checkout', () => ({ CheckoutRepository: mocks }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.scope }))

const event = {} as never
const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as never
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as never
const tenant = { id: 'tenant-1', app_metadata: { role: 'tenant' } } as never
const empty = { checkout: null, statement: null, depositHeld: 0, creditHeld: 0, refunds: [], sources: [] }

describe('checkout authorization and boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useRuntimeConfig', () => ({ checkoutEnabled: true, checkoutBuildingIds: 'building-1' }))
    mocks.find.mockResolvedValue({ id: 'contract-1', buildingId: 'building-1', startDate: '2026-01-01' })
    mocks.get.mockResolvedValue(empty)
    mocks.save.mockResolvedValue(empty)
    mocks.saveChargeModes.mockResolvedValue(empty)
    mocks.issueFinal.mockResolvedValue(empty)
    mocks.returnRoom.mockResolvedValue(empty)
    mocks.confirm.mockResolvedValue(empty)
  })
  it('resolves contract identifier and scopes the actual building before loading funds', async () => {
    const { CheckoutService } = await import('../../../server/services/checkout')
    await CheckoutService.get(event, owner, 'HD-1')
    expect(mocks.scope).toHaveBeenCalledWith(event, owner, 'building-1', 'read')
    expect(mocks.get).toHaveBeenCalledWith(event, 'contract-1')
  })
  it('never loads funds when building scope fails', async () => {
    mocks.scope.mockRejectedValueOnce(new Error('outside scope'))
    const { CheckoutService } = await import('../../../server/services/checkout')
    await expect(CheckoutService.get(event, owner, 'HD-1')).rejects.toThrow('outside scope')
    expect(mocks.get).not.toHaveBeenCalled()
  })
  it('does not allow a manager to allocate deposits', async () => {
    const { CheckoutService } = await import('../../../server/services/checkout')
    await expect(CheckoutService.confirm(event, manager, 'HD-1', { operation_id: 'op', snapshot_hash: 'hash' }))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it('allows physical return outside the financial pilot', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ checkoutEnabled: true, checkoutBuildingIds: 'building-2' }))
    const { CheckoutService } = await import('../../../server/services/checkout')
    await CheckoutService.save(event, owner, 'HD-1', { actual_return_date: '2026-01-01', reason: 'Trả phòng' })
    expect(mocks.save).toHaveBeenCalledOnce()
    mocks.returnRoom.mockResolvedValue(empty)
    await CheckoutService.returnRoom(event, owner, 'HD-1', { operation_id: 'op', expected_updated_at: 'version' })
    expect(mocks.returnRoom).toHaveBeenCalledWith(event, 'contract-1', 'owner-1', expect.anything(), 'standard')
    await expect(CheckoutService.confirm(event, owner, 'HD-1', { operation_id: 'op', snapshot_hash: 'hash' })).rejects.toMatchObject({ statusCode: 409 })
  })
  it('selects pilot settlement mode at the return boundary and scopes final bill edits', async () => {
    const { CheckoutService } = await import('../../../server/services/checkout')
    await CheckoutService.returnRoom(event, owner, 'HD-1', { operation_id: 'op', expected_updated_at: 'version' })
    expect(mocks.returnRoom).toHaveBeenCalledWith(event, 'contract-1', 'owner-1', expect.anything(), 'settlement')
    await CheckoutService.saveChargeModes(event, owner, 'HD-1', { expected_updated_at: 'version', modes: { rent: { mode: 'full_month' } } })
    expect(mocks.saveChargeModes).toHaveBeenCalledWith(event, 'contract-1', 'owner-1', expect.objectContaining({ modes: { rent: { mode: 'full_month' } } }))
  })
  it('permits standard final issue without activating deposit allocation', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ checkoutEnabled: false, checkoutBuildingIds: '' }))
    const { CheckoutService } = await import('../../../server/services/checkout')
    await CheckoutService.issueFinal(event, owner, 'HD-1', { operation_id: 'op', snapshot_hash: 'hash' })
    expect(mocks.issueFinal).toHaveBeenCalledWith(event, 'contract-1', 'owner-1', { operation_id: 'op', snapshot_hash: 'hash' })
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it('does not expose final invoice issue to a user without billing permission', async () => {
    const { CheckoutService } = await import('../../../server/services/checkout')
    await expect(CheckoutService.issueFinal(event, tenant, 'HD-1', { operation_id: 'op', snapshot_hash: 'hash' })).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.issueFinal).not.toHaveBeenCalled()
  })
  it('keeps existing checkout readable when the rollout flag is switched off', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ checkoutEnabled: false, checkoutBuildingIds: '' }))
    mocks.get.mockResolvedValue({ ...empty, checkout: { id: 'checkout-1', status: 'returned' } })
    const { CheckoutService } = await import('../../../server/services/checkout')
    expect((await CheckoutService.get(event, owner, 'HD-1')).enabled).toBe(true)
  })
  it('keeps return controls hidden until the schema is deployed', async () => {
    mocks.get.mockResolvedValue({ ...empty, schemaAvailable: false })
    const { CheckoutService } = await import('../../../server/services/checkout')
    expect((await CheckoutService.get(event, owner, 'HD-1')).enabled).toBe(false)
  })
  it('rejects an actual return date before move-in', async () => {
    const { CheckoutService } = await import('../../../server/services/checkout')
    await expect(CheckoutService.save(event, owner, 'HD-1', { actual_return_date: '2025-12-01', reason: 'Trả phòng' }))
      .rejects.toMatchObject({ statusCode: 422 })
  })
})
