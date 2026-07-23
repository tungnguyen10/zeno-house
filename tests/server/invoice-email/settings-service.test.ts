import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../../app/types/auth'

const mocks = vi.hoisted(() => ({
  findBuilding: vi.fn(),
  findSettings: vi.fn(),
  saveSettings: vi.fn(),
  assertBuildingScope: vi.fn(),
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findByIdentifier: mocks.findBuilding },
}))
vi.mock('../../../server/repositories/building-invoice-email-settings', () => ({
  BuildingInvoiceEmailSettingsRepository: {
    findByBuildingId: mocks.findSettings,
    save: mocks.saveSettings,
  },
}))
vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope: mocks.assertBuildingScope,
}))

const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser

describe('BuildingInvoiceEmailSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', (user: AuthUser, capability: string) => {
      if (capability.endsWith('.read')) return true
      return user.app_metadata?.role === 'owner'
    })
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { invoiceEmailEnabled: false },
    }))
    mocks.findBuilding.mockResolvedValue({ id: 'building-1' })
    mocks.findSettings.mockResolvedValue(null)
    mocks.assertBuildingScope.mockResolvedValue(undefined)
    mocks.saveSettings.mockResolvedValue({
      building_id: 'building-1',
      auto_send_enabled: true,
      created_at: '2026-07-23T01:00:00.000Z',
      updated_at: '2026-07-23T01:00:00.000Z',
      updated_by: owner.id,
    })
  })

  it('returns a default-off read model to a scoped manager', async () => {
    const { BuildingInvoiceEmailSettingsService } = await import(
      '../../../server/services/buildings/invoice-email-settings'
    )

    await expect(BuildingInvoiceEmailSettingsService.get(
      { context: {} } as never,
      manager,
      'building-1',
    )).resolves.toMatchObject({
      buildingId: 'building-1',
      autoSendEnabled: false,
      featureAvailable: false,
    })
    expect(mocks.assertBuildingScope).toHaveBeenCalledWith(
      expect.anything(),
      manager,
      'building-1',
      'read',
    )
  })

  it('keeps manager access read-only and blocks enabling behind the global flag', async () => {
    const { BuildingInvoiceEmailSettingsService } = await import(
      '../../../server/services/buildings/invoice-email-settings'
    )

    await expect(BuildingInvoiceEmailSettingsService.update(
      { context: {} } as never,
      manager,
      'building-1',
      false,
    )).rejects.toMatchObject({ statusCode: 403 })
    await expect(BuildingInvoiceEmailSettingsService.update(
      { context: {} } as never,
      owner,
      'building-1',
      true,
    )).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.saveSettings).not.toHaveBeenCalled()
  })

  it('allows a scoped owner to enable future automatic deliveries when globally available', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { invoiceEmailEnabled: true },
    }))
    const { BuildingInvoiceEmailSettingsService } = await import(
      '../../../server/services/buildings/invoice-email-settings'
    )

    const result = await BuildingInvoiceEmailSettingsService.update(
      { context: {} } as never,
      owner,
      'building-1',
      true,
    )

    expect(mocks.assertBuildingScope).toHaveBeenCalledWith(
      expect.anything(),
      owner,
      'building-1',
      'write',
    )
    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.anything(), {
      buildingId: 'building-1',
      autoSendEnabled: true,
      updatedBy: owner.id,
    })
    expect(result).toMatchObject({ autoSendEnabled: true, featureAvailable: true })
  })
})
