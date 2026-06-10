import type { Tables } from '~/types/database.types'
import type { ContractPayment, ContractPaymentType } from '~/types/contract-payments'

export function mapContractPayment(row: Tables<'contract_payments'>): ContractPayment {
  return {
    id: row.id,
    contractId: row.contract_id,
    paymentType: row.payment_type as ContractPaymentType,
    amount: row.amount,
    coveredPeriodStart: row.covered_period_start,
    coveredPeriodEnd: row.covered_period_end,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
