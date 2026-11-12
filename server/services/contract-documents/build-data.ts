import dayjs from 'dayjs'
import type { Building } from '~/types/buildings'
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import type { ContractVehicle } from '~/types/contract-vehicles'
import type { HandoverInventory } from '~/types/inventory'
import { INVENTORY_CONDITION_LABELS } from '~/types/inventory'
import { inventoryTotalValue } from '~/utils/mappers/inventory'
import { formatCurrencyNumber } from '~/utils/format/currency'
import { formatPaymentWindow } from '~/utils/format/payment-window'
import { vndToWords } from '~/utils/format/vnd-words'

export interface DocPartySource {
  fullName: string | null
  dateOfBirth: string | null
  permanentAddress: string | null
  idNumber: string | null
  idIssuedDate: string | null
  idIssuedPlace: string | null
  phone: string | null
}

export interface DocContract {
  contractCode: string
  roomNumber: string
  startDate: string
  endDate: string
  monthlyRent: number
  deposit: number
  occupantCount: number
}

export interface DocService {
  name: string
  pricingType: 'fixed_per_room' | 'per_person' | 'per_vehicle'
  amount: number
  notes: string | null
}

export interface ContractDocumentSources {
  contract: DocContract
  building: Pick<Building, 'name' | 'address' | 'code' | 'electricityPricingType' | 'defaultElectricityRate' | 'waterPricingType' | 'defaultWaterRate' | 'billingGenerationDay' | 'paymentDueDay' | 'gracePeriodDays'>
  lessor: BuildingContractProfile | null
  invoiceProfile: { bankName: string; accountHolder: string; accountNumber: string; transferContentTemplate: string } | null
  tenant: DocParty
  occupants: DocParty[]
  vehicles: ContractVehicle[]
  services: DocService[]
  inventory: HandoverInventory
  handoverDate: string
  signedDate: string
}

export type DocParty = DocPartySource & { fullName: string | null }

const str = (v: unknown): string => (v == null ? '' : String(v))
const date = (iso: string | null): string => (iso ? dayjs(iso).format('DD/MM/YYYY') : '')
const UNIT_LABELS: Record<DocService['pricingType'], string> = {
  fixed_per_room: 'phòng/tháng',
  per_person: 'người/tháng',
  per_vehicle: 'xe/tháng',
}

function signedDateText(iso: string): string {
  const d = dayjs(iso)
  return `ngày ${d.format('DD')} tháng ${d.format('MM')} năm ${d.format('YYYY')}`
}

function waterUnit(type: Building['waterPricingType']): string {
  return type === 'per_m3' ? 'm³' : type === 'per_person' ? 'người' : 'phòng'
}

function party(src: DocPartySource): Record<string, string> {
  return {
    full_name: str(src.fullName),
    date_of_birth: date(src.dateOfBirth),
    permanent_address: str(src.permanentAddress),
    id_number: str(src.idNumber),
    id_issued_date: date(src.idIssuedDate),
    id_issued_place: str(src.idIssuedPlace),
    phone: str(src.phone),
  }
}

function depositMonthsEquiv(deposit: number, rent: number): string {
  if (!rent) return '0'
  const months = Math.round((deposit / rent) * 10) / 10
  return String(months).replace('.', ',')
}

function transferContent(template: string, buildingCode: string, roomNumber: string): string {
  return template
    .replaceAll('{building_code}', buildingCode)
    .replaceAll('{room_number}', roomNumber)
    .replaceAll('{invoice_code}', 'mã hóa đơn')
    .replaceAll('{period}', 'kỳ')
}

