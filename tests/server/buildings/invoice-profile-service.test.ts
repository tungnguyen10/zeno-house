import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const findBuilding = vi.fn()
const findProfile = vi.fn()
const saveProfile = vi.fn()
const saveDirect = vi.fn()
const backfillLegacySnapshots = vi.fn()
const uploadAsset = vi.fn()
const removeAssets = vi.fn()
const signAsset = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findByIdentifier: findBuilding },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: {
    findByBuildingId: findProfile,
    saveWithLegacyBackfill: saveProfile,
    saveDirect,
    backfillLegacySnapshots,
    uploadAsset,
    removeAssets,
    signAsset,
  },
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const building = { id: 'building-1', code: 'zeno', name: 'Zeno House' }
const row = {
  building_id: building.id,
  bank_name: 'VIB',
  account_holder: 'NGUYỄN TUẤN ANH',
  account_number: '375675817',
  transfer_content_template: '{building_code}-{room_number}-{invoice_code}-{period}',
  qr_image_path: 'building-1/qr/old.webp',
  logo_image_path: 'building-1/logo/old.webp',
  legacy_backfilled_at: '2026-07-20T00:00:00.000Z',
  created_at: '2026-07-20T00:00:00.000Z',
  updated_at: '2026-07-20T00:00:00.000Z',
  updated_by: 'owner-1',
}
const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser
const fields = {
  bank_name: 'VIB',
  account_holder: 'NGUYỄN TUẤN ANH',
  account_number: '375675817',
  transfer_content_template: '{building_code}-{room_number}-{invoice_code}-{period}',
}
const qr = { filename: 'qr.webp', type: 'image/webp', data: Buffer.from('qr') }

