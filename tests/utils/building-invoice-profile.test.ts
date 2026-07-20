import { describe, expect, it } from 'vitest'
import {
  buildingInvoiceProfileFieldsSchema,
  extractTransferTemplateVariables,
} from '../../app/utils/validators/building-invoice-profile'
import {
  mapBuildingInvoiceProfile,
  parseStoredInvoiceProfileSnapshot,
} from '../../app/utils/mappers/building-invoice-profile'

const validProfile = {
  bank_name: 'Ngân hàng Quốc tế Việt Nam (VIB)',
  account_holder: 'NGUYỄN TUẤN ANH',
  account_number: '375675817',
  transfer_content_template: '{building_code}-{room_number}-{invoice_code}-{period}',
}

describe('building invoice profile validator', () => {
  it('normalizes a complete profile and accepts the four supported variables', () => {
    const result = buildingInvoiceProfileFieldsSchema.parse({
      bank_name: `  ${validProfile.bank_name}  `,
      account_holder: `  ${validProfile.account_holder}  `,
      account_number: `  ${validProfile.account_number}  `,
      transfer_content_template: `  ${validProfile.transfer_content_template}  `,
    })

    expect(result).toEqual(validProfile)
    expect(extractTransferTemplateVariables(result.transfer_content_template)).toEqual([
      'building_code',
      'room_number',
      'invoice_code',
      'period',
    ])
  })

  it('rejects unsupported template variables', () => {
    const result = buildingInvoiceProfileFieldsSchema.safeParse({
      ...validProfile,
      transfer_content_template: '{tenant_name}-{room_number}',
    })

    expect(result.success).toBe(false)
  })

  it('rejects blank or excessively long values', () => {
    expect(buildingInvoiceProfileFieldsSchema.safeParse({
      ...validProfile,
      bank_name: '   ',
    }).success).toBe(false)
    expect(buildingInvoiceProfileFieldsSchema.safeParse({
      ...validProfile,
      transfer_content_template: 'x'.repeat(201),
    }).success).toBe(false)
  })
})

describe('building invoice profile mappers', () => {
  it('maps a profile row without exposing asset paths', () => {
    const result = mapBuildingInvoiceProfile({
      building_id: 'building-1',
      bank_name: validProfile.bank_name,
      account_holder: validProfile.account_holder,
      account_number: validProfile.account_number,
      transfer_content_template: validProfile.transfer_content_template,
      qr_image_path: 'building-1/qr/private.webp',
      logo_image_path: null,
      legacy_backfilled_at: '2026-07-20T00:00:00.000Z',
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
      updated_by: 'owner-1',
    }, {
      qrImageUrl: 'https://signed.example/qr',
      logoImageUrl: null,
    })

    expect(result).toMatchObject({
      buildingId: 'building-1',
      qrImageUrl: 'https://signed.example/qr',
      logoImageUrl: null,
    })
    expect(result).not.toHaveProperty('qrImagePath')
  })

  it('accepts only a complete schema-versioned invoice snapshot', () => {
    const snapshot = parseStoredInvoiceProfileSnapshot({
      schema_version: 1,
      bank_name: validProfile.bank_name,
      account_holder: validProfile.account_holder,
      account_number: validProfile.account_number,
      transfer_content: 'zeno-P04-inv-2026-07-0009-07/2026',
      qr_image_path: 'building-1/qr/private.webp',
      logo_image_path: null,
      snapshotted_at: '2026-07-20T00:00:00.000Z',
    })

    expect(snapshot?.transferContent).toContain('inv-2026-07-0009')
    expect(parseStoredInvoiceProfileSnapshot({ ...snapshot, schema_version: 2 })).toBeNull()
    expect(parseStoredInvoiceProfileSnapshot(null)).toBeNull()
  })
})
