import { beforeEach, describe, expect, it, vi } from 'vitest'

const signAsset = vi.fn()
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: { signAsset },
}))

const snapshot = {
  schema_version: 1,
  bank_name: 'VIB',
  account_holder: 'NGUYỄN TUẤN ANH',
  account_number: '375675817',
  transfer_content: 'zeno-P04-inv-2026-07-0009-07/2026',
  qr_image_path: 'building-1/qr/shared.webp',
  logo_image_path: 'building-1/logo/shared.webp',
  snapshotted_at: '2026-07-20T00:00:00.000Z',
}

describe('InvoiceProfileDisplayService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signAsset.mockImplementation(async (_event, path) => `signed:${path}`)
  })

  it('maps immutable snapshots and signs each unique path once per batch', async () => {
    const { InvoiceProfileDisplayService } = await import(
      '../../../server/services/billing/invoice-profile-display'
    )

    const result = await InvoiceProfileDisplayService.resolveMany({ context: {} } as never, new Map([
      ['invoice-1', snapshot],
      ['invoice-2', snapshot],
    ]))

    expect(result.get('invoice-1')).toMatchObject({
      bankName: 'VIB',
      qrImageUrl: 'signed:building-1/qr/shared.webp',
      logoImageUrl: 'signed:building-1/logo/shared.webp',
    })
    expect(result.get('invoice-2')).toEqual(result.get('invoice-1'))
    expect(signAsset).toHaveBeenCalledTimes(2)
  })

  it('returns null for missing or unsupported snapshots without using current profile data', async () => {
    const { InvoiceProfileDisplayService } = await import(
      '../../../server/services/billing/invoice-profile-display'
    )

    const result = await InvoiceProfileDisplayService.resolveMany({ context: {} } as never, new Map([
      ['invoice-1', null],
      ['invoice-2', { ...snapshot, schema_version: 2 }],
    ]))

    expect(result.get('invoice-1')).toBeNull()
    expect(result.get('invoice-2')).toBeNull()
    expect(signAsset).not.toHaveBeenCalled()
  })
})
