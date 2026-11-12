import type { Building } from '~/types/buildings'
import type { BuildingContractProfile, BuildingReadiness, ReadinessCode } from '~/types/building-contract-profile'

type ReadinessBuilding = Pick<Building,
  'billingGenerationDay' | 'paymentDueDay' | 'electricityPricingType' | 'defaultElectricityRate' | 'waterPricingType' | 'defaultWaterRate'>

const CONTRACT_FIELDS: [ReadinessCode, keyof BuildingContractProfile][] = [
  ['lessor.full_name', 'lessorFullName'],
  ['lessor.date_of_birth', 'lessorDateOfBirth'],
  ['lessor.permanent_address', 'lessorPermanentAddress'],
  ['lessor.id_number', 'lessorIdNumber'],
  ['lessor.id_issued_date', 'lessorIdIssuedDate'],
  ['lessor.id_issued_place', 'lessorIdIssuedPlace'],
  ['lessor.phone', 'lessorPhone'],
  ['contract.default_term_months', 'defaultTermMonths'],
  ['contract.default_deposit_months', 'defaultDepositMonths'],
  ['terms.notice_days', 'noticeDays'],
  ['terms.deposit_refund_days', 'depositRefundDays'],
  ['terms.renewal_months', 'renewalMonths'],
  ['terms.extra_occupant_fee', 'extraOccupantFee'],
  ['terms.drilling_fee', 'drillingFee'],
  ['terms.fingerprint_reset_fee', 'fingerprintResetFee'],
]

const status = (missing: ReadinessCode[]) => ({ ready: missing.length === 0, missing })

export function computeBuildingReadiness(
  building: ReadinessBuilding,
  contractProfile: BuildingContractProfile | null,
  hasInvoiceProfile: boolean,
): BuildingReadiness {
  const contract: ReadinessCode[] = CONTRACT_FIELDS
    .filter(([, key]) => contractProfile?.[key] == null)
    .map(([code]) => code)
  const billing: ReadinessCode[] = []

  const hasSchedule = building.billingGenerationDay != null && building.paymentDueDay != null
  if (!hasSchedule) {
    contract.push('billing.schedule')
    billing.push('billing.schedule')
  }
  if (building.electricityPricingType !== 'tiered' && building.defaultElectricityRate == null) {
    billing.push('billing.electricity_rate')
  }
  if (building.defaultWaterRate == null) billing.push('billing.water_rate')
  if (!hasInvoiceProfile) {
    contract.push('invoice_profile')
    billing.push('invoice_profile')
  }
  return { contract: status(contract), billing: status(billing) }
}
