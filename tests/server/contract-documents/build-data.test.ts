import { describe, expect, it } from 'vitest'
import { buildContractDocumentData, pickHandoverReadings, type ContractDocumentSources, type DocParty } from '../../../server/services/contract-documents/build-data'
import { collectMissing } from '../../../server/services/contract-documents/missing'
import { renderDocx } from '../../../server/services/contract-documents/render'
import { CONTRACT_TEMPLATES } from '../../../server/assets/contract-templates/manifest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PizZip from 'pizzip'

const party = (name: string, overrides: Partial<DocParty> = {}): DocParty => ({
  fullName: name, dateOfBirth: '1990-01-02', permanentAddress: '12 Lê Lợi, Huế',
  idNumber: '012345678901', idIssuedDate: '2021-05-01', idIssuedPlace: 'Cục CS QLHC', phone: '0901234567', ...overrides,
})

function sources(overrides: Partial<ContractDocumentSources> = {}): ContractDocumentSources {
  return {
    contract: { contractCode: 'HD-2026-001', roomNumber: 'P101', startDate: '2026-11-12', endDate: '2027-11-11', monthlyRent: 3_000_000, deposit: 4_500_000, occupantCount: 3 },
    building: { name: 'Zeno', address: '1 Nguyễn Huệ', code: 'ZEN', electricityPricingType: 'per_kwh', defaultElectricityRate: 3500, waterPricingType: 'per_m3', defaultWaterRate: 15000, billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5, ownerPhone: '0900000000' } as never,
    lessor: {
      buildingId: 'b-1', lessorFullName: 'Chủ Nhà', lessorDateOfBirth: '1975-01-01', lessorPermanentAddress: 'Huế',
      lessorIdNumber: '012000000001', lessorIdIssuedDate: '2020-01-01', lessorIdIssuedPlace: 'Huế', lessorPhone: '0900000000',
      lessorIdentityMasked: false, brandName: 'Zeno House', defaultTermMonths: 12, defaultDepositMonths: 1.5,
      noticeDays: 30, depositRefundDays: 7, renewalMonths: 6, extraOccupantFee: 500000, drillingFee: 50000, fingerprintResetFee: 100000,
      signedCopies: 2, copiesPerParty: 1, updatedAt: '', updatedBy: null,
    },
    invoiceProfile: { bankName: 'VCB', accountHolder: 'CHU NHA', accountNumber: '0123', transferContentTemplate: '{building_code} {room_number} {invoice_code} {period}' },
    tenant: party('Người Thuê Giả Lập'),
    occupants: [party('Người Ở A'), party('Người Ở B')],
    vehicles: [{ id: 'v1', ownerName: 'Người Thuê', plateNumber: '59X1 123.45', vehicleType: 'Xe máy', note: null, sortOrder: 0 }],
    services: [
      { name: 'Vệ sinh', pricingType: 'fixed_per_room', amount: 50000, notes: null },
      { name: 'Giữ xe', pricingType: 'per_vehicle', amount: 100000, notes: 'Ngoài trời' },
    ],
    inventory: { sourceContractId: null, sourceContractCode: null, items: [{ id: 'i1', name: 'Giường đơn', quantity: 1, condition: 'good', unitValue: 2_000_000, note: null, sortOrder: 0 }] },
    handoverDate: '2026-11-12',
    handoverReadings: { electricity: 1200, water: 340 },
    signedDate: '2026-12-05',
    ...overrides,
  }
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a == null ? undefined : (a as Record<string, unknown>)[k]), obj)
}

