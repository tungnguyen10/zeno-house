import type { BuildingContractProfile } from '~/types/building-contract-profile'

export const CONTRACT_TERM_SUGGESTIONS = {
  default_term_months: 12,
  default_deposit_months: 1,
  notice_days: 30,
  deposit_refund_days: 7,
  renewal_months: 6,
} as const

export function contractTermsInitialValues(p: BuildingContractProfile | null) {
  return {
    brand_name: p?.brandName ?? '',
    default_term_months: p?.defaultTermMonths ?? CONTRACT_TERM_SUGGESTIONS.default_term_months,
    default_deposit_months: (p?.defaultDepositMonths ?? CONTRACT_TERM_SUGGESTIONS.default_deposit_months) as number | null,
    notice_days: p?.noticeDays ?? CONTRACT_TERM_SUGGESTIONS.notice_days,
    deposit_refund_days: p?.depositRefundDays ?? CONTRACT_TERM_SUGGESTIONS.deposit_refund_days,
    renewal_months: p?.renewalMonths ?? CONTRACT_TERM_SUGGESTIONS.renewal_months,
    extra_occupant_fee: p?.extraOccupantFee ?? null,
    drilling_fee: p?.drillingFee ?? null,
    fingerprint_reset_fee: p?.fingerprintResetFee ?? null,
    signed_copies: p?.signedCopies ?? 2,
    copies_per_party: p?.copiesPerParty ?? 1,
  }
}

export type ContractTermsFormValues = ReturnType<typeof contractTermsInitialValues>