export function buildContractDocumentData(src: ContractDocumentSources): Record<string, unknown> {
  const { contract, building, lessor, invoiceProfile, inventory } = src
  const window = formatPaymentWindow(building)
  const electricityDisplay = building.electricityPricingType === 'tiered'
    ? 'Theo bậc thang của tòa nhà'
    : formatCurrencyNumber(building.defaultElectricityRate ?? 0)
  const overdueClause = window
    ? (window.overdueDay !== null
        ? `Nếu sau ngày ${window.overdueDay} của tháng không đóng tiền, Bên A có quyền chấm dứt hợp đồng.`
        : `Nếu quá ${window.graceDays} ngày sau hạn thanh toán không đóng tiền, Bên A có quyền chấm dứt hợp đồng.`)
    : ''

  const occupants = [src.tenant, ...src.occupants].map((p, i) => ({ index: i + 1, ...party(p) }))
  const vehicles = src.vehicles.map((v, i) => ({
    index: i + 1, owner_name: str(v.ownerName), plate_number: str(v.plateNumber),
    note: [v.vehicleType, v.note].filter(Boolean).join(' - '),
  }))
  const services = src.services.map((s, i) => ({
    index: i + 1, name: str(s.name), unit_price_display: formatCurrencyNumber(s.amount),
    unit_label: UNIT_LABELS[s.pricingType], note: str(s.notes),
  }))
  const inventoryItems = inventory.items.map((it, i) => ({
    index: i + 1, name: str(it.name), quantity: String(it.quantity),
    condition_label: INVENTORY_CONDITION_LABELS[it.condition], unit_value_display: it.unitValue == null ? '' : formatCurrencyNumber(it.unitValue),
    note: str(it.note),
  }))

  return {
    building: { brand_name: str(lessor?.brandName || building.name), address: str(building.address) },
    contract: {
      number: str(contract.contractCode),
      signed_date_text: signedDateText(src.signedDate),
      start_date: date(contract.startDate),
      end_date: date(contract.endDate),
      handover_date: date(src.handoverDate),
      monthly_rent_display: formatCurrencyNumber(contract.monthlyRent),
      deposit_display: formatCurrencyNumber(contract.deposit),
      deposit_words: vndToWords(Math.round(contract.deposit)),
      deposit_months_equiv: depositMonthsEquiv(contract.deposit, contract.monthlyRent),
      occupant_count: String(contract.occupantCount),
      vehicle_count: String(src.vehicles.length),
      signed_copies: String(lessor?.signedCopies ?? 2),
      copies_per_party: String(lessor?.copiesPerParty ?? 1),
    },
    lessor: party({
      fullName: lessor?.lessorFullName ?? null, dateOfBirth: lessor?.lessorDateOfBirth ?? null,
      permanentAddress: lessor?.lessorPermanentAddress ?? null, idNumber: lessor?.lessorIdNumber ?? null,
      idIssuedDate: lessor?.lessorIdIssuedDate ?? null, idIssuedPlace: lessor?.lessorIdIssuedPlace ?? null,
      phone: lessor?.lessorPhone ?? null,
    }),
    tenant: party(src.tenant),
    room: { number: str(contract.roomNumber) },
    utilities: {
      electricity_price_display: electricityDisplay,
      water_price_display: formatCurrencyNumber(building.defaultWaterRate ?? 0),
      water_unit: waterUnit(building.waterPricingType),
    },
    payment: {
      due_day_start: window ? String(window.startDay) : '',
      due_day_end: window ? String(window.endDay) : '',
      overdue_clause: overdueClause,
      account_holder: str(invoiceProfile?.accountHolder),
      account_number: str(invoiceProfile?.accountNumber),
      bank_name: str(invoiceProfile?.bankName),
      transfer_content: invoiceProfile ? transferContent(invoiceProfile.transferContentTemplate, str(building.code), str(contract.roomNumber)) : '',
    },
    terms: {
      notice_days: str(lessor?.noticeDays),
      deposit_refund_days: str(lessor?.depositRefundDays),
      renewal_months: str(lessor?.renewalMonths),
      extra_occupant_fee_display: formatCurrencyNumber(lessor?.extraOccupantFee ?? 0),
      drilling_fee_display: formatCurrencyNumber(lessor?.drillingFee ?? 0),
      fingerprint_reset_fee_display: formatCurrencyNumber(lessor?.fingerprintResetFee ?? 0),
    },
    occupants,
    vehicles,
    services,
    inventory: inventoryItems,
    inventory_total_display: formatCurrencyNumber(inventoryTotalValue(inventory.items)),
    inventory_empty_text: inventory.items.length > 0 ? '' : 'Không có tài sản bàn giao kèm theo.',
  }
}

export function buildAppendixData(
  src: ContractDocumentSources,
  amendment: { sequenceNo: number; title: string; publicContent: string; effectiveDate: string; changes: { label: string; before: string; after: string }[] },
): Record<string, unknown> {
  const base = buildContractDocumentData(src)
  return {
    ...base,
    appendix: {
      number: String(amendment.sequenceNo),
      signed_date_text: signedDateText(src.signedDate),
      title: str(amendment.title),
      public_content: str(amendment.publicContent),
      effective_date: date(amendment.effectiveDate),
    },
    changes: amendment.changes.map((c, i) => ({ index: i + 1, label: str(c.label), before: str(c.before), after: str(c.after) })),
  }
}
