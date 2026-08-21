import type {
  ContractAmendment,
  ContractAmendmentChangeSet,
  ContractAmendmentStatus,
  ContractTermSnapshot,
  TenantContractAmendmentSummary,
} from '~/types/contract-amendments'
import type { Json, Tables } from '~/types/database.types'

export type ContractAmendmentRow = Tables<'contract_amendments'>

type JsonRecord = Record<string, Json | undefined>

function record(value: Json | null): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function optionalNumber(value: Json | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function mapChanges(value: Json): ContractAmendmentChangeSet {
  const source = record(value)
  return {
    ...(typeof source.monthly_rent === 'number' && { monthlyRent: source.monthly_rent }),
    ...(typeof source.deposit === 'number' && { deposit: source.deposit }),
    ...(Object.hasOwn(source, 'payment_due_day') && {
      paymentDueDay: typeof source.payment_due_day === 'number' ? source.payment_due_day : null,
    }),
    ...(typeof source.occupant_count === 'number' && { occupantCount: source.occupant_count }),
    ...(typeof source.discount_amount === 'number' && { discountAmount: source.discount_amount }),
    ...(typeof source.surcharge_amount === 'number' && { surchargeAmount: source.surcharge_amount }),
  }
}

function mapSnapshot(value: Json | null): ContractTermSnapshot | null {
  if (!value) return null
  const source = record(value)
  const monthlyRent = optionalNumber(source.monthly_rent)
  const deposit = optionalNumber(source.deposit)
  const occupantCount = optionalNumber(source.occupant_count)
  const discountAmount = optionalNumber(source.discount_amount)
  const surchargeAmount = optionalNumber(source.surcharge_amount)
  if ([monthlyRent, deposit, occupantCount, discountAmount, surchargeAmount].some(item => item === undefined)) return null

  return {
    monthlyRent: monthlyRent!,
    deposit: deposit!,
    paymentDueDay: typeof source.payment_due_day === 'number' ? source.payment_due_day : null,
    occupantCount: occupantCount!,
    discountAmount: discountAmount!,
    surchargeAmount: surchargeAmount!,
  }
}

export function mapContractAmendment(row: ContractAmendmentRow): ContractAmendment {
  return {
    id: row.id,
    contractId: row.contract_id,
    sequenceNo: row.sequence_no,
    title: row.title,
    publicContent: row.public_content,
    effectiveDate: row.effective_date,
    status: row.status as ContractAmendmentStatus,
    changes: mapChanges(row.changes),
    beforeTerms: mapSnapshot(row.before_terms),
    afterTerms: mapSnapshot(row.after_terms),
    createdBy: row.created_by,
    publishedBy: row.published_by,
    appliedBy: row.applied_by,
    cancelledBy: row.cancelled_by,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    appliedAt: row.applied_at,
    cancelledAt: row.cancelled_at,
  }
}

export function mapTenantContractAmendment(row: ContractAmendmentRow): TenantContractAmendmentSummary {
  const amendment = mapContractAmendment(row)
  if (!amendment.beforeTerms || !amendment.afterTerms || !['scheduled', 'applied'].includes(amendment.status)) {
    throw new Error('Published contract amendment is missing immutable snapshots')
  }
  return {
    id: amendment.id,
    sequenceNo: amendment.sequenceNo,
    title: amendment.title,
    publicContent: amendment.publicContent,
    effectiveDate: amendment.effectiveDate,
    status: amendment.status as TenantContractAmendmentSummary['status'],
    changes: amendment.changes,
    beforeTerms: amendment.beforeTerms,
    afterTerms: amendment.afterTerms,
  }
}
