import type { BuildingContractProfile } from '~/types/building-contract-profile'

export interface BuildingContractProfileRow {
  building_id: string
  lessor_full_name: string | null
  lessor_date_of_birth: string | null
  lessor_permanent_address: string | null
  lessor_id_number: string | null
  lessor_id_issued_date: string | null
  lessor_id_issued_place: string | null
  lessor_phone: string | null
  brand_name: string | null
  default_term_months: number | null
  default_deposit_months: number | string | null
  notice_days: number | null
  deposit_refund_days: number | null
  renewal_months: number | null
  extra_occupant_fee: number | string | null
  drilling_fee: number | string | null
  fingerprint_reset_fee: number | string | null
  signed_copies: number
  copies_per_party: number
  updated_by: string | null
  created_at: string | null
  updated_at: string | null
}

const num = (value: number | string | null): number | null => (value === null ? null : Number(value))

export function mapBuildingContractProfile(row: BuildingContractProfileRow): BuildingContractProfile {
  return {
    buildingId: row.building_id,
    lessorFullName: row.lessor_full_name,
    lessorDateOfBirth: row.lessor_date_of_birth,
    lessorPermanentAddress: row.lessor_permanent_address,
    lessorIdNumber: row.lessor_id_number,
    lessorIdIssuedDate: row.lessor_id_issued_date,
    lessorIdIssuedPlace: row.lessor_id_issued_place,
    lessorPhone: row.lessor_phone,
    lessorIdentityMasked: false,
    brandName: row.brand_name,
    defaultTermMonths: row.default_term_months,
    defaultDepositMonths: num(row.default_deposit_months),
    noticeDays: row.notice_days,
    depositRefundDays: row.deposit_refund_days,
    renewalMonths: row.renewal_months,
    extraOccupantFee: num(row.extra_occupant_fee),
    drillingFee: num(row.drilling_fee),
    fingerprintResetFee: num(row.fingerprint_reset_fee),
    signedCopies: row.signed_copies,
    copiesPerParty: row.copies_per_party,
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by,
  }
}

export function maskIdNumber(value: string | null): string | null {
  if (!value) return null
  return `*******${value.slice(-4)}`
}

export function maskBuildingContractProfile(profile: BuildingContractProfile): BuildingContractProfile {
  return {
    ...profile,
    lessorIdNumber: maskIdNumber(profile.lessorIdNumber),
    lessorDateOfBirth: null,
    lessorPermanentAddress: null,
    lessorIdentityMasked: true,
  }
}