describe('BuildingInvoiceProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', (user: AuthUser, capability: string) => {
      const role = user.app_metadata?.role
      if (capability.endsWith('.read')) return ['admin', 'owner', 'manager'].includes(String(role))
      return ['admin', 'owner'].includes(String(role))
    })
    findBuilding.mockResolvedValue(building)
    assertBuildingScope.mockResolvedValue(undefined)
    signAsset.mockImplementation(async (_event, path) => `signed:${path}`)
    saveProfile.mockResolvedValue({ profile: row, backfilledCount: 3 })
    saveDirect.mockResolvedValue(row)
    backfillLegacySnapshots.mockResolvedValue(3)
  })

  it('allows a manager to read signed profile data without exposing paths', async () => {
    findProfile.mockResolvedValue(row)
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    const result = await BuildingInvoiceProfileService.get({ context: {} } as never, manager, 'zeno')

    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), manager, building.id, 'read')
    expect(result).toMatchObject({ qrImageUrl: 'signed:building-1/qr/old.webp' })
    expect(result).not.toHaveProperty('qrImagePath')
  }, 10000)

  it('requires a QR when creating the first profile', async () => {
    findProfile.mockResolvedValue(null)
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    await expect(BuildingInvoiceProfileService.save(
      { context: {} } as never, owner, 'zeno', { fields, removeLogo: false },
    )).rejects.toMatchObject({ statusCode: 422 })
    expect(saveProfile).not.toHaveBeenCalled()
  })

  it('keeps manager access read-only and enforces scope before profile access', async () => {
    findProfile.mockResolvedValue(row)
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    await expect(BuildingInvoiceProfileService.save(
      { context: {} } as never, manager, 'zeno', { fields, qrImage: qr, removeLogo: false },
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(saveProfile).not.toHaveBeenCalled()

    assertBuildingScope.mockRejectedValueOnce({ statusCode: 403 })
    await expect(BuildingInvoiceProfileService.get(
      { context: {} } as never, owner, 'zeno',
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(findProfile).not.toHaveBeenCalled()
  })

  it('rejects unsupported or oversized images before upload', async () => {
    findProfile.mockResolvedValue(row)
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    await expect(BuildingInvoiceProfileService.save(
      { context: {} } as never,
      owner,
      'zeno',
      { fields, qrImage: { ...qr, type: 'image/svg+xml' }, removeLogo: false },
    )).rejects.toMatchObject({ statusCode: 422 })
    await expect(BuildingInvoiceProfileService.save(
      { context: {} } as never,
      owner,
      'zeno',
      { fields, qrImage: { ...qr, data: Buffer.alloc(5 * 1024 * 1024 + 1) }, removeLogo: false },
    )).rejects.toMatchObject({ statusCode: 422 })
    expect(uploadAsset).not.toHaveBeenCalled()
  })

  it('uploads unique assets, persists them, signs the result, and audits backfill', async () => {
    findProfile.mockResolvedValue(null)
    uploadAsset
      .mockResolvedValueOnce('building-1/qr/new.webp')
      .mockResolvedValueOnce('building-1/logo/new.webp')
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    const result = await BuildingInvoiceProfileService.save(
      { context: {} } as never,
      owner,
      'zeno',
      { fields, qrImage: qr, logoImage: { ...qr, filename: 'logo.webp' }, removeLogo: false },
    )

    expect(uploadAsset).toHaveBeenCalledTimes(2)
    expect(saveProfile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingId: building.id,
      qrImagePath: 'building-1/qr/new.webp',
      logoImagePath: 'building-1/logo/new.webp',
    }))
    expect(result.qrImageUrl).toBe('signed:building-1/qr/old.webp')
    expect(appendAudit).toHaveBeenCalledWith(expect.anything(), owner, expect.objectContaining({
      metadata: expect.objectContaining({ backfilled_count: 3 }),
    }))
  })

  it('preserves omitted assets and supports resetting the logo', async () => {
    findProfile.mockResolvedValue(row)
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    await BuildingInvoiceProfileService.save(
      { context: {} } as never, owner, 'zeno', { fields, removeLogo: true },
    )

    expect(uploadAsset).not.toHaveBeenCalled()
    expect(saveProfile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      qrImagePath: null,
      logoImagePath: null,
      removeLogo: true,
    }))
  })

  it('removes only newly uploaded request assets when persistence fails', async () => {
    findProfile.mockResolvedValue(row)
    uploadAsset.mockResolvedValue('building-1/qr/new.webp')
    saveProfile.mockRejectedValue(new Error('db failed'))
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    await expect(BuildingInvoiceProfileService.save(
      { context: {} } as never, owner, 'zeno', { fields, qrImage: qr, removeLogo: false },
    )).rejects.toThrow('db failed')
    expect(removeAssets).toHaveBeenCalledWith(expect.anything(), ['building-1/qr/new.webp'])
    expect(removeAssets).not.toHaveBeenCalledWith(expect.anything(), [row.qr_image_path])
  })

  it('keeps newly committed assets when signed-URL generation fails after persistence', async () => {
    findProfile.mockResolvedValue(row)
    uploadAsset.mockResolvedValue('building-1/qr/new.webp')
    signAsset.mockRejectedValue(new Error('signing failed'))
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    await expect(BuildingInvoiceProfileService.save(
      { context: {} } as never, owner, 'zeno', { fields, qrImage: qr, removeLogo: false },
    )).rejects.toThrow('signing failed')
    expect(saveProfile).toHaveBeenCalled()
    expect(removeAssets).not.toHaveBeenCalled()
  })

  it('falls back to direct persistence when the invoice-profile RPC is unavailable', async () => {
    findProfile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row)
    saveProfile.mockRejectedValue({ code: 'PGRST202', message: 'upsert_building_invoice_profile not found' })
    uploadAsset.mockResolvedValue('building-1/qr/new.webp')
    const { BuildingInvoiceProfileService } = await import('../../../server/services/buildings/invoice-profile')

    const result = await BuildingInvoiceProfileService.save(
      { context: {} } as never,
      owner,
      'zeno',
      { fields, qrImage: qr, removeLogo: false },
    )

    expect(saveDirect).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingId: building.id,
      qrImagePath: 'building-1/qr/new.webp',
      logoImagePath: null,
    }))
    expect(backfillLegacySnapshots).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingId: building.id,
      buildingCode: building.code,
      qrImagePath: 'building-1/qr/new.webp',
    }))
    expect(result.qrImageUrl).toBe('signed:building-1/qr/old.webp')
  })
})
