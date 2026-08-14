import type { ContractAmendmentChangeSet, ContractTermSnapshot } from '~/types/contract-amendments'
import { CONTRACT_AMENDMENT_TERM_LABELS } from '~/utils/constants/contracts'
import { formatCurrencyNumber } from '~/utils/format/currency'

type TermKey = keyof ContractAmendmentChangeSet

export interface ContractAmendmentDiffRow {
  key: TermKey
  label: string
  before: string
  after: string
}

const snapshotKeys: Record<TermKey, keyof ContractTermSnapshot> = {
  monthlyRent: 'monthlyRent',
  deposit: 'deposit',
  paymentDueDay: 'paymentDueDay',
  occupantCount: 'occupantCount',
  discountAmount: 'discountAmount',
  surchargeAmount: 'surchargeAmount',
}

function displayTerm(key: TermKey, value: number | null): string {
  if (key === 'paymentDueDay') return value === null ? 'Kế thừa tòa nhà' : `Ngày ${value}`
  if (key === 'occupantCount') return `${value ?? 0} người`
  return `${formatCurrencyNumber(value ?? 0)} ₫`
}

export function contractAmendmentDiff(
  changes: ContractAmendmentChangeSet,
  beforeTerms: ContractTermSnapshot | null,
  afterTerms: ContractTermSnapshot | null,
): ContractAmendmentDiffRow[] {
  if (!beforeTerms || !afterTerms) return []
  return (Object.keys(changes) as TermKey[]).map(key => ({
    key,
    label: CONTRACT_AMENDMENT_TERM_LABELS[key] ?? key,
    before: displayTerm(key, beforeTerms[snapshotKeys[key]]),
    after: displayTerm(key, afterTerms[snapshotKeys[key]]),
  }))
}
