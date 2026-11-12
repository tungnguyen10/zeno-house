import { describe, expect, it } from 'vitest'
import { buildContractDocumentData, type ContractDocumentSources, type DocParty } from '../../../server/services/contract-documents/build-data'
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
    building: { name: 'Zeno', address: '1 Nguyễn Huệ', code: 'ZEN', electricityPricingType: 'per_kwh', defaultElectricityRate: 3500, waterPricingType: 'per_m3', defaultWaterRate: 15000, billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5 } as never,
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
    expect((data.payment as Record<string, string>).overdue_clause).toContain('sau ngày 10')
    expect((data.occupants as { index: number; full_name: string }[]).map(o => o.full_name)).toEqual(['Người Thuê Giả Lập', 'Người Ở A', 'Người Ở B'])
    expect((data.services as { unit_label: string; note: string }[])[0]).toMatchObject({ unit_label: 'phòng/tháng', note: '' })
    expect((data.services as { unit_label: string }[])[1]!.unit_label).toBe('xe/tháng')
    expect(data.inventory_empty_text).toBe('')
    expect(data.inventory_total_display).toBe('2.000.000')
    expect((data.payment as Record<string, string>).transfer_content).toBe('ZEN P101 mã hóa đơn kỳ')
  })

  it('shows tiered electricity text and the grace-overflow clause', () => {
    const tiered = buildContractDocumentData(sources({ building: { ...sources().building, electricityPricingType: 'tiered', defaultElectricityRate: null } }))
    expect((tiered.utilities as Record<string, string>).electricity_price_display).toBe('Theo bậc thang của tòa nhà')
    const overflow = buildContractDocumentData(sources({ building: { ...sources().building, paymentDueDay: 28, gracePeriodDays: 5 } }))
    expect((overflow.payment as Record<string, string>).overdue_clause).toContain('quá 5 ngày sau hạn thanh toán')
  })

  it('sets empty-inventory text when there are no items', () => {
    const data = buildContractDocumentData(sources({ inventory: { sourceContractId: null, sourceContractCode: null, items: [] } }))
    expect(data.inventory_empty_text).toBe('Không có tài sản bàn giao kèm theo.')
  })

  it('renders to a DOCX with no leftover placeholders', () => {
    const template = readFileSync(resolve(process.cwd(), 'server/assets/contract-templates/hop-dong-thue-phong/v1.docx'))
    const out = renderDocx(template, buildContractDocumentData(sources()))
    const text = new PizZip(out).file('word/document.xml').asText().replace(/<[^>]+>/g, '')
    expect(text).not.toMatch(/\{\{|\}\}/)
    expect(text).toContain('Người Thuê Giả Lập')
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