describe('buildContractDocumentData', () => {
  it('fills every manifest path and formats key fields', () => {
    const data = buildContractDocumentData(sources())
    for (const path of CONTRACT_TEMPLATES['hop-dong-thue-phong'].requiredPaths) {
      expect(resolvePath(data, path), path).not.toBeUndefined()
    }
    const c = data.contract as Record<string, string>
    expect(c.deposit_words).toBe('Bốn triệu năm trăm nghìn đồng')
    expect(c.deposit_months_equiv).toBe('1,5')
    expect(c.signed_date_text).toBe('ngày 05 tháng 12 năm 2026')
    expect((data.payment as Record<string, string>).overdue_clause).toBe('Nếu sau ngày 10 của tháng không đóng tiền,')
    expect((data.occupants as { index: number; full_name: string }[]).map(o => o.full_name)).toEqual(['Người Thuê Giả Lập', 'Người Ở A', 'Người Ở B'])
    expect((data.services as { unit_label: string; note: string }[])[0]).toMatchObject({ unit_label: 'phòng/tháng', note: '' })
    expect((data.services as { unit_label: string }[])[1]!.unit_label).toBe('xe/tháng')
    expect((data.inventory as unknown[])[0]).toEqual({ index: 1, name_display: 'Giường đơn', value_display: '2.000.000', note_display: 'Tốt' })
    expect((data.building as Record<string, string>).contact_phone).toBe('0900000000')
    expect((data.payment as Record<string, string>).transfer_content).toBe('ZEN P101 mã hóa đơn kỳ')
  })

  it('labels utility prices with currency and unit', () => {
    const data = buildContractDocumentData(sources())
    const utilities = data.utilities as Record<string, string>
    expect(utilities.electricity_price_display).toBe('3.500 VNĐ/kWh')
    expect(utilities.water_price_display).toBe('15.000')
    const fixed = buildContractDocumentData(sources({ building: { ...sources().building, electricityPricingType: 'fixed', defaultElectricityRate: 200000 } }))
    expect((fixed.utilities as Record<string, string>).electricity_price_display).toBe('200.000 VNĐ/phòng/tháng')
  })

  it('shows tiered electricity text and the grace-overflow clause', () => {
    const tiered = buildContractDocumentData(sources({ building: { ...sources().building, electricityPricingType: 'tiered', defaultElectricityRate: null } }))
    expect((tiered.utilities as Record<string, string>).electricity_price_display).toBe('Theo bậc thang của tòa nhà')
    const overflow = buildContractDocumentData(sources({ building: { ...sources().building, paymentDueDay: 28, gracePeriodDays: 5 } }))
    expect((overflow.payment as Record<string, string>).overdue_clause).toContain('quá 5 ngày sau hạn thanh toán')
  })

  it('prints the handover meter readings with units, or a not-recorded text', () => {
    const data = buildContractDocumentData(sources())
    expect(data.handover).toEqual({ electricity_display: '1.200 kWh', water_display: '340 m³' })
    const none = buildContractDocumentData(sources({ handoverReadings: { electricity: null, water: null } }))
    expect(none.handover).toEqual({ electricity_display: 'Chưa ghi nhận', water_display: 'Chưa ghi nhận' })
  })

  it('multiplies inventory value by quantity and joins condition with note', () => {
    const data = buildContractDocumentData(sources({ inventory: { sourceContractId: null, sourceContractCode: null, items: [{ id: 'i2', name: 'Ghế', quantity: 2, condition: 'used', unitValue: 100_000, note: 'Gỗ', sortOrder: 0 }] } }))
    expect((data.inventory as unknown[])[0]).toEqual({ index: 1, name_display: 'Ghế (x2)', value_display: '200.000', note_display: 'Đã qua sử dụng - Gỗ' })
  })

  it('renders to a DOCX with no leftover placeholders', () => {
    const template = readFileSync(resolve(process.cwd(), 'server/assets/contract-templates/hop-dong-thue-phong/v1.docx'))
    const out = renderDocx(template, buildContractDocumentData(sources()))
    const text = new PizZip(out).file('word/document.xml').asText().replace(/<[^>]+>/g, '')
    expect(text).not.toMatch(/\{\{|\}\}/)
    expect(text).toContain('Người Thuê Giả Lập')
  })
})

describe('pickHandoverReadings', () => {
  const reading = (over: Record<string, unknown>) => ({ contractId: 'c-1', readingType: 'handover_in', meterType: 'electricity', readingValue: 10, readingDate: '2026-11-12', ...over })

  it('takes the handover_in reading of this contract per meter type', () => {
    const picked = pickHandoverReadings([
      reading({ meterType: 'electricity', readingValue: 1200 }),
      reading({ meterType: 'water', readingValue: 340 }),
      reading({ readingType: 'monthly', readingValue: 1300 }),
      reading({ contractId: 'other', readingValue: 99 }),
      reading({ readingType: 'handover_out', readingValue: 1500 }),
    ] as never, 'c-1')
    expect(picked).toEqual({ electricity: 1200, water: 340 })
  })

  it('returns nulls when the contract has no handover reading', () => {
    expect(pickHandoverReadings([], 'c-1')).toEqual({ electricity: null, water: null })
  })

  it('falls back to the original contract of a renewal chain, preferring the newest', () => {
    const picked = pickHandoverReadings([
      reading({ contractId: 'c-1', meterType: 'electricity', readingValue: 1200 }),
      reading({ contractId: 'c-1', meterType: 'water', readingValue: 340 }),
      reading({ contractId: 'c-2', meterType: 'water', readingValue: 500 }),
    ] as never, ['c-3', 'c-2', 'c-1'])
    expect(picked).toEqual({ electricity: 1200, water: 500 })
  })
})

describe('collectMissing', () => {
  it('reports all lessor + terms codes when the profile is missing', () => {
    const missing = collectMissing(sources({ lessor: null }))
    const codes = missing.map(m => m.code)
    for (const f of ['full_name', 'date_of_birth', 'permanent_address', 'id_number', 'id_issued_date', 'id_issued_place', 'phone']) {
      expect(codes).toContain(`lessor.${f}`)
    }
    expect(codes).toContain('terms.notice_days')
    expect(codes).toContain('terms.fingerprint_reset_fee')
  })

  it('flags a tenant field, a named roommate field, invoice profile and schedule', () => {
    const missing = collectMissing(sources({
      tenant: party('Khách', { idIssuedPlace: null }),
      occupants: [party('Người Ở A'), party('Người Ở B', { idNumber: null })],
      invoiceProfile: null,
      building: { ...sources().building, paymentDueDay: null },
    }))
    expect(missing.map(m => m.code)).toContain('tenant.id_issued_place')
    const roommate = missing.find(m => m.code === 'occupant[2].id_number')
    expect(roommate).toBeTruthy()
    expect(roommate!.label).toContain('Người Ở B')
    expect(missing.map(m => m.code)).toContain('invoice_profile')
    expect(missing.map(m => m.code)).toContain('billing.schedule')
  })

  it('returns nothing when everything is present', () => {
    expect(collectMissing(sources())).toEqual([])
  })
})
